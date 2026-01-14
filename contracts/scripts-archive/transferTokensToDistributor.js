const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("💰 Transferring test tokens to Reward Distributor...\n");

  // Get addresses from environment, deployment file, or command line
  const fs = require("fs");
  let tokenAddress = process.env.TEST_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS;
  let distributorAddress = process.env.REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  // Try to load from deployment files
  if (!tokenAddress && fs.existsSync("test-token-deployment.json")) {
    const testTokenDeployment = JSON.parse(fs.readFileSync("test-token-deployment.json", "utf8"));
    tokenAddress = testTokenDeployment.tokenAddress;
  }
  if (!distributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const distributorDeployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    distributorAddress = distributorDeployment.address;
  }
  
  // Fallback to command line args
  tokenAddress = tokenAddress || process.argv[2];
  distributorAddress = distributorAddress || process.argv[3];
  const amount = process.env.TRANSFER_AMOUNT || process.argv[4] || "100000"; // Default: 100k tokens

  if (!tokenAddress || !distributorAddress) {
    console.error("❌ Error: Missing required addresses");
    console.log("Usage: npx hardhat run scripts/transferTokensToDistributor.js --network baseSepolia");
    console.log("Or set in .env:");
    console.log("  TEST_TOKEN_ADDRESS=0x...");
    console.log("  REWARD_DISTRIBUTOR_ADDRESS=0x...");
    console.log("  TRANSFER_AMOUNT=100000 (optional, default: 100000)");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Transferring from:", deployer.address);
  console.log("Token Address:", tokenAddress);
  console.log("Distributor Address:", distributorAddress);
  console.log("Amount:", amount, "tokens\n");

  // Get token contract
  const TestBDCUToken = await hre.ethers.getContractFactory("TestBDCUToken");
  const token = TestBDCUToken.attach(tokenAddress);

  // Check balance
  const balance = await token.balanceOf(deployer.address);
  console.log("Your token balance:", hre.ethers.formatEther(balance), "bDCU");

  // Convert amount to wei (18 decimals)
  const amountWei = hre.ethers.parseEther(amount);
  
  if (balance < amountWei) {
    console.error("❌ Error: Insufficient balance");
    console.log("You have:", hre.ethers.formatEther(balance), "bDCU");
    console.log("Trying to transfer:", amount, "bDCU");
    process.exit(1);
  }

  // Transfer tokens
  console.log("\n📤 Transferring tokens...");
  const tx = await token.transfer(distributorAddress, amountWei);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Transfer confirmed!\n");

  // Verify balance
  const distributorBalance = await token.balanceOf(distributorAddress);
  console.log("Distributor contract balance:", hre.ethers.formatEther(distributorBalance), "bDCU");
  console.log("Your remaining balance:", hre.ethers.formatEther(await token.balanceOf(deployer.address)), "bDCU");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

