'use client'

import { useState, useTransition, useRef } from 'react'
import { addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, uploadCalendarFlyer } from './actions'

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  event_type: string
  location_or_link: string | null
  flyer_url: string | null
  is_featured: boolean
  is_active: boolean
}

const EVENT_TYPES = ['BATTLE', 'SPACES', 'COMMUNITY', 'OTHER']
const TYPE_COLORS: Record<string, string> = {
  BATTLE: '#95fe7c',
  SPACES: '#7ec1fb',
  COMMUNITY: '#f59e0b',
  OTHER: '#989898',
}

function EventForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<CalendarEvent>
  onSubmit: (fd: FormData) => void
  onCancel: () => void
  loading: boolean
}) {
  const [flyerUrl, setFlyerUrl] = useState(initial?.flyer_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadCalendarFlyer(fd)
    setUploading(false)
    if (res.error) { setUploadError(res.error); return }
    setFlyerUrl(res.url!)
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)) }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Title *</label>
          <input
            name="title"
            defaultValue={initial?.title ?? ''}
            required
            className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#7ec1fb]"
            placeholder="e.g. Main Event — IKE vs Rival"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Event Type</label>
          <select
            name="event_type"
            defaultValue={initial?.event_type ?? 'BATTLE'}
            className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
          >
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Date *</label>
          <input
            type="date"
            name="event_date"
            defaultValue={initial?.event_date ?? ''}
            required
            className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Time (e.g. 8:00 PM EST)</label>
          <input
            name="event_time"
            defaultValue={initial?.event_time ?? ''}
            className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#7ec1fb]"
            placeholder="8:00 PM EST"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Link or Location</label>
          <input
            name="location_or_link"
            defaultValue={initial?.location_or_link ?? ''}
            className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#7ec1fb]"
            placeholder="https://x.com/wavewarz or IRL address"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Description</label>
          <textarea
            name="description"
            defaultValue={initial?.description ?? ''}
            rows={2}
            className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#7ec1fb] resize-none"
            placeholder="Optional event description"
          />
        </div>

        {/* Flyer upload */}
        <div className="sm:col-span-2">
          <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
            Battle Flyer <span className="text-muted-foreground/50 normal-case">(JPG/PNG · max 5MB · 1280×720 recommended)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          {/* Hidden field carries the URL into FormData on submit */}
          <input type="hidden" name="flyer_url" value={flyerUrl} />

          {flyerUrl ? (
            <div className="relative group w-full rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flyerUrl} alt="Flyer preview" className="w-full h-40 object-cover" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold text-white"
              >
                {uploading ? 'Uploading…' : 'Replace Image'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-24 rounded-lg border border-dashed border-border hover:border-[#7ec1fb] hover:bg-[#7ec1fb]/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-xs">Uploading…</span>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs">Click to upload flyer</span>
                </>
              )}
            </button>
          )}
          {uploadError && <p className="text-[10px] text-red-400 mt-1">{uploadError}</p>}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              name="is_featured"
              defaultChecked={initial?.is_featured ?? false}
              className="accent-[#95fe7c]"
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={initial?.is_active ?? true}
              className="accent-[#95fe7c]"
            />
            Active (visible on site)
          </label>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || uploading}
          className="px-4 py-2 bg-[#95fe7c] hover:bg-[#95fe7c]/90 text-[#0d1321] font-bold text-xs rounded-lg disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save Event'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-transparent border border-border text-muted-foreground hover:text-white text-xs rounded-lg"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function CalendarPanel({ events: initial }: { events: CalendarEvent[] }) {
  const [events, setEvents] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleAdd(fd: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await addCalendarEvent(fd)
      if (res.error) { setError(res.error); return }
      if (res.event) { setEvents(prev => [res.event!, ...prev]) }
      setShowAdd(false)
    })
  }

  async function handleEdit(id: string, fd: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateCalendarEvent(id, fd)
      if (res.error) { setError(res.error); return }
      if (res.event) {
        setEvents(prev => prev.map(e => e.id === id ? res.event! : e))
      }
      setEditId(null)
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return
    setError(null)
    startTransition(async () => {
      const res = await deleteCalendarEvent(id)
      if (res.error) { setError(res.error); return }
      setEvents(prev => prev.filter(e => e.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {events.length} event{events.length !== 1 ? 's' : ''} total
        </p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-[#95fe7c] hover:bg-[#95fe7c]/90 text-[#0d1321] font-bold text-xs rounded-lg"
          >
            + Add Event
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">{error}</p>}

      {showAdd && (
        <div className="rounded-xl border border-[#95fe7c]/30 bg-[#111827] p-5">
          <p className="text-sm font-rajdhani font-bold text-white mb-4">New Event</p>
          <EventForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} loading={isPending} />
        </div>
      )}

      <div className="space-y-2">
        {events.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground text-center py-8">No events yet. Add one above.</p>
        )}
        {events.map(evt => {
          const color = TYPE_COLORS[evt.event_type] ?? TYPE_COLORS.OTHER
          const dateObj = new Date(evt.event_date + 'T12:00:00')
          const dateFmt = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

          if (editId === evt.id) {
            return (
              <div key={evt.id} className="rounded-xl border border-[#7ec1fb]/30 bg-[#111827] p-5">
                <p className="text-sm font-rajdhani font-bold text-white mb-4">Edit Event</p>
                <EventForm
                  initial={evt}
                  onSubmit={fd => handleEdit(evt.id, fd)}
                  onCancel={() => setEditId(null)}
                  loading={isPending}
                />
              </div>
            )
          }

          return (
            <div
              key={evt.id}
              className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${evt.is_featured ? 'border-[#95fe7c]/20 bg-[#95fe7c]/5' : 'border-border bg-[#111827]'} ${!evt.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
                    style={{ color, borderColor: `${color}30`, backgroundColor: `${color}10` }}
                  >
                    {evt.event_type}
                  </span>
                  {evt.is_featured && <span className="text-[9px] font-bold uppercase tracking-widest text-[#95fe7c]">Featured</span>}
                  {!evt.is_active && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Hidden</span>}
                </div>
                <p className="font-rajdhani font-bold text-white text-sm">{evt.title}</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {dateFmt}{evt.event_time ? ` · ${evt.event_time}` : ''}
                </p>
                {evt.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{evt.description}</p>}
                {evt.location_or_link && (
                  <p className="text-[10px] text-[#7ec1fb] mt-1 truncate">{evt.location_or_link}</p>
                )}
              </div>
              {evt.flyer_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={evt.flyer_url}
                  alt="Battle flyer"
                  className="w-32 h-[72px] object-cover rounded-lg border border-border shrink-0"
                />
              )}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditId(evt.id)}
                  className="text-[10px] px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-white hover:border-[#7ec1fb] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(evt.id)}
                  disabled={isPending}
                  className="text-[10px] px-2.5 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
