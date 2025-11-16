const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7"; // OLD contract with data
  const impactAddress = "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1"; // OLD contract
  
  console.log("=== Checking OLD Contracts (with data) ===\n");
  
  const Verification = await ethers.getContractAt("VerificationContract", verificationAddress);
  const counter = await Verification.cleanupCounter();
  console.log("VerificationContract:", verificationAddress);
  console.log("Cleanup Counter:", counter.toString());
  
  // Check each cleanup
  for (let i = 1; i < Number(counter); i++) {
    try {
      const cleanup = await Verification.getCleanup(i);
      if (cleanup.user !== "0x0000000000000000000000000000000000000000") {
        console.log(`\nCleanup ${i}:`);
        console.log("  User:", cleanup.user);
        console.log("  Verified:", cleanup.verified);
        console.log("  Claimed:", cleanup.claimed);
        console.log("  Level:", cleanup.level.toString());
        console.log("  Rejected:", cleanup.rejected || false);
      }
    } catch (error) {
      console.log(`Cleanup ${i}: Error - ${error.message}`);
    }
  }
  
  // Check ImpactProductNFT
  console.log("\n=== ImpactProductNFT ===");
  console.log("Address:", impactAddress);
  try {
    const Impact = await ethers.getContractAt("ImpactProductNFT", impactAddress);
    const verificationContractInNFT = await Impact.verificationContract();
    console.log("Linked VerificationContract:", verificationContractInNFT);
    if (verificationContractInNFT.toLowerCase() !== verificationAddress.toLowerCase()) {
      console.log("⚠️  WARNING: ImpactProductNFT is NOT linked to this VerificationContract!");
      console.log("   This will cause claim transactions to fail!");
    } else {
      console.log("✅ ImpactProductNFT is correctly linked");
    }
  } catch (error) {
    console.log("Error:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
