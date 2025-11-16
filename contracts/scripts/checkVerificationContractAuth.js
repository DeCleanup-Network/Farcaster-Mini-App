const { ethers } = require("hardhat");

async function main() {
  const verificationAddress = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const rewardDistributorAddress = "0x66c0FEB0F2F881306ab57CA6eF4C691753184504";
  
  console.log("=== Checking VerificationContract Authorization ===");
  console.log("VerificationContract:", verificationAddress);
  console.log("RewardDistributor:", rewardDistributorAddress);
  
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = RewardDistributor.attach(rewardDistributorAddress);
  
  // Check if VerificationContract is authorized as verifier
  const isVerifier = await rewardDistributor.verifiers(verificationAddress);
  console.log("\nIs VerificationContract a verifier in RewardDistributor:", isVerifier);
  
  // Check owner
  const owner = await rewardDistributor.owner();
  console.log("RewardDistributor owner:", owner);
  
  // Check if VerificationContract is the owner (it shouldn't be)
  console.log("Is VerificationContract the owner:", verificationAddress.toLowerCase() === owner.toLowerCase());
  
  if (!isVerifier && verificationAddress.toLowerCase() !== owner.toLowerCase()) {
    console.log("\n❌ PROBLEM FOUND!");
    console.log("The VerificationContract is NOT authorized to call RewardDistributor functions!");
    console.log("When VerificationContract calls rewardDistributor.distributeStreakReward(),");
    console.log("the RewardDistributor checks verifiers[msg.sender], which is the VerificationContract address.");
    console.log("Since VerificationContract is not in the verifier allowlist, the call fails.");
    console.log("\nSolution: Add VerificationContract address as a verifier in RewardDistributor");
  } else {
    console.log("\n✅ VerificationContract is authorized");
  }
}

main().then(() => process.exit(0)).catch(console.error);
