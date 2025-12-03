const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔍 Checking Verifier Earnings...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Checking with account:", deployer.address);
  console.log("");

  // Get addresses from environment
  const fs = require("fs");
  
  let distributorAddress = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  let verifierAddress = process.env.VERIFIER_ADDRESS || deployer.address;

  // Try to load from deployment files
  if (!distributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    distributorAddress = deployment.address;
  }

  if (!distributorAddress) {
    throw new Error("bDCU Reward Distributor address not found. Set BDCU_REWARD_DISTRIBUTOR_ADDRESS in .env");
  }

  console.log("Configuration:");
  console.log("  bDCU Reward Distributor:", distributorAddress);
  console.log("  Verifier Address:", verifierAddress);
  console.log("");

  // Get contract instance
  const BDCURewardDistributor = await hre.ethers.getContractFactory("bDCURewardDistributor");
  const distributor = BDCURewardDistributor.attach(distributorAddress);

  // Check verifier earnings
  console.log("Checking Verifier Earnings...");
  try {
    const totalDistributed = await distributor.totalDistributed(verifierAddress);
    const earningsInTokens = hre.ethers.formatEther(totalDistributed);
    console.log("   Verifier Earnings:", earningsInTokens, "$bDCU");
    console.log("   Raw Earnings (wei):", totalDistributed.toString());
    
    if (totalDistributed > 0n) {
      console.log("   ✅ Verifier has earned tokens!");
    } else {
      console.log("   ⚠️  Verifier has NOT earned any tokens yet.");
      console.log("   This could mean:");
      console.log("     1. Verifications happened before contract was funded");
      console.log("     2. Distribution calls failed silently");
      console.log("     3. No verifications have been made yet");
    }
  } catch (error) {
    console.error("   ❌ Error checking verifier earnings:", error.message);
  }
  console.log("");

  // Check global total
  console.log("Checking Global Total Distributed...");
  try {
    const globalTotal = await distributor.globalTotalDistributed();
    const totalInTokens = hre.ethers.formatEther(globalTotal);
    console.log("   Global Total Distributed:", totalInTokens, "$bDCU");
    console.log("   Raw Total (wei):", globalTotal.toString());
  } catch (error) {
    console.error("   ❌ Error checking global total:", error.message);
  }
  console.log("");

  console.log("=== Check Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

