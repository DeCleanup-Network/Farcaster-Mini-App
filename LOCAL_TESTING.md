# Local Testing Guide - Test on Phone Without Deploying

> **Part of the DeCleanup Rewards documentation** | [README](README.md) | [System Architecture](SYSTEM_ARCHITECTURE.md) | [Dev Docs](DEV_DOCS.md)

This guide shows you how to test the app on your phone (in Farcaster) without committing to the branch.

## Option 1: Using ngrok (Recommended)

### Step 1: Install ngrok

**macOS:**
```bash
brew install ngrok
```

**Or download from:** https://ngrok.com/download

### Step 2: Start your local dev server

```bash
npm run dev
```

Your app will be running on `http://localhost:3000`

### Step 3: Start ngrok tunnel

In a **new terminal window**, run:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

### Step 4: Update Farcaster manifest (if needed)

If your Farcaster manifest requires HTTPS, you can use the ngrok URL. However, for testing, you can also:

1. Open the ngrok URL in your phone's browser first: `https://abc123.ngrok-free.app`
2. Then open it in Farcaster/Warpcast

### Step 5: Test in Farcaster

1. Open Warpcast on your phone
2. Navigate to your mini app
3. Or use the direct link: `https://abc123.ngrok-free.app`

**Note:** ngrok free tier gives you a random URL each time. For a fixed URL, you need a paid plan.

---

## Option 2: Using Cloudflare Tunnel (Free, Fixed URL)

### Step 1: Install cloudflared

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

### Step 2: Start your local dev server

```bash
npm run dev
```

### Step 3: Start Cloudflare tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

You'll get a URL like: `https://random-words-1234.trycloudflare.com`

### Step 4: Test in Farcaster

Use the Cloudflare tunnel URL in Farcaster.

---

## Option 3: Using localtunnel (Free, Open Source)

### Step 1: Start your local dev server

```bash
npm run dev:network
```

### Step 2: Start localtunnel (no installation needed)

```bash
npx --yes localtunnel --port 3000
```

You'll get output like:
```
your url is: https://random-name-1234.loca.lt
```

**Important:** Localtunnel shows a password when you first access the URL. The password is displayed in the terminal output. You'll need to enter it when opening the URL for the first time.

### Step 3: Test in Farcaster

1. Open the localtunnel URL in your phone's browser
2. Enter the password shown in the terminal
3. Then open it in Farcaster/Warpcast

---

## Quick Test Script

I've created a helper script. Run:

```bash
npm run dev:tunnel
```

This will start both the dev server and a tunnel automatically.

---

## Troubleshooting

### Issue: "Connection refused" or "Tunnel not found"

**Solution:** Make sure your dev server is running on port 3000 before starting the tunnel.

### Issue: Farcaster can't access the URL

**Solution:** 
1. First open the tunnel URL in your phone's browser to accept any security warnings
2. Then try opening it in Farcaster

### Issue: Wallet connection not working

**Solution:** Make sure your `.env.local` has the correct `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set.

### Issue: CORS errors

**Solution:** The tunnel should handle this, but if you see CORS errors, check that your `next.config.ts` allows the tunnel domain.

---

## Testing Checklist

- [ ] Dev server running on `localhost:3000`
- [ ] Tunnel active and accessible from phone browser
- [ ] Can open app in Farcaster/Warpcast
- [ ] Wallet connection works (Farcaster wallet in Farcaster, all wallets on web)
- [ ] Transactions work correctly
- [ ] Network switching works

---

## Important Notes

1. **Don't commit tunnel URLs** - These are temporary and will change
2. **Free tunnels have limitations** - May be slower or have connection limits
3. **HTTPS is required** - All tunnel services provide HTTPS automatically
4. **Local changes are live** - Any code changes will be reflected immediately (with Next.js hot reload)

---

## Alternative: Test Branch Without Auto-Deploy

If you prefer not to use tunnels, you can:

1. Create a test branch: `git checkout -b test/farcaster-detection`
2. Push to GitHub: `git push origin test/farcaster-detection`
3. Configure your deployment to **not auto-deploy** test branches
4. Manually deploy when ready, or just test locally with tunnel

