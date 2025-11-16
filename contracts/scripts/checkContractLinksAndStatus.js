const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  const impactNFTAddress = process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS || "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  const rewardDistributorAddress = process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS || "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  
  console.log("=== Current Contracts in Use ===\n");
  
  console.log("1. VerificationContract:");
  console.log("   Address:", verificationAddress);
  console.log("   CeloScan: https://sepolia.celoscan.io/address/" + verificationAddress);
  
  console.log("\n2. ImpactProductNFT:");
  console.log("   Address:", impactNFTAddress);
  console.log("   CeloScan: https://sepolia.celoscan.io/address/" + impactNFTAddress);
  
  console.log("\n3. RewardDistributor:");
  console.log("   Address:", rewardDistributorAddress);
  console.log("   CeloScan: https://sepolia.celoscan.io/address/" + rewardDistributorAddress);
  
  console.log("\n=== Checking Contract Links ===\n");
  
  try {
    const [signer] = await ethers.getSigners();
    
    // Check VerificationContract -> ImpactProductNFT
    const Verification = await ethers.getContractAt("VerificationContract", verificationAddress);
    const impactInVerif = await Verification.impactProductNFT();
    console.log("VerificationContract -> ImpactProductNFT:");
    console.log("  Linked to:", impactInVerif);
    console.log("  ✅ Matches:", impactInVerif.toLowerCase() === impactNFTAddress.toLowerCase() ? "YES" : "❌ NO");
    
    // Check ImpactProductNFT -> VerificationContract
    const ImpactNFT = await ethers.getContractAt("ImpactProductNFT", impactNFTAddress);
    const verifInImpact = await ImpactNFT.verificationContract();
    console.log("\nImpactProductNFT -> VerificationContract:");
    console.log("  Linked to:", verifInImpact);
    console.log("  ✅ Matches:", verifInImpact.toLowerCase() === verificationAddress.toLowerCase() ? "YES" : "❌ NO");
    
    // Check ImpactProductNFT -> RewardDistributor
    const rewardInImpact = await ImpactNFT.rewardDistributor();
    console.log("\nImpactProductNFT -> RewardDistributor:");
    console.log("  Linked to:", rewardInImpact);
    console.log("  ✅ Matches:", rewardInImpact.toLowerCase() === rewardDistributorAddress.toLowerCase() ? "YES" : "❌ NO");
    
    // Check VerificationContract -> RewardDistributor
    const rewardInVerif = await Verification.rewardDistributor();
    console.log("\nVerificationContract -> RewardDistributor:");
    console.log("  Linked to:", rewardInVerif);
    console.log("  ✅ Matches:", rewardInVerif.toLowerCase() === rewardDistributorAddress.toLowerCase() ? "YES" : "❌ NO");
    
    // Check if VerificationContract is authorized in RewardDistributor
    console.log("\n=== Authorization Check ===");
    const RewardDistributor = await ethers.getContractAt("RewardDistributor", rewardDistributorAddress);
    try {
      const isAuthorized = await RewardDistributor.verifiers(verificationAddress);
      console.log("VerificationContract authorized in RewardDistributor:", isAuthorized ? "✅ YES" : "❌ NO");
      if (!isAuthorized) {
        console.log("\n⚠️  WARNING: VerificationContract is NOT authorized in RewardDistributor!");
        console.log("   This will cause verification transactions to fail.");
        console.log("   Run: npx hardhat run scripts/addVerificationContractAsVerifier.js --network sepolia");
      }
    } catch (error) {
      console.log("Could not check authorization:", error.message);
    }
    
    // Check cleanup counter
    console.log("\n=== Contract Status ===");
    const counter = await Verification.cleanupCounter();
    console.log("Cleanup Counter:", counter.toString());
    console.log("Number of cleanups:", counter > 0 ? Number(counter) - 1 : 0);
    
  } catch (error) {
    console.error("Error checking contracts:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
