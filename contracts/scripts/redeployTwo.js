const { ethers } = require("hardhat");

/**
 * Redeploy Only VerificationContract and ImpactProductNFT
 * 
 * This script redeploys only these two contracts, keeping the existing
 * RewardDistributor and RecyclablesReward contracts.
 * 
 * IMPORTANT: 
 * - This creates NEW contract addresses for ImpactProductNFT and VerificationContract
 * - Existing data in old contracts will remain in those contracts
 * - You'll need to update the VerificationContract address in ImpactProductNFT
 * - You'll need to update the ImpactProductNFT address in VerificationContract
 * - You'll need to authorize VerificationContract in RewardDistributor
 * 
 * Usage:
 *   npx hardhat run scripts/redeployTwo.js --network sepolia
 * 
 * Prerequisites:
 *   - Set PRIVATE_KEY in contracts/.env
 *   - Set VERIFIER_ADDRESSES in contracts/.env (or it will use default)
 *   - Set REWARD_DISTRIBUTOR_CONTRACT_ADDRESS in contracts/.env (existing contract)
 *   - Set IMPACT_PRODUCT_BASE_URI in contracts/.env (or use default)
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

  // Step 2: Deploy VerificationContract
  console.log("\n2. Deploying VerificationContract...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES, // Pass array of verifiers
    impactProductNFTAddress,
    REWARD_DISTRIBUTOR_ADDRESS, // Use existing RewardDistributor
    SUBMISSION_FEE,
    FEE_ENABLED
  );
  await verificationContract.waitForDeployment();
  const verificationContractAddress = await verificationContract.getAddress();
  console.log("   ✓ VerificationContract deployed to:", verificationContractAddress);

  // Step 3: Link contracts together
  console.log("\n3. Linking contracts together...");
  
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

  // Step 4: Authorize VerificationContract in RewardDistributor
  console.log("\n4. Authorizing VerificationContract in RewardDistributor...");
  try {
    const RewardDistributor = await ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
    // Check if addVerifier function exists
    try {
      const addVerifierTx = await RewardDistributor.addVerifier(verificationContractAddress);
      await addVerifierTx.wait();
      console.log("   ✓ VerificationContract authorized in RewardDistributor");
    } catch (error) {
      console.warn("   ⚠ Could not add VerificationContract as verifier in RewardDistributor");
      console.warn("      You may need to run: npx hardhat run scripts/addVerificationContractAsVerifier.js --network sepolia");
      console.warn("      Error:", error.message);
    }
  } catch (error) {
    console.warn("   ⚠ Could not interact with RewardDistributor:", error.message);
  }

  // Step 5: Verify setup
  console.log("\n5. Verifying setup...");
  
  // Verify verifiers in VerificationContract
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

  // Verify VerificationContract is set in ImpactProductNFT
  try {
    const verificationContractInNFT = await impactProductNFT.verificationContract();
    if (verificationContractInNFT.toLowerCase() === verificationContractAddress.toLowerCase()) {
      console.log("   ✓ VerificationContract correctly linked in ImpactProductNFT");
    } else {
      console.warn(`   ⚠ VerificationContract mismatch! Expected: ${verificationContractAddress}, Got: ${verificationContractInNFT}`);
    }
  } catch (error) {
    console.warn("   ⚠ Could not verify VerificationContract link:", error.message);
  }

  // Output deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nNew Contract Addresses:");
  console.log("  ImpactProductNFT:", impactProductNFTAddress);
  console.log("  VerificationContract:", verificationContractAddress);
  console.log("\nExisting Contract Addresses (unchanged):");
  console.log("  RewardDistributor:", REWARD_DISTRIBUTOR_ADDRESS);
  
  console.log("\n📋 Next Steps:");
  console.log("1. Update your .env.local file with these addresses:");
  console.log("   NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT=" + impactProductNFTAddress);
  console.log("   NEXT_PUBLIC_VERIFICATION_CONTRACT=" + verificationContractAddress);
  console.log("   # Keep existing RewardDistributor address");
  
  console.log("\n2. Update contracts/.env with:");
  console.log("   IMPACT_PRODUCT_CONTRACT_ADDRESS=" + impactProductNFTAddress);
  console.log("   VERIFICATION_CONTRACT_ADDRESS=" + verificationContractAddress);
  
  console.log("\n3. If VerificationContract wasn't auto-authorized in RewardDistributor, run:");
  console.log("   npx hardhat run scripts/addVerificationContractAsVerifier.js --network sepolia");
  console.log("   (Update the script to use the new VerificationContract address)");
  
  console.log("\n4. Restart your frontend to pick up the new addresses");
  
  console.log("\n⚠️  IMPORTANT:");
  console.log("   - Old contract data will remain in the old contracts");
  console.log("   - New submissions will go to the new contracts");
  console.log("   - Users will need to claim from the new VerificationContract");
  
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

