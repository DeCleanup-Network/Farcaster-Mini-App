const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔍 Checking bDCU Reward Distributor Status...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Checking with account:", deployer.address);
  console.log("");

  // Get addresses from environment
  const fs = require("fs");
  
  let distributorAddress = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  let verificationAddress = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  // Try to load from deployment files
  if (!distributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    distributorAddress = deployment.address;
  }

  if (!distributorAddress) {
    throw new Error("bDCU Reward Distributor address not found. Set BDCU_REWARD_DISTRIBUTOR_ADDRESS in .env");
  }

  if (!verificationAddress) {
    throw new Error("VerificationContract address not found. Set VERIFICATION_CONTRACT_ADDRESS in .env");
  }

  console.log("Configuration:");
  console.log("  bDCU Reward Distributor:", distributorAddress);
  console.log("  VerificationContract:", verificationAddress);
  console.log("");

  // Get contract instance
  const BDCURewardDistributor = await hre.ethers.getContractFactory("bDCURewardDistributor");
  const distributor = BDCURewardDistributor.attach(distributorAddress);

  // Check 1: Contract linking
  console.log("1. Checking Contract Linking...");
  try {
    const linkedVerificationContract = await distributor.verificationContract();
    console.log("   Linked VerificationContract:", linkedVerificationContract);
    console.log("   Expected VerificationContract:", verificationAddress);
    
    const isLinked = linkedVerificationContract.toLowerCase() === verificationAddress.toLowerCase();
    if (isLinked) {
      console.log("   ✅ Contracts are properly linked!");
    } else {
      console.log("   ❌ Contracts are NOT linked!");
      console.log("   ⚠️  Run: npx hardhat run scripts/linkBDCURewardDistributor.js --network baseSepolia");
    }
  } catch (error) {
    console.error("   ❌ Error checking contract link:", error.message);
  }
  console.log("");

  // Check 2: Contract funding
  console.log("2. Checking Contract Funding...");
  try {
    const balance = await distributor.getContractBalance();
    const balanceInTokens = hre.ethers.formatEther(balance);
    console.log("   Contract Balance:", balanceInTokens, "$bDCU");
    console.log("   Raw Balance (wei):", balance.toString());
    
    if (balance > 0n) {
      console.log("   ✅ Contract is funded!");
    } else {
      console.log("   ❌ Contract has NO tokens!");
      console.log("   ⚠️  Contract needs to be funded with $bDCU tokens.");
      console.log("   ⚠️  Use depositTokens() function or transfer tokens directly to the contract.");
    }
  } catch (error) {
    console.error("   ❌ Error checking contract funding:", error.message);
  }
  console.log("");

  // Check 3: Global total distributed
  console.log("3. Checking Total Distributed...");
  try {
    const globalTotal = await distributor.globalTotalDistributed();
    const totalInTokens = hre.ethers.formatEther(globalTotal);
    console.log("   Total Distributed:", totalInTokens, "$bDCU");
    console.log("   Raw Total (wei):", globalTotal.toString());
    
    if (globalTotal > 0n) {
      console.log("   ✅ Tokens have been distributed!");
    } else {
      console.log("   ⚠️  No tokens distributed yet.");
    }
  } catch (error) {
    console.error("   ❌ Error checking total distributed:", error.message);
  }
  console.log("");

  console.log("=== Status Check Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

