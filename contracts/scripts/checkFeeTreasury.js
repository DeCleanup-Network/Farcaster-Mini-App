const hre = require("hardhat");
require("dotenv").config();

/**
 * Check fee treasury address in VerificationContract
 */
async function main() {
  console.log("🔍 Checking fee treasury configuration...\n");

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
    const owner = await VerificationContract.owner();
    const feeTreasury = await VerificationContract.feeTreasury();
    const contractBalance = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
    
    console.log("Contract Address:", VERIFICATION_ADDRESS);
    console.log("Owner:", owner);
    console.log("Fee Treasury:", feeTreasury || "(not set - fees go to owner)");
    console.log("Contract Balance (ETH):", hre.ethers.formatEther(contractBalance));
    console.log("");
    
    if (feeTreasury && feeTreasury !== "0x0000000000000000000000000000000000000000") {
      console.log("✅ Fee treasury is set!");
      console.log("   Fees will go to:", feeTreasury);
    } else {
      console.log("⚠️  Fee treasury is NOT set!");
      console.log("   Fees will go to owner:", owner);
      console.log("   To set fee treasury, run: npx hardhat run scripts/setFeeTreasury.js --network baseMainnet");
    }
  } catch (error) {
    console.error("❌ Error checking fee treasury:", error.message);
    console.log("   This might mean the contract doesn't have feeTreasury support yet.");
    console.log("   Make sure you've updated VerificationContract.sol before deploying!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

