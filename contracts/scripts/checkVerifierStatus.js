const hre = require("hardhat");
require("dotenv").config();

/**
 * Check verifier status in both contracts
 */
async function main() {
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  const POINTS_DISTRIBUTOR = process.env.POINTS_REWARD_DISTRIBUTOR_ADDRESS || "0x3adf82A2e4998938B87C885d1D11011851cBeCc4";
  const VERIFICATION_CONTRACT = process.env.VERIFICATION_CONTRACT_ADDRESS || "0x390bDa64D1523075E74673ed957B9Ed67a3D34aD";

  console.log("🔍 Checking verifier status...\n");
  console.log("Verifier address:", VERIFIER_ADDRESS);
  console.log("");

  // Check PointsRewardDistributor
  const PointsRewardDistributor = await hre.ethers.getContractFactory("PointsRewardDistributor");
  const distributor = PointsRewardDistributor.attach(POINTS_DISTRIBUTOR);

  try {
    const checkIsVerifier = await distributor.checkIsVerifier(VERIFIER_ADDRESS);
    const manuallyAdded = await distributor.manuallyAddedVerifiers(VERIFIER_ADDRESS);
    const isVerifier = await distributor.isVerifier(VERIFIER_ADDRESS);
    
    console.log("=== PointsRewardDistributor ===");
    console.log("  checkIsVerifier():", checkIsVerifier);
    console.log("  manuallyAddedVerifiers():", manuallyAdded);
    console.log("  isVerifier():", isVerifier);
    console.log("");
  } catch (error) {
    console.log("Error checking PointsRewardDistributor:", error.message);
    console.log("");
  }

  // Check VerificationContract
  const VerificationContract = await hre.ethers.getContractAt("VerificationContract", VERIFICATION_CONTRACT);
  
  try {
    const isVerifierVC = await VerificationContract.isVerifier(VERIFIER_ADDRESS);
    const verifiersMapping = await VerificationContract.verifiers(VERIFIER_ADDRESS);
    
    console.log("=== VerificationContract ===");
    console.log("  isVerifier():", isVerifierVC);
    console.log("  verifiers mapping:", verifiersMapping);
    console.log("");
  } catch (error) {
    console.log("Error checking VerificationContract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

