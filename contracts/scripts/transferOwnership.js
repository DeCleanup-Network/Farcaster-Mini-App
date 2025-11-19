const { ethers } = require("hardhat");

/**
 * Transfer Ownership of VerificationContract
 *
 * This script transfers ownership of the VerificationContract to a new address.
 * This allows the new owner to withdraw fees collected from cleanup submissions.
 *
 * Usage:
 *   npx hardhat run scripts/transferOwnership.js --network baseSepolia
 *
 * Prerequisites:
 *   - Set PRIVATE_KEY in contracts/.env (current owner)
 *   - Set VERIFICATION_CONTRACT_ADDRESS in contracts/.env
 *   - Set NEW_OWNER_ADDRESS in contracts/.env (or pass as argument)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Transferring ownership with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const verificationContractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS;
  const newOwnerAddress = process.env.NEW_OWNER_ADDRESS || process.argv[process.argv.indexOf("--new-owner") + 1];

  if (!verificationContractAddress) {
    throw new Error("VERIFICATION_CONTRACT_ADDRESS must be set in .env");
  }

  if (!newOwnerAddress) {
    throw new Error("NEW_OWNER_ADDRESS must be set in .env or passed as --new-owner <address>");
  }

  // Validate address format
  if (!ethers.isAddress(newOwnerAddress)) {
    throw new Error(`Invalid address format: ${newOwnerAddress}`);
  }

  console.log("\n=== Configuration ===");
  console.log("VerificationContract:", verificationContractAddress);
  console.log("Current Owner:", deployer.address);
  console.log("New Owner:", newOwnerAddress);
  console.log("======================\n");

  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verificationContract = VerificationContract.attach(verificationContractAddress);

  // Check current owner
  const currentOwner = await verificationContract.owner();
  console.log("Current owner:", currentOwner);

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Current owner (${currentOwner}) does not match deployer (${deployer.address}). Cannot transfer.`);
  }

  if (currentOwner.toLowerCase() === newOwnerAddress.toLowerCase()) {
    console.log("✓ New owner is already the current owner. No action needed.");
    return;
  }

  // Transfer ownership
  console.log("\nTransferring ownership...");
  const tx = await verificationContract.transferOwnership(newOwnerAddress);
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✓ Transaction confirmed in block:", receipt.blockNumber);

  // Wait a bit for state to update
  console.log("Waiting for state to update...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify
  const newOwner = await verificationContract.owner();
  console.log("New owner:", newOwner);

  if (newOwner.toLowerCase() === newOwnerAddress.toLowerCase()) {
    console.log("✓ Ownership transfer successful!");
    console.log(`\nNew owner (${newOwnerAddress}) can now:`);
    console.log("  - Withdraw fees using withdrawFees()");
    console.log("  - Add/remove verifiers");
    console.log("  - Update contract settings");
  } else {
    console.warn("⚠ Address read doesn't match, but transaction succeeded. This might be a caching issue.");
    console.warn("   Please verify on BaseScan that the transaction emitted OwnershipTransferred event.");
    console.warn("   Transaction:", `https://sepolia.basescan.org/tx/${tx.hash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

