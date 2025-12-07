const hre = require("hardhat");
require("dotenv").config();

/**
 * Update ImpactProductNFT to use new bDCURewardDistributor and VerificationContract
 */
async function main() {
  console.log("🔗 Updating ImpactProductNFT Linkage...\n");

  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  
  const BDCU_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;
  
  // Try to load from deployment files
  const fs = require("fs");
  let bdcuDistributorAddress = BDCU_DISTRIBUTOR_ADDRESS;
  if (!bdcuDistributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    bdcuDistributorAddress = deployment.address;
  }

  if (!IMPACT_PRODUCT_ADDRESS) {
    throw new Error("ImpactProductNFT address not found");
  }
  if (!bdcuDistributorAddress) {
    throw new Error("bDCURewardDistributor address not found");
  }
  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Updating with account:", deployer.address);
  console.log("ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("New bDCURewardDistributor:", bdcuDistributorAddress);
  console.log("New VerificationContract:", VERIFICATION_ADDRESS);
  console.log("");

  const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);

  // Check current values
  const currentDistributor = await ImpactProductNFT.rewardDistributor();
  const currentVerification = await ImpactProductNFT.verificationContract();
  
  console.log("Current rewardDistributor:", currentDistributor);
  console.log("Current verificationContract:", currentVerification);
  console.log("");

  let needsUpdate = false;

  // Update rewardDistributor if needed
  if (currentDistributor.toLowerCase() !== bdcuDistributorAddress.toLowerCase()) {
    console.log("Updating rewardDistributor...");
    const tx1 = await ImpactProductNFT.setRewardDistributor(bdcuDistributorAddress);
    console.log("Transaction hash:", tx1.hash);
    await tx1.wait();
    console.log("✅ Successfully updated ImpactProductNFT.rewardDistributor!");
    needsUpdate = true;
  } else {
    console.log("✅ rewardDistributor already correct");
  }

  // Update verificationContract if needed
  if (currentVerification.toLowerCase() !== VERIFICATION_ADDRESS.toLowerCase()) {
    console.log("Updating verificationContract...");
    // Use getAddress() to ensure proper address format
    const verificationAddr = await hre.ethers.getAddress(VERIFICATION_ADDRESS);
    const tx2 = await ImpactProductNFT.setVerificationContract(verificationAddr);
    console.log("Transaction hash:", tx2.hash);
    await tx2.wait();
    console.log("✅ Successfully updated ImpactProductNFT.verificationContract!");
    needsUpdate = true;
  } else {
    console.log("✅ verificationContract already correct");
  }

  if (!needsUpdate) {
    console.log("\n✅ All linkages are already correct!");
    return;
  }

  // Verify
  console.log("\nVerifying updates...");
  const newDistributor = await ImpactProductNFT.rewardDistributor();
  const newVerification = await ImpactProductNFT.verificationContract();
  
  console.log("New rewardDistributor:", newDistributor);
  console.log("New verificationContract:", newVerification);
  
  if (newDistributor.toLowerCase() === bdcuDistributorAddress.toLowerCase() &&
      newVerification.toLowerCase() === VERIFICATION_ADDRESS.toLowerCase()) {
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

