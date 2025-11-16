const { ethers } = require("hardhat");

/**
 * Check the current baseURI of ImpactProductNFT contract
 * 
 * Usage:
 *   npx hardhat run scripts/checkBaseURI.js --network sepolia
 * 
 * Prerequisites:
 *   - Set IMPACT_PRODUCT_CONTRACT_ADDRESS in contracts/.env
 */

async function main() {
  const IMPACT_PRODUCT_ADDRESS = process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT_ADDRESS;
  
  if (!IMPACT_PRODUCT_ADDRESS || !ethers.isAddress(IMPACT_PRODUCT_ADDRESS)) {
    throw new Error("IMPACT_PRODUCT_CONTRACT_ADDRESS must be set in contracts/.env");
  }

  console.log("Checking ImpactProductNFT at:", IMPACT_PRODUCT_ADDRESS);
  
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = ImpactProductNFT.attach(IMPACT_PRODUCT_ADDRESS);
  
  const baseURI = await impactProductNFT.baseURI();
  console.log("\n📋 Current baseURI:", baseURI);
  
  // Test what tokenURI would be for level 1
  try {
    const testURI = await impactProductNFT.getTokenURIForLevel(1);
    console.log("📋 Example tokenURI for level 1:", testURI);
    
    // Convert to gateway URL
    if (testURI.startsWith('ipfs://')) {
      const path = testURI.replace('ipfs://', '').replace(/\/+/g, '/');
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${path}`;
      console.log("🌐 Gateway URL:", gatewayUrl);
      console.log("\n💡 Test this URL in your browser to verify it works!");
    }
  } catch (error) {
    console.error("Error getting test URI:", error.message);
  }
  
  console.log("\n✅ Check complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

