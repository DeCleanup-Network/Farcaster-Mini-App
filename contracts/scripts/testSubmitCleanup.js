const hre = require("hardhat");
require("dotenv").config();

/**
 * Test submitCleanup Function
 * 
 * This script tests if the VerificationContract's submitCleanup function is working correctly.
 * It will:
 * 1. Check contract address configuration
 * 2. Verify contract is deployed and accessible
 * 3. Test submitCleanup function signature
 * 4. Check contract linkages
 * 5. Simulate a submission (dry run)
 */
async function main() {
  console.log("🧪 Testing VerificationContract.submitCleanup...\n");

  // Get contract address
  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found. Set VERIFICATION_CONTRACT_ADDRESS or NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS in .env");
  }

  console.log("📋 Configuration:");
  console.log(`   VerificationContract: ${VERIFICATION_ADDRESS}`);
  console.log(`   Network: ${hre.network.name}\n`);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log("👤 Testing with account:", signer.address);
  console.log("   Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), "ETH\n");

  // Get contract instance
  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  // 1. Check if contract is accessible
  console.log("1️⃣ Checking contract accessibility...");
  try {
    const cleanupCounter = await VerificationContract.cleanupCounter();
    console.log(`   ✅ Contract is accessible`);
    console.log(`   Current cleanup counter: ${cleanupCounter.toString()}\n`);
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    throw new Error("Contract is not accessible. Check address and network.");
  }

  // 2. Check contract linkages
  console.log("2️⃣ Checking contract linkages...");
  try {
    const impactProductNFT = await VerificationContract.impactProductNFT();
    const rewardDistributor = await VerificationContract.rewardDistributor();
    console.log(`   ImpactProductNFT: ${impactProductNFT}`);
    console.log(`   RewardDistributor: ${rewardDistributor}`);
    
    if (impactProductNFT === hre.ethers.ZeroAddress) {
      console.log("   ⚠️  WARNING: ImpactProductNFT is zero address!");
    }
    if (rewardDistributor === hre.ethers.ZeroAddress) {
      console.log("   ⚠️  WARNING: RewardDistributor is zero address!");
    }
    console.log("   ✅ Linkages checked\n");
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // 3. Check fees
  console.log("3️⃣ Checking fee configuration...");
  try {
    const [submissionFee, feeEnabled] = await VerificationContract.getSubmissionFee();
    const [claimFee, claimFeeEnabled] = await VerificationContract.getClaimFee();
    console.log(`   Submission Fee: ${submissionFee.toString()} wei (enabled: ${feeEnabled})`);
    console.log(`   Claim Fee: ${claimFee.toString()} wei (enabled: ${claimFeeEnabled})`);
    console.log("   ✅ Fees checked\n");
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // 4. Check if user has already submitted
  console.log("4️⃣ Checking user submission status...");
  try {
    const hasSubmitted = await VerificationContract.hasSubmittedCleanup(signer.address);
    console.log(`   Has submitted before: ${hasSubmitted}`);
    console.log("   ✅ Status checked\n");
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // 5. Test submitCleanup function signature (dry run with estimateGas)
  console.log("5️⃣ Testing submitCleanup function signature...");
  try {
    // Test data
    const beforePhotoHash = "QmTestBefore123456789";
    const afterPhotoHash = "QmTestAfter123456789";
    const latitude = BigInt(90000000); // 90 * 1e6 (offset by 90)
    const longitude = BigInt(180000000); // 180 * 1e6 (offset by 180)
    const referrerAddress = hre.ethers.ZeroAddress; // No referrer for test
    const hasImpactForm = false;
    const impactReportHash = "";

    // Check if fee is required
    const [submissionFee, feeEnabled] = await VerificationContract.getSubmissionFee();
    const value = feeEnabled && submissionFee > 0 ? submissionFee : 0;

    console.log("   Test parameters:");
    console.log(`     beforePhotoHash: ${beforePhotoHash}`);
    console.log(`     afterPhotoHash: ${afterPhotoHash}`);
    console.log(`     latitude: ${latitude.toString()}`);
    console.log(`     longitude: ${longitude.toString()}`);
    console.log(`     referrerAddress: ${referrerAddress}`);
    console.log(`     hasImpactForm: ${hasImpactForm}`);
    console.log(`     impactReportHash: ${impactReportHash}`);
    console.log(`     value: ${value} wei`);

    // Estimate gas (this will fail if function signature is wrong)
    try {
      const gasEstimate = await VerificationContract.submitCleanup.estimateGas(
        beforePhotoHash,
        afterPhotoHash,
        latitude,
        longitude,
        referrerAddress,
        hasImpactForm,
        impactReportHash,
        { value }
      );
      console.log(`   ✅ Function signature is CORRECT`);
      console.log(`   Estimated gas: ${gasEstimate.toString()}\n`);
    } catch (estimateError) {
      console.log(`   ❌ ERROR estimating gas: ${estimateError.message}`);
      console.log(`   This indicates the function signature or parameters are incorrect!\n`);
      
      // Try to get more details
      if (estimateError.reason) {
        console.log(`   Reason: ${estimateError.reason}`);
      }
      if (estimateError.data) {
        console.log(`   Data: ${estimateError.data}`);
      }
      
      throw estimateError;
    }

    // 6. Check reward distributor interface
    console.log("6️⃣ Checking reward distributor interface...");
    try {
      const rewardDistributorAddress = await VerificationContract.rewardDistributor();
      if (rewardDistributorAddress !== hre.ethers.ZeroAddress) {
        const RewardDistributor = await hre.ethers.getContractAt("bDCURewardDistributor", rewardDistributorAddress);
        
        // Check if hasReceivedReferralReward function exists
        try {
          const hasReceived = await RewardDistributor.hasReceivedReferralReward(signer.address);
          console.log(`   ✅ hasReceivedReferralReward function exists`);
          console.log(`   User has received referral reward: ${hasReceived}\n`);
        } catch (error) {
          console.log(`   ⚠️  WARNING: hasReceivedReferralReward function may not exist: ${error.message}`);
          console.log(`   This could cause issues with referral logic!\n`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  WARNING: Could not check reward distributor: ${error.message}\n`);
    }

    console.log("✅ All checks passed! Contract appears to be configured correctly.");
    console.log("\n📝 If transactions are still failing, check:");
    console.log("   1. Network configuration (should be Base Sepolia - Chain ID 84532)");
    console.log("   2. Wallet has enough ETH for gas");
    console.log("   3. Contract address in .env.local matches deployed address");
    console.log("   4. Browser console for specific error messages");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    if (error.data) {
      console.error("   Data:", error.data);
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

