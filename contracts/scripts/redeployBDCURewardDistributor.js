const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔄 Redeploying bDCU Reward Distributor with verifier rewards...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get token address from env or use the test token
  const BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS ||
    "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044"; // Test token address

  if (!BDCU_TOKEN_ADDRESS) {
    throw new Error("bDCU Token address not found. Set BDCU_TOKEN_ADDRESS or NEXT_PUBLIC_BDCU_TOKEN_ADDRESS in .env");
  }

  console.log("Configuration:");
  console.log("  bDCU Token Address:", BDCU_TOKEN_ADDRESS);
  console.log("");

  // Deploy new bDCURewardDistributor
  console.log("Deploying bDCURewardDistributor (with verifier rewards)...");
  const BDCURewardDistributor = await hre.ethers.getContractFactory("bDCURewardDistributor");
  const rewardDistributor = await BDCURewardDistributor.deploy(BDCU_TOKEN_ADDRESS);
  
  await rewardDistributor.waitForDeployment();
  const distributorAddress = await rewardDistributor.getAddress();

  console.log("✅ bDCU Reward Distributor deployed!");
  console.log("New Distributor Address:", distributorAddress);
  console.log("");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    address: distributorAddress,
    tokenAddress: BDCU_TOKEN_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    features: ["verifier_rewards", "level_rewards", "streak_rewards", "referral_rewards", "impact_form_rewards"],
  };
  
  fs.writeFileSync(
    "bdcu-reward-distributor-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("📝 Next steps:");
  console.log("1. Link contracts:");
  console.log("   - Set ImpactProductNFT:", process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS || "from .env");
  console.log("   - Set VerificationContract:", process.env.VERIFICATION_CONTRACT_ADDRESS || "from .env");
  console.log("");
  console.log("2. Transfer tokens from old distributor to new one (if needed)");
  console.log("");
  console.log("3. Update contracts to use new distributor address");
  console.log("");
  console.log("✅ Deployment info saved to bdcu-reward-distributor-deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

