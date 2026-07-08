import { NextRequest, NextResponse } from 'next/server'
import { baseSubmissionId, isMlVerificationEnabled } from '@/lib/ml-verification'

/**
 * GET /api/ml-verification/result?cleanupId=<id>  (advisory — Base mini-app)
 *
 * Server-side proxy to read the stored ML result for a Base cleanup. Best-effort:
 * returns { hasResult: false } softly while processing or on any upstream problem.
 */
const ML_ORIGIN = (process.env.ML_VERIFICATION_ORIGIN || 'https://dapp.decleanup.net').replace(/\/+$/, '')
const ML_PROXY_SECRET = process.env.ML_PROXY_SHARED_SECRET || ''
const RESULT_TIMEOUT_MS = 20_000

export async function GET(req: NextRequest) {
  if (!isMlVerificationEnabled()) {
    return NextResponse.json({ hasResult: false, mlVerificationDisabled: true })
  }
  const cleanupId = req.nextUrl.searchParams.get('cleanupId')
  if (!cleanupId) {
    return NextResponse.json({ ok: false, error: 'Missing cleanupId' }, { status: 400 })
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), RESULT_TIMEOUT_MS)
    try {
      const url = `${ML_ORIGIN}/api/ml-verification/result?cleanupId=${encodeURIComponent(baseSubmissionId(cleanupId))}`
      const upstream = await fetch(url, {
        headers: { ...(ML_PROXY_SECRET ? { 'x-ml-proxy-secret': ML_PROXY_SECRET } : {}) },
        signal: controller.signal,
      })
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.ok ? 200 : 200, // soft: never propagate upstream 4xx/5xx to the client
        headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return NextResponse.json({ hasResult: false })
  }
}
