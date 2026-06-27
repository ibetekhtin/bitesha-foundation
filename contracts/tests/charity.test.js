const { expect } = require("chai");
const { ethers } = require("hardhat");

// USDC has 6 decimals
const usdc = (n) => ethers.parseUnits(n.toString(), 6);

describe("CharityVault", () => {
  let token, vault;
  let admin, foodOp, opsOp, donor, supplier, attacker;

  beforeEach(async () => {
    [admin, foodOp, opsOp, donor, supplier, attacker] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    token = await USDC.deploy();

    const Vault = await ethers.getContractFactory("CharityVault");
    vault = await Vault.deploy(await token.getAddress(), admin.address);

    // Grant spender roles (in production these are multisig wallets)
    await vault.grantRole(await vault.FOOD_SPENDER_ROLE(), foodOp.address);
    await vault.grantRole(await vault.OPS_SPENDER_ROLE(), opsOp.address);

    // Fund the donor and approve the vault
    await token.mint(donor.address, usdc(1_000_000));
    await token.connect(donor).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  // ── Policy constants ──────────────────────────────────────────────────────

  describe("Immutable policy", () => {
    it("FOOD_BPS = 8000 and OPS_BPS = 2000", async () => {
      expect(await vault.FOOD_BPS()).to.equal(8000);
      expect(await vault.OPS_BPS()).to.equal(2000);
    });

    it("constants sum to 100% (10000 bps)", async () => {
      const food = await vault.FOOD_BPS();
      const ops  = await vault.OPS_BPS();
      expect(food + ops).to.equal(10000n);
    });

    it("stablecoin address is set immutably", async () => {
      expect(await vault.stablecoin()).to.equal(await token.getAddress());
    });

    it("reverts deploy on zero stablecoin", async () => {
      const Vault = await ethers.getContractFactory("CharityVault");
      await expect(Vault.deploy(ethers.ZeroAddress, admin.address))
        .to.be.revertedWith("Charity: zero stablecoin");
    });

    it("reverts deploy on zero admin", async () => {
      const Vault = await ethers.getContractFactory("CharityVault");
      await expect(Vault.deploy(await token.getAddress(), ethers.ZeroAddress))
        .to.be.revertedWith("Charity: zero admin");
    });
  });

  // ── Deposit split ─────────────────────────────────────────────────────────

  describe("deposit() — 80/20 split", () => {
    it("splits $100 into $80 food / $20 ops", async () => {
      await vault.connect(donor).deposit(usdc(100));
      expect(await vault.foodBalance()).to.equal(usdc(80));
      expect(await vault.opsBalance()).to.equal(usdc(20));
    });

    it("transfers funds into the vault", async () => {
      await vault.connect(donor).deposit(usdc(100));
      expect(await token.balanceOf(await vault.getAddress())).to.equal(usdc(100));
    });

    it("updates cumulative counters", async () => {
      await vault.connect(donor).deposit(usdc(100));
      expect(await vault.totalReceived()).to.equal(usdc(100));
      expect(await vault.totalToFood()).to.equal(usdc(80));
      expect(await vault.totalToOps()).to.equal(usdc(20));
    });

    it("accumulates across multiple deposits", async () => {
      await vault.connect(donor).deposit(usdc(100));
      await vault.connect(donor).deposit(usdc(250));
      expect(await vault.foodBalance()).to.equal(usdc(80 + 200));
      expect(await vault.opsBalance()).to.equal(usdc(20 + 50));
      expect(await vault.totalReceived()).to.equal(usdc(350));
    });

    it("rounding dust favours food (food + ops always == deposit)", async () => {
      // 7 base units: ops = floor(7*2000/10000) = floor(1.4) = 1, food = 7 - 1 = 6
      // Food gets the dust → food share (85.7%) is ABOVE the 80% floor, never below.
      await vault.connect(donor).deposit(7n);
      expect(await vault.foodBalance()).to.equal(6n);
      expect(await vault.opsBalance()).to.equal(1n);
      // Conservation: nothing lost
      expect((await vault.foodBalance()) + (await vault.opsBalance())).to.equal(7n);
    });

    it("effectiveFoodShareBps >= 8000 (dust never hurts charity)", async () => {
      await vault.connect(donor).deposit(7n);
      expect(await vault.effectiveFoodShareBps()).to.be.gte(8000n);
    });

    it("reverts on zero amount", async () => {
      await expect(vault.connect(donor).deposit(0))
        .to.be.revertedWith("Charity: zero amount");
    });

    it("emits Deposited with correct split", async () => {
      await expect(vault.connect(donor).deposit(usdc(100)))
        .to.emit(vault, "Deposited")
        .withArgs(donor.address, usdc(100), usdc(80), usdc(20));
    });
  });

  // ── sync() for direct transfers ───────────────────────────────────────────

  describe("sync() — absorb direct transfers", () => {
    it("splits unaccounted balance 80/20", async () => {
      // Donor sends USDC directly (no deposit)
      await token.connect(donor).transfer(await vault.getAddress(), usdc(100));
      expect(await vault.foodBalance()).to.equal(0);

      await vault.sync();
      expect(await vault.foodBalance()).to.equal(usdc(80));
      expect(await vault.opsBalance()).to.equal(usdc(20));
    });

    it("only syncs the unaccounted portion", async () => {
      await vault.connect(donor).deposit(usdc(100)); // accounted
      await token.connect(donor).transfer(await vault.getAddress(), usdc(50)); // direct
      await vault.sync();
      // 80 + 40 food, 20 + 10 ops
      expect(await vault.foodBalance()).to.equal(usdc(120));
      expect(await vault.opsBalance()).to.equal(usdc(30));
    });

    it("reverts when nothing to sync", async () => {
      await vault.connect(donor).deposit(usdc(100));
      await expect(vault.sync()).to.be.revertedWith("Charity: nothing to sync");
    });

    it("emits Synced", async () => {
      await token.connect(donor).transfer(await vault.getAddress(), usdc(100));
      await expect(vault.sync())
        .to.emit(vault, "Synced")
        .withArgs(usdc(100), usdc(80), usdc(20));
    });
  });

  // ── Food spending ──────────────────────────────────────────────────────────

  describe("spendFood()", () => {
    const RECEIPT = ethers.id("ipfs://receipt-001");

    beforeEach(async () => {
      await vault.connect(donor).deposit(usdc(1000)); // 800 food, 200 ops
    });

    it("food operator can spend from food fund", async () => {
      const before = await token.balanceOf(supplier.address);
      await vault.connect(foodOp).spendFood(supplier.address, usdc(500), "500 meals Bronx", RECEIPT);
      expect(await token.balanceOf(supplier.address)).to.equal(before + usdc(500));
      expect(await vault.foodBalance()).to.equal(usdc(300));
      expect(await vault.totalSpentFood()).to.equal(usdc(500));
    });

    it("cannot spend more than food balance", async () => {
      await expect(
        vault.connect(foodOp).spendFood(supplier.address, usdc(801), "too much", RECEIPT)
      ).to.be.revertedWith("Charity: invalid food amount");
    });

    it("cannot spend food fund from ops role", async () => {
      await expect(
        vault.connect(opsOp).spendFood(supplier.address, usdc(100), "wrong role", RECEIPT)
      ).to.be.reverted;
    });

    it("non-spender cannot spend food", async () => {
      await expect(
        vault.connect(attacker).spendFood(attacker.address, usdc(100), "theft", RECEIPT)
      ).to.be.reverted;
    });

    it("reverts on zero recipient", async () => {
      await expect(
        vault.connect(foodOp).spendFood(ethers.ZeroAddress, usdc(100), "x", RECEIPT)
      ).to.be.revertedWith("Charity: zero recipient");
    });

    it("reverts on zero amount", async () => {
      await expect(
        vault.connect(foodOp).spendFood(supplier.address, 0, "x", RECEIPT)
      ).to.be.revertedWith("Charity: invalid food amount");
    });

    it("emits FoodSpent with purpose and receipt", async () => {
      await expect(
        vault.connect(foodOp).spendFood(supplier.address, usdc(100), "100 meals Harlem", RECEIPT)
      )
        .to.emit(vault, "FoodSpent")
        .withArgs(supplier.address, usdc(100), "100 meals Harlem", RECEIPT);
    });

    it("food spending does NOT touch the ops fund", async () => {
      await vault.connect(foodOp).spendFood(supplier.address, usdc(800), "all food", RECEIPT);
      expect(await vault.opsBalance()).to.equal(usdc(200));
    });
  });

  // ── Ops spending ───────────────────────────────────────────────────────────

  describe("spendOps()", () => {
    const RECEIPT = ethers.id("ipfs://ops-receipt-001");

    beforeEach(async () => {
      await vault.connect(donor).deposit(usdc(1000)); // 800 food, 200 ops
    });

    it("ops operator can spend from ops fund", async () => {
      await vault.connect(opsOp).spendOps(supplier.address, usdc(150), "van rental", RECEIPT);
      expect(await vault.opsBalance()).to.equal(usdc(50));
      expect(await vault.totalSpentOps()).to.equal(usdc(150));
    });

    it("cannot spend more than ops balance", async () => {
      await expect(
        vault.connect(opsOp).spendOps(supplier.address, usdc(201), "too much", RECEIPT)
      ).to.be.revertedWith("Charity: invalid ops amount");
    });

    it("food role cannot spend ops fund", async () => {
      await expect(
        vault.connect(foodOp).spendOps(supplier.address, usdc(100), "wrong role", RECEIPT)
      ).to.be.reverted;
    });

    it("ops spending does NOT touch the food fund", async () => {
      await vault.connect(opsOp).spendOps(supplier.address, usdc(200), "all ops", RECEIPT);
      expect(await vault.foodBalance()).to.equal(usdc(800));
    });

    it("emits OpsSpent", async () => {
      await expect(
        vault.connect(opsOp).spendOps(supplier.address, usdc(50), "printing flyers", RECEIPT)
      )
        .to.emit(vault, "OpsSpent")
        .withArgs(supplier.address, usdc(50), "printing flyers", RECEIPT);
    });
  });

  // ── Transparency ───────────────────────────────────────────────────────────

  describe("Transparency", () => {
    it("stats() returns the full picture", async () => {
      await vault.connect(donor).deposit(usdc(1000));
      await vault.connect(foodOp).spendFood(supplier.address, usdc(300), "meals", ethers.ZeroHash);
      await vault.connect(opsOp).spendOps(supplier.address, usdc(50), "ops", ethers.ZeroHash);

      const s = await vault.stats();
      expect(s.received).to.equal(usdc(1000));
      expect(s.allocatedFood).to.equal(usdc(800));
      expect(s.allocatedOps).to.equal(usdc(200));
      expect(s.spentFood).to.equal(usdc(300));
      expect(s.spentOps).to.equal(usdc(50));
      expect(s.availableFood).to.equal(usdc(500));
      expect(s.availableOps).to.equal(usdc(150));
    });

    it("effectiveFoodShareBps is exactly 8000 for clean amounts", async () => {
      await vault.connect(donor).deposit(usdc(1000));
      expect(await vault.effectiveFoodShareBps()).to.equal(8000n);
    });

    it("effectiveFoodShareBps defaults to 8000 with no deposits", async () => {
      expect(await vault.effectiveFoodShareBps()).to.equal(8000n);
    });

    it("the on-chain invariant holds: foodBalance + opsBalance == vault USDC balance", async () => {
      await vault.connect(donor).deposit(usdc(1234));
      await vault.connect(foodOp).spendFood(supplier.address, usdc(100), "x", ethers.ZeroHash);
      const onChain = await token.balanceOf(await vault.getAddress());
      expect((await vault.foodBalance()) + (await vault.opsBalance())).to.equal(onChain);
    });
  });

  // ── Access control ─────────────────────────────────────────────────────────

  describe("Access control", () => {
    it("admin can grant and revoke spender roles", async () => {
      const ROLE = await vault.FOOD_SPENDER_ROLE();
      await vault.grantRole(ROLE, attacker.address);
      expect(await vault.hasRole(ROLE, attacker.address)).to.be.true;
      await vault.revokeRole(ROLE, attacker.address);
      expect(await vault.hasRole(ROLE, attacker.address)).to.be.false;
    });

    it("non-admin cannot grant roles", async () => {
      const ROLE = await vault.FOOD_SPENDER_ROLE();
      await expect(vault.connect(attacker).grantRole(ROLE, attacker.address))
        .to.be.reverted;
    });
  });
});
