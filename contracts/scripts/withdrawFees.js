const hre = require("hardhat");
require("dotenv").config();

/**
 * Withdraw accumulated fees from VerificationContract
 * Fees will go to feeTreasury if set, otherwise to owner
 */
async function main() {
  console.log("💰 Withdrawing fees from VerificationContract...\n");

  const VERIFICATION_ADDRESS = 
    process.env.VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    process.env.VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT;

  if (!VERIFICATION_ADDRESS) {
    throw new Error("VerificationContract address not found");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Withdrawing with account:", deployer.address);
  console.log("VerificationContract:", VERIFICATION_ADDRESS);
  console.log("");

  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);

  // Check balance before
  const balanceBefore = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
  console.log("Contract balance before:", hre.ethers.formatEther(balanceBefore), "ETH");
  
  if (balanceBefore === 0n) {
    console.log("⚠️  No fees to withdraw!");
    return;
  }

  // Check where fees will go
  try {
    const feeTreasury = await VerificationContract.feeTreasury();
    if (feeTreasury && feeTreasury !== "0x0000000000000000000000000000000000000000") {
      console.log("Fees will go to Fee Treasury:", feeTreasury);
    } else {
      const owner = await VerificationContract.owner();
      console.log("Fees will go to Owner:", owner);
    }
  } catch (error) {
    const owner = await VerificationContract.owner();
    console.log("Fees will go to Owner:", owner);
  }

  console.log("");
  console.log("Withdrawing fees...");
  
  try {
    const tx = await VerificationContract.withdrawFees();
    console.log("Transaction hash:", tx.hash);
    
    await tx.wait();
    console.log("✅ Fees withdrawn successfully!");
    
    // Check balance after
    const balanceAfter = await hre.ethers.provider.getBalance(VERIFICATION_ADDRESS);
    console.log("Contract balance after:", hre.ethers.formatEther(balanceAfter), "ETH");
    
  } catch (error) {
    if (error.message.includes("No fees to withdraw")) {
      console.log("⚠️  No fees to withdraw!");
    } else if (error.message.includes("Ownable")) {
      console.error("❌ Error: You are not the contract owner!");
      console.log("   Current owner:", await VerificationContract.owner());
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

