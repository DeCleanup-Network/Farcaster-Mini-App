const { ethers } = require("hardhat");

/**
 * Add VerificationContract as Verifier in RewardDistributor
 * 
 * This is required because when VerificationContract calls RewardDistributor functions,
 * the RewardDistributor checks verifiers[msg.sender], which is the VerificationContract address.
 * 
 * Usage:
 *   npx hardhat run scripts/addVerificationContractAsVerifier.js --network sepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // Get addresses from environment or use defaults
  // IMPORTANT: Update these addresses after redeploying contracts!
  const verificationAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT || "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const rewardDistributorAddress = process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT || "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  
  if (!verificationAddress || verificationAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("VERIFICATION_CONTRACT_ADDRESS must be set in contracts/.env");
  }
  
  if (!rewardDistributorAddress || rewardDistributorAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("REWARD_DISTRIBUTOR_CONTRACT_ADDRESS must be set in contracts/.env");
  }

  console.log("\n=== Adding VerificationContract as Verifier ===");
  console.log("VerificationContract:", verificationAddress);
  console.log("RewardDistributor:", rewardDistributorAddress);
  console.log("================================================\n");

  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = RewardDistributor.attach(rewardDistributorAddress);

  // Check if already a verifier
  const isAlreadyVerifier = await rewardDistributor.verifiers(verificationAddress);
  if (isAlreadyVerifier) {
    console.log("✓ VerificationContract is already a verifier in RewardDistributor");
    return;
  }

  // Check if deployer is owner
  const owner = await rewardDistributor.owner();
  if (deployer.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(
      `Deployer (${deployer.address}) is not the owner of RewardDistributor.\n` +
      `Owner is: ${owner}\n` +
      `You need to use the owner's private key to add verifiers.`
    );
  }

  console.log("Adding VerificationContract as verifier...");
  const tx = await rewardDistributor.addVerifier(verificationAddress);
  console.log("Transaction sent:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("✓ Transaction confirmed in block:", receipt.blockNumber);
  
  // Wait a bit for state to update
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verify
  const isNowVerifier = await rewardDistributor.verifiers(verificationAddress);
  console.log("\nVerification check result:", isNowVerifier);
  if (isNowVerifier) {
    console.log("\n✅ SUCCESS! VerificationContract is now authorized as a verifier in RewardDistributor");
    console.log("   Verification transactions should now work correctly.");
  } else {
    console.log("\n⚠️  WARNING: VerificationContract was not added. Check the transaction on CeloScan.");
    console.log("   Transaction hash:", tx.hash);
    console.log("   CeloScan URL: https://sepolia.celoscan.io/tx/" + tx.hash);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
