const { ethers } = require("hardhat");

/**
 * Quick script to fund RecyclablesReward with cRECY tokens
 * 
 * Usage:
 *   Set RECYCLABLES_ADDRESS in .env or pass as argument
 *   npx hardhat run scripts/fundRecyclables.js --network sepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Funding RecyclablesReward with account:", deployer.address);

  // cRECY Token address on Celo
  const CRECY_TOKEN_ADDRESS = "0x34C11A932853Ae24E845Ad4B633E3cEf91afE583";
  const RESERVE_AMOUNT = ethers.parseEther("5000"); // 5000 cRECY

  // Get RecyclablesReward address from env or use provided
  const recyclablesAddress = process.env.RECYCLABLES_ADDRESS || process.argv[2];
  
  if (!recyclablesAddress) {
    console.error("Error: RECYCLABLES_ADDRESS not set in .env and no address provided");
    console.error("Usage: npx hardhat run scripts/fundRecyclables.js --network sepolia");
    console.error("Or set RECYCLABLES_ADDRESS in .env");
    process.exit(1);
  }

  console.log("RecyclablesReward address:", recyclablesAddress);

  // Get contracts
  const cRECY = await ethers.getContractAt("IERC20", CRECY_TOKEN_ADDRESS);
  const recyclablesReward = await ethers.getContractAt("RecyclablesReward", recyclablesAddress);

  // Check balance
  const balance = await cRECY.balanceOf(deployer.address);
  console.log("Your cRECY balance:", ethers.formatEther(balance), "cRECY");

  if (balance < RESERVE_AMOUNT) {
    console.error("Insufficient cRECY balance!");
    console.error("Required:", ethers.formatEther(RESERVE_AMOUNT), "cRECY");
    console.error("You have:", ethers.formatEther(balance), "cRECY");
    process.exit(1);
  }

  // Check if already funded
  const distributedAmount = await recyclablesReward.distributedAmount();
  if (distributedAmount > 0) {
    console.log("⚠ Already has distributed amount:", ethers.formatEther(distributedAmount), "cRECY");
    const contractBalance = await cRECY.balanceOf(recyclablesAddress);
    console.log("Contract balance:", ethers.formatEther(contractBalance), "cRECY");
    
    if (contractBalance >= RESERVE_AMOUNT) {
      console.log("✓ Reserve already funded!");
      return;
    }
  }

  // Approve
  console.log("\n1. Approving cRECY...");
  const approveTx = await cRECY.approve(recyclablesAddress, RESERVE_AMOUNT);
  await approveTx.wait();
  console.log("✓ Approved");

  // Fund
  console.log("\n2. Funding reserve...");
  const fundTx = await recyclablesReward.fundReserve(RESERVE_AMOUNT);
  await fundTx.wait();
  console.log("✓ Funded!");

  // Verify
  const contractBalance = await cRECY.balanceOf(recyclablesAddress);
  const remainingReserve = await recyclablesReward.getRemainingReserve();
  console.log("\n✓ Contract balance:", ethers.formatEther(contractBalance), "cRECY");
  console.log("✓ Remaining reserve:", ethers.formatEther(remainingReserve), "cRECY");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

