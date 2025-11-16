const { ethers } = require("hardhat");

/**
 * Add Verifier to Allowlist
 * 
 * This script adds a verifier address to the allowlist of all contracts.
 * Only the contract owner (deployer) can run this script.
 * 
 * Usage:
 *   node scripts/addVerifier.js --network sepolia --verifier 0x7d85fcbb505d48e6176483733b62b51704e0bf95
 * 
 * Or set in .env:
 *   VERIFIER_TO_ADD=0x7d85fcbb505d48e6176483733b62b51704e0bf95
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Adding verifier with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // Get verifier address from command line args or .env
  const verifierAddress = process.argv.find(arg => arg.startsWith('--verifier='))?.split('=')[1] 
    || process.env.VERIFIER_TO_ADD
    || process.argv[process.argv.indexOf('--verifier') + 1];

  if (!verifierAddress) {
    throw new Error("Verifier address required. Use --verifier 0x... or set VERIFIER_TO_ADD in .env");
  }

  // Validate address format
  if (!ethers.isAddress(verifierAddress)) {
    throw new Error(`Invalid address format: ${verifierAddress}`);
  }

  // Get contract addresses from .env or command line
  const verificationAddress = process.env.VERIFICATION_CONTRACT_ADDRESS 
    || process.argv.find(arg => arg.startsWith('--verification='))?.split('=')[1]
    || process.argv[process.argv.indexOf('--verification') + 1];

  const rewardDistributorAddress = process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS
    || process.argv.find(arg => arg.startsWith('--reward='))?.split('=')[1]
    || process.argv[process.argv.indexOf('--reward') + 1];

  const recyclablesAddress = process.env.RECYCLABLES_CONTRACT_ADDRESS
    || process.argv.find(arg => arg.startsWith('--recyclables='))?.split('=')[1]
    || process.argv[process.argv.indexOf('--recyclables') + 1];

  if (!verificationAddress) {
    throw new Error("VerificationContract address required. Set VERIFICATION_CONTRACT_ADDRESS in .env or use --verification 0x...");
  }

  console.log("\n=== Adding Verifier ===");
  console.log("Verifier address:", verifierAddress);
  console.log("VerificationContract:", verificationAddress);
  if (rewardDistributorAddress) console.log("RewardDistributor:", rewardDistributorAddress);
  if (recyclablesAddress) console.log("RecyclablesReward:", recyclablesAddress);
  console.log("========================\n");

  // Add verifier to VerificationContract
  console.log("1. Adding verifier to VerificationContract...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const verificationContract = VerificationContract.attach(verificationAddress);
  
  // Check if already a verifier (if function exists)
  let isAlreadyVerifier = false;
  try {
    isAlreadyVerifier = await verificationContract.isVerifier(verifierAddress);
    if (isAlreadyVerifier) {
      console.log("⚠ Verifier already added to VerificationContract");
    }
  } catch (error) {
    // If isVerifier doesn't exist, contract might be old - try addVerifier anyway
    console.log("⚠ isVerifier function not found, contract may be outdated. Attempting to add verifier...");
  }
  
  if (!isAlreadyVerifier) {
    try {
      const tx1 = await verificationContract.addVerifier(verifierAddress);
      await tx1.wait();
      console.log("✓ Verifier added to VerificationContract");
      console.log("  Transaction:", tx1.hash);
    } catch (error) {
      if (error.message.includes("does not have the function") || error.message.includes("is not a function")) {
        throw new Error(
          "Contract does not have addVerifier function. The contract at " + verificationAddress + 
          " appears to be an old version without the allowlist system. " +
          "You need to redeploy the contracts with the latest code."
        );
      }
      throw error;
    }
  }

  // Add verifier to RewardDistributor (if address provided)
  if (rewardDistributorAddress) {
    console.log("\n2. Adding verifier to RewardDistributor...");
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    const rewardDistributor = RewardDistributor.attach(rewardDistributorAddress);
    
    let isAlreadyVerifierRD = false;
    try {
      isAlreadyVerifierRD = await rewardDistributor.isVerifier(verifierAddress);
      if (isAlreadyVerifierRD) {
        console.log("⚠ Verifier already added to RewardDistributor");
      }
    } catch (error) {
      console.log("⚠ isVerifier function not found, attempting to add verifier...");
    }
    
    if (!isAlreadyVerifierRD) {
      try {
        const tx2 = await rewardDistributor.addVerifier(verifierAddress);
        await tx2.wait();
        console.log("✓ Verifier added to RewardDistributor");
        console.log("  Transaction:", tx2.hash);
      } catch (error) {
        console.warn("⚠ Could not add verifier to RewardDistributor:", error.message);
      }
    }
  }

  // Add verifier to RecyclablesReward (if address provided)
  if (recyclablesAddress) {
    console.log("\n3. Adding verifier to RecyclablesReward...");
    const RecyclablesReward = await ethers.getContractFactory("RecyclablesReward");
    const recyclablesReward = RecyclablesReward.attach(recyclablesAddress);
    
    let isAlreadyVerifierRR = false;
    try {
      isAlreadyVerifierRR = await recyclablesReward.isVerifier(verifierAddress);
      if (isAlreadyVerifierRR) {
        console.log("⚠ Verifier already added to RecyclablesReward");
      }
    } catch (error) {
      console.log("⚠ isVerifier function not found, attempting to add verifier...");
    }
    
    if (!isAlreadyVerifierRR) {
      try {
        const tx3 = await recyclablesReward.addVerifier(verifierAddress);
        await tx3.wait();
        console.log("✓ Verifier added to RecyclablesReward");
        console.log("  Transaction:", tx3.hash);
      } catch (error) {
        console.warn("⚠ Could not add verifier to RecyclablesReward:", error.message);
      }
    }
  }

  console.log("\n=== Verification ===");
  try {
    const finalCheck = await verificationContract.isVerifier(verifierAddress);
    console.log("Verifier status in VerificationContract:", finalCheck ? "✓ Authorized" : "✗ Not authorized");
  } catch (error) {
    console.log("⚠ Could not verify status (isVerifier function may not exist on contract)");
    console.log("  If the transaction succeeded, the verifier should be added.");
  }
  console.log("\n=== Complete! ===");
  console.log(`Verifier ${verifierAddress} has been added to the allowlist.`);
  console.log("You can now access the verifier dashboard at /verifier");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

