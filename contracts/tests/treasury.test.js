const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BITESHATreasury", () => {
  let btsh, treasury;
  let owner, governor, timelockSim, recipient, attacker;

  const LARGE = ethers.parseEther("1000000"); // 1 M — threshold
  const SMALL = ethers.parseEther("999999");  // just under threshold

  beforeEach(async () => {
    [owner, governor, timelockSim, recipient, attacker] = await ethers.getSigners();

    const BTSH = await ethers.getContractFactory("BTSH");
    btsh = await BTSH.deploy(owner.address);

    const Treasury = await ethers.getContractFactory("BITESHATreasury");
    treasury = await Treasury.deploy(await btsh.getAddress(), owner.address);

    // Mint full supply to treasury
    await btsh.mintInitial(await treasury.getAddress(), ethers.parseEther("1000000000"));

    // Set up roles: governor gets GOVERNOR_ROLE, timelockSim gets TIMELOCK_ROLE
    const GOVERNOR_ROLE = await treasury.GOVERNOR_ROLE();
    const TIMELOCK_ROLE = await treasury.TIMELOCK_ROLE();
    await treasury.grantRole(GOVERNOR_ROLE, governor.address);
    await treasury.grantRole(TIMELOCK_ROLE, timelockSim.address);
  });

  // ── Role model ────────────────────────────────────────────────────────────

  describe("Role model", () => {
    it("deployer holds DEFAULT_ADMIN_ROLE initially", async () => {
      const ADMIN = await treasury.DEFAULT_ADMIN_ROLE();
      expect(await treasury.hasRole(ADMIN, owner.address)).to.be.true;
    });

    it("deployer holds GOVERNOR_ROLE initially", async () => {
      const GOVERNOR_ROLE = await treasury.GOVERNOR_ROLE();
      expect(await treasury.hasRole(GOVERNOR_ROLE, owner.address)).to.be.true;
    });

    it("transferAdmin grants admin to new address", async () => {
      const ADMIN = await treasury.DEFAULT_ADMIN_ROLE();
      await treasury.transferAdmin(timelockSim.address);
      expect(await treasury.hasRole(ADMIN, timelockSim.address)).to.be.true;
    });

    it("transferAdmin does NOT revoke caller's admin — caller must renounce separately", async () => {
      const ADMIN = await treasury.DEFAULT_ADMIN_ROLE();
      await treasury.transferAdmin(timelockSim.address);
      // Owner still has it until renounce
      expect(await treasury.hasRole(ADMIN, owner.address)).to.be.true;
      // Owner renounces
      await treasury.renounceRole(ADMIN, owner.address);
      expect(await treasury.hasRole(ADMIN, owner.address)).to.be.false;
    });

    it("non-admin cannot call transferAdmin", async () => {
      await expect(treasury.connect(attacker).transferAdmin(attacker.address))
        .to.be.reverted;
    });

    it("transferAdmin reverts on zero address", async () => {
      await expect(treasury.transferAdmin(ethers.ZeroAddress))
        .to.be.revertedWith("Treasury: zero admin");
    });
  });

  // ── BTSH allocation — small amounts (GOVERNOR_ROLE) ──────────────────────

  describe("allocateBTSH — small amounts", () => {
    it("GOVERNOR can allocate under threshold", async () => {
      const before = await btsh.balanceOf(recipient.address);
      await treasury.connect(governor).allocateBTSH(recipient.address, SMALL, "grant");
      expect(await btsh.balanceOf(recipient.address)).to.equal(before + SMALL);
    });

    it("GOVERNOR cannot allocate AT threshold (needs TIMELOCK_ROLE)", async () => {
      await expect(
        treasury.connect(governor).allocateBTSH(recipient.address, LARGE, "grant")
      ).to.be.revertedWith("Treasury: requires timelock");
    });

    it("GOVERNOR cannot allocate ABOVE threshold", async () => {
      await expect(
        treasury.connect(governor).allocateBTSH(recipient.address, LARGE + 1n, "grant")
      ).to.be.revertedWith("Treasury: requires timelock");
    });

    it("non-GOVERNOR cannot allocate small amounts", async () => {
      await expect(
        treasury.connect(attacker).allocateBTSH(recipient.address, SMALL, "attack")
      ).to.be.revertedWith("Treasury: not governor");
    });

    it("reverts on zero address recipient", async () => {
      await expect(
        treasury.connect(governor).allocateBTSH(ethers.ZeroAddress, SMALL, "x")
      ).to.be.revertedWith("Treasury: zero address");
    });

    it("reverts on zero amount", async () => {
      await expect(
        treasury.connect(governor).allocateBTSH(recipient.address, 0, "x")
      ).to.be.revertedWith("Treasury: zero amount");
    });

    it("emits BTSHAllocated event", async () => {
      await expect(
        treasury.connect(governor).allocateBTSH(recipient.address, SMALL, "test reason")
      )
        .to.emit(treasury, "BTSHAllocated")
        .withArgs(recipient.address, SMALL, "test reason");
    });
  });

  // ── BTSH allocation — large amounts (TIMELOCK_ROLE) ──────────────────────

  describe("allocateBTSH — large amounts", () => {
    it("TIMELOCK_ROLE can allocate at threshold", async () => {
      const before = await btsh.balanceOf(recipient.address);
      await treasury.connect(timelockSim).allocateBTSH(recipient.address, LARGE, "big grant");
      expect(await btsh.balanceOf(recipient.address)).to.equal(before + LARGE);
    });

    it("TIMELOCK_ROLE can allocate above threshold", async () => {
      const amount = LARGE + ethers.parseEther("500000");
      const before = await btsh.balanceOf(recipient.address);
      await treasury.connect(timelockSim).allocateBTSH(recipient.address, amount, "large");
      expect(await btsh.balanceOf(recipient.address)).to.equal(before + amount);
    });

    it("GOVERNOR without TIMELOCK_ROLE is blocked on large amounts", async () => {
      await expect(
        treasury.connect(governor).allocateBTSH(recipient.address, LARGE, "bypass")
      ).to.be.revertedWith("Treasury: requires timelock");
    });
  });

  // ── ETH allocation ────────────────────────────────────────────────────────

  describe("allocateETH", () => {
    beforeEach(async () => {
      // Fund treasury with 1 ETH
      await owner.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("1") });
    });

    it("TIMELOCK_ROLE can allocate ETH", async () => {
      const amount = ethers.parseEther("0.5");
      const before = await ethers.provider.getBalance(recipient.address);
      await treasury.connect(timelockSim).allocateETH(recipient.address, amount, "eth grant");
      const after = await ethers.provider.getBalance(recipient.address);
      expect(after - before).to.equal(amount);
    });

    it("GOVERNOR cannot allocate ETH (even small amounts) — always requires TIMELOCK_ROLE", async () => {
      await expect(
        treasury.connect(governor).allocateETH(recipient.address, 1n, "attempt")
      ).to.be.reverted;
    });

    it("random address cannot allocate ETH", async () => {
      await expect(
        treasury.connect(attacker).allocateETH(recipient.address, 1n, "hack")
      ).to.be.reverted;
    });

    it("reverts if ETH balance insufficient", async () => {
      await expect(
        treasury.connect(timelockSim).allocateETH(
          recipient.address, ethers.parseEther("2"), "too much"
        )
      ).to.be.revertedWith("Treasury: insufficient ETH");
    });

    it("reverts on zero address ETH recipient", async () => {
      await expect(
        treasury.connect(timelockSim).allocateETH(ethers.ZeroAddress, 1n, "x")
      ).to.be.revertedWith("Treasury: zero address");
    });

    it("emits ETHAllocated event", async () => {
      const amount = ethers.parseEther("0.1");
      await expect(
        treasury.connect(timelockSim).allocateETH(recipient.address, amount, "event test")
      )
        .to.emit(treasury, "ETHAllocated")
        .withArgs(recipient.address, amount, "event test");
    });

    it("receive() accepts ETH and emits Received", async () => {
      await expect(
        owner.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("0.1") })
      ).to.emit(treasury, "Received");
    });
  });

  // ── Balance view ──────────────────────────────────────────────────────────

  describe("btshBalance()", () => {
    it("returns current BTSH balance of treasury", async () => {
      const bal = await treasury.btshBalance();
      expect(bal).to.equal(ethers.parseEther("1000000000"));
    });

    it("decreases after allocation", async () => {
      const before = await treasury.btshBalance();
      await treasury.connect(governor).allocateBTSH(recipient.address, SMALL, "r");
      expect(await treasury.btshBalance()).to.equal(before - SMALL);
    });
  });
});
