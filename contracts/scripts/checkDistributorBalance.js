const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  
  console.log("PointsRewardDistributor address:", POINTS_DISTRIBUTOR);
  
  // Get token address from contract
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  try {
    const TOKEN = await distributor.bDCUToken();
    console.log("Token address:", TOKEN);
    
    const ERC20_ABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];
    
    const token = await hre.ethers.getContractAt(ERC20_ABI, TOKEN);
    const balance = await token.balanceOf(POINTS_DISTRIBUTOR);
    const decimals = await token.decimals();
    
    console.log("Contract Token Balance:", hre.ethers.formatUnits(balance, decimals), "bDCU");
    
    if (balance === BigInt(0)) {
      console.log("\n⚠️  WARNING: Contract has 0 tokens! Users cannot claim until tokens are deposited.");
    }
  } catch (error) {
    console.error("Error checking balance:", error.message);
  }
}

main().catch(console.error);

