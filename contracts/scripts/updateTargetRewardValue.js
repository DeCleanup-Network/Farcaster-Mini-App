const hre = require("hardhat");
require("dotenv").config();

/**
 * Update Target Reward Value in PointsRewardDistributor
 * 
 * This updates the target USD value for 10 DCU points (cleanup reward).
 * The value is in cents (e.g., 50 = $0.50, 90 = $0.90)
 * 
 * Usage:
 *   TARGET_REWARD_VALUE=50 npx hardhat run scripts/updateTargetRewardValue.js --network baseSepolia
 *   TARGET_REWARD_VALUE=60 npx hardhat run scripts/updateTargetRewardValue.js --network baseSepolia
 */
async function main() {
  console.log("💰 Updating Target Reward Value...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract address
  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  if (!POINTS_DISTRIBUTOR) {
    console.error("❌ POINTS_REWARD_DISTRIBUTOR_ADDRESS not found in environment variables");
    console.log("Set POINTS_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS");
    process.exit(1);
  }

  console.log("PointsRewardDistributor:", POINTS_DISTRIBUTOR);

  // Get new target reward value
  const TARGET_REWARD_VALUE = process.env.TARGET_REWARD_VALUE;
  
  if (!TARGET_REWARD_VALUE) {
    console.error("❌ TARGET_REWARD_VALUE not set");
    console.log("Usage: TARGET_REWARD_VALUE=50 npx hardhat run scripts/updateTargetRewardValue.js --network baseSepolia");
    console.log("Value is in cents (e.g., 50 = $0.50 for 10 DCU)");
    process.exit(1);
  }

  const newValue = BigInt(TARGET_REWARD_VALUE);
  console.log("New target reward value:", newValue.toString(), "cents");
  console.log("This equals:", `$${(Number(newValue) / 100).toFixed(2)} USD for 10 DCU\n`);

  // Connect to contract
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);

  // Check current value
  const currentValue = await distributor.targetRewardValueUSD();
  console.log("Current target reward value:", currentValue.toString(), "cents");
  console.log("Current equals:", `$${(Number(currentValue) / 100).toFixed(2)} USD for 10 DCU\n`);

  if (currentValue.toString() === newValue.toString()) {
    console.log("⚠️  New value is the same as current value. No update needed.");
    return;
  }

  // Update token price
  console.log("📤 Updating target reward value...");
  const tx = await distributor.updateTargetRewardValue(newValue);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Target reward value updated successfully!\n");

  // Verify new value
  const updatedValue = await distributor.targetRewardValueUSD();
  console.log("✅ Verified - New target reward value:", updatedValue.toString(), "cents");
  console.log("   This equals:", `$${(Number(updatedValue) / 100).toFixed(2)} USD for 10 DCU`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

