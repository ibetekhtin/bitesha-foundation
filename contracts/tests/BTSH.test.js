const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BTSH Token", () => {
  let btsh, owner, treasury, other;

  beforeEach(async () => {
    [owner, treasury, other] = await ethers.getSigners();
    const BTSH = await ethers.getContractFactory("BTSH");
    btsh = await BTSH.deploy(owner.address);
    await btsh.waitForDeployment();
  });

  it("has correct name, symbol, and decimals", async () => {
    expect(await btsh.name()).to.equal("BITESHA");
    expect(await btsh.symbol()).to.equal("BTSH");
    expect(await btsh.decimals()).to.equal(18);
  });

  it("total supply is zero before mint", async () => {
    expect(await btsh.totalSupply()).to.equal(0n);
  });

  it("mints initial supply to treasury", async () => {
    const MAX = await btsh.MAX_SUPPLY();
    await btsh.mintInitial(treasury.address, MAX);
    expect(await btsh.balanceOf(treasury.address)).to.equal(MAX);
    expect(await btsh.totalSupply()).to.equal(MAX);
  });

  it("cannot mint twice", async () => {
    const MAX = await btsh.MAX_SUPPLY();
    await btsh.mintInitial(treasury.address, MAX);
    await expect(btsh.mintInitial(treasury.address, 1n))
      .to.be.revertedWith("BTSH: already minted");
  });

  it("cannot mint above MAX_SUPPLY", async () => {
    const MAX = await btsh.MAX_SUPPLY();
    await expect(btsh.mintInitial(treasury.address, MAX + 1n))
      .to.be.revertedWith("BTSH: exceeds max supply");
  });

  it("only owner can mint", async () => {
    await expect(btsh.connect(other).mintInitial(other.address, 1000n))
      .to.be.reverted;
  });

  it("owner can pause and unpause transfers", async () => {
    const MAX = await btsh.MAX_SUPPLY();
    await btsh.mintInitial(treasury.address, MAX);

    await btsh.pause();
    await expect(btsh.connect(treasury).transfer(other.address, 100n))
      .to.be.reverted;

    await btsh.unpause();
    await btsh.connect(treasury).transfer(other.address, 100n);
    expect(await btsh.balanceOf(other.address)).to.equal(100n);
  });
});
