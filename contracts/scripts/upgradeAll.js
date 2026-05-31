/**
 * Upgrade all three gas-optimized contracts in order:
 * 1. PointsRewardDistributor (adds awardClaimRewards)
 * 2. VerificationContract (single reward call, no auto fee transfer)
 * 3. ImpactProductNFT (no URI storage on claim/update/decrease)
 *
 * Prerequisites:
 *   - Deployer must be owner of all three proxies.
 *   - deployment-{network}-upgradeable.json or set env vars for each proxy.
 *
 * Run from contracts/:
 *   npm run upgrade:all:base
 *   npm run upgrade:all:baseSepolia
 *
 * Or: npx hardhat run scripts/upgradeAll.js --network base
 */

const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

function getDeployment(net) {
  const deploymentPath = path.join(__dirname, "..", `deployment-${net}-upgradeable.json`);
  if (!fs.existsSync(deploymentPath)) return null;
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function main() {
  const net = hre.network.name;
  if (net !== "base" && net !== "baseSepolia") {
    throw new Error("Use --network base or --network baseSepolia");
  }

  const [deployer] = await ethers.getSigners();
  const deployment = getDeployment(net);

  const addresses = {
    PointsRewardDistributor:
      process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS || deployment?.contracts?.PointsRewardDistributor,
    VerificationContract:
      process.env.VERIFICATION_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
      deployment?.contracts?.VerificationContract,
    ImpactProductNFT:
      process.env.IMPACT_PRODUCT_NFT_ADDRESS ||
      process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
      deployment?.contracts?.ImpactProductNFT,
  };

  if (!addresses.PointsRewardDistributor || !addresses.VerificationContract || !addresses.ImpactProductNFT) {
    throw new Error(
      "Missing proxy addresses. Set deployment-{network}-upgradeable.json or POINTS_REWARD_DISTRIBUTOR_ADDRESS, VERIFICATION_CONTRACT_ADDRESS, IMPACT_PRODUCT_NFT_ADDRESS."
    );
  }

  console.log("Network:", net);
  console.log("Deployer (must be proxy owner for all three):", deployer.address);
  console.log("");
  console.log("1/3 Upgrading PointsRewardDistributor...");
  const PointsRewardDistributor = await ethers.getContractFactory("PointsRewardDistributor");
  const dist = await upgrades.upgradeProxy(addresses.PointsRewardDistributor, PointsRewardDistributor, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"],
  });
  await dist.waitForDeployment();
  console.log("   Proxy:", await dist.getAddress());
  console.log("");

  console.log("2/3 Upgrading VerificationContract...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verif = await upgrades.upgradeProxy(addresses.VerificationContract, VerificationContract, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"],
  });
  await verif.waitForDeployment();
  console.log("   Proxy:", await verif.getAddress());
  console.log("");

  console.log("3/3 Upgrading ImpactProductNFT...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const nft = await upgrades.upgradeProxy(addresses.ImpactProductNFT, ImpactProductNFT, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"],
  });
  await nft.waitForDeployment();
  console.log("   Proxy:", await nft.getAddress());
  console.log("");

  console.log("All three upgrades complete. Claim flow is now gas-optimized.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
