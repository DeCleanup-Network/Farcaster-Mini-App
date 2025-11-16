const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  const impactNFTAddress = "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  const userAddress = "0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84";
  const cleanupId = 1;
  
  console.log("=== Simulating Claim Transaction ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);
  console.log("User address:", userAddress);
  console.log("Match:", signer.address.toLowerCase() === userAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  if (signer.address.toLowerCase() !== userAddress.toLowerCase()) {
    console.log("\n⚠️  Signer doesn't match user. Using signer to simulate...");
  }
  
  const Verification = await ethers.getContractAt("VerificationContract", verificationAddress);
  const ImpactNFT = await ethers.getContractAt("ImpactProductNFT", impactNFTAddress);
  
  // Check cleanup first
  const cleanup = await Verification.getCleanup(cleanupId);
  console.log("\nCleanup Status:");
  console.log("  User:", cleanup.user);
  console.log("  Verified:", cleanup.verified);
  console.log("  Claimed:", cleanup.claimed);
  console.log("  Level:", cleanup.level.toString());
  
  // Try to simulate the call
  console.log("\n=== Simulating claimImpactProduct ===");
  try {
    // Use staticCall to simulate without actually executing
    await Verification.claimImpactProduct.staticCall(cleanupId);
    console.log("✅ Simulation passed - claim should work!");
  } catch (error) {
    console.log("❌ Simulation failed:");
    console.log("   Error:", error.message);
    console.log("   Short message:", error.shortMessage || "N/A");
    
    // Check if it's the authorization error
    if (error.message.includes("Not authorized") || error.message.includes("Not your cleanup")) {
      console.log("\n   This is the same error as the transaction!");
      console.log("   The issue is in the claim function.");
    }
  }
  
  // Check if we can call claimLevelForUser directly
  console.log("\n=== Checking if VerificationContract can call claimLevelForUser ===");
  try {
    const verificationContractInNFT = await ImpactNFT.verificationContract();
    console.log("VerificationContract in NFT:", verificationContractInNFT);
    console.log("Matches:", verificationContractInNFT.toLowerCase() === verificationAddress.toLowerCase() ? "✅ YES" : "❌ NO");
    
    // Try to simulate the call from VerificationContract's perspective
    const ImpactNFTAsVerification = ImpactNFT.connect(await ethers.getImpersonatedSigner(verificationAddress));
    // Actually, we can't impersonate easily. Let's just check the authorization logic
    console.log("\nAuthorization check:");
    console.log("  When VerificationContract calls claimLevelForUser:");
    console.log("  msg.sender =", verificationAddress);
    console.log("  verificationContract in NFT =", verificationContractInNFT);
    console.log("  Match:", verificationContractInNFT.toLowerCase() === verificationAddress.toLowerCase() ? "✅ Should pass" : "❌ Will fail");
  } catch (error) {
    console.log("Error:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
