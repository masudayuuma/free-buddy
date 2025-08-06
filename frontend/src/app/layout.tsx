import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VoiceChat-Ollama',
  description: 'AI voice chat application with Ollama LLM',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}