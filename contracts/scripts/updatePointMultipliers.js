const hre = require("hardhat");
require("dotenv").config();

/**
 * Update point multipliers in PointsRewardDistributor
 * 
 * Usage:
 *   LEVEL_POINTS=10 STREAK_POINTS=1 REFERRAL_POINTS=2 IMPACT_FORM_POINTS=3 VERIFIER_POINTS=1 \
 *   npx hardhat run scripts/updatePointMultipliers.js --network baseSepolia
 */
async function main() {
  console.log("🔧 Updating Point Multipliers...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  if (!POINTS_DISTRIBUTOR) {
    throw new Error("PointsRewardDistributor address not found");
  }

  const LEVEL_POINTS = process.env.LEVEL_POINTS || "10";
  const STREAK_POINTS = process.env.STREAK_POINTS || "1";
  const REFERRAL_POINTS = process.env.REFERRAL_POINTS || "2";
  const IMPACT_FORM_POINTS = process.env.IMPACT_FORM_POINTS || "3";
  const VERIFIER_POINTS = process.env.VERIFIER_POINTS || "1";

  console.log("New multipliers:");
  console.log("  LEVEL_POINTS (cleanup):", LEVEL_POINTS);
  console.log("  STREAK_POINTS:", STREAK_POINTS);
  console.log("  REFERRAL_POINTS:", REFERRAL_POINTS);
  console.log("  IMPACT_FORM_POINTS:", IMPACT_FORM_POINTS);
  console.log("  VERIFIER_POINTS:", VERIFIER_POINTS);
  console.log("");

  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);

  // Get current values
  const currentLevel = await distributor.LEVEL_POINTS();
  const currentStreak = await distributor.STREAK_POINTS();
  const currentReferral = await distributor.REFERRAL_POINTS();
  const currentImpact = await distributor.IMPACT_FORM_POINTS();
  const currentVerifier = await distributor.VERIFIER_POINTS();

  console.log("Current multipliers:");
  console.log("  LEVEL_POINTS:", currentLevel.toString());
  console.log("  STREAK_POINTS:", currentStreak.toString());
  console.log("  REFERRAL_POINTS:", currentReferral.toString());
  console.log("  IMPACT_FORM_POINTS:", currentImpact.toString());
  console.log("  VERIFIER_POINTS:", currentVerifier.toString());
  console.log("");

  const tx = await distributor.updatePointMultipliers(
    BigInt(LEVEL_POINTS),
    BigInt(STREAK_POINTS),
    BigInt(REFERRAL_POINTS),
    BigInt(IMPACT_FORM_POINTS),
    BigInt(VERIFIER_POINTS)
  );

  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✅ Point multipliers updated successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

