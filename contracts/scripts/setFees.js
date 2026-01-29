const hre = require("hardhat");
require("dotenv").config();

/**
 * Enable and set submission fee and/or claim fee on VerificationContract.
 * Fees are sent to feeTreasury (set at deploy) when users submit or claim.
 *
 * Env (optional):
 *   SUBMISSION_FEE_WEI  - e.g. 10000000000000 for 0.00001 ETH (~2.8 cents at $2800/ETH)
 *   SUBMISSION_FEE_ENABLED - "true" to enable submission fee
 *   CLAIM_FEE_WEI       - e.g. 10000000000000 for 0.00001 ETH (~2.8 cents); avoid ~0.0007 ETH (~$2)
 *   CLAIM_FEE_ENABLED   - "true" to enable claim fee
 *
 * Run: npx hardhat run scripts/setFees.js --network base
 */
async function main() {
  const VERIFICATION_ADDRESS =
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS;

  if (!VERIFICATION_ADDRESS) {
    throw new Error("Set VERIFICATION_CONTRACT_ADDRESS in contracts/.env");
  }

  const [deployer] = await hre.ethers.getSigners();
  const VerificationContract = await hre.ethers.getContractAt(
    "VerificationContract",
    VERIFICATION_ADDRESS
  );

  console.log("VerificationContract (proxy):", VERIFICATION_ADDRESS);
  console.log("Caller (must be owner):", deployer.address);
  console.log("");

  const submissionFeeWei = process.env.SUBMISSION_FEE_WEI || "0";
  const submissionFeeEnabled = process.env.SUBMISSION_FEE_ENABLED === "true";
  const claimFeeWei = process.env.CLAIM_FEE_WEI || "0";
  const claimFeeEnabled = process.env.CLAIM_FEE_ENABLED === "true";

  if (submissionFeeWei !== "0" || submissionFeeEnabled) {
    console.log("Setting submission fee:", submissionFeeWei, "wei, enabled:", submissionFeeEnabled);
    const tx1 = await VerificationContract.setSubmissionFee(submissionFeeWei, submissionFeeEnabled);
    await tx1.wait();
    console.log("  Tx:", tx1.hash);
    const [fee, enabled] = await VerificationContract.getSubmissionFee();
    console.log("  Current: fee =", fee.toString(), "wei, enabled =", enabled);
    console.log("");
  }

  if (claimFeeWei !== "0" || claimFeeEnabled) {
    console.log("Setting claim fee:", claimFeeWei, "wei, enabled:", claimFeeEnabled);
    const tx2 = await VerificationContract.setClaimFee(claimFeeWei, claimFeeEnabled);
    await tx2.wait();
    console.log("  Tx:", tx2.hash);
    const [fee, enabled] = await VerificationContract.getClaimFee();
    console.log("  Current: fee =", fee.toString(), "wei, enabled =", enabled);
    console.log("");
  }

  const treasury = await VerificationContract.feeTreasury();
  console.log("Fee treasury (fees go here):", treasury);
  if (treasury === "0x0000000000000000000000000000000000000000") {
    console.log("  ⚠️  Treasury not set. Run setFeeTreasury.js or setFeeTreasury(treasuryAddress) as owner.");
  }
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
