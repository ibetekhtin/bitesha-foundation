/**
 * verify-report.js
 *
 * Independently verifies a downloaded BITESHA monthly report:
 *   1. Recomputes the canonical keccak256 hash of the report JSON.
 *   2. Recovers the signer from the signature and checks it matches the
 *      expected reporting key.
 *   3. (Optional) Checks the hash against the on-chain TransparencyRegistry anchor.
 *
 * Anyone can run this with only the public report file — no secrets required.
 *
 * Usage:
 *   REPORT=reports/report-202607.json SIG=reports/report-202607.sig \
 *   EXPECTED_SIGNER=0x... [REGISTRY=0x... PERIOD=202607] \
 *     npx hardhat run scripts/verify-report.js --network base
 */
const { ethers } = require("hardhat");
const fs = require("fs");

function canonical(obj) {
  if (Array.isArray(obj)) return "[" + obj.map(canonical).join(",") + "]";
  if (obj && typeof obj === "object") {
    return "{" + Object.keys(obj).sort().map(
      (k) => JSON.stringify(k) + ":" + canonical(obj[k])
    ).join(",") + "}";
  }
  return JSON.stringify(obj);
}

async function main() {
  const reportPath = process.env.REPORT;
  const sigPath = process.env.SIG;
  const expectedSigner = process.env.EXPECTED_SIGNER;

  if (!reportPath || !sigPath) throw new Error("Set REPORT and SIG env vars");

  const raw = fs.readFileSync(reportPath, "utf8");
  // Re-canonicalize (in case the file was pretty-printed after publishing).
  const parsed = JSON.parse(raw);
  const canonicalJson = canonical(parsed);
  const reportHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

  const signature = fs.readFileSync(sigPath, "utf8").trim();
  const recovered = ethers.verifyMessage(ethers.getBytes(reportHash), signature);

  console.log("─".repeat(60));
  console.log(`Report     : ${reportPath}`);
  console.log(`reportHash : ${reportHash}`);
  console.log(`recovered  : ${recovered}`);

  let ok = true;

  if (expectedSigner) {
    const match = recovered.toLowerCase() === expectedSigner.toLowerCase();
    console.log(`signer match: ${match ? "✅ YES" : "❌ NO"} (expected ${expectedSigner})`);
    ok = ok && match;
  }

  if (process.env.REGISTRY && process.env.PERIOD) {
    const registry = await ethers.getContractAt("TransparencyRegistry", process.env.REGISTRY);
    const onChain = await registry.verify(parseInt(process.env.PERIOD, 10), reportHash);
    console.log(`on-chain anchor: ${onChain ? "✅ MATCHES" : "❌ MISMATCH / not anchored"}`);
    ok = ok && onChain;
  }

  console.log("─".repeat(60));
  console.log(ok ? "✅ REPORT VERIFIED" : "❌ VERIFICATION FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
