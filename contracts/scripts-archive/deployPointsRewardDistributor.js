const hre = require("hardhat");
require("dotenv").config();

/**
 * Deploy PointsRewardDistributor Contract
 * 
 * This contract implements the new points-based reward system:
 * - Users earn DCU points (same numbers: 10 for cleanup, 5 for impact report, etc.)
 * - Users can claim tokens at any time using their points
 * - Claim amount depends on current market price
 * - Users can stake tokens to become verifiers (requires level 10)
 */
async function main() {
  console.log("🚀 Deploying PointsRewardDistributor Contract...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============================================
  // STEP 1: Get bDCU Token Address
  // ============================================
  let BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS;

  if (!BDCU_TOKEN_ADDRESS) {
    console.log("⚠️  No bDCU token address found in environment variables.");
    console.log("Please set BDCU_TOKEN_ADDRESS or NEXT_PUBLIC_BDCU_TOKEN_ADDRESS in your .env file");
    console.log("\nFor testnet, you can use your existing testnet bDCU token address.");
    console.log("For mainnet, use: 0x30171b7014c02229497cde6745dd3ad821f12b07");
    process.exit(1);
  }

  console.log("📂 Using bDCU Token:", BDCU_TOKEN_ADDRESS);

  // ============================================
  // STEP 2: Set Initial Token Price
  // ============================================
  // Price in USD with 8 decimals
  // Example: 785000 = $0.00000785
  // For testnet, you can use a test price like 1000000 = $0.00001
  const INITIAL_TOKEN_PRICE = process.env.INITIAL_TOKEN_PRICE || "1000000"; // Default: $0.00001 for testing
  console.log("💰 Initial Token Price (8 decimals):", INITIAL_TOKEN_PRICE);
  console.log("   This equals:", hre.ethers.formatUnits(INITIAL_TOKEN_PRICE, 8), "USD per token\n");

  // ============================================
  // STEP 3: Deploy PointsRewardDistributor
  // ============================================
  console.log("📦 Deploying PointsRewardDistributor...");
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const pointsDistributor = await PointsRewardDistributor.deploy(
    BDCU_TOKEN_ADDRESS,
    INITIAL_TOKEN_PRICE
  );
  await pointsDistributor.waitForDeployment();
  const pointsDistributorAddress = await pointsDistributor.getAddress();
  
  console.log("✅ PointsRewardDistributor deployed to:", pointsDistributorAddress);
  console.log("   Explorer:", `https://${hre.network.name === 'baseSepolia' ? 'sepolia.' : ''}basescan.org/address/${pointsDistributorAddress}\n`);

  // ============================================
  // STEP 4: Link Contracts (if addresses available)
  // ============================================
  const IMPACT_PRODUCT_NFT = process.env.IMPACT_PRODUCT_NFT_ADDRESS || process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  const VERIFICATION_CONTRACT = process.env.VERIFICATION_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  if (IMPACT_PRODUCT_NFT) {
    console.log("🔗 Linking ImpactProductNFT:", IMPACT_PRODUCT_NFT);
    const tx1 = await pointsDistributor.setImpactProductNFT(IMPACT_PRODUCT_NFT);
    await tx1.wait();
    console.log("   ✅ ImpactProductNFT linked\n");
  } else {
    console.log("⚠️  ImpactProductNFT address not found. Link it later using:");
    console.log(`   pointsDistributor.setImpactProductNFT("0x...")`);
  }

  if (VERIFICATION_CONTRACT) {
    console.log("🔗 Linking VerificationContract:", VERIFICATION_CONTRACT);
    const tx2 = await pointsDistributor.setVerificationContract(VERIFICATION_CONTRACT);
    await tx2.wait();
    console.log("   ✅ VerificationContract linked\n");
  } else {
    console.log("⚠️  VerificationContract address not found. Link it later using:");
    console.log(`   pointsDistributor.setVerificationContract("0x...")`);
  }

  // ============================================
  // STEP 5: Save Deployment Info
  // ============================================
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PointsRewardDistributor: {
        address: pointsDistributorAddress,
        bDCUToken: BDCU_TOKEN_ADDRESS,
        initialTokenPrice: INITIAL_TOKEN_PRICE,
        impactProductNFT: IMPACT_PRODUCT_NFT || null,
        verificationContract: VERIFICATION_CONTRACT || null,
      }
    }
  };

  const fs = require("fs");
  const filename = `points-reward-distributor-deployment-${hre.network.name}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to:", filename);

  // ============================================
  // STEP 6: Environment Variable
  // ============================================
  console.log("\n📝 Add this to your .env.local file:");
  console.log(`NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS=${pointsDistributorAddress}\n`);

  // ============================================
  // STEP 7: Next Steps
  // ============================================
  console.log("🎯 Next Steps:");
  console.log("1. Transfer tokens from multisig to PointsRewardDistributor contract");
  console.log("2. Update ImpactProductNFT to call awardLevelPoints() instead of distributeLevelReward()");
  console.log("3. Update VerificationContract to call points functions instead of token distribution");
  console.log("4. Update frontend to show DCU points instead of tokens");
  console.log("5. Update token price regularly using updateTokenPrice()\n");

  console.log("✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

