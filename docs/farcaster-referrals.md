# Farcaster Referrals & Sharing

## How Referrals Work in Farcaster

### Current Implementation

The DeCleanup Mini App supports referrals through the cleanup submission process. When a user submits a cleanup, they can optionally provide a `referrerAddress` parameter.

### Referral Flow

1. **User A** completes a cleanup and submits it
2. **User A** can share their referral link (their wallet address) with **User B**
3. **User B** submits a cleanup and includes **User A's** address as the referrer
4. **User A** receives referral rewards when **User B's** cleanup is verified

### Sharing Links in Farcaster

Farcaster Mini Apps can be shared in several ways:

#### 1. **Direct App Link**
Users can share the Mini App URL directly:
```
https://decleanup.network
```

#### 2. **Farcaster Casts**
Users can create casts (posts) in Farcaster that include:
- The Mini App URL
- Their referral address
- Screenshots of their Impact Product NFT

Example cast:
```
🎉 Just minted my DeCleanup Impact Product NFT!

Clean up, snap, earn! Join me: https://decleanup.network

My referral: 0xYourAddress...
```

#### 3. **Frame Actions** (Future Enhancement)
Farcaster Frames support action buttons that can:
- Share the app
- Include referral codes
- Deep link to specific app states

### Current Referral Implementation

In the cleanup submission flow (`app/cleanup/page.tsx`), the referrer is currently set to `null`:

```typescript
await submitCleanup(
  beforeHash.hash,
  afterHash.hash,
  location.lat,
  location.lng,
  null, // No referrer for now
  hasForm,
  feeValue,
  impactFormDataHash
)
```

### Future Enhancements

1. **Referral Code System**
   - Generate short referral codes (e.g., `DCU-ABC123`)
   - Map codes to wallet addresses
   - Allow users to enter codes during submission

2. **Share Button in Profile**
   - Add "Share" button next to Impact Product NFT
   - Generate shareable link with referral address
   - Copy to clipboard or open Farcaster compose

3. **Farcaster Frame Integration**
   - Create a Frame that shows user's Impact Product
   - Include "Try DeCleanup" button that links to app
   - Automatically include referral address in deep link

4. **Social Sharing**
   - Share on X (Twitter) with referral link
   - Share on Farcaster with cast
   - Share on other social platforms

### Referral Rewards

Currently, referral rewards are distributed through the `RewardDistributor` contract:

- **Referrer** receives DCU points when the referred user's cleanup is verified
- Reward amount is configurable in the contract
- Rewards are distributed automatically during verification

### Testing Referrals

To test referrals locally:

1. Deploy contracts to Base Sepolia
2. Submit cleanup from Wallet A (no referrer)
3. Submit cleanup from Wallet B with Wallet A's address as referrer
4. Verify Wallet B's cleanup
5. Check Wallet A's DCU balance for referral reward

### Farcaster-Specific Considerations

- **Wallet Connection**: Farcaster Mini Apps use the `farcasterMiniApp()` connector
- **User Context**: Access user info via `useFarcaster()` hook
- **Sharing**: Users can share via Farcaster casts or direct links
- **Deep Linking**: Farcaster supports deep links to Mini Apps with parameters

### Resources

- [Farcaster Mini Apps Documentation](https://docs.farcaster.xyz/developers/mini-apps)
- [Farcaster Frames Documentation](https://docs.farcaster.xyz/developers/frames)
- [Base Mini App Template](https://docs.base.org/miniapp)

