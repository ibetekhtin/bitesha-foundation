const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const LOCK = 7 * 24 * 3600; // 7 days in seconds

describe("BTSHStaking", () => {
  let btsh, staking;
  let owner, userA, userB, attacker;

  // Reward parameters used across tests
  const RATE        = ethers.parseEther("1");          // 1 BTSH/sec total
  const BUDGET      = ethers.parseEther("86400");      // 86400 BTSH = 1 day at rate 1/sec
  const STAKE_A     = ethers.parseEther("1000");
  const STAKE_B     = ethers.parseEther("3000");

  beforeEach(async () => {
    [owner, userA, userB, attacker] = await ethers.getSigners();

    const BTSH = await ethers.getContractFactory("BTSH");
    btsh = await BTSH.deploy(owner.address);
    await btsh.mintInitial(owner.address, ethers.parseEther("1000000000"));

    const Staking = await ethers.getContractFactory("BTSHStaking");
    staking = await Staking.deploy(await btsh.getAddress(), owner.address);

    // Distribute tokens to users
    await btsh.transfer(userA.address, ethers.parseEther("10000000"));
    await btsh.transfer(userB.address, ethers.parseEther("10000000"));

    // Approve staking contract
    await btsh.connect(userA).approve(await staking.getAddress(), ethers.MaxUint256);
    await btsh.connect(userB).approve(await staking.getAddress(), ethers.MaxUint256);
    await btsh.approve(await staking.getAddress(), ethers.MaxUint256);
  });

  // ── Stake ─────────────────────────────────────────────────────────────────

  describe("stake()", () => {
    it("transfers tokens into contract", async () => {
      await staking.connect(userA).stake(STAKE_A);
      expect(await staking.stakes(userA.address).then(s => s.amount)).to.equal(STAKE_A);
      expect(await btsh.balanceOf(await staking.getAddress())).to.be.gte(STAKE_A);
    });

    it("sets stakedAt on first stake", async () => {
      const tx = await staking.connect(userA).stake(STAKE_A);
      const block = await ethers.provider.getBlock(tx.blockNumber);
      const s = await staking.stakes(userA.address);
      expect(s.stakedAt).to.equal(block.timestamp);
    });

    it("top-up does NOT reset stakedAt (lock fix)", async () => {
      await staking.connect(userA).stake(STAKE_A);
      const s0 = await staking.stakes(userA.address);
      const firstStakedAt = s0.stakedAt;

      await time.increase(3 * 24 * 3600); // 3 days later
      await staking.connect(userA).stake(ethers.parseEther("500")); // top-up

      const s1 = await staking.stakes(userA.address);
      // stakedAt must NOT change — lock started at first deposit
      expect(s1.stakedAt).to.equal(firstStakedAt);
      expect(s1.amount).to.equal(STAKE_A + ethers.parseEther("500"));
    });

    it("totalStaked increases", async () => {
      await staking.connect(userA).stake(STAKE_A);
      await staking.connect(userB).stake(STAKE_B);
      expect(await staking.totalStaked()).to.equal(STAKE_A + STAKE_B);
    });

    it("reverts on zero amount", async () => {
      await expect(staking.connect(userA).stake(0)).to.be.revertedWith("Staking: zero amount");
    });

    it("emits Staked event", async () => {
      await expect(staking.connect(userA).stake(STAKE_A))
        .to.emit(staking, "Staked")
        .withArgs(userA.address, STAKE_A);
    });

    it("reverts in emergency mode", async () => {
      await staking.enableEmergencyMode();
      await expect(staking.connect(userA).stake(STAKE_A))
        .to.be.revertedWith("Staking: emergency mode");
    });
  });

  // ── Unstake ───────────────────────────────────────────────────────────────

  describe("unstake()", () => {
    beforeEach(async () => {
      await staking.connect(userA).stake(STAKE_A);
    });

    it("returns tokens after lock period", async () => {
      await time.increase(LOCK);
      const before = await btsh.balanceOf(userA.address);
      await staking.connect(userA).unstake(STAKE_A);
      const after = await btsh.balanceOf(userA.address);
      expect(after - before).to.equal(STAKE_A);
    });

    it("reverts before lock period expires", async () => {
      await time.increase(LOCK - 100);
      await expect(staking.connect(userA).unstake(STAKE_A))
        .to.be.revertedWith("Staking: lock period active");
    });

    it("partial unstake is allowed after lock", async () => {
      await time.increase(LOCK);
      const partial = ethers.parseEther("400");
      await staking.connect(userA).unstake(partial);
      expect(await staking.stakes(userA.address).then(s => s.amount)).to.equal(STAKE_A - partial);
    });

    it("resets stakedAt to 0 on full unstake", async () => {
      await time.increase(LOCK);
      await staking.connect(userA).unstake(STAKE_A);
      expect(await staking.stakes(userA.address).then(s => s.stakedAt)).to.equal(0);
    });

    it("lock restarts on re-stake after full unstake", async () => {
      await time.increase(LOCK);
      await staking.connect(userA).unstake(STAKE_A);
      // Re-stake — new lock begins
      await staking.connect(userA).stake(STAKE_A);
      // Should be locked again
      await expect(staking.connect(userA).unstake(STAKE_A))
        .to.be.revertedWith("Staking: lock period active");
    });

    it("reverts on amount exceeding balance", async () => {
      await time.increase(LOCK);
      await expect(staking.connect(userA).unstake(STAKE_A + 1n))
        .to.be.revertedWith("Staking: invalid amount");
    });

    it("reverts on zero amount", async () => {
      await time.increase(LOCK);
      await expect(staking.connect(userA).unstake(0))
        .to.be.revertedWith("Staking: invalid amount");
    });

    it("emits Unstaked event", async () => {
      await time.increase(LOCK);
      await expect(staking.connect(userA).unstake(STAKE_A))
        .to.emit(staking, "Unstaked")
        .withArgs(userA.address, STAKE_A);
    });

    it("reverts in emergency mode (use emergencyWithdraw instead)", async () => {
      await time.increase(LOCK);
      await staking.enableEmergencyMode();
      await expect(staking.connect(userA).unstake(STAKE_A))
        .to.be.revertedWith("Staking: use emergencyWithdraw");
    });
  });

  // ── Reward accounting ─────────────────────────────────────────────────────

  describe("Rewards", () => {
    beforeEach(async () => {
      // Set rate then deposit budget
      await staking.setRewardRate(RATE);
      await staking.depositRewards(BUDGET);
    });

    it("setRewardRate sets rewardEndsAt based on budget", async () => {
      // Already set via setRewardRate in beforeEach (which recomputes from remaining budget)
      // After depositRewards: rewardEndsAt ~ now + BUDGET/RATE = now + 86400s
      const endsAt = await staking.rewardEndsAt();
      const now = BigInt(await time.latest());
      const diff = endsAt - now;
      // Allow 5s slack for block time variance
      expect(diff).to.be.closeTo(86400n, 5n);
    });

    it("no rewards before any stake", async () => {
      await time.increase(100);
      await staking.connect(userA).stake(STAKE_A);
      expect(await staking.earned(userA.address)).to.equal(0);
    });

    it("single staker earns proportional rewards", async () => {
      await staking.connect(userA).stake(STAKE_A);
      await time.increase(100); // 100 seconds
      // Expected: rate=1 BTSH/sec, 100 sec, single staker → 100 BTSH
      const earnedA = await staking.earned(userA.address);
      expect(earnedA).to.be.closeTo(ethers.parseEther("100"), ethers.parseEther("1"));
    });

    it("two stakers split rewards proportionally", async () => {
      // userA stakes 1000, userB stakes 3000 → userA gets 25%, userB gets 75%
      await staking.connect(userA).stake(STAKE_A);  // 1000
      await staking.connect(userB).stake(STAKE_B);  // 3000
      await time.increase(100); // 100 seconds → 100 BTSH total
      const earnedA = await staking.earned(userA.address);
      const earnedB = await staking.earned(userB.address);
      // userA: 25 BTSH, userB: 75 BTSH
      expect(earnedA).to.be.closeTo(ethers.parseEther("25"), ethers.parseEther("1"));
      expect(earnedB).to.be.closeTo(ethers.parseEther("75"), ethers.parseEther("1"));
    });

    it("rewards stop accruing after rewardEndsAt (budget exhausted)", async () => {
      await staking.connect(userA).stake(STAKE_A);
      // Advance past entire budget period (86400 seconds)
      await time.increase(86400 + 3600); // budget + 1h extra
      const earned1 = await staking.earned(userA.address);
      await time.increase(3600); // another hour — should NOT increase
      const earned2 = await staking.earned(userA.address);
      expect(earned2).to.equal(earned1);
    });

    it("claimReward transfers tokens to user", async () => {
      await staking.connect(userA).stake(STAKE_A);
      await time.increase(100);
      const before = await btsh.balanceOf(userA.address);
      await staking.connect(userA).claimReward();
      const after = await btsh.balanceOf(userA.address);
      expect(after).to.be.gt(before);
    });

    it("claimReward resets earned to 0", async () => {
      await staking.connect(userA).stake(STAKE_A);
      await time.increase(100);
      await staking.connect(userA).claimReward();
      // Immediately after claim, earned should be near 0 (only a few seconds)
      expect(await staking.earned(userA.address)).to.be.lt(ethers.parseEther("2"));
    });

    it("claimed rewards are not double-counted on a second claim", async () => {
      await staking.connect(userA).stake(STAKE_A);
      await time.increase(100); // accrue ~100 BTSH

      const before = await btsh.balanceOf(userA.address);
      await staking.connect(userA).claimReward(); // first claim pays ~100 BTSH
      const afterFirst = await btsh.balanceOf(userA.address);
      const firstPayout = afterFirst - before;
      expect(firstPayout).to.be.closeTo(ethers.parseEther("100"), ethers.parseEther("2"));

      // Second claim in the very next block only pays ~1 block of accrual (~1-2 BTSH),
      // NOT the already-claimed 100 BTSH again.
      await staking.connect(userA).claimReward();
      const afterSecond = await btsh.balanceOf(userA.address);
      const secondPayout = afterSecond - afterFirst;
      expect(secondPayout).to.be.lt(ethers.parseEther("5"));
    });

    it("reverts on claimReward with no stakes", async () => {
      await expect(staking.connect(attacker).claimReward())
        .to.be.revertedWith("Staking: no rewards");
    });

    it("emits RewardClaimed event", async () => {
      await staking.connect(userA).stake(STAKE_A);
      await time.increase(100);
      await expect(staking.connect(userA).claimReward())
        .to.emit(staking, "RewardClaimed");
    });

    it("depositRewards extends reward period", async () => {
      const endsAtBefore = await staking.rewardEndsAt();
      // Deposit another budget's worth
      await staking.depositRewards(BUDGET);
      const endsAtAfter = await staking.rewardEndsAt();
      expect(endsAtAfter).to.be.gt(endsAtBefore);
    });

    it("setRewardRate recalculates rewardEndsAt from remaining budget", async () => {
      // Stake so rewards start accruing, then advance 10 seconds
      await staking.connect(userA).stake(STAKE_A);
      await time.increase(10);
      // Double the rate
      await staking.setRewardRate(RATE * 2n);
      const endsAt = await staking.rewardEndsAt();
      const now = BigInt(await time.latest());
      // At 2x rate with ~(86400 - ~10) remaining budget: endsAt ≈ now + 43190
      const remaining = endsAt - now;
      expect(remaining).to.be.gt(0n);
      expect(remaining).to.be.lt(86400n); // must be less than original period
    });
  });

  // ── Emergency mode ────────────────────────────────────────────────────────

  describe("Emergency mode", () => {
    beforeEach(async () => {
      await staking.connect(userA).stake(STAKE_A);
    });

    it("only owner can enable emergency mode", async () => {
      await expect(staking.connect(attacker).enableEmergencyMode())
        .to.be.reverted;
    });

    it("emits EmergencyModeEnabled", async () => {
      await expect(staking.enableEmergencyMode())
        .to.emit(staking, "EmergencyModeEnabled");
    });

    it("emergencyWithdraw returns principal without waiting for lock", async () => {
      await staking.enableEmergencyMode();
      const before = await btsh.balanceOf(userA.address);
      await staking.connect(userA).emergencyWithdraw();
      const after = await btsh.balanceOf(userA.address);
      expect(after - before).to.equal(STAKE_A);
    });

    it("emergencyWithdraw clears stake info", async () => {
      await staking.enableEmergencyMode();
      await staking.connect(userA).emergencyWithdraw();
      const s = await staking.stakes(userA.address);
      expect(s.amount).to.equal(0);
      expect(s.stakedAt).to.equal(0);
      expect(s.earned).to.equal(0);
    });

    it("emergencyWithdraw reduces totalStaked", async () => {
      await staking.connect(userB).stake(STAKE_B);
      await staking.enableEmergencyMode();
      await staking.connect(userA).emergencyWithdraw();
      expect(await staking.totalStaked()).to.equal(STAKE_B);
    });

    it("cannot emergencyWithdraw without emergency mode", async () => {
      await expect(staking.connect(userA).emergencyWithdraw())
        .to.be.revertedWith("Staking: not emergency mode");
    });

    it("cannot emergencyWithdraw with no stake", async () => {
      await staking.enableEmergencyMode();
      await expect(staking.connect(attacker).emergencyWithdraw())
        .to.be.revertedWith("Staking: nothing staked");
    });

    it("emits EmergencyWithdrawn event", async () => {
      await staking.enableEmergencyMode();
      await expect(staking.connect(userA).emergencyWithdraw())
        .to.emit(staking, "EmergencyWithdrawn")
        .withArgs(userA.address, STAKE_A);
    });
  });

  // ── Owner controls ────────────────────────────────────────────────────────

  describe("Owner controls", () => {
    it("only owner can setRewardRate", async () => {
      await expect(staking.connect(attacker).setRewardRate(RATE))
        .to.be.reverted;
    });

    it("only owner can depositRewards", async () => {
      await staking.setRewardRate(RATE);
      await btsh.connect(attacker).approve(await staking.getAddress(), BUDGET);
      await expect(staking.connect(attacker).depositRewards(BUDGET))
        .to.be.reverted;
    });

    it("depositRewards emits RewardsDeposited", async () => {
      await staking.setRewardRate(RATE);
      await expect(staking.depositRewards(BUDGET))
        .to.emit(staking, "RewardsDeposited");
    });

    it("setRewardRate emits RewardRateUpdated", async () => {
      await expect(staking.setRewardRate(RATE))
        .to.emit(staking, "RewardRateUpdated");
    });

    it("reverts on zero deposit amount", async () => {
      await staking.setRewardRate(RATE);
      await expect(staking.depositRewards(0))
        .to.be.revertedWith("Staking: zero amount");
    });

    it("cannot set zero rate while budget remains", async () => {
      await staking.setRewardRate(RATE);
      await staking.depositRewards(BUDGET);
      await expect(staking.setRewardRate(0))
        .to.be.revertedWith("Staking: zero rate with budget");
    });

    it("can set zero rate when no budget remains", async () => {
      // No deposit yet — budget is 0, so zero rate is allowed
      await expect(staking.setRewardRate(0)).to.not.be.reverted;
    });

    it("depositRewards before rate is set does not move rewardEndsAt", async () => {
      // rewardRate is 0 at this point
      const endsBefore = await staking.rewardEndsAt();
      await staking.depositRewards(BUDGET);
      expect(await staking.rewardEndsAt()).to.equal(endsBefore);
      expect(await staking.rewardBudgetRemaining()).to.equal(BUDGET);
    });
  });
});
