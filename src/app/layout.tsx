import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import ThreeBackground from '@/components/ThreeBackground'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Armor of God',
  description: 'Your daily scripture companion',
}

// The root layout wraps every page: it sets the Geist font and dark theme on
// <body> and mounts the ambient Three.js background once, behind everything.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-stone-950 text-white`}>
        <ThreeBackground />
        {children}
      </body>
    </html>
  )
}