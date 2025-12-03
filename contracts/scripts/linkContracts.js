const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== Linking Contracts ===\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Linking with account:", deployer.address);
  
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
  
  // Link 1: Set VerificationContract in ImpactProductNFT
  console.log("1. Setting VerificationContract in ImpactProductNFT...");
  const ImpactProductNFT = await ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
  try {
    const tx1 = await ImpactProductNFT.setVerificationContract(VERIFICATION_ADDRESS);
    await tx1.wait();
    console.log("   ✅ Linked");
  } catch (error) {
    console.log("   ⚠️  Error:", error.message);
  }
  
  // Link 2: Set RewardDistributor in ImpactProductNFT
  console.log("2. Setting RewardDistributor in ImpactProductNFT...");
  try {
    const tx2 = await ImpactProductNFT.setRewardDistributor(REWARD_DISTRIBUTOR_ADDRESS);
    await tx2.wait();
    console.log("   ✅ Linked");
  } catch (error) {
    console.log("   ⚠️  Error:", error.message);
  }
  
  // Link 3: Set VerificationContract in RewardDistributor
  console.log("3. Setting VerificationContract in RewardDistributor...");
  const RewardDistributor = await ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
  try {
    const tx3 = await RewardDistributor.setVerificationContract(VERIFICATION_ADDRESS);
    await tx3.wait();
    console.log("   ✅ Linked");
  } catch (error) {
    console.log("   ⚠️  Error:", error.message);
  }
  
  // Link 4: Set ImpactProductNFT in RewardDistributor (if needed)
  console.log("4. Setting ImpactProductNFT in RewardDistributor...");
  try {
    const tx4 = await RewardDistributor.setImpactProductNFT(IMPACT_PRODUCT_ADDRESS);
    await tx4.wait();
    console.log("   ✅ Linked");
  } catch (error) {
    console.log("   ⚠️  Error (may not have this function):", error.message);
  }
  
  console.log("");
  console.log("=== Linking Complete ===");
  console.log("Run checkContractLinks.js to verify all links are correct.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

