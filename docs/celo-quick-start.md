# Celo Integration Quick Start

## Prerequisites

1. **Development Environment**
   ```bash
   node --version  # Should be v20+
   npm --version
   ```

2. **Get Testnet Tokens**
   - Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
   - Celo Sepolia: https://faucet.celo.org/

3. **Set Up Wallet**
   - MetaMask or Coinbase Wallet
   - Add both networks (Base Sepolia & Celo Sepolia)
   - Fund with testnet tokens

## Step 1: Research Clanker

**CRITICAL**: Before writing any code, research Clanker:

1. **Find Official Documentation**
   - Search: "Clanker Base Celo bridge"
   - Check Base ecosystem docs
   - Look for GitHub repos
   - Join Base/Celo developer communities

2. **Document Key Information**
   Create a file `docs/clanker-research.md` with:
   - Bridge contract addresses
   - Bridge ABI
   - Registration process
   - Fee structure
   - Integration examples

## Step 2: Add Celo Sepolia to Project

### Update `lib/wagmi.ts`

```typescript
import { celoSepolia } from 'wagmi/chains'
import { defineChain } from 'viem'

const celoSepoliaChain = defineChain({
  id: 44787,
  name: 'Celo Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL || 'https://sepolia-forno.celo-testnet.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'CeloScan Sepolia',
      url: 'https://sepolia.celoscan.io',
    },
  },
  testnet: true,
})

// Add to configuredChains array
const configuredChains: [Chain, ...Chain[]] = [
  baseSepoliaChain,
  baseMainnet,
  celoSepoliaChain, // Add this
]
```

### Update Environment Variables

Add to `.env.local`:

```bash
# Celo Sepolia
NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL=https://sepolia-forno.celo-testnet.org
CELO_SEPOLIA_RPC_URL=https://sepolia-forno.celo-testnet.org
CELOSCAN_API_KEY=your_api_key_here
```

## Step 3: Create Token Contracts

### Install Dependencies

```bash
npm install --save-dev @openzeppelin/contracts
```

### Create `contracts/DCUToken.sol`

See full contract in `docs/celo-integration-guide.md` section "Token Contract Deployment"

## Step 4: Deploy Tokens

### Deploy Scripts

Create deployment scripts (see guide for full code):

```bash
# Deploy bDCU on Base Sepolia
npx hardhat run scripts/deploy-dcu-base.ts --network baseSepolia

# Deploy cDCU on Celo Sepolia  
npx hardhat run scripts/deploy-dcu-celo.ts --network celoSepolia
```

### Save Contract Addresses

Add to `.env.local`:

```bash
NEXT_PUBLIC_BASE_DCU_ADDRESS=0x...
NEXT_PUBLIC_CELO_DCU_ADDRESS=0x...
```

## Step 5: Research Clanker Bridge

**This is the most important step!**

1. Find Clanker bridge contract addresses
2. Get bridge contract ABI
3. Understand registration process
4. Test bridge functionality

## Step 6: Integrate Bridge

Once you have Clanker information:

1. Create `lib/clanker.ts` (see guide for template)
2. Add bridge UI component
3. Test bridge functionality
4. Update frontend to support both chains

## Next Steps

1. ✅ Research Clanker thoroughly
2. ✅ Add Celo Sepolia to wagmi config
3. ✅ Deploy test tokens
4. ✅ Integrate Clanker bridge
5. ✅ Test end-to-end
6. ✅ Deploy to production

## Troubleshooting

### Can't find Clanker docs?
- Check Base ecosystem page
- Ask in Base/Celo Discord
- Look for similar bridge implementations
- Consider alternative bridge protocols

### Token deployment fails?
- Check you have testnet tokens
- Verify RPC URL is correct
- Check gas prices
- Review contract code

### Bridge not working?
- Verify bridge contract addresses
- Check token registration
- Review Clanker requirements
- Test with small amounts first

## Support

- Celo Discord: https://discord.gg/celo
- Base Discord: https://discord.gg/base
- Celo Forum: https://forum.celo.org

