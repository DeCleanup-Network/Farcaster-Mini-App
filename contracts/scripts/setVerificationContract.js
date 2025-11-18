const { ethers } = require("hardhat");

/**
 * Set VerificationContract address in ImpactProductNFT
 * 
 * This script fixes the authorization issue by setting the VerificationContract
 * address in the ImpactProductNFT contract, allowing it to call claimLevelForUser.
 * 
 * Usage:
 *   npx hardhat run scripts/setVerificationContract.js --network baseSepolia
 * 
 * Or set in contracts/.env:
 *   IMPACT_PRODUCT_CONTRACT_ADDRESS=0x...
 *   VERIFICATION_CONTRACT_ADDRESS=0x...
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting verification contract with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Get contract addresses from .env
  const impactProductNFTAddress = process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS 
    || process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT;
  
  const verificationContractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS
    || process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT;

  if (!impactProductNFTAddress) {
    throw new Error("ImpactProductNFT address required. Set IMPACT_PRODUCT_CONTRACT_ADDRESS in contracts/.env");
  }

  if (!verificationContractAddress) {
    throw new Error("VerificationContract address required. Set VERIFICATION_CONTRACT_ADDRESS in contracts/.env");
  }

  // Validate addresses
  if (!ethers.isAddress(impactProductNFTAddress)) {
    throw new Error(`Invalid ImpactProductNFT address: ${impactProductNFTAddress}`);
  }

  if (!ethers.isAddress(verificationContractAddress)) {
    throw new Error(`Invalid VerificationContract address: ${verificationContractAddress}`);
  }

  console.log("\n=== Configuration ===");
  console.log("ImpactProductNFT:", impactProductNFTAddress);
  console.log("VerificationContract:", verificationContractAddress);
  console.log("======================\n");

  // Get contract instances
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = ImpactProductNFT.attach(impactProductNFTAddress);

  // Check current verification contract address
  const currentVerificationContract = await impactProductNFT.verificationContract();
  console.log("Current verification contract:", currentVerificationContract);

  if (currentVerificationContract.toLowerCase() === verificationContractAddress.toLowerCase()) {
    console.log("✓ Verification contract is already set correctly. No action needed.");
    return;
  }

  // Set verification contract
  console.log("\nSetting verification contract in ImpactProductNFT...");
  const tx = await impactProductNFT.setVerificationContract(verificationContractAddress);
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✓ Transaction confirmed in block:", receipt.blockNumber);

  // Wait a bit for state to update
  console.log("Waiting for state to update...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify
  const newVerificationContract = await impactProductNFT.verificationContract();
  console.log("New verification contract:", newVerificationContract);
  
  if (newVerificationContract.toLowerCase() === verificationContractAddress.toLowerCase()) {
    console.log("✓ Verification successful! The address is now set correctly.");
  } else {
    console.warn("⚠ Address read doesn't match, but transaction succeeded. This might be a caching issue.");
    console.warn("   Please verify on BaseScan that the transaction emitted VerificationContractUpdated event.");
    console.warn("   Transaction:", `https://sepolia.basescan.org/tx/${tx.hash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

