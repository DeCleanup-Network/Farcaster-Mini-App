const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const verifierAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  
  console.log("Deployer:", deployer.address);
  console.log("Contract:", contractAddress);
  console.log("Verifier:", verifierAddress);
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  // Check before
  const before = await contract.isVerifier(verifierAddress);
  console.log("\nBefore - isVerifier:", before);
  
  if (!before) {
    console.log("\nAdding verifier...");
    const tx = await contract.addVerifier(verifierAddress);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Block number:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    
    // Check after
    const after = await contract.isVerifier(verifierAddress);
    console.log("\nAfter - isVerifier:", after);
    
    if (after) {
      console.log("✅ Verifier added successfully!");
    } else {
      console.log("❌ Verifier was NOT added despite successful transaction!");
    }
  } else {
    console.log("\n⚠️  Verifier already added, but transaction is still failing.");
    console.log("This suggests the contract may have a bug or be an old version.");
    console.log("\nPossible solutions:");
    console.log("1. Redeploy the contract with the latest code");
    console.log("2. Check if the contract code matches the source code");
    console.log("3. Verify the contract on CeloScan to see the actual bytecode");
  }
}

main().then(() => process.exit(0)).catch(console.error);
