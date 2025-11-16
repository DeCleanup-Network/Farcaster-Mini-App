const { ethers } = require("hardhat");

async function main() {
  const verificationOld = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7"; // Frontend
  const verificationNew = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3"; // Backend
  
  const impactOld = "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1"; // Frontend
  const impactNew = "0x0F4193e25E3292e87970fa23c1555C8769A77278"; // Backend
  
  console.log("=== Checking Contract Data ===\n");
  
  // Check old VerificationContract
  console.log("OLD VerificationContract:", verificationOld);
  try {
    const VerificationOld = await ethers.getContractAt("VerificationContract", verificationOld);
    const counterOld = await VerificationOld.cleanupCounter();
    console.log("  Cleanup Counter:", counterOld.toString());
    if (counterOld > BigInt(1)) {
      console.log("  ✅ Has data (cleanups exist)");
    } else {
      console.log("  ❌ Empty (no cleanups)");
    }
  } catch (error) {
    console.log("  ❌ Error:", error.message);
  }
  
  // Check new VerificationContract
  console.log("\nNEW VerificationContract:", verificationNew);
  try {
    const VerificationNew = await ethers.getContractAt("VerificationContract", verificationNew);
    const counterNew = await VerificationNew.cleanupCounter();
    console.log("  Cleanup Counter:", counterNew.toString());
    if (counterNew > BigInt(1)) {
      console.log("  ✅ Has data (cleanups exist)");
    } else {
      console.log("  ❌ Empty (no cleanups)");
    }
  } catch (error) {
    console.log("  ❌ Error:", error.message);
  }
  
  // Check old ImpactProductNFT
  console.log("\nOLD ImpactProductNFT:", impactOld);
  try {
    const ImpactOld = await ethers.getContractAt("ImpactProductNFT", impactOld);
    // Try to get a token count or check if any tokens exist
    console.log("  ✅ Contract exists");
  } catch (error) {
    console.log("  ❌ Error:", error.message);
  }
  
  // Check new ImpactProductNFT
  console.log("\nNEW ImpactProductNFT:", impactNew);
  try {
    const ImpactNew = await ethers.getContractAt("ImpactProductNFT", impactNew);
    console.log("  ✅ Contract exists");
  } catch (error) {
    console.log("  ❌ Error:", error.message);
  }
  
  console.log("\n=== Recommendation ===");
  console.log("If OLD contracts have data, update .env.local to use OLD addresses");
  console.log("If you want fresh start, use NEW contracts (they will be empty)");
}

main().then(() => process.exit(0)).catch(console.error);
