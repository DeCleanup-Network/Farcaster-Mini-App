const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  
  const contractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const verifierAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  
  console.log("\n=== Force Adding Verifier ===");
  console.log("Contract:", contractAddress);
  console.log("Verifier:", verifierAddress);
  console.log("Deployer (owner):", deployer.address);
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  // Check current status
  try {
    const isVerifier = await contract.isVerifier(verifierAddress);
    console.log("\nCurrent isVerifier status:", isVerifier);
  } catch (e) {
    console.log("Could not check isVerifier:", e.message);
  }
  
  // Try to add verifier
  try {
    console.log("\nAttempting to add verifier...");
    const tx = await contract.addVerifier(verifierAddress);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    // Verify it was added
    const isVerifierAfter = await contract.isVerifier(verifierAddress);
    console.log("\nAfter adding - isVerifier:", isVerifierAfter);
    
    if (isVerifierAfter) {
      console.log("✅ Verifier successfully added!");
    } else {
      console.log("❌ Verifier was NOT added (transaction may have failed silently)");
    }
  } catch (error) {
    if (error.message.includes("already added")) {
      console.log("⚠ Verifier already in allowlist");
      // Check if it's actually true
      const isVerifier = await contract.isVerifier(verifierAddress);
      console.log("isVerifier check:", isVerifier);
      if (!isVerifier) {
        console.log("❌ ERROR: Contract says 'already added' but isVerifier returns false!");
        console.log("This suggests the contract may have a bug or be an old version.");
      }
    } else {
      console.error("Error adding verifier:", error.message);
      throw error;
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
