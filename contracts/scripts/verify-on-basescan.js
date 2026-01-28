/**
 * Verify Base mainnet implementation contracts on Basescan.
 *
 * Reads implementation addresses from .openzeppelin/base.json (includes any
 * new impls after upgrades, e.g. PointsRewardDistributor v2). If the file is
 * missing, falls back to a built-in list.
 *
 * Prerequisites:
 *   - ETHERSCAN_API_KEY (or BASESCAN_API_KEY) in contracts/.env
 *   - https://etherscan.io/apidashboard
 *
 * Run from contracts/:
 *   npm run verify:basescan
 *   # or: npx hardhat run scripts/verify-on-basescan.js --network base
 */

const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

const CONTRACT_TO_PATH = {
  PointsRewardDistributor: "contracts/PointsRewardDistributor.sol:PointsRewardDistributor",
  ImpactProductNFT: "contracts/ImpactProductNFT.sol:ImpactProductNFT",
  VerificationContract: "contracts/VerificationContract.sol:VerificationContract",
};

const PROXY_NAMES = ["PointsRewardDistributor", "ImpactProductNFT", "VerificationContract"];

// Fallback when .openzeppelin/base.json is missing (e.g. fresh clone)
const FALLBACK_IMPLS = [
  { name: "PointsRewardDistributor", address: "0xa282c26245d116aB5600fBF7901f2E4827c16B7A", contract: CONTRACT_TO_PATH.PointsRewardDistributor },
  { name: "ImpactProductNFT", address: "0x0b2686003Aa6a3cb55e686F49c7fb9228F927DC6", contract: CONTRACT_TO_PATH.ImpactProductNFT },
  { name: "VerificationContract", address: "0x0bBc0C4D5f4756fe3502136FaD3eBb06254f51cf", contract: CONTRACT_TO_PATH.VerificationContract },
];

const FALLBACK_PROXIES = [
  "0x492065137E07c660DCfAe4dC335A3Fa9C1203dd9",
  "0x8D71Cd7445423CD42293E196B91E47f085E81BCf",
  "0x69715d43EA6D46F65045FCe2391D9B7F89ec819F",
];

function loadFromOpenZeppelin() {
  const p = path.join(__dirname, "..", ".openzeppelin", "base.json");
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    const impls = [];
    const seen = new Set();
    for (const [, impl] of Object.entries(data.impls || {})) {
      const addr = impl?.address;
      const name = impl?.layout?.storage?.[0]?.contract;
      if (!addr || !name || !CONTRACT_TO_PATH[name] || seen.has(addr)) continue;
      seen.add(addr);
      impls.push({ name, address: addr, contract: CONTRACT_TO_PATH[name] });
    }
    const proxies = (data.proxies || []).map((p) => p.address);
    return { impls, proxies };
  } catch (e) {
    console.warn("Could not read .openzeppelin/base.json:", e?.message);
    return null;
  }
}

async function main() {
  if (hre.network.name !== "base") {
    console.log("This script is for Base mainnet. Use --network base.");
    process.exit(1);
  }

  const apiKey = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY;
  if (!apiKey) {
    console.log("Set ETHERSCAN_API_KEY (or BASESCAN_API_KEY) in contracts/.env");
    console.log("Etherscan API V2: https://etherscan.io/apidashboard");
    process.exit(1);
  }

  const oz = loadFromOpenZeppelin();
  const impls = (oz?.impls?.length ? oz.impls : FALLBACK_IMPLS);
  const proxies = (oz?.proxies?.length >= 3 ? oz.proxies : FALLBACK_PROXIES);

  console.log("Verifying implementation contracts on Basescan...\n");

  for (const { name, address, contract } of impls) {
    try {
      console.log(`Verifying ${name} at ${address} ...`);
      await hre.run("verify:verify", { address, contract, constructorArguments: [] });
      console.log(`  Verified: https://basescan.org/address/${address}\n`);
    } catch (e) {
      if (e.message && e.message.includes("Already Verified")) {
        console.log(`  Already verified.\n`);
      } else {
        console.error(`  Error:`, e.message || e);
        console.log("");
      }
    }
  }

  console.log("Proxy addresses (use these in the app; no need to verify):");
  PROXY_NAMES.forEach((n, i) => console.log(`  ${n}: ${proxies[i] || "(unknown)"}`));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
