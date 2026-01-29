const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const USER = process.env.USER_ADDRESS || process.argv[2] || "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  const IMPACT_PRODUCT_NFT = 
    process.env.IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
    "0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9";
  
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_NFT);
  
  const points = await distributor.getPointsBalance(USER);
  const hasMinimumLevel = await distributor.hasMinimumLevel(USER);
  const level = await ImpactProductNFT.userCurrentLevel(USER);
  
  console.log("=== User Status ===");
  console.log("User:", USER);
  console.log("DCU Points:", points.toString());
  console.log("Level:", level.toString());
  console.log("Has Minimum Level (3):", hasMinimumLevel);
  console.log("\n=== UI Visibility ===");
  console.log("Claim section will show:", points > 0 && hasMinimumLevel ? "✅ YES" : "❌ NO");
  console.log("Stake section will show:", hasMinimumLevel ? "✅ YES" : "❌ NO");
  
  if (!hasMinimumLevel) {
    console.log("\n⚠️  User needs to reach level 3 to see claim/stake sections");
  }
  if (points === 0) {
    console.log("\n⚠️  User has 0 DCU points");
  }
}

main().catch(console.error);

