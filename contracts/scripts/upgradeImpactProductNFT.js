/**
 * Upgrade ImpactProductNFT proxy to a new implementation.
 *
 * New implementation: no _setTokenURI on claim/update/decrease (tokenURI() already
 * computes from tokenLevel). Saves gas on claim and level updates.
 * Proxy address, storage, and linkages stay the same.
 *
 * Prerequisites:
 *   - Deployer must be the proxy owner.
 *   - deployment-{network}-upgradeable.json or IMPACT_PRODUCT_NFT_ADDRESS.
 *
 * Run from contracts/:
 *   npx hardhat run scripts/upgradeImpactProductNFT.js --network base
 *   npx hardhat run scripts/upgradeImpactProductNFT.js --network baseSepolia
 *
 * Optional: IMPACT_PRODUCT_NFT_ADDRESS=0x... to override the deployment file.
 */

const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

async function main() {
  const net = hre.network.name;
  if (net !== "base" && net !== "baseSepolia") {
    throw new Error("Use --network base or --network baseSepolia");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Network:", net);
  console.log("Deployer (must be proxy owner):", deployer.address);
  console.log("");

  let proxyAddress = process.env.IMPACT_PRODUCT_NFT_ADDRESS || process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  if (!proxyAddress) {
    const deploymentPath = path.join(__dirname, "..", `deployment-${net}-upgradeable.json`);
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(
        `No deployment file at ${deploymentPath}. Run deployUpgradeable.js first or set IMPACT_PRODUCT_NFT_ADDRESS.`
      );
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    proxyAddress = deployment.contracts?.ImpactProductNFT;
    if (!proxyAddress) {
      throw new Error("ImpactProductNFT not found in deployment file.");
    }
  }
  console.log("ImpactProductNFT proxy:", proxyAddress);
  console.log("");

  console.log("Upgrading proxy (deploys new implementation and points proxy to it)...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ImpactProductNFT, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"],
  });
  await upgraded.waitForDeployment();
  const upgAddr = await upgraded.getAddress();
  console.log("Proxy (unchanged):", upgAddr);
  const maxLevel = await upgraded.MAX_LEVEL();
  console.log("MAX_LEVEL:", maxLevel.toString());
  console.log("");
  console.log("Upgrade complete. New logic: no URI storage on claim/update/decrease (gas-optimized).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
