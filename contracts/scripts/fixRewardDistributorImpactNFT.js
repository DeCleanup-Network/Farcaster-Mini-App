const { ethers } = require("hardhat");

async function main() {
  const rewardDistributorAddress = process.env.REWARD_DISTRIBUTOR_CONTRACT_ADDRESS || "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  const newImpactNFTAddress = process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS || "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No signer available. Check your PRIVATE_KEY in contracts/.env");
  }
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");
  
  console.log("\n=== Fixing RewardDistributor ImpactProductNFT Link ===\n");
  console.log("RewardDistributor:", rewardDistributorAddress);
  console.log("NEW ImpactProductNFT:", newImpactNFTAddress);
  console.log("");
  
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = RewardDistributor.attach(rewardDistributorAddress);
  
  // Check current value
  const currentImpactNFT = await rewardDistributor.impactProductNFT();
  console.log("Current ImpactProductNFT in RewardDistributor:", currentImpactNFT);
  console.log("Matches NEW ImpactProductNFT:", currentImpactNFT.toLowerCase() === newImpactNFTAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  if (currentImpactNFT.toLowerCase() === newImpactNFTAddress.toLowerCase()) {
    console.log("\n✅ Already set correctly! No action needed.");
    return;
  }
  
  // Check if deployer is owner
  const owner = await rewardDistributor.owner();
  console.log("\nOwner of RewardDistributor:", owner);
  console.log("Deployer is owner:", deployer.address.toLowerCase() === owner.toLowerCase() ? "✅ YES" : "❌ NO");
  
  if (deployer.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(
      `Deployer (${deployer.address}) is not the owner of RewardDistributor.\n` +
      `Owner is: ${owner}\n` +
      `You need to use the owner's private key to update this.`
    );
  }
  
  console.log("\nUpdating ImpactProductNFT address in RewardDistributor...");
  const tx = await rewardDistributor.setImpactProductNFT(newImpactNFTAddress);
  console.log("Transaction sent:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
  
  // Verify
  const updatedImpactNFT = await rewardDistributor.impactProductNFT();
  console.log("\nUpdated ImpactProductNFT in RewardDistributor:", updatedImpactNFT);
  console.log("✅ Matches NEW ImpactProductNFT:", updatedImpactNFT.toLowerCase() === newImpactNFTAddress.toLowerCase() ? "YES" : "NO");
  
  if (updatedImpactNFT.toLowerCase() === newImpactNFTAddress.toLowerCase()) {
    console.log("\n✅ SUCCESS! RewardDistributor is now linked to NEW ImpactProductNFT");
    console.log("   Claim transactions should now work correctly!");
  } else {
    console.log("\n⚠️  WARNING: Update may have failed. Check the transaction on CeloScan.");
    console.log("   Transaction hash:", tx.hash);
    console.log("   CeloScan URL: https://sepolia.celoscan.io/tx/" + tx.hash);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
