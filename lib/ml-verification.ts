/**
 * Advisory ML pre-screening helpers for the Base mini-app.
 * ML is advisory only: it never gates or blocks the on-chain submit/claim flow.
 * Gated by NEXT_PUBLIC_ML_VERIFICATION_ENABLED === 'true'.
 */

export function isMlVerificationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ML_VERIFICATION_ENABLED === 'true'
}

/** Namespace Base submissions on the shared ML host so they never collide with Celo numeric ids. */
export function baseSubmissionId(cleanupId: string | number | bigint): string {
  return `base-${String(cleanupId).replace(/[^a-zA-Z0-9_-]/g, '')}`
}

export type MlScore = {
  verdict?: string
  score?: number
  delta?: number
  reductionRatio?: number
}

export type MlPayload = {
  score?: MlScore
  beforeInference?: { objectCount: number; meanConfidence: number }
  afterInference?: { objectCount: number; meanConfidence: number }
  mlVerificationDisabled?: boolean
  hasResult?: boolean
}

/** Extract the compact verdict block, or null when there is no usable score yet. */
export function parseMlScore(payload: MlPayload | null): {
  verdict: string
  score: number
  delta: number
  beforeCount: number
  afterCount: number
} | null {
  const s = payload?.score
  if (!s || typeof s.score !== 'number' || typeof s.delta !== 'number') return null
  return {
    verdict: typeof s.verdict === 'string' && s.verdict ? s.verdict : 'pending',
    score: s.score,
    delta: s.delta,
    beforeCount: payload?.beforeInference?.objectCount ?? 0,
    afterCount: payload?.afterInference?.objectCount ?? 0,
  }
}
