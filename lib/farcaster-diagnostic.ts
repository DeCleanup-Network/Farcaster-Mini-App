/**
 * Farcaster Mini App Diagnostic Script
 * 
 * Comprehensive diagnostic tool to check:
 * - Manifest accessibility and validity
 * - Embed meta tag presence and validity
 * - Asset loadability (icon, splash, images)
 * - SDK availability and ready() call
 * 
 * Run this early in your app lifecycle to diagnose initialization issues.
 */

export async function runFarcasterDiagnostic() {
  // Only run in browser environment (not during SSR)
  if (typeof window === 'undefined') {
    return {
      manifest: false,
      embedMeta: false,
      sdkAvailable: false,
      duration: 0,
    }
  }

  const start = Date.now()
  console.group('🧪 Farcaster Mini App Diagnostic')

  console.log('🚀 Diagnostic: starting checks…')
  console.log('⋅ current window.location:', window.location.href)
  console.log('⋅ document.readyState:', document.readyState)

  // 1. Check manifest accessibility
  async function checkManifest() {
    const url = `${window.location.origin}/.well-known/farcaster.json`
    console.log('🔗 Fetching manifest:', url)
    try {
      const resp = await fetch(url, { cache: 'no-cache' })
      console.log('⋅ Manifest HTTP status:', resp.status)
      
      // Check if response is actually JSON
      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json') && !contentType.includes('json')) {
        console.warn('⚠️ Manifest response is not JSON, content-type:', contentType)
        const txt = await resp.text()
        if (txt.trim().startsWith('<!DOCTYPE') || txt.trim().startsWith('<html')) {
          console.error('❌ Manifest endpoint returned HTML instead of JSON (likely 404 or error page)')
          return null
        }
      }
      
      const txt = await resp.text()
      
      // Check if text looks like HTML before trying to parse as JSON
      const trimmedTxt = txt.trim()
      if (trimmedTxt.startsWith('<!DOCTYPE') || trimmedTxt.startsWith('<html') || trimmedTxt.startsWith('<')) {
        console.error('❌ Manifest response is HTML, not JSON. Status:', resp.status)
        return null
      }
      
      try {
        const json = JSON.parse(txt)
        console.log('⋅ Manifest JSON parsed, keys:', Object.keys(json))
        
        // Check for required fields
        if (json.miniapp) {
          console.log('✅ Found miniapp configuration')
          console.log('⋅ miniapp keys:', Object.keys(json.miniapp))
        } else if (json.frame) {
          console.warn('⚠️ Found legacy frame configuration (miniapp missing)')
        } else {
          console.warn('⚠️ No miniapp or frame configuration found')
        }
        
        // Check accountAssociation
        if (json.accountAssociation) {
          console.log('✅ Found accountAssociation')
        } else {
          console.warn('⚠️ No accountAssociation found')
        }
        
        return json
      } catch (err) {
        console.error('❌ Manifest JSON parse error:', err)
        console.error('⋅ Response preview:', txt.substring(0, 200))
        return null
      }
    } catch (err) {
      console.error('❌ Manifest fetch error:', err)
      return null
    }
  }

  const manifest = await checkManifest()

  // 2. Check embed meta-tag presence (fc:miniapp or fc:frame)
  function checkEmbedMeta() {
    const metaMini = document.querySelector('meta[name="fc:miniapp"]')
    const metaFrame = document.querySelector('meta[name="fc:frame"]')
    const metaBaseAppId = document.querySelector('meta[name="base:app_id"]')
    
    if (metaMini) {
      console.log('✅ Found <meta name="fc:miniapp">')
      try {
        const content = metaMini.getAttribute('content') || '{}'
        const data = JSON.parse(content)
        console.log('⋅ Embed JSON:', data)
        
        // Validate required fields
        if (data.version) {
          console.log('✅ Embed has version:', data.version)
        }
        if (data.imageUrl) {
          console.log('✅ Embed has imageUrl:', data.imageUrl)
        }
        if (data.button) {
          console.log('✅ Embed has button configuration')
        }
      } catch (err) {
        console.error('❌ Error parsing fc:miniapp JSON:', err)
      }
    } else if (metaFrame) {
      console.warn('⚠️ Found legacy <meta name="fc:frame"> (fc:miniapp missing)')
      try {
        const content = metaFrame.getAttribute('content') || '{}'
        const data = JSON.parse(content)
        console.log('⋅ Embed JSON (frame):', data)
      } catch (err) {
        console.error('❌ Error parsing fc:frame JSON:', err)
      }
    } else {
      console.warn('⚠️ No embed meta tag found (fc:miniapp or fc:frame)')
    }
    
    if (metaBaseAppId) {
      console.log('✅ Found <meta name="base:app_id">:', metaBaseAppId.getAttribute('content'))
    } else {
      console.warn('⚠️ No base:app_id meta tag found')
    }
  }

  checkEmbedMeta()

  // 3. Check asset (icon, splash, etc.) loadability from manifest
  async function checkAsset(url: string, name: string) {
    if (!url) {
      console.warn(`⚠️ No URL provided for ${name}`)
      return false
    }
    console.log(`🔎 Checking asset (${name}):`, url)
    try {
      const resp = await fetch(url, { method: 'HEAD', cache: 'no-cache' })
      const contentType = resp.headers.get('content-type')
      const contentLength = resp.headers.get('content-length')
      
      console.log(`⋅ ${name} HEAD status:`, resp.status, 'content-type:', contentType)
      
      if (resp.status === 200) {
        console.log(`✅ ${name} is accessible`)
        if (contentType) {
          if (contentType.startsWith('image/')) {
            console.log(`✅ ${name} has correct content-type: ${contentType}`)
          } else {
            console.warn(`⚠️ ${name} has unexpected content-type: ${contentType}`)
          }
        }
        if (contentLength) {
          const sizeKB = Math.round(parseInt(contentLength) / 1024)
          console.log(`⋅ ${name} size: ${sizeKB} KB`)
          
          // Warn if icon is too large (Farcaster recommends < 32 KB)
          if (name === 'iconUrl' && parseInt(contentLength) > 32 * 1024) {
            console.warn(`⚠️ Icon is larger than 32 KB (${sizeKB} KB) - may not display in Farcaster`)
          }
        }
        return true
      } else {
        console.error(`❌ ${name} returned status ${resp.status}`)
        return false
      }
    } catch (err: any) {
      console.error(`❌ Error fetching ${name}:`, err.message)
      return false
    }
  }

  // Check assets from manifest
  if (manifest) {
    const frame = manifest.miniapp || manifest.frame || manifest
    
    const assetChecks = []
    if (frame.iconUrl) {
      assetChecks.push(checkAsset(frame.iconUrl, 'iconUrl'))
    }
    if (frame.splashImageUrl) {
      assetChecks.push(checkAsset(frame.splashImageUrl, 'splashImageUrl'))
    }
    if (frame.ogImageUrl) {
      assetChecks.push(checkAsset(frame.ogImageUrl, 'ogImageUrl'))
    }
    if (frame.heroImageUrl) {
      assetChecks.push(checkAsset(frame.heroImageUrl, 'heroImageUrl'))
    }
    if (frame.imageUrl) {
      assetChecks.push(checkAsset(frame.imageUrl, 'imageUrl'))
    }
    
    await Promise.all(assetChecks)
  } else {
    console.warn('⚠️ Skipping asset checks — manifest not available')
  }

  // 4. Check Farcaster SDK availability
  function waitForSdk(maxAttempts = 10, intervalMs = 200): Promise<any> {
    return new Promise((resolve, reject) => {
      let attempts = 0
      const timer = setInterval(() => {
        attempts++
        
        // Try multiple SDK detection methods
        const sdk = 
          (window as any).farcaster?.sdk ||
          (window as any).farcasterSdk ||
          (window as any).sdk ||
          null

        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
          clearInterval(timer)
          resolve(sdk)
        } else if (attempts >= maxAttempts) {
          clearInterval(timer)
          reject(new Error('SDK not found after retries'))
        } else {
          console.log(`⏳ Retry SDK check — attempt ${attempts}/${maxAttempts}`)
        }
      }, intervalMs)
    })
  }

  try {
    console.log('🔍 Checking for Farcaster SDK availability...')
    
    // Try to import SDK (if using modules)
    let importedSdk = null
    try {
      // Dynamic import for SDK
      const sdkModule = await import('@farcaster/miniapp-sdk')
      importedSdk = sdkModule.sdk || null
      if (importedSdk) {
        console.log('✅ SDK found via import')
      }
    } catch (err) {
      // Import failed - SDK may not be available in this environment
      console.log('ℹ️ SDK import not available (may be browser mode)')
    }

    // Wait for SDK from window (host-injected)
    let windowSdk = null
    try {
      windowSdk = await waitForSdk()
      if (windowSdk) {
        console.log('✅ SDK found via window object')
      }
    } catch (err) {
      console.log('ℹ️ SDK not found in window (may not be in Farcaster context)')
    }

    const sdk = importedSdk || windowSdk

    if (sdk) {
      console.log('✅ SDK instance found:', {
        hasActions: !!sdk.actions,
        hasReady: typeof sdk.actions?.ready === 'function',
      })
      
      // Note: We don't call ready() here - that's handled by FarcasterProvider
      // This diagnostic just confirms SDK is available
      console.log('ℹ️ SDK ready() call is handled by FarcasterProvider')
    } else {
      console.warn('⚠️ Farcaster SDK NOT found: Mini App environment missing?')
      console.log('ℹ️ This is expected if running in browser mode (not in Farcaster client)')
    }
  } catch (err: any) {
    console.error('❌ Error checking SDK:', err.message)
  }

  // 5. Check for console errors
  const errorCount = (window as any).__farcasterDiagnosticErrors || 0
  if (errorCount > 0) {
    console.warn(`⚠️ Detected ${errorCount} errors during diagnostic`)
  }

  const duration = Date.now() - start
  console.log('🧪 Diagnostic complete — total time:', duration + 'ms')
  console.groupEnd()

  return {
    manifest: !!manifest,
    embedMeta: !!document.querySelector('meta[name="fc:miniapp"]') || !!document.querySelector('meta[name="fc:frame"]'),
    sdkAvailable: !!(window as any).farcaster?.sdk || !!(window as any).farcasterSdk,
    duration,
  }
}

