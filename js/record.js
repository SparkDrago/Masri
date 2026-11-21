/* ==========================================================================
   Recording studio (#record) — a native Egyptian speaker records the course
   sentences in the browser. Recordings stay on that device (IndexedDB) until
   exported as a ZIP of <audio id>.<ext> files, which go into /audio and win
   over any generated file with the same id (see data-src/build_audio.js).
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
    const CYR = /[а-яёөүң]/i;
    const collect = (root) => {
      const seen = new Set(), out = [];
      const affix = (k) => /(^|~)-|-$/.test(k) || k.split('~')[0].includes('-'); // ب~bi-, ها~-ha, ك-ت-ب: fragments and spelled letters, not sentences
      const add = (s) => KG.speechChunks(s).forEach((c) => { if (!seen.has(c.key) && !affix(c.key)) { seen.add(c.key); out.push(c); } });
      (function walk(o, d) {
        if (d > 12 || o == null) return;
        if (typeof o === 'string') {
          const inner = o.match(/\[\[(.+?)\]\]/g);
          if (inner) inner.forEach((x) => add(x.slice(2, -2)));
          else if (KG.hasAr(o) && !CYR.test(KG.arOf(o)) && !/[<>A-Za-z]/.test(KG.arOf(o))) add(o);
          return;
        }
        if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
        if (typeof o === 'object') Object.keys(o).forEach((k) => { if (k !== 'stage' && k !== 'fus' && k !== 'fnote') walk(o[k], d + 1); }); // fus = Fusha-only lines
      })(root, 0);
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

    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Үн жазуу студиясы</h1><div class="kgt" lang="ar">استوديو التسجيل</div>
      <p>Египеттик досуңуз курстагы сүйлөмдөрдү окуп жазып берсе, окуучулар жасалма эмес, чыныгы каирлик үндү угушат. Бул бет ага арналган (арабча жана англисче).</p></div></header>
      <div class="wrap rec" style="padding:30px 0 80px">
        <div class="rec-help" lang="ar" dir="rtl">
          <p><b>أهلاً بيك! شكراً إنك بتساعدنا.</b> اقرا كل جملة بالعامية المصرية زي ما بتتكلم عادي، بصوت واضح وهادي، في مكان مافيهوش دوشة. لو الجملة مكتوبة غلط، دوس «⚑» واكتب الصح.</p>
          <p dir="ltr" lang="en" style="text-align:left"><b>Thank you for helping!</b> Read each sentence in everyday Cairene Arabic, the way you'd naturally say it — clearly, at a calm pace, in a quiet room. Keys: <kbd>Space</kbd> record/stop · <kbd>P</kbd> play · <kbd>Enter</kbd> next · <kbd>Backspace</kbd> previous. If the Arabic looks wrong, press ⚑ and type the correction. Recordings stay on this device until you press <b>Export</b> and send the ZIP to the site owner.</p>
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
        <div class="rec-progress"><div class="rec-meter"><span id="rec-meter"></span></div><span id="rec-total" class="muted"></span></div>
        <div class="rec-card">
          <div class="rec-pos muted" id="rec-pos"></div>
          <div class="rec-text" lang="ar" dir="rtl" id="rec-text"></div>
          <div class="rec-tl" id="rec-tl"></div>
          <div class="rec-ctl">
            <button class="btn btn-line" id="rec-prev" title="Backspace">→ السابق</button>
            <button class="btn rec-btn" id="rec-go" title="Space">● تسجيل · Record</button>
            <button class="btn btn-line" id="rec-play" title="P" disabled>▶ اسمع · Play</button>
            <button class="btn btn-line" id="rec-next" title="Enter">التالي ←</button>
          </div>
          <div class="rec-flag"><button class="btn btn-line btn-sm" id="rec-flag">⚑ الجملة فيها غلط · Text is wrong</button>
            <input id="rec-fix" lang="ar" dir="rtl" placeholder="اكتب الجملة الصح هنا · type the correct sentence" hidden></div>
          <div class="rec-status muted" id="rec-status" role="status"></div>
        </div>
        <ol class="rec-list" id="rec-list"></ol>
      </div>`;
    const $ = (s) => main.querySelector(s);
    const items = () => S[setIdx].items;
    const idOf = (c) => KG.audioId(voice, c.key);

    function drawList() {
      $('#rec-list').innerHTML = items().map((c, k) => `<li class="${recs.has(idOf(c)) || KG.speech.files.has(idOf(c)) ? 'done' : ''} ${flags.has(c.key) ? 'flag' : ''} ${k === i ? 'cur' : ''}" data-k="${k}" lang="ar" dir="rtl">${esc(c.key.split('~')[0])}</li>`).join('');
      const doneHere = items().filter((c) => recs.has(idOf(c))).length;
      const doneAll = ALL_KEYS.filter((k) => recs.has(KG.audioId(voice, k)) || KG.speech.files.has(KG.audioId(voice, k))).length;
      const fresh = [...recs.values()].filter((r) => r.date > lastExport).length;
      $('#rec-total').textContent = `This set: ${doneHere}/${items().length} · Whole course: ${doneAll}/${ALL_KEYS.length} (${Math.floor(doneAll / ALL_KEYS.length * 100)}%)` + (fresh ? ` · ${fresh} not exported yet` : '');
      $('#rec-meter').style.width = (doneAll / ALL_KEYS.length * 100).toFixed(1) + '%';
      $('#rec-export-new').disabled = !fresh;
    }
    function draw() {
      const c = items()[i];
      $('#rec-pos').textContent = `${i + 1} / ${items().length}`;
      $('#rec-text').textContent = c.key.split('~')[0];
      $('#rec-tl').textContent = KG.roOf(c.key) ? KG.toLat(KG.roOf(c.key)) : '';
      $('#rec-play').disabled = !recs.has(idOf(c)) && !KG.speech.files.has(idOf(c));
      $('#rec-fix').hidden = !flags.has(c.key);
      $('#rec-fix').value = flags.has(c.key) ? flags.get(c.key).fix || '' : '';
      $('#rec-status').textContent = recs.has(idOf(c)) ? '✓ recorded — press Space to record again' : KG.speech.files.has(idOf(c)) ? '✓ already on the site — record again to replace it' : '';
      drawList();
      const cur = $('#rec-list .cur'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    function move(d) { if (rec) return; i = Math.max(0, Math.min(items().length - 1, i + d)); draw(); }
    function play() {
      const c = items()[i], r = recs.get(idOf(c));
      if (!r) { if (KG.speech.files.has(idOf(c))) KG.speech.say(c.key); return; }
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
      $('#rec-status').textContent = `Exported ${list.length} recordings. Add them with: node data-src/build_audio.js --add <zip>`;
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
        const k = S[si].items.findIndex((c, idx) => idx >= from && !recs.has(idOf(c)) && !KG.speech.files.has(idOf(c)));
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
      if (flags.has(c.key)) { await del('flag', c.key); flags.delete(c.key); }
      else { const f = { key: c.key, fix: '' }; await put('flag', f); flags.set(c.key, f); }
      draw(); if (flags.has(c.key)) $('#rec-fix').focus();
    });
    $('#rec-fix').addEventListener('change', async (e) => { const c = items()[i], f = { key: c.key, fix: e.target.value.trim() }; await put('flag', f); flags.set(c.key, f); });
    const onKey = (e) => {
      if (!document.body.contains(main.querySelector('.rec'))) { document.removeEventListener('keydown', onKey); if (media) media.getTracks().forEach((t) => t.stop()); return; }
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'Enter') { e.preventDefault(); move(1); }
      else if (e.key === 'Backspace') { e.preventDefault(); move(-1); }
      else if (e.key === 'p' || e.key === 'P') play();
    };
    document.addEventListener('keydown', onKey);

    Promise.all([all('rec'), all('flag')]).then(([r, f]) => {
      r.forEach((x) => recs.set(x.id, x)); f.forEach((x) => flags.set(x.key, x));
      const first = items().findIndex((c) => !recs.has(idOf(c)) && !KG.speech.files.has(idOf(c))); i = first < 0 ? 0 : first;
      draw();
    }).catch(() => { $('#rec-status').textContent = 'Storage is blocked in this browser (private mode?).'; draw(); });
  }

  A.ROUTES.record = page;
  A.TITLES.record = 'Үн жазуу студиясы';
  A.zipFiles = zip; // used by tests
  A.recordSets = sets;
});
