#!/usr/bin/env node
/**
 * Update contract addresses in .env.local to match contracts/.env
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const contractsEnvPath = path.join(rootDir, 'contracts', '.env');
const frontendEnvPath = path.join(rootDir, '.env.local');

console.log('🔄 Updating Contract Addresses in .env.local\n');

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
let frontendEnvLines = [];
if (fs.existsSync(frontendEnvPath)) {
  frontendEnvLines = fs.readFileSync(frontendEnvPath, 'utf8').split('\n');
} else {
  console.error('❌ .env.local not found');
  process.exit(1);
}

// Map contract addresses
const addressMap = {
  'NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT': 'IMPACT_PRODUCT_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_VERIFICATION_CONTRACT': 'VERIFICATION_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT': 'REWARD_DISTRIBUTOR_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_RECYCLABLES_CONTRACT': 'RECYCLABLES_CONTRACT_ADDRESS',
};

// Update addresses
let updated = false;
const updatedLines = frontendEnvLines.map(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (!match) return line;
  
  const key = match[1].trim();
  const value = match[2].trim();
  
  if (addressMap[key]) {
    const contractsKey = addressMap[key];
    const newValue = contractsEnv[contractsKey];
    
    if (newValue && value.toLowerCase() !== newValue.toLowerCase()) {
      console.log(`✅ Updating ${key}: ${value} → ${newValue}`);
      updated = true;
      return `${key}=${newValue}`;
    }
  }
  
  return line;
});

// Add missing addresses
Object.entries(addressMap).forEach(([frontendKey, contractsKey]) => {
  const exists = frontendEnvLines.some(line => {
    const match = line.match(/^([^=]+)=/);
    return match && match[1].trim() === frontendKey;
  });
  
  if (!exists) {
    const newValue = contractsEnv[contractsKey];
    if (newValue) {
      console.log(`➕ Adding ${frontendKey}=${newValue}`);
      updatedLines.push(`${frontendKey}=${newValue}`);
      updated = true;
    }
  }
});

if (updated) {
  fs.writeFileSync(frontendEnvPath, updatedLines.join('\n') + '\n');
  console.log('\n✅ .env.local updated successfully!\n');
  console.log('⚠️  Restart your dev server for changes to take effect.\n');
} else {
  console.log('✅ All addresses are already up to date!\n');
}

