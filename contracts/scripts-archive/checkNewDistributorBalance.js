const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const NEW_DISTRIBUTOR_ADDRESS = 
    process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
    "0x22f095B389fA5c4256f1a2F123BC0c9e4de109EE";

  const TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS ||
    "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044";

  console.log("New Distributor:", NEW_DISTRIBUTOR_ADDRESS);
  console.log("Token Address:", TOKEN_ADDRESS);
  console.log("");

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  try {
    const token = await hre.ethers.getContractAt(ERC20_ABI, TOKEN_ADDRESS);
    const balance = await token.balanceOf(NEW_DISTRIBUTOR_ADDRESS);
    const decimals = await token.decimals();
    const symbol = await token.symbol();

    console.log("Balance:", hre.ethers.formatUnits(balance, decimals), symbol);
    
    if (balance === BigInt(0)) {
      console.log("\n⚠️  Contract has 0 tokens. Users cannot claim yet.");
    } else {
      console.log("\n✅ Contract has tokens! Users can claim.");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);

