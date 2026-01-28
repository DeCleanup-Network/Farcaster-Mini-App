#!/usr/bin/env node
/**
 * Run addVerifier.js with an absolute path so Hardhat finds it regardless of cwd.
 * Use:  node run-addVerifier.js [base|baseSepolia]
 * Or:   npm run addVerifier:base   (from contracts/)
 */
const { execSync } = require('child_process');
const path = require('path');

const network = process.argv[2] || 'base';
const scriptPath = path.join(__dirname, 'scripts', 'addVerifier.js');

execSync(`npx hardhat run "${scriptPath}" --network ${network}`, {
  stdio: 'inherit',
  cwd: __dirname,
});
