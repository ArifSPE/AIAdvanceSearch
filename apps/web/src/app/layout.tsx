import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { QueryProvider } from '@/providers/query-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Advance Search',
  description: 'Hybrid keyword and vector search over your documents',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <QueryProvider>
          <AuthProvider>
            <header className="border-b border-line">
              <SiteHeader />
            </header>
            <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
