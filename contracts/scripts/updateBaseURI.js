const { ethers } = require("hardhat");

/**
 * Update the baseURI of ImpactProductNFT contract
 * 
 * Usage:
 *   IMPACT_PRODUCT_CONTRACT_ADDRESS=0x... NEW_BASE_URI=ipfs://YOUR_CID/ npx hardhat run scripts/updateBaseURI.js --network sepolia
 * 
 * Prerequisites:
 *   - Set PRIVATE_KEY in contracts/.env (must be contract owner)
 *   - Set IMPACT_PRODUCT_CONTRACT_ADDRESS in contracts/.env
 *   - Set NEW_BASE_URI environment variable (or it will prompt)
 * 
 * BaseURI Format Options:
 * 
 * Option 1: Single CID with folder structure (recommended)
 *   NEW_BASE_URI=ipfs://bafybeigmwgkcqelpkohd3eqm2azw5k3ly6psfnaos5dztlklyybrvrsece/
 *   This assumes your IPFS folder structure is:
 *     /level1.json
 *     /level2.json
 *     /level3.json
 *     etc.
 * 
 * Option 2: Individual CIDs per level (not supported by current contract)
 *   The contract currently constructs: baseURI + "/level" + level + ".json"
 *   So you need a single CID with the folder structure above.
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Updating baseURI with account:", deployer.address);
  
  const IMPACT_PRODUCT_ADDRESS =
    process.env.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
    process.env.IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT_ADDRESS;

  if (!IMPACT_PRODUCT_ADDRESS || !ethers.isAddress(IMPACT_PRODUCT_ADDRESS)) {
    throw new Error("Set IMPACT_PRODUCT_NFT_ADDRESS (or IMPACT_PRODUCT_CONTRACT_ADDRESS) in contracts/.env");
  }

  let NEW_BASE_URI = process.env.NEW_BASE_URI;
  
  if (!NEW_BASE_URI) {
    console.log("\n⚠️  NEW_BASE_URI not set in environment.");
    console.log("Please set it like: NEW_BASE_URI=ipfs://YOUR_CID/");
    console.log("\nExample:");
    console.log("  NEW_BASE_URI=ipfs://bafybeigmwgkcqelpkohd3eqm2azw5k3ly6psfnaos5dztlklyybrvrsece/");
    throw new Error("NEW_BASE_URI environment variable is required");
  }

  // Validate baseURI format
  if (!NEW_BASE_URI.startsWith('ipfs://') && !NEW_BASE_URI.startsWith('http://') && !NEW_BASE_URI.startsWith('https://')) {
    console.warn("⚠️  Warning: baseURI should start with 'ipfs://', 'http://', or 'https://'");
  }

  // Ensure trailing slash for IPFS
  if (NEW_BASE_URI.startsWith('ipfs://') && !NEW_BASE_URI.endsWith('/')) {
    NEW_BASE_URI = NEW_BASE_URI + '/';
    console.log("📝 Added trailing slash:", NEW_BASE_URI);
  }

  console.log("\n=== Update Configuration ===");
  console.log("Contract:", IMPACT_PRODUCT_ADDRESS);
  console.log("New baseURI:", NEW_BASE_URI);
  console.log("Deployer:", deployer.address);
  console.log("===========================\n");

  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = ImpactProductNFT.attach(IMPACT_PRODUCT_ADDRESS);
  
  // Check current baseURI
  const currentBaseURI = await impactProductNFT.baseURI();
  console.log("📋 Current baseURI:", currentBaseURI);
  
  // Check if deployer is owner
  const owner = await impactProductNFT.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer ${deployer.address} is not the owner. Owner is: ${owner}`);
  }
  
  console.log("\n✅ Deployer is the owner. Proceeding with update...\n");
  
  // Update baseURI
  console.log("📝 Updating baseURI...");
  const tx = await impactProductNFT.setBaseURI(NEW_BASE_URI);
  console.log("   Transaction hash:", tx.hash);
  
  console.log("⏳ Waiting for confirmation...");
  await tx.wait();
  
  console.log("✅ baseURI updated successfully!");
  
  // Verify the update
  const newBaseURI = await impactProductNFT.baseURI();
  console.log("📋 New baseURI:", newBaseURI);
  
  // Test tokenURI for level 1
  try {
    const testURI = await impactProductNFT.getTokenURIForLevel(1);
    console.log("📋 Example tokenURI for level 1:", testURI);
    
    if (testURI.startsWith('ipfs://')) {
      const path = testURI.replace('ipfs://', '').replace(/\/+/g, '/');
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${path}`;
      console.log("🌐 Test URL:", gatewayUrl);
      console.log("\n💡 Test this URL in your browser to verify it works!");
    }
  } catch (error) {
    console.warn("⚠️  Could not test tokenURI:", error.message);
  }
  
  console.log("\n✅ Update complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

