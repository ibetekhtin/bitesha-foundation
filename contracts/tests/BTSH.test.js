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

  describe("ERC20Permit", () => {
    it("nonces start at zero and a valid permit sets allowance", async () => {
      const MAX = await btsh.MAX_SUPPLY();
      await btsh.mintInitial(treasury.address, MAX);

      expect(await btsh.nonces(treasury.address)).to.equal(0n);

      const value    = ethers.parseEther("1000");
      const deadline  = ethers.MaxUint256;
      const net       = await ethers.provider.getNetwork();

      const domain = {
        name: "BITESHA",
        version: "1",
        chainId: net.chainId,
        verifyingContract: await btsh.getAddress(),
      };
      const types = {
        Permit: [
          { name: "owner",    type: "address" },
          { name: "spender",  type: "address" },
          { name: "value",    type: "uint256" },
          { name: "nonce",    type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const message = {
        owner: treasury.address,
        spender: other.address,
        value,
        nonce: 0n,
        deadline,
      };

      const sig = await treasury.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);

      await btsh.permit(treasury.address, other.address, value, deadline, v, r, s);

      expect(await btsh.allowance(treasury.address, other.address)).to.equal(value);
      expect(await btsh.nonces(treasury.address)).to.equal(1n);
    });
  });

  describe("ERC20Votes", () => {
    it("delegation activates voting power equal to balance", async () => {
      const MAX = await btsh.MAX_SUPPLY();
      await btsh.mintInitial(treasury.address, MAX);

      expect(await btsh.getVotes(treasury.address)).to.equal(0n); // no votes until delegation
      await btsh.connect(treasury).delegate(treasury.address);
      expect(await btsh.getVotes(treasury.address)).to.equal(MAX);
    });
  });
});
