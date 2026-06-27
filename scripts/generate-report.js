/**
 * generate-report.js
 *
 * Builds a monthly BITESHA charity transparency report from on-chain CharityVault
 * events, signs it with the foundation reporting key, and prints the canonical hash
 * ready to be anchored on-chain via TransparencyRegistry.anchorReport().
 *
 * Usage:
 *   VAULT=0x... PERIOD=202607 REPORTING_KEY=0x<privkey> \
 *     npx hardhat run scripts/generate-report.js --network base
 *
 * Output:
 *   - reports/report-<PERIOD>.json  (canonical report bundle)
 *   - reports/report-<PERIOD>.sig   (signature over the report hash)
 *   - prints reportHash + the exact anchorReport() call to make
 *
 * The report is "canonical": keys are sorted and there is no whitespace, so the
 * keccak256 hash is reproducible by anyone who has the same JSON.
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deterministic JSON: sort keys recursively, no extra whitespace.
function canonical(obj) {
  if (Array.isArray(obj)) return "[" + obj.map(canonical).join(",") + "]";
  if (obj && typeof obj === "object") {
    return "{" + Object.keys(obj).sort().map(
      (k) => JSON.stringify(k) + ":" + canonical(obj[k])
    ).join(",") + "}";
  }
  return JSON.stringify(obj);
}

// Period window helpers (YYYYMM -> [startTs, endTs)) in UTC.
function periodWindow(period) {
  const year = Math.floor(period / 100);
  const month = period % 100; // 1..12
  const start = Date.UTC(year, month - 1, 1) / 1000;
  const end = Date.UTC(year, month, 1) / 1000;
  return { start, end };
}

async function main() {
  const vaultAddr = process.env.VAULT;
  const period = parseInt(process.env.PERIOD, 10);
  const keyHex = process.env.REPORTING_KEY;

  if (!vaultAddr || !period || !keyHex) {
    throw new Error("Set VAULT, PERIOD (YYYYMM), and REPORTING_KEY env vars");
  }

  const vault = await ethers.getContractAt("CharityVault", vaultAddr);
  const provider = ethers.provider;
  const { start, end } = periodWindow(period);

  // Collect FoodSpent / OpsSpent / Deposited events for the period.
  const foodFilter = vault.filters.FoodSpent();
  const opsFilter = vault.filters.OpsSpent();
  const depositFilter = vault.filters.Deposited();

  const [foodLogs, opsLogs, depositLogs] = await Promise.all([
    vault.queryFilter(foodFilter),
    vault.queryFilter(opsFilter),
    vault.queryFilter(depositFilter),
  ]);

  async function inWindow(log) {
    const block = await provider.getBlock(log.blockNumber);
    return block.timestamp >= start && block.timestamp < end;
  }

  const foodSpends = [];
  for (const log of foodLogs) {
    if (!(await inWindow(log))) continue;
    foodSpends.push({
      to: log.args.to,
      amount: log.args.amount.toString(),
      mealsFunded: log.args.mealsFunded.toString(),
      purpose: log.args.purpose,
      receiptHash: log.args.receiptHash,
      tx: log.transactionHash,
    });
  }

  const opsSpends = [];
  for (const log of opsLogs) {
    if (!(await inWindow(log))) continue;
    opsSpends.push({
      to: log.args.to,
      amount: log.args.amount.toString(),
      purpose: log.args.purpose,
      receiptHash: log.args.receiptHash,
      tx: log.transactionHash,
    });
  }

  let depositedInPeriod = 0n;
  for (const log of depositLogs) {
    if (!(await inWindow(log))) continue;
    depositedInPeriod += log.args.amount;
  }

  // Cumulative on-chain snapshot at report time.
  const stats = await vault.stats();
  const totalMealsFunded = await vault.totalMealsFunded();

  const report = {
    project: "BITESHA Foundation",
    mission: "Feed people on the streets of New York",
    period,
    vault: vaultAddr,
    policy: { foodBps: 8000, opsBps: 2000, currency: "USDC" },
    periodActivity: {
      deposited: depositedInPeriod.toString(),
      foodSpends,
      opsSpends,
      mealsFundedInReports: foodSpends.reduce((a, s) => a + BigInt(s.mealsFunded), 0n).toString(),
    },
    cumulative: {
      totalReceived: stats.received.toString(),
      totalToFood: stats.allocatedFood.toString(),
      totalToOps: stats.allocatedOps.toString(),
      totalSpentFood: stats.spentFood.toString(),
      totalSpentOps: stats.spentOps.toString(),
      availableFood: stats.availableFood.toString(),
      availableOps: stats.availableOps.toString(),
      totalMealsFunded: totalMealsFunded.toString(),
    },
  };

  const canonicalJson = canonical(report);
  const reportHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

  // Sign the hash with the reporting key (eth personal-sign).
  const wallet = new ethers.Wallet(keyHex);
  const signature = await wallet.signMessage(ethers.getBytes(reportHash));

  // Persist artifacts.
  const dir = path.join(__dirname, "..", "reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `report-${period}.json`), canonicalJson);
  fs.writeFileSync(path.join(dir, `report-${period}.sig`), signature);

  console.log("─".repeat(60));
  console.log(`BITESHA report — period ${period}`);
  console.log("─".repeat(60));
  console.log(`reportHash : ${reportHash}`);
  console.log(`signer     : ${wallet.address}`);
  console.log(`signature  : ${signature}`);
  console.log(`food spends: ${foodSpends.length}, ops spends: ${opsSpends.length}`);
  console.log(`meals (cumulative): ${totalMealsFunded.toString()}`);
  console.log("");
  console.log("Next: pin report-<period>.json to IPFS, then anchor on-chain:");
  console.log(`  registry.anchorReport(${period}, "${reportHash}", "<ipfsCid>", "${signature}")`);
  console.log("─".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
