const hre = require("hardhat");
require("dotenv").config();

/**
 * Update bDCURewardDistributor to authorize ImpactProductNFT and VerificationContract
 */
async function main() {
  console.log("🔗 Updating bDCURewardDistributor Linkage...\n");

  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  
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

  if (!IMPACT_PRODUCT_ADDRESS) {
    throw new Error("ImpactProductNFT address not found");
  }
  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }
  if (!bdcuDistributorAddress) {
    throw new Error("bDCURewardDistributor address not found");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Updating with account:", deployer.address);
  console.log("bDCURewardDistributor:", bdcuDistributorAddress);
  console.log("ImpactProductNFT:", IMPACT_PRODUCT_ADDRESS);
  console.log("VerificationContract:", VERIFICATION_ADDRESS);
  console.log("");

  const BDCURewardDistributor = await hre.ethers.getContractAt("bDCURewardDistributor", bdcuDistributorAddress);

  // Check current values
  const currentIP = await BDCURewardDistributor.impactProductNFT();
  const currentVC = await BDCURewardDistributor.verificationContract();
  
  console.log("Current impactProductNFT:", currentIP);
  console.log("Current verificationContract:", currentVC);
  console.log("");

  let needsUpdate = false;

  // Update ImpactProductNFT if needed
  if (currentIP.toLowerCase() !== IMPACT_PRODUCT_ADDRESS.toLowerCase()) {
    console.log("Updating impactProductNFT...");
    const tx1 = await BDCURewardDistributor.setImpactProductNFT(IMPACT_PRODUCT_ADDRESS);
    console.log("Transaction hash:", tx1.hash);
    await tx1.wait();
    console.log("✅ Updated impactProductNFT!");
    needsUpdate = true;
  } else {
    console.log("✅ impactProductNFT already correct");
  }

  // Update VerificationContract if needed
  if (currentVC.toLowerCase() !== VERIFICATION_ADDRESS.toLowerCase()) {
    console.log("Updating verificationContract...");
    const tx2 = await BDCURewardDistributor.setVerificationContract(VERIFICATION_ADDRESS);
    console.log("Transaction hash:", tx2.hash);
    await tx2.wait();
    console.log("✅ Updated verificationContract!");
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
  const newIP = await BDCURewardDistributor.impactProductNFT();
  const newVC = await BDCURewardDistributor.verificationContract();
  
  if (newIP.toLowerCase() === IMPACT_PRODUCT_ADDRESS.toLowerCase() &&
      newVC.toLowerCase() === VERIFICATION_ADDRESS.toLowerCase()) {
    console.log("✅ Verification successful!");
  } else {
    console.log("❌ Verification failed!");
    console.log("   impactProductNFT:", newIP);
    console.log("   verificationContract:", newVC);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

