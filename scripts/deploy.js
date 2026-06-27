/**
 * BITESHA full deployment script.
 *
 * Deployment order:
 *   1. BTSH token
 *   2. BITESHATimelock
 *   3. BITESHAGovernance
 *   4. BITESHATreasury
 *   5. TokenVesting
 *   6. CharityVault + TransparencyRegistry (if USDC_ADDRESS set)
 *   7. ProposalManager
 *   8. Genesis mint → treasury
 *   9. Vesting schedules
 *  10. Grant roles
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network base-sepolia
 *   npx hardhat run scripts/deploy.js --network base-mainnet
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`\n🚀 BITESHA Deployment`);
  console.log(`   Network:  ${network.name} (chainId ${network.chainId})`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ── 1. BTSH Token ─────────────────────────────────────────────────────────
  const BTSH = await ethers.getContractFactory("BTSH");
  const btsh = await BTSH.deploy(deployer.address);
  await btsh.waitForDeployment();
  console.log(`✅ BTSH deployed:          ${await btsh.getAddress()}`);

  // ── 2. Timelock ───────────────────────────────────────────────────────────
  const Timelock = await ethers.getContractFactory("BITESHATimelock");
  const timelock = await Timelock.deploy([], [], deployer.address);
  await timelock.waitForDeployment();
  console.log(`✅ Timelock deployed:       ${await timelock.getAddress()}`);

  // ── 3. Governance ─────────────────────────────────────────────────────────
  const Gov = await ethers.getContractFactory("BITESHAGovernance");
  const gov = await Gov.deploy(await btsh.getAddress(), await timelock.getAddress());
  await gov.waitForDeployment();
  console.log(`✅ Governance deployed:     ${await gov.getAddress()}`);

  // ── 4. Treasury ───────────────────────────────────────────────────────────
  const Treasury = await ethers.getContractFactory("BITESHATreasury");
  const treasury = await Treasury.deploy(await btsh.getAddress(), deployer.address);
  await treasury.waitForDeployment();
  console.log(`✅ Treasury deployed:       ${await treasury.getAddress()}`);

  // ── 5. Vesting ────────────────────────────────────────────────────────────
  const Vesting = await ethers.getContractFactory("TokenVesting");
  const vesting = await Vesting.deploy(await btsh.getAddress(), deployer.address);
  await vesting.waitForDeployment();
  console.log(`✅ TokenVesting deployed:   ${await vesting.getAddress()}`);

  // ── 6. Charity: CharityVault + TransparencyRegistry ───────────────────────
  // CharityVault enforces the immutable 80/20 food/ops split in a stablecoin.
  // Set USDC_ADDRESS to the network's USDC; required for a real deployment.
  const usdcAddress = process.env.USDC_ADDRESS;
  let vault, registry;
  if (usdcAddress) {
    const Vault = await ethers.getContractFactory("CharityVault");
    vault = await Vault.deploy(usdcAddress, deployer.address);
    await vault.waitForDeployment();
    console.log(`✅ CharityVault deployed:   ${await vault.getAddress()}`);

    const Registry = await ethers.getContractFactory("TransparencyRegistry");
    registry = await Registry.deploy(deployer.address);
    await registry.waitForDeployment();
    console.log(`✅ TransparencyRegistry deployed: ${await registry.getAddress()}`);
  } else {
    console.log(`⚠️  USDC_ADDRESS not set — skipping CharityVault/TransparencyRegistry.`);
    console.log(`    Set USDC_ADDRESS and redeploy to enable the charity flow.`);
  }

  // ── 7. ProposalManager ────────────────────────────────────────────────────
  const PM = await ethers.getContractFactory("ProposalManager");
  const proposalManager = await PM.deploy();
  await proposalManager.waitForDeployment();
  console.log(`✅ ProposalManager deployed: ${await proposalManager.getAddress()}`);

  // ── 8. Genesis mint → treasury ────────────────────────────────────────────
  const MAX_SUPPLY = await btsh.MAX_SUPPLY();
  await btsh.mintInitial(await treasury.getAddress(), MAX_SUPPLY);
  console.log(`✅ Genesis mint: ${ethers.formatEther(MAX_SUPPLY)} BTSH → treasury`);

  // ── 9. Wire up timelock roles ─────────────────────────────────────────────
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const ADMIN_ROLE    = await timelock.DEFAULT_ADMIN_ROLE();

  await timelock.grantRole(PROPOSER_ROLE, await gov.getAddress());
  await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress);
  await timelock.grantRole(ADMIN_ROLE, await gov.getAddress());
  await timelock.revokeRole(ADMIN_ROLE, deployer.address);
  console.log(`✅ Timelock roles configured`);

  // ── 10. Treasury: grant roles to Timelock, transfer admin, renounce deployer ─
  const GOVERNOR_ROLE    = await treasury.GOVERNOR_ROLE();
  const TIMELOCK_ROLE    = await treasury.TIMELOCK_ROLE();
  const ADMIN_ROLE_T     = await treasury.DEFAULT_ADMIN_ROLE();

  await treasury.grantRole(GOVERNOR_ROLE, await timelock.getAddress());
  await treasury.grantRole(TIMELOCK_ROLE, await timelock.getAddress());

  // Transfer DEFAULT_ADMIN_ROLE to Timelock so the DAO controls role management.
  // Then deployer renounces their own admin role — no EOA should hold admin long-term.
  await treasury.transferAdmin(await timelock.getAddress());
  await treasury.renounceRole(ADMIN_ROLE_T, deployer.address);
  console.log(`✅ Treasury roles configured — admin transferred to Timelock, deployer renounced`);

  // ── Save deployment addresses ─────────────────────────────────────────────
  const addresses = {
    network:         network.name,
    chainId:         network.chainId.toString(),
    deployer:        deployer.address,
    btsh:            await btsh.getAddress(),
    timelock:        await timelock.getAddress(),
    governance:      await gov.getAddress(),
    treasury:        await treasury.getAddress(),
    vesting:         await vesting.getAddress(),
    proposalManager: await proposalManager.getAddress(),
    charityVault:        vault ? await vault.getAddress() : null,
    transparencyRegistry: registry ? await registry.getAddress() : null,
  };

  const outFile = path.join(__dirname, `../deployments/${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(addresses, null, 2));
  console.log(`\n📄 Addresses saved to deployments/${network.name}.json`);
  console.log("\n🎉 BITESHA deployment complete.\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
