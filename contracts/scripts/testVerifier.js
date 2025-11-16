const { ethers } = require("hardhat");

/**
 * Test script to verify if isVerifier function exists on deployed contract
 */
async function main() {
  const contractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS || "0xA77861Eea1D5cB1428d78C6CD12d78DD88d122F7";
  const testAddress = "0x7D85fCbB505D48E6176483733b62b51704e0bF95";
  
  console.log("Testing contract:", contractAddress);
  console.log("Test address:", testAddress);
  console.log("Network:", await ethers.provider.getNetwork().then(n => `${n.name} (${n.chainId})`));
  
  // Get the contract factory to load the ABI
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  
  // Attach to deployed contract
  const contract = VerificationContract.attach(contractAddress);
  
  console.log("\n=== Testing Functions ===");
  
  // Test 1: Try to call isVerifier
  try {
    console.log("\n1. Testing isVerifier function...");
    const isVerifierResult = await contract.isVerifier(testAddress);
    console.log("✓ isVerifier function exists!");
    console.log("  Result:", isVerifierResult);
  } catch (error) {
    console.log("✗ isVerifier function failed:", error.message);
    if (error.message.includes("is not a function") || error.message.includes("does not have the function")) {
      console.log("  → Contract does NOT have isVerifier function!");
    }
  }
  
  // Test 2: Try to call old verifier() function
  try {
    console.log("\n2. Testing old verifier() function...");
    const oldVerifier = await contract.verifier();
    console.log("✓ Old verifier() function exists");
    console.log("  Result:", oldVerifier);
    if (oldVerifier === "0x0000000000000000000000000000000000000000") {
      console.log("  → Returns zero address (deprecated)");
    }
  } catch (error) {
    console.log("✗ Old verifier() function failed:", error.message);
  }
  
  // Test 3: Try to get cleanupCounter
  try {
    console.log("\n3. Testing cleanupCounter...");
    const counter = await contract.cleanupCounter();
    console.log("✓ cleanupCounter exists");
    console.log("  Result:", counter.toString());
  } catch (error) {
    console.log("✗ cleanupCounter failed:", error.message);
  }
  
  // Test 4: Check contract code
  console.log("\n4. Checking contract bytecode...");
  const code = await ethers.provider.getCode(contractAddress);
  if (code === "0x") {
    console.log("✗ No contract code found at this address!");
  } else {
    console.log("✓ Contract has code (length:", code.length, "chars)");
    
    // Check if bytecode contains function selector for isVerifier
    // Function selector for isVerifier(address) is keccak256("isVerifier(address)")[0:4]
    // This is: 0x8f4ffcb1 (approximate check)
    const isVerifierSelector = "8f4ffcb1";
    if (code.includes(isVerifierSelector)) {
      console.log("  → Bytecode contains isVerifier selector!");
    } else {
      console.log("  → Bytecode does NOT contain isVerifier selector");
      console.log("  → Contract was likely deployed with old code");
    }
  }
  
  console.log("\n=== Test Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

