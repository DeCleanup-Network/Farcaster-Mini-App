const hre = require("hardhat");
require("dotenv").config();

/**
 * Withdraw accumulated fees from VerificationContract to a specific address (refund a user).
 * Requires upgraded VerificationContract with withdrawFeesTo(address) (onlyOwner).
 *
 * Usage:
 *   REFUND_RECIPIENT=0x7D85fCbB505D48E6176483733b62b51704e0bF95 npm run withdrawFeesTo:base
 *   REFUND_RECIPIENT=0x... npm run withdrawFeesTo:baseSepolia
 */
async function main() {
  const recipient = process.env.REFUND_RECIPIENT;
  if (!recipient || !hre.ethers.isAddress(recipient)) {
    throw new Error("Set REFUND_RECIPIENT to the address that should receive the fees (e.g. 0x7D85fCbB505D48E6176483733b62b51704e0bF95)");
  }

  console.log("💰 Withdrawing fees from VerificationContract to recipient (refund)...\n");

  const VERIFICATION_ADDRESS =
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    process.env.VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT;

  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Caller (must be owner):", deployer.address);
  console.log("VerificationContract:", VERIFICATION_ADDRESS);
  console.log("Recipient (fees will be sent here):", recipient);
  console.log("");

  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  const balanceBefore = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
  console.log("Contract balance before:", hre.ethers.formatEther(balanceBefore), "ETH");

  if (balanceBefore === 0n) {
    console.log("⚠️  No fees to withdraw!");
    return;
  }

  console.log("");
  console.log("Sending fees to", recipient, "...");

  try {
    const tx = await VerificationContract.withdrawFeesTo(recipient);
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("✅ Fees sent to recipient successfully!");
    const balanceAfter = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
    console.log("Contract balance after:", hre.ethers.formatEther(balanceAfter), "ETH");
  } catch (error) {
    const msg = (error && (error.message || error.shortMessage || String(error))) || "";
    const isRevert = msg.includes("execution reverted") || msg.includes("ProviderError") || (error && error.code === "CALL_EXCEPTION");

    if (msg.includes("No fees to withdraw")) {
      console.log("⚠️  No fees to withdraw!");
    } else if (msg.includes("Invalid recipient")) {
      console.error("❌ Error: Invalid REFUND_RECIPIENT address");
    } else if (msg.includes("Ownable") || msg.includes("owner")) {
      console.error("❌ Error: You are not the contract owner!");
      console.log("   Current owner:", await VerificationContract.owner());
    } else if (isRevert || msg.includes("withdrawFeesTo") || msg.includes("does not exist")) {
      console.error("❌ Execution reverted. The proxy likely still uses the old implementation (no withdrawFeesTo).");
      console.log("");
      console.log("Option A – Upgrade, then refund:");
      console.log("  npm run upgrade:verification:base");
      console.log("  REFUND_RECIPIENT=" + recipient + " npm run withdrawFeesTo:base");
      console.log("");
      console.log("Option B – Refund without upgrading (one command):");
      console.log("  REFUND_RECIPIENT=" + recipient + " npm run withdrawFeesThenSendTo:base");
    } else {
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
