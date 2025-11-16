const { ethers } = require("hardhat");

/**
 * Redeploy Contracts with Verifier Preset
 * 
 * This script redeploys all contracts with the verifier address already in the allowlist.
 * 
 * IMPORTANT: This creates NEW contract addresses. Existing data in old contracts will remain
 * in those contracts but won't be accessible through the new contracts.
 * 
 * Usage:
 *   npx hardhat run scripts/redeploy.js --network sepolia
 * 
 * Prerequisites:
 *   - Set PRIVATE_KEY in contracts/.env
 *   - Set VERIFIER_ADDRESSES in contracts/.env (or it will use default)
 * 
 * Note: Frontend uses .env.local (root directory) for NEXT_PUBLIC_* variables
 *       Contracts use contracts/.env for contract addresses used by scripts
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // Get verifier address from .env or use default
  let VERIFIER_ADDRESSES = [];
  
  if (process.env.VERIFIER_ADDRESSES) {
    VERIFIER_ADDRESSES = process.env.VERIFIER_ADDRESSES.split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
  } else if (process.env.VERIFIER_TO_ADD) {
    VERIFIER_ADDRESSES = [process.env.VERIFIER_TO_ADD.trim()];
  } else if (process.env.VERIFIER_ADDRESS) {
    VERIFIER_ADDRESSES = [process.env.VERIFIER_ADDRESS.trim()];
  } else {
    // Default verifier address
    VERIFIER_ADDRESSES = ["0x7d85fcbb505d48e6176483733b62b51704e0bf95"];
    console.warn("⚠ Warning: No VERIFIER_ADDRESSES in .env, using default verifier");
  }

  // Validate addresses
  for (const addr of VERIFIER_ADDRESSES) {
    if (!ethers.isAddress(addr)) {
      throw new Error(`Invalid verifier address: ${addr}`);
    }
  }

  if (VERIFIER_ADDRESSES.length === 0) {
    throw new Error("At least one verifier address is required. Set VERIFIER_ADDRESSES in .env file.");
  }

  console.log("\n=== Deployment Configuration ===");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("Verifiers:", VERIFIER_ADDRESSES.join(", "));
  console.log("===============================\n");

  // Deployment parameters
  const IMPACT_PRODUCT_BASE_URI = process.env.IMPACT_PRODUCT_BASE_URI || "ipfs://QmYourMetadataCID/";
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE ? ethers.parseEther(process.env.SUBMISSION_FEE) : ethers.parseEther("0");
  const FEE_ENABLED = process.env.FEE_ENABLED === "true" || false;

  console.log("Deployment parameters:");
  console.log("  Impact Product Base URI:", IMPACT_PRODUCT_BASE_URI);
  console.log("  Submission Fee:", ethers.formatEther(SUBMISSION_FEE), "CELO");
  console.log("  Fee Enabled:", FEE_ENABLED);
  console.log("");

  // Step 1: Deploy ImpactProductNFT
  console.log("1. Deploying ImpactProductNFT...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = await ImpactProductNFT.deploy(
    "DeCleanup Impact Product",
    "DCU-IMPACT",
    IMPACT_PRODUCT_BASE_URI,
    VERIFIER_ADDRESSES[0] // Use first verifier for ImpactProductNFT (legacy)
  );
  await impactProductNFT.waitForDeployment();
  const impactProductNFTAddress = await impactProductNFT.getAddress();
  console.log("   ✓ ImpactProductNFT deployed to:", impactProductNFTAddress);

  // Step 2: Deploy RewardDistributor
  console.log("\n2. Deploying RewardDistributor...");
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = await RewardDistributor.deploy(
    impactProductNFTAddress,
    VERIFIER_ADDRESSES // Pass array of verifiers
  );
  await rewardDistributor.waitForDeployment();
  const rewardDistributorAddress = await rewardDistributor.getAddress();
  console.log("   ✓ RewardDistributor deployed to:", rewardDistributorAddress);

  // Step 3: Deploy VerificationContract
  console.log("\n3. Deploying VerificationContract...");
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
  console.log("   ✓ VerificationContract deployed to:", verificationContractAddress);

  // Step 4: Deploy RecyclablesReward
  console.log("\n4. Deploying RecyclablesReward...");
  const RecyclablesReward = await ethers.getContractFactory("RecyclablesReward");
  const recyclablesReward = await RecyclablesReward.deploy(
    VERIFIER_ADDRESSES // Pass array of verifiers
  );
  await recyclablesReward.waitForDeployment();
  const recyclablesRewardAddress = await recyclablesReward.getAddress();
  console.log("   ✓ RecyclablesReward deployed to:", recyclablesRewardAddress);

  // Step 5: Setup contracts (link them together)
  console.log("\n5. Setting up contract relationships...");
  
  // Set RewardDistributor in ImpactProductNFT
  console.log("   Setting RewardDistributor in ImpactProductNFT...");
  const setRewardTx1 = await impactProductNFT.setRewardDistributor(rewardDistributorAddress);
  await setRewardTx1.wait();
  console.log("   ✓ RewardDistributor set in ImpactProductNFT");

  // Verify verifiers were added correctly
  console.log("\n6. Verifying verifier authorization...");
  for (const verifierAddr of VERIFIER_ADDRESSES) {
    try {
      const isVerifier = await verificationContract.isVerifier(verifierAddr);
      console.log(`   Verifier ${verifierAddr}: ${isVerifier ? "✓ Authorized" : "✗ Not authorized"}`);
      if (!isVerifier) {
        console.warn(`   ⚠ WARNING: Verifier ${verifierAddr} is not authorized!`);
      }
    } catch (error) {
      console.error(`   ✗ Error checking verifier ${verifierAddr}:`, error.message);
    }
  }

  // Output deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log("  ImpactProductNFT:", impactProductNFTAddress);
  console.log("  RewardDistributor:", rewardDistributorAddress);
  console.log("  VerificationContract:", verificationContractAddress);
  console.log("  RecyclablesReward:", recyclablesRewardAddress);
  
  console.log("\n📋 Next Steps:");
  console.log("1. Update your .env.local file with these addresses:");
  console.log("   NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT=" + impactProductNFTAddress);
  console.log("   NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=" + rewardDistributorAddress);
  console.log("   NEXT_PUBLIC_VERIFICATION_CONTRACT=" + verificationContractAddress);
  console.log("   NEXT_PUBLIC_RECYCLABLES_CONTRACT=" + recyclablesRewardAddress);
  
  console.log("\n2. Update contracts/.env with:");
  console.log("   VERIFICATION_CONTRACT_ADDRESS=" + verificationContractAddress);
  console.log("   REWARD_DISTRIBUTOR_CONTRACT_ADDRESS=" + rewardDistributorAddress);
  console.log("   RECYCLABLES_CONTRACT_ADDRESS=" + recyclablesRewardAddress);
  
  console.log("\n3. Restart your frontend to pick up the new addresses");
  
  console.log("\n⚠️  IMPORTANT:");
  console.log("   - Old contract data will remain in the old contracts");
  console.log("   - New submissions will go to the new contracts");
  console.log("   - If you need to migrate old data, you'll need a separate migration script");
  
  console.log("\n✅ Verifiers authorized:");
  VERIFIER_ADDRESSES.forEach(addr => {
    console.log("   - " + addr);
  });
  
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

