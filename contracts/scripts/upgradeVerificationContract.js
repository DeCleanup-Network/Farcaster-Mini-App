/**
 * Upgrade VerificationContract proxy to a new implementation.
 *
 * New implementation: single awardClaimRewards call (instead of 3 reward calls)
 * and no automatic fee transfer on claim/submit (owner withdraws via withdrawFees).
 * Proxy address, storage, and linkages stay the same.
 *
 * Prerequisites:
 *   - Deployer must be the proxy owner.
 *   - deployment-{network}-upgradeable.json or VERIFICATION_CONTRACT_ADDRESS.
 *
 * Run from contracts/:
 *   npx hardhat run scripts/upgradeVerificationContract.js --network base
 *   npx hardhat run scripts/upgradeVerificationContract.js --network baseSepolia
 *
 * Optional: VERIFICATION_CONTRACT_ADDRESS=0x... to override the deployment file.
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

  let proxyAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;
  if (!proxyAddress) {
    const deploymentPath = path.join(__dirname, "..", `deployment-${net}-upgradeable.json`);
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(
        `No deployment file at ${deploymentPath}. Run deployUpgradeable.js first or set VERIFICATION_CONTRACT_ADDRESS.`
      );
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    proxyAddress = deployment.contracts?.VerificationContract;
    if (!proxyAddress) {
      throw new Error("VerificationContract not found in deployment file.");
    }
  }
  console.log("VerificationContract proxy:", proxyAddress);
  console.log("");

  console.log("Upgrading proxy (deploys new implementation and points proxy to it)...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, VerificationContract, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"],
  });
  await upgraded.waitForDeployment();
  const upgAddr = await upgraded.getAddress();
  console.log("Proxy (unchanged):", upgAddr);
  const [claimFee, claimEnabled] = await upgraded.getClaimFee();
  console.log("getClaimFee():", claimFee.toString(), "enabled:", claimEnabled);
  console.log("");
  console.log("Upgrade complete. New logic: single awardClaimRewards call, no auto fee transfer.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
