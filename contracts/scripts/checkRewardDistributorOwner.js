const { ethers } = require("hardhat");

async function main() {
  const rewardDistributorAddress = "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  const newImpactNFTAddress = "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  
  console.log("=== RewardDistributor Owner Check ===\n");
  
  const RewardDistributor = await ethers.getContractAt("RewardDistributor", rewardDistributorAddress);
  
  const owner = await RewardDistributor.owner();
  console.log("Owner of RewardDistributor:", owner);
  
  const currentImpactNFT = await RewardDistributor.impactProductNFT();
  console.log("Current ImpactProductNFT:", currentImpactNFT);
  console.log("NEW ImpactProductNFT:", newImpactNFTAddress);
  console.log("Match:", currentImpactNFT.toLowerCase() === newImpactNFTAddress.toLowerCase() ? "✅ YES" : "❌ NO - NEEDS UPDATE");
  
  if (currentImpactNFT.toLowerCase() !== newImpactNFTAddress.toLowerCase()) {
    console.log("\n⚠️  PROBLEM FOUND!");
    console.log("   RewardDistributor is linked to OLD ImpactProductNFT");
    console.log("   This causes 'Not authorized' error when claiming.");
    console.log("\n🔧 SOLUTION:");
    console.log("   Call RewardDistributor.setImpactProductNFT(" + newImpactNFTAddress + ")");
    console.log("   As owner:", owner);
    console.log("\n   You can do this by:");
    console.log("   1. Setting PRIVATE_KEY in contracts/.env to the owner's private key");
    console.log("   2. Running: npx hardhat run scripts/fixRewardDistributorImpactNFT.js --network sepolia");
    console.log("\n   Or manually call it from the owner's wallet on CeloScan:");
    console.log("   https://sepolia.celoscan.io/address/" + rewardDistributorAddress + "#writeContract");
    console.log("   Function: setImpactProductNFT");
    console.log("   Parameter: " + newImpactNFTAddress);
  }
}

main().then(() => process.exit(0)).catch(console.error);
