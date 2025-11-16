const { ethers } = require("hardhat");

async function main() {
  const verificationOld = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const verificationNew = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  
  console.log("=== Comparing OLD vs NEW Contracts ===\n");
  
  // Check OLD VerificationContract
  console.log("OLD VerificationContract:", verificationOld);
  try {
    const VerifOld = await ethers.getContractAt("VerificationContract", verificationOld);
    const counterOld = await VerifOld.cleanupCounter();
    console.log("  Cleanup Counter:", counterOld.toString());
    console.log("  Number of cleanups:", (counterOld > 0 ? Number(counterOld) - 1 : 0));
    
    if (counterOld > BigInt(1)) {
      console.log("  ✅ HAS DATA - Contains", Number(counterOld) - 1, "cleanup(s)");
      // Check a few cleanups
      for (let i = 1; i < Math.min(Number(counterOld), 4); i++) {
        try {
          const cleanup = await VerifOld.getCleanup(i);
          if (cleanup.user !== "0x0000000000000000000000000000000000000000") {
            console.log(`    Cleanup ${i}: User ${cleanup.user.slice(0,10)}..., Verified: ${cleanup.verified}, Claimed: ${cleanup.claimed}`);
          }
        } catch (e) {}
      }
    } else {
      console.log("  ❌ EMPTY - No cleanups");
    }
  } catch (error) {
    console.log("  Error:", error.message);
  }
  
  console.log("\nNEW VerificationContract:", verificationNew);
  try {
    const VerifNew = await ethers.getContractAt("VerificationContract", verificationNew);
    const counterNew = await VerifNew.cleanupCounter();
    console.log("  Cleanup Counter:", counterNew.toString());
    console.log("  Number of cleanups:", (counterNew > 0 ? Number(counterNew) - 1 : 0));
    
    if (counterNew > BigInt(1)) {
      console.log("  ✅ HAS DATA - Contains", Number(counterNew) - 1, "cleanup(s)");
    } else {
      console.log("  ❌ EMPTY - No cleanups submitted yet");
      console.log("    (Counter = 1 means no cleanups, since counter starts at 1)");
    }
  } catch (error) {
    console.log("  Error:", error.message);
  }
  
  console.log("\n=== What 'Empty' Means ===");
  console.log("'Empty' means the contract was just deployed and no one has");
  console.log("submitted any cleanups to it yet. The cleanupCounter is at 1");
  console.log("(the starting value), meaning 0 cleanups.");
  console.log("\nThe OLD contract has 3 cleanups that users submitted.");
  console.log("The NEW contract has 0 cleanups because it's brand new.");
  console.log("\nIf we switch to NEW contracts, users would need to:");
  console.log("1. Submit their cleanups again");
  console.log("2. Wait for verification again");
  console.log("3. Then claim their NFTs");
}

main().then(() => process.exit(0)).catch(console.error);
