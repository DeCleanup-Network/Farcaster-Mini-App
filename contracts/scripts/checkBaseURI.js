const hre = require("hardhat");
require("dotenv").config();

/**
 * Check the current baseURI of ImpactProductNFT contract
 */
async function main() {
  const IMPACT_PRODUCT_ADDRESS = 
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    "0x45417FFD32986DA5Ba232cb3FdFB9b21aE6D3539"; // New upgradeable contract

  console.log("🔍 Checking baseURI...\n");
  console.log("Contract address:", IMPACT_PRODUCT_ADDRESS);
  console.log("");

  const ImpactProductNFT = await hre.ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = ImpactProductNFT.attach(IMPACT_PRODUCT_ADDRESS);

  try {
    const baseURI = await impactProductNFT.baseURI();
    console.log("📋 Current baseURI:", baseURI);
    console.log("");

    // Test tokenURI for level 1
    try {
      const testURI = await impactProductNFT.getTokenURIForLevel(1);
      console.log("📋 Example tokenURI for level 1:", testURI);
      
      if (testURI.startsWith('ipfs://')) {
        const path = testURI.replace('ipfs://', '').replace(/\/+/g, '/');
        const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${path}`;
        console.log("🌐 Test URL:", gatewayUrl);
      }
    } catch (error) {
      console.log("⚠️  Could not get test tokenURI:", error.message);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

