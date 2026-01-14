const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const USER = process.env.USER_ADDRESS || "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  const points = await distributor.getPointsBalance(USER);
  const pointsClaimed = await distributor.getPointsClaimed(USER);
  const tokenAddress = await distributor.bDCUToken();
  
  console.log("=== Claim Status ===");
  console.log("User:", USER);
  console.log("DCU Points (remaining):", points.toString());
  console.log("DCU Points (claimed):", pointsClaimed.toString());
  console.log("Token Contract:", tokenAddress);
  
  // Check user's token balance
  const ERC20_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
  ];
  const tokenContract = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress);
  const userTokenBalance = await tokenContract.balanceOf(USER);
  const decimals = await tokenContract.decimals();
  
  console.log("\n=== Token Balance ===");
  console.log("User Token Balance (wei):", userTokenBalance.toString());
  console.log("User Token Balance (formatted):", hre.ethers.formatUnits(userTokenBalance, decimals));
  
  // Check contract token balance
  const contractTokenBalance = await tokenContract.balanceOf(POINTS_DISTRIBUTOR);
  console.log("Contract Token Balance (formatted):", hre.ethers.formatUnits(contractTokenBalance, decimals));
}

main().catch(console.error);

