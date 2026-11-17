#!/usr/bin/env python3
"""Builds audius-connect.html. It reuses the <head> (fonts, tokens, base styles) of audius-search.html so the artist flow
always matches the battle setup page. Run again after changing the setup page styles:

    python3 tools/build-audius-connect.py
"""
import os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
src = open('audius-search.html', encoding='utf-8').read()
head = src[:src.index('</style>')]
head = re.sub(r'<title>.*?</title>', '<title>Connect your Audius catalog | WaveWarZ</title>', head, count=1)
bg = src[src.index('<div class="wid-page"'):src.index('<div class="scroller"')]

CSS = r'''
/* ---- artist Audius flow (this page only) ---- */
.scroller{padding-bottom:var(--space-8)}
.ac{position:relative;margin-top:var(--space-5);border:1px solid var(--line);border-radius:var(--radius-xl);background:radial-gradient(60% 70% at 0% 0%,rgba(149,254,124,.09),transparent 70%),radial-gradient(60% 70% at 100% 0%,rgba(126,193,251,.09),transparent 70%),var(--stage);padding:var(--space-5);overflow:hidden}
.ac-rail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--space-2);margin:0 0 var(--space-5);padding:0;list-style:none;counter-reset:s}
.ac-rail li{position:relative;display:grid;gap:6px;padding-top:14px;font:500 12px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted);counter-increment:s}
.ac-rail li::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;border-radius:2px;background:var(--line);transition:background-color .3s ease}
.ac-rail li b{font:700 12px var(--font-mono);color:var(--ink-muted)}.ac-rail li b::before{content:"0" counter(s)}
.ac-rail li.done{color:var(--ink)}.ac-rail li.done::before{background:linear-gradient(145deg,#f6fbff,#aebccb 30%,#5a6b7e 60%,#dbe6ef)}
.ac-rail li.on{color:var(--green-ink)}.ac-rail li.on::before{background:var(--green);box-shadow:var(--glow-green)}.ac-rail li.on b{color:var(--green-ink)}
.ac-step{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:var(--space-6);align-items:center;min-height:300px;animation:acIn .32s cubic-bezier(.2,.8,.2,1)}
@keyframes acIn{from{opacity:0;transform:translateY(10px)}}
.ac-step h2:focus{outline:none}
.ac-step h2{font:700 clamp(26px,3.6vw,38px)/1.05 var(--font-display);letter-spacing:-.015em;margin:var(--space-2) 0 var(--space-3);text-wrap:balance}
.ac-step p{color:var(--ink);opacity:.86;margin:0 0 var(--space-4);max-width:52ch;line-height:1.6}
.ac-step .fine{font-size:13px;color:var(--ink-muted);opacity:1}
.ac-acts{display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;margin-top:var(--space-4)}
.ac-btn{font:700 15px var(--font-display);letter-spacing:.06em;text-transform:uppercase;height:56px;padding:0 var(--space-6);border-radius:var(--radius-lg);border:0;background:var(--green);color:var(--on-green);cursor:pointer;display:inline-flex;gap:var(--space-3);align-items:center;justify-content:center;text-decoration:none;transition:background-color .2s ease,transform .2s ease}
.ac-btn:hover{background:#b6ffa4;transform:translateY(-1px)}.ac-btn:disabled{background:var(--bg-raised);color:var(--ink-muted);cursor:not-allowed;transform:none}
.ac-btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line);font:600 14px var(--font-sans);letter-spacing:0;text-transform:none}.ac-btn.ghost:hover{border-color:var(--blue-ink);color:var(--blue-ink);background:transparent}
.ac-back{background:none;border:0;padding:0;color:var(--ink-muted);font:500 14px var(--font-sans);cursor:pointer;text-decoration:underline;text-underline-offset:3px}.ac-back:hover{color:var(--ink)}
.ac-art{position:relative;aspect-ratio:1/.86;border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;background:#04070d}
.ac-art::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(126,193,251,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(126,193,251,.08) 1px,transparent 1px);background-size:32px 32px;background-position:center}
.ac-art img{position:absolute;left:50%;top:50%;width:96%;aspect-ratio:1;object-fit:cover;transform:translate(-50%,-50%) scale(1.5);mix-blend-mode:screen;filter:saturate(1.25) contrast(1.15) brightness(1.25);-webkit-mask-image:radial-gradient(closest-side,#000 52%,transparent 100%);mask-image:radial-gradient(closest-side,#000 52%,transparent 100%)}
.ac-call{position:absolute;font:500 10px/1.4 var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:#d7fbf4;background:rgba(95,211,193,.08);border:1px solid rgba(95,211,193,.5);border-radius:5px;padding:5px 8px;backdrop-filter:blur(3px);max-width:60%}
.ac-call b{font-weight:500;color:#fff;display:block}
.ac-call.a{left:5%;top:10%}.ac-call.b{right:5%;bottom:12%}
.ac-terms{max-height:176px;overflow:auto;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--bg);padding:var(--space-4);font-size:14px;line-height:1.6;color:var(--ink);opacity:.9}
.ac-terms p{margin:0 0 var(--space-3);max-width:none}.ac-terms p:last-child{margin:0}
.ac-ck{display:grid;grid-template-columns:22px 1fr;gap:var(--space-3);align-items:start;margin-top:var(--space-4);font-size:14px;line-height:1.5;cursor:pointer}
.ac-ck input{width:20px;height:20px;margin:1px 0 0;accent-color:#95fe7c}
.ac-err{margin:var(--space-3) 0 0;color:var(--danger);font-size:14px}.ac-err:empty{display:none}
.ac-who{display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-4);align-items:center;margin:0 0 var(--space-4);font:500 12px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted)}
.ac-who b{color:var(--green-ink);font-weight:500}
.ac-cat{margin-top:var(--space-6)}
.ac-cat h2{font:700 24px var(--font-display);margin:0 0 4px}
.ac-cat .song{grid-template-columns:64px minmax(0,1.2fr) minmax(0,1.4fr) auto}
.ac-cat .cover{background:linear-gradient(150deg,rgba(126,193,251,.25),var(--bg-raised) 60%,rgba(149,254,124,.2))}
.ac-ok{font:500 12px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--green-ink);border:1px solid rgba(149,254,124,.4);border-radius:var(--radius-pill);padding:6px 12px;white-space:nowrap}
.ac-emp{border:1px dashed var(--line);border-radius:var(--radius-lg);padding:var(--space-6);text-align:center;color:var(--ink-muted)}
.ac-emp b{display:block;color:var(--ink);font:700 18px var(--font-display);margin-bottom:6px}
@media(max-width:820px){.ac-step{grid-template-columns:1fr}.ac-art{display:none}.ac-rail li span{display:none}.ac-btn{width:100%}}
@media(max-width:760px){.ac-cat .song{grid-template-columns:56px minmax(0,1fr) auto;grid-template-areas:"c m a" "w w w"}}
@media(prefers-reduced-motion:reduce){.ac-step{animation:none}}
'''

BODY = r'''
<div class="scroller" id="scroller"><div class="page ww-under-nav">

<div class="eyebrow"><i></i><span class="label">For artists on Audius</span></div>
<h1>Get your catalog <em>battle-ready.</em></h1>
<p class="sub">Connect once. Every public song on your Audius profile can enter Quick BattleZ.</p>

<section class="ac" aria-label="Connect your Audius catalog">
 <ol class="ac-rail" id="rail" aria-label="Steps">
  <li><b></b><span>Connect wallet</span></li><li><b></b><span>Confirm your rights</span></li><li><b></b><span>Connect Audius</span></li><li><b></b><span>Your catalog</span></li>
 </ol>
 <div id="step" aria-live="polite"></div>
</section>

<section class="ac-cat" id="cat" hidden aria-label="Your catalog on WaveWarZ"></section>

@@FOOT@@
</div></div>
<div id="toast" role="status" hidden style="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;background:var(--bg-raised);border:1px solid var(--line);border-radius:var(--radius-pill);padding:12px 20px;font-size:14px;box-shadow:var(--lift);max-width:calc(100vw - 32px)"></div>
'''

JS = r'''<script>
/* Artist Audius flow: wallet, rights, Audius sign-in, catalog.
   The real calls are four functions on window.WW, each returning a Promise:
     WW.connectWallet()                 -> { address }
     WW.connectAudius({ address })      -> { handle }            (Audius sign-in, then link the profile to this wallet)
     WW.getMyCatalog({ address })       -> { linked, handle, tracks: [{ audius_track_id, title, duration_seconds, artwork_url, genre }] }
     WW.resyncCatalog({ address })      -> same shape as getMyCatalog
   Without them the page runs as a preview on sample songs and says so. ?step=1..4 and ?state=empty|unlinked open a state for review. */
(function(){
 'use strict';
 var $=function(i){return document.getElementById(i)},W=window.WW=window.WW||{},qs=new URLSearchParams(location.search);
 var live={wallet:typeof W.connectWallet==='function',audius:typeof W.connectAudius==='function',cat:typeof W.getMyCatalog==='function',sync:typeof W.resyncCatalog==='function'};
 var st={step:1,address:'',agreed:false,handle:'',tracks:null,linked:false,busy:false,err:''};
 function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}
 function short(a){return a?a.slice(0,4)+'…'+a.slice(-4):''}
 function fmt(s){s=Math.round(s||0);return Math.floor(s/60)+':'+('0'+s%60).slice(-2)}
 function say(m){var e=$('toast');e.textContent=m;e.hidden=false;clearTimeout(say.t);say.t=setTimeout(function(){e.hidden=true},4200)}
 function wait(ms,v){return new Promise(function(r){setTimeout(function(){r(v)},ms)})}
 function sample(){return fetch('audius-catalog.sample.json').then(function(r){return r.json()}).then(function(d){var by={};d.tracks.forEach(function(t){(by[t.artist_handle]=by[t.artist_handle]||[]).push(t)});var h=Object.keys(by).sort(function(a,b){return by[b].length-by[a].length})[0];return {linked:true,handle:h,tracks:by[h]}})}
 var api={
  wallet:function(){return live.wallet?W.connectWallet():wait(700,{address:'Prev1ewWa11etAddre55xxxxxxxxxxxxxxxxxxxxxxxx'})},
  audius:function(){return live.audius?W.connectAudius({address:st.address}):wait(900,{handle:''})},
  cat:function(){if(qs.get('state')==='unlinked')return wait(300,{linked:false,tracks:[]});if(qs.get('state')==='empty')return wait(300,{linked:true,handle:'yourname',tracks:[]});return live.cat?W.getMyCatalog({address:st.address}):sample()},
  sync:function(){return live.sync?W.resyncCatalog({address:st.address}):wait(900).then(api.cat)}
 };
 var preview=!(live.wallet&&live.audius&&live.cat);
 function art(a,b){return '<div class="ac-art" aria-hidden="true"><img src="wave-id/wave-id-'+a+'.jpeg" alt="">'+b+'</div>'}
 function call(c,k,v){return '<div class="ac-call '+c+'">'+k+'<b>'+v+'</b></div>'}
 var TERMS='<p>By connecting my Audius profile, I represent and warrant that I am the rights holder (or have obtained all necessary rights, licenses, and permissions) for the music and content in my Audius catalog. I grant WaveWarZ a non-exclusive, worldwide, royalty-free license to use, display, transmit, and publicly perform this content in connection with WaveWarZ products and services, including but not limited to music battles and promotional materials.</p><p>I understand and agree that WaveWarZ does not verify my rights to this content and is not responsible or liable for any claims arising from my use of third-party content without proper authorization. I accept full responsibility and liability for any such claims, damages, or disputes.</p>';
 function view(){
  var s=st.step,h='';
  if(s===1)h='<div><span class="label">Step 1 of 4</span><h2>Connect your wallet.</h2><p>Use the Solana wallet you want your artist payouts sent to. If your Audius profile already has a wallet, use that one.</p><p class="fine">Any Solana wallet works. Connecting is free and never moves funds.</p><div class="ac-acts"><button class="ac-btn" id="a1" type="button">Connect wallet</button></div><p class="ac-err" id="err"></p></div>'+art('green',call('a','Payouts','Sent to this wallet')+call('b','Cost','Free'));
  if(s===2)h='<div><span class="label">Step 2 of 4</span><h2>Confirm the music is yours.</h2><div class="ac-terms" tabindex="0" aria-label="Rights terms">'+TERMS+'</div><label class="ac-ck"><input type="checkbox" id="agree"'+(st.agreed?' checked':'')+'><span>I have read and agree to these terms, and I confirm I have the rights to connect this music to WaveWarZ.</span></label><div class="ac-acts"><button class="ac-btn" id="a2" type="button"'+(st.agreed?'':' disabled')+'>Continue</button><button class="ac-back" id="back" type="button">Back</button></div></div>'+art('ice',call('a','You keep','Your rights')+call('b','License','Non-exclusive'));
  if(s===3)h='<div><span class="label">Step 3 of 4</span><h2>Connect Audius.</h2><p>Sign in on Audius and you come straight back here. WaveWarZ reads your public profile and songs. It cannot post, upload or change anything.</p><p class="fine">Songs must be public and playable on Audius. Paywalled and follower-only songs are skipped.</p><div class="ac-acts"><button class="ac-btn" id="a3" type="button">Connect Audius</button><button class="ac-back" id="back" type="button">Back</button></div><p class="ac-err" id="err"></p></div>'+art('aqua',call('a','Access','Read only')+call('b','Songs','Public ones'));
  if(s===4){
   var n=(st.tracks||[]).length;
   if(!st.linked)h='<div><span class="label">Step 4 of 4</span><h2>This wallet is not linked to Audius yet.</h2><p>Connect Audius with this wallet and your songs show up here. If you used a different wallet before, switch to that one.</p><div class="ac-acts"><button class="ac-btn" id="relink" type="button">Connect Audius</button><button class="ac-back" id="restart" type="button">Use a different wallet</button></div></div>'+art('ice',call('a','Wallet',esc(short(st.address)))+call('b','Audius','Not linked'));
   else h='<div><span class="label">Step 4 of 4</span><h2>'+(n?'Your catalog is battle-ready.':'You are connected.')+'</h2><p>'+(n?n+' '+(n===1?'song is':'songs are')+' in the WaveWarZ catalog. Anyone can pick them for a Quick Battle, and you are paid on every trade.':'No public songs were found on your profile yet. Upload one on Audius, then resync.')+'</p><div class="ac-acts"><a class="ac-btn" href="audius-search.html">Create a Quick Battle</a><button class="ac-btn ghost" id="sync" type="button">Resync Audius songs</button></div><p class="fine" style="margin-top:var(--space-4)">Released something new? Resync and it appears here.</p></div>'+art('green',call('a','Audius','@'+esc(st.handle||'you'))+call('b','Songs',String(n)));
  }
  $('step').innerHTML='<div class="ac-step">'+h+'</div>';
  [].forEach.call($('rail').children,function(li,i){li.className=i+1<s?'done':i+1===s?'on':''});
  $('wallet').textContent=st.address?short(st.address):'Connect wallet';
  catalog();
 }
 function catalog(){
  var c=$('cat'),L=st.tracks||[];
  if(st.step!==4||!st.linked){c.hidden=true;return}
  c.hidden=false;
  c.innerHTML='<div class="ac-who"><span>Wallet <b>'+esc(short(st.address))+'</b></span><span>Audius <b>@'+esc(st.handle||'')+'</b></span>'+(preview?'<span>Preview on sample songs</span>':'')+'</div><h2>My catalog</h2><p class="sub">The songs from your Audius profile that can enter battles.</p>'+
   (L.length?L.map(function(t){return '<div class="song"><div class="cover">'+(t.artwork_url?'<img class="cvimg" src="'+esc(t.artwork_url)+'" alt="" loading="lazy" onerror="this.remove()">':'')+'</div><div class="meta"><div class="title" title="'+esc(t.title)+'">'+esc(t.title)+'</div><div class="artist">@'+esc(t.artist_handle||st.handle)+'</div>'+(t.genre?'<div class="mline"><span class="tg">'+esc(t.genre)+'</span></div>':'')+'</div><div class="wf"><span class="dur">'+fmt(t.duration_seconds)+'</span></div><div class="addwrap"><span class="ac-ok">Battle-ready</span></div></div>'}).join('')
    :'<div class="ac-emp"><b>No public songs yet.</b>Upload a song on Audius and make it public, then press Resync.</div>');
 }
 function go(n){st.step=n;st.err='';view();var h=document.querySelector('.ac-step h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}
 function fail(m){var e=$('err');if(e)e.textContent=m}
 function run(btn,label,p,ok){if(st.busy)return;st.busy=true;var old=btn.textContent;btn.disabled=true;btn.textContent=label;
  Promise.resolve().then(p).then(ok).catch(function(e){btn.disabled=false;btn.textContent=old;fail((e&&e.userMessage)||'That did not go through. Try again.')}).then(function(){st.busy=false})}
 function loadCat(r){st.linked=!!r.linked;st.handle=r.handle||st.handle;st.tracks=r.tracks||[];go(4)}
 document.addEventListener('click',function(e){var t=e.target.closest('button');if(!t)return;
  if(t.id==='a1'||t.id==='wallet'){if(st.address&&t.id==='wallet')return;run(t,'Waiting for your wallet…',api.wallet,function(r){st.address=r.address;
    /* a wallet that is already linked goes straight to its catalog */
    return Promise.resolve(live.cat?api.cat():{linked:false}).then(function(c){if(c&&c.linked)loadCat(c);else go(2)})})}
  else if(t.id==='a2'){if(st.agreed)go(3)}
  else if(t.id==='back'){go(st.step-1)}
  else if(t.id==='a3'||t.id==='relink'){run(t,'Opening Audius…',api.audius,function(r){st.handle=(r&&r.handle)||st.handle;return api.cat().then(function(c){if(!live.audius&&qs.get('state')!=='unlinked')c.linked=true;loadCat(c)})})}
  else if(t.id==='restart'){st.address='';st.tracks=null;st.linked=false;go(1)}
  else if(t.id==='sync'){run(t,'Resyncing…',api.sync,function(r){st.linked=!!r.linked;st.handle=r.handle||st.handle;st.tracks=r.tracks||[];view();say('Catalog updated. '+st.tracks.length+' '+(st.tracks.length===1?'song':'songs')+'.')})}
 });
 document.addEventListener('change',function(e){if(e.target.id==='agree'){st.agreed=e.target.checked;$('a2').disabled=!st.agreed}});
 /* review states */
 var want=+qs.get('step');
 if(want>=2&&want<=4){st.address='Prev1ewWa11etAddre55xxxxxxxxxxxxxxxxxxxxxxxx';st.agreed=want>2;if(want===4){api.cat().then(function(c){if(qs.get('state')!=='unlinked')c.linked=true;loadCat(c)});}else go(want)}
 else view();
})();
</script>
'''
# site nav and footer: the same ones as the setup page, with this page's own action and current link
NAV = src[src.index('<div class="nav-wrapper">'):src.index('</nav></div>') + len('</nav></div>')]
NAV = NAV.replace(' aria-current="page"', '')
NAV = re.sub(r'<div class="nav-actions">.*</div></nav></div>$', '<div class="nav-actions"><button class="ww-btn solid" id="wallet" type="button">Connect wallet</button></div></nav></div>', NAV, flags=re.S)
FOOT = re.search(r'<footer class="ww-foot">.*?</footer>', src, re.S).group(0)
BODY = BODY.replace('@@FOOT@@', FOOT)
out = head + CSS + '</style><link rel="stylesheet" href="ww-base.css">\n</head><body class="ww-flow">\n' + NAV + '\n' + bg + BODY + JS + '</body></html>\n'
open('audius-connect.html', 'w', encoding='utf-8').write(out)
print('audius-connect.html', len(out))
