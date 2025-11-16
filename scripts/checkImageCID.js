/**
 * Check what files are actually in the images CID
 * 
 * Usage:
 *   node scripts/checkImageCID.js
 * 
 * This will try to list the contents of the images CID to see the actual file structure
 */

const IMAGES_CID = 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'

// Try different possible paths
const possiblePaths = [
  // Root level
  `https://gateway.pinata.cloud/ipfs/${IMAGES_CID}/`,
  `https://ipfs.io/ipfs/${IMAGES_CID}/`,
  
  // With images folder
  `https://gateway.pinata.cloud/ipfs/${IMAGES_CID}/images/`,
  `https://ipfs.io/ipfs/${IMAGES_CID}/images/`,
  
  // Try specific files we think exist
  `https://gateway.pinata.cloud/ipfs/${IMAGES_CID}/IP1.png`,
  `https://gateway.pinata.cloud/ipfs/${IMAGES_CID}/images/level1.png`,
  `https://gateway.pinata.cloud/ipfs/${IMAGES_CID}/level1.png`,
]

console.log('🔍 Checking images CID structure...')
console.log(`CID: ${IMAGES_CID}`)
console.log('')

async function checkPath(url, description) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok) {
      console.log(`✅ ${description}: ${url} - EXISTS`)
      return true
    } else {
      console.log(`❌ ${description}: ${url} - ${response.status}`)
      return false
    }
  } catch (error) {
    console.log(`❌ ${description}: ${url} - ERROR: ${error.message}`)
    return false
  }
}

async function checkAll() {
  console.log('Checking possible image paths...\n')
  
  // Check root directory (might return HTML listing)
  console.log('1. Checking root directory:')
  await checkPath(`https://gateway.pinata.cloud/ipfs/${IMAGES_CID}/`, 'Root directory')
  
  console.log('\n2. Checking specific files:')
  const filesToCheck = [
    { path: 'IP1.png', desc: 'IP1.png (root)' },
    { path: 'IP2.png', desc: 'IP2.png (root)' },
    { path: 'images/level1.png', desc: 'images/level1.png' },
    { path: 'images/level2.png', desc: 'images/level2.png' },
    { path: 'level1.png', desc: 'level1.png (root)' },
  ]
  
  for (const file of filesToCheck) {
    await checkPath(
      `https://gateway.pinata.cloud/ipfs/${IMAGES_CID}/${file.path}`,
      file.desc
    )
  }
  
  console.log('\n📋 Next steps:')
  console.log('1. Check which files actually exist in the CID')
  console.log('2. Update metadata JSON files to match the actual file names')
  console.log('3. Re-upload metadata to IPFS')
  console.log('4. Update contract baseURI')
}

checkAll().catch(console.error)

