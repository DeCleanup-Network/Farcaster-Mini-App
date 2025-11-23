# Celo Integration Guide - $bDCU and $cDCU Tokens with Clanker

## Overview

This guide covers integrating Celo Sepolia testnet into the DeCleanup Rewards application and setting up $bDCU (Base DCU) and $cDCU (Celo DCU) tokens using the Clanker protocol for cross-chain token bridging.

**Note**: This guide provides a comprehensive framework, but you'll need to research Clanker's actual bridge implementation and update the code accordingly.

## Quick Start Checklist

Before diving in, gather these resources:

- [ ] Clanker official documentation URL
- [ ] Clanker bridge contract addresses (Base Sepolia & Celo Sepolia)
- [ ] Clanker bridge contract ABI/interface
- [ ] Testnet faucet URLs for both chains
- [ ] Block explorer URLs
- [ ] Development wallet with testnet tokens

## Table of Contents

1. [Understanding Clanker Protocol](#understanding-clanker-protocol)
2. [Celo Sepolia Setup](#celo-sepolia-setup)
3. [Token Contract Deployment](#token-contract-deployment)
4. [Clanker Integration](#clanker-integration)
5. [Frontend Integration](#frontend-integration)
6. [Testing Strategy](#testing-strategy)
7. [Environment Variables](#environment-variables)
8. [Deployment Checklist](#deployment-checklist)

---

## Understanding Clanker Protocol

### What is Clanker?

**⚠️ IMPORTANT: Clanker Documentation Research Required**

Clanker is a cross-chain token bridge protocol that enables seamless token transfers between Base and Celo networks. However, **you need to research Clanker's official documentation** to get:

1. **Bridge Contract Addresses** (testnet and mainnet)
2. **Bridge Contract ABI** (exact interface)
3. **Registration Process** (how to register tokens)
4. **Bridge Fees** (fee structure and payment method)
5. **Integration Requirements** (any special setup needed)

### Research Steps

1. **Find Clanker Documentation**
   - Search for "Clanker protocol Base Celo bridge"
   - Check Base ecosystem documentation (https://docs.base.org)
   - Look for Clanker GitHub repository
   - Check Base/Celo developer forums and Discord
   - Contact Base/Celo developer relations

2. **Key Information to Gather**
   - Bridge contract addresses for Base Sepolia and Celo Sepolia
   - Bridge contract ABI/interface
   - Token registration process
   - Bridge fee calculation
   - Cross-chain message format
   - Estimated bridge time
   - Whether Clanker uses lock-and-mint or burn-and-mint
   - If tokens need to be "wrapped" versions or native deployments

3. **Alternative Bridge Protocols**
   If Clanker documentation is not available, consider researching:
   - **LayerZero**: Cross-chain messaging protocol
   - **Wormhole**: Cross-chain bridge
   - **Axelar**: Cross-chain communication
   - **Base Native Bridge**: Base's official bridge solution

4. **Update This Guide**
   - Replace placeholder addresses with actual Clanker addresses
   - Update ABI with actual Clanker interface
   - Add Clanker-specific integration steps
   - Document any special requirements

### Key Concepts

- **$bDCU**: DCU token on Base network (Base Sepolia testnet initially)
- **$cDCU**: DCU token on Celo network (Celo Sepolia testnet initially)
- **Bridge**: Clanker protocol handles the cross-chain transfers
- **Lock & Mint**: Tokens are locked on source chain and minted on destination chain

### Clanker Architecture

1. **Source Chain (Base)**: User locks $bDCU tokens
2. **Bridge Contract**: Clanker bridge contract receives locked tokens
3. **Destination Chain (Celo)**: Equivalent $cDCU tokens are minted
4. **Reverse Process**: Same mechanism works in reverse

---

## Celo Sepolia Setup

### 1. Network Configuration

Celo Sepolia testnet details:
- **Chain ID**: 44787
- **RPC URL**: `https://sepolia-forno.celo-testnet.org`
- **Block Explorer**: `https://sepolia.celoscan.io`
- **Native Currency**: CELO (testnet)
- **Testnet Faucet**: https://faucet.celo.org/

### 2. Add Celo Sepolia to Wagmi Configuration

Update `lib/wagmi.ts`:

```typescript
import { celo, celoAlfajores } from 'wagmi/chains'
import { defineChain } from 'viem'

// Celo Sepolia chain definition
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
      http: ['https://sepolia-forno.celo-testnet.org'],
    },
    public: {
      http: ['https://sepolia-forno.celo-testnet.org'],
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

// Add to configuredChains
const configuredChains: [Chain, ...Chain[]] = [
  baseSepoliaChain,
  baseMainnet,
  celoSepoliaChain, // Add Celo Sepolia
]
```

### 3. Update Chain Selection Logic

Add environment variable support for chain selection:

```typescript
// In lib/wagmi.ts
const REQUIRED_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID || 
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 
  baseSepoliaChain.id
)

// Support multiple chains
export const SUPPORTED_CHAINS = {
  BASE_SEPOLIA: baseSepoliaChain.id,
  BASE_MAINNET: baseMainnet.id,
  CELO_SEPOLIA: celoSepoliaChain.id,
} as const

export type SupportedChainId = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS]
```

---

## Token Contract Deployment

### 1. DCU Token Contract Structure

Create `contracts/DCUToken.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/**
 * @title DCUToken
 * @dev ERC20 token for DeCleanup Rewards
 * Supports both Base ($bDCU) and Celo ($cDCU) variants
 */
contract DCUToken is ERC20, ERC20Burnable, Ownable, ERC20Pausable {
    string private _chainPrefix;
    
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        string memory chainPrefix
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _chainPrefix = chainPrefix;
        // Initial supply: 0 (tokens will be minted through rewards)
    }
    
    /**
     * @dev Mint tokens (only owner, typically reward distributor)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Pause token transfers (emergency only)
     */
    function pause() public onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() public onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get chain prefix (b for Base, c for Celo)
     */
    function chainPrefix() public view returns (string memory) {
        return _chainPrefix;
    }
    
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
```

### 2. Deployment Scripts

Create `scripts/deploy-dcu-base.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying DCU Token on Base Sepolia with account:", deployer.address);

  const DCUToken = await ethers.getContractFactory("DCUToken");
  const dcuToken = await DCUToken.deploy(
    "Base DeCleanup Token",
    "bDCU",
    deployer.address,
    "b"
  );

  await dcuToken.waitForDeployment();
  const address = await dcuToken.getAddress();

  console.log("bDCU Token deployed to:", address);
  console.log("Deployer balance:", (await ethers.provider.getBalance(deployer.address)).toString());
}
```

Create `scripts/deploy-dcu-celo.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying DCU Token on Celo Sepolia with account:", deployer.address);

  const DCUToken = await ethers.getContractFactory("DCUToken");
  const dcuToken = await DCUToken.deploy(
    "Celo DeCleanup Token",
    "cDCU",
    deployer.address,
    "c"
  );

  await dcuToken.waitForDeployment();
  const address = await dcuToken.getAddress();

  console.log("cDCU Token deployed to:", address);
}
```

### 3. Hardhat Configuration

Update `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },
    celoSepolia: {
      url: process.env.CELO_SEPOLIA_RPC_URL || "https://sepolia-forno.celo-testnet.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 44787,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      celoSepolia: process.env.CELOSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "celoSepolia",
        chainId: 44787,
        urls: {
          apiURL: "https://api-sepolia.celoscan.io/api",
          browserURL: "https://sepolia.celoscan.io",
        },
      },
    ],
  },
};

export default config;
```

---

## Clanker Integration

### 1. Understanding Clanker Bridge

Clanker provides a bridge contract that:
- Locks tokens on the source chain
- Mints equivalent tokens on the destination chain
- Maintains 1:1 token ratio across chains
- Handles cross-chain message passing

### 2. Clanker Bridge Contract Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IClankerBridge {
    /**
     * @dev Bridge tokens from source chain to destination chain
     * @param token Address of token to bridge
     * @param amount Amount of tokens to bridge
     * @param destinationChainId Chain ID of destination chain
     * @param recipient Address to receive tokens on destination chain
     */
    function bridgeTokens(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        address recipient
    ) external payable;
    
    /**
     * @dev Get bridge fee for a token transfer
     */
    function getBridgeFee(
        address token,
        uint256 amount,
        uint256 destinationChainId
    ) external view returns (uint256);
    
    /**
     * @dev Check if a token is supported for bridging
     */
    function isTokenSupported(address token) external view returns (bool);
}
```

### 3. Integration Steps

#### Step 1: Deploy Tokens on Both Chains

```bash
# Deploy on Base Sepolia
npx hardhat run scripts/deploy-dcu-base.ts --network baseSepolia

# Deploy on Celo Sepolia
npx hardhat run scripts/deploy-dcu-celo.ts --network celoSepolia
```

#### Step 2: Register Tokens with Clanker

After deploying, register both tokens with Clanker bridge:

```typescript
// scripts/register-clanker.ts
import { ethers } from "hardhat";

async function main() {
  const CLANKER_BRIDGE_ADDRESS = process.env.CLANKER_BRIDGE_ADDRESS;
  const BASE_DCU_ADDRESS = process.env.BASE_DCU_ADDRESS;
  const CELO_DCU_ADDRESS = process.env.CELO_DCU_ADDRESS;
  
  const bridge = await ethers.getContractAt("IClankerBridge", CLANKER_BRIDGE_ADDRESS);
  
  // Register Base DCU
  await bridge.registerToken(BASE_DCU_ADDRESS, 84532); // Base Sepolia chain ID
  
  // Register Celo DCU
  await bridge.registerToken(CELO_DCU_ADDRESS, 44787); // Celo Sepolia chain ID
  
  console.log("Tokens registered with Clanker bridge");
}
```

#### Step 3: Approve and Bridge Function

Create `lib/clanker.ts`:

```typescript
import { Address, parseUnits } from 'viem'
import { writeContract, readContract, waitForTransactionReceipt } from 'wagmi/actions'
import { config } from './wagmi'

const CLANKER_BRIDGE_ABI = [
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'destinationChainId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    name: 'bridgeTokens',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'destinationChainId', type: 'uint256' },
    ],
    name: 'getBridgeFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'bigint' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export interface BridgeConfig {
  baseSepolia: {
    dcuToken: Address
    bridge: Address
  }
  celoSepolia: {
    dcuToken: Address
    bridge: Address
  }
}

export const BRIDGE_CONFIG: BridgeConfig = {
  baseSepolia: {
    dcuToken: (process.env.NEXT_PUBLIC_BASE_DCU_ADDRESS || '0x0') as Address,
    bridge: (process.env.NEXT_PUBLIC_CLANKER_BRIDGE_BASE || '0x0') as Address,
  },
  celoSepolia: {
    dcuToken: (process.env.NEXT_PUBLIC_CELO_DCU_ADDRESS || '0x0') as Address,
    bridge: (process.env.NEXT_PUBLIC_CLANKER_BRIDGE_CELO || '0x0') as Address,
  },
}

/**
 * Get bridge fee for a token transfer
 */
export async function getBridgeFee(
  token: Address,
  amount: bigint,
  destinationChainId: number,
  sourceChainId: number
): Promise<bigint> {
  const bridgeAddress = sourceChainId === 84532 
    ? BRIDGE_CONFIG.baseSepolia.bridge
    : BRIDGE_CONFIG.celoSepolia.bridge

  const fee = await readContract(config, {
    address: bridgeAddress,
    abi: CLANKER_BRIDGE_ABI,
    functionName: 'getBridgeFee',
    args: [token, amount, BigInt(destinationChainId)],
  })

  return fee as bigint
}

/**
 * Bridge tokens from one chain to another using Clanker
 */
export async function bridgeDCUTokens(
  sourceChainId: number,
  destinationChainId: number,
  amount: string, // Amount as string (e.g., "100.5")
  recipient: Address
): Promise<`0x${string}`> {
  const isFromBase = sourceChainId === 84532
  const tokenAddress = isFromBase 
    ? BRIDGE_CONFIG.baseSepolia.dcuToken
    : BRIDGE_CONFIG.celoSepolia.dcuToken
  const bridgeAddress = isFromBase
    ? BRIDGE_CONFIG.baseSepolia.bridge
    : BRIDGE_CONFIG.celoSepolia.bridge

  const amountWei = parseUnits(amount, 18)

  // Step 1: Check and approve token spending
  const currentAllowance = await readContract(config, {
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [recipient, bridgeAddress],
  })

  if (currentAllowance < amountWei) {
    // Approve bridge to spend tokens
    const approveHash = await writeContract(config, {
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [bridgeAddress, amountWei],
    })

    await waitForTransactionReceipt(config, { hash: approveHash })
  }

  // Step 2: Get bridge fee
  const bridgeFee = await getBridgeFee(tokenAddress, amountWei, destinationChainId, sourceChainId)

  // Step 3: Bridge tokens
  const bridgeHash = await writeContract(config, {
    address: bridgeAddress,
    abi: CLANKER_BRIDGE_ABI,
    functionName: 'bridgeTokens',
    args: [tokenAddress, amountWei, BigInt(destinationChainId), recipient],
    value: bridgeFee, // Pay bridge fee in native token
  })

  return bridgeHash
}

/**
 * Get DCU token address for a given chain
 */
export function getDCUTokenAddress(chainId: number): Address | null {
  if (chainId === 84532) return BRIDGE_CONFIG.baseSepolia.dcuToken
  if (chainId === 44787) return BRIDGE_CONFIG.celoSepolia.dcuToken
  return null
}
```

---

## Frontend Integration

### 1. Update Chain Configuration

Update `lib/wagmi.ts` to include Celo Sepolia:

```typescript
// Add Celo Sepolia to chains
import { celoSepolia } from 'wagmi/chains'

const celoSepoliaChain = defineChain({
  ...celoSepolia,
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL || 'https://sepolia-forno.celo-testnet.org'],
    },
  },
})

const configuredChains: [Chain, ...Chain[]] = [
  baseSepoliaChain,
  baseMainnet,
  celoSepoliaChain,
]
```

### 2. Create Bridge UI Component

Create `components/bridge/BridgeTokens.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { Button } from '@/components/ui/button'
import { bridgeDCUTokens, getBridgeFee, getDCUTokenAddress } from '@/lib/clanker'
import { SUPPORTED_CHAINS } from '@/lib/wagmi'

export function BridgeTokens() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const [bridging, setBridging] = useState(false)
  const [destinationChain, setDestinationChain] = useState<number>(44787) // Default to Celo

  const handleBridge = async () => {
    if (!address || !amount) return

    setBridging(true)
    try {
      const destinationChainId = chainId === 84532 ? 44787 : 84532
      const hash = await bridgeDCUTokens(chainId, destinationChainId, amount, address)
      alert(`Bridge transaction submitted! Hash: ${hash}`)
      setAmount('')
    } catch (error: any) {
      console.error('Bridge failed:', error)
      alert(`Bridge failed: ${error.message}`)
    } finally {
      setBridging(false)
    }
  }

  const availableChains = [
    { id: 84532, name: 'Base Sepolia', symbol: 'bDCU' },
    { id: 44787, name: 'Celo Sepolia', symbol: 'cDCU' },
  ]

  const currentChain = availableChains.find(c => c.id === chainId)
  const otherChain = availableChains.find(c => c.id !== chainId)

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-xl font-bold uppercase">Bridge DCU Tokens</h2>
      
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Current Chain</label>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="font-semibold">{currentChain?.name}</p>
            <p className="text-sm text-muted-foreground">Balance: {currentChain?.symbol}</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Bridge To</label>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="font-semibold">{otherChain?.name}</p>
            <p className="text-sm text-muted-foreground">Will receive: {otherChain?.symbol}</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </div>

        <Button
          onClick={handleBridge}
          disabled={bridging || !amount || !address}
          className="w-full"
        >
          {bridging ? 'Bridging...' : `Bridge to ${otherChain?.name}`}
        </Button>
      </div>
    </div>
  )
}
```

### 3. Update Wallet Connection

Ensure wallet can switch to Celo Sepolia:

```typescript
// In components/wallet/WalletConnect.tsx
const CELO_SEPOLIA_CHAIN_ID = 44787

// Add switch chain handler for Celo
const switchToCelo = async () => {
  try {
    await switchChain({ chainId: CELO_SEPOLIA_CHAIN_ID })
  } catch (error) {
    // Handle chain switch error
  }
}
```

---

## Testing Strategy

### 1. Local Testing

```bash
# Test token deployment
npx hardhat run scripts/deploy-dcu-base.ts --network baseSepolia
npx hardhat run scripts/deploy-dcu-celo.ts --network celoSepolia

# Test bridge registration
npx hardhat run scripts/register-clanker.ts --network baseSepolia
```

### 2. Integration Tests

Create `test/bridge.test.ts`:

```typescript
import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('DCU Token Bridge', () => {
  it('Should deploy bDCU on Base Sepolia', async () => {
    const DCUToken = await ethers.getContractFactory('DCUToken')
    const token = await DCUToken.deploy(
      'Base DeCleanup Token',
      'bDCU',
      (await ethers.getSigners())[0].address,
      'b'
    )
    expect(await token.symbol()).to.equal('bDCU')
  })

  it('Should deploy cDCU on Celo Sepolia', async () => {
    const DCUToken = await ethers.getContractFactory('DCUToken')
    const token = await DCUToken.deploy(
      'Celo DeCleanup Token',
      'cDCU',
      (await ethers.getSigners())[0].address,
      'c'
    )
    expect(await token.symbol()).to.equal('cDCU')
  })
})
```

### 3. Manual Testing Checklist

- [ ] Deploy bDCU on Base Sepolia
- [ ] Deploy cDCU on Celo Sepolia
- [ ] Register both tokens with Clanker bridge
- [ ] Test bridging from Base to Celo
- [ ] Test bridging from Celo to Base
- [ ] Verify token balances on both chains
- [ ] Test with different amounts
- [ ] Test error handling (insufficient balance, wrong chain, etc.)

---

## Environment Variables

Add to `.env.local`:

```bash
# Base Sepolia
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key

# Celo Sepolia
NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL=https://sepolia-forno.celo-testnet.org
CELO_SEPOLIA_RPC_URL=https://sepolia-forno.celo-testnet.org
CELOSCAN_API_KEY=your_celoscan_api_key

# DCU Token Addresses
NEXT_PUBLIC_BASE_DCU_ADDRESS=0x...
NEXT_PUBLIC_CELO_DCU_ADDRESS=0x...

# Clanker Bridge Addresses
NEXT_PUBLIC_CLANKER_BRIDGE_BASE=0x...
NEXT_PUBLIC_CLANKER_BRIDGE_CELO=0x...

# Deployment
PRIVATE_KEY=your_private_key_for_deployment
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Review Clanker documentation for latest bridge contract addresses
- [ ] Get testnet tokens from faucets (Base Sepolia and Celo Sepolia)
- [ ] Set up wallet with sufficient gas on both chains
- [ ] Verify Hardhat configuration
- [ ] Test contract compilation

### Deployment Steps

1. **Deploy Tokens**
   ```bash
   # Base Sepolia
   npx hardhat run scripts/deploy-dcu-base.ts --network baseSepolia
   
   # Celo Sepolia
   npx hardhat run scripts/deploy-dcu-celo.ts --network celoSepolia
   ```

2. **Verify Contracts**
   ```bash
   npx hardhat verify --network baseSepolia <BASE_DCU_ADDRESS> "Base DeCleanup Token" "bDCU" <OWNER_ADDRESS> "b"
   npx hardhat verify --network celoSepolia <CELO_DCU_ADDRESS> "Celo DeCleanup Token" "cDCU" <OWNER_ADDRESS> "c"
   ```

3. **Register with Clanker**
   - Follow Clanker's registration process
   - Submit token addresses and chain IDs
   - Wait for approval/confirmation

4. **Update Environment Variables**
   - Add deployed contract addresses
   - Add Clanker bridge addresses
   - Update RPC URLs if needed

5. **Test Bridge Functionality**
   - Test small amount bridge (Base → Celo)
   - Test reverse bridge (Celo → Base)
   - Verify balances update correctly

### Post-Deployment

- [ ] Update frontend to show bridge UI
- [ ] Add bridge functionality to profile page
- [ ] Test user flows end-to-end
- [ ] Monitor bridge transactions
- [ ] Document any issues or limitations

---

## Next Steps

1. **Research Clanker Documentation**
   - Visit Clanker's official documentation
   - Understand their bridge contract interface
   - Get testnet bridge addresses
   - Review any integration requirements

2. **Set Up Development Environment**
   - Install/update Hardhat
   - Configure networks
   - Get testnet tokens

3. **Deploy Test Contracts**
   - Start with testnet deployments
   - Verify everything works
   - Test bridge functionality

4. **Integrate Frontend**
   - Add chain switching
   - Add bridge UI
   - Test user experience

5. **Mainnet Preparation**
   - Audit contracts
   - Plan mainnet deployment
   - Set up monitoring

---

## Resources

### Celo Resources
- **Celo Documentation**: https://docs.celo.org
- **Celo Sepolia Faucet**: https://faucet.celo.org/
- **CeloScan Sepolia**: https://sepolia.celoscan.io
- **Celo Developer Portal**: https://celo.org/developers
- **Celo Forum**: https://forum.celo.org

### Base Resources
- **Base Documentation**: https://docs.base.org
- **Base Sepolia Explorer**: https://sepolia.basescan.org
- **Base Sepolia Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Base Developer Resources**: https://base.org/developers

### Clanker Resources
- **Clanker Documentation**: [Research and add URL]
- **Clanker GitHub**: [Research and add URL]
- **Clanker Bridge Addresses**: [Research and add]

### Development Tools
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts
- **Hardhat**: https://hardhat.org
- **Wagmi**: https://wagmi.sh
- **Viem**: https://viem.sh

---

## Notes

- Always test on testnets before mainnet deployment
- Keep private keys secure and never commit them
- Monitor gas prices on both chains
- Consider implementing bridge fee estimation in UI
- Add transaction status tracking for bridge operations
- Consider adding bridge history/transaction log

---

## Support

For issues or questions:
1. Check Clanker documentation
2. Review Celo developer resources
3. Test on testnets first
4. Monitor contract events for debugging

