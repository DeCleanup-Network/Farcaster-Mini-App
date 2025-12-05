const hre = require("hardhat");
require("dotenv").config();

/**
 * Deploy Updated Contracts with New Features
 * 
 * New Features:
 * - bDCURewardDistributor: Streak tracking, referral protection
 * - VerificationContract: Referral protection (one-time referral per user)
 */
async function main() {
  console.log("🚀 Deploying Updated Contracts with New Features...\n");
  console.log("Features:");
  console.log("  ✅ Streak tracking (7-day window)");
  console.log("  ✅ Referral protection (one-time per user)");
  console.log("  ✅ First submission tracking\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  const fs = require("fs");

  // ============================================
  // STEP 1: Get or Deploy bDCU Token
  // ============================================
  let BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS ||
    "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044"; // Test token address

  if (!BDCU_TOKEN_ADDRESS) {
    console.log("⚠️  No bDCU token address found. Deploying test token...");
    const TestBDCUToken = await hre.ethers.getContractFactory("TestBDCUToken");
    const testToken = await TestBDCUToken.deploy();
    await testToken.waitForDeployment();
    BDCU_TOKEN_ADDRESS = await testToken.getAddress();
    console.log("✅ Test bDCU Token deployed to:", BDCU_TOKEN_ADDRESS);
  } else {
    console.log("📂 Using existing bDCU Token:", BDCU_TOKEN_ADDRESS);
  }

  // ============================================
  // STEP 2: Deploy bDCURewardDistributor (with streak tracking)
  // ============================================
  console.log("\n📦 Step 1: Deploying bDCURewardDistributor (with streak tracking)...");
  const BDCURewardDistributor = await hre.ethers.getContractFactory("bDCURewardDistributor");
  const rewardDistributor = await BDCURewardDistributor.deploy(BDCU_TOKEN_ADDRESS);
  
  await rewardDistributor.waitForDeployment();
  const distributorAddress = await rewardDistributor.getAddress();

  console.log("✅ bDCU Reward Distributor deployed!");
  console.log("   Address:", distributorAddress);
  console.log("   Features: Streak tracking, Referral protection");

  // Save deployment info
  const distributorDeployment = {
    network: hre.network.name,
    address: distributorAddress,
    tokenAddress: BDCU_TOKEN_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    features: [
      "streak_tracking",
      "referral_protection",
      "level_rewards",
      "streak_rewards",
      "referral_rewards",
      "impact_form_rewards",
      "verifier_rewards"
    ],
  };
  
  fs.writeFileSync(
    "bdcu-reward-distributor-deployment.json",
    JSON.stringify(distributorDeployment, null, 2)
  );
  console.log("   📝 Deployment info saved to bdcu-reward-distributor-deployment.json");

  // ============================================
  // STEP 3: Get ImpactProductNFT Address
  // ============================================
  let IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;

  if (!IMPACT_PRODUCT_ADDRESS) {
    console.error("\n❌ ImpactProductNFT address not found!");
    console.error("   Set IMPACT_PRODUCT_CONTRACT_ADDRESS in .env");
    console.error("   Or deploy ImpactProductNFT first using deploy.js");
    throw new Error("ImpactProductNFT address required");
  }
  console.log("\n📂 Using ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);

  // ============================================
  // STEP 4: Get Verifier Addresses
  // ============================================
  const VERIFIER_ADDRESSES = process.env.VERIFIER_ADDRESSES 
    ? process.env.VERIFIER_ADDRESSES.split(',').map(addr => addr.trim())
    : process.env.VERIFIER_TO_ADD 
    ? [process.env.VERIFIER_TO_ADD.trim()]
    : process.env.VERIFIER_ADDRESS
    ? [process.env.VERIFIER_ADDRESS.trim()]
    : [];

  if (VERIFIER_ADDRESSES.length === 0) {
    VERIFIER_ADDRESSES.push(deployer.address);
    console.log("⚠️  No verifier addresses found, using deployer address:", deployer.address);
  }
  console.log("📂 Verifiers:", VERIFIER_ADDRESSES.join(", "));

  // ============================================
  // STEP 5: Configure Fees
  // ============================================
  // Calculate 2 cents USD in ETH (approximately 7,142,857,142,857 wei at $2,800/ETH)
  const FEE_2_CENTS = "7000000000000"; // ~2 cents USD in wei
  
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || "0"; // Default: no submission fee
  const FEE_ENABLED = process.env.FEE_ENABLED === "true"; // Default: disabled
  
  const CLAIM_FEE = process.env.CLAIM_FEE || FEE_2_CENTS; // Default: 2 cents
  const CLAIM_FEE_ENABLED = process.env.CLAIM_FEE_ENABLED !== "false"; // Default: enabled

  console.log("\n💰 Fee Configuration:");
  console.log("   Submission Fee:", SUBMISSION_FEE, "wei (enabled:", FEE_ENABLED + ")");
  console.log("   Claim Fee:", CLAIM_FEE, "wei (~2 cents USD, enabled:", CLAIM_FEE_ENABLED + ")");

  // ============================================
  // STEP 6: Deploy VerificationContract (with referral protection)
  // ============================================
  console.log("\n📦 Step 2: Deploying VerificationContract (with referral protection)...");
  const VerificationContract = await hre.ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES,
    IMPACT_PRODUCT_ADDRESS,
    distributorAddress,
    SUBMISSION_FEE,
    FEE_ENABLED,
    CLAIM_FEE,
    CLAIM_FEE_ENABLED
  );
  
  await verificationContract.waitForDeployment();
  const verificationAddress = await verificationContract.getAddress();
  
  console.log("✅ VerificationContract deployed!");
  console.log("   Address:", verificationAddress);
  console.log("   Features: Referral protection (one-time per user)");

  // ============================================
  // STEP 7: Link Contracts
  // ============================================
  console.log("\n🔗 Step 3: Linking contracts...");
  
  // Set VerificationContract in ImpactProductNFT
  const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
  const tx1 = await ImpactProductNFT.setVerificationContract(verificationAddress);
  await tx1.wait();
  console.log("✅ Linked VerificationContract in ImpactProductNFT");
  
  // Set VerificationContract in RewardDistributor
  const tx2 = await rewardDistributor.setVerificationContract(verificationAddress);
  await tx2.wait();
  console.log("✅ Linked VerificationContract in bDCURewardDistributor");

  // Set ImpactProductNFT in RewardDistributor
  const tx3 = await rewardDistributor.setImpactProductNFT(IMPACT_PRODUCT_ADDRESS);
  await tx3.wait();
  console.log("✅ Linked ImpactProductNFT in bDCURewardDistributor");

  // ============================================
  // STEP 8: Save Deployment Info
  // ============================================
  const verificationDeployment = {
    network: hre.network.name,
    address: verificationAddress,
    impactProductNFT: IMPACT_PRODUCT_ADDRESS,
    rewardDistributor: distributorAddress,
    verifiers: VERIFIER_ADDRESSES,
    submissionFee: SUBMISSION_FEE,
    feeEnabled: FEE_ENABLED,
    claimFee: CLAIM_FEE,
    claimFeeEnabled: CLAIM_FEE_ENABLED,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    features: [
      "referral_protection",
      "first_submission_tracking",
      "claim_fee",
      "submission_fee"
    ],
  };
  
  fs.writeFileSync(
    "verification-contract-deployment.json",
    JSON.stringify(verificationDeployment, null, 2)
  );
  console.log("   📝 Deployment info saved to verification-contract-deployment.json");

  // ============================================
  // STEP 9: Summary
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("   bDCU Reward Distributor:", distributorAddress);
  console.log("   Verification Contract:", verificationAddress);
  console.log("   Impact Product NFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("   bDCU Token:", BDCU_TOKEN_ADDRESS);
  console.log("\n📝 Update your .env files:");
  console.log("\n# contracts/.env");
  console.log(`BDCU_REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}`);
  console.log(`VERIFICATION_CONTRACT_ADDRESS=${verificationAddress}`);
  console.log("\n# .env.local (for frontend)");
  console.log(`NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}`);
  console.log(`NEXT_PUBLIC_VERIFICATION_CONTRACT=${verificationAddress}`);
  console.log("\n✨ New Features Enabled:");
  console.log("   ✅ Streak tracking (7-day window)");
  console.log("   ✅ Referral protection (one-time per user)");
  console.log("   ✅ First submission tracking");
  console.log("\n💡 Next Steps:");
  console.log("   1. Transfer tokens to reward distributor (if needed)");
  console.log("   2. Update environment variables in frontend");
  console.log("   3. Test the new features!");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

