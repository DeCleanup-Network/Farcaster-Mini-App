const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const VERIFICATION_ADDRESS = process.env.VERIFICATION_CONTRACT_ADDRESS;
  const verifierAddress = process.env.VERIFIER_ADDRESS || "0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84";
  
  console.log("=== Adding Verifier ===\n");
  console.log("Verification Contract:", VERIFICATION_ADDRESS);
  console.log("Verifier Address:", verifierAddress);
  console.log("");
  
  const [signer] = await ethers.getSigners();
  console.log("Using signer (owner):", signer.address);
  
  const VerificationContract = await ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);
  
  // Check if already verifier
  const isVerifier = await VerificationContract.verifiers(verifierAddress);
  console.log("Current verifier status:", isVerifier);
  console.log("");
  
  if (isVerifier) {
    console.log("✅ Already a verifier!");
    return;
  }
  
  // Add verifier
  console.log("Adding verifier...");
  const tx = await VerificationContract.addVerifier(verifierAddress);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✅ Verifier added!");
  
  // Verify
  const isVerifierNow = await VerificationContract.verifiers(verifierAddress);
  console.log("New verifier status:", isVerifierNow);
}

main().catch(console.error);
