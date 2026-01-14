const hre = require("hardhat");
require("dotenv").config();

/**
 * Manually Award Points to a User
 * 
 * This script allows the contract owner to manually award DCU points to a user.
 * Useful for testing or migrating users from the old token system.
 * 
 * Usage:
 *   npx hardhat run scripts/awardPoints.js --network baseSepolia
 * 
 * Environment variables:
 *   POINTS_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS
 *   USER_ADDRESS (address to award points to)
 *   POINTS_AMOUNT (amount of points to award, default: 41)
 */
async function main() {
  console.log("🎁 Awarding DCU Points to User...\n");

  const POINTS_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  const USER_ADDRESS = process.env.USER_ADDRESS || process.argv[2];
  const POINTS_AMOUNT = process.env.POINTS_AMOUNT || process.argv[3] || "41";

  if (!POINTS_DISTRIBUTOR_ADDRESS) {
    console.error("❌ Error: PointsRewardDistributor address not found");
    console.log("Set POINTS_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS in .env");
    process.exit(1);
  }

  if (!USER_ADDRESS) {
    console.error("❌ Error: User address not provided");
    console.log("Usage: npx hardhat run scripts/awardPoints.js --network baseSepolia <userAddress> [pointsAmount]");
    console.log("Or set USER_ADDRESS and POINTS_AMOUNT in .env");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("PointsRewardDistributor:", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("User address:", USER_ADDRESS);
  console.log("Points amount:", POINTS_AMOUNT);
  console.log("");

  // Get contract
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const pointsDistributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR_ADDRESS);

  // Check owner
  const owner = await pointsDistributor.owner();
  console.log("Contract owner:", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Error: You are not the contract owner!");
    console.log("   Only the owner can award points manually.");
    process.exit(1);
  }

  // Check current balance
  try {
    const currentBalance = await pointsDistributor.getPointsBalance(USER_ADDRESS);
    console.log("Current points balance:", currentBalance.toString());
  } catch (error) {
    console.log("Could not read current balance (may be 0)");
  }

  // Award points
  console.log("\n📤 Awarding points...");
  try {
    const tx = await pointsDistributor.manualAwardPoints(USER_ADDRESS, POINTS_AMOUNT);
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("✅ Points awarded successfully!\n");

    // Verify new balance
    const newBalance = await pointsDistributor.getPointsBalance(USER_ADDRESS);
    console.log("New points balance:", newBalance.toString());
  } catch (error) {
    console.error("❌ Error awarding points:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

