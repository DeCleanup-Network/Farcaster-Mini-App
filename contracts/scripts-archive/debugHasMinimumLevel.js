const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const USER = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const POINTS_DISTRIBUTOR = "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  const IMPACT_PRODUCT_NFT = "0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9";
  
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_NFT);
  
  const impactProductNFTAddress = await distributor.impactProductNFT();
  console.log("=== Contract Linkage ===");
  console.log("ImpactProductNFT linked in contract:", impactProductNFTAddress);
  console.log("Expected:", IMPACT_PRODUCT_NFT);
  console.log("Match:", impactProductNFTAddress.toLowerCase() === IMPACT_PRODUCT_NFT.toLowerCase() ? "✅ YES" : "❌ NO");
  
  const level = await ImpactProductNFT.userCurrentLevel(USER);
  console.log("\n=== User Level ===");
  console.log("User level from ImpactProductNFT:", level.toString());
  console.log("Level >= 10?", level >= 10);
  
  // Try calling hasMinimumLevel
  console.log("\n=== hasMinimumLevel Check ===");
  try {
    const hasLevel = await distributor.hasMinimumLevel(USER);
    console.log("hasMinimumLevel result:", hasLevel);
  } catch (error) {
    console.log("Error calling hasMinimumLevel:", error.message);
  }
}

main().catch(console.error);

