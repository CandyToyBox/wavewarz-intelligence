'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addFileLink, createUpload, registerUpload, removeFileItem } from './actions'
import {
  formatBytes,
  inkOn,
  isUrl,
  normHex,
  normUrl,
  partCount,
  type FileItem,
  type Palette,
} from '@/lib/playbook/logic'
import { MAX_UPLOAD_BYTES, PALETTE_SLOTS, type Part, type PaletteKey } from '@/lib/playbook/spec'

const PLACEHOLDER = 'Rough notes are fine.'

// ─── Text ─────────────────────────────────────────────────────────────────────

export function TextPart({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <textarea
      id={`f__${id}`}
      rows={3}
      placeholder={PLACEHOLDER}
      aria-label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

// ─── Links ────────────────────────────────────────────────────────────────────

export function UrlsPart({ part, label, value, onChange }: {
  part: Part; label: string; value: string[]; onChange: (v: string[]) => void
}) {
  const max = part.max ?? 1
  const [shown, setShown] = useState(() => Math.min(Math.max(part.rows ?? 1, value.length, 1), max))
  const n = Math.min(Math.max(shown, value.length), max)
  const list = Array.from({ length: n }, (_, i) => value[i] ?? '')

  const set = (i: number, v: string) => {
    const next = list.slice()
    next[i] = v
    onChange(next)
  }
  const count = partCount(part, list)
  const min = part.min ?? 0

  return (
    <div className="urls">
      {list.map((u, i) => (
        <input
          key={i}
          type="url"
          inputMode="url"
          id={`f__${part.id}__${i}`}
          value={u}
          placeholder="https://"
          autoComplete="off"
          aria-label={`${label} link ${i + 1}`}
          aria-invalid={u.trim() !== '' && !isUrl(normUrl(u)) ? true : undefined}
          onChange={e => set(i, e.target.value)}
          onBlur={e => {
            // A bare domain gets https:// in front of it.
            const n = normUrl(e.target.value)
            if (n !== e.target.value) set(i, n)
          }}
        />
      ))}
      {list.length < max && (
        <button type="button" className="linkbtn" onClick={() => setShown(n + 1)}>+ Add another link</button>
      )}
      {min > 1 && (
        <p className={`note${count >= min ? ' ok' : ''}`}>
          {count} of {min}{max > min ? ` to ${max}` : ''} links added
        </p>
      )}
    </div>
  )
}

// ─── Choice ───────────────────────────────────────────────────────────────────

export function ChoicePart({ part, label, value, onChange }: {
  part: Part; label: string; value: string | string[] | null; onChange: (v: string | string[] | null) => void
}) {
  const opts = part.opts ?? []
  return (
    <div className="choices" role={part.multi ? 'group' : 'radiogroup'} aria-label={label}>
      {opts.map((o, i) => {
        const on = part.multi ? Array.isArray(value) && value.includes(o) : value === o
        return (
          <label key={o}>
            <input
              type={part.multi ? 'checkbox' : 'radio'}
              name={`ch__${part.id}`}
              id={`f__${part.id}__${i}`}
              value={o}
              checked={on}
              onChange={() => {
                if (part.multi) {
                  const cur = Array.isArray(value) ? value : []
                  onChange(on ? cur.filter(x => x !== o) : [...cur, o])
                } else onChange(o)
              }}
            />
            <span>{o}</span>
          </label>
        )
      })}
    </div>
  )
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

export function FilesPart({ part, label, items, fileUrls, onChange }: {
  part: Part
  label: string
  items: FileItem[]
  fileUrls: Record<string, string>
  /** New list from the server, plus fresh preview URLs. */
  onChange: (items: FileItem[], urls: Record<string, string>) => void
}) {
  const max = part.max ?? 1
  const [note, setNote] = useState<{ text: string; warn?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [linkText, setLinkText] = useState('')

  const room = max - items.length

  async function upload(list: File[]) {
    if (!list.length) return
    const errs: string[] = []
    let files = list
    if (files.length > room) {
      errs.push(`You can add ${max} here. Extra files were skipped.`)
      files = files.slice(0, Math.max(room, 0))
    }
    setBusy(true)
    const supabase = createClient()
    for (const f of files) {
      if (f.size > MAX_UPLOAD_BYTES) { errs.push(`${f.name} is over 20 MB. Paste a link to it instead.`); continue }
      setNote({ text: `Uploading ${f.name}...` })
      const slot = await createUpload({ fieldKey: part.id, fileName: f.name, size: f.size, type: f.type })
      if (!slot.ok || !slot.path || !slot.token) { errs.push(slot.error ?? `${f.name}: upload failed.`); continue }
      const put = await supabase.storage.from('playbook').uploadToSignedUrl(slot.path, slot.token, f, {
        contentType: slot.contentType || f.type || undefined,
      })
      if (put.error) { errs.push(`${f.name}: upload failed. Try again or paste a link.`); continue }
      const done = await registerUpload({ fieldKey: part.id, path: slot.path, fileName: f.name })
      if (!done.ok || !done.items) { errs.push(done.error ?? `${f.name}: upload failed.`); continue }
      onChange(done.items, done.urls ?? {})
    }
    setBusy(false)
    setNote(errs.length ? { text: errs.join(' '), warn: true } : null)
  }

  async function addLink() {
    const res = await addFileLink(part.id, linkText)
    if (!res.ok || !res.items) { setNote({ text: res.error ?? 'Could not add that link.', warn: true }); return }
    setLinkText('')
    setNote(null)
    onChange(res.items, res.urls ?? {})
  }

  async function remove(i: number) {
    const res = await removeFileItem(part.id, i)
    if (!res.ok || !res.items) { setNote({ text: res.error ?? 'Could not remove that.', warn: true }); return }
    onChange(res.items, res.urls ?? {})
  }

  const min = part.min ?? 0

  return (
    <div className="files">
      {items.length > 0 && (
        <ul className="flist">
          {items.map((it, i) => {
            const src = it.kind === 'file' ? fileUrls[it.id] : undefined
            const isImg = it.kind === 'file' && /^image\//.test(it.type) && src
            return (
              <li className="fitem" key={it.kind === 'file' ? it.id : `${it.url}-${i}`}>
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="th" src={src} alt="" />
                ) : (
                  <span className="th">{it.kind === 'link' ? 'link' : (it.name.split('.').pop() ?? 'file').slice(0, 4)}</span>
                )}
                <span className="nm">
                  {it.kind === 'link' ? it.url : <>{it.name}<small>{formatBytes(it.size)} uploaded</small></>}
                </span>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${it.kind === 'link' ? it.url : it.name}`}>Remove</button>
              </li>
            )
          })}
        </ul>
      )}
      {room > 0 && (
        <>
          <div
            className={`drop${over ? ' over' : ''}`}
            onDragOver={e => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); void upload(Array.from(e.dataTransfer.files)) }}
          >
            <input
              type="file"
              id={`f__${part.id}__file`}
              accept={part.accept}
              multiple={room > 1}
              disabled={busy}
              onChange={e => { const l = Array.from(e.target.files ?? []); e.target.value = ''; void upload(l) }}
            />
            <label className="btn small" htmlFor={`f__${part.id}__file`}>Choose {max === 1 ? 'a file' : 'files'}</label>
            <span className="dtext">
              or drop {max === 1 ? 'it' : 'them'} here. Up to 20 MB each.{min ? ` Add at least ${min}.` : ''}
            </span>
          </div>
          <div className="addlink">
            <input
              type="url"
              inputMode="url"
              value={linkText}
              placeholder="Or paste a link to the file"
              autoComplete="off"
              aria-label={`${label}: link to the file`}
              onChange={e => setLinkText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addLink() } }}
            />
            <button type="button" className="btn ghost small" onClick={() => void addLink()} disabled={!linkText.trim()}>Add link</button>
          </div>
        </>
      )}
      {note ? (
        <p className={`note${note.warn ? ' warn' : ''}`} role="status">{note.text}</p>
      ) : min > 0 ? (
        <p className={`note${items.length >= min ? ' ok' : ''}`} role="status">{items.length} of {min} to {max} added</p>
      ) : null}
    </div>
  )
}

// ─── Color palette ────────────────────────────────────────────────────────────

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }

export function PalettePart({ value, onChange, name, imageSources }: {
  value: Palette
  onChange: (v: Palette) => void
  name: string
  imageSources: { url: string; label: string }[]
}) {
  const [target, setTarget] = useState<PaletteKey>('sig')
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  // Eyedropper only exists in some browsers; hide the button elsewhere.
  const hasEye = useSyncExternalStore(() => () => {}, () => 'EyeDropper' in window, () => false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [canvasShown, setCanvasShown] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [imgNote, setImgNote] = useState('')

  const setColor = (k: PaletteKey, hex: string) => {
    const h = normHex(hex)
    if (!h) return
    setTexts(t => ({ ...t, [k]: h }))
    setNotes(n => ({ ...n, [k]: '' }))
    onChange({ ...value, [k]: h })
  }

  const clearColor = (k: PaletteKey) => {
    const next = { ...value }
    delete next[k]
    onChange(next)
  }

  async function eye(k: PaletteKey) {
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper
      const r = await new Ctor().open()
      setColor(k, r.sRGBHex)
    } catch { /* cancelled */ }
  }

  function drawImage(src: string, cross: boolean) {
    const img = new Image()
    if (cross) img.crossOrigin = 'anonymous'
    img.onload = () => {
      const cv = canvasRef.current
      if (!cv) return
      const w = Math.min(img.naturalWidth || img.width, 560)
      const h = Math.round(((img.naturalHeight || img.height) * w) / (img.naturalWidth || img.width))
      cv.width = w
      cv.height = h
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      ctxRef.current = ctx
      setCanvasShown(true)
      setImgNote('')
    }
    img.onerror = () => {
      ctxRef.current = null
      setCanvasShown(false)
      setImgNote('That image could not be loaded for color picking.')
    }
    img.src = src
  }

  function pixel(e: { clientX: number; clientY: number }): string | null {
    const cv = canvasRef.current
    const ctx = ctxRef.current
    if (!cv || !ctx) return null
    const r = cv.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) * cv.width) / r.width)
    const y = Math.floor(((e.clientY - r.top) * cv.height) / r.height)
    try {
      const d = ctx.getImageData(Math.max(0, Math.min(cv.width - 1, x)), Math.max(0, Math.min(cv.height - 1, y)), 1, 1).data
      if (d[3] === 0) return null
      return '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()
    } catch {
      return null
    }
  }

  const sig = normHex(value.sig)
  const second = normHex(value.second)
  const accent = normHex(value.accent)
  const shownName = name.trim() || 'Your Name'

  return (
    <div className="pal">
      {PALETTE_SLOTS.map(c => {
        const hex = normHex(value[c.k])
        const text = texts[c.k] ?? hex
        return (
          <div className="swrow" key={c.k}>
            <div className="swname">{c.n}<small>{c.d}</small></div>
            <div className="swatch" title="Open the color picker">
              <span className="fill" style={{ background: hex || 'transparent' }} />
              <input
                type="color"
                id={`f__pal_${c.k}_c`}
                value={(hex || '#808080').toLowerCase()}
                aria-label={`${c.n} color picker`}
                onChange={e => setColor(c.k, e.target.value)}
              />
            </div>
            <div className="swctl">
              <input
                type="text"
                className="hexin"
                id={`f__pal_${c.k}_h`}
                value={text}
                placeholder="#RRGGBB"
                maxLength={7}
                autoComplete="off"
                spellCheck={false}
                aria-label={`${c.n} hex code`}
                aria-invalid={text && !normHex(text) ? true : undefined}
                onChange={e => {
                  const v = e.target.value
                  setTexts(t => ({ ...t, [c.k]: v }))
                  if (normHex(v)) setColor(c.k, v)
                }}
                onBlur={() => {
                  const v = (texts[c.k] ?? '').trim()
                  if (!v) { clearColor(c.k); setNotes(n => ({ ...n, [c.k]: '' })); return }
                  if (!normHex(v)) setNotes(n => ({ ...n, [c.k]: 'Use 3 or 6 hex digits, like #FF6600.' }))
                }}
              />
              {hasEye && (
                <button type="button" className="btn ghost small" onClick={() => void eye(c.k)}>Eyedropper</button>
              )}
              {notes[c.k] && <span className="note warn">{notes[c.k]}</span>}
            </div>
          </div>
        )
      })}

      <div className="pv">
        <p className="cap">Your palette</p>
        <div className="pvbar" role="img" aria-label="Your three colors side by side">
          {PALETTE_SLOTS.map(c => {
            const hex = normHex(value[c.k])
            return (
              <div key={c.k} style={{ background: hex || 'transparent', color: hex ? inkOn(hex) : 'var(--muted)' }}>
                {hex || 'not chosen'}
              </div>
            )
          })}
        </div>
        <p className="cap">Preview on a Face-Off card</p>
        <div className="pvcard" style={{ background: sig || '#1b2438', borderColor: second || 'rgba(126,193,251,.16)' }}>
          <div className="pvname" style={{ color: sig ? inkOn(sig) : 'var(--muted)' }}>{shownName}</div>
          <div className="pvrule" style={{ background: second || 'rgba(126,193,251,.3)' }} />
          <div className="pvbtn" style={{ background: accent || 'rgba(126,193,251,.3)', color: accent ? inkOn(accent) : 'var(--muted)' }}>Battle</div>
        </div>
      </div>

      <div className="imgpick">
        <h5>Pick colors from an image</h5>
        <p className="note">Choose which color to fill, then click anywhere on the image. Use your uploaded logo or photo, or any image from your device.</p>
        <fieldset className="tgt">
          <legend className="sr">Color to fill</legend>
          {PALETTE_SLOTS.map(c => (
            <label key={c.k}>
              <input type="radio" name="palt" value={c.k} checked={target === c.k} onChange={() => setTarget(c.k)} /> {c.n}
            </label>
          ))}
        </fieldset>
        <div className="srcs">
          {imageSources.map(s => (
            <button key={s.url} type="button" className="btn ghost small" onClick={() => drawImage(s.url, true)}>Use {s.label}</button>
          ))}
          <input
            type="file"
            accept="image/*"
            aria-label="Choose an image from your device"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) drawImage(URL.createObjectURL(f), false)
            }}
          />
        </div>
        <canvas
          ref={canvasRef}
          hidden={!canvasShown}
          aria-label="Image to pick colors from. Click a spot to use its color."
          onMouseMove={e => setHover(pixel(e))}
          onMouseLeave={() => setHover(null)}
          onClick={e => {
            const hex = pixel(e)
            if (hex) setColor(target, hex)
          }}
        />
        {hover && canvasShown && (
          <div className="hover"><i style={{ background: hover }} /><span>{hover}</span></div>
        )}
        {imgNote && <p className="note warn">{imgNote}</p>}
      </div>
    </div>
  )
}
