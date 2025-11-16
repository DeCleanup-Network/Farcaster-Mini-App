const { ethers } = require("hardhat");

/**
 * View all transactions related to a claim
 * 
 * Usage:
 *   npx hardhat run scripts/viewClaimTransactions.js --network sepolia
 * 
 * Or with a specific transaction hash:
 *   TRANSACTION_HASH=0x... npx hardhat run scripts/viewClaimTransactions.js --network sepolia
 */

async function main() {
  const transactionHash = process.env.TRANSACTION_HASH;
  
  if (!transactionHash) {
    console.log("=== Claim Transaction Viewer ===\n");
    console.log("To view a specific claim transaction, provide the transaction hash:");
    console.log("  TRANSACTION_HASH=0x... npx hardhat run scripts/viewClaimTransactions.js --network sepolia\n");
    console.log("Or visit CeloScan directly:");
    console.log("  1. Main transaction: https://sepolia.celoscan.io/tx/[TX_HASH]");
    console.log("  2. Click 'Internal Transactions' tab to see all internal calls\n");
    console.log("=== Contract Addresses ===");
    console.log("VerificationContract:", process.env.VERIFICATION_CONTRACT_ADDRESS || "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3");
    console.log("ImpactProductNFT:", process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS || "0x0F4193e25E3292e87970fa23c1555C8769A77278");
    console.log("RewardDistributor:", process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS || "0x66c0FEB0F2F881306ab57CA6eF4C691753184504");
    console.log("\n=== How to Find Claim Transactions ===");
    console.log("1. On CeloScan, go to VerificationContract:");
    console.log("   https://sepolia.celoscan.io/address/" + (process.env.VERIFICATION_CONTRACT_ADDRESS || "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3"));
    console.log("2. Click 'Transactions' tab");
    console.log("3. Look for 'claimImpactProduct' method calls");
    console.log("4. Click on any transaction to see details");
    console.log("5. Click 'Internal Transactions' tab to see:");
    console.log("   - ImpactProductNFT.claimLevelForUser() call");
    console.log("   - RewardDistributor.distributeLevelReward() call");
    return;
  }

  console.log("=== Analyzing Claim Transaction ===\n");
  console.log("Transaction Hash:", transactionHash);
  console.log("CeloScan URL: https://sepolia.celoscan.io/tx/" + transactionHash);
  console.log("\nThis transaction should trigger:");
  console.log("1. VerificationContract.claimImpactProduct()");
  console.log("   └─> ImpactProductNFT.claimLevelForUser()");
  console.log("       └─> RewardDistributor.distributeLevelReward()");
  console.log("\nTo see internal transactions, visit the CeloScan URL above");
  console.log("and click the 'Internal Transactions' tab.");
  
  // Try to get transaction receipt
  try {
    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      console.log("\n⚠️  Transaction not found or not yet confirmed.");
      return;
    }
    
    console.log("\n=== Transaction Details ===");
    console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("Block:", receipt.blockNumber);
    console.log("From:", receipt.from);
    console.log("To:", receipt.to);
    console.log("Gas Used:", receipt.gasUsed.toString());
    
    // Check if it's a call to VerificationContract
    const verificationContract = process.env.VERIFICATION_CONTRACT_ADDRESS || "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
    if (receipt.to?.toLowerCase() === verificationContract.toLowerCase()) {
      console.log("\n✅ This is a call to VerificationContract");
      console.log("   Check 'Internal Transactions' tab on CeloScan to see:");
      console.log("   - ImpactProductNFT interactions");
      console.log("   - RewardDistributor interactions");
    }
  } catch (error) {
    console.log("\n⚠️  Could not fetch transaction details:", error.message);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

