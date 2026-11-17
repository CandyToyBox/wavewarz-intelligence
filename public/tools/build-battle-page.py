#!/usr/bin/env python3
"""Builds battle.html from index.html so the battle page uses the exact nav, footer, dialog shell, Live Battle Deck styles
and leaderboard panels from the homepage. Run it again after changing any of those in index.html:

    python3 tools/build-battle-page.py
"""
import os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
s = open('index.html', encoding='utf-8').read()

def between(start, end, include_end=True):
    i = s.index(start); j = s.index(end, i)
    return s[i:j + (len(end) if include_end else 0)]
def script(sid):
    return between('<script id="%s">' % sid, '</script>')
def local(html):
    return re.sub(r'href="#([a-z0-9-]+)"', lambda m: 'href="index.html#%s"' % m.group(1), html)

head = s[:s.index('<body')]
head = re.sub(r'<title>.*?</title>', '<title>Battle | WaveWarZ</title>', head, count=1, flags=re.S)
head = re.sub(r'(<meta name="description" content=")[^"]*(")', r'\1Two songs go head to head on WaveWarZ. Listen, vote in the poll, and trade the side you believe in.\2', head, count=1)
head = re.sub(r'\s*<meta property="og:[^>]*>', '', head)
head = re.sub(r'\s*<meta name="twitter:[^>]*>', '', head)
head = re.sub(r'\s*<link rel="canonical"[^>]*>', '', head)
head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
head = re.sub(r'\s*<script type="module" src="[^"]*model-viewer[^"]*"></script>', '', head)

PAGE_CSS = '''
<style id="battle-page-css">
/* Battle page only. The deck (.ld), panels (.hl-panel), rows and the dialog shell (.wf) come from the homepage styles above. */
.bp-top { position: relative; z-index: 5; padding: 0 20px; --chrome: linear-gradient(145deg, #f6fbff 0%, #aebccb 17%, #5a6b7e 40%, #dbe6ef 57%, #6d7e91 76%, #2c3746 100%); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.bp-top .ld { display: block; }
.bp-top .ld-act { width: 100%; cursor: pointer; }
.bp-top button.ld-act { -webkit-appearance: none; appearance: none; }
.bp-back { display: flex; max-width: 1000px; margin: 0 auto 14px; align-items: center; gap: 16px; font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; }
.bp-back a { color: var(--text-muted); text-decoration: none; padding: 8px 0; } .bp-back a:hover { color: var(--brand-green); }
.bp-end { max-width: 1000px; margin: 16px auto 0; display: none; align-items: center; justify-content: space-between; gap: 14px 24px; flex-wrap: wrap; padding: 16px 22px; border-radius: 22px; border: 1px solid rgba(216,235,252,.16); background: linear-gradient(180deg, rgba(14,21,34,.92), rgba(7,10,16,.95)); }
.bp-end.on { display: flex; }
.bp-end p { margin: 0; flex: 1 1 280px; color: var(--brand-ice); font-size: .98rem; line-height: 1.5; } .bp-end p b { color: #fff; }
.bp-end .btn-primary { cursor: pointer; border: 0; } .bp-end .btn-primary:disabled { opacity: .5; cursor: default; } .bp-end a { color: var(--brand-green); }
.bp { padding-top: 28px; }
.bp .hl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.bp .hl-grid + .hl-grid { margin-top: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bp .hl-ph { justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
.bp .hl-ph { align-items: center; gap: 10px 14px; }
.bp-tag { font: 500 .68rem 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); border: 1px solid rgba(216,235,252,.18); border-radius: 999px; padding: 5px 10px; white-space: nowrap; }
/* chart */
.bc { position: relative; margin-top: 4px; }
.bc-leg { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 22px; margin: 2px 2px 8px; font: 500 .85rem 'Outfit', sans-serif; color: var(--brand-ice); }
.bc-leg span { display: inline-flex; align-items: center; gap: 8px; min-width: 0; } .bc-leg i { width: 18px; height: 3px; border-radius: 2px; flex: none; }
.bc-leg b { font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 24ch; }
.bc-leg em { font: 500 .78rem 'JetBrains Mono', monospace; font-style: normal; color: var(--text-muted); }
.bc-plot { position: relative; height: 360px; touch-action: pan-y; outline: none; border-radius: 12px; }
.bc-plot:focus { outline: none; } .bc-plot:focus-visible { outline: none; box-shadow: inset 0 0 0 1px rgba(149,254,124,.45); }
.bc-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
.bc-plot .gl { stroke: rgba(216,235,252,.08); stroke-width: 1; } .bc-plot .ax { fill: #8d9bb0; font: 400 11px 'JetBrains Mono', monospace; }
.bc-plot .la { fill: none; stroke: #95fe7c; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; } .bc-plot .lb { fill: none; stroke: #7ec1fb; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.bc-plot .ea { fill: #95fe7c; stroke: #0a0f18; stroke-width: 2; } .bc-plot .eb { fill: #7ec1fb; stroke: #0a0f18; stroke-width: 2; }
.bc-plot .el { fill: #fff; font: 600 12px 'JetBrains Mono', monospace; }
.bc-plot .ch { stroke: rgba(216,235,252,.4); stroke-width: 1; display: none; }
.bc-tip { position: absolute; z-index: 3; top: 8px; min-width: 150px; pointer-events: none; display: none; padding: 9px 11px; border-radius: 8px; background: rgba(7,14,12,.86); border: 1px solid rgba(188,241,207,.42); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); font: 400 .78rem/1.5 'JetBrains Mono', monospace; color: #d7f5e4; }
.bc-tip .tt { color: var(--text-muted); letter-spacing: .08em; text-transform: uppercase; font-size: .68rem; }
.bc-tip .tr { display: flex; align-items: center; gap: 8px; } .bc-tip .tr i { width: 12px; height: 2px; flex: none; } .bc-tip .tr b { color: #fff; font-weight: 600; } .bc-tip .tr span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 18ch; }
.bc-note { margin: 10px 2px 2px; font: 400 .72rem/1.6 'JetBrains Mono', monospace; letter-spacing: .03em; color: var(--text-muted); }
.bc-tbl { margin: 6px 2px 4px; } .bc-tbl summary { cursor: pointer; padding: 8px 0; font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); } .bc-tbl summary:hover { color: var(--brand-green); }
.bp table { width: 100%; border-collapse: collapse; font: 400 .88rem 'Outfit', sans-serif; color: var(--brand-ice); }
.bp th, .bp td { padding: 10px 6px; border-top: 1px solid rgba(216,235,252,.08); text-align: right; font-variant-numeric: tabular-nums; }
.bp th:first-child, .bp td:first-child { text-align: left; color: var(--text-muted); font-weight: 400; }
.bp thead th { border-top: 0; font: 600 .88rem 'Space Grotesk', sans-serif; color: #fff; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bp thead th i, .bf-who i, .br-w i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 7px; vertical-align: 1px; }
.ka { background: #95fe7c; } .kb { background: #7ec1fb; }
/* how it is decided */
.bf { list-style: none; margin: 0; padding: 0; }
.bf li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 14px; align-items: center; padding: 16px 4px; border-top: 1px solid rgba(216,235,252,.08); }
.bf li:first-child { border-top: 0; }
.bf h4 { margin: 0; font: 700 1rem 'Space Grotesk', sans-serif; color: #fff; } .bf p { margin: 3px 0 0; font: 400 .85rem/1.45 'Outfit', sans-serif; color: var(--text-muted); }
.bf-who { font: 600 .8rem 'JetBrains Mono', monospace; color: #fff; text-align: right; max-width: 20ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .bf-who.open { color: var(--text-muted); font-weight: 400; }
.bf-who small { display: block; margin-top: 2px; font: 400 .66rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); }
.bf-vote { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; }
.bp-btn { min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer; font: 700 .72rem 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--brand-ice); background: rgba(255,255,255,.04); border: 1px solid rgba(216,235,252,.28); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; }
.bp-btn:hover { border-color: var(--brand-green); color: var(--brand-green); } .bp-btn:disabled { opacity: .5; cursor: default; }
.bf-rule { margin: 12px 4px 6px; padding-top: 12px; border-top: 1px solid rgba(216,235,252,.08); font: 400 .85rem/1.5 'Outfit', sans-serif; color: var(--brand-ice); } .bf-rule b { color: var(--brand-green); font-weight: 600; }
/* rounds */
.br { list-style: none; margin: 0; padding: 0; }
.br li a { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 13px 4px; border-top: 1px solid rgba(216,235,252,.08); color: inherit; text-decoration: none; }
.br li:first-child a { border-top: 0; } .br li a:hover .br-w { color: var(--brand-green); }
.br-n { font: 700 .72rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); } .br li.cur .br-n { color: var(--brand-green); }
.br-w { font: 600 .95rem 'Space Grotesk', sans-serif; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .br-w.open { color: var(--text-muted); font-weight: 400; }
.br-m { font: 400 .72rem 'JetBrains Mono', monospace; color: var(--text-muted); white-space: nowrap; }
.br-score { margin: 0 4px 6px; font: 700 1.5rem 'Outfit', sans-serif; color: #fff; } .br-score small { font: 400 .78rem 'JetBrains Mono', monospace; color: var(--text-muted); margin-left: 8px; letter-spacing: .06em; }
/* trade module, inside the shared dialog */
.bt-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 5px; border-radius: 999px; background: rgba(255,255,255,.04); border: 1px solid rgba(216,235,252,.14); margin: 16px 0 14px; }
.bt-tabs button { min-height: 44px; border: 0; border-radius: 999px; cursor: pointer; background: transparent; color: var(--brand-ice); font: 700 .78rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; }
.bt-tabs button[aria-selected="true"] { background: var(--brand-green); color: #0d1321; }
.bt-amt { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.bt-amt button { min-height: 52px; border-radius: 14px; cursor: pointer; background: rgba(255,255,255,.03); border: 1px solid rgba(216,235,252,.2); color: #fff; font: 700 .95rem 'JetBrains Mono', monospace; }
.bt-amt button[aria-pressed="true"] { border-color: var(--brand-green); box-shadow: inset 0 0 0 1px var(--brand-green); color: var(--brand-green); }
.bt-bal { margin: 0 2px 8px; font: 400 .8rem 'JetBrains Mono', monospace; color: var(--text-muted); }
.bp-top [hidden], .bp [hidden] { display: none !important; }
/* vote first: the poll is the main action on each side, trade sits under it */
.bp-top .ld-act.vote small { margin-left: 10px; padding: 3px 9px; border-radius: 999px; background: rgba(13,19,33,.2); font: 700 .66rem 'JetBrains Mono', monospace; letter-spacing: .12em; vertical-align: 1px; }
.bp-top .ld-act.voted { background: transparent; cursor: default; box-shadow: none; } .bp-top .ld-col.l .ld-act.voted { color: var(--brand-green); border-color: var(--brand-green); } .bp-top .ld-col.r .ld-act.voted { color: var(--brand-blue); border-color: var(--brand-blue); }
.bp-top .ld-act.vote:disabled:not(.voted) { opacity: .4; cursor: default; }
.bp-top .ld-act.trade { height: 44px; line-height: 42px; font-size: .78rem; background: transparent; }
.bp-top .ld-pc em { font: 500 .62rem 'JetBrains Mono', monospace; font-style: normal; letter-spacing: .18em; color: var(--text-muted); align-self: center; }
.bp-top button.ld-play { border: 0; cursor: pointer; padding: 0; }
.bp-top .ld-col:not(.is-playing) .ld-eq i { animation-play-state: paused; opacity: .45; }
.bp-top .ld-col:not(.is-playing) .ld-np { color: var(--text-muted); }
.bp-msg { max-width: 1000px; margin: 10px auto 0; min-height: 1.2em; text-align: center; font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .06em; color: var(--text-muted); } .bp-msg.ok { color: var(--brand-green); }
/* live stream above the chart on Featured and Community battles */
.bs-panel { margin-bottom: 20px; } .bs { position: relative; aspect-ratio: 16 / 9; border-radius: 16px; overflow: hidden; background: #04070d; border: 1px solid rgba(216,235,252,.12); } .bs iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
/* DJ Wavy's call */
.bj { margin: 4px 4px 8px; padding: 16px; border-radius: 16px; border: 1px solid rgba(188,241,207,.3); background: rgba(7,14,12,.4); }
.bj-h { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font: 600 .66rem 'JetBrains Mono', monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--brand-green); } .bj-h span + span { color: var(--brand-ice); }
.bj strong { display: block; margin-top: 8px; font: 700 1.25rem/1.2 'Space Grotesk', sans-serif; color: #fff; overflow-wrap: anywhere; } .bj strong i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 9px; vertical-align: 2px; }
.bj p { margin: 8px 0 0; font: 400 .92rem/1.55 'Outfit', sans-serif; color: var(--brand-ice); } .bj.locked { border-style: dashed; border-color: rgba(216,235,252,.2); background: transparent; } .bj.locked p { margin: 6px 0 0; color: var(--text-muted); }
/* your battle: what you put in and what came back */
.bm-big { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 2px 0 12px; } .bm-big div { padding: 14px; border-radius: 14px; border: 1px solid rgba(216,235,252,.12); background: rgba(255,255,255,.02); min-width: 0; }
.bm-big span { display: block; font: 500 .64rem 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); } .bm-big b { display: block; margin-top: 6px; font: 700 1.15rem 'Outfit', sans-serif; color: #fff; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; } .bm-big b.up { color: var(--brand-green); }
.bm-act { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0 6px; align-items: center; }
/* ============ COCKPIT: timer, both songs, chart, vote and one-tap trading on one screen ============ */
.ck { position: relative; z-index: 5; padding: 104px 20px 0; --chrome: linear-gradient(145deg, #f6fbff 0%, #aebccb 17%, #5a6b7e 40%, #dbe6ef 57%, #6d7e91 76%, #2c3746 100%); --hair: rgba(216,235,252,.14); }
.ck-in { max-width: 1480px; margin: 0 auto; }
body[data-page="battle"] .mn { display: none; }   /* the Mainnet tag would sit on the timer bar */
.ck [hidden], .ck-dock[hidden] { display: none !important; }
/* timer bar: always on screen */
.ck-bar { position: sticky; top: 92px; z-index: 40; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 10px 22px 12px; border-radius: 22px; border: 1px solid var(--hair); background: rgba(6,9,15,.82); -webkit-backdrop-filter: blur(18px) saturate(1.3); backdrop-filter: blur(18px) saturate(1.3); box-shadow: 0 18px 40px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08); overflow: hidden; }
.cb-l, .cb-r { display: flex; align-items: center; gap: 12px; min-width: 0; font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--text-muted); white-space: nowrap; }
.cb-r { justify-content: flex-end; } .cb-r b { color: #fff; font-weight: 500; letter-spacing: .04em; }
.cb-l .ld-live { color: var(--brand-green); } .cb-k { overflow: hidden; text-overflow: ellipsis; }
.cb-c { display: flex; align-items: center; gap: 22px; min-width: 0; }
.cb-n { font: 500 1rem 'Outfit', sans-serif; letter-spacing: -.005em; color: #fff; max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .cb-n.a { text-align: right; }
.cb-n i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 8px; vertical-align: 2px; }
.cb-t { text-align: center; line-height: 1; } .cb-t span { display: block; font: 300 2.5rem/1 'Outfit', sans-serif; letter-spacing: -.02em; color: #fff; font-variant-numeric: tabular-nums; min-width: 3.2ch; }
.cb-t small { display: block; margin-top: 4px; font: 500 .56rem 'JetBrains Mono', monospace; letter-spacing: .22em; text-transform: uppercase; color: var(--text-muted); }
.cb-t.hot span { color: var(--brand-green); }
.cb-prog { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: rgba(216,235,252,.08); } .cb-prog i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #7ec1fb, #95fe7c); transition: width .5s linear; }
/* three columns that fit the screen */
.ck-grid { display: grid; grid-template-columns: minmax(270px, 320px) minmax(0, 1fr) minmax(270px, 320px); gap: 16px; margin-top: 14px; height: calc(100svh - 206px); min-height: 640px; max-height: 820px; }
.ck-side, .ck-stage { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; border-radius: 26px; border: 1px solid var(--hair); background: linear-gradient(180deg, rgba(14,21,34,.9), rgba(6,9,15,.94)); box-shadow: 0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.07); }
.ck-side { padding: 14px; gap: 10px; }
.ck-side.a { --c: #95fe7c; --cr: 149,254,124; } .ck-side.b { --c: #7ec1fb; --cr: 126,193,251; }
.ck-side::before { content: ""; position: absolute; left: 26px; right: 26px; top: -1px; height: 2px; border-radius: 2px; background: var(--c); opacity: .85; box-shadow: 0 0 18px rgba(var(--cr), .7); }
.cs-artbox { flex: 1 1 150px; min-height: 120px; container-type: size; display: grid; place-items: center; }
/* The cover sits in a square CD jewel case, still in its cellophane: dark hinge spine, clear case edge, the art under the lid,
   and a shrink-wrap layer with a fold seam, a tear strip, crinkled corners and a light streak that moves on hover. */
.jc { position: relative; width: min(100cqw, 100cqh); aspect-ratio: 1; border-radius: 4px; transform: translateZ(0); filter: drop-shadow(0 18px 22px rgba(0,0,0,.55)) drop-shadow(0 3px 4px rgba(0,0,0,.5)); transition: transform .45s cubic-bezier(.16,1,.3,1); }
.jc-case { position: absolute; inset: 0; border-radius: 4px; overflow: hidden; background: linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04) 40%, rgba(255,255,255,.12)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.38), inset 0 0 0 3px rgba(10,14,22,.55), inset 0 0 0 4px rgba(255,255,255,.14); }
.jc-spine { position: absolute; left: 0; top: 0; bottom: 0; width: 8.5%; background: linear-gradient(90deg, #05070b, #1a222e 45%, #0a0e15); box-shadow: inset -1px 0 0 rgba(255,255,255,.22), 1px 0 0 rgba(0,0,0,.6); }
.jc-spine::before, .jc-spine::after { content: ""; position: absolute; left: 22%; right: 22%; height: 9%; border-radius: 2px; background: linear-gradient(90deg, rgba(255,255,255,.08), rgba(255,255,255,.3), rgba(255,255,255,.08)); }
.jc-spine::before { top: 6%; } .jc-spine::after { bottom: 6%; }
.jc-art { position: absolute; left: 11%; top: 3.5%; right: 3.5%; bottom: 3.5%; overflow: hidden; border-radius: 1px; background: radial-gradient(120% 90% at 20% 10%, rgba(var(--cr), .32), rgba(13,19,33,.96) 62%); display: grid; place-items: center; box-shadow: 0 0 0 1px rgba(0,0,0,.6); }
.jc-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.jc-art .mono { font: 300 clamp(2rem, 30cqw, 5rem) 'Outfit', sans-serif; color: rgba(255,255,255,.24); letter-spacing: -.04em; }
.jc-wrap { position: absolute; inset: -1px; border-radius: 5px; pointer-events: none; overflow: hidden;
  background:
    linear-gradient(118deg, transparent 0 22%, rgba(255,255,255,.26) 29%, rgba(255,255,255,.05) 34%, transparent 40%),
    linear-gradient(118deg, transparent 0 56%, rgba(255,255,255,.13) 60%, transparent 64%),
    linear-gradient(180deg, rgba(255,255,255,.16), transparent 9%, transparent 91%, rgba(0,0,0,.18)),
    linear-gradient(90deg, rgba(255,255,255,.1), transparent 6%, transparent 94%, rgba(255,255,255,.08));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.3), inset 0 1px 0 rgba(255,255,255,.6); }
/* fold seam and tear strip */
.jc-wrap::before { content: ""; position: absolute; left: 0; right: 0; top: 7%; height: 4px; background: linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,.08) 45%, rgba(0,0,0,.18)); box-shadow: 0 1px 0 rgba(255,255,255,.1); }
.jc-wrap::after { content: ""; position: absolute; right: 7%; top: calc(7% - 3px); width: 9%; height: 10px; border-radius: 0 0 2px 2px; background: linear-gradient(180deg, rgba(255,255,255,.5), rgba(255,255,255,.18)); box-shadow: 0 1px 2px rgba(0,0,0,.35); }
/* crinkled corners where the film is pulled tight */
.jc-crease { position: absolute; inset: 0; pointer-events: none; background:
    linear-gradient(135deg, rgba(255,255,255,.34) 0 2%, transparent 7%),
    linear-gradient(225deg, rgba(255,255,255,.22) 0 1.5%, transparent 6%),
    linear-gradient(45deg, rgba(255,255,255,.2) 0 1.5%, transparent 5%),
    linear-gradient(315deg, rgba(255,255,255,.3) 0 2%, transparent 8%),
    linear-gradient(160deg, transparent 0 84%, rgba(255,255,255,.12) 86%, transparent 88%); }
.jc-sheen { position: absolute; inset: -40%; pointer-events: none; background: linear-gradient(105deg, transparent 42%, rgba(255,255,255,.22) 49%, rgba(255,255,255,.04) 53%, transparent 58%); transform: translateX(-38%); transition: transform 1.1s cubic-bezier(.16,1,.3,1); }
.ck-side:hover .jc { transform: translateY(-2px) rotate(-.4deg); }
.ck-side:hover .jc-sheen, .is-playing .jc-sheen { transform: translateX(38%); }
.is-playing .jc { filter: drop-shadow(0 18px 24px rgba(0,0,0,.55)) drop-shadow(0 0 22px rgba(var(--cr), .35)); }
.cs-tag { position: absolute; left: 14%; top: 13%; z-index: 2; padding: 5px 10px; border-radius: 999px; background: rgba(2,4,8,.72); font: 500 .66rem 'JetBrains Mono', monospace; letter-spacing: .16em; text-transform: uppercase; color: #fff; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.cs-play { position: absolute; right: 6%; bottom: 6%; z-index: 2; width: 46px; height: 46px; border-radius: 50%; border: 0; cursor: pointer; padding: 0; display: grid; place-items: center; background: var(--chrome); box-shadow: inset 0 2px 3px rgba(255,255,255,.85), inset 0 -3px 6px rgba(0,0,0,.45), 0 8px 18px rgba(0,0,0,.6); transition: transform .16s cubic-bezier(.2,.8,.2,1); }
.cs-play:hover { transform: scale(1.06); } .cs-play:active { transform: scale(.94); } .cs-play svg { width: 22px; height: 22px; fill: #0d1321; }
.cs-eq { position: absolute; left: 15%; bottom: 8%; z-index: 2; display: flex; gap: 3px; align-items: flex-end; height: 22px; opacity: 0; transition: opacity .3s; } .is-playing .cs-eq { opacity: 1; }
.cs-eq i { width: 3px; border-radius: 2px; background: var(--c); animation: csEq 1s ease-in-out infinite; } .cs-eq i:nth-child(2) { animation-delay: .15s; } .cs-eq i:nth-child(3) { animation-delay: .3s; } .cs-eq i:nth-child(4) { animation-delay: .45s; }
@keyframes csEq { 0%, 100% { height: 5px; } 50% { height: 22px; } }
.cs-np { font: 500 .58rem 'JetBrains Mono', monospace; letter-spacing: .2em; text-transform: uppercase; color: var(--text-muted); } .is-playing .cs-np, .cs-np.win { color: var(--c); }
.cs-nm { margin: 2px 0 0; font: 500 1.4rem/1.15 'Outfit', sans-serif; letter-spacing: -.015em; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.cs-by { margin: 2px 0 0; font: 400 .82rem 'Outfit', sans-serif; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-pool { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding-top: 8px; border-top: 1px solid var(--hair); }
.cs-pool b { font: 400 1.25rem 'Outfit', sans-serif; color: #fff; font-variant-numeric: tabular-nums; letter-spacing: -.01em; } .cs-pool b small { font: 500 .62rem 'JetBrains Mono', monospace; letter-spacing: .12em; color: var(--text-muted); margin-left: 5px; }
.cs-pool span { font: 500 .78rem 'JetBrains Mono', monospace; color: var(--c); }
/* the buttons: big, close together, same on both sides */
.ck button.cx { min-height: 46px; border-radius: 14px; cursor: pointer; font: 600 .84rem 'Outfit', sans-serif; letter-spacing: .02em; transition: transform .12s cubic-bezier(.2,.8,.2,1), background .16s, border-color .16s, box-shadow .16s, opacity .16s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.ck button.cx:active:not(:disabled) { transform: scale(.96); } .ck button.cx:disabled { opacity: .38; cursor: default; }
.ck button.cx:focus-visible, .cs-play:focus-visible, .ck-tabs button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.cs-vote { width: 100%; border: 0; background: var(--c); color: #0a0f18; box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 8px 22px rgba(var(--cr), .22); }
.cs-vote:hover:not(:disabled) { box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 0 26px rgba(var(--cr), .5); }
.cs-vote small { margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: rgba(10,15,24,.16); font: 600 .6rem 'JetBrains Mono', monospace; letter-spacing: .14em; text-transform: uppercase; vertical-align: 1px; }
.cs-vote.voted { background: transparent; color: var(--c); border: 1px solid var(--c); box-shadow: none; opacity: 1 !important; }
a.cs-vote { display: flex; align-items: center; justify-content: center; min-height: 46px; border-radius: 14px; text-decoration: none; font: 600 .84rem 'Outfit', sans-serif; }
.cs-row { display: grid; grid-template-columns: 38px repeat(3, minmax(0, 1fr)); gap: 6px; align-items: center; } .cs-row + .cs-row { margin-top: 6px; }
.cs-row > span { font: 500 .58rem 'JetBrains Mono', monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--text-muted); }
.cs-buy { border: 1px solid rgba(var(--cr), .55); background: rgba(var(--cr), .1); color: #fff; font-variant-numeric: tabular-nums; }
.cs-buy:hover:not(:disabled) { background: rgba(var(--cr), .24); border-color: var(--c); }
.cs-sell { border: 1px solid rgba(216,235,252,.22); background: rgba(255,255,255,.03); color: var(--brand-ice); font-variant-numeric: tabular-nums; }
.cs-sell:hover:not(:disabled) { border-color: rgba(216,235,252,.6); background: rgba(255,255,255,.08); color: #fff; }
.cs-cu { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 6px; margin-top: 6px; }
.cs-in { display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 46px; padding: 0 12px; border-radius: 14px; border: 1px solid rgba(216,235,252,.2); background: rgba(2,4,8,.5); transition: border-color .16s, box-shadow .16s; }
.cs-in:focus-within { border-color: var(--c); box-shadow: 0 0 0 3px rgba(var(--cr), .16); }
.cs-in input { flex: 1; min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: #fff; font: 500 .95rem 'Outfit', sans-serif; font-variant-numeric: tabular-nums; }
.cs-in input::placeholder { color: rgba(216,235,252,.4); }
.cs-in span { font: 500 .62rem 'JetBrains Mono', monospace; letter-spacing: .14em; color: var(--text-muted); }
.ck button.cx.cs-go { padding: 0 14px; min-width: 58px; }
.cs-go.buy { border: 0; background: var(--c); color: #0a0f18; } .cs-go.buy:hover:not(:disabled) { box-shadow: 0 0 20px rgba(var(--cr), .45); }
.cs-go.sell { border: 1px solid rgba(216,235,252,.32); background: rgba(255,255,255,.04); color: #fff; } .cs-go.sell:hover:not(:disabled) { border-color: #fff; }
.cs-st { min-height: 1.3em; margin: 0; font: 500 .68rem/1.3 'JetBrains Mono', monospace; letter-spacing: .03em; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .cs-st.ok { color: var(--c); }
.cs-end { display: grid; gap: 8px; }
/* stage: chart or game, with the stream in a chrome TV when there is one */
.ck-stage { padding: 12px 14px 12px; gap: 10px; }
.ck-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
.ck-tabs { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.04); border: 1px solid var(--hair); max-width: 100%; overflow-x: auto; scrollbar-width: none; } .ck-tabs::-webkit-scrollbar { display: none; }
.ck-tabs button { min-height: 34px; padding: 0 14px; border: 0; border-radius: 999px; cursor: pointer; background: transparent; color: var(--brand-ice); white-space: nowrap; font: 500 .74rem 'Outfit', sans-serif; letter-spacing: .03em; transition: background .18s, color .18s; }
.ck-tabs button:hover { color: #fff; } .ck-tabs button[aria-pressed="true"] { background: #fff; color: #0a0f18; }
.ck-views { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; } .ck-views.has-tv { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
.ck-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.ck-main .bc { flex: 1; min-height: 0; display: flex; flex-direction: column; margin: 0; } .ck-main .bc-plot { flex: 1; min-height: 150px; height: auto; }
.ck-main .bg { flex: 1; min-height: 0; aspect-ratio: auto; margin: 0; }
.tv { min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.tv-case { position: relative; padding: 9px 9px 9px; border-radius: 26px; background: var(--chrome); box-shadow: 0 22px 50px rgba(0,0,0,.6), inset 0 2px 2px rgba(255,255,255,.9), inset 0 -4px 8px rgba(0,0,0,.5); }
.tv-case::after { content: ""; position: absolute; left: 50%; bottom: -9px; width: 34%; height: 9px; transform: translateX(-50%); border-radius: 0 0 14px 14px; background: linear-gradient(180deg, #5a6b7e, #1b2430); }
.tv-scr { position: relative; aspect-ratio: 16 / 9; border-radius: 18px; overflow: hidden; background: #020305; box-shadow: inset 0 0 0 1px rgba(0,0,0,.9), inset 0 0 40px rgba(0,0,0,.8); }
.tv-scr iframe, .tv-scr img { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; object-fit: cover; }
.tv-scr::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(125deg, rgba(255,255,255,.1) 0%, transparent 28%); }
.tv-ft { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font: 500 .7rem 'JetBrains Mono', monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--text-muted); } .tv-ft a { color: var(--brand-green); text-decoration: none; } .tv-ft i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ff5a4d; margin-right: 8px; box-shadow: 0 0 10px #ff5a4d; }
.ck-meters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; } .ck-meters:has(> :only-child) { grid-template-columns: 1fr; }
.ck .ld-split { gap: 5px; } .ck .ld-bar { height: 8px; border: 0; background: var(--brand-blue); } .ck .ld-pc { font: 500 .74rem 'JetBrains Mono', monospace; } .ck .ld-pc em { font: 500 .56rem 'JetBrains Mono', monospace; font-style: normal; letter-spacing: .2em; color: var(--text-muted); }
.ck-risk { margin: 10px 0 0; text-align: center; font: 400 .68rem 'JetBrains Mono', monospace; letter-spacing: .04em; color: var(--text-muted); }
.ck .bp-msg { margin-top: 8px; }
/* phone: it should feel like an app. Timer on top, trade dock under the thumb. */
.ck-dock { display: none; }
@media (max-width: 1000px) {
  .ck { padding: 86px 12px 0; }
  .ck-bar { top: 90px; grid-template-columns: 1fr; gap: 4px; padding: 8px 14px 10px; border-radius: 18px; } .cb-l, .cb-r { display: none; }
  .cb-c { justify-content: space-between; gap: 10px; } .cb-n { flex: 1 1 0; font-size: .86rem; max-width: none; } .cb-t span { font-size: 2rem; }
  .ck-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); height: auto; min-height: 0; max-height: none; gap: 10px; margin-top: 10px; }
  .ck-stage { grid-column: 1 / -1; order: 3; border-radius: 20px; } .ck-side { border-radius: 20px; padding: 10px; gap: 6px; }
  .ck-side { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 6px 10px; align-items: center; }
  .cs-artbox { flex: none; width: 60px; height: 60px; min-height: 0; } .jc-wrap::after, .cs-tag, .cs-eq { display: none; }
  .cs-play { right: 50%; bottom: 50%; width: 34px; height: 34px; transform: translate(50%, 50%); } .cs-play:hover, .cs-play:active { transform: translate(50%, 50%) scale(.96); } .cs-play svg { width: 16px; height: 16px; }
  .cs-nm { font-size: .98rem; -webkit-line-clamp: 1; } .cs-np { font-size: .52rem; } .cs-by { font-size: .74rem; } .cs-pool { grid-column: 1 / -1; padding-top: 6px; } .cs-pool b { font-size: .95rem; }
  .ck-side .cs-vote, .ck-side .cs-tr, .ck-side .cs-st, .ck-side .cs-cu { display: none; }
  .dk-col .cs-cu { margin-top: 0; grid-template-columns: minmax(0, 1fr) auto; } .dk-col .cs-in { min-height: 44px; padding: 0 10px; } .dk-col .cs-in span { display: none; } .ck-dock button.cx.cs-go { min-width: 52px; padding: 0 10px; min-height: 44px; }
  .ck-views.has-tv { grid-template-columns: 1fr; } .ck-main .bc-plot { min-height: 210px; } .ck-main .bg { aspect-ratio: 1280 / 800; flex: none; }
  .ck-meters { gap: 12px; }
  body[data-page="battle"].has-dock { padding-bottom: calc(250px + env(safe-area-inset-bottom, 0px)); }
  .ck-dock { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)); background: rgba(6,9,15,.9); -webkit-backdrop-filter: blur(22px) saturate(1.4); backdrop-filter: blur(22px) saturate(1.4); border-top: 1px solid rgba(216,235,252,.16); border-radius: 22px 22px 0 0; box-shadow: 0 -18px 40px rgba(0,0,0,.55); --chrome: linear-gradient(145deg, #f6fbff 0%, #aebccb 17%, #5a6b7e 40%, #dbe6ef 57%, #6d7e91 76%, #2c3746 100%); }
  .ck-dock[hidden] { display: none; }
  .dk-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .dk-mode { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.05); border: 1px solid rgba(216,235,252,.14); }
  .dk-mode button { min-height: 32px; min-width: 64px; border: 0; border-radius: 999px; background: transparent; color: var(--brand-ice); font: 600 .74rem 'Outfit', sans-serif; cursor: pointer; } .dk-mode button[aria-pressed="true"] { background: #fff; color: #0a0f18; }
  .dk-st { flex: 1; min-width: 0; text-align: right; font: 500 .66rem 'JetBrains Mono', monospace; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .dk-st.ok { color: var(--brand-green); }
  .dk-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .dk-col { display: grid; gap: 6px; min-width: 0; } .dk-col.a { --c: #95fe7c; --cr: 149,254,124; } .dk-col.b { --c: #7ec1fb; --cr: 126,193,251; }
  .dk-amt { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
  .ck-dock button.cx { min-height: 48px; border-radius: 14px; cursor: pointer; font: 600 .82rem 'Outfit', sans-serif; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform .1s; } .ck-dock button.cx:active:not(:disabled) { transform: scale(.95); } .ck-dock button.cx:disabled { opacity: .38; }
  .ck-dock .cs-vote { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 10px; } .ck-dock .cs-buy, .ck-dock .cs-sell { font-size: .78rem; padding: 0; }
  .bp-top { padding: 0 12px; }
}
@media (prefers-reduced-motion: reduce) { .jc, .jc-sheen { transition: none; } .ck-side:hover .jc { transform: none; } .cs-eq i { animation: none; height: 14px; } .cb-prog i { transition: none; } .ck button.cx, .cs-play { transition: none; } }
/* share module, opened after Withdraw */
.shr { width: min(720px, calc(100vw - 20px)); height: min(860px, calc(100dvh - 20px)); padding: 0; border: 1px solid rgba(126,193,251,.28); border-radius: 18px; background: #111a2c; overflow: hidden; position: fixed; inset: 0; margin: auto; } .shr::backdrop { background: rgba(3,6,14,.78); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); } .shr iframe { width: 100%; height: 100%; border: 0; display: block; }
/* donate bar: peer to peer, no fees */
.bp-give { max-width: 1000px; margin: 16px auto 0; display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; padding: 14px 22px; border-radius: 22px; border: 1px solid rgba(216,235,252,.16); background: linear-gradient(180deg, rgba(14,21,34,.92), rgba(7,10,16,.95)); }
.bp-give > span { flex: 1 1 200px; font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); } .bp-give > span b { color: var(--brand-green); font-weight: 500; }
.bp-give .bp-btn i { width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; flex: none; }
.bt-in { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; padding: 0 14px; min-height: 52px; border-radius: 14px; border: 1px solid rgba(216,235,252,.2); background: rgba(255,255,255,.03); }
.bt-in:focus-within { border-color: var(--brand-green); }
.bt-in input { flex: 1; min-width: 0; background: transparent; border: 0; outline: 0; color: #fff; font: 700 1rem 'JetBrains Mono', monospace; } .bt-in span { font: 500 .8rem 'JetBrains Mono', monospace; color: var(--text-muted); }
/* chart or game view */
.bv { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: rgba(255,255,255,.04); border: 1px solid rgba(216,235,252,.14); max-width: 100%; overflow-x: auto; scrollbar-width: none; } .bv::-webkit-scrollbar { display: none; }
.bv button { min-height: 36px; padding: 0 14px; border: 0; border-radius: 999px; cursor: pointer; background: transparent; color: var(--brand-ice); white-space: nowrap; font: 700 .68rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; }
.bv button:hover { color: var(--brand-green); } .bv button[aria-pressed="true"] { background: var(--brand-green); color: #0d1321; }
.bg { position: relative; aspect-ratio: 1280 / 800; border-radius: 16px; overflow: hidden; background: #04070d; border: 1px solid rgba(216,235,252,.12); margin-top: 4px; }
.bg iframe { position: absolute; left: 0; top: 0; width: 1280px; height: 800px; border: 0; transform-origin: 0 0; }
.bc-plot .bx { fill: none; stroke: rgba(216,235,252,.14); stroke-width: 1; } .bc-plot .at { fill: #8d9bb0; font: 400 11px 'Outfit', sans-serif; }
.bc-plot .pa { fill: #0a0f18; stroke: #95fe7c; stroke-width: 1.5; } .bc-plot .pb { fill: #0a0f18; stroke: #7ec1fb; stroke-width: 1.5; }
.bc-leg i.box { width: 28px; height: 11px; border-radius: 1px; background: transparent !important; border: 2px solid; }
@media (max-width: 1000px) { .bp .hl-grid, .bp .hl-grid + .hl-grid { grid-template-columns: 1fr; } }
@media (max-width: 860px) { .bp-top { padding: 104px 16px 0; } .bc-plot { height: 260px; } .bm-big { grid-template-columns: 1fr; } }
@media (prefers-reduced-transparency: reduce) { .bc-tip { background: rgba(7,14,12,.96); -webkit-backdrop-filter: none; backdrop-filter: none; } }
</style>
'''

nav = local(between('  <div class="nav-wrapper">', '    </nav>\n  </div>'))
nav = nav.replace('href="index.html#top"', 'href="index.html"')
dialogs = between('  <!-- FORMS: one chrome module', '  <!-- FOOTER -->\n  <footer class="cp-foot">', include_end=False)
footer = local(between('  <footer class="cp-foot">', '  </footer>'))

BODY = '''
  <!-- COCKPIT: everything needed during a battle on one screen. Timer bar stays in view while the page scrolls. -->
  <div class="ck" id="ck">
    <div class="ck-in">
      <div class="ck-bar" id="ckBar" aria-live="off"><div class="cb-l"><span class="ld-live ended"><i></i>Loading the battle</span></div><div class="cb-c"><div class="cb-t"><span id="ldT">--:--</span><small>&nbsp;</small></div></div><div class="cb-r"></div></div>
      <div class="ck-grid">
        <section class="ck-side a" id="sideA" aria-label="Side A"></section>
        <section class="ck-stage" aria-label="Chart and stream">
          <div class="ck-top">
            <div class="ck-tabs" id="bvTabs" role="group" aria-label="Chart or game view">
              <button type="button" data-view="chart" aria-pressed="true">Chart</button><button type="button" data-view="dj" aria-pressed="false">DJ Clash</button><button type="button" data-view="racer" aria-pressed="false">Racers</button><button type="button" data-view="dancer" aria-pressed="false">Dancers</button><button type="button" data-view="surf" aria-pressed="false">Surf</button>
            </div>
            <span class="bp-tag" id="bcTag" hidden>Sample chart</span><span id="bcTitle" hidden></span>
          </div>
          <div class="ck-views" id="ckViews">
            <div class="tv" id="stream" hidden>
              <div class="tv-case"><div class="tv-scr" id="bsWrap"></div></div>
              <div class="tv-ft"><span id="tvLabel"><i></i>Live stream</span><a id="bsLink" href="#" target="_blank" rel="noopener">Open</a></div>
            </div>
            <div class="ck-main">
              <div class="bg" id="bgWrap" hidden></div>
              <div class="bc" id="bcWrap">
                <div class="bc-leg" id="bcLeg"></div>
                <div class="bc-plot" id="bcPlot" tabindex="0" role="img" aria-label="Pool size over time for both sides"></div>
                <div class="bc-tip" id="bcTip"></div>
              </div>
            </div>
          </div>
          <div class="ck-meters" id="ckMeters"></div>
        </section>
        <section class="ck-side b" id="sideB" aria-label="Side B"></section>
      </div>
      <p class="bp-msg" id="bpMsg" role="status"></p>
      <p class="ck-risk" id="ckRisk">Trading carries risk. You can lose what you put in.</p>
    </div>
  </div>
  <div class="ck-dock" id="ckDock" hidden></div>
  <dialog class="shr" id="shr" aria-label="Share your battle"></dialog>

  <div class="bp-top">
    <div class="bp-end" id="bpEnd"><p id="bpEndTx"></p><button class="btn-primary" type="button" id="bpSettle" hidden>Settle battle</button><button class="btn-primary" type="button" id="bpWithdraw">Withdraw</button></div>
    <div class="bp-give" id="bpGive" hidden><span>Donate direct &middot; <b>No fees</b></span></div>
  </div>

  <!-- Below the fold: the result and the record. Nothing down here is needed to trade. -->
  <section class="cp-sec hl bp" aria-label="Battle details">
    <div class="hl-in">
      <div class="hl-grid">
        <article class="hl-panel" id="decided">
          <header class="hl-ph"><div><h3 id="bfTitle">2 of 3 wins</h3></div></header>
          <ul class="bf" id="bfList"></ul>
          <div id="bjWrap"></div>
          <p class="bf-rule" id="bfRule"></p>
        </article>
        <article class="hl-panel" id="sides">
          <header class="hl-ph"><div><h3>Side by side</h3></div></header>
          <div id="bsTable"></div>
          <details class="bc-tbl" id="bcTbl"><summary>Chart as a table</summary><div id="bcTable"></div></details>
        </article>
      </div>
      <div class="hl-grid">
        <article class="hl-panel" id="rounds" hidden>
          <header class="hl-ph"><div><h3 id="brTitle">Best of 3 rounds</h3></div></header>
          <p class="br-score" id="brScore"></p>
          <ol class="br" id="brList"></ol>
        </article>
        <article class="hl-panel" id="mine" hidden>
          <header class="hl-ph"><div><h3>Your battle</h3></div><span class="bp-tag" id="bmTag" hidden>Sample</span></header>
          <div id="bmBody"></div>
        </article>
      </div>
    </div>
  </section>
'''

PAGE_JS = r'''<script id="battle-page-js">
/* Battle page. Read-only data comes from https://wavewarz.info/api/public (battles/:id and events).
   Everything that needs a wallet goes through window.WW; each call returns a Promise. With a function missing, that control
   runs in preview and says so:
     WW.getBattleChart(battleId)        -> { points: [{ t: ms, a: poolSol, b: poolSol }, ...] }
     WW.getPosition(battle)             -> { a: { tokens, valueSol }, b: { tokens, valueSol } }
     WW.buy(battle, side, amountSol)    side is 'a' or 'b'
     WW.sell(battle, side, percent)     25, 50, 100, or the share a typed SOL amount is worth
     WW.sellSol(battle, side, sol)      optional; sell a typed SOL amount directly
     WW.withdraw(battle)
     WW.getPoll(battle)                 -> { a: votes, b: votes, locked: bool, mine: 'a' | 'b' | null }
     WW.votePoll(battle, side)          free; the wallet signs a message
     WW.getJudge(battle)                -> { status: 'locked' | 'ready', winner: 'a' | 'b', confidence: 0-100, notes }
     WW.getSummary(battle)              -> { putInSol, gotBackSol, trades: [{ side, buy, tokens, sol }] } for the connected wallet
     WW.shareStats(battle, where)       where is 'image', 'x' or 'farcaster'
     WW.audioUrl(battle, side)          optional; a playable URL for that side's song (Audius links play without it)
     WW.donate(battle, target, sol)     target is 'a', 'b' or 'wavewarz'
     WW.isSettled(battle)               optional -> true once withdrawals are open
     WW.settle(battle)                  optional; only offered if nobody has settled 20 seconds after the end
   Pick a battle with ?id=<battleId>. With no id the page shows the live battle, or the most recent one.
   Design review: ?demo=live shows a battle in progress, ?demo=ended a finished one, both with sample numbers. */
(function () {
  'use strict';
  var API = 'https://wavewarz.info/api/public/', W = window.WW = window.WW || {};
  var qs = new URLSearchParams(location.search), demo = qs.get('demo'), wantId = (qs.get('id') || '').replace(/[^0-9]/g, '');
  var $ = function (id) { return document.getElementById(id); };
  var B = null, EV = null, pts = [], sampleChart = false, tick = null, poll = null, lastKey = '';
  var CA = '#95fe7c', CB = '#7ec1fb';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
  function sol(n, d) { return (+n || 0).toFixed(d == null ? 2 : d) + ' SOL'; }
  function handle(a) { try { var u = new URL(a.musicLink); return /audius\.co$/.test(u.hostname) ? (u.pathname.split('/')[1] || '') : ''; } catch (e) { return ''; } }
  function httpsUrl(u) { try { var x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } }
  function kindName(t) { return t === 'main' ? 'Sunday Featured' : (t === 'community' ? 'Community BattleZ' : 'Quick BattleZ'); }
  function ended() { return !B || Date.now() >= B.end; }
  function name(k) { return (k === 'a' ? B.a : B.b).name; }
  function side(v) { return v === 'artist1' ? 'a' : v === 'artist2' ? 'b' : ''; }

  /* ---------- matchup deck (same markup as the homepage Live Battle Deck) ---------- */
  var PLAY = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  var playing = '', X_POLL = window.WW_POLL_URL || 'https://x.com/wavewarz';
  function inPage(a) { return typeof W.audioUrl === 'function' || /^https:\/\/(www\.)?audius\.co\//.test(a.musicLink || ''); }
  var busy2 = '', stat = { a: '', b: '' }, statOk = { a: false, b: false }, pos = null, dockMode = 'buy', statT = null;
  var BUYS = [0.05, 0.1, 0.25], SELLS = [25, 50, 100];
  function split(l, r, label, raw) { var t = l + r, g = t ? Math.round(100 * l / t) : 50; return '<div class="ld-split"><div class="ld-pc"><span class="a">' + (raw ? l : g + '%') + '</span><em>' + label + '</em><span class="c">' + (raw ? r : (100 - g) + '%') + '</span></div><div class="ld-bar" aria-label="' + label + '"><i style="width:' + g + '%"></i></div></div>'; }
  function voteBtn(k, short) {
    var a = k === 'a' ? B.a : B.b;
    if (B.type !== 'quick') return '<a class="cs-vote" href="' + esc(X_POLL) + '" target="_blank" rel="noopener">Vote on X<small>Free</small></a>';
    if (B.myVote === k) return '<button type="button" class="cx cs-vote voted" disabled>Your vote</button>';
    return '<button type="button" class="cx cs-vote" data-vote="' + k + '"' + (B.myVote || (B.poll && B.poll.locked) ? ' disabled' : '') + '>Vote' + (short ? ' ' + esc(a.name) : '') + '<small>Free</small></button>';
  }
  function amts(k, buy) {
    var none = pos && pos[k] && !(+pos[k].tokens > 0);
    return (buy ? BUYS : SELLS).map(function (v) {
      return '<button type="button" class="cx ' + (buy ? 'cs-buy' : 'cs-sell') + '" data-' + (buy ? 'buy' : 'sell') + '="' + k + '" data-v="' + v + '"' + (busy2 || (!buy && none) ? ' disabled' : '') + ' aria-label="' + (buy ? 'Buy ' + v.toFixed(2) + ' SOL of ' : 'Sell ' + v + ' percent of ') + esc(name(k)) + '">' + (buy ? v.toFixed(2) : v + '%') + '</button>';
    }).join('');
  }
  /* custom amount: kept across redraws so polling never wipes what someone is typing */
  var custom = { a: '', b: '' };
  function customRow(k, mode) {
    var nm = esc(name(k)), v = esc(custom[k]), dis = busy2 ? ' disabled' : '', none = pos && pos[k] && !(+pos[k].tokens > 0);
    var field = '<label class="cs-in"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" enterkeyhint="go" data-amt="' + k + '" value="' + v + '" placeholder="Amount" aria-label="Custom amount in SOL for ' + nm + '"><span>SOL</span></label>';
    if (mode === 'buy') return '<div class="cs-cu">' + field + '<button type="button" class="cx cs-go buy" data-go="buy" data-k="' + k + '"' + dis + '>Buy</button></div>';
    if (mode === 'sell') return '<div class="cs-cu">' + field + '<button type="button" class="cx cs-go sell" data-go="sell" data-k="' + k + '"' + (dis || (none ? ' disabled' : '')) + '>Sell</button></div>';
    return '<div class="cs-cu">' + field + '<button type="button" class="cx cs-go buy" data-go="buy" data-k="' + k + '"' + dis + '>Buy</button><button type="button" class="cx cs-go sell" data-go="sell" data-k="' + k + '"' + (dis || (none ? ' disabled' : '')) + '>Sell</button></div>';
  }
  function keepFocus(host, fn) {
    var ae = document.activeElement, k = ae && ae.dataset && ae.dataset.amt && host.contains(ae) ? ae.dataset.amt : '', st = k ? ae.selectionStart : 0, en = k ? ae.selectionEnd : 0;
    fn();
    if (k) { var n = host.querySelector('[data-amt="' + k + '"]'); if (n) { n.focus(); try { n.setSelectionRange(st, en); } catch (e) {} } }
  }
  function tradeCustom(k, buy) {
    var n = parseFloat(String(custom[k]).replace(',', '.'));
    if (!(n > 0)) { setStat(k, 'Type an amount in SOL first.', false); renderSide(k); renderDock(); var f = document.querySelector('[data-amt="' + k + '"]'); if (f) f.focus(); return; }
    n = Math.round(n * 1e4) / 1e4;
    if (buy) { trade(k, true, n); return; }
    /* selling a SOL amount: WW.sellSol when provided, otherwise the share of the holding that is worth that much */
    if (typeof W.sellSol === 'function') { trade(k, false, n, true); return; }
    var p = pos && pos[k], val = p ? +p.valueSol : 0;
    if (p && val > 0) { trade(k, false, Math.min(100, Math.round(1000 * n / val) / 10)); return; }
    trade(k, false, n, true);
  }
  function holdText(k) { var p = pos && pos[k]; return p && +p.tokens > 0 ? 'You hold ' + (+p.tokens).toFixed(0) + ' tokens · ' + sol(p.valueSol, 4) : ''; }
  function renderSide(k) {
    var a = k === 'a' ? B.a : B.b, over = ended(), on = playing === k, by = handle(a) || a.twitterHandle || '', art = httpsUrl(a.albumArtUrl || a.profilePictureUrl), link = httpsUrl(a.musicLink);
    var pa = B.a.poolSol || 0, pb = B.b.poolSol || 0, tot = pa + pb, mine = k === 'a' ? pa : pb, pct = tot ? Math.round(100 * mine / tot) : 50;
    var el = $(k === 'a' ? 'sideA' : 'sideB'); el.classList.toggle('is-playing', on);
    keepFocus(el, function () { el.innerHTML = '<div class="cs-artbox"><div class="jc"><div class="jc-case"><div class="jc-spine"></div><div class="jc-art"><span class="cs-tag">' + (B.type === 'quick' ? 'Song ' : 'Artist ') + k.toUpperCase() + '</span>' +
      (art ? '<img src="' + esc(art) + '" alt="" loading="eager" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '<span class="mono" aria-hidden="true">' + esc((a.name || '?').trim().charAt(0).toUpperCase()) + '</span>' +
      '</div></div><div class="jc-wrap" aria-hidden="true"><div class="jc-crease"></div><div class="jc-sheen"></div></div><span class="cs-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      (link ? (inPage(a) ? '<button type="button" class="cs-play" data-play="' + k + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Pause ' : 'Play ') + esc(a.name) + '">' + (on ? PAUSE : PLAY) + '</button>'
                         : '<a class="cs-play" href="' + esc(link) + '" target="_blank" rel="noopener" aria-label="Listen to ' + esc(a.name) + '">' + PLAY + '</a>') : '') + '</div></div>' +
      '<div><div class="cs-np' + (over && B.winner === k ? ' win' : '') + '">' + (on ? 'Now playing' : over ? (B.winner === k ? 'Winner' : 'Final') : (link ? 'Press play' : '&nbsp;')) + '</div><h2 class="cs-nm">' + esc(a.name) + '</h2><p class="cs-by">' + (by ? '@' + esc(by) : '&nbsp;') + '</p></div>' +
      '<div class="cs-pool"><b>' + mine.toFixed(4) + '<small>SOL</small></b><span>' + pct + '%</span></div>' +
      (over ? '' : voteBtn(k) + '<div class="cs-tr"><div class="cs-row"><span>Buy</span>' + amts(k, true) + '</div><div class="cs-row"><span>Sell</span>' + amts(k, false) + '</div>' + customRow(k) + '</div>' +
        '<p class="cs-st' + (statOk[k] ? ' ok' : '') + '" role="status">' + esc(stat[k] || holdText(k)) + '</p>'); });
  }
  function renderDock() {
    var d = $('ckDock'), over = ended(); keepFocus(d, function () { renderDockInner(d, over); }); }
  function renderDockInner(d, over) {
    d.hidden = over; document.body.classList.toggle('has-dock', !over); if (over) { d.innerHTML = ''; return; }
    var msg = stat.a || stat.b, ok = stat.a ? statOk.a : statOk.b;
    d.innerHTML = '<div class="dk-top"><div class="dk-mode" role="group" aria-label="Buy or sell"><button type="button" data-mode="buy" aria-pressed="' + (dockMode === 'buy') + '">Buy</button><button type="button" data-mode="sell" aria-pressed="' + (dockMode === 'sell') + '">Sell</button></div><span class="dk-st' + (ok ? ' ok' : '') + '" role="status">' + esc(msg || (dockMode === 'buy' ? 'Tap an amount in SOL' : 'Tap how much to sell')) + '</span></div>' +
      '<div class="dk-cols">' + ['a', 'b'].map(function (k) { return '<div class="dk-col ' + k + '">' + voteBtn(k, true) + '<div class="dk-amt">' + amts(k, dockMode === 'buy') + '</div>' + customRow(k, dockMode) + '</div>'; }).join('') + '</div>';
  }
  function renderBar() {
    var over = ended(), tot = (B.a.poolSol || 0) + (B.b.poolSol || 0), rd = EV && B.round ? ' · Round ' + B.round + ' of ' + nRounds() : '';
    $('ckBar').innerHTML = '<div class="cb-l"><span class="ld-live' + (over ? ' ended' : '') + '"><i></i>' + (over ? 'Ended' : 'Live') + '</span><span class="cb-k">' + kindName(B.type) + rd + '</span>' + (B.sample ? '<span class="cb-k">Sample</span>' : '') + '</div>' +
      '<div class="cb-c"><span class="cb-n a">' + esc(B.a.name) + '<i class="ka"></i></span><div class="cb-t" id="ckT" role="timer" aria-label="Time left to trade"><span id="ldT">' + (over ? '0:00' : '--:--') + '</span><small>' + (over ? (B.winner ? 'Final' : 'Settling') : 'Left to trade') + '</small></div><span class="cb-n b"><i class="kb"></i>' + esc(B.b.name) + '</span></div>' +
      '<div class="cb-r"><span>Both pools</span><b>' + tot.toFixed(4) + ' SOL</b></div><i class="cb-prog" aria-hidden="true"><i id="ckProg" style="width:' + (over ? 100 : 0) + '%"></i></i>';
  }
  function renderDeck() {
    var pa = B.a.poolSol || 0, pb = B.b.poolSol || 0, over = ended(), pv = B.poll;
    renderBar(); renderSide('a'); renderSide('b'); renderDock();
    $('ckMeters').innerHTML = (pv ? split(pv.a, pv.b, 'Poll', true) : '') + split(pa, pb, 'Pools');
    $('ckRisk').hidden = over;
    var e = $('bpEnd'); e.classList.toggle('on', over);
    if (over) {
      var done = isSettled(), wd = $('bpWithdraw'), st = $('bpSettle');
      $('bpEndTx').innerHTML = done ? '<b>Battle ended.</b> Traded? Withdraw to collect your SOL. Missed it? <a href="https://claim.wavewarz.info" target="_blank" rel="noopener">claim.wavewarz.info</a>' : '<b>Battle ended.</b> Settling the result. Withdraw opens in a moment.';
      wd.disabled = !done; wd.textContent = done ? 'Withdraw' : 'Settling…';
      st.hidden = done || typeof W.settle !== 'function' || Date.now() - B.end < 20000;
    }
    var g = $('bpGive'); g.hidden = false;
    g.innerHTML = '<span>Donate direct &middot; <b>No fees</b></span><button class="bp-btn" type="button" data-give="a"><i class="ka"></i>' + esc(B.a.name) + '</button><button class="bp-btn" type="button" data-give="b"><i class="kb"></i>' + esc(B.b.name) + '</button><button class="bp-btn" type="button" data-give="wavewarz">WaveWarZ</button>';
    document.title = B.a.name + ' vs ' + B.b.name + ' | WaveWarZ';
  }
  /* one tap trades. The wallet approval is the confirmation; the result shows right under the buttons, once. */
  function setStat(k, t, ok) { stat[k] = t; statOk[k] = !!ok; clearTimeout(statT); if (t && !busy2) statT = setTimeout(function () { stat.a = stat.b = ''; if (B) { renderSide('a'); renderSide('b'); renderDock(); } }, 4500); }
  function trade(k, buy, v, solSell) {
    if (busy2 || !B || ended()) return;
    var fn = buy ? W.buy : (solSell ? W.sellSol : W.sell), live = typeof fn === 'function', what = buy || solSell ? (+v.toFixed(4)) + ' SOL' : v + '%';
    busy2 = k; stat.a = stat.b = ''; stat[k] = live ? 'Approve in your wallet…' : (buy ? 'Buying ' : 'Selling ') + what + '…'; statOk[k] = false; renderSide('a'); renderSide('b'); renderDock();
    Promise.resolve(live ? fn(B, k, v) : new Promise(function (r) { setTimeout(r, 450); })).then(function () {
      busy2 = ''; setStat(k, (live ? '' : 'Preview: ') + (buy ? 'Bought ' : 'Sold ') + what + (live ? '' : ' · nothing sent'), true); if (custom[k] && Math.abs(parseFloat(custom[k]) - v) < 1e-9) custom[k] = '';
      if (live) { document.dispatchEvent(new CustomEvent('ww-battle-changed', { detail: { id: B.id } })); loadPos(); load(); }
    }).catch(function (e) { busy2 = ''; setStat(k, (e && e.userMessage) || 'Did not go through. Nothing was sent.', false); })
      .then(function () { renderSide('a'); renderSide('b'); renderDock(); });
  }
  function loadPos() {
    if (typeof W.getPosition !== 'function' || !B) return;
    Promise.resolve(W.getPosition(B)).then(function (p) { if (p) { pos = p; renderSide('a'); renderSide('b'); renderDock(); } }).catch(function () {});
  }
  /* Settling should happen on its own. The page never shows a red End Battle button: it waits and re-checks, and only if nobody
     has settled after 20 seconds does it offer one green action (WW.settle). WW.isSettled(battle) can report it directly. */
  function isSettled() { return !!(B.winner || B.settled || Date.now() - B.end > 600000); }   /* long-finished battles never sit on Settling */
  var settleT = null;
  function watchSettle() {
    clearTimeout(settleT); if (!B || !ended() || isSettled() || demo) return;
    settleT = setTimeout(function () {
      var chk = typeof W.isSettled === 'function' ? Promise.resolve(W.isSettled(B)).then(function (v) { if (v) B.settled = true; }).catch(function () {}) : Promise.resolve();
      chk.then(function () { return load(); }).then(function () { if (B && !isSettled()) { renderDeck(); watchSettle(); } });
    }, 8000);
  }
  /* wavewarz.com plays the two songs in order, in sync for everyone. Announce it and the deck follows:
       document.dispatchEvent(new CustomEvent('ww-now-playing', { detail: { side: 'a' } }))   side 'a', 'b' or null */
  document.addEventListener('ww-now-playing', function (e) { var k = e.detail && e.detail.side; if (audio) audio.pause(); playing = k === 'a' || k === 'b' ? k : ''; if (B) { renderDeck(); runTimer(); } });
  /* songs play on the page, one at a time */
  var audio = null;
  function say(t, ok) { var m = $('bpMsg'); m.textContent = t || ''; m.classList.toggle('ok', !!ok); }
  function togglePlay(k) {
    if (!audio) { audio = new Audio(); audio.preload = 'none'; audio.addEventListener('ended', function () { playing = ''; renderDeck(); runTimer(); }); audio.addEventListener('error', function () { if (playing) { playing = ''; renderDeck(); runTimer(); say('That song did not load. Try again.'); } }); }
    if (playing === k) { audio.pause(); playing = ''; renderDeck(); runTimer(); return; }
    var a = k === 'a' ? B.a : B.b; playing = k; renderDeck(); runTimer();
    var src = typeof W.audioUrl === 'function' ? Promise.resolve(W.audioUrl(B, k))
      : jget('https://api.audius.co/v1/resolve?url=' + encodeURIComponent(a.musicLink) + '&app_name=wavewarz').then(function (d) { var id = d && d.data && d.data.id; if (!id) throw 0; return 'https://api.audius.co/v1/tracks/' + encodeURIComponent(id) + '/stream?app_name=wavewarz'; });
    src.then(function (u) { if (playing !== k) return; audio.src = u; return audio.play(); }).catch(function () { if (playing === k) { playing = ''; renderDeck(); runTimer(); say('That song did not load. Try again.'); } });
  }
  function runTimer() {
    clearInterval(tick);
    function go() {
      var left = Math.max(0, B.end - Date.now()), s = Math.ceil(left / 1000), t = $('ldT'); if (!t) return;
      t.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      var pr = $('ckProg'); if (pr) pr.style.width = (100 * (1 - left / Math.max(1, B.end - B.start))).toFixed(2) + '%';
      var ct = $('ckT'); if (ct) ct.classList.toggle('hot', s <= 30);
      if (left <= 0) { clearInterval(tick); paint(); }
    }
    if (!ended()) { go(); tick = setInterval(go, 500); }
  }

  /* ---------- how it is decided: poll, judges (DJ Wavy on Quick BattleZ), chart ---------- */
  function who(k, note) { return k ? '<span class="bf-who"><i class="k' + k + '"></i>' + esc(name(k)) + (note ? '<small>' + note + '</small>' : '') + '</span>' : '<span class="bf-who open">' + (note || 'Open') + '</span>'; }
  function renderDecided() {
    var f = B.factors || {}, over = ended(), quick = B.type !== 'main';
    var pa = B.a.poolSol || 0, pb = B.b.poolSol || 0, lead = pa === pb ? '' : (pa > pb ? 'a' : 'b');
    var pollK = side(f.xPollWinner) || (over && B.type === 'quick' && B.poll && B.poll.a !== B.poll.b ? (B.poll.a > B.poll.b ? 'a' : 'b') : ''), judgeK = side(f.humanJudgeWinner || f.djWavyWinner), chartK = side(f.solVoteWinner) || (over ? lead : '');
    var pv = B.poll, pollLive = pv && (pv.a || pv.b) ? (pv.a === pv.b ? '' : pv.a > pv.b ? 'a' : 'b') : '';
    if (B.judge && B.judge.status === 'ready' && (B.judge.winner === 'a' || B.judge.winner === 'b')) judgeK = judgeK || B.judge.winner;
    function tally(k) { return pv[k] + ' to ' + pv[k === 'a' ? 'b' : 'a']; }
    var rows = '<li><div><h4>Poll</h4></div>' + (pollK ? who(pollK, pv ? tally(pollK) : '') : pollLive ? who(pollLive, tally(pollLive)) : who('', over ? 'Not recorded' : pv ? 'Tied ' + pv.a + ' to ' + pv.b : 'Open')) + '</li>' +
      '<li><div><h4>' + (quick ? 'DJ Wavy' : 'Judges') + '</h4></div>' + (judgeK ? who(judgeK) : who('', over ? 'Not scored yet' : 'After the battle')) + '</li>' +
      '<li><div><h4>Chart</h4></div>' + (chartK ? who(chartK) : lead ? who(lead, 'Ahead now') : who('', 'Even')) + '</li>';
    var j = B.judge, jw = $('bjWrap');
    if (!quick) jw.innerHTML = '';
    else if (j && j.status === 'ready' && (j.winner === 'a' || j.winner === 'b')) {
      var cf = +j.confidence; if (cf > 0 && cf <= 1) cf *= 100;
      jw.innerHTML = '<div class="bj"><div class="bj-h"><span>DJ Wavy\'s call</span>' + (cf > 0 ? '<span>' + Math.round(cf) + '% confident</span>' : '') + '</div><strong><i class="k' + j.winner + '"></i>' + esc(name(j.winner)) + '</strong>' + (j.notes ? '<p>' + esc(j.notes) + '</p>' : '') + '<p style="margin-top:12px"><a class="bp-btn" href="audius-search.html">Get a DJ Wavy Breakdown</a></p></div>';
    } else jw.innerHTML = '<div class="bj locked"><div class="bj-h"><span>DJ Wavy\'s call</span><span>Locked</span></div><p>Revealed when the battle ends.</p></div>';
    $('bfList').innerHTML = rows;
    var quickLabel = quick ? ' the battle' : ' the round'; var got = { a: 0, b: 0 }; [pollK, judgeK, chartK].forEach(function (k) { if (k) got[k]++; });
    var lead2 = got.a >= 2 ? 'a' : got.b >= 2 ? 'b' : B.winner;
    $('bfRule').innerHTML = lead2 && over ? '<b>' + esc(name(lead2)) + '</b> wins' + quickLabel + (got[lead2] ? ', ' + got[lead2] + ' of 3' : '') : (B.type === 'main' ? 'Best of ' + nRounds() + ' rounds wins the battle' : '');
    $('bfRule').hidden = !$('bfRule').innerHTML;
  }

  function nRounds() { return Math.max(3, EV && EV.rounds ? EV.rounds.length : 3); }
  /* ---------- rounds (Main Events) ---------- */
  function renderRounds() {
    var p = $('rounds'); if (!EV || !EV.rounds || EV.rounds.length < 2) { p.hidden = true; return; }
    p.hidden = false; $('brTitle').textContent = 'Best of ' + nRounds() + ' rounds';
    var rw = EV.roundsWon || {};
    $('brScore').innerHTML = esc(B.a.name) + ' ' + (rw.artist1 || 0) + ' &middot; ' + (rw.artist2 || 0) + ' ' + esc(B.b.name) + '<small>' + (EV.winnerSide ? 'Final' : 'So far') + '</small>';
    $('brList').innerHTML = EV.rounds.map(function (r) {
      var k = side(r.winnerSide), cur = String(r.battleId) === String(B.id);
      return '<li' + (cur ? ' class="cur"' : '') + '><a href="battle.html?id=' + encodeURIComponent(r.battleId) + '"' + (cur ? ' aria-current="page"' : '') + '><span class="br-n">Round ' + esc(r.roundNumber) + '</span>' +
        (k ? '<span class="br-w"><i class="k' + k + '"></i>' + esc(name(k)) + '</span>' : '<span class="br-w open">' + (r.live ? 'Live now' : 'Not decided yet') + '</span>') +
        '<span class="br-m">' + sol(r.artist1PoolSol) + ' / ' + sol(r.artist2PoolSol) + '</span></a></li>';
    }).join('');
  }

  /* ---------- side by side (also the table view of the headline numbers) ---------- */
  function renderSides() {
    var e = B.earnings || {}, ea = e.artist1 || {}, eb = e.artist2 || {};
    function row(l, x, y) { return '<tr><th scope="row">' + l + '</th><td>' + x + '</td><td>' + y + '</td></tr>'; }
    $('bsTable').innerHTML = '<table><thead><tr><th scope="col"><span class="sr-only">Measure</span></th><th scope="col"><i class="ka"></i>' + esc(B.a.name) + '</th><th scope="col"><i class="kb"></i>' + esc(B.b.name) + '</th></tr></thead><tbody>' +
      row('In the pool', sol(B.a.poolSol, 4), sol(B.b.poolSol, 4)) + row('Traded', sol(B.a.volumeSol, 4), sol(B.b.volumeSol, 4)) +
      (ea.totalSol != null || eb.totalSol != null ? row('Earned by the artist', sol(ea.totalSol, 4), sol(eb.totalSol, 4)) : '') + '</tbody></table>';
  }

  /* ---------- the chart: one plot, both sides ---------- */
  function seeded(seed) { var x = seed % 2147483647 || 7; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
  function samplePoints() {
    /* stand-in shape that ends on the real pool sizes; replaced by WW.getBattleChart */
    var r = seeded(+B.id || 7), end = Math.min(Date.now(), B.end), n = 36, out = [], a = 0, b = 0, ta = B.a.poolSol || 0, tb = B.b.poolSol || 0, i, wa = [], wb = [], sa = 0, sb = 0;
    for (i = 0; i < n; i++) { wa.push(r() < .45 ? r() : 0); wb.push(r() < .45 ? r() : 0); sa += wa[i]; sb += wb[i]; }
    out.push({ t: B.start, a: 0, b: 0 });
    for (i = 0; i < n; i++) { a += sa ? wa[i] / sa * ta : ta / n; b += sb ? wb[i] / sb * tb : tb / n; out.push({ t: B.start + (end - B.start) * (i + 1) / n, a: a, b: b }); }
    return out;
  }
  function loadChart() {
    var fn = W.getBattleChart;
    if (typeof fn !== 'function') { sampleChart = true; pts = samplePoints(); drawChart(); return; }
    Promise.resolve(fn(B.id)).then(function (d) {
      var p = ((d && d.points) || []).filter(function (x) { return isFinite(x.t) && isFinite(x.a) && isFinite(x.b); }).sort(function (x, y) { return x.t - y.t; });
      if (p.length < 2) throw 0; sampleChart = false; pts = p; drawChart();
    }).catch(function () { sampleChart = true; pts = samplePoints(); drawChart(); });
  }
  function nice(v) { var e = Math.pow(10, Math.floor(Math.log10(v || 1))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; }
  function wall(t) { return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(); }
  function clock(ms) { var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var G = null;
  function drawChart() {
    var el = $('bcPlot'), w = el.clientWidth, h = el.clientHeight; if (!w || !pts.length) return;
    var L = 62, R = 84, T = 12, Bm = 46, pw = Math.max(40, w - L - R), ph = h - T - Bm;
    var t0 = B.start, t1 = Math.max(B.end, pts[pts.length - 1].t), max = 0; pts.forEach(function (p) { max = Math.max(max, p.a, p.b); });
    var stepV = nice((max * 1.05 || 1) / 4), top = stepV * Math.max(1, Math.ceil(max * 1.05 / stepV)), nT = Math.round(top / stepV), dec = stepV >= 1 ? 0 : stepV >= .1 ? 1 : stepV >= .01 ? 2 : 3, X = function (t) { return L + pw * (t - t0) / Math.max(1, t1 - t0); }, Y = function (v) { return T + ph * (1 - v / top); };
    var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">', i;
    for (i = 0; i <= nT; i++) { var v = stepV * i, y = Y(v); s += '<line class="gl" x1="' + L + '" x2="' + (L + pw) + '" y1="' + y + '" y2="' + y + '"/><text class="ax" x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v.toFixed(dec) + '</text>'; }
    s += '<rect class="bx" x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/><text class="at" transform="translate(14 ' + (T + ph / 2) + ') rotate(-90)" text-anchor="middle">Pool Size (SOL)</text><text class="at" x="' + (L + pw / 2) + '" y="' + (h - 4) + '" text-anchor="middle">Time</text>';
    var nX = pw < 320 ? 2 : 4; for (i = 0; i <= nX; i++) { var tt = t0 + (t1 - t0) * i / nX; s += (i > 0 && i < nX ? '<line class="gl" x1="' + X(tt) + '" x2="' + X(tt) + '" y1="' + T + '" y2="' + (T + ph) + '"/>' : '') + '<text class="ax" x="' + X(tt) + '" y="' + (T + ph + 16) + '" text-anchor="middle">' + wall(tt) + '</text>'; }
    function path(k) { return pts.map(function (p, j) { return (j ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p[k]).toFixed(1); }).join(''); }
    var last = pts[pts.length - 1], ex = X(last.t), ya = Y(last.a), yb = Y(last.b), la = ya, lb = yb;
    if (Math.abs(la - lb) < 16) { var mid = (la + lb) / 2, up = ya <= yb; la = mid + (up ? -8 : 8); lb = mid + (up ? 8 : -8); }
    function dots(k) { return pts.length > 60 ? '' : pts.map(function (p) { return '<circle class="p' + k + '" cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p[k]).toFixed(1) + '" r="3"/>'; }).join(''); }
    s += '<path class="lb" d="' + path('b') + '"/><path class="la" d="' + path('a') + '"/>' + dots('b') + dots('a') +
      '<line class="ch" id="bcCh" y1="' + T + '" y2="' + (T + ph) + '"/>' +
      
      '<text class="el" x="' + (ex + 10) + '" y="' + (la + 4) + '">' + last.a.toFixed(2) + ' SOL</text><text class="el" x="' + (ex + 10) + '" y="' + (lb + 4) + '">' + last.b.toFixed(2) + ' SOL</text>' +
      '<circle class="ea" id="bcDa" r="4.5" style="display:none"/><circle class="eb" id="bcDb" r="4.5" style="display:none"/></svg>';
    el.innerHTML = s; G = { L: L, pw: pw, X: X, Y: Y, t0: t0, w: w };
    var leg = $('bcLeg'); leg.textContent = '';
    [['a', CA], ['b', CB]].forEach(function (q) { var sp = document.createElement('span'), ic = document.createElement('i'), nm = document.createElement('b'), em = document.createElement('em'); ic.className = 'box'; ic.style.borderColor = q[1]; nm.textContent = name(q[0]); em.textContent = 'Pool Size (SOL)'; sp.appendChild(ic); sp.appendChild(nm); sp.appendChild(em); leg.appendChild(sp); });
    $('bcTag').hidden = !sampleChart;
    sendGame();
    el.setAttribute('aria-label', 'Pool size over time. ' + name('a') + ' ' + sol(last.a) + ', ' + name('b') + ' ' + sol(last.b) + '.');
    var step = Math.max(1, Math.floor(pts.length / 8)), rows = pts.filter(function (p, j) { return j % step === 0 || j === pts.length - 1; });
    $('bcTable').innerHTML = '<table><thead><tr><th scope="col">Time</th><th scope="col"><i class="ka"></i>' + esc(name('a')) + '</th><th scope="col"><i class="kb"></i>' + esc(name('b')) + '</th></tr></thead><tbody>' +
      rows.map(function (p) { return '<tr><th scope="row">' + clock(p.t - t0) + '</th><td>' + sol(p.a, 3) + '</td><td>' + sol(p.b, 3) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function tipAt(i) {
    if (!G || !pts[i]) return; var p = pts[i], x = G.X(p.t), tip = $('bcTip'), ch = $('bcCh'), da = $('bcDa'), db = $('bcDb');
    ch.setAttribute('x1', x); ch.setAttribute('x2', x); ch.style.display = 'block';
    da.setAttribute('cx', x); da.setAttribute('cy', G.Y(p.a)); da.style.display = 'block'; db.setAttribute('cx', x); db.setAttribute('cy', G.Y(p.b)); db.style.display = 'block';
    tip.textContent = ''; var tt = document.createElement('div'); tt.className = 'tt'; tt.textContent = wall(p.t) + ' \u00b7 ' + clock(p.t - G.t0) + ' in'; tip.appendChild(tt);
    var order = p.a >= p.b ? ['a', 'b'] : ['b', 'a'];
    order.forEach(function (k) { var r = document.createElement('div'), ic = document.createElement('i'), v = document.createElement('b'), n = document.createElement('span'); r.className = 'tr'; ic.style.background = k === 'a' ? CA : CB; v.textContent = sol(p[k], 3); n.textContent = name(k); r.appendChild(ic); r.appendChild(v); r.appendChild(n); tip.appendChild(r); });
    tip.style.display = 'block'; var tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(G.w - tw, x + (x > G.w / 2 ? -tw - 12 : 12))) + 'px';
  }
  function tipOff() { $('bcTip').style.display = 'none'; ['bcCh', 'bcDa', 'bcDb'].forEach(function (id) { var e = $(id); if (e) e.style.display = 'none'; }); }
  var kI = -1;
  function nearest(clientX) { var r = $('bcPlot').getBoundingClientRect(), x = clientX - r.left, best = 0, d = 1e9; pts.forEach(function (p, i) { var q = Math.abs(G.X(p.t) - x); if (q < d) { d = q; best = i; } }); return best; }
  $('bcPlot').addEventListener('pointermove', function (e) { if (G) { kI = nearest(e.clientX); tipAt(kI); } });
  $('bcPlot').addEventListener('pointerdown', function (e) { if (G) { kI = nearest(e.clientX); tipAt(kI); } });
  $('bcPlot').addEventListener('pointerleave', tipOff);
  $('bcPlot').addEventListener('blur', tipOff);
  $('bcPlot').addEventListener('focus', function () { if (pts.length) { kI = pts.length - 1; tipAt(kI); } });
  $('bcPlot').addEventListener('keydown', function (e) { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); kI = Math.max(0, Math.min(pts.length - 1, (kI < 0 ? pts.length - 1 : kI) + (e.key === 'ArrowLeft' ? -1 : 1))); tipAt(kI); });
  var rz; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { tipOff(); drawChart(); }, 120); });

  /* ---------- game views: the stream games (CandyToyBox/WaveWarz-Stream-Battle) react to the same pools and trades ----------
     The built game lives in games/arena/ and is driven through its postMessage bridge. A real trade can be announced with
       document.dispatchEvent(new CustomEvent('ww-trade', { detail: { side: 'a', buy: true, sol: 0.1 } }))
     and the game plays its reaction; without it the page infers moves from pool changes. */
  var fitGame = function () {}, GAME = window.WW_GAME_URL || 'games/arena/index.html', view = 'chart', gFrame = null, gReady = false, gPools = null;
  try { var sv = localStorage.getItem('ww-battle-view'); if (/^(chart|dj|racer|dancer|surf)$/.test(sv)) view = sv; } catch (e) {}
  function gPost(m) { if (gFrame && gFrame.contentWindow) gFrame.contentWindow.postMessage(m, '*'); }
  function sendGame(force) {
    if (!gFrame || !gReady || !B) return;
    var pa = B.a.poolSol || 0, pb = B.b.poolSol || 0;
    if (!gPools || force) {
      gPost({ type: 'wavewarz:setArtistName', side: 'A', name: B.a.name }); gPost({ type: 'wavewarz:setArtistName', side: 'B', name: B.b.name });
      var ia = httpsUrl(B.a.albumArtUrl || B.a.profilePictureUrl), ib = httpsUrl(B.b.albumArtUrl || B.b.profilePictureUrl);
      if (ia) gPost({ type: 'wavewarz:setArtistPhoto', side: 'A', url: ia }); if (ib) gPost({ type: 'wavewarz:setArtistPhoto', side: 'B', url: ib });
      gPost({ type: 'wavewarz:setRoundDuration', seconds: Math.max(1, Math.round((B.end - Date.now()) / 1000)) });
    } else {
      [['A', pa - gPools.a], ['B', pb - gPools.b]].forEach(function (q) { if (Math.abs(q[1]) > 1e-6) gPost({ type: q[1] > 0 ? 'wavewarz:buy' : 'wavewarz:sell', side: q[0], sol: Math.abs(q[1]) }); });
    }
    gPost({ type: 'wavewarz:setPool', side: 'A', sol: pa }); gPost({ type: 'wavewarz:setPool', side: 'B', sol: pb });
    if (B.poll) { gPost({ type: 'wavewarz:setPollVotes', side: 'A', votes: B.poll.a }); gPost({ type: 'wavewarz:setPollVotes', side: 'B', votes: B.poll.b }); }
    gPools = { a: pa, b: pb };
  }
  function setView(v) {
    view = v; try { localStorage.setItem('ww-battle-view', v); } catch (e) {}
    var game = v !== 'chart';
    Array.prototype.forEach.call($('bvTabs').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === v)); });
    $('bcWrap').hidden = game; $('bgWrap').hidden = !game; $('bcTag').hidden = game || !sampleChart;
    $('bcTitle').textContent = game ? 'The game' : 'The chart';
    if (!game) { drawChart(); return; }
    if (!gFrame) {
      gFrame = document.createElement('iframe'); gFrame.title = 'Battle game view'; gFrame.setAttribute('allow', 'autoplay'); gFrame.loading = 'lazy';
      gFrame.addEventListener('load', function () { setTimeout(function () { gReady = true; gPools = null; sendGame(true); }, 700); });
      fitGame = function () { var w = $('bgWrap').clientWidth; if (w) gFrame.style.transform = 'scale(' + (w / 1280) + ')'; };
      addEventListener('resize', fitGame);
      gFrame.src = GAME + '?theme=' + encodeURIComponent(v) + '&stream=1'; $('bgWrap').appendChild(gFrame);
    } else gPost({ type: 'wavewarz:setTheme', theme: v });
    fitGame();
  }
  $('bvTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  document.addEventListener('ww-trade', function (e) {
    var d = e.detail || {}, k = d.side === 'b' ? 'b' : 'a', v = +d.sol || 0; if (!B || !v) return;
    gPost({ type: d.buy === false ? 'wavewarz:sell' : 'wavewarz:buy', side: k === 'a' ? 'A' : 'B', sol: v });
  });

  /* ---------- trade module (uses the shared #wwAct dialog shell) ---------- */
  var dlg = $('wwAct'), opener = null, busy = false;
  function disc(u) { u = httpsUrl(u); return '<span class="wa-d"><b>' + (u ? '<img src="' + esc(u) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</b></span>'; }
  function done(title, text) {
    $('waBody').innerHTML = '<div class="wf-done"><span class="wf-ok" aria-hidden="true"></span><h3>' + title + '</h3><p>' + text + '</p><button class="btn-secondary" type="button" id="waDone">Close</button></div>';
    $('waDone').addEventListener('click', function () { dlg.close(); }); $('waDone').focus();
  }
  function run(btn, live, call, okTitle, okText, after) {
    if (busy) return; busy = true; var label = btn.textContent; btn.disabled = true; btn.textContent = 'Waiting for your wallet…'; var er = $('waErr'); if (er) er.textContent = '';
    Promise.resolve(live ? call() : new Promise(function (r) { setTimeout(r, 900); })).then(function () {
      done(live ? okTitle : 'Preview complete.', live ? okText : 'This was a preview. No wallet opened and nothing was sent.');
      if (after) { var d0 = $('waDone'); if (d0) { d0.textContent = 'Share your battle'; d0.className = 'btn-primary'; d0.addEventListener('click', function () { setTimeout(after, 60); }); } }
      if (live) { document.dispatchEvent(new CustomEvent('ww-battle-changed', { detail: { id: B.id } })); load(); }
    }).catch(function (e) { btn.disabled = false; btn.textContent = label; if (er) er.textContent = (e && e.userMessage) || 'That did not go through. Nothing was sent. Try again.'; }).then(function () { busy = false; });
  }
  function openWithdraw(from) {
    if (!dlg || !dlg.showModal) return; var live = typeof W.withdraw === 'function';
    opener = from || null; $('waBody').onclick = null; $('waEb').textContent = kindName(B.type); $('waTitle').textContent = 'Withdraw from this battle';
    $('waBody').innerHTML = '<div class="wa-rows"><div><span>Result</span><b>' + (B.winner ? esc(name(B.winner)) + ' won' : 'Settling') + '</b></div><div><span>Your tokens</span><b id="bwTok">' + (live ? 'Checking…' : 'Shown when a wallet is connected') + '</b></div><div><span>You receive</span><b id="bwGet">' + (live ? 'Checking…' : 'Shown before you approve') + '</b></div></div>' +
      '<p class="wf-err" id="waErr" role="alert"></p><div class="wf-act"><button class="btn-primary" type="button" id="waGo">Withdraw</button><span class="wf-fine">' + (live ? 'Your wallet opens to approve. Use the wallet you traded with.' : 'Preview. Nothing is sent from this page yet.') + '</span></div>';
    if (typeof W.getPosition === 'function') Promise.resolve(W.getPosition(B)).then(function (p) {
      var t = $('bwTok'), g = $('bwGet'); if (!p || !t) return;
      t.textContent = [['a', p.a], ['b', p.b]].filter(function (q) { return q[1] && +q[1].tokens > 0; }).map(function (q) { return (+q[1].tokens).toFixed(3) + ' on ' + name(q[0]); }).join(', ') || 'None in this battle';
      g.textContent = p.claimSol != null ? sol(p.claimSol, 4) : sol((p.a && +p.a.valueSol || 0) + (p.b && +p.b.valueSol || 0), 4);
    }).catch(function () {});
    $('waGo').addEventListener('click', function () { run(this, live, function () { return W.withdraw(B); }, 'Withdrawn.', 'Your SOL from this battle is back in your wallet.', openShare); });
    if (!dlg.open) dlg.showModal();
  }
  /* Candy's share module (share-module.html) opens after Withdraw, once, and from the Your battle panel */
  function openShare() {
    var d = $('shr'); if (!d || !d.showModal || !B) return;
    var f = B.factors || {}, e = B.earnings || {}, lead = (B.a.poolSol || 0) >= (B.b.poolSol || 0) ? 'a' : 'b';
    var data = { a: B.a.name, b: B.b.name, winner: B.winner || lead, chart: side(f.solVoteWinner) || lead, poll: side(f.xPollWinner) || (B.poll ? (B.poll.a >= B.poll.b ? 'a' : 'b') : ''), judge: side(f.humanJudgeWinner) || (B.judge && B.judge.winner) || '',
      poolA: B.a.poolSol, poolB: B.b.poolSol, volume: (B.a.volumeSol || 0) + (B.b.volumeSol || 0), type: kindName(B.type), pollA: B.poll ? B.poll.a : null, pollB: B.poll ? B.poll.b : null, notes: B.judge && B.judge.notes || '', payA: e.artist1 && e.artist1.totalSol, payB: e.artist2 && e.artist2.totalSol };
    d.textContent = ''; var fr = document.createElement('iframe'); fr.title = 'Share your battle'; fr.src = 'share-module.html?embed=1#' + encodeURIComponent(JSON.stringify(data)); d.appendChild(fr);
    d.showModal();
  }
  addEventListener('message', function (e) { if (e.data && e.data.type === 'ww-share-close') { var d = $('shr'); if (d && d.open) d.close(); } });
  $('shr').addEventListener('click', function (e) { if (e.target === this) this.close(); });
  $('shr').addEventListener('close', function () { this.textContent = ''; });

  /* donations go wallet to wallet with no fee: WW.donate(battle, target, amountSol), target is 'a', 'b' or 'wavewarz' */
  function openDonate(target, from) {
    if (!dlg || !dlg.showModal) return;
    var a = target === 'a' ? B.a : target === 'b' ? B.b : null, nm = a ? a.name : 'WaveWarZ', amt = 0.1, live = typeof W.donate === 'function';
    var wal = a && a.wallet ? String(a.wallet) : '', short = wal ? wal.slice(0, 4) + '..' + wal.slice(-4) : '';
    opener = from || null; $('waBody').onclick = null; $('waEb').textContent = 'Donate'; $('waTitle').textContent = 'Donate to ' + nm;
    $('waBody').innerHTML = (a ? '<div class="wa-s" style="margin-bottom:16px">' + disc(a.albumArtUrl || a.profilePictureUrl) + '<div><strong>' + esc(nm) + '</strong><span>' + esc(short || 'Artist wallet') + '</span></div></div>' : '') +
      '<div class="bt-amt">' + [0.05, 0.1, 0.25].map(function (v) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (v === amt) + '">' + v.toFixed(2) + ' SOL</button>'; }).join('') + '</div>' +
      '<label class="bt-in"><input id="bdAmt" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Amount in SOL" placeholder="Other amount…"><span>SOL</span></label>' +
      '<div class="wa-rows"><div><span>Goes to</span><b>' + (a ? 'The artist, wallet to wallet' : 'WaveWarZ') + '</b></div><div><span>Fees</span><b>None</b></div></div>' +
      '<p class="wf-err" id="waErr" role="alert"></p><div class="wf-act"><button class="btn-primary" type="button" id="waGo">Donate 0.10 SOL</button><span class="wf-fine">' + (live ? 'Your wallet opens to approve. Only the network fee is extra.' : 'Preview. Nothing is sent from this page yet.') + '</span></div>';
    function label() { $('waGo').textContent = 'Donate ' + (amt > 0 ? (+amt.toFixed(4)) + ' SOL' : ''); $('waGo').disabled = !(amt > 0); }
    $('waBody').onclick = function (e) { var v = e.target.closest('[data-v]'); if (!v) return; amt = +v.dataset.v; $('bdAmt').value = ''; Array.prototype.forEach.call($('waBody').querySelectorAll('[data-v]'), function (x) { x.setAttribute('aria-pressed', String(x === v)); }); label(); };
    $('bdAmt').addEventListener('input', function () { var n = parseFloat(this.value.replace(',', '.')); amt = isFinite(n) && n > 0 ? n : 0; Array.prototype.forEach.call($('waBody').querySelectorAll('[data-v]'), function (x) { x.setAttribute('aria-pressed', 'false'); }); label(); });
    $('waGo').addEventListener('click', function () { var sent = amt; run(this, live, function () { return W.donate(B, target, sent); }, 'Donation sent.', (+sent.toFixed(4)) + ' SOL went straight to ' + esc(nm) + '.'); });
    if (!dlg.open) dlg.showModal();
  }
  $('bpGive').addEventListener('click', function (e) { var b = e.target.closest('[data-give]'); if (b) openDonate(b.dataset.give, b); });
  if (dlg) dlg.addEventListener('close', function () { if (opener && opener.focus && document.contains(opener)) opener.focus(); opener = null; });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t || !B) return;
    var go = t.closest('[data-go]'); if (go) { tradeCustom(go.dataset.k, go.dataset.go === 'buy'); return; }
    var b = t.closest('[data-buy]'), sl = t.closest('[data-sell]'), v = t.closest('[data-vote]'), pl = t.closest('[data-play]'), md = t.closest('[data-mode]');
    if (b) trade(b.dataset.buy, true, +b.dataset.v); else if (sl) trade(sl.dataset.sell, false, +sl.dataset.v);
    else if (v) castVote(v.dataset.vote); else if (pl) togglePlay(pl.dataset.play); else if (md) { dockMode = md.dataset.mode; renderDock(); }
  });
  document.addEventListener('input', function (e) {
    var f = e.target; if (!f.dataset || !f.dataset.amt) return;
    var v = f.value.replace(/[^0-9.,]/g, '').replace(',', '.'); var parts = v.split('.'); if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    if (v !== f.value) { var c = f.selectionStart - (f.value.length - v.length); f.value = v; try { f.setSelectionRange(c, c); } catch (x) {} }
    custom[f.dataset.amt] = v; if (stat[f.dataset.amt] === 'Type an amount in SOL first.') { stat[f.dataset.amt] = ''; }
  });
  document.addEventListener('keydown', function (e) {
    var f = e.target; if (!f.dataset || !f.dataset.amt || e.key !== 'Enter') return; e.preventDefault();
    var inDock = !!f.closest('#ckDock'); tradeCustom(f.dataset.amt, inDock ? dockMode === 'buy' : true);
  });
  /* number keys for the fast: 1 2 3 buy side A, 8 9 0 buy side B (ignored while typing in a field) */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || !B || ended()) return; var tg = e.target, tn = tg && tg.tagName; if (tn === 'INPUT' || tn === 'TEXTAREA' || (tg && tg.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    var i = '123'.indexOf(e.key), j = '890'.indexOf(e.key); if (e.key.length !== 1) return;
    if (i > -1) trade('a', true, BUYS[i]); else if (j > -1) trade('b', true, BUYS[j]);
  });
  $('bpWithdraw').addEventListener('click', function () { openWithdraw(this); });
  $('bpSettle').addEventListener('click', function () {
    var b = this; b.disabled = true; b.textContent = 'Waiting for your wallet\u2026';
    Promise.resolve(W.settle(B)).then(function () { B.settled = true; say('Battle settled. Withdraw is open.', true); return load(); })
      .catch(function (er) { say((er && er.userMessage) || 'Settling did not go through. Nothing was charged. Try again.'); })
      .then(function () { b.disabled = false; b.textContent = 'Settle battle'; if (B) renderDeck(); });
  });
  /* the poll: the vote shows at once, then the wallet signs; a failed vote is taken back */
  function voteKey() { return 'ww-vote-' + B.id; }
  function castVote(k) {
    if (!B || B.myVote || ended()) return;
    var live = typeof W.votePoll === 'function', before = B.poll ? { a: B.poll.a, b: B.poll.b, locked: B.poll.locked } : null;
    B.poll = B.poll || { a: 0, b: 0, locked: false }; B.poll[k]++; B.myVote = k; renderDeck(); runTimer(); renderDecided();
    if (!live) { say('Preview. Your vote shows here; on wavewarz.com it is counted.', true); return; }
    say('Approve the free vote in your wallet.');
    Promise.resolve(W.votePoll(B, k)).then(function () { try { sessionStorage.setItem(voteKey(), k); } catch (e) {} say('Vote counted.', true); return loadPoll(); })
      .catch(function (er) { B.poll = before; B.myVote = ''; renderDeck(); runTimer(); renderDecided(); say((er && er.userMessage) || 'Your vote did not go through. Nothing was charged. Try again.'); });
  }
  function loadPoll() {
    if (typeof W.getPoll !== 'function' || !B) return Promise.resolve();
    return Promise.resolve(W.getPoll(B)).then(function (p) { if (!p) return; B.poll = { a: +p.a || 0, b: +p.b || 0, locked: !!p.locked }; if (p.mine === 'a' || p.mine === 'b') B.myVote = p.mine; renderDeck(); runTimer(); renderDecided(); }).catch(function () {});
  }
  function loadJudge() {
    if (!B || B.type !== 'quick' || typeof W.getJudge !== 'function') return Promise.resolve();
    return Promise.resolve(W.getJudge(B)).then(function (j) { if (j) { B.judge = j; renderDecided(); } }).catch(function () {});
  }
  /* your battle: plain numbers, four decimals, no red for a result that is not a loss */
  function renderMine(m, sample) {
    var p = $('mine'); if (!m || !(+m.putInSol > 0 || +m.gotBackSol > 0)) { p.hidden = true; return; }
    var inS = +m.putInSol || 0, out = +m.gotBackSol || 0, d = out - inS;
    p.hidden = false; $('bmTag').hidden = !sample;
    $('bmBody').innerHTML = '<div class="bm-big"><div><span>You put in</span><b>' + sol(inS, 4) + '</b></div><div><span>You got back</span><b>' + sol(out, 4) + '</b></div><div><span>Difference</span><b' + (d > 0 ? ' class="up"' : '') + '>' + (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(4) + ' SOL</b></div></div>' +
      ((m.trades || []).length ? '<table><tbody>' + m.trades.slice(0, 8).map(function (t) { var k = t.side === 'b' ? 'b' : 'a'; return '<tr><th scope="row"><i class="k' + k + '" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px"></i>' + (t.buy === false ? 'Sold' : 'Bought') + ' ' + esc(name(k)) + '</th><td>' + (+t.tokens || 0).toFixed(0) + ' tokens</td><td>' + sol(t.sol, 4) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
      '<div class="bm-act"><button class="btn-primary" type="button" data-share="module" style="cursor:pointer;border:0">Share your battle</button></div>';
  }
  function loadMine() {
    if (!B || !ended()) { $('mine').hidden = true; return; }
    if (demo === 'ended') { renderMine({ putInSol: 0.1, gotBackSol: 0.124, trades: [{ side: 'b', buy: true, tokens: 1017, sol: 0.05 }, { side: 'b', buy: true, tokens: 608, sol: 0.05 }] }, true); return; }
    if (typeof W.getSummary !== 'function') return;
    Promise.resolve(W.getSummary(B)).then(function (m) { renderMine(m, false); }).catch(function () {});
  }
  $('bmBody').addEventListener('click', function (e) { if (e.target.closest('[data-share]')) openShare(); });
  /* live stream above the chart: Featured and Community battles, while the battle is live */
  var streamFor = '';
  function embedUrl(u) {
    try { var x = new URL(u), h = x.hostname.replace(/^www\./, ''), seg = x.pathname.split('/').filter(Boolean);
      if (h === 'twitch.tv' && seg[0]) return 'https://player.twitch.tv/?channel=' + encodeURIComponent(seg[0]) + '&parent=' + encodeURIComponent(location.hostname) + '&muted=true';
      if (h === 'kick.com' && seg[0]) return 'https://player.kick.com/' + encodeURIComponent(seg[0]) + '?muted=true';
      if (h === 'youtube.com' && x.searchParams.get('v')) return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(x.searchParams.get('v')) + '?mute=1';
      if (h === 'youtu.be' && seg[0]) return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(seg[0]) + '?mute=1';
    } catch (e) {} return '';
  }
  function renderStream() {
    var p = $('stream'), w = $('bsWrap'), views = $('ckViews'), link = httpsUrl(window.WW_STREAM_URL || B.streamLink), liveStream = link && B.type !== 'quick' && !ended(), em = liveStream ? embedUrl(link) : '';
    var flyer = B.type !== 'quick' ? httpsUrl(B.image) : '', key = em ? 's:' + em : flyer ? 'f:' + flyer : '';
    var had = !p.hidden; p.hidden = !key; views.classList.toggle('has-tv', !!key);
    if (had !== !!key) setTimeout(function () { drawChart(); fitGame(); }, 30);
    if (!key) { w.textContent = ''; streamFor = ''; return; }
    $('bsLink').hidden = !link; if (link) $('bsLink').href = link;
    $('tvLabel').innerHTML = em ? '<i></i>Live stream' : 'Battle flyer';
    if (streamFor === key) return; streamFor = key; w.textContent = '';
    if (em) { var f = document.createElement('iframe'); f.title = 'Live stream'; f.loading = 'lazy'; f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture'); f.setAttribute('allowfullscreen', ''); f.src = em; w.appendChild(f); }
    else { var im = document.createElement('img'); im.alt = 'Battle flyer'; im.referrerPolicy = 'no-referrer'; im.onerror = function () { p.hidden = true; views.classList.remove('has-tv'); drawChart(); }; im.src = flyer; w.appendChild(im); }
  }

  /* ---------- data ---------- */
  function normalize(x) {
    var end = Date.parse(x.endsAt), start = Date.parse(x.startedAt || x.createdAt) || (end - (x.battleDurationSeconds || 480) * 1000), same = B && B.id === x.battleId, stored = '';
    try { stored = sessionStorage.getItem('ww-vote-' + x.battleId) || ''; } catch (e) {}
    return { id: x.battleId, type: x.type || 'quick', a: x.artist1, b: x.artist2, start: start, end: end, winner: side(x.winnerSide), factors: x.factors || null, earnings: x.artistEarnings || null, sample: !!x.sample, round: null, image: x.imageUrl || '', settled: same ? B.settled : false, streamLink: x.streamLink || '', poll: same ? B.poll : (x.poll || null), myVote: same ? B.myVote : stored, judge: same ? B.judge : (x.judge || null) };
  }
  var viewSet = false;
  function paint() { renderDeck(); runTimer(); renderDecided(); renderRounds(); renderSides(); renderStream(); loadMine(); if (!viewSet) { viewSet = true; if (view !== 'chart') setView(view); } else sendGame(); }
  function fail() { $('ckBar').innerHTML = '<div class="cb-l"><span class="ld-live ended"><i></i>This battle did not load</span></div><div class="cb-c"></div><div class="cb-r"><a href="quick-battles.html" style="color:var(--brand-green)">See all battles</a></div>'; }
  function pick() {
    if (wantId) return jget(API + 'battles/' + wantId);
    return jget(API + 'stats').then(function (d) { var lb = (d.liveBattles && d.liveBattles[0]) || d.liveBattle; if (lb && lb.battleId && !demo) return jget(API + 'battles/' + lb.battleId); return jget(API + 'battles?limit=1').then(function (r) { var x = (r.battles || r)[0]; return jget(API + 'battles/' + x.battleId).catch(function () { return x; }); }); });
  }
  function load() {
    return pick().then(function (x) {
      if (!x || !x.artist1 || !x.artist2) throw 0;
      if (demo === 'live') { x = JSON.parse(JSON.stringify(x)); x.sample = true; x.winnerSide = null; x.factors = null; x.endsAt = new Date(Date.now() + 169000).toISOString(); x.createdAt = new Date(Date.now() - 311000).toISOString(); x.startedAt = null; x.artist1.poolSol = 24.1; x.artist2.poolSol = 18.75; x.artist1.volumeSol = 31.4; x.artist2.volumeSol = 22.9; x.artistEarnings = null; x.poll = { a: 14, b: 9, locked: false }; }
      if (demo === 'ended') { x = JSON.parse(JSON.stringify(x)); x.sample = true; x.type = 'quick'; x.factors = null; x.winnerSide = 'artist2'; x.artist1.poolSol = 0.0227; x.artist2.poolSol = 0.1084; x.poll = { a: 3, b: 5, locked: true }; x.judge = { status: 'ready', winner: 'a', confidence: 90, notes: 'Sample verdict. Track A is a raw lyrical exercise with a clear point of view. Track B is well produced but plays it safe. A brought the conviction.' }; }
      var first = !B; B = normalize(x);
      if (EV) setRound();
      paint();
      var key = B.id + ':' + B.a.poolSol + ':' + B.b.poolSol + ':' + ended();
      if (key !== lastKey) { lastKey = key; loadChart(); }
      loadPoll(); if (first) loadPos(); if (ended()) loadJudge();
      if (first && qs.get('launched')) { say('Your battle is live.', true); if (window.WWCelebrate) setTimeout(function () { WWCelebrate('wave'); }, 250); try { history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(B.id) + (demo ? '&demo=' + encodeURIComponent(demo) : '')); } catch (e) {} }
      if (first) { if (B.type === 'main') jget(API + 'events?limit=60').then(function (d) { EV = (d.events || []).filter(function (e) { return (e.rounds || []).some(function (r) { return String(r.battleId) === String(B.id); }); })[0] || null; if (EV && demo === 'live') { EV = JSON.parse(JSON.stringify(EV)); EV.winnerSide = null; EV.rounds.forEach(function (r) { if (String(r.battleId) === String(B.id)) { if (r.winnerSide && EV.roundsWon[r.winnerSide]) EV.roundsWon[r.winnerSide]--; r.winnerSide = null; r.live = true; r.artist1PoolSol = B.a.poolSol; r.artist2PoolSol = B.b.poolSol; } }); } if (EV) { setRound(); paint(); } }).catch(function () {}); }
      clearTimeout(poll); if (!ended() && demo !== 'live') poll = setTimeout(load, 30000);
      watchSettle();
    }).catch(function () { if (!B) fail(); });
  }
  function setRound() { var r = (EV.rounds || []).filter(function (r) { return String(r.battleId) === String(B.id); })[0]; B.round = r ? r.roundNumber : null; }
  load();
})();
</script>
'''

out = head.replace('<link rel="stylesheet" href="ww-base.css">', PAGE_CSS + '<link rel="stylesheet" href="ww-base.css">') if '</head>' in head else head.rstrip() + PAGE_CSS
out += '''<body data-page="battle">
  <!-- GENERATED from index.html by tools/build-battle-page.py. Edit the homepage or the generator, not this file. -->
  <div class="ambient-canvas"></div>
  <div class="grid-overlay"></div>

''' + nav + '\n\n  <main>\n' + BODY + '  </main>\n\n' + dialogs + footer + '\n\n' + \
    script('forms-js') + '\n' + script('mainnet-callout-js') + '\n' + PAGE_JS + '</body>\n</html>\n'
open('battle.html', 'w', encoding='utf-8').write(out)
print('battle.html', len(out))
