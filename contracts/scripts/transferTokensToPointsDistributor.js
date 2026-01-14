const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Transfer bDCU tokens from deployer wallet to PointsRewardDistributor contract
 * 
 * Usage:
 * TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferTokensToPointsDistributor.js --network baseSepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Transferring tokens with account:", deployer.address);
  console.log("");

  // Get contract addresses
  const BDCU_TOKEN_ADDRESS = process.env.BDCU_TOKEN_ADDRESS || process.env.TEST_BDCU_TOKEN_ADDRESS;
  const POINTS_DISTRIBUTOR_ADDRESS = process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS;
  
  if (!BDCU_TOKEN_ADDRESS) {
    throw new Error("BDCU_TOKEN_ADDRESS or TEST_BDCU_TOKEN_ADDRESS must be set in .env");
  }
  
  if (!POINTS_DISTRIBUTOR_ADDRESS) {
    throw new Error("POINTS_REWARD_DISTRIBUTOR_ADDRESS must be set in .env");
  }

  const TRANSFER_AMOUNT = process.env.TRANSFER_AMOUNT;
  if (!TRANSFER_AMOUNT) {
    throw new Error("TRANSFER_AMOUNT must be set (in wei, e.g., 1000000000000000000 for 1 token with 18 decimals)");
  }

  console.log("Configuration:");
  console.log("  bDCU Token:", BDCU_TOKEN_ADDRESS);
  console.log("  PointsRewardDistributor:", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("  Transfer Amount:", TRANSFER_AMOUNT, "wei");
  console.log("");

  // Get token contract
  const tokenAbi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)"
  ];
  const token = await ethers.getContractAt(tokenAbi, BDCU_TOKEN_ADDRESS);

  // Check deployer balance
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log("Deployer balance:", ethers.formatUnits(deployerBalance, 18), "tokens");
  console.log("");

  const transferAmount = BigInt(TRANSFER_AMOUNT);
  if (deployerBalance < transferAmount) {
    throw new Error(`Insufficient balance. Have: ${ethers.formatUnits(deployerBalance, 18)}, Need: ${ethers.formatUnits(transferAmount, 18)}`);
  }

  // Transfer tokens
  console.log("Transferring tokens...");
  const tx = await token.transfer(POINTS_DISTRIBUTOR_ADDRESS, transferAmount);
  console.log("  Transaction hash:", tx.hash);
  await tx.wait();
  console.log("  ✅ Tokens transferred successfully");
  console.log("");

  // Check new balances
  const newDeployerBalance = await token.balanceOf(deployer.address);
  const contractBalance = await token.balanceOf(POINTS_DISTRIBUTOR_ADDRESS);
  
  console.log("New balances:");
  console.log("  Deployer:", ethers.formatUnits(newDeployerBalance, 18), "tokens");
  console.log("  PointsRewardDistributor:", ethers.formatUnits(contractBalance, 18), "tokens");
  console.log("");
  console.log("✅ Transfer complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

