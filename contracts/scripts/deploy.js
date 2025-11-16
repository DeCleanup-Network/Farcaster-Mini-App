const { ethers } = require("hardhat");

/**
 * DeCleanup Network - Contract Deployment Script
 * 
 * Deployment Order:
 * 1. ImpactProductNFT (needs baseURI, verifier)
 * 2. RewardDistributor (needs impactProductNFT, verifier)
 * 3. VerificationContract (needs verifier, impactProductNFT, rewardDistributor)
 * 4. RecyclablesReward (needs verifier)
 * 
 * Post-Deployment Setup:
 * - Wire up contract references
 * - Fund RecyclablesReward with 5000 cRECY
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // ============================================
  // CONFIGURATION - Update these values
  // ============================================
  
  // Metadata CID from IPFS (your metadata folder)
  const METADATA_BASE_URI = "ipfs://bafybeigmwgkcqelpkohd3eqm2azw5k3ly6psfnaos5dztlklyybrvrsece/";
  
  // Verifier allowlist - read from .env file
  // Format in .env: VERIFIER_ADDRESSES=0x7d85fcbb505d48e6176483733b62b51704e0bf95,0xANOTHER_ADDRESS
  // Or: VERIFIER_TO_ADD=0x7d85fcbb505d48e6176483733b62b51704e0bf95 (single address)
  // You can add multiple addresses separated by commas
  let VERIFIER_ADDRESSES = [];
  
  if (process.env.VERIFIER_ADDRESSES) {
    // Split by comma and trim whitespace
    VERIFIER_ADDRESSES = process.env.VERIFIER_ADDRESSES.split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0); // Remove empty strings
  } else if (process.env.VERIFIER_TO_ADD) {
    // Support VERIFIER_TO_ADD (single address, used by addVerifier script)
    VERIFIER_ADDRESSES = [process.env.VERIFIER_TO_ADD.trim()];
  } else if (process.env.VERIFIER_ADDRESS) {
    // Backward compatibility: single verifier address
    VERIFIER_ADDRESSES = [process.env.VERIFIER_ADDRESS.trim()];
  } else {
    // Default fallback if nothing is set
    VERIFIER_ADDRESSES = ["0x7d85fcbb505d48e6176483733b62b51704e0bf95"];
    console.warn("⚠ Warning: No VERIFIER_ADDRESSES or VERIFIER_TO_ADD in .env, using default verifier");
  }
  
  // Validate that we have at least one verifier
  if (VERIFIER_ADDRESSES.length === 0) {
    throw new Error("At least one verifier address is required. Set VERIFIER_ADDRESSES in .env file.");
  }
  
  // Validate all addresses are valid (basic check)
  for (const addr of VERIFIER_ADDRESSES) {
    if (!addr.startsWith('0x') || addr.length !== 42) {
      throw new Error(`Invalid verifier address format: ${addr}. Must be a valid Ethereum address (0x followed by 40 hex characters)`);
    }
  }
  
  // Team and Community wallets (update these!)
  const TEAM_WALLET = process.env.TEAM_WALLET || deployer.address;
  const COMMUNITY_WALLET = process.env.COMMUNITY_WALLET || deployer.address;
  
  // NFT metadata
  const NFT_NAME = "DeCleanup Impact Product";
  const NFT_SYMBOL = "DCU-IMPACT";
  
  console.log("\n=== Deployment Configuration ===");
  console.log("Verifiers:", VERIFIER_ADDRESSES.join(", "));
  console.log("Team Wallet:", TEAM_WALLET);
  console.log("Community Wallet:", COMMUNITY_WALLET);
  console.log("Metadata URI:", METADATA_BASE_URI);
  console.log("===================================\n");

  // ============================================
  // STEP 1: Deploy ImpactProductNFT
  // ============================================
  console.log("\nStep 1: Deploying ImpactProductNFT...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  // ImpactProductNFT still uses single verifier (first one from array)
  const impactProductNFT = await ImpactProductNFT.deploy(
    NFT_NAME,
    NFT_SYMBOL,
    METADATA_BASE_URI,
    VERIFIER_ADDRESSES[0] // Use first verifier for ImpactProductNFT
  );
  await impactProductNFT.waitForDeployment();
  const impactProductNFTAddress = await impactProductNFT.getAddress();
  console.log("✓ ImpactProductNFT deployed to:", impactProductNFTAddress);

  // ============================================
  // STEP 2: Deploy RewardDistributor
  // ============================================
  console.log("\nStep 2: Deploying RewardDistributor...");
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = await RewardDistributor.deploy(
    impactProductNFTAddress,
    VERIFIER_ADDRESSES // Pass array of verifiers
  );
  await rewardDistributor.waitForDeployment();
  const rewardDistributorAddress = await rewardDistributor.getAddress();
  console.log("✓ RewardDistributor deployed to:", rewardDistributorAddress);

  // ============================================
  // STEP 3: Deploy VerificationContract
  // ============================================
  console.log("\nStep 3: Deploying VerificationContract...");
  
  // Optional: Set submission fee (in wei)
  // Set to 0 and false to disable fees (users only pay gas)
  // Example: 0.001 CELO = 1000000000000000 wei
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || "0"; // Default: no fee
  const FEE_ENABLED = process.env.FEE_ENABLED === "true"; // Default: disabled
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES, // Pass array of verifiers
    impactProductNFTAddress,
    rewardDistributorAddress,
    SUBMISSION_FEE,
    FEE_ENABLED
  );
  await verificationContract.waitForDeployment();
  const verificationContractAddress = await verificationContract.getAddress();
  console.log("✓ VerificationContract deployed to:", verificationContractAddress);
  console.log("  Submission fee:", SUBMISSION_FEE, "wei (enabled:", FEE_ENABLED + ")");

  // ============================================
  // STEP 4: Deploy RecyclablesReward
  // ============================================
  console.log("\nStep 4: Deploying RecyclablesReward...");
  const RecyclablesReward = await ethers.getContractFactory("RecyclablesReward");
  const recyclablesReward = await RecyclablesReward.deploy(VERIFIER_ADDRESSES); // Pass array of verifiers
  await recyclablesReward.waitForDeployment();
  const recyclablesRewardAddress = await recyclablesReward.getAddress();
  console.log("✓ RecyclablesReward deployed to:", recyclablesRewardAddress);

  // ============================================
  // POST-DEPLOYMENT SETUP
  // ============================================
  console.log("\n=== Post-Deployment Setup ===");

  // 1. Set rewardDistributor in ImpactProductNFT
  console.log("\n1. Setting rewardDistributor in ImpactProductNFT...");
  const setRewardDistributorNFTTx = await impactProductNFT.setRewardDistributor(rewardDistributorAddress);
  await setRewardDistributorNFTTx.wait();
  console.log("✓ RewardDistributor set in ImpactProductNFT");

  // ============================================
  // DEPLOYMENT SUMMARY
  // ============================================
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("ImpactProductNFT:", impactProductNFTAddress);
  console.log("RewardDistributor:", rewardDistributorAddress);
  console.log("VerificationContract:", verificationContractAddress);
  console.log("RecyclablesReward:", recyclablesRewardAddress);
  console.log("\n=== Next Steps ===");
  console.log("1. Fund RecyclablesReward with 5000 cRECY tokens:");
  console.log("   - Approve: cRECY.approve(" + recyclablesRewardAddress + ", 5000000000000000000000)");
  console.log("   - Fund: recyclablesReward.fundReserve(5000000000000000000000)");
  console.log("\n2. Update .env.local with contract addresses:");
  console.log("   NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT=" + impactProductNFTAddress);
  console.log("   NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=" + rewardDistributorAddress);
  console.log("   NEXT_PUBLIC_VERIFICATION_CONTRACT=" + verificationContractAddress);
  console.log("   NEXT_PUBLIC_RECYCLABLES_CONTRACT=" + recyclablesRewardAddress);
  console.log("\n3. Verify contracts on Celo Explorer (if needed)");
  console.log("\n=== Deployment Complete! ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

