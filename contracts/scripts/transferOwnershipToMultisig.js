const hre = require("hardhat");
require("dotenv").config();

/**
 * Transfer contract ownership to multisig
 * Run this immediately after deployment
 */
async function main() {
  console.log("🔄 Transferring contract ownership to multisig...\n");

  const MULTISIG_ADDRESS = 
    process.env.MULTISIG_ADDRESS ||
    process.env.SAFE_ADDRESS;

  if (!MULTISIG_ADDRESS) {
    throw new Error("Multisig address not found. Set MULTISIG_ADDRESS or SAFE_ADDRESS in .env");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Current owner (deployer):", deployer.address);
  console.log("New owner (multisig):", MULTISIG_ADDRESS);
  console.log("");

  // Get contract addresses
  const fs = require("fs");
  
  let BDCU_DISTRIBUTOR_ADDRESS = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  let VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;
  
  let IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT;

  // Try to load from deployment files
  if (!BDCU_DISTRIBUTOR_ADDRESS && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    BDCU_DISTRIBUTOR_ADDRESS = deployment.address;
  }

  if (!BDCU_DISTRIBUTOR_ADDRESS) {
    throw new Error("bDCURewardDistributor address not found");
  }
  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }

  // Transfer bDCURewardDistributor ownership
  console.log("1. Transferring bDCURewardDistributor ownership...");
  try {
    const BDCURewardDistributor = await hre.ethers.getContractAt("bDCURewardDistributor", BDCU_DISTRIBUTOR_ADDRESS);
    const currentOwner = await BDCURewardDistributor.owner();
    console.log(`   Current owner: ${currentOwner}`);
    
    if (currentOwner.toLowerCase() === MULTISIG_ADDRESS.toLowerCase()) {
      console.log("   ✅ Already owned by multisig");
    } else {
      const tx1 = await BDCURewardDistributor.transferOwnership(MULTISIG_ADDRESS);
      console.log(`   Transaction hash: ${tx1.hash}`);
      await tx1.wait();
      console.log("   ✅ Ownership transferred!");
    }
  } catch (error) {
    console.error("   ❌ Error:", error.message);
  }
  console.log("");

  // Transfer VerificationContract ownership
  console.log("2. Transferring VerificationContract ownership...");
  try {
    const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);
    const currentOwner = await VerificationContract.owner();
    console.log(`   Current owner: ${currentOwner}`);
    
    if (currentOwner.toLowerCase() === MULTISIG_ADDRESS.toLowerCase()) {
      console.log("   ✅ Already owned by multisig");
    } else {
      const tx2 = await VerificationContract.transferOwnership(MULTISIG_ADDRESS);
      console.log(`   Transaction hash: ${tx2.hash}`);
      await tx2.wait();
      console.log("   ✅ Ownership transferred!");
    }
  } catch (error) {
    console.error("   ❌ Error:", error.message);
  }
  console.log("");

  // Transfer ImpactProductNFT ownership if address provided
  if (IMPACT_PRODUCT_ADDRESS) {
    console.log("3. Transferring ImpactProductNFT ownership...");
    try {
      const ImpactProductNFT = await hre.ethers.getContractAt("ImpactProductNFT", IMPACT_PRODUCT_ADDRESS);
      const currentOwner = await ImpactProductNFT.owner();
      console.log(`   Current owner: ${currentOwner}`);
      
      if (currentOwner.toLowerCase() === MULTISIG_ADDRESS.toLowerCase()) {
        console.log("   ✅ Already owned by multisig");
      } else {
        const tx3 = await ImpactProductNFT.transferOwnership(MULTISIG_ADDRESS);
        console.log(`   Transaction hash: ${tx3.hash}`);
        await tx3.wait();
        console.log("   ✅ Ownership transferred!");
      }
    } catch (error) {
      console.error("   ❌ Error:", error.message);
    }
    console.log("");
  }

  console.log("✅ Ownership transfer complete!");
  console.log("\n📝 Next steps:");
  console.log("   1. Verify ownership via: npx hardhat run scripts/checkContractOwners.js --network baseMainnet");
  console.log("   2. Update multisig signers if needed");
  console.log("   3. Test multisig control by calling a function that requires owner");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

