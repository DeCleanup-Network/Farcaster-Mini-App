const hre = require("hardhat");
require("dotenv").config();

/**
 * Transfer tokens from old bDCURewardDistributor to new PointsRewardDistributor
 * 
 * This script:
 * 1. Checks the old contract's token balance
 * 2. Withdraws all tokens from the old contract (owner only)
 * 3. Transfers them to the new PointsRewardDistributor contract
 * 
 * Usage:
 *   npx hardhat run scripts/transferTokensFromOldDistributor.js --network baseSepolia
 */
async function main() {
  console.log("🔄 Transferring tokens from old to new distributor...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract addresses
  const OLD_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;

  const NEW_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  if (!OLD_DISTRIBUTOR_ADDRESS) {
    throw new Error("Old bDCURewardDistributor address not found. Set BDCU_REWARD_DISTRIBUTOR_ADDRESS");
  }

  if (!NEW_DISTRIBUTOR_ADDRESS) {
    throw new Error("New PointsRewardDistributor address not found. Set POINTS_REWARD_DISTRIBUTOR_ADDRESS");
  }

  console.log("Old Distributor (bDCURewardDistributor):", OLD_DISTRIBUTOR_ADDRESS);
  console.log("New Distributor (PointsRewardDistributor):", NEW_DISTRIBUTOR_ADDRESS);
  console.log("");

  // Get old distributor contract
  const OldDistributor = await hre.ethers.getContractFactory("bDCURewardDistributor");
  const oldDistributor = OldDistributor.attach(OLD_DISTRIBUTOR_ADDRESS);

  // Check if deployer is owner
  const owner = await oldDistributor.owner();
  console.log("Old contract owner:", owner);
  console.log("Deployer address:", deployer.address);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not the owner of the old contract. Owner is: ${owner}`);
  }

  // Get token address from old contract
  const tokenAddress = await oldDistributor.bDCUToken();
  console.log("Token address:", tokenAddress);
  console.log("");

  // Get token contract
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const token = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress);

  // Check old contract's token balance
  const oldContractBalance = await token.balanceOf(OLD_DISTRIBUTOR_ADDRESS);
  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();

  console.log("=== Step 1: Check Old Contract Balance ===");
  console.log("Old contract token balance:", hre.ethers.formatUnits(oldContractBalance, tokenDecimals), tokenSymbol);

  if (oldContractBalance === BigInt(0)) {
    console.log("⚠️  Old contract has no tokens to transfer.");
    return;
  }

  // Check new contract's current balance
  const newContractBalance = await token.balanceOf(NEW_DISTRIBUTOR_ADDRESS);
  console.log("New contract token balance (before):", hre.ethers.formatUnits(newContractBalance, tokenDecimals), tokenSymbol);
  console.log("");

  // Step 2: Withdraw tokens from old contract
  console.log("=== Step 2: Withdraw Tokens from Old Contract ===");
  console.log("Withdrawing all tokens from old contract...");
  
  try {
    const withdrawTx = await oldDistributor.withdrawTokens(oldContractBalance);
    console.log("Withdraw transaction hash:", withdrawTx.hash);
    await withdrawTx.wait();
    console.log("✅ Tokens withdrawn from old contract");
  } catch (error) {
    console.error("❌ Error withdrawing tokens:", error.message);
    throw error;
  }

  // Verify tokens are now in deployer's account
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log("Deployer token balance:", hre.ethers.formatUnits(deployerBalance, tokenDecimals), tokenSymbol);
  console.log("");

  // Step 3: Transfer tokens to new contract
  console.log("=== Step 3: Transfer Tokens to New Contract ===");
  console.log("Transferring tokens to new PointsRewardDistributor...");
  
  try {
    const transferTx = await token.transfer(NEW_DISTRIBUTOR_ADDRESS, oldContractBalance);
    console.log("Transfer transaction hash:", transferTx.hash);
    await transferTx.wait();
    console.log("✅ Tokens transferred to new contract");
  } catch (error) {
    console.error("❌ Error transferring tokens:", error.message);
    throw error;
  }

  // Verify final balances
  const finalOldBalance = await token.balanceOf(OLD_DISTRIBUTOR_ADDRESS);
  const finalNewBalance = await token.balanceOf(NEW_DISTRIBUTOR_ADDRESS);
  const finalDeployerBalance = await token.balanceOf(deployer.address);

  console.log("");
  console.log("=== Final Balances ===");
  console.log("Old contract balance:", hre.ethers.formatUnits(finalOldBalance, tokenDecimals), tokenSymbol);
  console.log("New contract balance:", hre.ethers.formatUnits(finalNewBalance, tokenDecimals), tokenSymbol);
  console.log("Deployer balance:", hre.ethers.formatUnits(finalDeployerBalance, tokenDecimals), tokenSymbol);
  console.log("");
  console.log("✅ Transfer complete! Users can now claim tokens from the new contract.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

