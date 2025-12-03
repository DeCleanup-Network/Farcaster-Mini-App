const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== Checking Contract Owners ===\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Current deployer from PRIVATE_KEY:", deployer.address);
  console.log("");
  
  // Get contract addresses from env
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  const REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS;
  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;
  const BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS ||
    "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044"; // Test token we just deployed
  const BDCU_REWARD_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  const contracts = [
    { name: "ImpactProductNFT", address: IMPACT_PRODUCT_ADDRESS },
    { name: "RewardDistributor", address: REWARD_DISTRIBUTOR_ADDRESS },
    { name: "VerificationContract", address: VERIFICATION_ADDRESS },
    { name: "bDCU Token (Test)", address: BDCU_TOKEN_ADDRESS },
    { name: "bDCURewardDistributor", address: BDCU_REWARD_DISTRIBUTOR_ADDRESS },
  ];
  
  console.log("Checking contracts on:", hre.network.name);
  console.log("RPC URL:", hre.network.config.url || "default");
  console.log("");
  
  for (const contract of contracts) {
    if (!contract.address) {
      console.log(`⚠️  ${contract.name}: No address configured (skipping)`);
      continue;
    }
    
    try {
      // Try to get owner using Ownable interface
      const OwnableABI = [
        "function owner() external view returns (address)",
      ];
      
      const contractInstance = await hre.ethers.getContractAt(OwnableABI, contract.address);
      const owner = await contractInstance.owner();
      
      console.log(`✅ ${contract.name}:`);
      console.log(`   Address: ${contract.address}`);
      console.log(`   Owner:   ${owner}`);
      console.log(`   Match with current deployer: ${owner.toLowerCase() === deployer.address.toLowerCase() ? "✅ YES" : "❌ NO"}`);
      console.log(`   Match with test token deployer (0x7D85...): ${owner.toLowerCase() === "0x7D85fCbB505D48E6176483733b62b51704e0bF95".toLowerCase() ? "✅ YES" : "❌ NO"}`);
      console.log("");
    } catch (error) {
      // If owner() doesn't exist, try to get deployer from transaction history
      console.log(`⚠️  ${contract.name}:`);
      console.log(`   Address: ${contract.address}`);
      console.log(`   Error getting owner: ${error.message}`);
      console.log(`   (Contract may not use Ownable, or address may be invalid)`);
      console.log("");
    }
  }
  
  console.log("=== Summary ===");
  console.log("Current deployer (from PRIVATE_KEY):", deployer.address);
  console.log("Test token deployer:", "0x7D85fCbB505D48E6176483733b62b51704e0bF95");
  console.log("");
  console.log("💡 Tip: If contracts have different owners, you may need to:");
  console.log("   1. Update PRIVATE_KEY in contracts/.env to match the contract owner");
  console.log("   2. Or transfer ownership to a consistent address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

