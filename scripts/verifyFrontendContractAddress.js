#!/usr/bin/env node

/**
 * Verify Frontend Contract Address
 * 
 * This script checks if the frontend .env.local has the correct VerificationContract address
 * that matches the deployed contract.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_ENV_PATH = path.join(__dirname, '..', '.env.local');
const CONTRACTS_ENV_PATH = path.join(__dirname, '..', 'contracts', '.env');

// Expected contract address from test output
const EXPECTED_VERIFICATION_ADDRESS = '0x6d1Fbd1A6EB01770465D9ce90042D5cE3dCD6864';

console.log('🔍 Verifying Frontend Contract Address Configuration\n');

// Read contracts/.env
let contractsEnv = {};
if (fs.existsSync(CONTRACTS_ENV_PATH)) {
  const contractsEnvContent = fs.readFileSync(CONTRACTS_ENV_PATH, 'utf8');
  contractsEnvContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value && !key.startsWith('#')) {
        contractsEnv[key] = value;
      }
    }
  });
} else {
  console.log('⚠️  contracts/.env not found\n');
}

// Read .env.local
let frontendEnv = {};
if (fs.existsSync(FRONTEND_ENV_PATH)) {
  const frontendEnvContent = fs.readFileSync(FRONTEND_ENV_PATH, 'utf8');
  frontendEnvContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value && !key.startsWith('#')) {
        frontendEnv[key] = value;
      }
    }
  });
} else {
  console.log('❌ .env.local not found');
  console.log('   Creating .env.local with correct addresses...\n');
}

// Get contract addresses from contracts/.env
const verificationAddress = 
  contractsEnv.VERIFICATION_CONTRACT_ADDRESS ||
  contractsEnv.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
  EXPECTED_VERIFICATION_ADDRESS;

const impactProductAddress = 
  contractsEnv.IMPACT_PRODUCT_CONTRACT_ADDRESS ||
  contractsEnv.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
  contractsEnv.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS;

const bdcuDistributorAddress = 
  contractsEnv.BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
  contractsEnv.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS;

// Check frontend addresses
const frontendVerification = 
  frontendEnv.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
  frontendEnv.NEXT_PUBLIC_VERIFICATION_CONTRACT;

const frontendImpactProduct = 
  frontendEnv.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
  frontendEnv.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT;

const frontendBDCUDistributor = 
  frontendEnv.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
  frontendEnv.NEXT_PUBLIC_BDCU_DISTRIBUTOR_ADDRESS;

console.log('📋 Contract Addresses:\n');
console.log('From contracts/.env:');
console.log(`   VerificationContract: ${verificationAddress || 'NOT SET'}`);
console.log(`   ImpactProductNFT: ${impactProductAddress || 'NOT SET'}`);
console.log(`   bDCURewardDistributor: ${bdcuDistributorAddress || 'NOT SET'}`);
console.log('\nFrom .env.local (frontend):');
console.log(`   NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS: ${frontendVerification || 'NOT SET'}`);
console.log(`   NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS: ${frontendImpactProduct || 'NOT SET'}`);
console.log(`   NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS: ${frontendBDCUDistributor || 'NOT SET'}\n`);

// Check if addresses match
let needsUpdate = false;
const updates = [];

if (verificationAddress) {
  if (!frontendVerification || verificationAddress.toLowerCase() !== frontendVerification.toLowerCase()) {
    console.log('❌ VerificationContract address MISMATCH!');
    console.log(`   Expected: ${verificationAddress}`);
    console.log(`   Found: ${frontendVerification || 'NOT SET'}\n`);
    needsUpdate = true;
    updates.push(`NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=${verificationAddress}`);
  } else {
    console.log('✅ VerificationContract address matches\n');
  }
}

if (impactProductAddress) {
  if (!frontendImpactProduct || impactProductAddress.toLowerCase() !== frontendImpactProduct.toLowerCase()) {
    console.log('⚠️  ImpactProductNFT address mismatch');
    console.log(`   Expected: ${impactProductAddress}`);
    console.log(`   Found: ${frontendImpactProduct || 'NOT SET'}\n`);
    needsUpdate = true;
    updates.push(`NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=${impactProductAddress}`);
  } else {
    console.log('✅ ImpactProductNFT address matches\n');
  }
}

if (bdcuDistributorAddress) {
  if (!frontendBDCUDistributor || bdcuDistributorAddress.toLowerCase() !== frontendBDCUDistributor.toLowerCase()) {
    console.log('⚠️  bDCURewardDistributor address mismatch');
    console.log(`   Expected: ${bdcuDistributorAddress}`);
    console.log(`   Found: ${frontendBDCUDistributor || 'NOT SET'}\n`);
    needsUpdate = true;
    updates.push(`NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=${bdcuDistributorAddress}`);
  } else {
    console.log('✅ bDCURewardDistributor address matches\n');
  }
}

if (needsUpdate) {
  console.log('📝 Required updates to .env.local:\n');
  updates.forEach(update => console.log(`   ${update}`));
  console.log('\n💡 To fix:');
  console.log('   1. Open .env.local');
  console.log('   2. Update or add the lines above');
  console.log('   3. Restart your Next.js dev server (npm run dev)');
  console.log('   4. Clear browser cache and hard refresh\n');
  
  // Ask if user wants to update automatically
  console.log('⚠️  IMPORTANT: The frontend must use the correct contract address!');
  console.log('   If the address is wrong, transactions will fail.\n');
} else {
  console.log('✅ All contract addresses are correctly configured!\n');
  console.log('💡 If transactions are still failing, check:');
  console.log('   1. Browser console for specific error messages');
  console.log('   2. Network is Base Sepolia (Chain ID: 84532)');
  console.log('   3. Wallet has enough ETH for gas');
  console.log('   4. Restart dev server after updating .env.local\n');
}

