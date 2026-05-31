import type { Metadata } from 'next'
import Link from 'next/link'
import { readFileSync } from 'fs'
import { join } from 'path'
import { renderMarkdown } from '@/lib/render-markdown'

export const metadata: Metadata = {
  title: 'Terms of Service | DeCleanup Rewards',
  description: 'Terms of Service for DeCleanup Rewards on Base and Farcaster.',
}

export default function TermsPage() {
  const markdown = readFileSync(join(process.cwd(), 'TERMS_OF_SERVICE.md'), 'utf8')
  const html = renderMarkdown(markdown)

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        href="/"
        className="mb-6 inline-flex text-sm text-brand-green hover:opacity-80"
      >
        ← Back to app
      </Link>
      <article
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
