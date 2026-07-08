'use client'

import { useEffect, useState } from 'react'
import { isMlVerificationEnabled, parseMlScore, type MlPayload } from '@/lib/ml-verification'

/**
 * Advisory AI pre-screening score for a Base cleanup, shown to the verifier.
 * Best-effort and feature-flagged (NEXT_PUBLIC_ML_VERIFICATION_ENABLED): renders
 * nothing when disabled or when there is no result yet. Never blocks the decision.
 */
export function BaseMlScore({ cleanupId }: { cleanupId: string }) {
  const [score, setScore] = useState<ReturnType<typeof parseMlScore>>(null)

  useEffect(() => {
    if (!isMlVerificationEnabled()) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/ml-verification/result?cleanupId=${encodeURIComponent(cleanupId)}`,
        )
        if (!res.ok) return
        const parsed = parseMlScore((await res.json()) as MlPayload)
        if (!cancelled && parsed) setScore(parsed)
      } catch {
        /* advisory only */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cleanupId])

  if (!isMlVerificationEnabled() || !score) return null

  const pct = Math.max(0, Math.round(score.score * 100))
  const color =
    score.verdict === 'approved'
      ? 'bg-emerald-500/30 text-emerald-100'
      : score.verdict === 'rejected'
        ? 'bg-amber-500/30 text-amber-100'
        : 'bg-yellow-500/25 text-yellow-100'

  return (
    <div className="mb-3 rounded-lg border border-cyan-500/40 bg-cyan-950/20 p-3 text-left">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-cyan-200">AI pre-screening</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${color}`}>{score.verdict}</span>
      </div>
      <div className="text-xs text-gray-400">
        Litter removed: {pct}% · before {score.beforeCount} / after {score.afterCount}
      </div>
      <div className="mt-1 text-[11px] text-gray-500">Advisory only. Your on-chain decision is final.</div>
    </div>
  )
}
