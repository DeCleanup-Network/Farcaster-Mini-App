# Snapchain Setup Guide

## What is Snapchain?

Snapchain is a self-hosted Farcaster Hub node that provides direct access to Farcaster protocol data. It's the data storage layer for the Farcaster social protocol.

## Do You Need Snapchain?

**For most apps: NO** - You can use **Neynar API** instead, which is much easier to set up (just requires an API key).

**Use Snapchain if:**
- You need direct access to Farcaster protocol data
- You want to avoid API rate limits
- You have the infrastructure to run it
- You want full control over your data access

**Use Neynar if:**
- You want the easiest setup (recommended for most apps)
- You don't want to manage infrastructure
- You just need basic user data (profile, FID, etc.)

## Snapchain Requirements

Running your own Snapchain instance requires significant infrastructure:

- **16 GB of RAM**
- **4 CPU cores or vCPUs**
- **2 TB of free storage**
- **Public IP address** with ports 3381–3383 exposed
- **Docker** installed

## Setting Up Snapchain

If you decide to run Snapchain, follow these steps:

### 1. Install Snapchain

```bash
# In a new directory, run:
curl -sSL https://raw.githubusercontent.com/farcasterxyz/snapchain/refs/heads/main/scripts/snapchain-bootstrap.sh | bash
```

### 2. Monitor Synchronization

```bash
./snapchain.sh logs
```

The synchronization process can take up to **2 hours** to download historical snapshots.

### 3. Configure in Your App

Once your Snapchain instance is running, add to your `.env.local`:

```env
NEXT_PUBLIC_SNAPCHAIN_ENDPOINT=http://your-server-ip:3381
```

Or if running locally:

```env
NEXT_PUBLIC_SNAPCHAIN_ENDPOINT=http://localhost:3381
```

### 4. Test the Connection

```bash
curl http://localhost:3381/v1/userDataByFid?fid=1
```

## Current Implementation

In this app, we use **Neynar as the primary** data source (easiest setup). Snapchain is an **optional fallback** if:
1. Neynar API fails
2. You have Snapchain configured

The code automatically falls back to Snapchain if Neynar is unavailable.

## Resources

- [Snapchain Getting Started](https://snapchain.farcaster.xyz/getting-started)
- [Snapchain HTTP API Reference](https://snapchain.farcaster.xyz/reference/httpapi/userdata)
- [Neynar API Documentation](https://docs.neynar.com/)

