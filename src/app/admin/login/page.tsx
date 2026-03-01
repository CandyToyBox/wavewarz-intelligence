'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    })
    if (res.ok) {
      router.push('/admin')
      router.refresh()
    } else {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-[#111827] p-8">
          <div className="mb-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">WaveWarZ</p>
            <h1 className="text-3xl font-rajdhani font-bold text-white tracking-wide">
              Admin <span className="text-[#95fe7c]">Portal</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-2">Internal access only</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Enter admin secret"
              className="w-full bg-[#0d1321] border border-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#95fe7c]/50 transition-colors"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-400 text-center">Invalid secret. Try again.</p>
            )}
            <button
              type="submit"
              disabled={loading || !secret}
              className="w-full bg-[#95fe7c] hover:bg-[#7de066] disabled:opacity-40 text-[#0d1321] font-bold text-sm rounded-lg py-3 transition-colors font-rajdhani tracking-wide"
            >
              {loading ? 'Verifying…' : 'Enter Portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
