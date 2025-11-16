const { ethers } = require("hardhat");

async function main() {
  const impactNFTAddress = "0x3c7AD530306a9A7eDAD3Da52b915dECF40edC6a1"; // OLD
  const userAddress = "0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84";
  
  console.log("=== Checking User's Impact Product NFT ===\n");
  console.log("User:", userAddress);
  console.log("ImpactProductNFT:", impactNFTAddress);
  console.log();
  
  const [signer] = await ethers.getSigners();
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactNFT = ImpactProductNFT.attach(impactNFTAddress);
  
  // Try different function names (old vs new contract)
  try {
    const tokenId = await impactNFT.userTokenId(userAddress);
    console.log("User's token ID:", tokenId.toString());
    
    if (tokenId > 0) {
      try {
        const level = await impactNFT.userCurrentLevel(userAddress);
        console.log("User's current level:", level.toString());
      } catch (e) {
        const level = await impactNFT.getUserLevel(userAddress);
        console.log("User's current level (getUserLevel):", level.toString());
      }
    } else {
      console.log("❌ User has NO Impact Product NFT (tokenId = 0)");
      console.log("   This means the claim transaction failed to mint the NFT.");
    }
  } catch (error) {
    console.log("Error:", error.message);
  }
  
  // Check what functions the contract has
  console.log("\n=== Contract Analysis ===");
  console.log("The OLD ImpactProductNFT contract likely has the old claimLevel() function");
  console.log("that uses msg.sender as the user. When VerificationContract calls it,");
  console.log("msg.sender is the contract address, not the user, so the NFT never gets minted.");
}

main().then(() => process.exit(0)).catch(console.error);
