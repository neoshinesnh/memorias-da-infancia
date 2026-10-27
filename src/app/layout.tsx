import type { Metadata } from 'next'
import { Bagel_Fat_One, Nunito } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

const titleFont = Bagel_Fat_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-title',
  fallback: ['Trebuchet MS', 'system-ui', 'sans-serif'],
})

const bodyFont = Nunito({
  weight: ['400', '600', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  fallback: ['system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Memórias da Infância',
}

export const runtime = 'nodejs'

type RootLayoutProperties = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <html lang="pt-BR" className={`${titleFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}
