const hre = require("hardhat");
require("dotenv").config();

/**
 * Transfer tokens to PointsRewardDistributor Contract
 * 
 * This script transfers $bDCU tokens from the deployer (or specified address) 
 * to the PointsRewardDistributor contract for user claims.
 * 
 * Usage:
 *   npx hardhat run scripts/transferTokensToPointsDistributor.js --network baseSepolia
 * 
 * Environment variables:
 *   POINTS_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS
 *   BDCU_TOKEN_ADDRESS or NEXT_PUBLIC_BDCU_TOKEN_ADDRESS
 *   TRANSFER_AMOUNT (optional, in tokens, not wei)
 *   FROM_ADDRESS (optional, defaults to deployer)
 */
async function main() {
  console.log("💰 Transferring tokens to PointsRewardDistributor...\n");

  // Get addresses from environment or command line
  const POINTS_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS;

  const BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS;

  // Get transfer amount from environment variable
  // Usage: TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferTokensToPointsDistributor.js --network baseSepolia
  const TRANSFER_AMOUNT = process.env.TRANSFER_AMOUNT;
  const FROM_ADDRESS = process.env.FROM_ADDRESS;

  if (!POINTS_DISTRIBUTOR_ADDRESS) {
    console.error("❌ Error: PointsRewardDistributor address not found");
    console.log("Set POINTS_REWARD_DISTRIBUTOR_ADDRESS or NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS in .env");
    process.exit(1);
  }

  if (!BDCU_TOKEN_ADDRESS) {
    console.error("❌ Error: bDCU token address not found");
    console.log("Set BDCU_TOKEN_ADDRESS or NEXT_PUBLIC_BDCU_TOKEN_ADDRESS in .env");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const fromAddress = FROM_ADDRESS || deployer.address;

  console.log("From address:", fromAddress);
  console.log("Token address:", BDCU_TOKEN_ADDRESS);
  console.log("To (PointsRewardDistributor):", POINTS_DISTRIBUTOR_ADDRESS);
  console.log("");

  // Get token contract (assuming standard ERC20)
  // Try to get contract at address - it should be a standard ERC20
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const token = await hre.ethers.getContractAt(ERC20_ABI, BDCU_TOKEN_ADDRESS);

  // Get token info
  let tokenSymbol = "bDCU";
  let tokenDecimals = 18;
  try {
    tokenSymbol = await token.symbol();
    tokenDecimals = await token.decimals();
  } catch (error) {
    console.log("⚠️  Could not read token symbol/decimals, using defaults");
  }

  // Check balance
  const balance = await token.balanceOf(fromAddress);
  console.log(`Balance of ${fromAddress}:`, hre.ethers.formatUnits(balance, tokenDecimals), tokenSymbol);

  // Determine transfer amount
  let amountWei;
  if (TRANSFER_AMOUNT) {
    amountWei = hre.ethers.parseUnits(TRANSFER_AMOUNT, tokenDecimals);
    console.log("Transfer amount:", TRANSFER_AMOUNT, tokenSymbol);
  } else {
    // If no amount specified, ask user
    console.log("⚠️  No transfer amount specified.");
    console.log("Set TRANSFER_AMOUNT in .env or pass as first argument:");
    console.log("   npx hardhat run scripts/transferTokensToPointsDistributor.js --network baseSepolia <amount>");
    console.log("");
    console.log("Example: npx hardhat run scripts/transferTokensToPointsDistributor.js --network baseSepolia 1000000");
    process.exit(1);
  }

  if (balance < amountWei) {
    console.error("❌ Error: Insufficient balance");
    console.log("You have:", hre.ethers.formatUnits(balance, tokenDecimals), tokenSymbol);
    console.log("Trying to transfer:", hre.ethers.formatUnits(amountWei, tokenDecimals), tokenSymbol);
    process.exit(1);
  }

  // Check if fromAddress is the deployer
  if (fromAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("⚠️  Warning: Transferring from a different address than deployer.");
    console.log("   Make sure the FROM_ADDRESS has approved the deployer to spend tokens,");
    console.log("   or use the deployer's address directly.");
    console.log("");
  }

  // Transfer tokens
  console.log("\n📤 Transferring tokens...");
  
  // If transferring from deployer, use deployer's signer
  if (fromAddress.toLowerCase() === deployer.address.toLowerCase()) {
    const tx = await token.transfer(POINTS_DISTRIBUTOR_ADDRESS, amountWei);
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("✅ Transfer confirmed!\n");
  } else {
    // If transferring from a different address, we need that address to sign
    // This is more complex and might require a multisig transaction
    console.error("❌ Error: Cannot transfer from a different address without that address's private key.");
    console.log("   For multisig transfers, use the multisig wallet directly or approve this script.");
    console.log("   Alternatively, transfer from the deployer address.");
    process.exit(1);
  }

  // Verify balance
  const distributorBalance = await token.balanceOf(POINTS_DISTRIBUTOR_ADDRESS);
  const remainingBalance = await token.balanceOf(fromAddress);
  
  console.log("✅ Transfer complete!");
  console.log("   PointsRewardDistributor balance:", hre.ethers.formatUnits(distributorBalance, tokenDecimals), tokenSymbol);
  console.log("   Remaining balance:", hre.ethers.formatUnits(remainingBalance, tokenDecimals), tokenSymbol);
  console.log("");
  console.log("📝 Note: If transferring from multisig, you may need to execute this from the multisig wallet.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

