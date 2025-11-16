const { ethers } = require("hardhat");

async function main() {
  const impactNFTAddress = "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  const verificationAddress = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  
  console.log("=== Checking ImpactProductNFT Contract Version ===\n");
  
  const ImpactNFT = await ethers.getContractAt("ImpactProductNFT", impactNFTAddress);
  
  // Try to read verificationContract field
  try {
    const verificationContract = await ImpactNFT.verificationContract();
    console.log("✅ Contract HAS verificationContract field");
    console.log("   Value:", verificationContract);
    console.log("   Matches VerificationContract:", verificationContract.toLowerCase() === verificationAddress.toLowerCase() ? "✅ YES" : "❌ NO");
    
    if (verificationContract === "0x0000000000000000000000000000000000000000") {
      console.log("\n❌ PROBLEM: verificationContract is set to zero address!");
      console.log("   This means it was never set after deployment.");
      console.log("   SOLUTION: Call setVerificationContract() on ImpactProductNFT");
    }
  } catch (error) {
    console.log("❌ Contract does NOT have verificationContract field");
    console.log("   Error:", error.message);
    console.log("   This means the contract was deployed with OLD code");
    console.log("   that doesn't have the verificationContract field.");
    console.log("   SOLUTION: Redeploy ImpactProductNFT with NEW code");
  }
  
  // Check if claimLevelForUser exists
  try {
    // Try to get the function selector
    const iface = new ethers.Interface([
      "function claimLevelForUser(address user, uint256 cleanupId, uint8 level) external"
    ]);
    const selector = iface.getFunction("claimLevelForUser").selector;
    console.log("\n✅ claimLevelForUser function exists (selector:", selector + ")");
  } catch (error) {
    console.log("\n❌ claimLevelForUser function does NOT exist");
    console.log("   This means the contract has the OLD claimLevel() function");
  }
}

main().then(() => process.exit(0)).catch(console.error);
