const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const POINTS_DISTRIBUTOR = process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS || "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  const USER = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  // Get current values
  const points = await distributor.getPointsBalance(USER);
  const tokenPrice = await distributor.currentTokenPriceUSD();
  const targetValue = await distributor.targetRewardValueUSD();
  
  console.log("=== Current Values ===");
  console.log("User points:", points.toString());
  console.log("Token price (8 decimals):", tokenPrice.toString());
  console.log("Token price (USD):", hre.ethers.formatUnits(tokenPrice, 8));
  console.log("Target value (cents):", targetValue.toString());
  console.log("Target value (USD):", Number(targetValue) / 100, "for 10 DCU");
  
  // Manual calculation
  const pointsNum = Number(points);
  const usdValueCents = (pointsNum * Number(targetValue)) / 10;
  const usdValueDollars = usdValueCents / 100;
  const tokenPriceUSD = Number(hre.ethers.formatUnits(tokenPrice, 8));
  const tokensExpected = usdValueDollars / tokenPriceUSD;
  
  console.log("\n=== Manual Calculation ===");
  console.log("USD value (cents):", usdValueCents);
  console.log("USD value (dollars):", usdValueDollars);
  console.log("Token price (USD):", tokenPriceUSD);
  console.log("Tokens expected:", tokensExpected);
  console.log("Tokens expected (in wei):", hre.ethers.parseUnits(tokensExpected.toFixed(0), 18).toString());
  
  // Get actual from contract
  const tokensFromContract = await distributor.calculateClaimAmount(points);
  console.log("\n=== Contract Calculation ===");
  console.log("Tokens (raw bigint):", tokensFromContract.toString());
  console.log("Tokens (formatted):", hre.ethers.formatUnits(tokensFromContract, 18));
  
  // Check if they match
  const expectedWei = hre.ethers.parseUnits(tokensExpected.toFixed(0), 18);
  console.log("\n=== Comparison ===");
  console.log("Expected (wei):", expectedWei.toString());
  console.log("Contract (wei):", tokensFromContract.toString());
  console.log("Match:", expectedWei.toString() === tokensFromContract.toString() ? "✅ YES" : "❌ NO");
}

main().catch(console.error);

