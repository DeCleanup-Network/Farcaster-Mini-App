const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  
  console.log("=== Checking Cleanup in NEW Contract ===\n");
  
  const Verification = await ethers.getContractAt("VerificationContract", verificationAddress);
  const counter = await Verification.cleanupCounter();
  console.log("Cleanup Counter:", counter.toString());
  console.log("Number of cleanups:", Number(counter) - 1);
  console.log();
  
  // Check cleanup 1
  try {
    const cleanup = await Verification.getCleanup(1);
    if (cleanup.user !== "0x0000000000000000000000000000000000000000") {
      console.log("Cleanup 1 Details:");
      console.log("  User:", cleanup.user);
      console.log("  Verified:", cleanup.verified);
      console.log("  Claimed:", cleanup.claimed);
      console.log("  Rejected:", cleanup.rejected || false);
      console.log("  Level:", cleanup.level.toString());
      console.log("  Has Impact Form:", cleanup.hasImpactForm);
      console.log("\n  CeloScan (search for transactions from this user):");
      console.log("  https://sepolia.celoscan.io/address/" + cleanup.user);
    } else {
      console.log("Cleanup 1 does not exist (zero address)");
    }
  } catch (error) {
    console.log("Error getting cleanup 1:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
