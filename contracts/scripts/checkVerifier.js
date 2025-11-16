const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const testAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  
  console.log("Checking verifier authorization...");
  console.log("Contract:", contractAddress);
  console.log("Verifier address:", testAddress);
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  // Check owner
  try {
    const owner = await contract.owner();
    console.log("\nContract owner:", owner);
  } catch (e) {
    console.log("Could not get owner:", e.message);
  }
  
  // Check isVerifier
  try {
    const isVerifier = await contract.isVerifier(testAddress);
    console.log("isVerifier result:", isVerifier);
  } catch (e) {
    console.log("isVerifier failed:", e.message);
  }
  
  // Check if address matches owner
  try {
    const owner = await contract.owner();
    const isOwner = owner.toLowerCase() === testAddress.toLowerCase();
    console.log("Is owner:", isOwner);
  } catch (e) {
    console.log("Could not check owner match");
  }
}

main().then(() => process.exit(0)).catch(console.error);
