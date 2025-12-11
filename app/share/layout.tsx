// Force SSR for share page to prevent metadata caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

