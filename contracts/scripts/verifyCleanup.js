const { ethers } = require("hardhat");

/**
 * Verify a cleanup submission
 * 
 * Usage:
 *   CLEANUP_ID=2 npx hardhat run scripts/verifyCleanup.js --network sepolia
 */

async function main() {
  const verificationAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  const cleanupId = process.env.CLEANUP_ID || "2";
  
  console.log("=== Verifying Cleanup ===\n");
  console.log("VerificationContract:", verificationAddress);
  console.log("Cleanup ID:", cleanupId);
  console.log("Network: Celo Sepolia Testnet\n");
  
  try {
    const VerificationContract = await ethers.getContractFactory("VerificationContract");
    const verification = VerificationContract.attach(verificationAddress);
    
    // Check cleanup status first
    const cleanup = await verification.getCleanup(cleanupId);
    console.log("📋 Current Status:");
    console.log("   User:", cleanup.user);
    console.log("   Verified:", cleanup.verified ? "✅ YES" : "❌ NO");
    console.log("   Claimed:", cleanup.claimed ? "✅ YES" : "❌ NO");
    console.log("   Level:", cleanup.level.toString());
    console.log("   Rejected:", cleanup.rejected ? "❌ YES" : "✅ NO");
    console.log("");
    
    if (cleanup.verified) {
      console.log("✅ Cleanup is already verified!");
      return;
    }
    
    if (cleanup.rejected) {
      console.log("❌ Cleanup is rejected, cannot verify");
      return;
    }
    
    if (cleanup.user === ethers.ZeroAddress) {
      console.log("❌ Cleanup does not exist!");
      return;
    }
    
    // Get signer (must be a verifier)
    const [signer] = await ethers.getSigners();
    console.log("Verifier address:", signer.address);
    
    // Check if signer is a verifier
    const isVerifier = await verification.verifiers(signer.address);
    if (!isVerifier) {
      console.log("\n❌ Error: Your address is not a verifier!");
      console.log("   You need to be added to the verifier allowlist first.");
      return;
    }
    
    console.log("\n✅ You are a verifier, proceeding with verification...\n");
    
    // Verify the cleanup (assign level 2 for second cleanup)
    const level = 2; // Second cleanup = level 2
    console.log(`Verifying cleanup #${cleanupId} with level ${level}...`);
    
    const tx = await verification.verifyCleanup(cleanupId, level);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Verification confirmed!");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());
    
    // Check new status
    const updatedCleanup = await verification.getCleanup(cleanupId);
    console.log("\n📋 Updated Status:");
    console.log("   Verified:", updatedCleanup.verified ? "✅ YES" : "❌ NO");
    console.log("   Level:", updatedCleanup.level.toString());
    console.log("\n🎯 User can now claim level", updatedCleanup.level.toString(), "!");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

