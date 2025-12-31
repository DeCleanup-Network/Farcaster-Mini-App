# Base Apps Setup Guide

## Making Your App Visible in Base Apps

To make your app visible in Base Apps (not just Farcaster), you need to:

### 1. Register Your App in Base Build

1. Go to [Base Build](https://build.base.org)
2. Sign in with your wallet
3. Create a new app or edit your existing app
4. Use your Base App ID: `69450375d77c069a945be104`
5. Configure the app details:
   - **App URL**: `https://miniapp.decleanup.net`
   - **Name**: DeCleanup Rewards
   - **Description**: Tokenize your environmental impact
   - **Icon**: Your app icon URL
   - **Splash Image**: Your splash screen URL

### 2. Verify Manifest Configuration

Your app already has the Base App ID configured in `app/layout.tsx`:
```typescript
"base:app_id": "69450375d77c069a945be104"
```

And in the HTML head:
```html
<meta name="base:app_id" content="69450375d77c069a945be104" />
```

### 3. Ensure ready() is Called Properly

The app now calls both:
- **Base MiniKit**: `minikit.setFrameReady()` (for Base Apps)
- **Farcaster SDK**: `sdk.actions.ready()` (for Farcaster Mini Apps)

Both are called immediately in `FarcasterProvider` to prevent splash screen from getting stuck.

### 4. Publish Your App

In Base Build:
1. Complete all required fields
2. Submit for review (if required)
3. Publish your app

Once published, your app will be visible in:
- **Base Apps** (Base ecosystem)
- **Farcaster Mini Apps** (Farcaster ecosystem)

### 5. Testing in Base Preview

You can test your app in Base Preview:
1. Go to [Base Build Preview](https://build.base.org/preview)
2. Enter your app URL: `https://miniapp.decleanup.net`
3. Check that "Ready call" shows as "Ready" (green)
4. Verify the app loads correctly

### Differences from Base Template

The Base template likely:
1. Calls `minikit.setFrameReady()` first (Base Apps priority)
2. Then calls `sdk.actions.ready()` (Farcaster compatibility)
3. Checks for Base environment before Farcaster environment

Our implementation now matches this pattern.

### Troubleshooting

**App not visible in Base Apps:**
- Verify app is published in Base Build
- Check that Base App ID matches in manifest and HTML
- Ensure `minikit.setFrameReady()` is being called (check console logs)

**Splash screen stuck:**
- Verify both `minikit.setFrameReady()` and `sdk.actions.ready()` are being called
- Check console for errors
- Ensure ready() is called before any other async operations

**Ready call shows "Not Ready" in Base Preview:**
- Check that `minikit.setFrameReady()` is called immediately
- Verify Base App ID is correct
- Check for JavaScript errors in console

