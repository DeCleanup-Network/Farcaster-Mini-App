const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying bDCU Reward Distributor to Base Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get token address from env or use the test token we just deployed
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

  // Deploy bDCURewardDistributor
  console.log("Deploying bDCURewardDistributor...");
  const BDCURewardDistributor = await hre.ethers.getContractFactory("bDCURewardDistributor");
  const rewardDistributor = await BDCURewardDistributor.deploy(BDCU_TOKEN_ADDRESS);
  
  await rewardDistributor.waitForDeployment();
  const distributorAddress = await rewardDistributor.getAddress();

  console.log("✅ bDCU Reward Distributor deployed!");
  console.log("Distributor Address:", distributorAddress);
  console.log("");

  // Verify deployment (optional - may fail on some networks)
  try {
    const tokenAddress = await rewardDistributor.bDCUToken();
    console.log("✅ Verified token address:", tokenAddress);
    console.log("");
  } catch (error) {
    console.log("⚠️  Could not verify token address (deployment successful):", error.message);
    console.log("");
  }

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    address: distributorAddress,
    tokenAddress: BDCU_TOKEN_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "bdcu-reward-distributor-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("📝 Next steps:");
  console.log("1. Add to .env.local:");
  console.log(`   NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}`);
  console.log("");
  console.log("2. Transfer tokens to the distributor:");
  console.log("   npx hardhat run scripts/transferTokensToDistributor.js --network baseSepolia");
  console.log("");
  console.log("3. Link contracts (set ImpactProductNFT and VerificationContract):");
  console.log("   - Call setImpactProductNFT() with your ImpactProductNFT address");
  console.log("   - Call setVerificationContract() with your VerificationContract address");
  console.log("");
  console.log("✅ Deployment info saved to bdcu-reward-distributor-deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

