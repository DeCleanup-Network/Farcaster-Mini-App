#!/bin/bash

# Helper script to start dev server with tunnel
# Usage: ./scripts/start-tunnel.sh [tunnel-type]
# tunnel-type: ngrok (default), cloudflare, or localtunnel

TUNNEL_TYPE=${1:-ngrok}
PORT=3000

echo "🚀 Starting DeCleanup dev server on port $PORT..."

# Start dev server in background
npm run dev:network &
DEV_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 5

# Check if server is running
if ! curl -s http://localhost:$PORT > /dev/null; then
  echo "❌ Server failed to start. Check for errors above."
  kill $DEV_PID 2>/dev/null
  exit 1
fi

echo "✅ Server is running on http://localhost:$PORT"
echo ""

# Start tunnel based on type
case $TUNNEL_TYPE in
  ngrok)
    if ! command -v ngrok &> /dev/null; then
      echo "❌ ngrok not found. Install it with: brew install ngrok"
      echo "   Or download from: https://ngrok.com/download"
      kill $DEV_PID 2>/dev/null
      exit 1
    fi
    echo "🌐 Starting ngrok tunnel..."
    echo "   Your app will be available at the URL shown below"
    echo "   Press Ctrl+C to stop both server and tunnel"
    echo ""
    ngrok http $PORT
    ;;
  cloudflare)
    if ! command -v cloudflared &> /dev/null; then
      echo "❌ cloudflared not found. Install it with: brew install cloudflare/cloudflare/cloudflared"
      kill $DEV_PID 2>/dev/null
      exit 1
    fi
    echo "🌐 Starting Cloudflare tunnel..."
    echo "   Your app will be available at the URL shown below"
    echo "   Press Ctrl+C to stop both server and tunnel"
    echo ""
    cloudflared tunnel --url http://localhost:$PORT
    ;;
  localtunnel)
    if ! command -v lt &> /dev/null; then
      echo "❌ localtunnel not found. Install it with: npm install -g localtunnel"
      kill $DEV_PID 2>/dev/null
      exit 1
    fi
    echo "🌐 Starting localtunnel..."
    echo "   Your app will be available at the URL shown below"
    echo "   Press Ctrl+C to stop both server and tunnel"
    echo ""
    lt --port $PORT
    ;;
  *)
    echo "❌ Unknown tunnel type: $TUNNEL_TYPE"
    echo "   Supported types: ngrok, cloudflare, localtunnel"
    kill $DEV_PID 2>/dev/null
    exit 1
    ;;
esac

# Cleanup on exit
trap "kill $DEV_PID 2>/dev/null; exit" INT TERM

