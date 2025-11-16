const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0x3C92d06c1657c1E5E550cAb399ff8Fb9f8a5f8fc";
  const rewardDistributorAddress = "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  
  console.log("=== Checking RewardDistributor Setup ===");
  console.log("VerificationContract:", verificationAddress);
  console.log("RewardDistributor:", rewardDistributorAddress);
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  
  const verification = VerificationContract.attach(verificationAddress);
  const rewardDistributor = RewardDistributor.attach(rewardDistributorAddress);
  
  // Check if RewardDistributor is set in VerificationContract
  const setRewardDistributor = await verification.rewardDistributor();
  console.log("\nRewardDistributor in VerificationContract:", setRewardDistributor);
  console.log("Matches:", setRewardDistributor.toLowerCase() === rewardDistributorAddress.toLowerCase());
  
  // Check ImpactProductNFT
  const impactProductNFT = await verification.impactProductNFT();
  console.log("\nImpactProductNFT in VerificationContract:", impactProductNFT);
  
  // Check if ImpactProductNFT has RewardDistributor set
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const nft = ImpactProductNFT.attach(impactProductNFT);
  const nftRewardDistributor = await nft.rewardDistributor();
  console.log("RewardDistributor in ImpactProductNFT:", nftRewardDistributor);
  console.log("Matches:", nftRewardDistributor.toLowerCase() === rewardDistributorAddress.toLowerCase());
  
  // Check cleanup 1
  const cleanup = await verification.getCleanup(1);
  console.log("\nCleanup 1:");
  console.log("  User:", cleanup.user);
  console.log("  Verified:", cleanup.verified);
  console.log("  Has impact form:", cleanup.hasImpactForm);
  console.log("  Referrer:", cleanup.referrer);
  
  if (cleanup.user !== "0x0000000000000000000000000000000000000000") {
    // Check user's level
    try {
      const userLevel = await nft.getUserLevel(cleanup.user);
      console.log("  User's current level:", userLevel.toString());
    } catch (error) {
      console.log("  User's current level: 0 (no NFT yet)");
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
