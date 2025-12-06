const hre = require("hardhat");
require("dotenv").config();

/**
 * Verify All Contract Linkages
 * 
 * This script checks that all contracts are properly linked:
 * 1. ImpactProductNFT.rewardDistributor → bDCURewardDistributor
 * 2. VerificationContract.rewardDistributor → bDCURewardDistributor
 * 3. bDCURewardDistributor.impactProductNFT → ImpactProductNFT
 * 4. bDCURewardDistributor.verificationContract → VerificationContract
 */
async function main() {
  console.log("🔍 Verifying Contract Linkages...\n");

  // Get contract addresses from environment (matching switchToBDCURewardDistributor.js pattern)
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  
  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;
  
  const BDCU_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  // Try to load from deployment files
  const fs = require("fs");
  let bdcuDistributorAddress = BDCU_DISTRIBUTOR_ADDRESS;
  if (!bdcuDistributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    bdcuDistributorAddress = deployment.address;
  }

  if (!IMPACT_PRODUCT_ADDRESS) {
    throw new Error("ImpactProductNFT address not found. Set IMPACT_PRODUCT_CONTRACT_ADDRESS or NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT");
  }
  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found. Set VERIFICATION_CONTRACT_ADDRESS or NEXT_PUBLIC_VERIFICATION_CONTRACT");
  }
  if (!bdcuDistributorAddress) {
    throw new Error("bDCURewardDistributor address not found. Set BDCU_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS");
  }

  console.log("Contract Addresses:");
  console.log(`  ImpactProductNFT: ${IMPACT_PRODUCT_ADDRESS}`);
  console.log(`  VerificationContract: ${VERIFICATION_ADDRESS}`);
  console.log(`  bDCURewardDistributor: ${bdcuDistributorAddress}`);
  console.log("");

  // Get contract instances
  const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);
  const BDCURewardDistributor = await hre.ethers.getContractAt("bDCURewardDistributor", BDCU_DISTRIBUTOR_ADDRESS);

  console.log("📋 Checking Linkages:\n");

  // 1. Check ImpactProductNFT.rewardDistributor
  console.log("1. ImpactProductNFT.rewardDistributor:");
  try {
    const ipRewardDistributor = await ImpactProductNFT.rewardDistributor();
    console.log(`   Current: ${ipRewardDistributor}`);
    console.log(`   Expected: ${bdcuDistributorAddress}`);
    if (ipRewardDistributor.toLowerCase() === bdcuDistributorAddress.toLowerCase()) {
      console.log("   ✅ CORRECT - ImpactProductNFT is linked to bDCURewardDistributor\n");
    } else {
      console.log("   ❌ MISMATCH - ImpactProductNFT is NOT linked to bDCURewardDistributor!");
      console.log("   ⚠️  This means level rewards (10 $bDCU) won't be distributed when claiming Impact Products!\n");
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // 2. Check VerificationContract.rewardDistributor
  console.log("2. VerificationContract.rewardDistributor:");
  try {
    const vcRewardDistributor = await VerificationContract.rewardDistributor();
    console.log(`   Current: ${vcRewardDistributor}`);
    console.log(`   Expected: ${bdcuDistributorAddress}`);
    if (vcRewardDistributor.toLowerCase() === bdcuDistributorAddress.toLowerCase()) {
      console.log("   ✅ CORRECT - VerificationContract is linked to bDCURewardDistributor\n");
    } else {
      console.log("   ❌ MISMATCH - VerificationContract is NOT linked to bDCURewardDistributor!");
      console.log("   ⚠️  This means streak, referral, and impact form rewards won't be distributed!\n");
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // 3. Check bDCURewardDistributor.impactProductNFT
  console.log("3. bDCURewardDistributor.impactProductNFT:");
  try {
    const distributorIP = await BDCURewardDistributor.impactProductNFT();
    console.log(`   Current: ${distributorIP}`);
    console.log(`   Expected: ${IMPACT_PRODUCT_ADDRESS}`);
    if (distributorIP.toLowerCase() === IMPACT_PRODUCT_ADDRESS.toLowerCase()) {
      console.log("   ✅ CORRECT - bDCURewardDistributor authorizes ImpactProductNFT\n");
    } else {
      console.log("   ❌ MISMATCH - bDCURewardDistributor does NOT authorize ImpactProductNFT!");
      console.log("   ⚠️  ImpactProductNFT won't be able to call distributeLevelReward!\n");
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // 4. Check bDCURewardDistributor.verificationContract
  console.log("4. bDCURewardDistributor.verificationContract:");
  try {
    const distributorVC = await BDCURewardDistributor.verificationContract();
    console.log(`   Current: ${distributorVC}`);
    console.log(`   Expected: ${VERIFICATION_ADDRESS}`);
    if (distributorVC.toLowerCase() === VERIFICATION_ADDRESS.toLowerCase()) {
      console.log("   ✅ CORRECT - bDCURewardDistributor authorizes VerificationContract\n");
    } else {
      console.log("   ❌ MISMATCH - bDCURewardDistributor does NOT authorize VerificationContract!");
      console.log("   ⚠️  VerificationContract won't be able to call reward distribution functions!\n");
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // Summary
  console.log("📊 Summary:");
  console.log("   If any mismatches are found above, you need to update the contract linkages.");
  console.log("   Use the following commands to fix:\n");
  console.log("   For ImpactProductNFT:");
  console.log(`     npx hardhat run scripts/updateImpactProductNFTLinkage.js --network baseSepolia\n`);
  console.log("   For VerificationContract:");
  console.log(`     npx hardhat run scripts/updateVerificationContractLinkage.js --network baseSepolia\n`);
  console.log("   For bDCURewardDistributor:");
  console.log(`     npx hardhat run scripts/updateBDCUDistributorLinkage.js --network baseSepolia\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

