const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  
  const [signer] = await hre.ethers.getSigners();
  console.log("=== Owner Check ===\n");
  console.log("Script signer (from PRIVATE_KEY env var):", signer.address);
  
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);
  
  const owner = await distributor.owner();
  console.log("Contract owner (on-chain):", owner);
  console.log("\nCan this signer update values?", signer.address.toLowerCase() === owner.toLowerCase() ? "✅ YES" : "❌ NO");
  
  if (signer.address.toLowerCase() !== owner.toLowerCase()) {
    console.log("\n⚠️  WARNING: The private key in your .env file does NOT match the contract owner.");
    console.log("   You need to use the private key that deployed the contract to update values.");
  }
}

main().catch(console.error);

