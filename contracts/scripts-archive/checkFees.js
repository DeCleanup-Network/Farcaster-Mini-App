const hre = require("hardhat");
require("dotenv").config();

/**
 * Check claim fees in VerificationContract
 * Shows: contract balance, claim fee settings, owner, and fee treasury (if set)
 */
async function main() {
  console.log("💰 Checking claim fees...\n");

  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    process.env.VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT;

  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }

  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  try {
    // Get contract info
    const owner = await VerificationContract.owner();
    const contractBalance = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
    const claimFeeInfo = await VerificationContract.getClaimFee();
    
    console.log("📋 Contract Information:");
    console.log("   Address:", VERIFICATION_ADDRESS);
    console.log("   Owner:", owner);
    console.log("");
    
    console.log("💵 Fee Configuration:");
    console.log("   Claim Fee:", hre.ethers.formatEther(claimFeeInfo.fee), "ETH");
    console.log("   Claim Fee Enabled:", claimFeeInfo.enabled);
    console.log("");
    
    console.log("💰 Contract Balance (Accumulated Fees):");
    console.log("   ETH:", hre.ethers.formatEther(contractBalance));
    console.log("   Wei:", contractBalance.toString());
    console.log("");
    
    // Try to get fee treasury (may not exist in current contract)
    try {
      const feeTreasury = await VerificationContract.feeTreasury();
      if (feeTreasury && feeTreasury !== "0x0000000000000000000000000000000000000000") {
        console.log("✅ Fee Treasury is set!");
        console.log("   Treasury Address:", feeTreasury);
        console.log("   When withdrawFees() is called, fees will go to:", feeTreasury);
      } else {
        console.log("⚠️  Fee Treasury is NOT set");
        console.log("   Fees will go to owner when withdrawFees() is called:", owner);
      }
    } catch (error) {
      console.log("⚠️  Fee Treasury function not available in contract");
      console.log("   This means the contract doesn't have feeTreasury support yet");
      console.log("   Fees will go to owner when withdrawFees() is called:", owner);
    }
    
    console.log("");
    console.log("📝 To withdraw fees:");
    console.log("   npx hardhat run scripts/withdrawFees.js --network baseSepolia");
    console.log("   (or baseMainnet for mainnet)");
    
  } catch (error) {
    console.error("❌ Error checking fees:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

