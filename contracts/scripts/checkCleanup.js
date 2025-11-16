const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const cleanupId = 1;
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  console.log("=== Checking Cleanup Status ===");
  console.log("Contract:", contractAddress);
  console.log("Cleanup ID:", cleanupId);
  
  try {
    const status = await contract.getCleanupStatus(cleanupId);
    console.log("\nCleanup Status:");
    console.log("  User:", status.user);
    console.log("  Verified:", status.verified);
    console.log("  Claimed:", status.claimed);
    console.log("  Level:", status.level);
    
    if (status.user === "0x0000000000000000000000000000000000000000") {
      console.log("\n❌ ERROR: Cleanup does not exist!");
    } else if (status.verified) {
      console.log("\n⚠️  WARNING: Cleanup is already verified!");
    } else {
      console.log("\n✅ Cleanup exists and is not verified - ready to verify");
    }
  } catch (error) {
    console.error("Error checking cleanup:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
