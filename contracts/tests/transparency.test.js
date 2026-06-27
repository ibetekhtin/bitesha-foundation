const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TransparencyRegistry", () => {
  let registry;
  let admin, publisher, outsider, reportingKey;

  const PERIOD = 202607; // July 2026
  const CID    = "bafybeigdyrreportcidexample0001";

  // Build a report hash + signature the way the off-chain tooling would
  async function makeReport(period, payloadStr) {
    const reportHash = ethers.id(payloadStr); // keccak256 of canonical JSON
    const signature  = await reportingKey.signMessage(ethers.getBytes(reportHash));
    return { reportHash, signature };
  }

  beforeEach(async () => {
    [admin, publisher, outsider, reportingKey] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("TransparencyRegistry");
    registry = await Registry.deploy(admin.address);
    await registry.grantRole(await registry.PUBLISHER_ROLE(), publisher.address);
  });

  describe("Deployment", () => {
    it("admin holds DEFAULT_ADMIN_ROLE", async () => {
      expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    });

    it("reverts on zero admin", async () => {
      const Registry = await ethers.getContractFactory("TransparencyRegistry");
      await expect(Registry.deploy(ethers.ZeroAddress)).to.be.revertedWith("Registry: zero admin");
    });
  });

  describe("anchorReport()", () => {
    it("publisher can anchor a report", async () => {
      const { reportHash, signature } = await makeReport(PERIOD, "report-july");
      await registry.connect(publisher).anchorReport(PERIOD, reportHash, CID, signature);

      const r = await registry.getReport(PERIOD);
      expect(r.period).to.equal(PERIOD);
      expect(r.reportHash).to.equal(reportHash);
      expect(r.ipfsCid).to.equal(CID);
      expect(r.publisher).to.equal(publisher.address);
      expect(r.anchoredAt).to.be.gt(0);
    });

    it("emits ReportAnchored", async () => {
      const { reportHash, signature } = await makeReport(PERIOD, "x");
      await expect(registry.connect(publisher).anchorReport(PERIOD, reportHash, CID, signature))
        .to.emit(registry, "ReportAnchored")
        .withArgs(PERIOD, reportHash, CID, publisher.address);
    });

    it("non-publisher cannot anchor", async () => {
      const { reportHash, signature } = await makeReport(PERIOD, "x");
      await expect(
        registry.connect(outsider).anchorReport(PERIOD, reportHash, CID, signature)
      ).to.be.reverted;
    });

    it("cannot anchor the same period twice (immutability)", async () => {
      const a = await makeReport(PERIOD, "first");
      await registry.connect(publisher).anchorReport(PERIOD, a.reportHash, CID, a.signature);
      const b = await makeReport(PERIOD, "tampered");
      await expect(
        registry.connect(publisher).anchorReport(PERIOD, b.reportHash, CID, b.signature)
      ).to.be.revertedWith("Registry: period already anchored");
    });

    it("rejects zero hash", async () => {
      await expect(
        registry.connect(publisher).anchorReport(PERIOD, ethers.ZeroHash, CID, "0x")
      ).to.be.revertedWith("Registry: zero hash");
    });

    it("rejects empty CID", async () => {
      const { reportHash, signature } = await makeReport(PERIOD, "x");
      await expect(
        registry.connect(publisher).anchorReport(PERIOD, reportHash, "", signature)
      ).to.be.revertedWith("Registry: empty cid");
    });

    it("rejects invalid period (month 13)", async () => {
      const { reportHash, signature } = await makeReport(202613, "x");
      await expect(
        registry.connect(publisher).anchorReport(202613, reportHash, CID, signature)
      ).to.be.revertedWith("Registry: bad period");
    });

    it("rejects invalid period (month 00)", async () => {
      const { reportHash, signature } = await makeReport(202600, "x");
      await expect(
        registry.connect(publisher).anchorReport(202600, reportHash, CID, signature)
      ).to.be.revertedWith("Registry: bad period");
    });
  });

  describe("verify()", () => {
    it("returns true for the anchored hash", async () => {
      const { reportHash, signature } = await makeReport(PERIOD, "july");
      await registry.connect(publisher).anchorReport(PERIOD, reportHash, CID, signature);
      expect(await registry.verify(PERIOD, reportHash)).to.be.true;
    });

    it("returns false for a tampered hash", async () => {
      const { reportHash, signature } = await makeReport(PERIOD, "july");
      await registry.connect(publisher).anchorReport(PERIOD, reportHash, CID, signature);
      expect(await registry.verify(PERIOD, ethers.id("tampered"))).to.be.false;
    });

    it("returns false for an unanchored period", async () => {
      expect(await registry.verify(202612, ethers.id("anything"))).to.be.false;
    });

    it("the anchored signature recovers to the reporting key", async () => {
      const { reportHash, signature } = await makeReport(PERIOD, "signed-report");
      await registry.connect(publisher).anchorReport(PERIOD, reportHash, CID, signature);
      const r = await registry.getReport(PERIOD);
      const recovered = ethers.verifyMessage(ethers.getBytes(reportHash), r.signature);
      expect(recovered).to.equal(reportingKey.address);
    });
  });

  describe("enumeration", () => {
    it("tracks report count and periods", async () => {
      const months = [202605, 202606, 202607];
      for (const m of months) {
        const { reportHash, signature } = await makeReport(m, `report-${m}`);
        await registry.connect(publisher).anchorReport(m, reportHash, CID, signature);
      }
      expect(await registry.reportCount()).to.equal(3);
      expect(await registry.periods(0)).to.equal(202605);
      expect(await registry.periods(2)).to.equal(202607);
    });

    it("getReport reverts for missing period", async () => {
      await expect(registry.getReport(209901)).to.be.revertedWith("Registry: no report");
    });
  });
});
