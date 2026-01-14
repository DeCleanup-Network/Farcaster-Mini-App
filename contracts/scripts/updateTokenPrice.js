const hre = require("hardhat");
require("dotenv").config();

/**
 * Update token price in PointsRewardDistributor
 */
async function main() {
  const POINTS_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  if (!POINTS_DISTRIBUTOR_ADDRESS) {
    throw new Error("PointsRewardDistributor address not found");
  }

  // $0.00000077 per token = 77 in 8 decimals
  const TOKEN_PRICE = process.env.TOKEN_PRICE || "77";
  const tokenPriceBigInt = BigInt(TOKEN_PRICE);

  console.log("💰 Updating token price...");
  console.log("   Contract:", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("   New price (8 decimals):", TOKEN_PRICE);
  console.log("   This equals:", hre.ethers.formatUnits(TOKEN_PRICE, 8), "USD per token\n");

  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const pointsDistributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR_ADDRESS);

  const currentPrice = await pointsDistributor.currentTokenPriceUSD();
  console.log("   Current price:", currentPrice.toString(), "=", hre.ethers.formatUnits(currentPrice, 8), "USD per token");

  if (currentPrice.toString() === TOKEN_PRICE) {
    console.log("   ✅ Price already set correctly!\n");
    return;
  }

  const tx = await pointsDistributor.updateTokenPrice(tokenPriceBigInt);
  console.log("   Transaction hash:", tx.hash);
  await tx.wait();
  console.log("   ✅ Token price updated successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

