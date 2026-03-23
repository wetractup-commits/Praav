// src/app/layout.tsx
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Praav — Where Free Minds Find Each Other',
  description:
    'A privacy-first dating app for India\'s non-religious, free-thinking adults. Any orientation welcome.',
  keywords: ['dating', 'India', 'secular', 'inclusive', 'LGBTQ', 'privacy'],
  openGraph: {
    title: 'Praav',
    description: 'Where free minds find each other.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1C1C2E',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              borderRadius: '14px',
              padding: '12px 18px',
            },
            success: { iconTheme: { primary: '#4CAF50', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#B5294E', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
