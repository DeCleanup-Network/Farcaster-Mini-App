import { NextResponse } from 'next/server'

/**
 * Health check endpoint for container monitoring
 * Used by Docker HEALTHCHECK and monitoring tools
 */
export async function GET() {
  try {
    // Basic health check - can be extended to check database, external services, etc.
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}

