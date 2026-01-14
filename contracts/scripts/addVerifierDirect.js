const hre = require("hardhat");
require("dotenv").config();

/**
 * Directly add verifier using low-level call
 */
async function main() {
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const POINTS_DISTRIBUTOR = process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS || "0x3adf82A2e4998938B87C885d1D11011851cBeCc4";

  console.log("➕ Adding verifier directly...\n");
  console.log("Verifier address:", VERIFIER_ADDRESS);
  console.log("Contract address:", POINTS_DISTRIBUTOR);
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("");

  // Get the contract interface
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);

  // Check current status
  console.log("Checking current status...");
  try {
    const manuallyAdded = await distributor.manuallyAddedVerifiers(VERIFIER_ADDRESS);
    const isVerifier = await distributor.isVerifier(VERIFIER_ADDRESS);
    const checkIsVerifier = await distributor.checkIsVerifier(VERIFIER_ADDRESS);
    
    console.log("  manuallyAddedVerifiers:", manuallyAdded);
    console.log("  isVerifier:", isVerifier);
    console.log("  checkIsVerifier:", checkIsVerifier);
    console.log("");
  } catch (error) {
    console.log("  Error checking status:", error.message);
    console.log("");
  }

  // Add verifier
  console.log("Adding verifier...");
  try {
    const tx = await distributor.addVerifier(VERIFIER_ADDRESS);
    console.log("  Transaction hash:", tx.hash);
    console.log("  Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("  ✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("");
  } catch (error) {
    if (error.message.includes("Already a manual verifier")) {
      console.log("  ⚠️  Already a manual verifier");
    } else {
      console.error("  ❌ Error:", error.message);
      throw error;
    }
  }

  // Check status again
  console.log("Checking status after transaction...");
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for state to update
  
  try {
    const manuallyAdded = await distributor.manuallyAddedVerifiers(VERIFIER_ADDRESS);
    const isVerifier = await distributor.isVerifier(VERIFIER_ADDRESS);
    const checkIsVerifier = await distributor.checkIsVerifier(VERIFIER_ADDRESS);
    
    console.log("  manuallyAddedVerifiers:", manuallyAdded);
    console.log("  isVerifier:", isVerifier);
    console.log("  checkIsVerifier:", checkIsVerifier);
    console.log("");
    
    if (checkIsVerifier) {
      console.log("✅ Verifier successfully added!");
    } else {
      console.log("❌ Verifier status is still false. There may be an issue with the proxy.");
    }
  } catch (error) {
    console.log("  Error checking status:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

