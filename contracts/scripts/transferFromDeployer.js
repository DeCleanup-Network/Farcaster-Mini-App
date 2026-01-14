const hre = require("hardhat");
require("dotenv").config();

/**
 * Simple script to transfer tokens from deployer wallet to PointsRewardDistributor
 * 
 * Usage:
 *   TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferFromDeployer.js --network baseSepolia
 * 
 * Or set TRANSFER_AMOUNT in .env file
 */
async function main() {
  console.log("💰 Transferring tokens from deployer to PointsRewardDistributor...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("ETH balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract addresses
  const POINTS_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  // Get token address - try from env, or use default testnet address
  let BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS ||
    "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044"; // Default testnet token address

  const TRANSFER_AMOUNT = process.env.TRANSFER_AMOUNT;

  if (!POINTS_DISTRIBUTOR_ADDRESS) {
    throw new Error("PointsRewardDistributor address not found. Set POINTS_REWARD_DISTRIBUTOR_ADDRESS");
  }

  if (!TRANSFER_AMOUNT) {
    console.error("❌ Error: TRANSFER_AMOUNT not specified");
    console.log("\nUsage:");
    console.log("  TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferFromDeployer.js --network baseSepolia");
    console.log("\nOr set TRANSFER_AMOUNT in your .env file");
    process.exit(1);
  }

  console.log("PointsRewardDistributor:", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("Token address:", BDCU_TOKEN_ADDRESS);
  console.log("Transfer amount:", TRANSFER_AMOUNT, "tokens\n");

  // Get token contract
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const token = await hre.ethers.getContractAt(ERC20_ABI, BDCU_TOKEN_ADDRESS);

  // Get token info
  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();

  // Check deployer balance
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log("Deployer token balance:", hre.ethers.formatUnits(deployerBalance, tokenDecimals), tokenSymbol);

  // Parse transfer amount
  const amountWei = hre.ethers.parseUnits(TRANSFER_AMOUNT, tokenDecimals);
  console.log("Transfer amount (wei):", amountWei.toString());

  if (deployerBalance < amountWei) {
    console.error("\n❌ Error: Insufficient balance");
    console.log("You have:", hre.ethers.formatUnits(deployerBalance, tokenDecimals), tokenSymbol);
    console.log("Trying to transfer:", hre.ethers.formatUnits(amountWei, tokenDecimals), tokenSymbol);
    process.exit(1);
  }

  // Check current contract balance
  const contractBalanceBefore = await token.balanceOf(POINTS_DISTRIBUTOR_ADDRESS);
  console.log("Contract balance (before):", hre.ethers.formatUnits(contractBalanceBefore, tokenDecimals), tokenSymbol);
  console.log("");

  // Transfer tokens
  console.log("📤 Transferring tokens...");
  const tx = await token.transfer(POINTS_DISTRIBUTOR_ADDRESS, amountWei);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✅ Transfer confirmed!\n");

  // Verify final balances
  const contractBalanceAfter = await token.balanceOf(POINTS_DISTRIBUTOR_ADDRESS);
  const deployerBalanceAfter = await token.balanceOf(deployer.address);

  console.log("=== Final Balances ===");
  console.log("Contract balance (after):", hre.ethers.formatUnits(contractBalanceAfter, tokenDecimals), tokenSymbol);
  console.log("Deployer balance (after):", hre.ethers.formatUnits(deployerBalanceAfter, tokenDecimals), tokenSymbol);
  console.log("");
  console.log("✅ Transfer complete! Users can now claim tokens.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

