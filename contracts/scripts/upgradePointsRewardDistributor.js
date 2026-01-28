/**
 * Upgrade PointsRewardDistributor proxy to a new implementation.
 *
 * This script deploys a new implementation (with MINIMUM_LEVEL_FOR_STAKING = 3)
 * and upgrades the existing proxy. Proxy address, storage, and all linkages stay
 * the same.
 *
 * Prerequisites:
 *   - Deployer must be the proxy owner (same as original deployer or current owner).
 *   - contracts/deployment-{network}-upgradeable.json must exist with PointsRewardDistributor.
 *
 * Run from contracts/:
 *   npx hardhat run scripts/upgradePointsRewardDistributor.js --network base
 *   npx hardhat run scripts/upgradePointsRewardDistributor.js --network baseSepolia
 *
 * Optional: POINTS_REWARD_DISTRIBUTOR_ADDRESS=0x... to override the deployment file.
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

  let proxyAddress = process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS;
  if (!proxyAddress) {
    const deploymentPath = path.join(__dirname, "..", `deployment-${net}-upgradeable.json`);
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(
        `No deployment file at ${deploymentPath}. Run deployUpgradeable.js first or set POINTS_REWARD_DISTRIBUTOR_ADDRESS.`
      );
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    proxyAddress = deployment.contracts?.PointsRewardDistributor;
    if (!proxyAddress) {
      throw new Error("PointsRewardDistributor not found in deployment file.");
    }
  }
  console.log("PointsRewardDistributor proxy:", proxyAddress);
  console.log("");

  console.log("Upgrading proxy (deploys new implementation and points proxy to it)...");
  const PointsRewardDistributor = await ethers.getContractFactory("PointsRewardDistributor");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, PointsRewardDistributor, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"],
  });
  await upgraded.waitForDeployment();
  const upgAddr = await upgraded.getAddress();
  console.log("Proxy (unchanged):", upgAddr);
  const minLevel = await upgraded.getMinimumLevelForStaking();
  console.log("getMinimumLevelForStaking():", minLevel.toString());
  console.log("");
  console.log("Upgrade complete. MINIMUM_LEVEL_FOR_STAKING is now 3.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
