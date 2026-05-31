const hre = require("hardhat");
require("dotenv").config();

/**
 * Refund fees to a user WITHOUT upgrading the contract.
 * Step 1: Withdraw contract fees to owner (withdrawFees).
 * Step 2: If fees went to the deployer (no fee treasury), send that amount to REFUND_RECIPIENT.
 * If fee treasury is set, fees go there and this script only does step 1; you then send from treasury to the user.
 *
 * Usage:
 *   REFUND_RECIPIENT=0x7D85fCbB505D48E6176483733b62b51704e0bF95 npm run withdrawFeesThenSendTo:base
 */
async function main() {
  const recipient = process.env.REFUND_RECIPIENT;
  if (!recipient || !hre.ethers.isAddress(recipient)) {
    throw new Error("Set REFUND_RECIPIENT (e.g. 0x7D85fCbB505D48E6176483733b62b51704e0bF95)");
  }

  const VERIFICATION_ADDRESS =
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    process.env.VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT;
  if (!VERIFICATION_ADDRESS) throw new Error("VerificationContract address not found");

  const [deployer] = await hre.ethers.getSigners();
  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  const balanceBefore = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
  if (balanceBefore === 0n) {
    console.log("⚠️  No fees to withdraw.");
    return;
  }

  const feeTreasury = await VerificationContract.feeTreasury();
  const treasurySet = feeTreasury && feeTreasury !== "0x0000000000000000000000000000000000000000";
  const owner = await VerificationContract.owner();

  console.log("Contract balance:", hre.ethers.formatEther(balanceBefore), "ETH");
  console.log("Fee treasury:", treasurySet ? feeTreasury : "(not set → fees go to owner)");
  console.log("Owner:", owner);
  console.log("Refund recipient:", recipient);
  console.log("");

  // Step 1: withdraw to owner or treasury
  console.log("Step 1: Withdrawing fees from contract...");
  const tx1 = await VerificationContract.withdrawFees();
  await tx1.wait();
  console.log("  Tx:", tx1.hash);
  console.log("  ✅ Fees withdrawn.");
  console.log("");

  if (!treasurySet && owner.toLowerCase() === deployer.address.toLowerCase()) {
    // Step 2: send from deployer to recipient
    console.log("Step 2: Sending", hre.ethers.formatEther(balanceBefore), "ETH to", recipient, "...");
    const tx2 = await deployer.sendTransaction({
      to: recipient,
      value: balanceBefore,
    });
    await tx2.wait();
    console.log("  Tx:", tx2.hash);
    console.log("  ✅ Refund sent to recipient.");
  } else {
    console.log("Step 2: Fee treasury is set (or owner ≠ deployer). Send", hre.ethers.formatEther(balanceBefore), "ETH to", recipient, "from the wallet that received the fees (treasury or owner).");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
