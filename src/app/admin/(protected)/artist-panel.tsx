'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertArtistProfile, linkWalletToArtist, unlinkWallet, deleteArtistProfile } from './actions'

export type ArtistProfile = {
  artist_id: string
  display_name: string
  primary_wallet: string | null
  audius_handle: string | null
  twitter_handle: string | null
  profile_picture_url: string | null
  bio: string | null
  social_links: { youtube?: string; instagram?: string; tiktok?: string } | null
  wallets: { wallet_address: string }[]
}

const EMPTY_FORM = {
  artistId: null as string | null,
  displayName: '',
  primaryWallet: '',
  audiusHandle: '',
  twitterHandle: '',
  pfpUrl: '',
  bio: '',
  youtubeUrl: '',
  instagramHandle: '',
  tiktokHandle: '',
}

export function ArtistPanel({ artists }: { artists: ArtistProfile[] }) {
  const [list, setList] = useState<ArtistProfile[]>(artists)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<string | null>(null)
  const [newWallet, setNewWallet] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ id: string | 'new'; text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditing(null)
    setShowForm(true)
    setMsg(null)
  }

  function openEdit(a: ArtistProfile) {
    setForm({
      artistId: a.artist_id,
      displayName: a.display_name,
      primaryWallet: a.primary_wallet ?? '',
      audiusHandle: a.audius_handle ?? '',
      twitterHandle: a.twitter_handle ?? '',
      pfpUrl: a.profile_picture_url ?? '',
      bio: a.bio ?? '',
      youtubeUrl: a.social_links?.youtube ?? '',
      instagramHandle: a.social_links?.instagram ?? '',
      tiktokHandle: a.social_links?.tiktok ?? '',
    })
    setEditing(a.artist_id)
    setShowForm(true)
    setMsg(null)
  }

  function handleSave() {
    if (!form.displayName || !form.primaryWallet) {
      setMsg({ id: 'new', text: 'Display name and primary wallet are required.', ok: false })
      return
    }
    startTransition(async () => {
      const result = await upsertArtistProfile({
        artistId: form.artistId,
        displayName: form.displayName,
        primaryWallet: form.primaryWallet,
        audiusHandle: form.audiusHandle || null,
        twitterHandle: form.twitterHandle || null,
        pfpUrl: form.pfpUrl || null,
        bio: form.bio || null,
        youtubeUrl: form.youtubeUrl || null,
        instagramHandle: form.instagramHandle || null,
        tiktokHandle: form.tiktokHandle || null,
      })
      if (result.ok) {
        setMsg({ id: result.artistId!, text: form.artistId ? 'Profile updated.' : `Profile created. UUID: ${result.artistId}`, ok: true })
        setShowForm(false)
        setEditing(null)
        // Refresh list optimistically
        router.refresh()
      } else {
        setMsg({ id: 'new', text: result.error ?? 'Save failed.', ok: false })
      }
    })
  }

  function handleLinkWallet(artistId: string) {
    const wallet = newWallet[artistId]?.trim()
    if (!wallet) return
    startTransition(async () => {
      const result = await linkWalletToArtist({ artistId, walletAddress: wallet })
      if (result.ok) {
        setNewWallet(prev => ({ ...prev, [artistId]: '' }))
        router.refresh()
      } else {
        setMsg({ id: artistId, text: result.error ?? 'Link failed.', ok: false })
      }
    })
  }

  function handleUnlink(wallet: string) {
    startTransition(async () => {
      await unlinkWallet(wallet)
      window.location.reload()
    })
  }

  function handleDelete(artistId: string, name: string) {
    if (!confirm(`Delete profile for "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteArtistProfile(artistId)
      window.location.reload()
    })
  }

  const filtered = list.filter(a =>
    a.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.primary_wallet ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search artist or wallet…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#95fe7c]/50 w-64"
        />
        <button
          onClick={openCreate}
          className="ml-auto bg-[#95fe7c] hover:bg-[#7de066] text-[#0d1321] font-bold text-xs px-4 py-2 rounded-lg transition-colors font-rajdhani tracking-wide"
        >
          + New Artist Profile
        </button>
      </div>

      {/* Global message */}
      {msg && (
        <div className={`rounded-lg px-4 py-2 mb-4 text-xs font-mono ${msg.ok ? 'bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {msg.text}
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-[#95fe7c]/30 bg-[#111827] p-6 mb-6">
          <h3 className="font-rajdhani font-bold text-white text-lg mb-4 tracking-wide">
            {editing ? 'Edit Artist Profile' : 'Create New Artist Profile'}
          </h3>
          {editing && (
            <div className="mb-4 p-3 bg-[#0d1321] rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Artist UUID</p>
              <p className="font-mono text-xs text-[#7ec1fb] select-all">{editing}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Display Name *" value={form.displayName} onChange={v => setForm(f => ({ ...f, displayName: v }))} placeholder="e.g. Harrdknock" />
            <Field label="Primary Wallet *" value={form.primaryWallet} onChange={v => setForm(f => ({ ...f, primaryWallet: v }))} placeholder="Solana wallet address" mono />
            <Field label="Audius Handle" value={form.audiusHandle} onChange={v => setForm(f => ({ ...f, audiusHandle: v }))} placeholder="e.g. harrdknock (no @)" />
            <Field label="Twitter / X Handle" value={form.twitterHandle} onChange={v => setForm(f => ({ ...f, twitterHandle: v }))} placeholder="e.g. harrdknock (no @)" />
            <Field label="YouTube Channel URL" value={form.youtubeUrl} onChange={v => setForm(f => ({ ...f, youtubeUrl: v }))} placeholder="https://youtube.com/@handle" />
            <Field label="Instagram Handle" value={form.instagramHandle} onChange={v => setForm(f => ({ ...f, instagramHandle: v }))} placeholder="e.g. harrdknock (no @)" />
            <Field label="TikTok Handle" value={form.tiktokHandle} onChange={v => setForm(f => ({ ...f, tiktokHandle: v }))} placeholder="e.g. harrdknock (no @)" />
            <Field label="Profile Picture URL" value={form.pfpUrl} onChange={v => setForm(f => ({ ...f, pfpUrl: v }))} placeholder="https://…" />
            <Field label="Bio" value={form.bio} onChange={v => setForm(f => ({ ...f, bio: v }))} placeholder="Short artist bio…" />
          </div>

          {/* PFP preview */}
          {form.pfpUrl && (
            <div className="mb-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.pfpUrl} alt="PFP preview" className="w-12 h-12 rounded-full object-cover border border-border" onError={e => (e.currentTarget.style.display = 'none')} />
              <span className="text-xs text-muted-foreground">PFP preview</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="bg-[#95fe7c] hover:bg-[#7de066] disabled:opacity-40 text-[#0d1321] font-bold text-xs px-5 py-2 rounded-lg transition-colors font-rajdhani tracking-wide"
            >
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Profile'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditing(null) }}
              className="text-xs text-muted-foreground hover:text-white border border-border px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Artist list */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-[#111827] p-8 text-center text-muted-foreground text-sm">
          {list.length === 0 ? 'No artist profiles yet. Create one above.' : 'No results for that search.'}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(a => (
          <div key={a.artist_id} className="rounded-xl border border-border bg-[#111827] overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4">
              {/* Avatar */}
              <div className="shrink-0">
                {a.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.profile_picture_url} alt={a.display_name} className="w-12 h-12 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1f2937] border border-border flex items-center justify-center">
                    <span className="font-rajdhani font-bold text-[#95fe7c] text-xl">{a.display_name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-rajdhani font-bold text-white text-lg">{a.display_name}</span>
                  {a.audius_handle && <span className="text-xs text-[#7ec1fb]">Audius: @{a.audius_handle}</span>}
                  {a.twitter_handle && <span className="text-xs text-muted-foreground">X: @{a.twitter_handle}</span>}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground truncate mb-1">
                  UUID: <span className="text-[#7ec1fb] select-all">{a.artist_id}</span>
                </p>
                <p className="font-mono text-[10px] text-muted-foreground truncate">
                  Primary: <span className="text-white">{a.primary_wallet ?? '—'}</span>
                </p>
                {a.bio && <p className="text-xs text-muted-foreground mt-1 italic">{a.bio}</p>}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex gap-2">
                <a
                  href={`/artist/${a.primary_wallet ?? a.artist_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#7ec1fb] hover:underline px-3 py-1.5 border border-border rounded-lg"
                >
                  View Card ↗
                </a>
                <button
                  onClick={() => openEdit(a)}
                  className="text-xs text-white hover:text-[#95fe7c] px-3 py-1.5 border border-border rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(a.artist_id, a.display_name)}
                  className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-500/20 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Linked Wallets */}
            <div className="px-5 py-3 border-t border-border bg-[#0d1321]/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Linked Wallets</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {a.wallets.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No linked wallets</span>
                )}
                {a.wallets.map(w => (
                  <div key={w.wallet_address} className="flex items-center gap-1 bg-[#111827] border border-border rounded px-2 py-1">
                    <span className="font-mono text-[10px] text-white">{w.wallet_address.slice(0, 8)}…{w.wallet_address.slice(-4)}</span>
                    <button
                      onClick={() => handleUnlink(w.wallet_address)}
                      className="text-red-400 hover:text-red-300 text-[10px] ml-1"
                      title="Unlink wallet"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {/* Add wallet input */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Paste wallet address to link…"
                  value={newWallet[a.artist_id] ?? ''}
                  onChange={e => setNewWallet(prev => ({ ...prev, [a.artist_id]: e.target.value }))}
                  className="bg-[#111827] border border-border rounded px-3 py-1.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#95fe7c]/50 flex-1 max-w-xs font-mono"
                />
                <button
                  onClick={() => handleLinkWallet(a.artist_id)}
                  disabled={isPending || !newWallet[a.artist_id]}
                  className="text-xs bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/30 hover:bg-[#95fe7c]/20 disabled:opacity-40 px-3 py-1.5 rounded transition-colors font-rajdhani font-bold"
                >
                  Link
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#95fe7c]/50 transition-colors ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  )
}
