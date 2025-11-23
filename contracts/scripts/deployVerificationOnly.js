const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying VerificationContract with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // Resolve dependency addresses from env
  const impactProductAddress =
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT_ADDRESS;

  const rewardDistributorAddress =
    process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT_ADDRESS;

  if (!impactProductAddress) {
    throw new Error("IMPACT_PRODUCT_CONTRACT_ADDRESS not set. Update contracts/.env with the ImpactProductNFT address.");
  }
  if (!rewardDistributorAddress) {
    throw new Error("REWARD_DISTRIBUTOR_CONTRACT_ADDRESS not set. Update contracts/.env with the RewardDistributor address.");
  }

  // Build verifier list (reuse logic from deploy script)
  let verifiers = [];
  if (process.env.VERIFIER_ADDRESSES) {
    verifiers = process.env.VERIFIER_ADDRESSES.split(",").map((addr) => addr.trim()).filter(Boolean);
  } else if (process.env.VERIFIER_TO_ADD) {
    verifiers = [process.env.VERIFIER_TO_ADD.trim()];
  } else if (process.env.VERIFIER_ADDRESS) {
    verifiers = [process.env.VERIFIER_ADDRESS.trim()];
  } else {
    throw new Error("Set VERIFIER_ADDRESSES in contracts/.env before deploying VerificationContract.");
  }
  if (verifiers.length === 0) {
    throw new Error("No verifier addresses provided.");
  }

  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || "0";
  const FEE_ENABLED = process.env.FEE_ENABLED === "true";

  console.log("\n=== VerificationContract Deployment Config ===");
  console.log("ImpactProductNFT:", impactProductAddress);
  console.log("RewardDistributor:", rewardDistributorAddress);
  console.log("Verifiers:", verifiers.join(", "));
  console.log("Submission Fee:", SUBMISSION_FEE, "(enabled:", FEE_ENABLED + ")");
  console.log("=============================================\n");

  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    verifiers,
    impactProductAddress,
    rewardDistributorAddress,
    SUBMISSION_FEE,
    FEE_ENABLED
  );
  await verificationContract.waitForDeployment();
  const verificationAddress = await verificationContract.getAddress();

  console.log("\n✓ VerificationContract deployed to:", verificationAddress);
  console.log("\nNext steps:");
  console.log("1. Update contracts/.env and app/.env.local with VERIFICATION/ NEXT_PUBLIC_VERIFICATION contract address.");
  console.log("2. Run scripts/addVerifier.js --network sepolia for each verifier (existing allowlist was not migrated).");
  console.log("3. Restart the frontend so wagmi picks up the new address.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

