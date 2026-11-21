/* ==========================================================================
   Recording studio (#record) — a native Egyptian speaker records the course
   sentences in the browser. Each take is saved on the device (IndexedDB) and,
   once the recorder key is entered, cleaned up (silence trimmed, loudness evened
   out) and uploaded in the background through /api/rec, so it plays on the site
   for everyone within a minute. Export ZIP still works as a backup (see
   data-src/build_audio.js).
   The speaker can also flag a sentence whose Arabic looks wrong.
   The page is in Arabic + English, because it's for the Egyptian helper.
   ========================================================================== */
(window.KG_PLUGINS = window.KG_PLUGINS || []).push(function (A) {
  'use strict';
  const KG = window.KG;
  const { store, esc, toast } = A;

  /* ------------------------------ Sentences -------------------------------- */
  // Sets in course order; each item = one spoken chunk {key, tts}. Same chunking as the player.
  let SETS = null;
  function sets() {
    if (SETS) return SETS;
    SETS = [];
    const collect = (root) => {
      const seen = new Set(), out = [];
      KG.collectSpoken(root, (c) => { if (!seen.has(c.key)) { seen.add(c.key); out.push(c); } });
      return out;
    };
    A.LESSONS.forEach((l) => SETS.push({ id: 'l:' + l.id, name: l.num + ' ' + l.title, items: collect([l.ar, l.blocks, l.quiz]) }));
    (window.READERS || []).forEach((r) => SETS.push({ id: 'r:' + r.id, name: '📖 ' + (r.title || r.id), items: collect(r) }));
    SETS.push({ id: 'abc', name: '🔤 Stage titles, alphabet, cognates, Fusha table', items: collect([A.COURSE.stages.map((x) => x.ar), 'أهلاً! إزيك؟ عامل إيه النهارده؟~ahlan! izzayyak? 3aamil eeh innaharda?', window.ALPHABET, window.READ_DRILL, window.LINKS, window.LINK_FALSE, window.FUSHA_MAP]) });
    if (window.DROPS) SETS.push({ id: 'drops', name: '🃏 Word drops', items: collect(window.DROPS) });
    const lex = ((window.LEXICON && window.LEXICON.rows) || []).map((r) => (r[1] ? r[0] + '~' + r[1] : r[0]));
    for (let i = 0; i < lex.length; i += 150) SETS.push({ id: 'lex' + i, name: '📚 Dictionary ' + (i + 1) + '–' + Math.min(i + 150, lex.length), items: collect(lex.slice(i, i + 150)) });
    SETS = SETS.filter((s) => s.items.length);
    return SETS;
  }

  /* ------------------------------- Storage --------------------------------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((ok, bad) => {
      const r = indexedDB.open('masri-rec', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('rec', { keyPath: 'id' }); r.result.createObjectStore('flag', { keyPath: 'key' }); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => bad(r.error);
    });
    return dbp;
  }
  const tx = (store, mode, fn) => db().then((d) => new Promise((ok, bad) => {
    const t = d.transaction(store, mode), s = t.objectStore(store), res = fn(s);
    t.oncomplete = () => ok(res && res.result !== undefined ? res.result : res);
    t.onerror = () => bad(t.error);
  }));
  const put = (store, v) => tx(store, 'readwrite', (s) => s.put(v));
  const del = (store, k) => tx(store, 'readwrite', (s) => s.delete(k));
  const all = (store) => tx(store, 'readonly', (s) => s.getAll());

  /* --------------------------------- ZIP ----------------------------------- */
  // Minimal ZIP writer (stored, no compression — audio is already compressed).
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function zip(files) { // files: [{name, data: Uint8Array}]
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const le = (n, b) => { const a = new Uint8Array(b); for (let i = 0; i < b; i++) a[i] = (n >>> (8 * i)) & 0xff; return a; };
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const head = [le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(size, 4), le(size, 4), le(name.length, 2), le(0, 2), name];
      const headLen = head.reduce((n, x) => n + x.length, 0);
      parts.push(...head, f.data);
      central.push(le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(size, 4), le(size, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(offset, 4), name);
      offset += headLen + size;
    }
    const cdLen = central.reduce((n, x) => n + x.length, 0);
    const end = [le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(cdLen, 4), le(offset, 4), le(0, 2)];
    return new Blob([...parts, ...central, ...end], { type: 'application/zip' });
  }

  /* -------------------------------- Page ----------------------------------- */
  const EXT = (type) => (/mp4|aac|m4a/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : /mpeg/.test(type) ? 'mp3' : 'webm');
  const pickType = () => {
    if (!window.MediaRecorder) return '';
    return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  };

  /* ------------------------- Clean up + upload ---------------------------- */
  // Trim the silence at both ends (relative to this take's own loudness: quiet mics are common),
  // cut low rumble, bring the voice to a standard level, and re-encode at a small bitrate.
  // Same idea as data-src/build_audio.js does with ffmpeg. Any failure → the original take is used.
  async function polish(blob) {
    const AC = window.AudioContext || window.webkitAudioContext, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || !OAC || !window.MediaRecorder) return blob;
    const ac = new AC();
    try {
      const raw = await blob.arrayBuffer();
      const buf = await new Promise((ok, bad) => { const p = ac.decodeAudioData(raw, ok, bad); if (p && p.then) p.then(ok, bad); });
      const sr = buf.sampleRate, n = buf.length, mono = new Float32Array(n);
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let k = 0; k < n; k++) mono[k] += d[k] / buf.numberOfChannels; }
      const W = Math.round(sr * 0.02), F = Math.floor(n / W), db = new Float32Array(F);
      for (let f = 0; f < F; f++) { let e = 0; for (let k = f * W; k < (f + 1) * W; k++) e += mono[k] * mono[k]; db[f] = 10 * Math.log10(e / W + 1e-12); }
      const sorted = Array.from(db).sort((a, b) => a - b), floor = sorted[Math.floor(F * 0.1)], peak = sorted[F - 1];
      let start = 0, end = n / sr;
      if (F > 5 && peak - floor >= 12) {
        const thr = Math.max(floor + 10, peak - 35);
        let a = 0; while (a < F && db[a] <= thr) a++;
        let b = F - 1; while (b > a && db[b] <= thr) b--;
        start = Math.max(0, a * 0.02 - 0.12); end = Math.min(n / sr, (b + 1) * 0.02 + 0.18);
      }
      let sp = 0; for (let k = Math.floor(start * sr); k < Math.min(n, Math.ceil(end * sr)); k++) sp = Math.max(sp, Math.abs(mono[k]));
      const gainDb = Math.min(-16 - peak, -1 - 20 * Math.log10(sp + 1e-9), 30);
      const len = Math.max(1, Math.ceil((end - start) * sr));
      const off = new OAC(1, len, sr), src = off.createBufferSource(), hp = off.createBiquadFilter(), g = off.createGain();
      src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 70; g.gain.value = Math.pow(10, gainDb / 20);
      src.connect(hp); hp.connect(g); g.connect(off.destination); src.start(0, start, end - start);
      const out = await new Promise((ok, bad) => { off.oncomplete = (e) => ok(e.renderedBuffer); const p = off.startRendering(); if (p && p.then) p.then(ok, bad); });
      // re-encode by playing the cleaned take into a recorder (in real time, silently, while the next one is being read)
      const dest = ac.createMediaStreamDestination(), play = ac.createBufferSource();
      play.buffer = out; play.connect(dest);
      if (ac.state === 'suspended') await ac.resume();
      // AAC plays on every phone; Opus-in-MP4 (Chrome's default) doesn't on older iPhones, so it goes in WebM instead
      const type = ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
      if (!type) return blob;
      const mr = new MediaRecorder(dest.stream, { mimeType: type, audioBitsPerSecond: 64000 }), parts = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
      const done = new Promise((ok) => { mr.onstop = ok; });
      mr.start();
      await new Promise((ok) => setTimeout(ok, 80));
      play.onended = () => setTimeout(() => mr.stop(), 150);
      play.start();
      await done;
      const res = new Blob(parts, { type: mr.mimeType || type });
      return res.size > 1000 ? res : blob;
    } catch (e) { return blob; }
    finally { try { ac.close(); } catch (e) { /* ignore */ } }
  }
  const KEY_LS = 'masri-rec-key';
  const recKey = () => { try { return localStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } };
  async function upload(r) {
    const blob = await polish(r.blob);
    const res = await fetch('/api/rec', {
      method: 'POST',
      headers: { 'X-KG': '1', 'Content-Type': 'application/octet-stream', 'X-Rec-Key': recKey(), 'X-Rec-Id': r.id, 'X-Rec-Voice': r.voice, 'X-Rec-Text': encodeURIComponent(r.key), 'X-Rec-Type': (blob.type || r.type || '').split(';')[0] },
      body: blob
    });
    if (res.status === 401) throw Object.assign(new Error('key'), { fatal: true });
    if (res.status === 503) throw Object.assign(new Error('off'), { off: true });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  async function sendFlag(f, off) {
    if (!recKey()) return;
    fetch('/api/rec?flag=1', { method: 'POST', headers: { 'X-KG': '1', 'Content-Type': 'application/json', 'X-Rec-Key': recKey() }, body: JSON.stringify({ key: f.key, fix: f.fix || '', off: !!off }) }).catch(() => {});
  }

  function page() {
    const main = A.main();
    const st = store.d.settings;
    const voice = st.recVoice === 'm' ? 'm' : 'f';
    const S = sets();
    let setIdx = Math.max(0, S.findIndex((s) => s.id === st.recSet));
    let i = 0, recs = new Map(), flags = new Map(), media = null, rec = null, chunks = [], playing = null;
    const opt = (k, d) => (st[k] === undefined ? d : st[k]);
    let lastExport = 0;
    try { localStorage.setItem('masri-rec-used', '1'); lastExport = +localStorage.getItem('masri-rec-exported') || 0; } catch (e) { /* storage blocked */ }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // ask the browser not to evict recordings
    const ALL_KEYS = [...new Set(S.flatMap((x) => x.items.map((c) => c.key)))];
    // Upload queue: takes not yet uploaded (ones sent earlier by ZIP export don't need it)
    let busy = false, upErr = '', retry = null;
    const pending = () => [...recs.values()].filter((r) => !(r.up >= r.date) && r.date > lastExport);
    function upStatus() {
      const el = main.querySelector('#rec-up'); if (!el) return;
      const p = pending().length, up = [...recs.values()].filter((r) => r.up >= r.date).length;
      el.textContent = upErr && !busy ? upErr : !recKey() ? 'Not uploading — enter the key to send takes automatically (or use Export).'
        : upErr ? upErr : busy || p ? `Uploading… ${p} waiting · ${up} uploaded` : `✓ All takes uploaded (${up}) — they play on the site within a minute.`;
    }
    async function pump() {
      if (busy || !recKey() || !main.isConnected) return upStatus();
      const r = pending().sort((a, b) => a.date - b.date)[0];
      if (!r) return upStatus();
      busy = true; upStatus();
      const date = r.date;
      try {
        const j = await upload(r);
        upErr = '';
        const cur = recs.get(r.id);
        if (cur && cur.date === date) { cur.up = date; cur.upPath = j.path; await put('rec', cur); }  // re-recorded meanwhile → upload again
        busy = false; pump();
      } catch (e) {
        busy = false;
        upErr = e.fatal ? '✗ Wrong recorder key — check it and paste it again.'
          : e.off ? '⚠ Uploading is not switched on for the site yet — keep recording; takes will upload as soon as it is.'
          : '⚠ Upload failed (offline?) — will retry. Your takes are safe on this device.';
        upStatus();
        if (!e.fatal) { clearTimeout(retry); retry = setTimeout(pump, e.off ? 120000 : 20000); }
      }
    }
    window.addEventListener('online', pump);
    // the list of uploaded takes arrives a moment after the page opens
    const onVoice = () => { if (!main.contains(main.querySelector('.rec'))) return document.removeEventListener('kg-voice', onVoice); if (!rec && items()[i]) draw(); };
    document.addEventListener('kg-voice', onVoice);

    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Үн жазуу студиясы</h1><div class="kgt" lang="ar" translate="no">استوديو التسجيل</div>
      <p>Египеттик досуңуз курстагы сүйлөмдөрдү окуп жазып берсе, окуучулар жасалма эмес, чыныгы каирлик үндү угушат. Бул бет ага арналган (арабча жана англисче).</p></div></header>
      <div class="wrap rec" style="padding:30px 0 80px">
        <div class="rec-help" lang="ar" translate="no" dir="rtl">
          <p><b>أهلاً بيك! شكراً إنك بتساعدنا.</b> اقرا كل جملة بالعامية المصرية زي ما بتتكلم عادي، بصوت واضح وهادي، في مكان مافيهوش دوشة. لو الجملة مكتوبة غلط، دوس «⚑» واكتب الصح.</p>
          <p dir="ltr" lang="en" style="text-align:left"><b>Thank you for helping!</b> Read each sentence in everyday Cairene Arabic, the way you'd naturally say it — clearly, at a calm pace, in a quiet room. Keys: <kbd>Space</kbd> record/stop · <kbd>P</kbd> play · <kbd>Enter</kbd> next · <kbd>Backspace</kbd> previous. If the Arabic looks wrong, press ⚑ and type the correction. With the recorder key entered, every take is cleaned up and uploaded automatically and plays on the site within a minute. Without it, recordings stay on this device until you press <b>Export</b> and send the ZIP to the site owner.</p>
        </div>
        <div class="rec-bar">
          <label>Set: <select id="rec-set">${S.map((s, k) => `<option value="${k}" ${k === setIdx ? 'selected' : ''}>${esc(s.name)} (${s.items.length})</option>`).join('')}</select></label>
          <label>Voice / الصوت: <select id="rec-voice"><option value="f" ${voice === 'f' ? 'selected' : ''}>female / ست</option><option value="m" ${voice === 'm' ? 'selected' : ''}>male / راجل</option></select></label>
          <button class="btn btn-line btn-sm" id="rec-jump">⏭ Next unrecorded</button>
          <button class="btn btn-ink btn-sm" id="rec-export-new">⬇ Export new</button>
          <button class="btn btn-line btn-sm" id="rec-export">⬇ Export all</button>
        </div>
        <div class="rec-bar">
          <label><input type="checkbox" id="rec-autonext" ${opt('recAutoNext', true) ? 'checked' : ''}> Auto-next after recording · التالي تلقائي</label>
          <label><input type="checkbox" id="rec-autoplay" ${opt('recAutoPlay', false) ? 'checked' : ''}> Play back after recording · اسمع بعد التسجيل</label>
          <label><input type="checkbox" id="rec-ns" ${opt('recNoise', false) ? 'checked' : ''}> Noise reduction (only if the room is noisy)</label>
        </div>
        <div class="rec-bar rec-cloud">
          <label>☁ Recorder key: <input id="rec-key" type="password" autocomplete="off" spellcheck="false" placeholder="paste the key once" style="width:14em"></label>
          <span id="rec-up" class="muted" role="status"></span>
        </div>
        <div class="rec-progress"><div class="rec-meter"><span id="rec-meter"></span></div><span id="rec-total" class="muted"></span></div>
        <div class="rec-card">
          <div class="rec-pos muted" id="rec-pos"></div>
          <div class="rec-text" lang="ar" translate="no" dir="rtl" id="rec-text"></div>
          <div class="rec-tl" translate="no" id="rec-tl"></div>
          <div class="rec-ctl">
            <button class="btn btn-line" id="rec-prev" title="Backspace">→ السابق</button>
            <button class="btn rec-btn" id="rec-go" title="Space">● تسجيل · Record</button>
            <button class="btn btn-line" id="rec-play" title="P" disabled>▶ اسمع · Play</button>
            <button class="btn btn-line" id="rec-next" title="Enter">التالي ←</button>
          </div>
          <div class="rec-flag"><button class="btn btn-line btn-sm" id="rec-flag">⚑ الجملة فيها غلط · Text is wrong</button>
            <input id="rec-fix" lang="ar" translate="no" dir="rtl" placeholder="اكتب الجملة الصح هنا · type the correct sentence" hidden></div>
          <div class="rec-status muted" id="rec-status" role="status"></div>
        </div>
        <ol class="rec-list" id="rec-list"></ol>
      </div>`;
    const $ = (s) => main.querySelector(s);
    const items = () => S[setIdx].items;
    const idOf = (c) => KG.audioId(voice, c.key);

    function drawList() {
      $('#rec-list').innerHTML = items().map((c, k) => `<li class="${recs.has(idOf(c)) || KG.speech.published(idOf(c)) ? 'done' : ''} ${flags.has(c.key) ? 'flag' : ''} ${k === i ? 'cur' : ''}" data-k="${k}" lang="ar" translate="no" dir="rtl">${esc(c.show || c.key.split('~')[0])}</li>`).join('');
      const doneHere = items().filter((c) => recs.has(idOf(c))).length;
      const doneAll = ALL_KEYS.filter((k) => recs.has(KG.audioId(voice, k)) || KG.speech.published(KG.audioId(voice, k))).length;
      const fresh = [...recs.values()].filter((r) => r.date > lastExport).length;
      $('#rec-total').textContent = `This set: ${doneHere}/${items().length} · Whole course: ${doneAll}/${ALL_KEYS.length} (${Math.floor(doneAll / ALL_KEYS.length * 100)}%)` + (fresh ? ` · ${fresh} not exported yet` : '');
      $('#rec-meter').style.width = (doneAll / ALL_KEYS.length * 100).toFixed(1) + '%';
      $('#rec-export-new').disabled = !fresh;
    }
    function draw() {
      const c = items()[i];
      $('#rec-pos').textContent = `${i + 1} / ${items().length}`;
      $('#rec-text').textContent = c.show || c.key.split('~')[0];
      $('#rec-tl').textContent = KG.roOf(c.key) ? KG.toLat(KG.roOf(c.key)) : '';
      $('#rec-play').disabled = !recs.has(idOf(c)) && !KG.speech.published(idOf(c));
      $('#rec-fix').hidden = !flags.has(c.key);
      $('#rec-fix').value = flags.has(c.key) ? flags.get(c.key).fix || '' : '';
      $('#rec-status').textContent = recs.has(idOf(c)) ? '✓ recorded — press Space to record again' : KG.speech.published(idOf(c)) ? '✓ already on the site — record again to replace it' : '';
      drawList();
      const cur = $('#rec-list .cur'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    function move(d) { if (rec) return; i = Math.max(0, Math.min(items().length - 1, i + d)); draw(); }
    function play() {
      const c = items()[i], r = recs.get(idOf(c));
      if (!r) { if (KG.speech.published(idOf(c))) KG.speech.say(c.key); return; }
      if (playing) { playing.pause(); URL.revokeObjectURL(playing.src); }
      playing = new Audio(URL.createObjectURL(r.blob)); playing.play();
    }
    async function toggle() {
      if (rec) { rec.stop(); return; }
      const type = pickType();
      if (!type) { $('#rec-status').textContent = 'This browser cannot record audio. Try Chrome, Edge or Safari.'; return; }
      // Clean voice: no echo cancellation / auto gain (they colour the voice); levels are evened out on import.
      try { media = media || await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, autoGainControl: false, noiseSuppression: !!opt('recNoise', false) } }); }
      catch (e) { $('#rec-status').textContent = 'Microphone permission was refused / الميكروفون مقفول'; return; }
      const c = items()[i];
      chunks = [];
      rec = new MediaRecorder(media, { mimeType: type });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: rec.mimeType || type });
        rec = null;
        $('#rec-go').classList.remove('on'); $('#rec-go').textContent = '● تسجيل · Record';
        if (blob.size < 2000) { $('#rec-status').textContent = 'Too short — try again'; return; }
        const r = { id: idOf(c), key: c.key, voice, type: blob.type, blob, date: Date.now() };
        await put('rec', r); recs.set(r.id, r);
        pump();
        KG.speech.addLocal(r.id, blob); KG.speech.refresh(); // learners' pages on this device can preview it right away
        if (opt('recAutoPlay', false)) play();
        if (opt('recAutoNext', true) && i < items().length - 1) i++;
        draw();
      };
      rec.start();
      $('#rec-go').classList.add('on'); $('#rec-go').textContent = '■ وقف · Stop';
      $('#rec-status').textContent = 'Recording… / بيسجل…';
    }
    async function exportZip(onlyNew) {
      const list = [...recs.values()].filter((r) => !onlyNew || r.date > lastExport);
      if (!list.length && !flags.size) { toast('Nothing recorded yet.'); return; }
      $('#rec-status').textContent = 'Preparing ZIP…';
      const files = [];
      for (const r of list) files.push({ name: r.id + '.' + EXT(r.type), data: new Uint8Array(await r.blob.arrayBuffer()) });
      const enc = new TextEncoder();
      files.push({ name: 'recordings.tsv', data: enc.encode('id\tvoice\tkey\n' + list.map((r) => [r.id, r.voice, r.key].join('\t')).join('\n') + '\n') });
      if (flags.size) files.push({ name: 'text-corrections.tsv', data: enc.encode('key\tcorrection\n' + [...flags.values()].map((f) => [f.key, f.fix || ''].join('\t')).join('\n') + '\n') });
      const blob = await zip(files);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'masri-recordings-' + new Date().toISOString().slice(0, 10) + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      lastExport = Date.now();
      try { localStorage.setItem('masri-rec-exported', String(lastExport)); } catch (e) { /* ignore */ }
      $('#rec-status').textContent = `Exported ${list.length} recordings.` + (recKey() ? ' (Takes are also uploaded automatically.)' : ' Send the ZIP to the site owner.');
      drawList();
    }

    $('#rec-set').addEventListener('change', (e) => { setIdx = +e.target.value; st.recSet = S[setIdx].id; store.save(); i = 0; draw(); });
    $('#rec-voice').addEventListener('change', (e) => { st.recVoice = e.target.value; store.save(); page(); });
    $('#rec-go').addEventListener('click', toggle);
    $('#rec-play').addEventListener('click', play);
    $('#rec-next').addEventListener('click', () => move(1));
    $('#rec-prev').addEventListener('click', () => move(-1));
    $('#rec-export').addEventListener('click', () => exportZip(false));
    $('#rec-export-new').addEventListener('click', () => exportZip(true));
    $('#rec-jump').addEventListener('click', () => {
      if (rec) return;
      for (let n = 0; n < S.length; n++) {
        const si = (setIdx + n) % S.length, from = n === 0 ? i + 1 : 0;
        const k = S[si].items.findIndex((c, idx) => idx >= from && !recs.has(idOf(c)) && !KG.speech.published(idOf(c)));
        if (k >= 0) { setIdx = si; i = k; st.recSet = S[si].id; store.save(); $('#rec-set').value = String(si); draw(); return; }
      }
      toast('Everything is recorded! 🎉');
    });
    [['#rec-autonext', 'recAutoNext'], ['#rec-autoplay', 'recAutoPlay'], ['#rec-ns', 'recNoise']].forEach(([sel, key]) => $(sel).addEventListener('change', (e) => {
      st[key] = e.target.checked; store.save();
      if (key === 'recNoise' && media) { media.getTracks().forEach((t) => t.stop()); media = null; }
    }));
    $('#rec-list').addEventListener('click', (e) => { const li = e.target.closest('li[data-k]'); if (li && !rec) { i = +li.dataset.k; draw(); } });
    $('#rec-flag').addEventListener('click', async () => {
      const c = items()[i];
      if (flags.has(c.key)) { await del('flag', c.key); sendFlag(flags.get(c.key), true); flags.delete(c.key); }
      else { const f = { key: c.key, fix: '' }; await put('flag', f); flags.set(c.key, f); sendFlag(f); }
      draw(); if (flags.has(c.key)) $('#rec-fix').focus();
    });
    $('#rec-fix').addEventListener('change', async (e) => { const c = items()[i], f = { key: c.key, fix: e.target.value.trim() }; await put('flag', f); flags.set(c.key, f); sendFlag(f); });
    $('#rec-key').value = recKey();
    $('#rec-key').addEventListener('change', async (e) => {
      const k = e.target.value.trim();
      if (!k) { try { localStorage.removeItem(KEY_LS); } catch (x) { /* ignore */ } upErr = ''; upStatus(); return; }
      const r = await fetch('/api/rec?check=1', { headers: { 'X-Rec-Key': k } }).catch(() => null);
      if (r && r.status === 401) { upErr = '✗ That key is not right.'; upStatus(); return; }
      if (r && r.status === 503) { try { localStorage.setItem(KEY_LS, k); } catch (x) { /* ignore */ } upErr = '⚠ Uploading is not switched on for the site yet — the key is saved; takes will upload as soon as it is.'; upStatus(); return; }
      try { localStorage.setItem(KEY_LS, k); } catch (x) { /* ignore */ }
      upErr = r && r.ok ? '' : '⚠ Could not check the key right now (offline?) — saved, will try to upload.';
      flags.forEach((f) => sendFlag(f));
      pump();
    });
    const onKey = (e) => {
      if (!document.body.contains(main.querySelector('.rec'))) { document.removeEventListener('keydown', onKey); if (media) media.getTracks().forEach((t) => t.stop()); return; }
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'Enter') { e.preventDefault(); move(1); }
      else if (e.key === 'Backspace') { e.preventDefault(); move(-1); }
      else if (e.key === 'p' || e.key === 'P') play();
    };
    document.addEventListener('keydown', onKey);

    Promise.all([all('rec'), all('flag')]).then(async ([r, f]) => {
      // Migrate recordings made under older sentence rules (e.g. «X.» and «X» now share one id)
      for (const x of r) {
        const key = KG.normKey(x.key), id = KG.audioId(x.voice || 'f', key);
        if (id !== x.id) {
          await del('rec', x.id);
          const prev = r.find((y) => y.id === id) || recs.get(id);
          if (!prev || prev.date < x.date) { x.id = id; x.key = key; await put('rec', x); } else continue;
        }
        if (!recs.has(x.id) || recs.get(x.id).date < x.date) recs.set(x.id, x);
      }
      f.forEach((x) => flags.set(x.key, x));
      const first = items().findIndex((c) => !recs.has(idOf(c)) && !KG.speech.published(idOf(c))); i = first < 0 ? 0 : first;
      draw(); pump();
    }).catch(() => { $('#rec-status').textContent = 'Storage is blocked in this browser (private mode?).'; draw(); });
  }

  A.ROUTES.record = page;
  A.TITLES.record = 'Үн жазуу студиясы';
  A.zipFiles = zip; // used by tests
  A.recPolish = polish;
  A.recordSets = sets;
});
