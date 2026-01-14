const hre = require("hardhat");
require("dotenv").config();

/**
 * Transfer all tokens from old PointsRewardDistributor to new one
 * 
 * This script:
 * 1. Checks the old contract's token balance
 * 2. Withdraws all tokens from old contract to owner (deployer)
 * 3. Transfers all tokens from owner to new contract
 * 
 * Usage:
 *   npx hardhat run scripts/transferTokensFromOldToNew.js --network baseSepolia
 */
async function main() {
  console.log("🔄 Transferring all tokens from old to new PointsRewardDistributor...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Contract addresses
  const OLD_CONTRACT = "0xf0d87bFf397824D3CF9dcf7f400f8A7F78732F4f";
  const NEW_CONTRACT = "0x3adf82A2e4998938B87C885d1D11011851cBeCc4";
  const BDCU_TOKEN = "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044";

  console.log("Old Contract:", OLD_CONTRACT);
  console.log("New Contract:", NEW_CONTRACT);
  console.log("Token Address:", BDCU_TOKEN);
  console.log("");

  // Get token contract
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const token = await hre.ethers.getContractAt(ERC20_ABI, BDCU_TOKEN);
  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();

  // Get old contract
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const oldContract = PointsRewardDistributor.attach(OLD_CONTRACT);

  // Check owner
  const owner = await oldContract.owner();
  console.log("Old contract owner:", owner);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Error: Deployer is not the owner of old contract");
    console.log("   Owner is:", owner);
    console.log("   Deployer is:", deployer.address);
    process.exit(1);
  }

  // Check old contract balance
  const oldContractBalance = await token.balanceOf(OLD_CONTRACT);
  console.log("Old contract balance:", hre.ethers.formatUnits(oldContractBalance, tokenDecimals), tokenSymbol);

  if (oldContractBalance === 0n) {
    console.log("\n✅ Old contract has no tokens. Nothing to transfer.");
    process.exit(0);
  }

  // Check deployer balance before
  const deployerBalanceBefore = await token.balanceOf(deployer.address);
  console.log("Deployer balance (before):", hre.ethers.formatUnits(deployerBalanceBefore, tokenDecimals), tokenSymbol);
  console.log("");

  // Step 1: Withdraw all tokens from old contract to owner
  console.log("📤 Step 1: Withdrawing all tokens from old contract...");
  const withdrawTx = await oldContract.withdrawTokens(oldContractBalance);
  console.log("   Transaction hash:", withdrawTx.hash);
  await withdrawTx.wait();
  console.log("   ✅ Withdrawal confirmed!\n");

  // Verify withdrawal
  const oldContractBalanceAfter = await token.balanceOf(OLD_CONTRACT);
  const deployerBalanceAfter = await token.balanceOf(deployer.address);
  
  console.log("Old contract balance (after withdrawal):", hre.ethers.formatUnits(oldContractBalanceAfter, tokenDecimals), tokenSymbol);
  console.log("Deployer balance (after withdrawal):", hre.ethers.formatUnits(deployerBalanceAfter, tokenDecimals), tokenSymbol);
  console.log("");

  // Step 2: Transfer all tokens from deployer to new contract
  const amountToTransfer = deployerBalanceAfter - deployerBalanceBefore;
  console.log("📤 Step 2: Transferring", hre.ethers.formatUnits(amountToTransfer, tokenDecimals), tokenSymbol, "to new contract...");
  
  const transferTx = await token.transfer(NEW_CONTRACT, amountToTransfer);
  console.log("   Transaction hash:", transferTx.hash);
  await transferTx.wait();
  console.log("   ✅ Transfer confirmed!\n");

  // Verify final balances
  const newContractBalance = await token.balanceOf(NEW_CONTRACT);
  const deployerBalanceFinal = await token.balanceOf(deployer.address);

  console.log("=== Final Balances ===");
  console.log("Old contract:", hre.ethers.formatUnits(oldContractBalanceAfter, tokenDecimals), tokenSymbol);
  console.log("New contract:", hre.ethers.formatUnits(newContractBalance, tokenDecimals), tokenSymbol);
  console.log("Deployer:", hre.ethers.formatUnits(deployerBalanceFinal, tokenDecimals), tokenSymbol);
  console.log("");
  console.log("✅ Token migration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

