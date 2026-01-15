import { NextResponse } from 'next/server'
import { getSecurityStats } from '@/lib/security-monitoring'

/**
 * Security statistics endpoint (admin only in production)
 * Returns current security monitoring stats
 */
export async function GET() {
  try {
    // In production, add authentication/authorization here
    // For now, this is informational only
    
    const stats = getSecurityStats()
    
    return NextResponse.json({
      status: 'ok',
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get security stats', message: error.message },
      { status: 500 }
    )
  }
}

