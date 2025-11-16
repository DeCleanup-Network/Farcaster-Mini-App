const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  const impactNFTAddress = "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  const rewardDistributorAddress = "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  
  console.log("=== Checking All Authorizations ===\n");
  
  const ImpactNFT = await ethers.getContractAt("ImpactProductNFT", impactNFTAddress);
  const RewardDistributor = await ethers.getContractAt("RewardDistributor", rewardDistributorAddress);
  
  // Check 1: ImpactProductNFT -> VerificationContract
  console.log("1. ImpactProductNFT authorization check:");
  const verificationContractInNFT = await ImpactNFT.verificationContract();
  console.log("   verificationContract field:", verificationContractInNFT);
  console.log("   Matches VerificationContract:", verificationContractInNFT.toLowerCase() === verificationAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  // Check 2: RewardDistributor -> ImpactProductNFT
  console.log("\n2. RewardDistributor authorization check:");
  const impactNFTInRD = await RewardDistributor.impactProductNFT();
  console.log("   impactProductNFT field:", impactNFTInRD);
  console.log("   Matches ImpactProductNFT:", impactNFTInRD.toLowerCase() === impactNFTAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  // Check 3: Can ImpactProductNFT call RewardDistributor?
  console.log("\n3. Can ImpactProductNFT call RewardDistributor.distributeLevelReward?");
  console.log("   When ImpactProductNFT calls RewardDistributor.distributeLevelReward():");
  console.log("   RewardDistributor checks: msg.sender == impactProductNFT");
  console.log("   msg.sender will be:", impactNFTAddress);
  console.log("   impactProductNFT in RewardDistributor:", impactNFTInRD);
  console.log("   Match:", impactNFTInRD.toLowerCase() === impactNFTAddress.toLowerCase() ? "✅ Should work" : "❌ Will fail");
  
  // Check 4: Can VerificationContract call ImpactProductNFT?
  console.log("\n4. Can VerificationContract call ImpactProductNFT.claimLevelForUser?");
  console.log("   When VerificationContract calls ImpactProductNFT.claimLevelForUser():");
  console.log("   ImpactProductNFT checks: msg.sender == verificationContract || msg.sender == owner()");
  console.log("   msg.sender will be:", verificationAddress);
  console.log("   verificationContract in ImpactProductNFT:", verificationContractInNFT);
  console.log("   Match:", verificationContractInNFT.toLowerCase() === verificationAddress.toLowerCase() ? "✅ Should work" : "❌ Will fail");
  
  // Check owner
  try {
    const owner = await ImpactNFT.owner();
    console.log("   Owner of ImpactProductNFT:", owner);
    console.log("   VerificationContract is owner:", owner.toLowerCase() === verificationAddress.toLowerCase() ? "✅ YES (alternative)" : "❌ NO");
  } catch (e) {}
}

main().then(() => process.exit(0)).catch(console.error);
