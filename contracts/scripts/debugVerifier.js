const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const verifierAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  console.log("=== Debugging Verifier Authorization ===");
  console.log("Contract:", contractAddress);
  console.log("Verifier:", verifierAddress);
  
  // Check isVerifier
  const isVerifier = await contract.isVerifier(verifierAddress);
  console.log("\n1. isVerifier() result:", isVerifier);
  
  // Check verifiers mapping directly
  const verifierMapping = await contract.verifiers(verifierAddress);
  console.log("2. verifiers mapping result:", verifierMapping);
  
  // Check owner
  const owner = await contract.owner();
  console.log("3. Contract owner:", owner);
  console.log("4. Is verifier the owner?", owner.toLowerCase() === verifierAddress.toLowerCase());
  
  // Try to simulate the verifyCleanup call
  console.log("\n5. Simulating verifyCleanup authorization check...");
  console.log("   verifiers[msg.sender] =", verifierMapping);
  console.log("   msg.sender == owner() =", owner.toLowerCase() === verifierAddress.toLowerCase());
  console.log("   Should pass:", verifierMapping || owner.toLowerCase() === verifierAddress.toLowerCase());
  
  // Check if contract has the function
  const code = await ethers.provider.getCode(contractAddress);
  console.log("\n6. Contract code length:", code.length);
}

main().then(() => process.exit(0)).catch(console.error);
