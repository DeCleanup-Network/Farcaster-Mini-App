const { ethers } = require("hardhat");

/**
 * Redeploy All Contracts with Fixes
 * 
 * This script redeploys:
 * - ImpactProductNFT (with double slash fix)
 * - VerificationContract (with impact form reward fix)
 * - RecyclablesReward (with 5 cRECY reward instead of 10)
 * - Keeps existing RewardDistributor (no changes needed)
 * 
 * Usage:
 *   npx hardhat run scripts/redeployAll.js --network sepolia
 * 
 * Prerequisites:
 *   - Set PRIVATE_KEY in contracts/.env
 *   - Set VERIFIER_ADDRESSES in contracts/.env
 *   - Set REWARD_DISTRIBUTOR_CONTRACT_ADDRESS in contracts/.env (existing contract)
 *   - Set IMPACT_PRODUCT_BASE_URI in contracts/.env
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // Get verifier addresses
  let VERIFIER_ADDRESSES = [];
  
  if (process.env.VERIFIER_ADDRESSES) {
    VERIFIER_ADDRESSES = process.env.VERIFIER_ADDRESSES.split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
  } else if (process.env.VERIFIER_TO_ADD) {
    VERIFIER_ADDRESSES = [process.env.VERIFIER_TO_ADD.trim()];
  } else {
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

  // Get existing RewardDistributor address
  const REWARD_DISTRIBUTOR_ADDRESS = process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS;
  if (!REWARD_DISTRIBUTOR_ADDRESS || !ethers.isAddress(REWARD_DISTRIBUTOR_ADDRESS)) {
    throw new Error("REWARD_DISTRIBUTOR_CONTRACT_ADDRESS must be set in contracts/.env and must be a valid address");
  }

  console.log("\n=== Deployment Configuration ===");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("Verifiers:", VERIFIER_ADDRESSES.join(", "));
  console.log("Existing RewardDistributor:", REWARD_DISTRIBUTOR_ADDRESS);
  console.log("===============================\n");

  // Deployment parameters
  const IMPACT_PRODUCT_BASE_URI = process.env.IMPACT_PRODUCT_BASE_URI || "ipfs://bafybeigmwgkcqelpkohd3eqm2azw5k3ly6psfnaos5dztlklyybrvrsece/";
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE ? ethers.parseEther(process.env.SUBMISSION_FEE) : ethers.parseEther("0");
  const FEE_ENABLED = process.env.FEE_ENABLED === "true" || false;

  console.log("Deployment parameters:");
  console.log("  Impact Product Base URI:", IMPACT_PRODUCT_BASE_URI);
  console.log("  Submission Fee:", ethers.formatEther(SUBMISSION_FEE), "CELO");
  console.log("  Fee Enabled:", FEE_ENABLED);
  console.log("");

  // Step 1: Deploy ImpactProductNFT
  console.log("1. Deploying ImpactProductNFT (with double slash fix)...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = await ImpactProductNFT.deploy(
    "DeCleanup Impact Product",
    "DCU-IMPACT",
    IMPACT_PRODUCT_BASE_URI,
    VERIFIER_ADDRESSES[0]
  );
  await impactProductNFT.waitForDeployment();
  const impactProductNFTAddress = await impactProductNFT.getAddress();
  console.log("   ✓ ImpactProductNFT deployed to:", impactProductNFTAddress);

  // Step 2: Deploy VerificationContract
  console.log("\n2. Deploying VerificationContract (with impact form reward fix)...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES,
    impactProductNFTAddress,
    REWARD_DISTRIBUTOR_ADDRESS,
    SUBMISSION_FEE,
    FEE_ENABLED
  );
  await verificationContract.waitForDeployment();
  const verificationContractAddress = await verificationContract.getAddress();
  console.log("   ✓ VerificationContract deployed to:", verificationContractAddress);

  // Step 3: Deploy RecyclablesReward (with 5 cRECY reward)
  console.log("\n3. Deploying RecyclablesReward (with 5 cRECY reward)...");
  const RecyclablesReward = await ethers.getContractFactory("RecyclablesReward");
  const recyclablesReward = await RecyclablesReward.deploy(VERIFIER_ADDRESSES);
  await recyclablesReward.waitForDeployment();
  const recyclablesRewardAddress = await recyclablesReward.getAddress();
  console.log("   ✓ RecyclablesReward deployed to:", recyclablesRewardAddress);
  console.log("   ⚠ Note: Reward is now 5 cRECY (changed from 10)");
  console.log("   ⚠ Note: Reserve is 5000 cRECY - fund it after deployment");

  // Step 4: Link contracts together
  console.log("\n4. Linking contracts together...");
  
  // Set VerificationContract in ImpactProductNFT
  console.log("   Setting VerificationContract in ImpactProductNFT...");
  const setVerificationTx = await impactProductNFT.setVerificationContract(verificationContractAddress);
  await setVerificationTx.wait();
  console.log("   ✓ VerificationContract set in ImpactProductNFT");

  // Set RewardDistributor in ImpactProductNFT
  console.log("   Setting RewardDistributor in ImpactProductNFT...");
  const setRewardTx = await impactProductNFT.setRewardDistributor(REWARD_DISTRIBUTOR_ADDRESS);
  await setRewardTx.wait();
  console.log("   ✓ RewardDistributor set in ImpactProductNFT");

  // Step 5: Authorize VerificationContract in RewardDistributor
  console.log("\n5. Authorizing VerificationContract in RewardDistributor...");
  try {
    const RewardDistributor = await ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
    try {
      const addVerifierTx = await RewardDistributor.addVerifier(verificationContractAddress);
      await addVerifierTx.wait();
      console.log("   ✓ VerificationContract authorized in RewardDistributor");
    } catch (error) {
      console.warn("   ⚠ Could not add VerificationContract as verifier (may already be added)");
    }
  } catch (error) {
    console.warn("   ⚠ Could not interact with RewardDistributor:", error.message);
  }

  // Output deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nNew Contract Addresses:");
  console.log("  ImpactProductNFT:", impactProductNFTAddress);
  console.log("  VerificationContract:", verificationContractAddress);
  console.log("  RecyclablesReward:", recyclablesRewardAddress);
  console.log("\nExisting Contract Addresses (unchanged):");
  console.log("  RewardDistributor:", REWARD_DISTRIBUTOR_ADDRESS);
  console.log("\nCeloScan Links (Sepolia Testnet):");
  console.log("  ImpactProductNFT: https://sepolia.celoscan.io/address/" + impactProductNFTAddress);
  console.log("  VerificationContract: https://sepolia.celoscan.io/address/" + verificationContractAddress);
  console.log("  RecyclablesReward: https://sepolia.celoscan.io/address/" + recyclablesRewardAddress);
  console.log("\n📝 Next Steps:");
  console.log("1. Update .env.local with new contract addresses:");
  console.log("   NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT=" + impactProductNFTAddress);
  console.log("   NEXT_PUBLIC_VERIFICATION_CONTRACT=" + verificationContractAddress);
  console.log("   NEXT_PUBLIC_RECYCLABLES_CONTRACT=" + recyclablesRewardAddress);
  console.log("\n2. Fund RecyclablesReward with 5000 cRECY:");
  console.log("   npx hardhat run scripts/fundRecyclables.js --network sepolia");
  console.log("\n3. Restart your Next.js dev server");
  console.log("\n✅ All fixes included:");
  console.log("   - ImpactProductNFT: Double slash fix");
  console.log("   - VerificationContract: Impact form reward fix");
  console.log("   - RecyclablesReward: 5 cRECY reward (was 10)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

