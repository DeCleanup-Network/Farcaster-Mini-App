import { NextRequest, NextResponse } from 'next/server'
import { baseSubmissionId, isMlVerificationEnabled } from '@/lib/ml-verification'

/**
 * POST /api/ml-verification/verify  (advisory AI pre-screening — Base mini-app)
 *
 * Server-side proxy to the DeCleanup ML host (which runs the YOLO litter model).
 * Kept best-effort and fully guarded: this NEVER blocks or breaks the submit flow.
 * Enabled only when NEXT_PUBLIC_ML_VERIFICATION_ENABLED === 'true'.
 *
 * Body: { cleanupId, beforeImageCid, afterImageCid }
 * The ML host keys results by submissionId; we namespace Base submissions as `base-<cleanupId>`
 * so they never collide with the Celo dapp's numeric ids.
 */
const ML_ORIGIN = (process.env.ML_VERIFICATION_ORIGIN || 'https://dapp.decleanup.net').replace(/\/+$/, '')
const ML_PROXY_SECRET = process.env.ML_PROXY_SHARED_SECRET || ''
const VERIFY_TIMEOUT_MS = 150_000

export async function POST(req: NextRequest) {
  if (!isMlVerificationEnabled()) {
    return NextResponse.json({ mlVerificationDisabled: true })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const { cleanupId, beforeImageCid, afterImageCid } = body || {}
    if (!cleanupId || !beforeImageCid || !afterImageCid) {
      return NextResponse.json({ ok: false, error: 'Missing cleanupId, beforeImageCid or afterImageCid' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
    try {
      const upstream = await fetch(`${ML_ORIGIN}/api/ml-verification/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ML_PROXY_SECRET ? { 'x-ml-proxy-secret': ML_PROXY_SECRET } : {}),
        },
        body: JSON.stringify({
          submissionId: baseSubmissionId(String(cleanupId)),
          beforeImageCid: String(beforeImageCid).replace(/^ipfs:\/\//, ''),
          afterImageCid: String(afterImageCid).replace(/^ipfs:\/\//, ''),
        }),
        signal: controller.signal,
      })
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.ok ? 200 : 502,
        headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    // Advisory only — never surface as a hard error to the client.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'ML verify proxy failed' },
      { status: 502 },
    )
  }
}
