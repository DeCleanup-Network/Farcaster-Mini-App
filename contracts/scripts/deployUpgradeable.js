const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

/**
 * Deploy all upgradeable contracts to Base Sepolia
 * 
 * This script deploys:
 * 1. PointsRewardDistributor (upgradeable proxy)
 * 2. ImpactProductNFT (upgradeable proxy)
 * 3. VerificationContract (upgradeable proxy)
 * 
 * Then links them together and sets up initial configuration
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
  console.log("");

  // Get contract addresses from environment or use defaults
  const BDCU_TOKEN_ADDRESS = process.env.BDCU_TOKEN_ADDRESS || 
                               process.env.TEST_BDCU_TOKEN_ADDRESS || 
                               "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044"; // Default Base Sepolia testnet token

  const INITIAL_TOKEN_PRICE = process.env.INITIAL_TOKEN_PRICE || "77"; // 8 decimals, $0.00000077
  const FEE_TREASURY = process.env.FEE_TREASURY || "0x986913D1FB38AD0685Ba2d8C10a28B7b962c38d9";
  
  // Initial verifiers (can be empty array)
  const INITIAL_VERIFIERS = process.env.INITIAL_VERIFIERS 
    ? process.env.INITIAL_VERIFIERS.split(",").map(v => v.trim())
    : [deployer.address]; // Default to deployer as first verifier

  console.log("Configuration:");
  console.log("  BDCU Token:", BDCU_TOKEN_ADDRESS);
  console.log("  Initial Token Price:", INITIAL_TOKEN_PRICE, "(8 decimals)");
  console.log("  Fee Treasury:", FEE_TREASURY);
  console.log("  Initial Verifiers:", INITIAL_VERIFIERS);
  console.log("");

  // Step 1: Deploy PointsRewardDistributor
  console.log("📦 Step 1: Deploying PointsRewardDistributor (upgradeable)...");
  const PointsRewardDistributor = await ethers.getContractFactory("PointsRewardDistributor");
  const pointsRewardDistributor = await upgrades.deployProxy(
    PointsRewardDistributor,
    [BDCU_TOKEN_ADDRESS, INITIAL_TOKEN_PRICE],
    { 
      initializer: "initialize",
      kind: "uups",
      unsafeAllow: ["constructor", "state-variable-immutable"],
      timeout: 0
    }
  );
  await pointsRewardDistributor.waitForDeployment();
  const pointsRewardDistributorAddress = await pointsRewardDistributor.getAddress();
  console.log("  ✅ PointsRewardDistributor deployed to:", pointsRewardDistributorAddress);
  console.log("");

  // Step 2: Deploy ImpactProductNFT
  console.log("📦 Step 2: Deploying ImpactProductNFT (upgradeable)...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const NFT_NAME = "DeCleanup Impact Product";
  const NFT_SYMBOL = "DCU-IP";
  const BASE_URI = process.env.IPFS_BASE_URI || "ipfs://QmYourBaseURIHere/";
  
  const impactProductNFT = await upgrades.deployProxy(
    ImpactProductNFT,
    [NFT_NAME, NFT_SYMBOL, BASE_URI, deployer.address],
    { 
      initializer: "initialize",
      kind: "uups",
      unsafeAllow: ["constructor", "state-variable-immutable"],
      timeout: 0
    }
  );
  await impactProductNFT.waitForDeployment();
  const impactProductNFTAddress = await impactProductNFT.getAddress();
  console.log("  ✅ ImpactProductNFT deployed to:", impactProductNFTAddress);
  console.log("");

  // Step 3: Deploy VerificationContract
  console.log("📦 Step 3: Deploying VerificationContract (upgradeable)...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || "0"; // 0 = disabled
  const FEE_ENABLED = process.env.FEE_ENABLED === "true";
  const CLAIM_FEE = process.env.CLAIM_FEE || "0"; // 0 = disabled
  const CLAIM_FEE_ENABLED = process.env.CLAIM_FEE_ENABLED === "true";
  
  const verificationContract = await upgrades.deployProxy(
    VerificationContract,
    [
      INITIAL_VERIFIERS,
      impactProductNFTAddress,
      pointsRewardDistributorAddress,
      SUBMISSION_FEE,
      FEE_ENABLED,
      CLAIM_FEE,
      CLAIM_FEE_ENABLED
    ],
    { 
      initializer: "initialize",
      kind: "uups",
      unsafeAllow: ["constructor", "state-variable-immutable"],
      timeout: 0
    }
  );
  await verificationContract.waitForDeployment();
  const verificationContractAddress = await verificationContract.getAddress();
  console.log("  ✅ VerificationContract deployed to:", verificationContractAddress);
  console.log("");

  // Step 4: Link contracts together
  console.log("🔗 Step 4: Linking contracts...");
  
  // Link ImpactProductNFT to PointsRewardDistributor
  console.log("  Linking ImpactProductNFT to PointsRewardDistributor...");
  const tx1 = await pointsRewardDistributor.setImpactProductNFT(impactProductNFTAddress);
  await tx1.wait();
  console.log("  ✅ ImpactProductNFT linked");
  
  // Link VerificationContract to PointsRewardDistributor
  console.log("  Linking VerificationContract to PointsRewardDistributor...");
  const tx2 = await pointsRewardDistributor.setVerificationContract(verificationContractAddress);
  await tx2.wait();
  console.log("  ✅ VerificationContract linked");
  
  // Link VerificationContract to ImpactProductNFT
  console.log("  Linking VerificationContract to ImpactProductNFT...");
  const tx3 = await impactProductNFT.setVerificationContract(verificationContractAddress);
  await tx3.wait();
  console.log("  ✅ VerificationContract linked to ImpactProductNFT");
  
  // Link ImpactProductNFT to PointsRewardDistributor (for rewards)
  console.log("  Linking PointsRewardDistributor to ImpactProductNFT...");
  const tx4 = await impactProductNFT.setRewardDistributor(pointsRewardDistributorAddress);
  await tx4.wait();
  console.log("  ✅ PointsRewardDistributor linked to ImpactProductNFT");
  
  // Set fee treasury
  console.log("  Setting fee treasury...");
  const tx5 = await verificationContract.setFeeTreasury(FEE_TREASURY);
  await tx5.wait();
  console.log("  ✅ Fee treasury set to:", FEE_TREASURY);
  
  console.log("");

  // Step 5: Summary
  console.log("✅ Deployment Complete!");
  console.log("");
  console.log("Contract Addresses:");
  console.log("  PointsRewardDistributor:", pointsRewardDistributorAddress);
  console.log("  ImpactProductNFT:", impactProductNFTAddress);
  console.log("  VerificationContract:", verificationContractAddress);
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Update .env with new contract addresses");
  console.log("  2. Transfer bDCU tokens to PointsRewardDistributor:", pointsRewardDistributorAddress);
  console.log("  3. Test all functions");
  console.log("");

  // Save addresses to a file for easy reference
  const fs = require("fs");
  const deploymentInfo = {
    network: "baseSepolia",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PointsRewardDistributor: pointsRewardDistributorAddress,
      ImpactProductNFT: impactProductNFTAddress,
      VerificationContract: verificationContractAddress,
      bDCUToken: BDCU_TOKEN_ADDRESS
    },
    configuration: {
      initialTokenPrice: INITIAL_TOKEN_PRICE,
      feeTreasury: FEE_TREASURY,
      initialVerifiers: INITIAL_VERIFIERS
    }
  };
  
  fs.writeFileSync(
    "contracts/deployment-baseSepolia-upgradeable.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("📄 Deployment info saved to: contracts/deployment-baseSepolia-upgradeable.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

