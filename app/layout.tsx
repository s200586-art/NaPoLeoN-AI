import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NaPoLeoN Command Center',
  description: 'Персональный ИИ-командный центр',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  )
}
