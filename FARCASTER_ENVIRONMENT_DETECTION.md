# Farcaster Mini App Environment Detection

This document explains the proper implementation of Farcaster Mini App environment detection using the official `@farcaster/miniapp-sdk`.

## Core Principle

**You do not ask the user what environment they're in. You detect it once at app startup, and everything else derives from that.**

## Implementation

### 1. Environment Detection Function

The `detectFarcasterEnvironment()` function in `lib/farcaster-environment.ts` uses the official SDK method:

```typescript
import { detectFarcasterEnvironment } from '@/lib/farcaster-environment'

const env = await detectFarcasterEnvironment()
// env.isMiniApp === true if in Farcaster Mini App
// env.context contains user info, location, client, etc.
```

**Key points:**
- Uses `sdk.isInMiniApp()` - the ONLY correct detection method
- Automatically calls `sdk.actions.ready()` when in Mini App (mandatory to avoid infinite loading)
- Returns environment info including context

### 2. FarcasterProvider Context

The `FarcasterProvider` component detects the environment once at startup and stores it in React context:

```typescript
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'

function MyComponent() {
  const { isMiniApp, context, isLoading } = useFarcaster()
  
  // Branch UI logic based on isMiniApp
  if (isMiniApp) {
    // Mini App specific UI
  } else {
    // Browser UI
  }
}
```

**Available context properties:**
- `isMiniApp`: boolean - true if running in Farcaster Mini App
- `context`: FarcasterContext - user info, location, client details
- `isInitialized`: boolean - whether detection is complete
- `isLoading`: boolean - whether detection is in progress

### 3. Wallet Connector Logic

The Wagmi configuration conditionally adds the Farcaster connector:

```typescript
// In lib/wagmi.ts
const isFarcasterEnv = /* check if SDK available */
const farcasterConnector = isFarcasterEnv ? farcasterMiniApp() : null

const connectors = [
  ...defaultConnectors, // MetaMask, WalletConnect, etc.
  ...(farcasterConnector ? [farcasterConnector] : []), // Only in Mini App
]
```

**Behavior:**
- **Browser**: Shows MetaMask, WalletConnect, Coinbase Wallet, etc.
- **Mini App**: Uses Farcaster connector (auto-connect or one-click)

### 4. UI Branching

All UI components should branch based on `isMiniApp`:

```typescript
const { isMiniApp } = useFarcaster()

// Never show "Web vs Farcaster" modal if already in Mini App
if (!isMiniApp) {
  // Show optional redirect modal for browser users
  renderWebOrFarcasterChoice()
}

// Wallet connection UI
if (isMiniApp) {
  // Auto-connect or one-click connect
  // No wallet choice modal
} else {
  // Show wallet selection modal
  renderWalletChoice()
}
```

## Mental Model

```
isMiniApp === true
  → No modal asking about environment
  → Farcaster wallet connector
  → Farcaster auth (Quick Auth or Signers)
  → Mobile-first UX
  → Use safeAreaInsets for safe areas

isMiniApp === false
  → Optional Farcaster sign-in button
  → Normal web wallets (MetaMask, WalletConnect, etc.)
  → Optional redirect to Farcaster Mini App
```

## Migration from Old Detection

### Before (Heuristics - WRONG)
```typescript
const isFarcaster = window.location.search.includes('fc_wallet=1') ||
                   (window as any).farcaster?.sdk !== undefined
```

### After (Official SDK - CORRECT)
```typescript
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'

const { isMiniApp } = useFarcaster()
// or
const env = await detectFarcasterEnvironment()
const isMiniApp = env.isMiniApp
```

## Important Notes

1. **`sdk.actions.ready()` is mandatory** - Without it, Mini Apps get stuck in loading screen
2. **Detection happens once** - Store result in context/state, don't re-detect
3. **No user choice** - Environment is detected, not chosen
4. **Branch wallet connectors** - Different connectors for different environments
5. **Branch UI flows** - Different UX for Mini App vs Browser

## Files Changed

- ✅ `lib/farcaster-environment.ts` - New official detection function
- ✅ `lib/farcaster-detection.ts` - Updated to use SDK (kept for backward compatibility)
- ✅ `components/farcaster/FarcasterProvider.tsx` - Detects environment and stores in context
- ✅ `lib/wagmi.ts` - Conditionally adds Farcaster connector
- ✅ `app/page.tsx` - Uses `isMiniApp` from context
- ✅ `components/wallet/WalletConnect.tsx` - Uses `isMiniApp` from context

## Testing

1. **In Browser**: Should show wallet selection modal, no Farcaster connector auto-selected
2. **In Farcaster Mini App**: Should auto-connect or one-click connect, no wallet choice modal
3. **No infinite loading**: `ready()` is called automatically when in Mini App

