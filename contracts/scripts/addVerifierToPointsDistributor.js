const hre = require("hardhat");
require("dotenv").config();

/**
 * Add verifier to PointsRewardDistributor (manual, bypasses staking)
 * 
 * Usage:
 *   npx hardhat run scripts/addVerifierToPointsDistributor.js --network baseSepolia <verifier_address>
 *   Or: VERIFIER_ADDRESS=0x... npx hardhat run scripts/addVerifierToPointsDistributor.js --network baseSepolia
 */
async function main() {
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || process.argv[2];

  if (!VERIFIER_ADDRESS) {
    console.error("❌ Error: Verifier address not provided");
    console.log("Usage: npx hardhat run scripts/addVerifierToPointsDistributor.js --network baseSepolia <address>");
    console.log("Or: VERIFIER_ADDRESS=0x... npx hardhat run scripts/addVerifierToPointsDistributor.js --network baseSepolia");
    process.exit(1);
  }

  console.log("➕ Adding verifier to PointsRewardDistributor...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Verifier address:", VERIFIER_ADDRESS);
  console.log("");

  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  if (!POINTS_DISTRIBUTOR) {
    throw new Error("PointsRewardDistributor address not found");
  }

  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);

  // Check if already a verifier
  const isVerifier = await distributor.checkIsVerifier(VERIFIER_ADDRESS);
  if (isVerifier) {
    console.log("⚠️  Address is already a verifier");
    return;
  }

  const tx = await distributor.addVerifier(VERIFIER_ADDRESS);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✅ Verifier added successfully!\n");

  // Verify
  const isVerifierNow = await distributor.checkIsVerifier(VERIFIER_ADDRESS);
  console.log("Verifier status:", isVerifierNow ? "✅ YES" : "❌ NO");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

