const { ethers } = require("hardhat");

/**
 * Fix VerificationContract Links
 * 
 * Updates the RewardDistributor and ImpactProductNFT addresses in VerificationContract
 * to match the correct deployed contracts.
 * 
 * Usage:
 *   npx hardhat run scripts/fixVerificationContractLinks.js --network sepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  const verificationAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const correctRewardDistributor = process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS || "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  const correctImpactNFT = process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS || "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1";

  console.log("\n=== Fixing VerificationContract Links ===");
  console.log("VerificationContract:", verificationAddress);
  console.log("Correct RewardDistributor:", correctRewardDistributor);
  console.log("Correct ImpactProductNFT:", correctImpactNFT);
  console.log("==========================================\n");

  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verification = VerificationContract.attach(verificationAddress);

  // Check if deployer is owner
  const owner = await verification.owner();
  if (deployer.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(
      `Deployer (${deployer.address}) is not the owner of VerificationContract.\n` +
      `Owner is: ${owner}\n` +
      `You need to use the owner's private key to update contract links.`
    );
  }

  // Check current values
  const currentRD = await verification.rewardDistributor();
  const currentNFT = await verification.impactProductNFT();

  console.log("Current values:");
  console.log("  RewardDistributor:", currentRD);
  console.log("  ImpactProductNFT:", currentNFT);
  console.log();

  // Update RewardDistributor if needed
  if (currentRD.toLowerCase() !== correctRewardDistributor.toLowerCase()) {
    console.log("Updating RewardDistributor address...");
    const tx1 = await verification.setRewardDistributor(correctRewardDistributor);
    console.log("Transaction sent:", tx1.hash);
    const receipt1 = await tx1.wait();
    console.log("✓ Transaction confirmed in block:", receipt1.blockNumber);
    
    // Verify
    const updatedRD = await verification.rewardDistributor();
    if (updatedRD.toLowerCase() === correctRewardDistributor.toLowerCase()) {
      console.log("✅ RewardDistributor address updated successfully!");
    } else {
      console.log("❌ Failed to update RewardDistributor address");
    }
  } else {
    console.log("✓ RewardDistributor address is already correct");
  }

  // Update ImpactProductNFT if needed
  if (currentNFT.toLowerCase() !== correctImpactNFT.toLowerCase()) {
    console.log("\nUpdating ImpactProductNFT address...");
    const tx2 = await verification.setImpactProductNFT(correctImpactNFT);
    console.log("Transaction sent:", tx2.hash);
    const receipt2 = await tx2.wait();
    console.log("✓ Transaction confirmed in block:", receipt2.blockNumber);
    
    // Verify
    const updatedNFT = await verification.impactProductNFT();
    if (updatedNFT.toLowerCase() === correctImpactNFT.toLowerCase()) {
      console.log("✅ ImpactProductNFT address updated successfully!");
    } else {
      console.log("❌ Failed to update ImpactProductNFT address");
    }
  } else {
    console.log("\n✓ ImpactProductNFT address is already correct");
  }

  // Final verification
  console.log("\n=== Final Verification ===");
  const finalRD = await verification.rewardDistributor();
  const finalNFT = await verification.impactProductNFT();
  
  const rdCorrect = finalRD.toLowerCase() === correctRewardDistributor.toLowerCase();
  const nftCorrect = finalNFT.toLowerCase() === correctImpactNFT.toLowerCase();
  
  console.log("RewardDistributor:", rdCorrect ? "✅ CORRECT" : "❌ WRONG");
  console.log("ImpactProductNFT:", nftCorrect ? "✅ CORRECT" : "❌ WRONG");
  
  if (rdCorrect && nftCorrect) {
    console.log("\n🎉 All contract links are now correct!");
    console.log("   Verification transactions should work now.");
  } else {
    console.log("\n⚠️  Some links are still incorrect. Check the transactions above.");
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
