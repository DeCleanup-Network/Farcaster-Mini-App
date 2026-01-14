const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    "0xeec841D58aDf2a7D024F48897B1872832df5aE8a";
    
  const USER = process.env.USER_ADDRESS || process.argv[2] || "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  const balance = await distributor.getPointsBalance(USER);
  console.log("User address:", USER);
  console.log("DCU balance:", balance.toString());
}

main().catch(console.error);

