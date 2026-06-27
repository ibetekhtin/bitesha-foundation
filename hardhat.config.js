require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);
const BASE_RPC    = process.env.BASE_RPC_URL       || "https://mainnet.base.org";
const BASE_SEP    = process.env.BASE_SEPOLIA_RPC   || "https://sepolia.base.org";
const ARB_RPC     = process.env.ARB_RPC_URL        || "https://arb1.arbitrum.io/rpc";
const BASESCAN_KEY = process.env.BASESCAN_API_KEY  || "";
const ARBSCAN_KEY  = process.env.ARBSCAN_API_KEY   || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },
    "base-sepolia": {
      url:      BASE_SEP,
      accounts: [PRIVATE_KEY],
      chainId:  84532,
    },
    "base-mainnet": {
      url:      BASE_RPC,
      accounts: [PRIVATE_KEY],
      chainId:  8453,
    },
    "arbitrum-one": {
      url:      ARB_RPC,
      accounts: [PRIVATE_KEY],
      chainId:  42161,
    },
  },

  etherscan: {
    apiKey: {
      base:        BASESCAN_KEY,
      baseSepolia: BASESCAN_KEY,
      arbitrumOne: ARBSCAN_KEY,
    },
    customChains: [
      {
        network:   "base",
        chainId:   8453,
        urls: {
          apiURL:     "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network:   "baseSepolia",
        chainId:   84532,
        urls: {
          apiURL:     "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },

  gasReporter: {
    enabled:  process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
