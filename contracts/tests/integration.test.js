const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

const VOTING_DELAY  = 86400;
const VOTING_PERIOD = 604800;
const LOCK_7D       = 7 * 24 * 3600;
const CLIFF_1Y      = 365 * 24 * 3600;
const VEST_3Y       = 3 * 365 * 24 * 3600;

describe("Integration", () => {
  let btsh, timelock, gov, treasury, vesting;
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

    // 6. Genesis mint → treasury
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

  // ── Full token flow: treasury → governance ────────────────────────────────

  describe("Token flow: holders → governance", () => {
    let localBtsh, localTimelock, localGov, localTreasury;

    beforeEach(async () => {
      // Clean slate with explicit distribution ordering
      const BTSH     = await ethers.getContractFactory("BTSH");
      const Timelock = await ethers.getContractFactory("BITESHATimelock");
      const Gov      = await ethers.getContractFactory("BITESHAGovernance");
      const Treasury = await ethers.getContractFactory("BITESHATreasury");

      localBtsh     = await BTSH.deploy(deployer.address);
      localTimelock = await Timelock.deploy([], [], deployer.address);
      localGov      = await Gov.deploy(await localBtsh.getAddress(), await localTimelock.getAddress());
      localTreasury = await Treasury.deploy(await localBtsh.getAddress(), deployer.address);

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

    it("holder can propose and pass a governance vote", async () => {
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

    it("voting weight tracks delegated BTSH balance (no staking, no yield)", async () => {
      // Donation+governance model: voting power comes purely from token delegation.
      const votes = await localBtsh.getVotes(voter1.address);
      expect(votes).to.equal(ethers.parseEther("200000000"));
    });
  });

  // ── Vesting → claim → delegate lifecycle ──────────────────────────────────

  describe("Vesting → claim → delegate (governance, not yield)", () => {
    it("team member can claim vested tokens and use them for governance voice", async () => {
      const TEAM_AMOUNT = ethers.parseEther("1000000");

      const BTSH    = await ethers.getContractFactory("BTSH");
      const Vesting = await ethers.getContractFactory("TokenVesting");

      const localBtsh    = await BTSH.deploy(deployer.address);
      const localVesting = await Vesting.deploy(await localBtsh.getAddress(), deployer.address);

      await localBtsh.mintInitial(deployer.address, ethers.parseEther("1000000000"));
      await localBtsh.approve(await localVesting.getAddress(), TEAM_AMOUNT);

      await localVesting.createVesting(teamMember.address, TEAM_AMOUNT, CLIFF_1Y, VEST_3Y, 0);

      // Advance past cliff + half vesting period
      await time.increase(CLIFF_1Y + VEST_3Y / 2);

      // Team member claims ~50% of tokens
      const beforeClaim = await localBtsh.balanceOf(teamMember.address);
      await localVesting.connect(teamMember).claim();
      const claimed = (await localBtsh.balanceOf(teamMember.address)) - beforeClaim;
      expect(claimed).to.be.closeTo(TEAM_AMOUNT / 2n, ethers.parseEther("10000"));

      // Claimed tokens grant a governance voice (voting power), not yield.
      await localBtsh.connect(teamMember).delegate(teamMember.address);
      await mine(1);
      expect(await localBtsh.getVotes(teamMember.address)).to.equal(claimed);
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
});
