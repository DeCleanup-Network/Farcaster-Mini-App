const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0x3C92d06c1657c1E5E550cAb399ff8Fb9f8a5f8fc";
  const verifierAddress = "0x7d85fcbb505d48e6176483733b62b51704e0bf95";
  
  console.log("=== Checking Verifier Status ===");
  console.log("Contract:", contractAddress);
  console.log("Verifier:", verifierAddress);
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  // Check owner
  const owner = await contract.owner();
  console.log("\nContract owner:", owner);
  
  // Check if verifier is authorized
  const isVerifier = await contract.isVerifier(verifierAddress);
  console.log("Is verifier:", isVerifier);
  
  // Check cleanup counter
  const counter = await contract.cleanupCounter();
  console.log("Cleanup counter:", counter.toString());
  
  // Check if there are any cleanups
  if (counter > BigInt(1)) {
    const cleanupId = BigInt(1);
    try {
      const cleanup = await contract.getCleanup(cleanupId);
      console.log("\nCleanup 1 details:");
      console.log("  User:", cleanup.user);
      console.log("  Verified:", cleanup.verified);
      console.log("  Level:", cleanup.level);
      console.log("  Has impact form:", cleanup.hasImpactForm);
      
      // Check if verifier can verify
      if (cleanup.user === "0x0000000000000000000000000000000000000000") {
        console.log("\n❌ Cleanup 1 does not exist");
      } else if (cleanup.verified) {
        console.log("\n⚠️  Cleanup 1 is already verified");
      } else {
        console.log("\n✅ Cleanup 1 exists and is pending verification");
        console.log("   Verifier can verify:", isVerifier);
        console.log("   Verifier is owner:", owner.toLowerCase() === verifierAddress.toLowerCase());
      }
    } catch (error) {
      console.log("\nError getting cleanup 1:", error.message);
    }
  } else {
    console.log("\n⚠️  No cleanups exist yet (counter = 1)");
  }
}

main().then(() => process.exit(0)).catch(console.error);
