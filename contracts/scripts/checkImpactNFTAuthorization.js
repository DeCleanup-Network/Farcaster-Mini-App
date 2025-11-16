const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const impactNFTAddress = "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1";
  
  console.log("=== Checking ImpactProductNFT Authorization ===\n");
  
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactNFT = ImpactProductNFT.attach(impactNFTAddress);
  
  // Check verifier (old single verifier)
  try {
    const verifier = await impactNFT.verifier();
    console.log("Verifier (old):", verifier);
    console.log("Matches VerificationContract:", verifier.toLowerCase() === verificationAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  } catch (error) {
    console.log("verifier() function not found (contract may use allowlist)");
  }
  
  // Check if contract has verifiers mapping
  try {
    const isVerifier = await impactNFT.verifiers(verificationAddress);
    console.log("Is VerificationContract in verifiers mapping:", isVerifier ? "✅ YES" : "❌ NO");
  } catch (error) {
    console.log("verifiers mapping not found");
  }
  
  // Check owner
  const owner = await impactNFT.owner();
  console.log("Owner:", owner);
  
  // Check rewardDistributor
  const rewardDistributor = await impactNFT.rewardDistributor();
  console.log("RewardDistributor:", rewardDistributor);
  
  // Read the contract code to understand authorization
  console.log("\n=== Checking claimLevel function authorization ===");
  console.log("The claimLevel function should allow VerificationContract to call it.");
}

main().then(() => process.exit(0)).catch(console.error);
