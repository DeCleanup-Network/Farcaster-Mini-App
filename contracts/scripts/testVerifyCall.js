const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const verifierAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const cleanupId = 1;
  const level = 1;
  
  // Get a signer for the verifier address
  // Note: This won't work unless we have the private key, but we can at least check the encoding
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  console.log("=== Testing verifyCleanup Call ===");
  console.log("Contract:", contractAddress);
  console.log("Verifier:", verifierAddress);
  console.log("Cleanup ID:", cleanupId);
  console.log("Level:", level);
  
  // Check authorization
  const isVerifier = await contract.isVerifier(verifierAddress);
  console.log("\nisVerifier:", isVerifier);
  
  // Get the function selector
  const iface = new ethers.Interface(VerificationContract.interface);
  const data = iface.encodeFunctionData("verifyCleanup", [cleanupId, level]);
  console.log("\nEncoded function call:", data);
  console.log("Function selector:", data.slice(0, 10));
  
  // Expected selector for verifyCleanup(uint256,uint8) is 0x6fb14d99
  const expectedSelector = "0x6fb14d99";
  console.log("Expected selector:", expectedSelector);
  console.log("Match:", data.slice(0, 10).toLowerCase() === expectedSelector.toLowerCase());
  
  console.log("\n⚠️  To actually test the call, you need to:");
  console.log("   1. Import the verifier's private key");
  console.log("   2. Create a signer with that key");
  console.log("   3. Call verifyCleanup from that signer");
  console.log("\n   OR use MetaMask/your wallet to call it directly");
}

main().then(() => process.exit(0)).catch(console.error);
