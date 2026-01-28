/**
 * Add an address to the VerificationContract verifier allowlist (owner only).
 * Run from the contracts/ directory:
 *
 *   cd contracts
 *   VERIFICATION_CONTRACT_ADDRESS=0x... VERIFIER_ADDRESS=0x... npm run addVerifier:base
 *
 * Or use the runner (works even if cwd is repo root):
 *   cd contracts && VERIFICATION_CONTRACT_ADDRESS=0x... VERIFIER_ADDRESS=0x... node run-addVerifier.js base
 *
 * Set VERIFICATION_CONTRACT_ADDRESS and VERIFIER_ADDRESS in contracts/.env to avoid passing them each time.
 */
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const VERIFICATION_ADDRESS = process.env.VERIFICATION_CONTRACT_ADDRESS;
  const verifierAddress = process.env.VERIFIER_ADDRESS || process.env.VERIFIER_TO_ADD || "0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84";
  
  console.log("=== Adding Verifier ===\n");
  console.log("Verification Contract:", VERIFICATION_ADDRESS);
  console.log("Verifier Address:", verifierAddress);
  console.log("");
  
  const [signer] = await ethers.getSigners();
  console.log("Using signer (owner):", signer.address);
  
  const VerificationContract = await ethers.getContractAt("VerificationContract", VERIFICATION_ADDRESS);
  
  // Check if already verifier
  const isVerifier = await VerificationContract.verifiers(verifierAddress);
  console.log("Current verifier status:", isVerifier);
  console.log("");
  
  if (isVerifier) {
    console.log("✅ Already a verifier!");
    return;
  }
  
  // Add verifier
  console.log("Adding verifier...");
  const tx = await VerificationContract.addVerifier(verifierAddress);
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Verifier added! (block", receipt.blockNumber + ")");
  
  // Wait for RPC to index the new state, then verify
  async function readStatus() {
    const v = await VerificationContract.verifiers(verifierAddress);
    const i = await VerificationContract.isVerifier(verifierAddress);
    return { verifiers: v, isVerifier: i };
  }
  await new Promise((r) => setTimeout(r, 3000));
  let status = await readStatus();
  if (!status.isVerifier) {
    await new Promise((r) => setTimeout(r, 2000));
    status = await readStatus();
  }
  console.log("New verifier status: verifiers() =", status.verifiers, ", isVerifier() =", status.isVerifier);
  if (!status.isVerifier) {
    const proxy = VERIFICATION_ADDRESS;
    const baseUrl = "https://basescan.org";
    console.log("");
    console.log("⚠️  Read still false (possible RPC lag or storage layout after upgrade). Please verify:");
    console.log("   • Tx (look for VerifierAdded event):", baseUrl + "/tx/" + tx.hash);
    console.log("   • Read isVerifier on contract:", baseUrl + "/address/" + proxy + "#readContract");
  }
}

main().catch(console.error);
