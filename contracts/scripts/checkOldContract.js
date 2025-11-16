const { ethers } = require("hardhat");

async function main() {
  const oldContractAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const newContractAddress = "0x3C92d06c1657c1E5E550cAb399ff8Fb9f8a5f8fc";
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  
  console.log("=== Checking Old Contract ===");
  const oldContract = VerificationContract.attach(oldContractAddress);
  const oldCounter = await oldContract.cleanupCounter();
  console.log("Old contract cleanup counter:", oldCounter.toString());
  
  console.log("\n=== Checking New Contract ===");
  const newContract = VerificationContract.attach(newContractAddress);
  const newCounter = await newContract.cleanupCounter();
  console.log("New contract cleanup counter:", newCounter.toString());
  
  console.log("\n=== Summary ===");
  console.log("Old contract has", oldCounter.toString(), "cleanups");
  console.log("New contract has", newCounter.toString(), "cleanups");
  
  if (oldCounter > BigInt(1)) {
    console.log("\n⚠️  Old contract has pending cleanups that need to be verified");
    console.log("   Old contract address:", oldContractAddress);
    console.log("   You can verify them by temporarily switching the frontend back to the old contract");
  }
}

main().then(() => process.exit(0)).catch(console.error);
