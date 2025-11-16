const { ethers } = require("hardhat");

async function main() {
  const newContractAddress = "0x3C92d06c1657c1E5E550cAb399ff8Fb9f8a5f8fc";
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(newContractAddress);
  
  console.log("=== Checking New Contract ===");
  console.log("Contract:", newContractAddress);
  
  const counter = await contract.cleanupCounter();
  console.log("Cleanup counter:", counter.toString());
  
  // Try to get cleanup 1
  try {
    const cleanup1 = await contract.getCleanup(1);
    console.log("\nCleanup 1 exists:");
    console.log("  User:", cleanup1.user);
    console.log("  Verified:", cleanup1.verified);
    if (cleanup1.user === "0x0000000000000000000000000000000000000000") {
      console.log("  → Cleanup 1 does NOT exist (zero address)");
    } else {
      console.log("  → Cleanup 1 EXISTS");
    }
  } catch (error) {
    console.log("\nCleanup 1:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
