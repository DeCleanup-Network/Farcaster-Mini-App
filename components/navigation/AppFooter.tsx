import Link from 'next/link'

export function AppFooter() {
  return (
    <footer
      className="border-t border-border px-4 py-4 sm:px-6"
      style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0.75rem))' }}
    >
      <div className="container mx-auto flex flex-col items-center gap-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <a
            href="https://decleanup.net"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            decleanup.net
          </a>
          <a
            href="https://farcaster.xyz/decleanup"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            @decleanup
          </a>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <span>Powered by</span>
          <div className="flex h-6 items-center justify-center rounded bg-muted px-2 font-bold text-foreground">
            Base
          </div>
        </div>
      </div>
    </footer>
  )
}
