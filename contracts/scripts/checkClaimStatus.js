const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const userAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const cleanupId = 1;
  
  console.log("=== Checking Claim Status ===\n");
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verification = VerificationContract.attach(verificationAddress);
  
  // Check cleanup status
  const cleanup = await verification.getCleanup(cleanupId);
  console.log("Cleanup Status:");
  console.log("  User:", cleanup.user);
  console.log("  Verified:", cleanup.verified);
  console.log("  Claimed:", cleanup.claimed);
  console.log("  Level:", cleanup.level.toString());
  
  // Check if user can claim
  if (cleanup.user.toLowerCase() !== userAddress.toLowerCase()) {
    console.log("\n❌ Cleanup belongs to different user");
    return;
  }
  
  if (!cleanup.verified) {
    console.log("\n❌ Cleanup is not verified yet");
    return;
  }
  
  if (cleanup.claimed) {
    console.log("\n⚠️  Cleanup is already claimed");
    return;
  }
  
  console.log("\n✅ Cleanup is verified and ready to claim");
  console.log("   Level to claim:", cleanup.level.toString());
  
  // Check ImpactProductNFT
  const impactNFTAddress = await verification.impactProductNFT();
  console.log("\nImpactProductNFT address:", impactNFTAddress);
  
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactNFT = ImpactProductNFT.attach(impactNFTAddress);
  
  // Check user's current level
  try {
    const userLevel = await impactNFT.getUserLevel(userAddress);
    console.log("User's current level:", userLevel.toString());
  } catch (error) {
    console.log("User's current level: 0 (no NFT yet)");
  }
  
  // Check if VerificationContract can call claimLevel
  const verificationCanCall = await impactNFT.verifiers(verificationAddress);
  console.log("\nIs VerificationContract authorized in ImpactProductNFT:", verificationCanCall ? "✅ YES" : "❌ NO");
  
  if (!verificationCanCall) {
    console.log("\n⚠️  PROBLEM: VerificationContract is not authorized to call claimLevel!");
    console.log("   This will prevent users from claiming their levels.");
  }
}

main().then(() => process.exit(0)).catch(console.error);
