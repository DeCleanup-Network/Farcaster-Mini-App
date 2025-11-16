const { ethers } = require("hardhat");

/**
 * Post-Deployment Setup Script
 * 
 * This script handles:
 * 1. Funding RecyclablesReward with cRECY tokens
 * 2. Verifying contract configurations
 * 3. Testing basic contract interactions
 * 
 * Usage:
 *   Update CONTRACT_ADDRESSES below with your deployed addresses
 *   Then run: npx hardhat run scripts/setup.js --network sepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Running setup with account:", deployer.address);

  // ============================================
  // CONFIGURATION - Update with your deployed addresses
  // ============================================
  const CONTRACT_ADDRESSES = {
    DCU_TOKEN: process.env.DCU_TOKEN_ADDRESS || "",
    IMPACT_PRODUCT: process.env.IMPACT_PRODUCT_ADDRESS || "",
    REWARD_DISTRIBUTOR: process.env.REWARD_DISTRIBUTOR_ADDRESS || "",
    VERIFICATION: process.env.VERIFICATION_ADDRESS || "",
    RECYCLABLES: process.env.RECYCLABLES_ADDRESS || "",
  };

  // cRECY Token address on Celo
  const CRECY_TOKEN_ADDRESS = "0x34C11A932853Ae24E845Ad4B633E3cEf91afE583";
  const RESERVE_AMOUNT = ethers.parseEther("5000"); // 5000 cRECY

  // Validate addresses
  const missingAddresses = Object.entries(CONTRACT_ADDRESSES)
    .filter(([_, addr]) => !addr || addr === "")
    .map(([name]) => name);

  if (missingAddresses.length > 0) {
    console.error("Missing contract addresses:", missingAddresses.join(", "));
    console.error("Please set them in .env or update CONTRACT_ADDRESSES in this script");
    process.exit(1);
  }

  console.log("\n=== Contract Addresses ===");
  Object.entries(CONTRACT_ADDRESSES).forEach(([name, addr]) => {
    console.log(`${name}: ${addr}`);
  });

  // ============================================
  // STEP 1: Verify Contract Configurations
  // ============================================
  console.log("\n=== Verifying Contract Configurations ===");

  // Check DCUToken
  const dcuToken = await ethers.getContractAt("DCUToken", CONTRACT_ADDRESSES.DCU_TOKEN);
  const dcuRewardDistributor = await dcuToken.rewardDistributor();
  console.log("✓ DCUToken.rewardDistributor:", dcuRewardDistributor);
  if (dcuRewardDistributor !== CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    console.warn("⚠ Warning: DCUToken.rewardDistributor doesn't match!");
  }

  // Check ImpactProductNFT
  const impactProductNFT = await ethers.getContractAt("ImpactProductNFT", CONTRACT_ADDRESSES.IMPACT_PRODUCT);
  const nftBaseURI = await impactProductNFT.baseURI();
  const nftRewardDistributor = await impactProductNFT.rewardDistributor();
  console.log("✓ ImpactProductNFT.baseURI:", nftBaseURI);
  console.log("✓ ImpactProductNFT.rewardDistributor:", nftRewardDistributor);

  // Check RewardDistributor
  const rewardDistributor = await ethers.getContractAt("RewardDistributor", CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR);
  const rdDcuToken = await rewardDistributor.dcuToken();
  const rdImpactProductNFT = await rewardDistributor.impactProductNFT();
  console.log("✓ RewardDistributor.dcuToken:", rdDcuToken);
  console.log("✓ RewardDistributor.impactProductNFT:", rdImpactProductNFT);

  // Check VerificationContract
  const verificationContract = await ethers.getContractAt("VerificationContract", CONTRACT_ADDRESSES.VERIFICATION);
  const vcImpactProductNFT = await verificationContract.impactProductNFT();
  const vcRewardDistributor = await verificationContract.rewardDistributor();
  console.log("✓ VerificationContract.impactProductNFT:", vcImpactProductNFT);
  console.log("✓ VerificationContract.rewardDistributor:", vcRewardDistributor);

  // ============================================
  // STEP 2: Fund RecyclablesReward
  // ============================================
  console.log("\n=== Funding RecyclablesReward ===");

  const recyclablesReward = await ethers.getContractAt("RecyclablesReward", CONTRACT_ADDRESSES.RECYCLABLES);
  const cRECY = await ethers.getContractAt("IERC20", CRECY_TOKEN_ADDRESS);

  // Check current balance
  const currentBalance = await cRECY.balanceOf(deployer.address);
  console.log("Your cRECY balance:", ethers.formatEther(currentBalance), "cRECY");

  if (currentBalance < RESERVE_AMOUNT) {
    console.error("⚠ Insufficient cRECY balance. You need at least 5000 cRECY.");
    console.error("   Current:", ethers.formatEther(currentBalance), "cRECY");
    console.error("   Required:", ethers.formatEther(RESERVE_AMOUNT), "cRECY");
    console.error("\nPlease acquire cRECY tokens first, then run this script again.");
    process.exit(1);
  }

  // Check if already funded
  const distributedAmount = await recyclablesReward.distributedAmount();
  if (distributedAmount > 0) {
    console.log("⚠ RecyclablesReward already has distributed amount:", ethers.formatEther(distributedAmount), "cRECY");
    console.log("   Skipping funding (reserve already funded or partially used)");
  } else {
    // Approve cRECY spending
    console.log("\n1. Approving cRECY spending...");
    const approveTx = await cRECY.approve(CONTRACT_ADDRESSES.RECYCLABLES, RESERVE_AMOUNT);
    await approveTx.wait();
    console.log("✓ Approved", ethers.formatEther(RESERVE_AMOUNT), "cRECY");

    // Fund reserve
    console.log("\n2. Funding RecyclablesReward reserve...");
    const fundTx = await recyclablesReward.fundReserve(RESERVE_AMOUNT);
    await fundTx.wait();
    console.log("✓ Funded reserve with", ethers.formatEther(RESERVE_AMOUNT), "cRECY");

    // Verify funding
    const contractBalance = await cRECY.balanceOf(CONTRACT_ADDRESSES.RECYCLABLES);
    console.log("✓ RecyclablesReward contract balance:", ethers.formatEther(contractBalance), "cRECY");
  }

  // ============================================
  // STEP 3: Test Basic Functions
  // ============================================
  console.log("\n=== Testing Basic Functions ===");

  // Test DCUToken balance
  const dcuBalance = await dcuToken.balanceOf(deployer.address);
  console.log("✓ Your DCU balance:", ethers.formatEther(dcuBalance), "DCU");

  // Test ImpactProductNFT level
  const userLevel = await impactProductNFT.getUserLevel(deployer.address);
  console.log("✓ Your Impact Product level:", userLevel.toString());

  // Test RecyclablesReward reserve
  const reserveAvailable = await recyclablesReward.checkReserveAvailable();
  const remainingReserve = await recyclablesReward.getRemainingReserve();
  console.log("✓ Reserve available:", reserveAvailable);
  console.log("✓ Remaining reserve:", ethers.formatEther(remainingReserve), "cRECY");

  console.log("\n=== Setup Complete! ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

