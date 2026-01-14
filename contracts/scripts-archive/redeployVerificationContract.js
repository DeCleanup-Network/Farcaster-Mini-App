const hre = require("hardhat");
require("dotenv").config();

/**
 * Redeploy VerificationContract with Updated Referral Protection
 * 
 * New Feature:
 * - Checks hasReceivedReferralReward before setting referrer (prevents duplicate referral rewards)
 */
async function main() {
  console.log("🚀 Redeploying VerificationContract with Updated Referral Protection...\n");
  console.log("New Feature:");
  console.log("  ✅ Checks hasReceivedReferralReward before setting referrer");
  console.log("  ✅ Prevents duplicate referral rewards\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  const fs = require("fs");

  // ============================================
  // STEP 1: Get Existing Contract Addresses
  // ============================================
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;

  const BDCU_REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;

  if (!IMPACT_PRODUCT_ADDRESS) {
    throw new Error("ImpactProductNFT address not found. Set IMPACT_PRODUCT_CONTRACT_ADDRESS or NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS in .env");
  }

  if (!BDCU_REWARD_DISTRIBUTOR_ADDRESS) {
    throw new Error("bDCURewardDistributor address not found. Set BDCU_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS in .env");
  }

  console.log("📂 Using existing contracts:");
  console.log("   ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("   bDCURewardDistributor:", BDCU_REWARD_DISTRIBUTOR_ADDRESS);

  // ============================================
  // STEP 2: Get Verifier Addresses
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
  // STEP 3: Configure Fees
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
  // STEP 4: Deploy VerificationContract
  // ============================================
  console.log("\n📦 Deploying VerificationContract (with updated referral protection)...");
  const VerificationContract = await hre.ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES,
    IMPACT_PRODUCT_ADDRESS,
    BDCU_REWARD_DISTRIBUTOR_ADDRESS,
    SUBMISSION_FEE,
    FEE_ENABLED,
    CLAIM_FEE,
    CLAIM_FEE_ENABLED
  );

  await verificationContract.waitForDeployment();
  const verificationAddress = await verificationContract.getAddress();

  console.log("✅ VerificationContract deployed!");
  console.log("   Address:", verificationAddress);
  console.log("   Network:", hre.network.name);
  console.log("   Block Explorer:", hre.network.config.blockExplorerUrl || "N/A");

  // ============================================
  // STEP 5: Verify Linkages
  // ============================================
  console.log("\n🔗 Verifying contract linkages...");
  try {
    const impactProductNFT = await verificationContract.impactProductNFT();
    const rewardDistributor = await verificationContract.rewardDistributor();
    
    console.log("   ImpactProductNFT:", impactProductNFT);
    console.log("   RewardDistributor:", rewardDistributor);
    
    if (impactProductNFT.toLowerCase() !== IMPACT_PRODUCT_ADDRESS.toLowerCase()) {
      console.log("⚠️  Warning: ImpactProductNFT address mismatch!");
    }
    if (rewardDistributor.toLowerCase() !== BDCU_REWARD_DISTRIBUTOR_ADDRESS.toLowerCase()) {
      console.log("⚠️  Warning: RewardDistributor address mismatch!");
    }
  } catch (error) {
    console.log("⚠️  Could not verify linkages (contract may need time to sync):", error.message);
    console.log("   Expected ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
    console.log("   Expected RewardDistributor:", BDCU_REWARD_DISTRIBUTOR_ADDRESS);
  }

  // ============================================
  // STEP 6: Save Deployment Info
  // ============================================
  const deploymentInfo = {
    network: hre.network.name,
    address: verificationAddress,
    deployer: deployer.address,
    impactProductNFT: IMPACT_PRODUCT_ADDRESS,
    rewardDistributor: BDCU_REWARD_DISTRIBUTOR_ADDRESS,
    verifiers: VERIFIER_ADDRESSES,
    submissionFee: SUBMISSION_FEE,
    feeEnabled: FEE_ENABLED,
    claimFee: CLAIM_FEE,
    claimFeeEnabled: CLAIM_FEE_ENABLED,
    timestamp: new Date().toISOString(),
    features: [
      "Referral protection (checks hasReceivedReferralReward)",
      "First submission tracking",
      "Fee collection support"
    ]
  };

  fs.writeFileSync(
    "verification-contract-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n✅ Deployment info saved to verification-contract-deployment.json");

  // ============================================
  // STEP 7: Next Steps
  // ============================================
  console.log("\n📝 Next Steps:");
  console.log("1. Update your .env.local file:");
  console.log(`   NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=${verificationAddress}`);
  console.log("\n2. Update ImpactProductNFT to use new VerificationContract:");
  console.log("   Run: npx hardhat run scripts/updateImpactProductNFTLinkage.js --network baseSepolia");
  console.log("\n3. (Optional) Transfer ownership to multisig:");
  console.log("   Run: npx hardhat run scripts/transferOwnershipToMultisig.js --network baseSepolia");
  console.log("\n4. (Optional) Set fee treasury if needed:");
  console.log("   Run: npx hardhat run scripts/setFeeTreasury.js --network baseSepolia");
  console.log("\n5. Verify contract on block explorer:");
  console.log("   npx hardhat verify --network baseSepolia", verificationAddress, 
    `"[${VERIFIER_ADDRESSES.map(a => `"${a}"`).join(',')}]"`,
    `"${IMPACT_PRODUCT_ADDRESS}"`,
    `"${BDCU_REWARD_DISTRIBUTOR_ADDRESS}"`,
    SUBMISSION_FEE,
    FEE_ENABLED,
    CLAIM_FEE,
    CLAIM_FEE_ENABLED
  );
  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

