const { ethers } = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
require("dotenv").config();

/**
 * Manual deployment of upgradeable contracts
 * This bypasses the RPC method issue by manually deploying implementation and proxy
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
  console.log("");

  const BDCU_TOKEN_ADDRESS = process.env.BDCU_TOKEN_ADDRESS || 
                               process.env.TEST_BDCU_TOKEN_ADDRESS || 
                               "0x85162f919Bf8cd09B8046F8EAd2ecD434841e044";
  const INITIAL_TOKEN_PRICE = process.env.INITIAL_TOKEN_PRICE || "77";
  const FEE_TREASURY = process.env.FEE_TREASURY || "0x986913D1FB38AD0685Ba2d8C10a28B7b962c38d9";
  const INITIAL_VERIFIERS = process.env.INITIAL_VERIFIERS 
    ? process.env.INITIAL_VERIFIERS.split(",").map(v => v.trim())
    : [deployer.address];

  console.log("Configuration:");
  console.log("  BDCU Token:", BDCU_TOKEN_ADDRESS);
  console.log("  Initial Token Price:", INITIAL_TOKEN_PRICE);
  console.log("  Fee Treasury:", FEE_TREASURY);
  console.log("  Initial Verifiers:", INITIAL_VERIFIERS);
  console.log("");

  // Use our UUPSProxy wrapper
  const UUPSProxy = await ethers.getContractFactory("UUPSProxy");
  
  // Step 1: Deploy PointsRewardDistributor
  console.log("📦 Step 1: Deploying PointsRewardDistributor...");
  const PointsRewardDistributor = await ethers.getContractFactory("PointsRewardDistributor");
  const pointsImpl = await PointsRewardDistributor.deploy();
  await pointsImpl.waitForDeployment();
  const pointsImplAddress = await pointsImpl.getAddress();
  console.log("  Implementation:", pointsImplAddress);
  
  // Encode initialize call
  const pointsInitData = PointsRewardDistributor.interface.encodeFunctionData("initialize", [
    BDCU_TOKEN_ADDRESS,
    INITIAL_TOKEN_PRICE
  ]);
  
  // Deploy proxy
  const pointsProxy = await UUPSProxy.deploy(pointsImplAddress, pointsInitData);
  await pointsProxy.waitForDeployment();
  const pointsRewardDistributorAddress = await pointsProxy.getAddress();
  console.log("  ✅ PointsRewardDistributor (proxy):", pointsRewardDistributorAddress);
  console.log("");

  // Step 2: Deploy ImpactProductNFT
  console.log("📦 Step 2: Deploying ImpactProductNFT...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const NFT_NAME = "DeCleanup Impact Product";
  const NFT_SYMBOL = "DCU-IP";
  const BASE_URI = process.env.IPFS_BASE_URI || "ipfs://QmYourBaseURIHere/";
  
  const nftImpl = await ImpactProductNFT.deploy();
  await nftImpl.waitForDeployment();
  const nftImplAddress = await nftImpl.getAddress();
  console.log("  Implementation:", nftImplAddress);
  
  const nftInitData = ImpactProductNFT.interface.encodeFunctionData("initialize", [
    NFT_NAME,
    NFT_SYMBOL,
    BASE_URI,
    deployer.address
  ]);
  
  const nftProxy = await UUPSProxy.deploy(nftImplAddress, nftInitData);
  await nftProxy.waitForDeployment();
  const impactProductNFTAddress = await nftProxy.getAddress();
  console.log("  ✅ ImpactProductNFT (proxy):", impactProductNFTAddress);
  console.log("");

  // Step 3: Deploy VerificationContract
  console.log("📦 Step 3: Deploying VerificationContract...");
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const SUBMISSION_FEE = process.env.SUBMISSION_FEE || "0";
  const FEE_ENABLED = process.env.FEE_ENABLED === "true";
  const CLAIM_FEE = process.env.CLAIM_FEE || "0";
  const CLAIM_FEE_ENABLED = process.env.CLAIM_FEE_ENABLED === "true";
  
  const verifImpl = await VerificationContract.deploy();
  await verifImpl.waitForDeployment();
  const verifImplAddress = await verifImpl.getAddress();
  console.log("  Implementation:", verifImplAddress);
  
  const verifInitData = VerificationContract.interface.encodeFunctionData("initialize", [
    INITIAL_VERIFIERS,
    impactProductNFTAddress,
    pointsRewardDistributorAddress,
    SUBMISSION_FEE,
    FEE_ENABLED,
    CLAIM_FEE,
    CLAIM_FEE_ENABLED
  ]);
  
  const verifProxy = await UUPSProxy.deploy(verifImplAddress, verifInitData);
  await verifProxy.waitForDeployment();
  const verificationContractAddress = await verifProxy.getAddress();
  console.log("  ✅ VerificationContract (proxy):", verificationContractAddress);
  console.log("");

  // Step 4: Link contracts
  console.log("🔗 Step 4: Linking contracts...");
  const pointsDistributor = await ethers.getContractAt("PointsRewardDistributor", pointsRewardDistributorAddress);
  const impactNFT = await ethers.getContractAt("ImpactProductNFT", impactProductNFTAddress);
  const verification = await ethers.getContractAt("VerificationContract", verificationContractAddress);
  
  console.log("  Linking ImpactProductNFT to PointsRewardDistributor...");
  await pointsDistributor.setImpactProductNFT(impactProductNFTAddress);
  console.log("  ✅ Linked");
  
  console.log("  Linking VerificationContract to PointsRewardDistributor...");
  await pointsDistributor.setVerificationContract(verificationContractAddress);
  console.log("  ✅ Linked");
  
  console.log("  Linking VerificationContract to ImpactProductNFT...");
  await impactNFT.setVerificationContract(verificationContractAddress);
  console.log("  ✅ Linked");
  
  console.log("  Linking PointsRewardDistributor to ImpactProductNFT...");
  await impactNFT.setRewardDistributor(pointsRewardDistributorAddress);
  console.log("  ✅ Linked");
  
  console.log("  Setting fee treasury...");
  await verification.setFeeTreasury(FEE_TREASURY);
  console.log("  ✅ Fee treasury set");
  console.log("");

  // Summary
  console.log("✅ Deployment Complete!");
  console.log("");
  console.log("Contract Addresses:");
  console.log("  PointsRewardDistributor:", pointsRewardDistributorAddress);
  console.log("  ImpactProductNFT:", impactProductNFTAddress);
  console.log("  VerificationContract:", verificationContractAddress);
  console.log("");
  console.log("Implementation Addresses:");
  console.log("  PointsRewardDistributor Impl:", pointsImplAddress);
  console.log("  ImpactProductNFT Impl:", nftImplAddress);
  console.log("  VerificationContract Impl:", verifImplAddress);
  console.log("");

  // Save to file
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
    implementations: {
      PointsRewardDistributor: pointsImplAddress,
      ImpactProductNFT: nftImplAddress,
      VerificationContract: verifImplAddress
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

