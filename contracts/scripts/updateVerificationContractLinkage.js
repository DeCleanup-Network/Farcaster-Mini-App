const hre = require("hardhat");
require("dotenv").config();

/**
 * Update VerificationContract to use new bDCURewardDistributor
 */
async function main() {
  console.log("🔗 Updating VerificationContract Linkage...\n");

  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;
  
  const BDCU_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  // Try to load from deployment files
  const fs = require("fs");
  let bdcuDistributorAddress = BDCU_DISTRIBUTOR_ADDRESS;
  if (!bdcuDistributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    bdcuDistributorAddress = deployment.address;
  }

  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }
  if (!bdcuDistributorAddress) {
    throw new Error("bDCURewardDistributor address not found");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Updating with account:", deployer.address);
  console.log("VerificationContract:", VERIFICATION_ADDRESS);
  console.log("New bDCURewardDistributor:", bdcuDistributorAddress);
  console.log("");

  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  // Check current value
  const currentDistributor = await VerificationContract.rewardDistributor();
  console.log("Current rewardDistributor:", currentDistributor);
  
  if (currentDistributor.toLowerCase() === bdcuDistributorAddress.toLowerCase()) {
    console.log("✅ Already linked to correct distributor!");
    return;
  }

  console.log("Updating rewardDistributor...");
  const tx = await VerificationContract.setRewardDistributor(bdcuDistributorAddress);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Successfully updated VerificationContract.rewardDistributor!");
  
  // Verify
  const newDistributor = await VerificationContract.rewardDistributor();
  console.log("New rewardDistributor:", newDistributor);
  
  if (newDistributor.toLowerCase() === bdcuDistributorAddress.toLowerCase()) {
    console.log("✅ Verification successful!");
  } else {
    console.log("❌ Verification failed!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

