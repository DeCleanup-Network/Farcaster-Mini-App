const hre = require("hardhat");
require("dotenv").config();

/**
 * Withdraw fees to the contract OWNER (not the fee treasury).
 * Use this when the fee treasury is a contract that rejects plain ETH (causing withdrawFees to revert).
 *
 * Steps:
 * 1. Temporarily set fee treasury to zero so recipient = owner
 * 2. Call withdrawFees() → ETH goes to owner
 * 3. Restore fee treasury so future fees can go there again (if it was set)
 *
 * Must be run by the contract owner.
 *
 * Usage: npm run withdrawFeesToOwner:base
 */
async function main() {
  console.log("💰 Withdrawing fees to OWNER (bypassing fee treasury)...\n");

  const VERIFICATION_ADDRESS =
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    process.env.VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT;
  if (!VERIFICATION_ADDRESS) throw new Error("VerificationContract address not found");

  const [deployer] = await hre.ethers.getSigners();
  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  const owner = await VerificationContract.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Caller is not the contract owner. Owner: " + owner);
  }

  const balance = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
  if (balance === 0n) {
    console.log("⚠️  No fees to withdraw.");
    return;
  }

  const currentTreasury = await VerificationContract.feeTreasury();
  const treasurySet = currentTreasury && currentTreasury !== "0x0000000000000000000000000000000000000000";

  console.log("Contract:", VERIFICATION_ADDRESS);
  console.log("Owner (fees will go here):", owner);
  console.log("Contract balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Current fee treasury:", treasurySet ? currentTreasury : "(not set)");
  console.log("");

  if (treasurySet) {
    console.log("Step 1: Setting fee treasury to zero (so withdraw sends to owner)...");
    const tx1 = await VerificationContract.setFeeTreasury(hre.ethers.ZeroAddress);
    await tx1.wait();
    console.log("  Tx:", tx1.hash);
    console.log("  Done.\n");
  }

  console.log(treasurySet ? "Step 2: " : "Step 1: ", "Withdrawing fees to owner...");
  const tx2 = await VerificationContract.withdrawFees();
  await tx2.wait();
  console.log("  Tx:", tx2.hash);
  console.log("  ✅ Fees sent to owner.\n");

  if (treasurySet) {
    console.log("Step 3: Restoring fee treasury...");
    const tx3 = await VerificationContract.setFeeTreasury(currentTreasury);
    await tx3.wait();
    console.log("  Tx:", tx3.hash);
    console.log("  ✅ Fee treasury restored to", currentTreasury);
  }

  const balanceAfter = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
  console.log("\nContract balance after:", hre.ethers.formatEther(balanceAfter), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
