const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const impactNFTAddress = "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1";
  const userAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const cleanupId = 1;
  
  console.log("=== Testing Claim Flow ===\n");
  
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactNFT = ImpactProductNFT.attach(impactNFTAddress);
  
  // Check current verifier
  const verifier = await impactNFT.verifier();
  console.log("ImpactProductNFT verifier:", verifier);
  console.log("VerificationContract address:", verificationAddress);
  console.log("Match:", verifier.toLowerCase() === verificationAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  // The problem: claimLevel uses msg.sender as user
  // When VerificationContract calls it, msg.sender = VerificationContract, not the user!
  console.log("\n⚠️  PROBLEM IDENTIFIED:");
  console.log("   claimLevel() uses msg.sender as the user address.");
  console.log("   When VerificationContract calls impactProductNFT.claimLevel(),");
  console.log("   msg.sender in ImpactProductNFT = VerificationContract address,");
  console.log("   not the actual user address!");
  console.log("\n   This means the NFT would be minted to VerificationContract,");
  console.log("   not to the user who submitted the cleanup.");
  
  console.log("\nSolution: Update ImpactProductNFT.claimLevel() to accept a user parameter,");
  console.log("         or change it to allow VerificationContract to call it on behalf of users.");
}

main().then(() => process.exit(0)).catch(console.error);
