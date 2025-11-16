/**
 * Create a zip file of metadata for easy upload to Pinata
 * 
 * Usage:
 *   node scripts/createMetadataZip.js
 * 
 * Then upload the generated zip file to Pinata web UI
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const METADATA_DIR = path.join(__dirname, '..', 'metadata', 'impact-products')
const ZIP_FILE = path.join(__dirname, '..', 'metadata-impact-products.zip')

try {
  // Check if zip command is available
  try {
    execSync('which zip', { stdio: 'ignore' })
  } catch (e) {
    throw new Error('zip command not found. On macOS, install with: brew install zip')
  }

  // Remove old zip if exists
  if (fs.existsSync(ZIP_FILE)) {
    fs.unlinkSync(ZIP_FILE)
  }

  // Create zip file
  console.log('Creating zip file...')
  execSync(`cd "${METADATA_DIR}" && zip -r "${ZIP_FILE}" *.json`, { stdio: 'inherit' })

  console.log('')
  console.log('✅ Zip file created:', ZIP_FILE)
  console.log('')
  console.log('📝 Next steps:')
  console.log('   1. Go to https://www.pinata.cloud/')
  console.log('   2. Click "Upload" → "File"')
  console.log('   3. Upload the zip file:', ZIP_FILE)
  console.log('   4. Pinata will extract it and give you a CID')
  console.log('   5. Update the contract baseURI with the new CID')
  console.log('')
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

