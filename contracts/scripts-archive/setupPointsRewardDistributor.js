const hre = require("hardhat");
require("dotenv").config();

/**
 * Setup PointsRewardDistributor Contract
 * 
 * This script:
 * 1. Links ImpactProductNFT and VerificationContract to PointsRewardDistributor
 * 2. Sets initial token price and target reward value
 * 3. Provides instructions for token transfer
 */
async function main() {
  console.log("🔧 Setting up PointsRewardDistributor Contract...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============================================
  // STEP 1: Get Contract Addresses
  // ============================================
  const POINTS_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  const IMPACT_PRODUCT_NFT = 
    process.env.IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;

  const VERIFICATION_CONTRACT = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  if (!POINTS_DISTRIBUTOR_ADDRESS) {
    throw new Error("PointsRewardDistributor address not found. Set POINTS_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS");
  }

  if (!IMPACT_PRODUCT_NFT) {
    throw new Error("ImpactProductNFT address not found. Set IMPACT_PRODUCT_NFT_ADDRESS or NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS");
  }

  if (!VERIFICATION_CONTRACT) {
    throw new Error("VerificationContract address not found. Set VERIFICATION_CONTRACT_ADDRESS or NEXT_PUBLIC_VERIFICATION_CONTRACT");
  }

  console.log("📋 Contract Addresses:");
  console.log("   PointsRewardDistributor:", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("   ImpactProductNFT:", IMPACT_PRODUCT_NFT);
  console.log("   VerificationContract:", VERIFICATION_CONTRACT);
  console.log("");

  // Get PointsRewardDistributor contract
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const pointsDistributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR_ADDRESS);

  // Check owner
  const owner = await pointsDistributor.owner();
  console.log("Contract owner:", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("⚠️  Warning: You are not the contract owner!");
    console.log("   You may not be able to execute owner-only functions.\n");
  }

  // ============================================
  // STEP 2: Link ImpactProductNFT
  // ============================================
  console.log("🔗 Step 1: Linking ImpactProductNFT...");
  const currentImpactProductNFT = await pointsDistributor.impactProductNFT();
  console.log("   Current ImpactProductNFT:", currentImpactProductNFT);

  if (currentImpactProductNFT.toLowerCase() === IMPACT_PRODUCT_NFT.toLowerCase()) {
    console.log("   ✅ Already linked to correct address!\n");
  } else {
    console.log("   Setting ImpactProductNFT to:", IMPACT_PRODUCT_NFT);
    try {
      const tx1 = await pointsDistributor.setImpactProductNFT(IMPACT_PRODUCT_NFT);
      console.log("   Transaction hash:", tx1.hash);
      await tx1.wait();
      console.log("   ✅ ImpactProductNFT linked successfully!\n");
    } catch (error) {
      console.error("   ❌ Error linking ImpactProductNFT:", error.message);
      throw error;
    }
  }

  // ============================================
  // STEP 3: Link VerificationContract
  // ============================================
  console.log("🔗 Step 2: Linking VerificationContract...");
  const currentVerificationContract = await pointsDistributor.verificationContract();
  console.log("   Current VerificationContract:", currentVerificationContract);

  if (currentVerificationContract.toLowerCase() === VERIFICATION_CONTRACT.toLowerCase()) {
    console.log("   ✅ Already linked to correct address!\n");
  } else {
    console.log("   Setting VerificationContract to:", VERIFICATION_CONTRACT);
    try {
      const tx2 = await pointsDistributor.setVerificationContract(VERIFICATION_CONTRACT);
      console.log("   Transaction hash:", tx2.hash);
      await tx2.wait();
      console.log("   ✅ VerificationContract linked successfully!\n");
    } catch (error) {
      console.error("   ❌ Error linking VerificationContract:", error.message);
      throw error;
    }
  }

  // ============================================
  // STEP 4: Set Token Price
  // ============================================
  console.log("💰 Step 3: Setting Token Price...");
  
  // Get price from env or use default
  // Price in USD with 8 decimals
  // Example: 785000 = $0.00000785 (based on user's current price)
  // For testnet, you can use a test price like 1000000 = $0.00001
  const TOKEN_PRICE = process.env.TOKEN_PRICE || process.env.INITIAL_TOKEN_PRICE || "785000";
  const tokenPriceBigInt = BigInt(TOKEN_PRICE);
  
  const currentTokenPrice = await pointsDistributor.currentTokenPriceUSD();
  console.log("   Current token price (8 decimals):", currentTokenPrice.toString());
  console.log("   New token price (8 decimals):", TOKEN_PRICE);
  console.log("   This equals:", hre.ethers.formatUnits(TOKEN_PRICE, 8), "USD per token");

  if (currentTokenPrice.toString() === TOKEN_PRICE) {
    console.log("   ✅ Token price already set correctly!\n");
  } else {
    console.log("   Updating token price...");
    try {
      const tx3 = await pointsDistributor.updateTokenPrice(tokenPriceBigInt);
      console.log("   Transaction hash:", tx3.hash);
      await tx3.wait();
      console.log("   ✅ Token price updated successfully!\n");
    } catch (error) {
      console.error("   ❌ Error updating token price:", error.message);
      throw error;
    }
  }

  // ============================================
  // STEP 5: Set Target Reward Value
  // ============================================
  console.log("🎯 Step 4: Setting Target Reward Value...");
  
  // Target reward value in cents (for 10 points = 1 cleanup)
  // Default: 50 cents (target: $0.50 per cleanup)
  const TARGET_REWARD_VALUE = process.env.TARGET_REWARD_VALUE || "50"; // in cents
  const targetRewardValueBigInt = BigInt(TARGET_REWARD_VALUE);
  
  const currentTargetValue = await pointsDistributor.targetRewardValueUSD();
  console.log("   Current target reward value (cents):", currentTargetValue.toString());
  console.log("   New target reward value (cents):", TARGET_REWARD_VALUE);
  console.log("   This means 10 points (1 cleanup) =", TARGET_REWARD_VALUE, "cents = $", (parseInt(TARGET_REWARD_VALUE) / 100).toFixed(2));

  if (currentTargetValue.toString() === TARGET_REWARD_VALUE) {
    console.log("   ✅ Target reward value already set correctly!\n");
  } else {
    console.log("   Updating target reward value...");
    try {
      const tx4 = await pointsDistributor.updateTargetRewardValue(targetRewardValueBigInt);
      console.log("   Transaction hash:", tx4.hash);
      await tx4.wait();
      console.log("   ✅ Target reward value updated successfully!\n");
    } catch (error) {
      console.error("   ❌ Error updating target reward value:", error.message);
      throw error;
    }
  }

  // ============================================
  // STEP 6: Verify Setup
  // ============================================
  console.log("✅ Verification:");
  const finalImpactProductNFT = await pointsDistributor.impactProductNFT();
  const finalVerificationContract = await pointsDistributor.verificationContract();
  const finalTokenPrice = await pointsDistributor.currentTokenPriceUSD();
  const finalTargetValue = await pointsDistributor.targetRewardValueUSD();

  console.log("   ImpactProductNFT:", finalImpactProductNFT);
  console.log("   VerificationContract:", finalVerificationContract);
  console.log("   Token Price (8 decimals):", finalTokenPrice.toString(), "=", hre.ethers.formatUnits(finalTokenPrice.toString(), 8), "USD");
  console.log("   Target Reward Value (cents):", finalTargetValue.toString(), "=", "$" + (parseInt(finalTargetValue.toString()) / 100).toFixed(2), "per 10 points");
  console.log("");

  // ============================================
  // STEP 7: Token Transfer Instructions
  // ============================================
  console.log("📝 Next Steps:");
  console.log("");
  console.log("1. Transfer tokens from multisig to PointsRewardDistributor:");
  console.log("   Contract Address:", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("   Token Address:", await pointsDistributor.bDCUToken());
  console.log("");
  console.log("   You can use the transferTokensToPointsDistributor.js script or transfer manually:");
  console.log("   - From multisig wallet, send $bDCU tokens to:", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("   - Or use: npx hardhat run scripts/transferTokensToPointsDistributor.js --network baseSepolia");
  console.log("");
  console.log("2. Update ImpactProductNFT and VerificationContract to use PointsRewardDistributor:");
  console.log("   - ImpactProductNFT should call awardLevelPoints() instead of distributeLevelReward()");
  console.log("   - VerificationContract should call points functions instead of token distribution");
  console.log("");
  console.log("3. Test the system:");
  console.log("   - Submit a cleanup and verify points are awarded");
  console.log("   - Try claiming tokens from the profile page");
  console.log("   - Test staking functionality");
  console.log("");

  console.log("✅ Setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

