const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Libraries", () => {
  let harness;

  beforeEach(async () => {
    const Harness = await ethers.getContractFactory("LibHarness");
    harness = await Harness.deploy();
  });

  // ── Security.verifyKeyedHash ────────────────────────────────────────────

  describe("Security.verifyKeyedHash", () => {
    const secret  = ethers.keccak256(ethers.toUtf8Bytes("super-secret-key"));
    const payload = ethers.toUtf8Bytes("event:push;ref:main");

    it("returns true for a correct keyed digest", async () => {
      const expected = await harness.computeKeyedHash(payload, secret);
      expect(await harness.verifyKeyedHash(payload, expected, secret)).to.be.true;
    });

    it("returns false for a wrong signature", async () => {
      const wrong = ethers.keccak256(ethers.toUtf8Bytes("forged"));
      expect(await harness.verifyKeyedHash(payload, wrong, secret)).to.be.false;
    });

    it("returns false when the secret differs", async () => {
      const expected = await harness.computeKeyedHash(payload, secret);
      const otherSecret = ethers.keccak256(ethers.toUtf8Bytes("other-key"));
      expect(await harness.verifyKeyedHash(payload, expected, otherSecret)).to.be.false;
    });

    it("is not vulnerable to length-extension: appending bytes changes the digest", async () => {
      const d1 = await harness.computeKeyedHash(payload, secret);
      const extended = ethers.concat([payload, ethers.toUtf8Bytes("EXTRA")]);
      const d2 = await harness.computeKeyedHash(extended, secret);
      expect(d1).to.not.equal(d2);
    });
  });

  // ── Security.requireEOA ─────────────────────────────────────────────────

  describe("Security.requireEOA", () => {
    it("passes for an EOA address", async () => {
      const [eoa] = await ethers.getSigners();
      await expect(harness.requireEOA(eoa.address)).to.not.be.reverted;
    });

    it("reverts for a contract address", async () => {
      await expect(harness.requireEOA(await harness.getAddress()))
        .to.be.revertedWith("Security: contracts not allowed");
    });
  });

  // ── Security.safeEqual ──────────────────────────────────────────────────

  describe("Security.safeEqual", () => {
    it("true for equal values", async () => {
      const v = ethers.keccak256(ethers.toUtf8Bytes("x"));
      expect(await harness.safeEqual(v, v)).to.be.true;
    });

    it("false for different values", async () => {
      const a = ethers.keccak256(ethers.toUtf8Bytes("a"));
      const b = ethers.keccak256(ethers.toUtf8Bytes("b"));
      expect(await harness.safeEqual(a, b)).to.be.false;
    });
  });

  // ── BTSHTokenConfig ─────────────────────────────────────────────────────

  describe("BTSHTokenConfig", () => {
    const TOTAL = ethers.parseEther("1000000000");

    it("TOTAL_SUPPLY is 1 billion * 1e18", async () => {
      expect(await harness.totalSupply()).to.equal(TOTAL);
    });

    it("allocationOf(10000 bp) returns full supply", async () => {
      expect(await harness.allocationOf(10000)).to.equal(TOTAL);
    });

    it("allocationOf(3000 bp) returns 30%", async () => {
      expect(await harness.allocationOf(3000)).to.equal(TOTAL * 3000n / 10000n);
    });

    it("allocationOf(0) returns 0", async () => {
      expect(await harness.allocationOf(0)).to.equal(0);
    });

    it("all distribution buckets sum to 100% (10000 bp)", async () => {
      // 3000 + 2000 + 1500 + 1500 + 1000 + 500 + 500 = 10000
      const buckets = [3000, 2000, 1500, 1500, 1000, 500, 500];
      const sum = buckets.reduce((a, b) => a + b, 0);
      expect(sum).to.equal(10000);

      let allocSum = 0n;
      for (const bp of buckets) {
        allocSum += await harness.allocationOf(bp);
      }
      expect(allocSum).to.equal(TOTAL);
    });
  });
});
