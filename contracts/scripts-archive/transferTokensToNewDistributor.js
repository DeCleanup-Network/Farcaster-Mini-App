const hre = require("hardhat");
require("dotenv").config();

/**
 * Transfer tokens from old PointsRewardDistributor to new one
 * 
 * Usage:
 *   OLD_CONTRACT=0x... NEW_CONTRACT=0x... npx hardhat run scripts/transferTokensToNewDistributor.js --network baseSepolia
 */
async function main() {
  const OLD_CONTRACT = process.env.OLD_CONTRACT || "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  const NEW_CONTRACT = process.env.NEW_CONTRACT || process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  if (!NEW_CONTRACT) {
    throw new Error("New contract address not found. Set NEW_CONTRACT or POINTS_REWARD_DISTRIBUTOR_ADDRESS");
  }

  console.log("🔄 Transferring tokens from old to new PointsRewardDistributor...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Old contract:", OLD_CONTRACT);
  console.log("New contract:", NEW_CONTRACT);
  console.log("");

  // Get token address from old contract
  const OldDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const oldDistributor = OldDistributor.attach(OLD_CONTRACT);
  const tokenAddress = await oldDistributor.bDCUToken();
  console.log("Token address:", tokenAddress);

  // Get token contract
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];
  const token = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress);

  // Check balances
  const oldBalance = await token.balanceOf(OLD_CONTRACT);
  const newBalance = await token.balanceOf(NEW_CONTRACT);
  const decimals = await token.decimals();
  const symbol = await token.symbol();

  console.log("Old contract balance:", hre.ethers.formatUnits(oldBalance, decimals), symbol);
  console.log("New contract balance:", hre.ethers.formatUnits(newBalance, decimals), symbol);
  console.log("");

  if (oldBalance === BigInt(0)) {
    console.log("⚠️  Old contract has no tokens to transfer");
    return;
  }

  // Check if deployer is owner of old contract
  const oldOwner = await oldDistributor.owner();
  if (oldOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not the owner of old contract. Owner is: ${oldOwner}`);
  }

  // Withdraw from old contract
  console.log("📤 Withdrawing tokens from old contract...");
  const withdrawTx = await oldDistributor.withdrawTokens(oldBalance);
  console.log("Withdraw transaction hash:", withdrawTx.hash);
  await withdrawTx.wait();
  console.log("✅ Tokens withdrawn from old contract");

  // Transfer to new contract
  console.log("📤 Transferring tokens to new contract...");
  const transferTx = await token.transfer(NEW_CONTRACT, oldBalance);
  console.log("Transfer transaction hash:", transferTx.hash);
  await transferTx.wait();
  console.log("✅ Tokens transferred to new contract");

  // Verify
  const finalOldBalance = await token.balanceOf(OLD_CONTRACT);
  const finalNewBalance = await token.balanceOf(NEW_CONTRACT);

  console.log("");
  console.log("=== Final Balances ===");
  console.log("Old contract:", hre.ethers.formatUnits(finalOldBalance, decimals), symbol);
  console.log("New contract:", hre.ethers.formatUnits(finalNewBalance, decimals), symbol);
  console.log("");
  console.log("✅ Transfer complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

