/**
 * Verify all BITESHA contracts on Etherscan / Basescan after deployment.
 *
 * Usage:
 *   npx hardhat run scripts/verify.js --network base-mainnet
 *
 * Reads addresses from deployments/<network>.json
 */

const { run, ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function verify(address, constructorArgs = []) {
  try {
    await run("verify:verify", { address, constructorArguments: constructorArgs });
    console.log(`✅ Verified: ${address}`);
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log(`⚠️  Already verified: ${address}`);
    } else {
      console.error(`❌ Failed: ${address} — ${e.message}`);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const file = path.join(__dirname, `../deployments/${net.name}.json`);

  if (!fs.existsSync(file)) {
    throw new Error(`No deployment file found for network: ${net.name}`);
  }

  const addr = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`\n🔍 Verifying BITESHA contracts on ${net.name}...\n`);

  await verify(addr.btsh,            [deployer.address]);
  await verify(addr.timelock,        [[], [], deployer.address]);
  await verify(addr.governance,      [addr.btsh, addr.timelock]);
  await verify(addr.treasury,        [addr.btsh, deployer.address]);
  await verify(addr.vesting,         [addr.btsh, deployer.address]);
  await verify(addr.staking,         [addr.btsh, deployer.address]);
  await verify(addr.proposalManager, []);

  console.log("\n✅ Verification complete.\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
