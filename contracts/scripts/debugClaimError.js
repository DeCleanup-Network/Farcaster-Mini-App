const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  const impactNFTAddress = "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  const userAddress = "0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84";
  const cleanupId = 1;
  
  console.log("=== Debugging Claim Error ===\n");
  console.log("Transaction Hash: 0x6a89a51f8491b510d83a8209793ca3a42e4655668e7560a41c10839473b5908d");
  console.log("Error: Not authorized\n");
  
  const Verification = await ethers.getContractAt("VerificationContract", verificationAddress);
  const ImpactNFT = await ethers.getContractAt("ImpactProductNFT", impactNFTAddress);
  
  // Check cleanup
  console.log("1. Checking Cleanup:");
  const cleanup = await Verification.getCleanup(cleanupId);
  console.log("   User:", cleanup.user);
  console.log("   Matches claimer:", cleanup.user.toLowerCase() === userAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  console.log("   Verified:", cleanup.verified);
  console.log("   Claimed:", cleanup.claimed);
  console.log("   Level:", cleanup.level.toString());
  
  // Check ImpactProductNFT authorization
  console.log("\n2. Checking ImpactProductNFT Authorization:");
  const verificationContractInNFT = await ImpactNFT.verificationContract();
  console.log("   VerificationContract in ImpactProductNFT:", verificationContractInNFT);
  console.log("   Matches:", verificationContractInNFT.toLowerCase() === verificationAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  if (verificationContractInNFT.toLowerCase() !== verificationAddress.toLowerCase()) {
    console.log("\n❌ PROBLEM FOUND!");
    console.log("   ImpactProductNFT is NOT linked to VerificationContract!");
    console.log("   When VerificationContract calls claimLevelForUser(),");
    console.log("   ImpactProductNFT checks: msg.sender == verificationContract");
    console.log("   But verificationContract is set to:", verificationContractInNFT);
    console.log("   And VerificationContract address is:", verificationAddress);
    console.log("\n   SOLUTION: Link them together!");
  }
  
  // Check if user already has NFT
  console.log("\n3. Checking User's NFT Status:");
  try {
    const tokenId = await ImpactNFT.userTokenId(userAddress);
    console.log("   User's token ID:", tokenId.toString());
    if (tokenId > 0) {
      const level = await ImpactNFT.userCurrentLevel(userAddress);
      console.log("   User's current level:", level.toString());
      console.log("   Assigned level:", cleanup.level.toString());
      if (Number(cleanup.level) <= Number(level)) {
        console.log("   ⚠️  Level must be higher than current!");
      }
    } else {
      console.log("   User has no NFT yet (will mint new one)");
    }
  } catch (error) {
    console.log("   Error:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
