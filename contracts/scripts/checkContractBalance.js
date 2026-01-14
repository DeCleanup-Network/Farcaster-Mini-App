const hre = require("hardhat");
require("dotenv").config();

/**
 * Check token balance of a contract
 */
async function main() {
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x3adf82A2e4998938B87C885d1D11011851cBeCc4";
  const BDCU_TOKEN = "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044";

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const token = await hre.ethers.getContractAt(ERC20_ABI, BDCU_TOKEN);
  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();

  const balance = await token.balanceOf(CONTRACT_ADDRESS);
  console.log(`Contract ${CONTRACT_ADDRESS} balance: ${hre.ethers.formatUnits(balance, tokenDecimals)} ${tokenSymbol}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

