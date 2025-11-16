const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0x3C92d06c1657c1E5E550cAb399ff8Fb9f8a5f8fc";
  const verifierAddress = "0x7d85fcbb505d48e6176483733b62b51704e0bf95";
  const cleanupId = 1;
  const level = 1;
  
  console.log("=== Testing Verification ===");
  console.log("Contract:", contractAddress);
  console.log("Verifier:", verifierAddress);
  console.log("Cleanup ID:", cleanupId);
  console.log("Level:", level);
  
  // Get signer (the verifier)
  const [signer] = await ethers.getSigners();
  console.log("\nUsing signer:", signer.address);
  console.log("Signer balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "CELO");
  
  // Check if signer is the verifier
  if (signer.address.toLowerCase() !== verifierAddress.toLowerCase()) {
    console.log("\n⚠️  WARNING: Signer address doesn't match verifier address!");
    console.log("   Signer:", signer.address);
    console.log("   Verifier:", verifierAddress);
    console.log("   You need to use the verifier's private key to sign the transaction");
  }
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress).connect(signer);
  
  // Check authorization
  const isVerifier = await contract.isVerifier(signer.address);
  console.log("\nIs signer a verifier:", isVerifier);
  
  if (!isVerifier) {
    console.log("❌ Signer is not authorized as verifier!");
    return
  }
  
  // Check cleanup status
  const cleanup = await contract.getCleanup(cleanupId);
  console.log("\nCleanup status:");
  console.log("  User:", cleanup.user);
  console.log("  Verified:", cleanup.verified);
  console.log("  Level:", cleanup.level);
  console.log("  Has impact form:", cleanup.hasImpactForm);
  
  if (cleanup.verified) {
    console.log("\n⚠️  Cleanup is already verified!");
    return
  }
  
  // Try to verify
  console.log("\nAttempting to verify cleanup...");
  try {
    const tx = await contract.verifyCleanup(cleanupId, level);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Verification successful!");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());
    
    // Check status after
    const updatedCleanup = await contract.getCleanup(cleanupId);
    console.log("\nUpdated cleanup status:");
    console.log("  Verified:", updatedCleanup.verified);
    console.log("  Level:", updatedCleanup.level);
  } catch (error) {
    console.error("\n❌ Verification failed:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.reason) {
      console.error("Error reason:", error.reason);
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
