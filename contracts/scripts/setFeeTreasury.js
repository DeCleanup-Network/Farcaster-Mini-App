const hre = require("hardhat");
require("dotenv").config();

/**
 * Set fee treasury address in VerificationContract
 * This allows fees to go directly to a separate Safe wallet
 */
async function main() {
  console.log("💰 Setting fee treasury address...\n");

  const FEE_TREASURY_ADDRESS = 
    process.env.FEE_TREASURY_SAFE_ADDRESS ||
    process.env.FEE_TREASURY_ADDRESS;

  if (!FEE_TREASURY_ADDRESS) {
    throw new Error("Fee treasury address not found. Set FEE_TREASURY_SAFE_ADDRESS or FEE_TREASURY_ADDRESS in .env");
  }

  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    process.env.VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT;

  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Setting fee treasury with account:", deployer.address);
  console.log("VerificationContract:", VERIFICATION_ADDRESS);
  console.log("Fee Treasury (Multisig 2):", FEE_TREASURY_ADDRESS);
  console.log("");

  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  // Check current value
  try {
    const currentTreasury = await VerificationContract.feeTreasury();
    console.log("Current fee treasury:", currentTreasury);
    
    if (currentTreasury.toLowerCase() === FEE_TREASURY_ADDRESS.toLowerCase()) {
      console.log("✅ Fee treasury already set correctly!");
      return;
    }
  } catch (error) {
    console.log("⚠️  Could not read current fee treasury (function may not exist yet):", error.message);
    console.log("   Make sure you've updated the contract with fee treasury support!");
    throw error;
  }

  console.log("Setting fee treasury...");
  const tx = await VerificationContract.setFeeTreasury(FEE_TREASURY_ADDRESS);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Successfully set fee treasury!");
  
  // Verify
  const newTreasury = await VerificationContract.feeTreasury();
  console.log("New fee treasury:", newTreasury);
  
  if (newTreasury.toLowerCase() === FEE_TREASURY_ADDRESS.toLowerCase()) {
    console.log("✅ Verification successful!");
    console.log("\n📝 Fees will now go to:", FEE_TREASURY_ADDRESS);
    console.log("   When you call withdrawFees(), ETH will be sent directly to this address.");
  } else {
    console.log("❌ Verification failed!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

