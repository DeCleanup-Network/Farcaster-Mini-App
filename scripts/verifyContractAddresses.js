#!/usr/bin/env node
/**
 * Verify that contract addresses in .env.local match contracts/.env
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const contractsEnvPath = path.join(rootDir, 'contracts', '.env');
const frontendEnvPath = path.join(rootDir, '.env.local');

console.log('🔍 Verifying Contract Addresses\n');

// Read contracts/.env
let contractsEnv = {};
if (fs.existsSync(contractsEnvPath)) {
  const contractsEnvContent = fs.readFileSync(contractsEnvPath, 'utf8');
  contractsEnvContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      contractsEnv[key] = value;
    }
  });
} else {
  console.error('❌ contracts/.env not found');
  process.exit(1);
}

// Read .env.local
let frontendEnv = {};
if (fs.existsSync(frontendEnvPath)) {
  const frontendEnvContent = fs.readFileSync(frontendEnvPath, 'utf8');
  frontendEnvContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      frontendEnv[key] = value;
    }
  });
} else {
  console.error('❌ .env.local not found');
  process.exit(1);
}

// Map contract addresses
const addressMap = {
  'NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT': 'IMPACT_PRODUCT_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_VERIFICATION_CONTRACT': 'VERIFICATION_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT': 'REWARD_DISTRIBUTOR_CONTRACT_ADDRESS',
};

let allMatch = true;
const updates = [];

console.log('📊 Address Comparison:\n');

Object.entries(addressMap).forEach(([frontendKey, contractsKey]) => {
  const frontendAddr = frontendEnv[frontendKey];
  const contractsAddr = contractsEnv[contractsKey];
  
  if (!contractsAddr) {
    console.log(`⚠️  ${frontendKey}: Not found in contracts/.env`);
    allMatch = false;
    return;
  }
  
  if (!frontendAddr) {
    console.log(`❌ ${frontendKey}: Missing in .env.local`);
    console.log(`   Should be: ${contractsAddr}`);
    updates.push(`${frontendKey}=${contractsAddr}`);
    allMatch = false;
  } else if (frontendAddr.toLowerCase() !== contractsAddr.toLowerCase()) {
    console.log(`❌ ${frontendKey}: MISMATCH`);
    console.log(`   Current:   ${frontendAddr}`);
    console.log(`   Should be: ${contractsAddr}`);
    updates.push(`${frontendKey}=${contractsAddr}`);
    allMatch = false;
  } else {
    console.log(`✅ ${frontendKey}: ${frontendAddr}`);
  }
});

console.log('');

if (allMatch) {
  console.log('✅ All contract addresses match!\n');
} else {
  console.log('❌ Address mismatches found!\n');
  console.log('📝 Update .env.local with these lines:\n');
  updates.forEach(update => console.log(update));
  console.log('');
  console.log('Or run this command to update automatically:');
  console.log('  node scripts/updateContractAddresses.js\n');
}

process.exit(allMatch ? 0 : 1);

