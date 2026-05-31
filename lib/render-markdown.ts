/**
 * Minimal markdown renderer for Terms of Service page.
 * Supports headings, lists, bold, links, horizontal rules, and paragraphs.
 */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  const html: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  const inline = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_, label: string, href: string) => {
          const isExternal = /^https?:\/\//i.test(href)
          const attrs = isExternal
            ? ' target="_blank" rel="noopener noreferrer"'
            : ''
          const className = 'text-brand-green underline underline-offset-2 hover:opacity-80'
          return `<a href="${href}"${attrs} class="${className}">${label}</a>`
        }
      )

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      closeList()
      continue
    }

    if (trimmed === '---') {
      closeList()
      html.push('<hr class="my-8 border-border" />')
      continue
    }

    if (trimmed.startsWith('# ')) {
      closeList()
      html.push(`<h1 class="text-3xl font-bold text-foreground mb-6">${inline(trimmed.slice(2))}</h1>`)
      continue
    }

    if (trimmed.startsWith('## ')) {
      closeList()
      html.push(`<h2 class="text-xl font-semibold text-foreground mt-8 mb-3">${inline(trimmed.slice(3))}</h2>`)
      continue
    }

    if (trimmed.startsWith('### ')) {
      closeList()
      html.push(`<h3 class="text-lg font-semibold text-foreground mt-6 mb-2">${inline(trimmed.slice(4))}</h3>`)
      continue
    }

    if (trimmed.startsWith('- ')) {
      if (!inList) {
        html.push('<ul class="list-disc pl-6 space-y-2 text-muted-foreground">')
        inList = true
      }
      html.push(`<li>${inline(trimmed.slice(2))}</li>`)
      continue
    }

    closeList()
    html.push(`<p class="text-muted-foreground leading-relaxed mb-4">${inline(trimmed)}</p>`)
  }

  closeList()
  return html.join('\n')
}
