const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔄 Redeploying VerificationContract with verifier rewards...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("");

  // Get addresses from environment or deployment files
  const fs = require("fs");
  
  let IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  
  let REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  // Try to load from deployment files
  if (!REWARD_DISTRIBUTOR_ADDRESS && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    REWARD_DISTRIBUTOR_ADDRESS = deployment.address;
    console.log("📂 Loaded bDCU Reward Distributor address from deployment file:", REWARD_DISTRIBUTOR_ADDRESS);
  }
  
  // Known addresses from previous deployments (fallback)
  if (!IMPACT_PRODUCT_ADDRESS) {
    IMPACT_PRODUCT_ADDRESS = "0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9"; // Known from checkContractOwners
    console.log("📂 Using known ImpactProductNFT address:", IMPACT_PRODUCT_ADDRESS);
  }
  
  const VERIFIER_ADDRESSES = process.env.VERIFIER_ADDRESSES 
    ? process.env.VERIFIER_ADDRESSES.split(',').map(addr => addr.trim())
    : process.env.VERIFIER_TO_ADD 
    ? [process.env.VERIFIER_TO_ADD.trim()]
    : process.env.VERIFIER_ADDRESS
    ? [process.env.VERIFIER_ADDRESS.trim()]
    : [];

  // Default to deployer if no verifiers specified
  if (VERIFIER_ADDRESSES.length === 0) {
    VERIFIER_ADDRESSES.push(deployer.address);
    console.log("⚠️  No verifier addresses found, using deployer address:", deployer.address);
  }

  // Calculate 2 cents USD in ETH (approximately 7,142,857,142,857 wei at $2,800/ETH)
  // Formula: $0.02 / ETH_price_in_USD * 1e18
  // Using approximate: 0.000007142857 ETH = 7,142,857,142,857 wei
  // For simplicity, we'll use 7,000,000,000,000 wei (~2 cents at current prices)
  const FEE_2_CENTS = "7000000000000"; // ~2 cents USD in wei
  
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || FEE_2_CENTS; // Default to 2 cents
  const FEE_ENABLED = process.env.FEE_ENABLED !== "false"; // Default to enabled
  
  const CLAIM_FEE = process.env.CLAIM_FEE || FEE_2_CENTS; // Default to 2 cents
  const CLAIM_FEE_ENABLED = process.env.CLAIM_FEE_ENABLED !== "false"; // Default to enabled

  if (!IMPACT_PRODUCT_ADDRESS || !REWARD_DISTRIBUTOR_ADDRESS) {
    console.error("\n❌ Missing required contract addresses:");
    if (!IMPACT_PRODUCT_ADDRESS) {
      console.error("   - IMPACT_PRODUCT_CONTRACT_ADDRESS (or NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT)");
    }
    if (!REWARD_DISTRIBUTOR_ADDRESS) {
      console.error("   - BDCU_REWARD_DISTRIBUTOR_ADDRESS (or NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS)");
      console.error("   - Or ensure bdcu-reward-distributor-deployment.json exists");
    }
    throw new Error("Missing required contract addresses. See errors above.");
  }

  console.log("Configuration:");
  console.log("  ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("  Reward Distributor:", REWARD_DISTRIBUTOR_ADDRESS);
  console.log("  Verifiers:", VERIFIER_ADDRESSES.join(", "));
  console.log("  Submission Fee:", SUBMISSION_FEE, "wei");
  console.log("  Fee Enabled:", FEE_ENABLED);
  console.log("  Claim Fee:", CLAIM_FEE, "wei (~2 cents USD)");
  console.log("  Claim Fee Enabled:", CLAIM_FEE_ENABLED);
  console.log("");

  // Deploy VerificationContract
  console.log("Deploying VerificationContract...");
  const VerificationContract = await hre.ethers.getContractFactory("VerificationContract");
  const verificationContract = await VerificationContract.deploy(
    VERIFIER_ADDRESSES,
    IMPACT_PRODUCT_ADDRESS,
    REWARD_DISTRIBUTOR_ADDRESS,
    SUBMISSION_FEE,
    FEE_ENABLED,
    CLAIM_FEE,
    CLAIM_FEE_ENABLED
  );
  
  await verificationContract.waitForDeployment();
  const verificationAddress = await verificationContract.getAddress();
  
  console.log("✅ VerificationContract deployed to:", verificationAddress);
  console.log("");

  // Link contracts
  console.log("Linking contracts...");
  
  // Set VerificationContract in ImpactProductNFT
  const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
  const tx1 = await ImpactProductNFT.setVerificationContract(verificationAddress);
  await tx1.wait();
  console.log("✅ Linked VerificationContract in ImpactProductNFT");
  
  // Set VerificationContract in RewardDistributor
  const RewardDistributor = await hre.ethers.getContractAt("bDCURewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
  const tx2 = await RewardDistributor.setVerificationContract(verificationAddress);
  await tx2.wait();
  console.log("✅ Linked VerificationContract in bDCURewardDistributor");
  
  console.log("");
  console.log("=== Deployment Complete ===");
  console.log("");
  console.log("📝 Update your .env files with:");
  console.log(`VERIFICATION_CONTRACT_ADDRESS=${verificationAddress}`);
  console.log("");
  console.log("Then update .env.local with:");
  console.log(`NEXT_PUBLIC_VERIFICATION_CONTRACT=${verificationAddress}`);
  console.log("");
  console.log("✅ VerificationContract now distributes verifier rewards (1 $bDCU per verification)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

