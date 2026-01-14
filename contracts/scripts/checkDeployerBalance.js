const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const BDCU_TOKEN_ADDRESS = 
    process.env.BDCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS ||
    "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044";

  console.log("Deployer address:", deployer.address);
  console.log("Token address:", BDCU_TOKEN_ADDRESS);
  console.log("");

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const token = await hre.ethers.getContractAt(ERC20_ABI, BDCU_TOKEN_ADDRESS);
  const balance = await token.balanceOf(deployer.address);
  const decimals = await token.decimals();
  const symbol = await token.symbol();

  console.log("Token balance:", hre.ethers.formatUnits(balance, decimals), symbol);
  console.log("");
  console.log("To transfer tokens to PointsRewardDistributor, run:");
  console.log(`  TRANSFER_AMOUNT=<amount> npx hardhat run scripts/transferFromDeployer.js --network baseSepolia`);
  console.log("");
  console.log("Example:");
  console.log(`  TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferFromDeployer.js --network baseSepolia`);
}

main().catch(console.error);

