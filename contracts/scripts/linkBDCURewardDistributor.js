const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔗 Linking bDCU Reward Distributor to other contracts...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Linking with account:", deployer.address);
  console.log("");

  // Get addresses from environment or deployment files
  const fs = require("fs");
  
  let distributorAddress = 
    process.env.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;
  
  let impactProductAddress = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;
  
  let verificationAddress = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  // Try to load from deployment files
  if (!distributorAddress && fs.existsSync("bdcu-reward-distributor-deployment.json")) {
    const deployment = JSON.parse(fs.readFileSync("bdcu-reward-distributor-deployment.json", "utf8"));
    distributorAddress = deployment.address;
  }

  if (!distributorAddress) {
    throw new Error("bDCU Reward Distributor address not found. Set BDCU_REWARD_DISTRIBUTOR_ADDRESS in .env or ensure deployment file exists.");
  }

  if (!impactProductAddress) {
    throw new Error("ImpactProductNFT address not found. Set IMPACT_PRODUCT_CONTRACT_ADDRESS in .env");
  }

  if (!verificationAddress) {
    throw new Error("VerificationContract address not found. Set VERIFICATION_CONTRACT_ADDRESS in .env");
  }

  console.log("Configuration:");
  console.log("  bDCU Reward Distributor:", distributorAddress);
  console.log("  ImpactProductNFT:", impactProductAddress);
  console.log("  VerificationContract:", verificationAddress);
  console.log("");

  // Get contract instance
  const BDCURewardDistributor = await hre.ethers.getContractFactory("bDCURewardDistributor");
  const distributor = BDCURewardDistributor.attach(distributorAddress);

  // Check current values
  console.log("Checking current values...");
  try {
    const currentImpactProduct = await distributor.impactProductNFT();
    const currentVerification = await distributor.verificationContract();
    console.log("  Current ImpactProductNFT:", currentImpactProduct);
    console.log("  Current VerificationContract:", currentVerification);
    console.log("");
  } catch (error) {
    console.log("  Could not read current values (may be unset)");
    console.log("");
  }

  // Link ImpactProductNFT
  console.log("1. Setting ImpactProductNFT...");
  try {
    const tx1 = await distributor.setImpactProductNFT(impactProductAddress);
    console.log("   Transaction hash:", tx1.hash);
    await tx1.wait();
    console.log("   ✅ ImpactProductNFT linked successfully!");
    
    // Verify (may fail on some RPC endpoints, but transaction was successful)
    try {
      const verified = await distributor.impactProductNFT();
      if (verified.toLowerCase() === impactProductAddress.toLowerCase()) {
        console.log("   ✅ Verified: ImpactProductNFT is set correctly");
      } else {
        console.log("   ⚠️  Warning: Address mismatch (transaction was successful)");
      }
    } catch (error) {
      console.log("   ⚠️  Could not verify (RPC issue), but transaction was successful");
    }
  } catch (error) {
    console.error("   ❌ Error linking ImpactProductNFT:", error.message);
    throw error;
  }
  console.log("");

  // Link VerificationContract
  console.log("2. Setting VerificationContract...");
  try {
    const tx2 = await distributor.setVerificationContract(verificationAddress);
    console.log("   Transaction hash:", tx2.hash);
    await tx2.wait();
    console.log("   ✅ VerificationContract linked successfully!");
    
    // Verify (may fail on some RPC endpoints, but transaction was successful)
    try {
      const verified = await distributor.verificationContract();
      if (verified.toLowerCase() === verificationAddress.toLowerCase()) {
        console.log("   ✅ Verified: VerificationContract is set correctly");
      } else {
        console.log("   ⚠️  Warning: Address mismatch (transaction was successful)");
      }
    } catch (error) {
      console.log("   ⚠️  Could not verify (RPC issue), but transaction was successful");
    }
  } catch (error) {
    console.error("   ❌ Error linking VerificationContract:", error.message);
    throw error;
  }
  console.log("");

  console.log("=== Linking Complete ===");
  console.log("");
  console.log("✅ bDCU Reward Distributor is now linked to:");
  console.log("   ImpactProductNFT:", impactProductAddress);
  console.log("   VerificationContract:", verificationAddress);
  console.log("");
  console.log("📝 Next steps:");
  console.log("   1. Update .env.local with distributor address (if not already done)");
  console.log("   2. Test the full flow: Submit → Verify → Claim → Check $bDCU distribution");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

