const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Randomized invariant ("fuzz") tests.
 *
 * Each test drives a contract through hundreds of randomized operation sequences
 * and asserts the critical invariants after EVERY operation. A deterministic LCG
 * makes failures reproducible (change SEED to explore more of the space).
 */

// Deterministic pseudo-random generator (reproducible runs).
function makeRng(seed) {
  let s = seed >>> 0;
  return {
    next() { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; },
    int(maxExclusive) { return Math.floor(this.next() * maxExclusive); },
  };
}

const usdc = (n) => ethers.parseUnits(n.toString(), 6);

describe("Invariants (randomized)", () => {
  // ── CharityVault: the money-handling contract ────────────────────────────
  describe("CharityVault", () => {
    const ROUNDS = 300;

    async function setup() {
      const [admin, foodOp, opsOp, donor, supplier] = await ethers.getSigners();
      const USDC = await ethers.getContractFactory("MockUSDC");
      const token = await USDC.deploy();
      const Vault = await ethers.getContractFactory("CharityVault");
      const vault = await Vault.deploy(await token.getAddress(), admin.address);
      await vault.grantRole(await vault.FOOD_SPENDER_ROLE(), foodOp.address);
      await vault.grantRole(await vault.OPS_SPENDER_ROLE(), opsOp.address);
      await token.mint(donor.address, usdc(10_000_000_000));
      await token.connect(donor).approve(await vault.getAddress(), ethers.MaxUint256);
      return { token, vault, foodOp, opsOp, donor, supplier };
    }

    // Assert every CharityVault invariant against current on-chain state.
    async function checkInvariants(vault, token) {
      const s = await vault.stats();
      const vaultBal = await token.balanceOf(await vault.getAddress());

      // 1. Conservation of allocation: food + ops == received.
      expect(s.allocatedFood + s.allocatedOps).to.equal(s.received, "alloc conservation");

      // 2. Food always receives >= 80% of everything received (dust favours food).
      //    allocatedFood * 10000 >= received * 8000
      expect(s.allocatedFood * 10000n).to.be.gte(s.received * 8000n, "food >= 80%");

      // 3. Spent never exceeds allocated, per fund.
      expect(s.spentFood).to.be.lte(s.allocatedFood, "food spent <= allocated");
      expect(s.spentOps).to.be.lte(s.allocatedOps, "ops spent <= allocated");

      // 4. Available == allocated - spent, per fund (and non-negative by type).
      expect(s.availableFood).to.equal(s.allocatedFood - s.spentFood, "food available");
      expect(s.availableOps).to.equal(s.allocatedOps - s.spentOps, "ops available");

      // 5. Solvency: live fund balances exactly back the vault's token balance.
      expect(s.availableFood + s.availableOps).to.equal(vaultBal, "solvency");
    }

    it("holds all invariants across randomized deposit/sync/spend sequences", async () => {
      const { token, vault, foodOp, opsOp, donor, supplier } = await setup();
      const rng = makeRng(0xBEEF);

      await checkInvariants(vault, token);

      for (let i = 0; i < ROUNDS; i++) {
        const op = rng.int(4);
        try {
          if (op === 0) {
            // deposit a random amount (1 .. 1,000,000 base units — includes dust sizes)
            const amt = BigInt(1 + rng.int(1_000_000));
            await vault.connect(donor).deposit(amt);
          } else if (op === 1) {
            // direct transfer + sync (raw donation path)
            const amt = BigInt(1 + rng.int(500_000));
            await token.connect(donor).transfer(await vault.getAddress(), amt);
            await vault.sync();
          } else if (op === 2) {
            // spend food up to available
            const avail = (await vault.stats()).availableFood;
            if (avail > 0n) {
              const amt = 1n + BigInt(rng.int(Number(avail > 100000n ? 100000n : avail)));
              const meals = BigInt(rng.int(500));
              await vault.connect(foodOp).spendFood(supplier.address, amt, meals, "fuzz", ethers.ZeroHash);
            }
          } else {
            // spend ops up to available
            const avail = (await vault.stats()).availableOps;
            if (avail > 0n) {
              const amt = 1n + BigInt(rng.int(Number(avail > 100000n ? 100000n : avail)));
              await vault.connect(opsOp).spendOps(supplier.address, amt, "fuzz", ethers.ZeroHash);
            }
          }
        } catch (e) {
          // Reverts are acceptable (e.g. nothing to sync); invariants must still hold.
        }
        await checkInvariants(vault, token);
      }

      // Final sanity: meaningful activity actually happened.
      expect((await vault.stats()).received).to.be.gt(0n);
    });

    it("food share stays >= 80% even with adversarial tiny deposits", async () => {
      const { token, vault, donor } = await setup();
      const rng = makeRng(0x1357);
      // Hammer with the smallest amounts where rounding is most dangerous.
      for (let i = 0; i < 200; i++) {
        const amt = BigInt(1 + rng.int(9)); // 1..9 base units
        await vault.connect(donor).deposit(amt);
        const s = await vault.stats();
        expect(s.allocatedFood * 10000n).to.be.gte(s.received * 8000n);
        expect(await vault.effectiveFoodShareBps()).to.be.gte(8000n);
      }
    });
  });

  // ── TokenVesting: conservation of vested funds ───────────────────────────
  describe("TokenVesting", () => {
    it("released never exceeds vested, and vested never exceeds total", async () => {
      const [owner, b1, b2, b3] = await ethers.getSigners();
      const BTSH = await ethers.getContractFactory("BTSH");
      const btsh = await BTSH.deploy(owner.address);
      await btsh.mintInitial(owner.address, ethers.parseEther("1000000000"));
      const Vesting = await ethers.getContractFactory("TokenVesting");
      const vesting = await Vesting.deploy(await btsh.getAddress(), owner.address);

      const CLIFF = 30 * 24 * 3600;
      const DURATION = 365 * 24 * 3600;
      const beneficiaries = [b1, b2, b3];
      const totals = {};

      // Fund and create schedules with varied parameters.
      const rng = makeRng(0x2468);
      for (const b of beneficiaries) {
        const total = ethers.parseEther((1_000_000 + rng.int(5_000_000)).toString());
        totals[b.address] = total;
        await btsh.approve(await vesting.getAddress(), total);
        await vesting.createVesting(b.address, total, CLIFF, DURATION, rng.int(CLIFF));
      }

      // Walk time forward in random steps; after each step claim randomly and
      // assert vesting invariants for every beneficiary.
      for (let step = 0; step < 60; step++) {
        await time.increase(1 + rng.int(DURATION / 20));

        for (const b of beneficiaries) {
          const s = await vesting.schedules(b.address);
          const vested = await vesting.vestedAmount(b.address);

          // INV-1: vested never exceeds total grant.
          expect(vested).to.be.lte(s.total, "vested <= total");
          // INV-2: already-released never exceeds what has vested.
          expect(s.released).to.be.lte(vested, "released <= vested");
          // INV-3: claimable == vested - released, never negative by type.
          const claimable = await vesting.claimableAmount(b.address);
          expect(claimable).to.equal(vested - s.released, "claimable identity");

          // Randomly claim.
          if (rng.int(2) === 0 && claimable > 0n) {
            await vesting.connect(b).claim();
            const after = await vesting.schedules(b.address);
            expect(after.released).to.be.lte(after.total, "released <= total after claim");
          }
        }
      }

      // After full duration, everyone can reach exactly their total — never more.
      await time.increase(DURATION + CLIFF);
      for (const b of beneficiaries) {
        const claimable = await vesting.claimableAmount(b.address);
        if (claimable > 0n) await vesting.connect(b).claim();
        const s = await vesting.schedules(b.address);
        expect(s.released).to.equal(totals[b.address], "fully vested == total, no more");
      }
    });
  });
});
