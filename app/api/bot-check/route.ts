import { NextRequest, NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'

/**
 * Bot Check API Route
 * 
 * Allows client-side components to check if the current request
 * is from a bot. Useful for conditionally rendering UI elements.
 * 
 * This endpoint uses Vercel Bot ID to verify the request.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await checkBotId({
      developmentOptions: {
        isDevelopment: process.env.NODE_ENV !== 'production',
      },
    })
    
    // Get bot score from header if available (for debugging)
    const botScore = request.headers.get('x-vercel-bot-score')
    
    return NextResponse.json({
      isBot: result.isBot && !result.isHuman,
      isHuman: result.isHuman,
      isVerifiedBot: result.isVerifiedBot,
      botScore: botScore ? parseInt(botScore) : null,
      // Bot scores: 0 = definitely bot, 100 = definitely human
      // Typically, scores < 10 are considered bots
    })
  } catch (error) {
    console.error('[Bot Check] Error verifying request:', error)
    
    // In development, return a safe default
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        isBot: false,
        botScore: null,
        error: 'Bot verification unavailable in development',
      })
    }

    // In production, assume it's a bot if verification fails
    return NextResponse.json(
      {
        isBot: true,
        botScore: null,
        error: 'Bot verification failed',
      },
      { status: 500 }
    )
  }
}

