const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔄 Switching contracts to use bDCU Reward Distributor (token system)...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Updating with account:", deployer.address);
  console.log("");

  // Get addresses from environment or deployment files
  const fs = require("fs");
  
  const BDCU_REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  
  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  // Try to load from deployment files
  let bdcuDistributorAddress = BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  if (!bdcuDistributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    bdcuDistributorAddress = deployment.address;
  }

  if (!bdcuDistributorAddress) {
    throw new Error("bDCU Reward Distributor address not found. Set BDCU_REWARD_DISTRIBUTOR_ADDRESS in .env or ensure deployment file exists.");
  }

  if (!IMPACT_PRODUCT_ADDRESS) {
    throw new Error("ImpactProductNFT address not found. Set IMPACT_PRODUCT_CONTRACT_ADDRESS in .env");
  }

  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found. Set VERIFICATION_CONTRACT_ADDRESS in .env");
  }

  console.log("Configuration:");
  console.log("  bDCU Reward Distributor:", bdcuDistributorAddress);
  console.log("  ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("  VerificationContract:", VERIFICATION_ADDRESS);
  console.log("");

  // Update ImpactProductNFT to use bDCURewardDistributor
  console.log("1. Updating ImpactProductNFT.rewardDistributor...");
  try {
    const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
    
    // Check current value
    try {
      const current = await ImpactProductNFT.rewardDistributor();
      console.log("   Current rewardDistributor:", current);
      if (current.toLowerCase() === bdcuDistributorAddress.toLowerCase()) {
        console.log("   ✅ Already set to bDCU Reward Distributor");
      } else {
        const tx1 = await ImpactProductNFT.setRewardDistributor(bdcuDistributorAddress);
        console.log("   Transaction hash:", tx1.hash);
        await tx1.wait();
        console.log("   ✅ ImpactProductNFT updated!");
      }
    } catch (error) {
      console.log("   ⚠️  Could not read current value, attempting to set anyway...");
      const tx1 = await ImpactProductNFT.setRewardDistributor(bdcuDistributorAddress);
      console.log("   Transaction hash:", tx1.hash);
      await tx1.wait();
      console.log("   ✅ ImpactProductNFT updated!");
    }
  } catch (error) {
    console.error("   ❌ Error updating ImpactProductNFT:", error.message);
    throw error;
  }
  console.log("");

  // Update VerificationContract to use bDCURewardDistributor
  // Note: VerificationContract uses RewardDistributor type, but bDCURewardDistributor has compatible interface
  console.log("2. Updating VerificationContract.rewardDistributor...");
  try {
    const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);
    
    // Check current value
    try {
      const current = await VerificationContract.rewardDistributor();
      console.log("   Current rewardDistributor:", current);
      if (current.toLowerCase() === bdcuDistributorAddress.toLowerCase()) {
        console.log("   ✅ Already set to bDCU Reward Distributor");
      } else {
        const tx2 = await VerificationContract.setRewardDistributor(bdcuDistributorAddress);
        console.log("   Transaction hash:", tx2.hash);
        await tx2.wait();
        console.log("   ✅ VerificationContract updated!");
      }
    } catch (error) {
      console.log("   ⚠️  Could not read current value, attempting to set anyway...");
      const tx2 = await VerificationContract.setRewardDistributor(bdcuDistributorAddress);
      console.log("   Transaction hash:", tx2.hash);
      await tx2.wait();
      console.log("   ✅ VerificationContract updated!");
    }
  } catch (error) {
    console.error("   ❌ Error updating VerificationContract:", error.message);
    throw error;
  }
  console.log("");

  console.log("=== Update Complete ===");
  console.log("");
  console.log("✅ Both contracts are now using bDCU Reward Distributor (token system)");
  console.log("   ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("   VerificationContract:", VERIFICATION_ADDRESS);
  console.log("   bDCU Reward Distributor:", bdcuDistributorAddress);
  console.log("");
  console.log("📝 Next steps:");
  console.log("   - Test claiming an Impact Product to verify tokens are distributed");
  console.log("   - Check that users receive $bDCU tokens (not just points)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

