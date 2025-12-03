const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Test bDCU Token to Base Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "\n");

  // Deploy TestBDCUToken
  const TestBDCUToken = await hre.ethers.getContractFactory("TestBDCUToken");
  const testToken = await TestBDCUToken.deploy();
  
  await testToken.waitForDeployment();
  const tokenAddress = await testToken.getAddress();

  console.log("✅ Test bDCU Token deployed!");
  console.log("Token Address:", tokenAddress);
  console.log("Token Name:", await testToken.name());
  console.log("Token Symbol:", await testToken.symbol());
  console.log("Total Supply:", (await testToken.totalSupply()).toString(), "\n");

  // Verify deployment
  const deployerBalance = await testToken.balanceOf(deployer.address);
  console.log("Deployer balance:", deployerBalance.toString());
  console.log("Deployer balance (formatted):", hre.ethers.formatEther(deployerBalance), "bDCU\n");

  console.log("📝 Next steps:");
  console.log("1. Add to .env.local:");
  console.log(`   NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=${tokenAddress}`);
  console.log("2. Transfer some tokens to your reward distributor contract");
  console.log("3. Test the full flow on Base Sepolia\n");

  // Save to a file for easy reference
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    tokenAddress: tokenAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "test-token-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("✅ Deployment info saved to test-token-deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

