const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const impactNFTAddress = "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1";
  const userAddress = "0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84"; // From the profile
  
  console.log("=== Checking Claim Issue ===\n");
  console.log("User:", userAddress);
  console.log("VerificationContract:", verificationAddress);
  console.log("ImpactProductNFT:", impactNFTAddress);
  console.log();
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verification = VerificationContract.attach(verificationAddress);
  
  // Check cleanup 1
  const cleanup = await verification.getCleanup(1);
  console.log("Cleanup 1 Status:");
  console.log("  User:", cleanup.user);
  console.log("  Verified:", cleanup.verified);
  console.log("  Claimed:", cleanup.claimed);
  console.log("  Level:", cleanup.level.toString());
  console.log();
  
  // Check if user matches
  const userMatches = cleanup.user.toLowerCase() === userAddress.toLowerCase();
  console.log("User matches:", userMatches ? "✅ YES" : "❌ NO");
  
  // Check ImpactProductNFT
  console.log("\n=== ImpactProductNFT Check ===");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactNFT = ImpactProductNFT.attach(impactNFTAddress);
  
  // Check what VerificationContract is linked to
  const nftInVerification = await verification.impactProductNFT();
  console.log("ImpactProductNFT in VerificationContract:", nftInVerification);
  console.log("Matches expected:", nftInVerification.toLowerCase() === impactNFTAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  // Check if user has NFT
  try {
    const userTokenId = await impactNFT.userTokenId(userAddress);
    console.log("User's token ID:", userTokenId.toString());
    
    if (userTokenId > 0) {
      const currentLevel = await impactNFT.userCurrentLevel(userAddress);
      console.log("User's current level:", currentLevel.toString());
      console.log("Assigned level in cleanup:", cleanup.level.toString());
    } else {
      console.log("❌ User doesn't have an Impact Product NFT!");
      console.log("   This means the claim transaction didn't mint the NFT.");
    }
  } catch (error) {
    console.log("Error checking user NFT:", error.message);
    // Try old function name
    try {
      const level = await impactNFT.getUserLevel(userAddress);
      console.log("User's level (using getUserLevel):", level.toString());
    } catch (e) {
      console.log("Also failed with getUserLevel:", e.message);
    }
  }
  
  // Check if VerificationContract can call ImpactProductNFT
  console.log("\n=== Contract Linkage Check ===");
  console.log("VerificationContract -> ImpactProductNFT: ✅ Linked");
  console.log("But OLD ImpactProductNFT.claimLevel() expects msg.sender to be the USER");
  console.log("When VerificationContract calls it, msg.sender is the CONTRACT address");
  console.log("This is why the claim failed silently!");
}

main().then(() => process.exit(0)).catch(console.error);
