const hre = require("hardhat");
require("dotenv").config();

/**
 * Redeploy PointsRewardDistributor with new features
 * 
 * New features:
 * - Manual verifier management
 * - Adjustable point multipliers
 * - Simplified withdrawals (no treasury)
 * 
 * This script:
 * 1. Checks current contract state
 * 2. Deploys new contract
 * 3. Links contracts
 * 4. Sets up configuration
 * 5. Provides migration instructions
 */
async function main() {
  console.log("🔄 Redeploying PointsRewardDistributor with Enhanced Features...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============================================
  // STEP 1: Check Old Contract (if exists)
  // ============================================
  const OLD_POINTS_DISTRIBUTOR = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  if (OLD_POINTS_DISTRIBUTOR) {
    console.log("📋 Old Contract Info:");
    console.log("   Address:", OLD_POINTS_DISTRIBUTOR);
    
    try {
      const OldDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
      const oldDistributor = OldDistributor.attach(OLD_POINTS_DISTRIBUTOR);
      
      // Get token address
      const tokenAddress = await oldDistributor.bDCUToken();
      const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
      const token = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress);
      const oldBalance = await token.balanceOf(OLD_POINTS_DISTRIBUTOR);
      
      console.log("   Token Balance:", hre.ethers.formatUnits(oldBalance, 18), "tokens");
      console.log("   ⚠️  Remember to transfer tokens from old to new contract!\n");
    } catch (error) {
      console.log("   ⚠️  Could not read old contract (may not exist yet)\n");
    }
  }

  // ============================================
  // STEP 2: Get bDCU Token Address
  // ============================================
  let BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS;

  if (!BDCU_TOKEN_ADDRESS) {
    console.log("⚠️  No bDCU token address found in environment variables.");
    console.log("Please set BDCU_TOKEN_ADDRESS or NEXT_PUBLIC_BDCU_TOKEN_ADDRESS in your .env file");
    process.exit(1);
  }

  console.log("📂 Using bDCU Token:", BDCU_TOKEN_ADDRESS);

  // ============================================
  // STEP 3: Set Initial Token Price
  // ============================================
  const INITIAL_TOKEN_PRICE = process.env.INITIAL_TOKEN_PRICE || "77"; // Default: $0.00000077
  console.log("💰 Initial Token Price (8 decimals):", INITIAL_TOKEN_PRICE);
  console.log("   This equals:", hre.ethers.formatUnits(INITIAL_TOKEN_PRICE, 8), "USD per token\n");

  // ============================================
  // STEP 4: Deploy New PointsRewardDistributor
  // ============================================
  console.log("📦 Deploying new PointsRewardDistributor...");
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const pointsDistributor = await PointsRewardDistributor.deploy(
    BDCU_TOKEN_ADDRESS,
    INITIAL_TOKEN_PRICE
  );
  await pointsDistributor.waitForDeployment();
  const pointsDistributorAddress = await pointsDistributor.getAddress();
  
  console.log("✅ New PointsRewardDistributor deployed to:", pointsDistributorAddress);
  console.log("   Explorer:", `https://${hre.network.name === 'baseSepolia' ? 'sepolia.' : ''}basescan.org/address/${pointsDistributorAddress}\n`);

  // ============================================
  // STEP 5: Link Contracts
  // ============================================
  const IMPACT_PRODUCT_NFT = 
    process.env.IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;

  const VERIFICATION_CONTRACT = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

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
  // STEP 6: Set Target Reward Value
  // ============================================
  const TARGET_REWARD_VALUE = process.env.TARGET_REWARD_VALUE || "50"; // Default: 50 cents
  console.log("🎯 Setting target reward value:", TARGET_REWARD_VALUE, "cents ($0." + TARGET_REWARD_VALUE + ")");
  const tx3 = await pointsDistributor.updateTargetRewardValue(BigInt(TARGET_REWARD_VALUE));
  await tx3.wait();
  console.log("   ✅ Target reward value set\n");

  // ============================================
  // STEP 7: Save Deployment Info
  // ============================================
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    oldContract: OLD_POINTS_DISTRIBUTOR || null,
    contracts: {
      PointsRewardDistributor: {
        address: pointsDistributorAddress,
        bDCUToken: BDCU_TOKEN_ADDRESS,
        initialTokenPrice: INITIAL_TOKEN_PRICE,
        targetRewardValue: TARGET_REWARD_VALUE,
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
  // STEP 8: Next Steps
  // ============================================
  console.log("\n🎯 Next Steps:");
  console.log("");
  console.log("1. Update environment variables:");
  console.log(`   POINTS_REWARD_DISTRIBUTOR_ADDRESS=${pointsDistributorAddress}`);
  console.log(`   NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS=${pointsDistributorAddress}`);
  console.log("");
  
  if (OLD_POINTS_DISTRIBUTOR) {
    console.log("2. Transfer tokens from old to new contract:");
    console.log(`   OLD_CONTRACT=${OLD_POINTS_DISTRIBUTOR} NEW_CONTRACT=${pointsDistributorAddress}`);
    console.log("   Run: npx hardhat run scripts/transferTokensFromOldDistributor.js --network baseSepolia");
    console.log("");
  } else {
    console.log("2. Transfer tokens to new contract:");
    console.log(`   TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferFromDeployer.js --network baseSepolia`);
    console.log("");
  }
  
  console.log("3. Update frontend .env.local with new contract address");
  console.log("");
  console.log("4. (Optional) Migrate user points from old contract if needed");
  console.log("");

  console.log("✅ Deployment complete!");
  console.log("\n📝 New Features Available:");
  console.log("   - Manual verifier management (addVerifier/removeVerifier)");
  console.log("   - Adjustable point multipliers (updatePointMultipliers)");
  console.log("   - Simplified withdrawals (no treasury, goes to owner)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

