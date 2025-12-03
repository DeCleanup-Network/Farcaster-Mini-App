const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== Redeploying VerificationContract with Enhanced Form Support ===\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "CELO\n");
  
  // Get contract addresses from environment (check multiple variable names)
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT_ADDRESS;
  const REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS;
  // Build verifier list (check multiple variable names)
  let VERIFIER_ADDRESSES = [];
  if (process.env.VERIFIER_ADDRESSES) {
    VERIFIER_ADDRESSES = process.env.VERIFIER_ADDRESSES.split(',').map(addr => addr.trim()).filter(Boolean);
  } else if (process.env.VERIFIER_TO_ADD) {
    VERIFIER_ADDRESSES = [process.env.VERIFIER_TO_ADD.trim()];
  } else if (process.env.VERIFIER_ADDRESS) {
    VERIFIER_ADDRESSES = [process.env.VERIFIER_ADDRESS.trim()];
  } else {
    VERIFIER_ADDRESSES = [deployer.address]; // Fallback to deployer
  }
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || "0";
  const FEE_ENABLED = process.env.FEE_ENABLED === "true";
  
  console.log("Configuration:");
  console.log("  Impact Product NFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("  Reward Distributor:", REWARD_DISTRIBUTOR_ADDRESS);
  console.log("  Verifiers:", VERIFIER_ADDRESSES);
  console.log("  Submission Fee:", SUBMISSION_FEE, "wei");
  console.log("  Fee Enabled:", FEE_ENABLED);
  console.log("");
  
  if (!IMPACT_PRODUCT_ADDRESS || !REWARD_DISTRIBUTOR_ADDRESS) {
    throw new Error("Missing required contract addresses in .env");
  }
  
  // Deploy VerificationContract
  console.log("Deploying VerificationContract...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES,
    IMPACT_PRODUCT_ADDRESS,
    REWARD_DISTRIBUTOR_ADDRESS,
    SUBMISSION_FEE,
    FEE_ENABLED
  );
  
  await verificationContract.waitForDeployment();
  const verificationAddress = await verificationContract.getAddress();
  
  console.log("✅ VerificationContract deployed to:", verificationAddress);
  console.log("");
  
  // Link contracts
  console.log("Linking contracts...");
  
  // Set VerificationContract in ImpactProductNFT
  const ImpactProductNFT = await ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
  const tx1 = await ImpactProductNFT.setVerificationContract(verificationAddress);
  await tx1.wait();
  console.log("✅ Linked VerificationContract in ImpactProductNFT");
  
  // Set VerificationContract in RewardDistributor (if needed)
  const RewardDistributor = await ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
  try {
    const tx2 = await RewardDistributor.setVerificationContract(verificationAddress);
    await tx2.wait();
    console.log("✅ Linked VerificationContract in RewardDistributor");
  } catch (error) {
    console.log("⚠️  Could not link in RewardDistributor (may not have this function):", error.message);
  }
  
  console.log("");
  console.log("=== Deployment Complete ===");
  console.log("");
  console.log("📝 Update your .env files with:");
  console.log(`VERIFICATION_CONTRACT_ADDRESS=${verificationAddress}`);
  console.log("");
  console.log("Then update .env.local with:");
  console.log(`NEXT_PUBLIC_VERIFICATION_CONTRACT=${verificationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
