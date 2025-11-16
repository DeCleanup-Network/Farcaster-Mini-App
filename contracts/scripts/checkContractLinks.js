const { ethers } = require("hardhat");

async function main() {
  const verificationOld = "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const verificationNew = "0x2ccB4de8a03ac691315AF312eEa92e941e02DCA3";
  
  const impactOld = "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1";
  const impactNew = "0x0F4193e25E3292e87970fa23c1555C8769A77278";
  
  console.log("=== Checking Contract Links ===\n");
  
  // Check OLD VerificationContract -> ImpactProductNFT
  console.log("OLD VerificationContract:", verificationOld);
  try {
    const VerifOld = await ethers.getContractAt("VerificationContract", verificationOld);
    const impactInVerifOld = await VerifOld.impactProductNFT();
    console.log("  Linked ImpactProductNFT:", impactInVerifOld);
    console.log("  Matches OLD ImpactProductNFT:", impactInVerifOld.toLowerCase() === impactOld.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log("  Matches NEW ImpactProductNFT:", impactInVerifOld.toLowerCase() === impactNew.toLowerCase() ? "✅ YES" : "❌ NO");
  } catch (error) {
    console.log("  Error:", error.message);
  }
  
  // Check NEW VerificationContract -> ImpactProductNFT
  console.log("\nNEW VerificationContract:", verificationNew);
  try {
    const VerifNew = await ethers.getContractAt("VerificationContract", verificationNew);
    const impactInVerifNew = await VerifNew.impactProductNFT();
    console.log("  Linked ImpactProductNFT:", impactInVerifNew);
    console.log("  Matches OLD ImpactProductNFT:", impactInVerifNew.toLowerCase() === impactOld.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log("  Matches NEW ImpactProductNFT:", impactInVerifNew.toLowerCase() === impactNew.toLowerCase() ? "✅ YES" : "❌ NO");
  } catch (error) {
    console.log("  Error:", error.message);
  }
  
  // Check OLD ImpactProductNFT -> VerificationContract
  console.log("\nOLD ImpactProductNFT:", impactOld);
  try {
    const ImpactOld = await ethers.getContractAt("ImpactProductNFT", impactOld);
    const verifInImpactOld = await ImpactOld.verificationContract();
    console.log("  Linked VerificationContract:", verifInImpactOld);
    if (verifInImpactOld === "0x0000000000000000000000000000000000000000") {
      console.log("  ⚠️  NOT LINKED (zero address)");
    } else {
      console.log("  Matches OLD VerificationContract:", verifInImpactOld.toLowerCase() === verificationOld.toLowerCase() ? "✅ YES" : "❌ NO");
      console.log("  Matches NEW VerificationContract:", verifInImpactOld.toLowerCase() === verificationNew.toLowerCase() ? "✅ YES" : "❌ NO");
    }
  } catch (error) {
    console.log("  Error:", error.message);
  }
  
  // Check NEW ImpactProductNFT -> VerificationContract
  console.log("\nNEW ImpactProductNFT:", impactNew);
  try {
    const ImpactNew = await ethers.getContractAt("ImpactProductNFT", impactNew);
    const verifInImpactNew = await ImpactNew.verificationContract();
    console.log("  Linked VerificationContract:", verifInImpactNew);
    if (verifInImpactNew === "0x0000000000000000000000000000000000000000") {
      console.log("  ⚠️  NOT LINKED (zero address)");
    } else {
      console.log("  Matches OLD VerificationContract:", verifInImpactNew.toLowerCase() === verificationOld.toLowerCase() ? "✅ YES" : "❌ NO");
      console.log("  Matches NEW VerificationContract:", verifInImpactNew.toLowerCase() === verificationNew.toLowerCase() ? "✅ YES" : "❌ NO");
    }
  } catch (error) {
    console.log("  Error:", error.message);
  }
}

main().then(() => process.exit(0)).catch(console.error);
