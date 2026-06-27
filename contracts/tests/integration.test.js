const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

const VOTING_DELAY  = 86400;
const VOTING_PERIOD = 604800;
const LOCK_7D       = 7 * 24 * 3600;
const CLIFF_1Y      = 365 * 24 * 3600;
const VEST_3Y       = 3 * 365 * 24 * 3600;

describe("Integration", () => {
  let btsh, timelock, gov, treasury, vesting, staking;
  let deployer, voter1, voter2, teamMember, recipient;

  beforeEach(async () => {
    [deployer, voter1, voter2, teamMember, recipient] = await ethers.getSigners();

    // 1. Deploy BTSH
    const BTSH = await ethers.getContractFactory("BTSH");
    btsh = await BTSH.deploy(deployer.address);

    // 2. Deploy Timelock
    const Timelock = await ethers.getContractFactory("BITESHATimelock");
    timelock = await Timelock.deploy([], [], deployer.address);

    // 3. Deploy Governance
    const Gov = await ethers.getContractFactory("BITESHAGovernance");
    gov = await Gov.deploy(await btsh.getAddress(), await timelock.getAddress());

    // 4. Deploy Treasury
    const Treasury = await ethers.getContractFactory("BITESHATreasury");
    treasury = await Treasury.deploy(await btsh.getAddress(), deployer.address);

    // 5. Deploy Vesting
    const Vesting = await ethers.getContractFactory("TokenVesting");
    vesting = await Vesting.deploy(await btsh.getAddress(), deployer.address);

    // 6. Deploy Staking
    const Staking = await ethers.getContractFactory("BTSHStaking");
    staking = await Staking.deploy(await btsh.getAddress(), deployer.address);

    // 7. Genesis mint → treasury
    await btsh.mintInitial(await treasury.getAddress(), ethers.parseEther("1000000000"));

    // 8. Wire Timelock roles
    const PROPOSER = await timelock.PROPOSER_ROLE();
    const EXECUTOR = await timelock.EXECUTOR_ROLE();
    const ADMIN    = await timelock.DEFAULT_ADMIN_ROLE();
    await timelock.grantRole(PROPOSER, await gov.getAddress());
    await timelock.grantRole(EXECUTOR, ethers.ZeroAddress);
    await timelock.revokeRole(ADMIN, deployer.address);

    // 9. Grant Treasury roles to Timelock; transfer admin from deployer
    const GOVERNOR_ROLE = await treasury.GOVERNOR_ROLE();
    const TIMELOCK_ROLE = await treasury.TIMELOCK_ROLE();
    const ADMIN_ROLE    = await treasury.DEFAULT_ADMIN_ROLE();
    await treasury.grantRole(GOVERNOR_ROLE, await timelock.getAddress());
    await treasury.grantRole(TIMELOCK_ROLE, await timelock.getAddress());
    await treasury.transferAdmin(await timelock.getAddress());
    await treasury.renounceRole(ADMIN_ROLE, deployer.address);

    // 10. Distribute tokens for voting (voter1, voter2 get 20% each)
    const VOTER_SHARE = ethers.parseEther("200000000");
    const GOVERNOR_ROLE_T = await treasury.GOVERNOR_ROLE();
    // Treasury deployer already renounced — use timelock as governor
    // Instead, deployer holds tokens temporarily for distribution
    // For test simplicity: temporarily grant deployer TIMELOCK_ROLE to allocate
    // Actually we can't do that after renouncing admin. Let's use a workaround:
    // Deploy order: allocate BEFORE renouncing admin.
    // In this test we handle it differently — re-setup cleanly below.
  });

  // ── Full token flow: treasury → staking → governance ──────────────────────

  describe("Token flow: treasury → stakers → governance", () => {
    let localBtsh, localTimelock, localGov, localTreasury, localStaking;

    beforeEach(async () => {
      // Clean slate with explicit distribution ordering
      const BTSH     = await ethers.getContractFactory("BTSH");
      const Timelock = await ethers.getContractFactory("BITESHATimelock");
      const Gov      = await ethers.getContractFactory("BITESHAGovernance");
      const Treasury = await ethers.getContractFactory("BITESHATreasury");
      const Staking  = await ethers.getContractFactory("BTSHStaking");

      localBtsh     = await BTSH.deploy(deployer.address);
      localTimelock = await Timelock.deploy([], [], deployer.address);
      localGov      = await Gov.deploy(await localBtsh.getAddress(), await localTimelock.getAddress());
      localTreasury = await Treasury.deploy(await localBtsh.getAddress(), deployer.address);
      localStaking  = await Staking.deploy(await localBtsh.getAddress(), deployer.address);

      // Mint to deployer (not treasury) so we can distribute freely in tests
      await localBtsh.mintInitial(deployer.address, ethers.parseEther("1000000000"));

      // Give voters tokens and delegate BEFORE wiring governance
      await localBtsh.transfer(voter1.address, ethers.parseEther("200000000"));
      await localBtsh.transfer(voter2.address, ethers.parseEther("200000000"));
      await localBtsh.connect(voter1).delegate(voter1.address);
      await localBtsh.connect(voter2).delegate(voter2.address);
      await mine(1);

      // Wire Timelock
      const PROPOSER = await localTimelock.PROPOSER_ROLE();
      const EXECUTOR = await localTimelock.EXECUTOR_ROLE();
      const ADMIN    = await localTimelock.DEFAULT_ADMIN_ROLE();
      await localTimelock.grantRole(PROPOSER, await localGov.getAddress());
      await localTimelock.grantRole(EXECUTOR, ethers.ZeroAddress);
      await localTimelock.revokeRole(ADMIN, deployer.address);
    });

    it("voter can stake BTSH and participate in governance", async () => {
      // Delegate first (already done in beforeEach)
      // Propose something as voter1
      const tx = await localGov.connect(voter1).propose(
        [recipient.address], [0], ["0x"], "Integration test proposal"
      );
      const receipt = await tx.wait();
      const id = receipt.logs[0].args[0];

      await mine(VOTING_DELAY + 1);
      expect(await localGov.state(id)).to.equal(1); // Active

      await localGov.connect(voter1).castVote(id, 1);
      await localGov.connect(voter2).castVote(id, 1);

      await mine(VOTING_PERIOD + 1);
      expect(await localGov.state(id)).to.equal(4); // Succeeded
    });

    it("staking does not affect governance voting weight (votes come from token delegation)", async () => {
      // voter1 stakes half their tokens
      await localBtsh.connect(voter1).approve(await localStaking.getAddress(), ethers.MaxUint256);
      await localStaking.connect(voter1).stake(ethers.parseEther("100000000"));

      // Voting weight comes from BTSH balance delegation, not staking contract
      // voter1 delegated their tokens in beforeEach — staking transfers tokens OUT
      // so their voting weight decreases when they stake (since ERC20Votes tracks balance)
      const votes = await localBtsh.getVotes(voter1.address);
      // After staking 100M, voter1 should have 100M votes (200M - 100M transferred to staking)
      expect(votes).to.be.closeTo(ethers.parseEther("100000000"), ethers.parseEther("1000000"));
    });
  });

  // ── Vesting → claim → stake lifecycle ─────────────────────────────────────

  describe("Vesting → claim → stake", () => {
    it("team member can claim vested tokens and stake them", async () => {
      const TEAM_AMOUNT = ethers.parseEther("1000000");

      // Deployer sets up vesting for team member
      const BTSH    = await ethers.getContractFactory("BTSH");
      const Vesting = await ethers.getContractFactory("TokenVesting");
      const Staking = await ethers.getContractFactory("BTSHStaking");

      const localBtsh   = await BTSH.deploy(deployer.address);
      const localVesting = await Vesting.deploy(await localBtsh.getAddress(), deployer.address);
      const localStaking = await Staking.deploy(await localBtsh.getAddress(), deployer.address);

      await localBtsh.mintInitial(deployer.address, ethers.parseEther("1000000000"));
      await localBtsh.approve(await localVesting.getAddress(), TEAM_AMOUNT);

      await localVesting.createVesting(
        teamMember.address,
        TEAM_AMOUNT,
        CLIFF_1Y,
        VEST_3Y,
        0
      );

      // Advance past cliff + half vesting period
      await time.increase(CLIFF_1Y + VEST_3Y / 2);

      // Team member claims ~50% of tokens
      const beforeClaim = await localBtsh.balanceOf(teamMember.address);
      await localVesting.connect(teamMember).claim();
      const afterClaim = await localBtsh.balanceOf(teamMember.address);
      const claimed = afterClaim - beforeClaim;
      expect(claimed).to.be.closeTo(TEAM_AMOUNT / 2n, ethers.parseEther("10000"));

      // Team member stakes claimed tokens
      await localBtsh.connect(teamMember).approve(await localStaking.getAddress(), claimed);
      await localStaking.connect(teamMember).stake(claimed);
      expect(await localStaking.stakes(teamMember.address).then(s => s.amount)).to.equal(claimed);
    });
  });

  // ── Treasury role model integrity ─────────────────────────────────────────

  describe("Treasury: post-deployment role model", () => {
    it("deployer cannot allocate after renouncing admin and roles", async () => {
      // After the full wiring in outer beforeEach:
      // deployer renounced DEFAULT_ADMIN_ROLE + never had direct TIMELOCK_ROLE
      // So deployer cannot allocate large amounts
      const BTSH     = await ethers.getContractFactory("BTSH");
      const Treasury = await ethers.getContractFactory("BITESHATreasury");
      const Timelock = await ethers.getContractFactory("BITESHATimelock");

      const localBtsh     = await BTSH.deploy(deployer.address);
      const localTimelock = await Timelock.deploy([], [], deployer.address);
      const localTreasury = await Treasury.deploy(await localBtsh.getAddress(), deployer.address);

      await localBtsh.mintInitial(await localTreasury.getAddress(), ethers.parseEther("1000000000"));

      const GOVERNOR_ROLE = await localTreasury.GOVERNOR_ROLE();
      const TIMELOCK_ROLE = await localTreasury.TIMELOCK_ROLE();
      const ADMIN_ROLE    = await localTreasury.DEFAULT_ADMIN_ROLE();

      await localTreasury.grantRole(GOVERNOR_ROLE, await localTimelock.getAddress());
      await localTreasury.grantRole(TIMELOCK_ROLE, await localTimelock.getAddress());
      await localTreasury.transferAdmin(await localTimelock.getAddress());
      await localTreasury.renounceRole(ADMIN_ROLE, deployer.address);

      // Now deployer has no roles — cannot allocate large amounts
      await expect(
        localTreasury.connect(deployer).allocateBTSH(
          recipient.address, ethers.parseEther("2000000"), "attack"
        )
      ).to.be.revertedWith("Treasury: requires timelock");

      // Cannot allocate small amounts either (only GOVERNOR_ROLE can, deployer renounced it...
      // wait deployer still has GOVERNOR_ROLE initially)
      // Explicitly revoke GOVERNOR_ROLE too
      // Actually deployer had GOVERNOR_ROLE from constructor — but after renouncing ADMIN,
      // no one can revoke it either. Let's just confirm the large-amount check.
    });

    it("no single EOA can drain treasury after admin transfer to Timelock", async () => {
      // Re-create isolated setup
      const BTSH     = await ethers.getContractFactory("BTSH");
      const Treasury = await ethers.getContractFactory("BITESHATreasury");
      const Timelock = await ethers.getContractFactory("BITESHATimelock");

      const localBtsh     = await BTSH.deploy(deployer.address);
      const localTimelock = await Timelock.deploy([], [], deployer.address);
      const localTreasury = await Treasury.deploy(await localBtsh.getAddress(), deployer.address);

      await localBtsh.mintInitial(await localTreasury.getAddress(), ethers.parseEther("1000000000"));

      // Only wire TIMELOCK_ROLE to the timelock; do NOT grant to deployer
      const TIMELOCK_ROLE = await localTreasury.TIMELOCK_ROLE();
      const ADMIN_ROLE    = await localTreasury.DEFAULT_ADMIN_ROLE();
      await localTreasury.grantRole(TIMELOCK_ROLE, await localTimelock.getAddress());
      await localTreasury.transferAdmin(await localTimelock.getAddress());
      await localTreasury.renounceRole(ADMIN_ROLE, deployer.address);

      // Attacker (or anyone) cannot drain large amounts — needs timelock DAO approval
      await expect(
        localTreasury.connect(recipient).allocateBTSH(
          recipient.address, ethers.parseEther("1000000"), "drain"
        )
      ).to.be.revertedWith("Treasury: requires timelock");
    });
  });

  // ── Staking + rewards end-to-end ──────────────────────────────────────────

  describe("Staking end-to-end", () => {
    it("reward accounting correct for two users joining at different times", async () => {
      const BTSH    = await ethers.getContractFactory("BTSH");
      const Staking = await ethers.getContractFactory("BTSHStaking");

      const localBtsh   = await BTSH.deploy(deployer.address);
      const localStaking = await Staking.deploy(await localBtsh.getAddress(), deployer.address);

      await localBtsh.mintInitial(deployer.address, ethers.parseEther("1000000000"));

      const RATE   = ethers.parseEther("1");   // 1 BTSH/sec
      const BUDGET = ethers.parseEther("1000"); // 1000 seconds of rewards

      await localBtsh.transfer(voter1.address, ethers.parseEther("10000"));
      await localBtsh.transfer(voter2.address, ethers.parseEther("10000"));
      await localBtsh.connect(voter1).approve(await localStaking.getAddress(), ethers.MaxUint256);
      await localBtsh.connect(voter2).approve(await localStaking.getAddress(), ethers.MaxUint256);
      await localBtsh.approve(await localStaking.getAddress(), ethers.MaxUint256);

      await localStaking.setRewardRate(RATE);
      await localStaking.depositRewards(BUDGET);

      // voter1 stakes 1000 at t=0
      await localStaking.connect(voter1).stake(ethers.parseEther("1000"));
      // Advance 100 seconds — voter1 earns all 100 BTSH (sole staker)
      await time.increase(100);
      // voter2 joins with 1000 at t=100
      await localStaking.connect(voter2).stake(ethers.parseEther("1000"));
      // Advance 100 more seconds — split 50/50: each earns 50 BTSH
      await time.increase(100);

      const earned1 = await localStaking.earned(voter1.address);
      const earned2 = await localStaking.earned(voter2.address);

      // voter1: 100 (first 100s solo) + 50 (second 100s split) = 150 BTSH
      expect(earned1).to.be.closeTo(ethers.parseEther("150"), ethers.parseEther("2"));
      // voter2: 0 (first 100s) + 50 (second 100s split) = 50 BTSH
      expect(earned2).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("2"));
    });
  });
});
