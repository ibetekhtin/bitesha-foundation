const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenVesting", () => {
  let btsh, vesting, owner, beneficiary, other;

  const CLIFF    = 365 * 24 * 3600; // 1 year
  const DURATION = 3 * 365 * 24 * 3600; // 3 years
  const AMOUNT   = ethers.parseEther("15000000"); // 15 M BTSH (team allocation)

  beforeEach(async () => {
    [owner, beneficiary, other] = await ethers.getSigners();

    const BTSH = await ethers.getContractFactory("BTSH");
    btsh = await BTSH.deploy(owner.address);
    await btsh.mintInitial(owner.address, ethers.parseEther("1000000000"));

    const Vesting = await ethers.getContractFactory("TokenVesting");
    vesting = await Vesting.deploy(await btsh.getAddress(), owner.address);

    await btsh.approve(await vesting.getAddress(), AMOUNT);
    await vesting.createVesting(beneficiary.address, AMOUNT, CLIFF, DURATION, 0);
  });

  it("creates a vesting schedule", async () => {
    const s = await vesting.schedules(beneficiary.address);
    expect(s.total).to.equal(AMOUNT);
    expect(s.released).to.equal(0n);
  });

  it("cliff: no tokens available before cliff", async () => {
    await time.increase(CLIFF - 1);
    expect(await vesting.claimableAmount(beneficiary.address)).to.equal(0n);
  });

  it("cliff: tokens unlock after cliff", async () => {
    await time.increase(CLIFF + 1);
    const claimable = await vesting.claimableAmount(beneficiary.address);
    expect(claimable).to.be.gt(0n);
  });

  it("full vesting after cliff + duration", async () => {
    await time.increase(CLIFF + DURATION);
    expect(await vesting.vestedAmount(beneficiary.address)).to.equal(AMOUNT);
  });

  it("beneficiary can claim", async () => {
    await time.increase(CLIFF + DURATION / 2);
    const before = await btsh.balanceOf(beneficiary.address);
    await vesting.connect(beneficiary).claim();
    const after = await btsh.balanceOf(beneficiary.address);
    expect(after).to.be.gt(before);
  });

  it("revoke returns unvested tokens to owner and vested-but-unclaimed to beneficiary", async () => {
    await time.increase(CLIFF + DURATION / 4); // 25% vested
    const ownerBefore       = await btsh.balanceOf(owner.address);
    const benefBefore       = await btsh.balanceOf(beneficiary.address);
    await vesting.revoke(beneficiary.address);
    const ownerAfter        = await btsh.balanceOf(owner.address);
    const benefAfter        = await btsh.balanceOf(beneficiary.address);
    // Owner gets back ~75% unvested
    expect(ownerAfter).to.be.gt(ownerBefore);
    // Beneficiary gets their ~25% already-vested-but-unclaimed
    expect(benefAfter).to.be.gt(benefBefore);
    // Together they account for the full amount
    const ownerGain = ownerAfter - ownerBefore;
    const benefGain = benefAfter - benefBefore;
    expect(ownerGain + benefGain).to.be.closeTo(AMOUNT, ethers.parseEther("1"));
  });

  it("beneficiary cannot claim after revoke (nothing left to claim)", async () => {
    await time.increase(CLIFF + DURATION / 4);
    await vesting.revoke(beneficiary.address);
    await expect(vesting.connect(beneficiary).claim()).to.be.revertedWith("Vesting: revoked");
  });

  it("cannot have two schedules for same address", async () => {
    await btsh.approve(await vesting.getAddress(), AMOUNT);
    await expect(
      vesting.createVesting(beneficiary.address, AMOUNT, CLIFF, DURATION, 0)
    ).to.be.revertedWith("Vesting: schedule exists");
  });

  // ── Input validation branches ────────────────────────────────────────────

  describe("createVesting validation", () => {
    it("reverts on zero beneficiary", async () => {
      await btsh.approve(await vesting.getAddress(), AMOUNT);
      await expect(
        vesting.createVesting(ethers.ZeroAddress, AMOUNT, CLIFF, DURATION, 0)
      ).to.be.revertedWith("Vesting: zero beneficiary");
    });

    it("reverts on zero amount", async () => {
      await expect(
        vesting.createVesting(other.address, 0, CLIFF, DURATION, 0)
      ).to.be.revertedWith("Vesting: zero amount");
    });

    it("reverts on zero duration", async () => {
      await btsh.approve(await vesting.getAddress(), AMOUNT);
      await expect(
        vesting.createVesting(other.address, AMOUNT, CLIFF, 0, 0)
      ).to.be.revertedWith("Vesting: zero duration");
    });

    it("only owner can create a schedule", async () => {
      await expect(
        vesting.connect(other).createVesting(other.address, AMOUNT, CLIFF, DURATION, 0)
      ).to.be.reverted;
    });
  });

  // ── startOffset branch ───────────────────────────────────────────────────

  describe("startOffset", () => {
    it("delays vesting start by startOffset", async () => {
      const OFFSET = 30 * 24 * 3600; // 30 days
      const AMT = ethers.parseEther("1000000");
      await btsh.approve(await vesting.getAddress(), AMT);
      await vesting.createVesting(other.address, AMT, CLIFF, DURATION, OFFSET);

      // Even after CLIFF passes from now, vesting hasn't started because of offset
      await time.increase(CLIFF + 1);
      expect(await vesting.claimableAmount(other.address)).to.equal(0n);

      // After offset + cliff, tokens begin unlocking
      await time.increase(OFFSET);
      expect(await vesting.claimableAmount(other.address)).to.be.gt(0n);
    });
  });

  // ── claim branches ───────────────────────────────────────────────────────

  describe("claim validation", () => {
    it("reverts when no schedule exists", async () => {
      await expect(vesting.connect(other).claim())
        .to.be.revertedWith("Vesting: no schedule");
    });

    it("reverts when nothing is claimable yet (before cliff)", async () => {
      await expect(vesting.connect(beneficiary).claim())
        .to.be.revertedWith("Vesting: nothing to claim");
    });
  });

  // ── revoke branches ──────────────────────────────────────────────────────

  describe("revoke validation", () => {
    it("reverts when no schedule exists", async () => {
      await expect(vesting.revoke(other.address))
        .to.be.revertedWith("Vesting: no schedule");
    });

    it("cannot revoke twice", async () => {
      await time.increase(CLIFF + DURATION / 4);
      await vesting.revoke(beneficiary.address);
      await expect(vesting.revoke(beneficiary.address))
        .to.be.revertedWith("Vesting: already revoked");
    });

    it("only owner can revoke", async () => {
      await expect(vesting.connect(other).revoke(beneficiary.address))
        .to.be.reverted;
    });

    it("revoke before cliff returns full amount to owner, nothing to beneficiary", async () => {
      const AMT = ethers.parseEther("1000000");
      await btsh.approve(await vesting.getAddress(), AMT);
      await vesting.createVesting(other.address, AMT, CLIFF, DURATION, 0);

      const benefBefore = await btsh.balanceOf(other.address);
      const ownerBefore = await btsh.balanceOf(owner.address);
      await vesting.revoke(other.address);
      // Nothing vested yet → beneficiary gets 0, owner gets full AMT back
      expect(await btsh.balanceOf(other.address)).to.equal(benefBefore);
      expect(await btsh.balanceOf(owner.address)).to.equal(ownerBefore + AMT);
    });
  });
});
