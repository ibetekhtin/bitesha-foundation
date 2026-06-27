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

  it("revoke returns unvested tokens to owner", async () => {
    await time.increase(CLIFF + DURATION / 4);
    const ownerBefore = await btsh.balanceOf(owner.address);
    await vesting.revoke(beneficiary.address);
    const ownerAfter = await btsh.balanceOf(owner.address);
    expect(ownerAfter).to.be.gt(ownerBefore);
  });

  it("cannot have two schedules for same address", async () => {
    await btsh.approve(await vesting.getAddress(), AMOUNT);
    await expect(
      vesting.createVesting(beneficiary.address, AMOUNT, CLIFF, DURATION, 0)
    ).to.be.revertedWith("Vesting: schedule exists");
  });
});
