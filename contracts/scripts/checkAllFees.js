const hre = require("hardhat");
require("dotenv").config();

/**
 * Check both submission and claim fees
 */
async function main() {
  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    "0x82968575f998f669b72C56E4BdC2e94E6546c55F";

  console.log("💰 Checking all fees...\n");

  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  // Check submission fee
  const [submissionFee, submissionFeeEnabled] = await VerificationContract.getSubmissionFee();
  
  // Check claim fee
  const [claimFee, claimFeeEnabled] = await VerificationContract.getClaimFee();

  // Check contract balance
  const balance = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);

  // Check fee treasury
  let feeTreasury = "0x0000000000000000000000000000000000000000";
  try {
    feeTreasury = await VerificationContract.feeTreasury();
  } catch (e) {
    // Old contract version might not have this
  }

  console.log("📋 Fee Configuration:");
  console.log("");
  console.log("1. Submission Fee (when submitting cleanup):");
  console.log("   Amount:", hre.ethers.formatEther(submissionFee), "ETH");
  console.log("   Enabled:", submissionFeeEnabled ? "✅ YES" : "❌ NO");
  console.log("");
  console.log("2. Claim Fee (when claiming Impact Product):");
  console.log("   Amount:", hre.ethers.formatEther(claimFee), "ETH");
  console.log("   Enabled:", claimFeeEnabled ? "✅ YES" : "❌ NO");
  console.log("");
  console.log("💰 Contract Balance (Accumulated Fees):");
  console.log("   ETH:", hre.ethers.formatEther(balance));
  console.log("");
  
  if (feeTreasury && feeTreasury !== "0x0000000000000000000000000000000000000000") {
    console.log("✅ Fee Treasury:", feeTreasury);
    console.log("   Fees will go here when withdrawn");
  } else {
    const owner = await VerificationContract.owner();
    console.log("ℹ️  No fee treasury set - fees go to owner:", owner);
  }
}

main().catch(console.error);

