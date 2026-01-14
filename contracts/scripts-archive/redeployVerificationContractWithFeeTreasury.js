const hre = require("hardhat");
require("dotenv").config();

/**
 * Redeploy VerificationContract with Fee Treasury Support
 * 
 * New Feature:
 * - Fee treasury address support (fees can go to separate address)
 * - setFeeTreasury() function
 * - withdrawFees() sends to treasury if set, otherwise to owner
 */
async function main() {
  console.log("🚀 Redeploying VerificationContract with Fee Treasury Support...\n");
  console.log("New Feature:");
  console.log("  ✅ Fee treasury address support");
  console.log("  ✅ setFeeTreasury() function");
  console.log("  ✅ withdrawFees() sends to treasury if set\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============================================
  // STEP 1: Get Existing Contract Addresses
  // ============================================
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;

  const REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;

  if (!IMPACT_PRODUCT_ADDRESS) {
    throw new Error("ImpactProductNFT address not found");
  }

  if (!REWARD_DISTRIBUTOR_ADDRESS) {
    throw new Error("Reward Distributor address not found");
  }

  console.log("📂 Using existing contracts:");
  console.log("   ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("   Reward Distributor:", REWARD_DISTRIBUTOR_ADDRESS);

  // ============================================
  // STEP 2: Get Verifier Addresses
  // ============================================
  const VERIFIER_ADDRESSES = process.env.VERIFIER_ADDRESSES 
    ? process.env.VERIFIER_ADDRESSES.split(',').map(addr => addr.trim())
    : process.env.VERIFIER_TO_ADD 
    ? [process.env.VERIFIER_TO_ADD.trim()]
    : [deployer.address];

  console.log("📂 Verifiers:", VERIFIER_ADDRESSES.join(", "));

  // ============================================
  // STEP 3: Configure Fees
  // ============================================
  const FEE_2_CENTS = "7000000000000"; // ~2 cents USD in wei
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || "0";
  const FEE_ENABLED = process.env.FEE_ENABLED === "true";
  const CLAIM_FEE = process.env.CLAIM_FEE || FEE_2_CENTS;
  const CLAIM_FEE_ENABLED = process.env.CLAIM_FEE_ENABLED !== "false";

  console.log("\n💰 Fee Configuration:");
  console.log("   Submission Fee:", SUBMISSION_FEE, "wei (enabled:", FEE_ENABLED + ")");
  console.log("   Claim Fee:", CLAIM_FEE, "wei (enabled:", CLAIM_FEE_ENABLED + ")");

  // ============================================
  // STEP 4: Deploy VerificationContract
  // ============================================
  console.log("\n📦 Deploying VerificationContract...");
  const VerificationContract = await hre.ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES,
    IMPACT_PRODUCT_ADDRESS,
    REWARD_DISTRIBUTOR_ADDRESS,
    SUBMISSION_FEE,
    FEE_ENABLED,
    CLAIM_FEE,
    CLAIM_FEE_ENABLED
  );

  await verificationContract.waitForDeployment();
  const verificationAddress = await verificationContract.getAddress();

  console.log("✅ VerificationContract deployed!");
  console.log("   Address:", verificationAddress);
  console.log("   Explorer:", `https://${hre.network.name === 'baseSepolia' ? 'sepolia.' : ''}basescan.org/address/${verificationAddress}\n`);

  // ============================================
  // STEP 5: Set Fee Treasury (if provided)
  // ============================================
  const FEE_TREASURY_ADDRESS = 
    process.env.FEE_TREASURY_SAFE_ADDRESS ||
    process.env.FEE_TREASURY_ADDRESS;

  if (FEE_TREASURY_ADDRESS) {
    console.log("💰 Setting fee treasury address...");
    try {
      const tx = await verificationContract.setFeeTreasury(FEE_TREASURY_ADDRESS);
      console.log("   Transaction hash:", tx.hash);
      await tx.wait();
      console.log("   ✅ Fee treasury set to:", FEE_TREASURY_ADDRESS);
    } catch (error) {
      console.error("   ❌ Error setting fee treasury:", error.message);
    }
  } else {
    console.log("⚠️  No fee treasury address provided. Set FEE_TREASURY_ADDRESS to configure it.");
  }

  // ============================================
  // STEP 6: Save Deployment Info
  // ============================================
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    address: verificationAddress,
    deployer: deployer.address,
    impactProductNFT: IMPACT_PRODUCT_ADDRESS,
    rewardDistributor: REWARD_DISTRIBUTOR_ADDRESS,
    verifiers: VERIFIER_ADDRESSES,
    feeTreasury: FEE_TREASURY_ADDRESS || null,
    timestamp: new Date().toISOString(),
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
  console.log("   npx hardhat run scripts/updateImpactProductNFTLinkage.js --network baseSepolia");
  console.log("\n3. Update PointsRewardDistributor to use new VerificationContract:");
  console.log("   npx hardhat run scripts/setupPointsRewardDistributor.js --network baseSepolia");
  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

