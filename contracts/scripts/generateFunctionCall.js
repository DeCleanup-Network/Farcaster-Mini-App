const { ethers } = require("hardhat");

async function main() {
  const rewardDistributorAddress = "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  const newImpactNFTAddress = "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  
  // Get the ABI for the function
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const iface = RewardDistributor.interface;
  
  // Encode the function call
  const data = iface.encodeFunctionData("setImpactProductNFT", [newImpactNFTAddress]);
  
  console.log("=== Function Call Data for MetaMask ===");
  console.log("");
  console.log("To Address:", rewardDistributorAddress);
  console.log("Function: setImpactProductNFT");
  console.log("Parameter:", newImpactNFTAddress);
  console.log("");
  console.log("Hex Data (for MetaMask):");
  console.log(data);
  console.log("");
  console.log("=== How to Use in MetaMask ===");
  console.log("1. Open MetaMask");
  console.log("2. Click 'Send'");
  console.log("3. Paste To Address:", rewardDistributorAddress);
  console.log("4. Click 'Hex' tab");
  console.log("5. Paste Hex Data:", data);
  console.log("6. Send transaction");
  console.log("");
  console.log("⚠️  Make sure you're connected with owner address:");
  console.log("   0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84");
}

main().then(() => process.exit(0)).catch(console.error);
