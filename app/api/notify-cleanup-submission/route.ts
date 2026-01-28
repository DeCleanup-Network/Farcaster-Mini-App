import { NextRequest, NextResponse } from 'next/server'
import { getIPFSUrl } from '@/lib/ipfs'

const TELEGRAM_API = 'https://api.telegram.org'

/**
 * POST /api/notify-cleanup-submission
 *
 * Sends a Telegram message for a new cleanup submission.
 * Body: { cleanupId, submitterAddress, beforePhotoHash, afterPhotoHash, latitude, longitude, transactionHash? }
 *
 * Requires: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (server env, not NEXT_PUBLIC_*)
 */
export async function POST(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) {
      return NextResponse.json(
        { ok: false, error: 'Telegram not configured (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)' },
        { status: 503 }
      )
    }

    const body = await req.json()
    const {
      cleanupId,
      submitterAddress,
      beforePhotoHash,
      afterPhotoHash,
      latitude,
      longitude,
      transactionHash,
    } = body

    if (
      !cleanupId ||
      !submitterAddress ||
      !beforePhotoHash ||
      !afterPhotoHash ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number'
    ) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid: cleanupId, submitterAddress, beforePhotoHash, afterPhotoHash, latitude, longitude' },
        { status: 400 }
      )
    }

    const beforeUrl =
      getIPFSUrl(beforePhotoHash) ||
      `https://gateway.pinata.cloud/ipfs/${String(beforePhotoHash).replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0].trim()}`
    const afterUrl =
      getIPFSUrl(afterPhotoHash) ||
      `https://gateway.pinata.cloud/ipfs/${String(afterPhotoHash).replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0].trim()}`

    const explorer =
      process.env.NEXT_PUBLIC_CHAIN_ID === '84532'
        ? 'https://sepolia.basescan.org'
        : (process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://basescan.org')
    const txUrl = transactionHash ? `${explorer}/tx/${transactionHash}` : ''

    const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
    const ts = new Date().toISOString()

    const text = [
      `🧹 <b>New cleanup submission</b>`,
      `ID: <code>${String(cleanupId)}</code>`,
      `👤 <b>Wallet:</b> <code>${String(submitterAddress)}</code>`,
      `📍 <a href="${mapUrl}">Location</a> (${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)})`,
      `🕐 ${ts}`,
      `📷 <a href="${beforeUrl}">Before</a> | <a href="${afterUrl}">After</a>`,
      ...(txUrl ? [`📋 <a href="${txUrl}">Tx on Basescan</a>`] : []),
    ].join('\n')

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('[notify-cleanup-submission] Telegram error:', data)
      return NextResponse.json(
        { ok: false, error: data.description || 'Telegram API error' },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notify-cleanup-submission]', e)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
