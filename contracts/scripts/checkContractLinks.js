const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== Checking Contract Links ===\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Checking with account:", deployer.address);
  
  // Get addresses from env
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  const REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS;
  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;
  
  if (!IMPACT_PRODUCT_ADDRESS || !REWARD_DISTRIBUTOR_ADDRESS || !VERIFICATION_ADDRESS) {
    throw new Error("Missing contract addresses in .env");
  }
  
  console.log("Contract Addresses:");
  console.log("  ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("  RewardDistributor:", REWARD_DISTRIBUTOR_ADDRESS);
  console.log("  VerificationContract:", VERIFICATION_ADDRESS);
  console.log("");
  
  // Check ImpactProductNFT links
  console.log("Checking ImpactProductNFT...");
  const ImpactProductNFT = await ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
  const impactVerificationContract = await ImpactProductNFT.verificationContract();
  const impactRewardDistributor = await ImpactProductNFT.rewardDistributor();
  console.log("  verificationContract:", impactVerificationContract);
  console.log("  rewardDistributor:", impactRewardDistributor);
  console.log("  ✅ Expected verificationContract:", VERIFICATION_ADDRESS);
  console.log("  ✅ Expected rewardDistributor:", REWARD_DISTRIBUTOR_ADDRESS);
  console.log("  Match:", impactVerificationContract.toLowerCase() === VERIFICATION_ADDRESS.toLowerCase() ? "✅" : "❌");
  console.log("  Match:", impactRewardDistributor.toLowerCase() === REWARD_DISTRIBUTOR_ADDRESS.toLowerCase() ? "✅" : "❌");
  console.log("");
  
  // Check RewardDistributor links
  console.log("Checking RewardDistributor...");
  const RewardDistributor = await ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
  const rewardVerificationContract = await RewardDistributor.verificationContract();
  const rewardImpactProductNFT = await RewardDistributor.impactProductNFT();
  console.log("  verificationContract:", rewardVerificationContract);
  console.log("  impactProductNFT:", rewardImpactProductNFT);
  console.log("  ✅ Expected verificationContract:", VERIFICATION_ADDRESS);
  console.log("  ✅ Expected impactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("  Match:", rewardVerificationContract.toLowerCase() === VERIFICATION_ADDRESS.toLowerCase() ? "✅" : "❌");
  console.log("  Match:", rewardImpactProductNFT.toLowerCase() === IMPACT_PRODUCT_ADDRESS.toLowerCase() ? "✅" : "❌");
  console.log("");
  
  // Check VerificationContract links
  console.log("Checking VerificationContract...");
  const VerificationContract = await ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);
  const verificationImpactProductNFT = await VerificationContract.impactProductNFT();
  const verificationRewardDistributor = await VerificationContract.rewardDistributor();
  console.log("  impactProductNFT:", verificationImpactProductNFT);
  console.log("  rewardDistributor:", verificationRewardDistributor);
  console.log("  ✅ Expected impactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("  ✅ Expected rewardDistributor:", REWARD_DISTRIBUTOR_ADDRESS);
  console.log("  Match:", verificationImpactProductNFT.toLowerCase() === IMPACT_PRODUCT_ADDRESS.toLowerCase() ? "✅" : "❌");
  console.log("  Match:", verificationRewardDistributor.toLowerCase() === REWARD_DISTRIBUTOR_ADDRESS.toLowerCase() ? "✅" : "❌");
  console.log("");
  
  // Summary
  console.log("=== Summary ===");
  const allLinked = 
    impactVerificationContract.toLowerCase() === VERIFICATION_ADDRESS.toLowerCase() &&
    impactRewardDistributor.toLowerCase() === REWARD_DISTRIBUTOR_ADDRESS.toLowerCase() &&
    rewardVerificationContract.toLowerCase() === VERIFICATION_ADDRESS.toLowerCase() &&
    rewardImpactProductNFT.toLowerCase() === IMPACT_PRODUCT_ADDRESS.toLowerCase() &&
    verificationImpactProductNFT.toLowerCase() === IMPACT_PRODUCT_ADDRESS.toLowerCase() &&
    verificationRewardDistributor.toLowerCase() === REWARD_DISTRIBUTOR_ADDRESS.toLowerCase();
  
  if (allLinked) {
    console.log("✅ All contracts are properly linked!");
  } else {
    console.log("❌ Some contracts are not properly linked. Run the link script to fix.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

