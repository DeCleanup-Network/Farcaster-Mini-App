const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔍 Checking Submission Fee Status...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Checking with account:", deployer.address);
  console.log("");

  // Get addresses from environment
  const fs = require("fs");
  
  let verificationAddress = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  if (!verificationAddress) {
    throw new Error("VerificationContract address not found. Set VERIFICATION_CONTRACT_ADDRESS in .env");
  }

  console.log("Configuration:");
  console.log("  VerificationContract:", verificationAddress);
  console.log("");

  // Get contract instance
  const VerificationContract = await hre.ethers.getContractFactory("VerificationContract");
  const verification = VerificationContract.attach(verificationAddress);

  // Check submission fee
  console.log("Checking Submission Fee...");
  try {
    const [fee, enabled] = await verification.getSubmissionFee();
    const feeInEth = hre.ethers.formatEther(fee);
    console.log("   Submission Fee:", fee.toString(), "wei");
    console.log("   Fee in ETH:", feeInEth);
    console.log("   Fee Enabled:", enabled);
    
    if (enabled && fee > 0n) {
      console.log("   ✅ Submission fee is ENABLED");
    } else {
      console.log("   ℹ️  Submission fee is DISABLED (this is OK)");
    }
  } catch (error) {
    console.error("   ❌ Error checking submission fee:", error.message);
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

