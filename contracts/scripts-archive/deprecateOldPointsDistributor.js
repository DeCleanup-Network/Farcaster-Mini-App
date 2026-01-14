const hre = require("hardhat");
require("dotenv").config();

/**
 * Deprecate old PointsRewardDistributor contract
 * 
 * This script:
 * 1. Checks if old contract has any tokens (should be 0)
 * 2. Pauses the old contract (if possible)
 * 3. Documents the deprecation
 * 
 * Usage:
 *   OLD_CONTRACT=0x... npx hardhat run scripts/deprecateOldPointsDistributor.js --network baseSepolia
 */
async function main() {
  const OLD_CONTRACT = process.env.OLD_CONTRACT || "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";
  const NEW_CONTRACT = process.env.NEW_CONTRACT || process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS || "0xf0d87bFf397824D3CF9dcf7f400f8A7F78732F4f";

  console.log("🛑 Deprecating Old PointsRewardDistributor Contract...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Old contract:", OLD_CONTRACT);
  console.log("New contract:", NEW_CONTRACT);
  console.log("");

  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const oldDistributor = PointsRewardDistributor.attach(OLD_CONTRACT);

  // Check owner
  const owner = await oldDistributor.owner();
  console.log("Old contract owner:", owner);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("⚠️  Warning: Deployer is not the owner of old contract");
    console.log("   Owner is:", owner);
    console.log("   Cannot pause or manage this contract");
    return;
  }

  // Check token balance
  try {
    const tokenAddress = await oldDistributor.bDCUToken();
    const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
    const token = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress);
    const balance = await token.balanceOf(OLD_CONTRACT);
    
    console.log("Token balance:", hre.ethers.formatUnits(balance, 18), "tokens");
    
    if (balance > BigInt(0)) {
      console.log("⚠️  WARNING: Old contract still has tokens!");
      console.log("   Transfer tokens to new contract before deprecating");
      console.log("   Run: OLD_CONTRACT=" + OLD_CONTRACT + " NEW_CONTRACT=" + NEW_CONTRACT + " npx hardhat run scripts/transferTokensToNewDistributor.js --network baseSepolia");
      return;
    }
  } catch (error) {
    console.log("⚠️  Could not check token balance:", error.message);
  }

  // Check pause status
  try {
    const isPaused = await oldDistributor.paused();
    console.log("Current pause status:", isPaused ? "✅ PAUSED" : "❌ NOT PAUSED");
    
    if (!isPaused) {
      console.log("\n⏸️  Pausing old contract...");
      const pauseTx = await oldDistributor.pause();
      console.log("Pause transaction hash:", pauseTx.hash);
      await pauseTx.wait();
      console.log("✅ Old contract paused");
    } else {
      console.log("✅ Old contract already paused");
    }
  } catch (error) {
    console.log("⚠️  Could not pause contract:", error.message);
    console.log("   Contract may not have pause functionality");
  }

  // Create deprecation record
  const deprecationInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    oldContract: {
      address: OLD_CONTRACT,
      owner: owner,
      status: "DEPRECATED",
      replacedBy: NEW_CONTRACT,
    },
    newContract: {
      address: NEW_CONTRACT,
    }
  };

  const fs = require("fs");
  const filename = `deprecated-points-distributor-${hre.network.name}.json`;
  fs.writeFileSync(filename, JSON.stringify(deprecationInfo, null, 2));
  console.log("\n📄 Deprecation record saved to:", filename);

  console.log("\n✅ Old contract deprecated!");
  console.log("\n📝 Summary:");
  console.log("   Old contract:", OLD_CONTRACT, "- DEPRECATED");
  console.log("   New contract:", NEW_CONTRACT, "- ACTIVE");
  console.log("\n⚠️  Remember to:");
  console.log("   1. Update all environment variables to use new contract");
  console.log("   2. Update frontend to use new contract address");
  console.log("   3. Do not use old contract for new operations");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

