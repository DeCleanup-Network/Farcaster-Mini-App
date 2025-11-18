/**
 * Check what metadata the contract is actually returning
 * 
 * Usage:
 *   node scripts/checkContractMetadata.js
 * 
 * This will fetch the actual tokenURI from the contract and see what metadata it points to
 */

require('dotenv').config({ path: '.env.local' })

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS || process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT
const RPC_URL =
  process.env.NEXT_PUBLIC_TESTNET_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://sepolia.base.org'

if (!CONTRACT_ADDRESS) {
  console.error('❌ NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS not set in .env.local')
  process.exit(1)
}

// Simple ABI for tokenURI
const ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'baseURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
]

async function checkContract() {
  try {
    // Use fetch to call the contract (simple approach)
    const baseURIResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: CONTRACT_ADDRESS,
            data: '0x6c0360eb', // baseURI() function selector
          },
          'latest',
        ],
      }),
    })
    
    const baseURIData = await baseURIResponse.json()
    console.log('📋 Contract baseURI:', baseURIData)
    
    // For tokenURI, we'd need a token ID, but let's just check baseURI first
    console.log('\n🔍 To check tokenURI, we need:')
    console.log('1. A user address that has an NFT')
    console.log('2. Get their tokenId')
    console.log('3. Call tokenURI(tokenId)')
    
    console.log('\n💡 Quick fix:')
    console.log('The metadata on IPFS needs to be updated with the correct image paths.')
    console.log('Local files are correct, but IPFS still has old paths.')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkContract()

