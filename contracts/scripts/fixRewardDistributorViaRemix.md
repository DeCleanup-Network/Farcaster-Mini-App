# Fix RewardDistributor via Remix IDE

Since the contract is not verified on CeloScan, use Remix IDE instead.

## Steps:

1. **Go to Remix IDE:**
   - Open: https://remix.ethereum.org

2. **Connect Your Wallet:**
   - Click the "Connect to Remix" button or use the Solidity plugin
   - Connect with address: `0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84` (owner)

3. **Load the Contract:**
   - Go to "Deploy & Run Transactions" tab
   - Select "Injected Provider - MetaMask" (or your wallet)
   - Make sure network is "Celo Sepolia"

4. **At Address:**
   - Enter: `0x66c0FEB0F2F881306ab57CA6eF4C691753184504`
   - Click "At Address"

5. **Find the Function:**
   - Scroll to find `setImpactProductNFT`
   - Enter parameter: `0x0F4193e25E3292e87970fa23c1555C8769A77278`
   - Click the function button

6. **Confirm Transaction:**
   - MetaMask will pop up
   - Confirm the transaction

## Alternative: Use MetaMask Directly

1. Open MetaMask
2. Go to "Send" tab
3. Click "Hex Data" tab
4. Enter the function call data (I can provide this)
5. Send to: `0x66c0FEB0F2F881306ab57CA6eF4C691753184504`

