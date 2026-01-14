const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const POINTS_DISTRIBUTOR = process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS || "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  const IMPACT_PRODUCT_NFT = process.env.IMPACT_PRODUCT_NFT_ADDRESS || process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS || "0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Linking with account:", deployer.address);
  
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  console.log("Linking ImpactProductNFT:", IMPACT_PRODUCT_NFT);
  const tx = await distributor.setImpactProductNFT(IMPACT_PRODUCT_NFT);
  await tx.wait();
  console.log("✅ ImpactProductNFT linked!");
  console.log("Transaction:", tx.hash);
}

main().catch(console.error);

