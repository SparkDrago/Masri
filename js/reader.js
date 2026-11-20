/* ==========================================================================
   Library & interactive reader (LingQ-style)
   - Every word in a text has a status: new (blue) → learning 1–4 (yellow) → known.
   - Tap a word: meaning, a prefix/stem/ending analysis
     (مابيكتبوش → ما + بي + كتب + و + ش), your own note, the Kyrgyz cognate,
     links to Wiktionary, Glosbe and Google Translate.
   - Learning words go into your review deck; finishing a page marks the rest as known.
   - Import any Egyptian Arabic text (posts, lyrics, dialogues) into your own library.
   ========================================================================== */
(window.KG_PLUGINS = window.KG_PLUGINS || []).push(function (A) {
  'use strict';
  const { store, $, $$, esc, kgSpan, sayBtn, tl, toast } = A;
  const KG = window.KG;
  const TOKEN = /([ء-غف-يً-ْٰـ]+)/g;
  const norm = (w) => KG.normAr(String(w)).replace(/\s+/g, '');
  const STATUS = { 1: 'Жаңыраак', 2: 'Тааныйм', 3: 'Тааныш', 4: 'Дээрлик билем', 5: 'Билем', '-1': 'Эсепке албоо' };

  /* ------------------------------ Dictionary ------------------------------ */
  const DICT = new Map();
  const ROMAN_OF = new Map();
  const addDict = (k, ky, src, ro) => {
    const ar = KG.arOf(k).replace(/[.!?؟،]/g, '').trim();
    const key = norm(ar);
    if (!key || /\s/.test(ar)) return;
    const list = DICT.get(key) || [];
    const clean = A.cleanKy(ky);
    if (clean && !list.some((x) => x.en === clean)) list.push({ en: clean, src });
    DICT.set(key, list);
    const r = ro || KG.roOf(k);
    if (r && !ROMAN_OF.has(key)) ROMAN_OF.set(key, r);
  };
  A.LESSONS.forEach((l) => (l.blocks || []).forEach((b) => {
    if (b.t === 'vocab') b.items.forEach((v) => {
      const ar = KG.arOf(v[0]).replace(/[.!?؟]/g, '').trim();
      if (!/\s/.test(ar)) addDict(v[0], v[1], l.num);
      else { const aw = ar.split(/\s*\/\s*/), rw = KG.roOf(v[0]).split(/\s*\/\s*/), kw = String(v[1]).split(/\s*\/\s*/); if (aw.length > 1) aw.forEach((p, i) => { if (!/\s/.test(p)) addDict(p, kw[i] || v[1], l.num, rw[i]); }); }
    });
  }));
  (window.READERS || []).forEach((r) => (r.glossary || []).forEach((g) => addDict(g[0], g[1], 'аңгеме')));
  (window.READ_DRILL || []).forEach((w) => addDict(w[0], w[1], 'арип'));
  [['أنا~ana', 'мен'], ['إنت~inta', 'сен (эр.)'], ['إنتي~inti', 'сен (аял)'], ['هو~huwwa', 'ал (эркек)'], ['هي~hiyya', 'ал (аял)'], ['إحنا~i7na', 'биз'], ['إنتو~intu', 'силер'], ['هما~humma', 'алар'], ['ده~da', 'бул (эр.)'], ['دي~di', 'бул (аял)'], ['دول~dool', 'булар'],
    ['و~w', 'жана'], ['في~fi', '-да, ичинде; бар'], ['من~min', '-дан'], ['على~3ala', 'үстүндө; -га'], ['مع~ma3a', 'менен'], ['عشان~3ashaan', 'үчүн; анткени'], ['بس~bass', 'бирок; болду'], ['كان~kaan', 'болчу, эле'], ['مش~mish', 'эмес'], ['اللي~illi', 'ким, кайсы (байламта)'],
    ['كل~kull', 'ар бир, бардык'], ['حاجة~7aaga', 'нерсе'], ['ناس~naas', 'адамдар'], ['يوم~yoom', 'күн'], ['النهارده~innaharda', 'бүгүн'], ['بكرة~bukra', 'эртең'], ['امبارح~imbaari7', 'кечээ'], ['كويس~kwayyis', 'жакшы'], ['أوي~awi', 'абдан'], ['كتير~kitiir', 'көп'], ['شوية~shwayya', 'бир аз'],
    ['هنا~hina', 'бул жерде'], ['هناك~hinaak', 'тиги жерде'], ['دلوقتي~dilwa2ti', 'азыр'], ['ليه~leeh', 'эмне үчүн'], ['إيه~eeh', 'эмне'], ['فين~feen', 'кайда'], ['مين~miin', 'ким'], ['إزاي~izzaay', 'кантип'], ['لما~lamma', 'качан …-ганда'], ['لو~law', 'эгер'], ['يعني~ya3ni', 'башкача айтканда'],
    ['ما~ma', 'тануу бөлүгү (ma…sh)'], ['ال~il', 'аныктооч «il-»'], ['يا~ya', 'кайрылуу бөлүгү (эй, …)'], ['أو~aw', 'же'], ['لأ~la2', 'жок'], ['أيوه~aywa', 'ооба'], ['خلاص~xalaaS', 'болду, бүттү'], ['برضه~barDu', 'деле'], ['كمان~kamaan', 'дагы'], ['لسه~lissa', 'дагы эле; жаңы эле']
  ].forEach(([k, v]) => addDict(k, v, 'негизги'));
  ((window.DROPS && window.DROPS.extra) || []).forEach((x) => addDict(x[0], x[1], 'Сөз тамчылары'));
  const LEX_LABEL = { mz: 'Масри сөздүгү', wk: 'Wiktionary' };
  ((window.LEXICON && window.LEXICON.rows) || []).forEach((r) => {
    // [arabic, roman, kyrgyz, pos, source, present form ar~ro (verbs)]
    const label = LEX_LABEL[String(r[4] || 'mz').split(',')[0]] || 'сөздүк';
    addDict(r[0], r[2], label, r[1]);
    if (r[5]) addDict(r[5], r[2], label);
  });
  A.DICT = DICT;
  A.romanOfKey = (k) => ROMAN_OF.get(k);

  /* ------------------------------ Analyzer -------------------------------- */
  // Peel Egyptian clitics off both ends; keep only stems found in the dictionary.
  const PRE = ['وال', 'بال', 'فال', 'لل', 'كال', 'ال', 'ما', 'م', 'و', 'ف', 'ب', 'ل', 'ك', 'ه', 'ح', 'ع'];
  const SUF = ['تهالك', 'ولهم', 'ولها', 'وله', 'ولي', 'لهم', 'لها', 'لنا', 'لكم', 'لك', 'له', 'لي', 'هالك', 'هملك', 'وها', 'وهم', 'وني', 'ونا', 'وكم', 'تها', 'تهم', 'تنا', 'تكم', 'تك', 'ته', 'تي', 'توا', 'تو', 'ها', 'هم', 'نا', 'ني', 'كم', 'كو', 'ين', 'ات', 'وا', 'يه', 'يا', 'ش', 'ك', 'ه', 'ي', 'و', 'ت'];
  function analyze(form) {
    const w = norm(form);
    const out = [];
    if (!w) return out;
    const seen = new Map([[w, { pre: '', suf: '' }]]);
    let layer = [w];
    for (let depth = 0; depth < 6 && layer.length; depth++) {
      const next = [];
      layer.forEach((cand) => {
        const info = seen.get(cand);
        const push = (st, pre, suf) => {
          if (st.length < 2 || seen.has(st)) return;
          seen.set(st, { pre: info.pre + pre, suf: suf + info.suf }); next.push(st);
          if (/ت$/.test(st)) { const h = st.slice(0, -1) + 'ه'; if (!seen.has(h)) { seen.set(h, { pre: info.pre + pre, suf: suf + info.suf, tm: true }); next.push(h); } }
        };
        PRE.forEach((p) => { if (cand.startsWith(p) && cand.length - p.length >= 2) push(cand.slice(p.length), p, ''); });
        SUF.forEach((s) => { if (cand.endsWith(s) && cand.length - s.length >= 2) push(cand.slice(0, -s.length), '', s); });
      });
      layer = next.slice(0, 500);
    }
    seen.forEach((info, st) => { if (st !== w && DICT.has(st)) out.push({ stem: st, en: DICT.get(st), pre: info.pre, rest: info.suf, tm: info.tm }); });
    out.sort((a, b) => b.stem.length - a.stem.length || a.pre.length - b.pre.length);
    return out.slice(0, 3);
  }
  A.analyze = analyze;
  const PIECE = { 'ب': 'bi- (учур чак же «менен»)', 'ه': 'ha- (келер чак)', 'ح': 'ha- (келер чак)', 'ما': 'ma- (тануу)', 'م': 'ma- (тануу)', 'و': 'w- «жана»', 'ف': 'f- «анан»', 'ل': 'li- «үчүн, -га»', 'لل': 'lil- «… үчүн»', 'ك': 'ka- «сыяктуу»', 'ال': 'il- «аныктооч»', 'وال': 'w + il-', 'بال': 'bi + il-', 'فال': 'fi + il-', 'كال': 'ka + il-', 'ع': '3a- «үстүнө, -га»',
    'ش': '-sh (тануу)', 'ي': '-i «менин» же «сен (аял)»', 'ك': '-ak/-ik «сенин»', 'ه': '-u «анын»', 'ها': '-ha «анын (аял)»', 'نا': '-na «биз»', 'كم': '-ku «силер»', 'هم': '-hum «алар»', 'ني': '-ni «мени»', 'وا': '-u (көптүк)', 'و': '-u (көптүк же «аны»)', 'ت': '-t (өткөн чак) же ة', 'ين': '-iin (көптүк) же -een (эки)', 'ات': '-aat (көптүк)', 'تي': '-ti', 'لي': '-li «мага»', 'له': '-lu «ага»', 'لها': '-laha «ага (аял)»' };

  /* ------------------------------ Word status ----------------------------- */
  const W = () => store.d.words || (store.d.words = {});
  const statusOf = (k) => { const e = W()[k]; return e ? e.s : 0; };
  function setStatus(k, s, extra) {
    const e = Object.assign(W()[k] || {}, extra || {}, { s, t: Date.now() });
    W()[k] = e; store.save();
  }
  A.wordStatus = statusOf;
  const cls = (s) => (s === 0 ? 'st-new' : s >= 1 && s <= 4 ? 'st-' + s : '');
  function wordStats() {
    let known = 0, learning = 0;
    Object.values(W()).forEach((e) => { if (e.s === 5) known++; else if (e.s >= 1 && e.s <= 4) learning++; });
    return { known, learning };
  }
  A.wordStats = wordStats;

  // Learning words feed the review deck (flashcards + smart review).
  A.HOOKS.extraVocab = () => Object.entries(W()).filter(([, e]) => e.s >= 1 && e.s <= 4).map(([k, e]) => {
    const dict = DICT.get(k) || (analyze(k)[0] || {}).en;
    const en = e.m || (dict && dict[0] && dict[0].en) || '(маанисин окурманда кошуңуз)';
    const ro = e.r || ROMAN_OF.get(k) || KG.ROMAN.get(k) || '';
    return { k: e.w || k, ro, en, mine: true, ctx: e.c, lesson: { id: 'my-words', num: '★', title: 'Менин сөздөрүм', stage: { n: 'mine' } } };
  });

  /* -------------------------------- Texts --------------------------------- */
  const LOCAL_KEY = 'masri-texts';
  const localTexts = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (e) { return []; } };
  const saveLocalTexts = (list) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); return true; } catch (e) { toast('Бул түзмөктө тексттер үчүн орун калган жок.'); return false; } };
  const signed = () => A.cloud && A.cloud.user;
  async function listTexts() {
    if (signed()) { try { return (await A.cloud.api('/api/texts')).texts; } catch (e) { toast(e.message); } }
    return localTexts().map((t) => ({ id: t.id, title: t.title, level: t.level, created: t.created, len: t.text.length, local: true }));
  }
  async function getText(id) {
    const loc = localTexts().find((t) => t.id === id);
    if (loc) return loc;
    if (signed()) return (await A.cloud.api('/api/texts?id=' + encodeURIComponent(id))).text;
    throw new Error('Текст бул түзмөктөн табылган жок. Аккаунтуңуздагы тексттерди көрүү үчүн кириңиз.');
  }
  async function saveText(t) {
    if (signed()) return (await A.cloud.api('/api/texts', { method: 'POST', body: t })).text;
    const list = localTexts(); t.id = t.id || 'l' + Date.now().toString(36); t.created = Date.now();
    list.unshift(t); if (!saveLocalTexts(list)) throw new Error('Сакталган жок.'); return t;
  }
  async function deleteText(id) {
    const list = localTexts(); if (list.some((t) => t.id === id)) { saveLocalTexts(list.filter((t) => t.id !== id)); return; }
    if (signed()) await A.cloud.api('/api/texts?id=' + encodeURIComponent(id), { method: 'DELETE' });
  }
  // After signing in, move texts saved on this device into the account.
  document.addEventListener('kg-auth', async () => {
    const list = localTexts(); if (!list.length) return;
    let moved = 0;
    for (const t of list) { try { await A.cloud.api('/api/texts', { method: 'POST', body: t }); moved++; } catch (e) { break; } }
    if (moved === list.length) { saveLocalTexts([]); toast(`${moved} текст аккаунтуңуздун китепканасына көчүрүлдү.`); }
  });

  const splitSentences = (text) => String(text).replace(/\r/g, '').split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean).map((p) => (p.match(/[^.!?…؟]+[.!?…؟]*[»”"]?\s*/g) || [p]).map((s) => [s.trim(), null]).filter((s) => s[0]));
  const arPart = (s) => KG.arOf(s);
  const uniqueWords = (paras) => { const set = new Set(); paras.forEach((p) => p.forEach((s) => (arPart(s[0]).match(TOKEN) || []).forEach((w) => set.add(norm(w))))); set.delete(''); return set; };
  function knownPct(paras) {
    const u = uniqueWords(paras); if (!u.size) return { pct: 0, newN: 0, total: 0 };
    let known = 0, newN = 0; u.forEach((w) => { const s = statusOf(w); if (s === 5 || s === -1) known++; else if (s === 0) newN++; });
    return { pct: Math.round((known / u.size) * 100), newN, total: u.size };
  }

  /* ------------------------------- Library -------------------------------- */
  const MILESTONES = [['A1', 1000], ['A2', 2500], ['B1', 5000], ['B2', 9000], ['C1', 15000]];
  function statsPanel() {
    const s = wordStats(), st = store.d.stats || {};
    const next = MILESTONES.find((m) => s.known < m[1]) || MILESTONES[MILESTONES.length - 1];
    return `<div class="lib-stats"><div><b>${s.known.toLocaleString()}</b>белгилүү сөз</div><div><b>${s.learning.toLocaleString()}</b>үйрөнүп жаткан сөз</div><div><b>${(st.wordsRead || 0).toLocaleString()}</b>окулган сөз</div><div><b>${(st.pages || 0).toLocaleString()}</b>бүткөн бет</div>
      <div class="ms"><span>Кийинки чек: болжол менен ${next[1].toLocaleString()} белгилүү сөз ≈ ${next[0]} деңгээлинде окуу</span><div class="bar"><i style="width:${Math.min(100, (s.known / next[1]) * 100)}%"></i></div></div></div>`;
  }
  A.libraryStats = statsPanel;

  A.ROUTES.library = async function library() {
    const main = A.main();
    const R = window.READERS || [];
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Китепкана</h1><div class="kgt" lang="ar">المكتبة</div>
      <p>Аңгемелерди жана өз тексттериңизди окуңуз. Маанисин көрүү үчүн каалаган сөздү басыңыз. <span class="w-demo st-new">Көк</span> сөздөр — жаңы, <span class="w-demo st-1">сары</span> сөздөр — үйрөнүп жатканыңыз, жөнөкөйлөрү — билгениңиз. Бетти бүтүрсөңүз, көк сөздөр «билем» деп эсептелет.</p></div></header>
      <div class="wrap" style="padding:30px 0 80px">${statsPanel()}
      <div class="lib-head"><h2>Менин тексттерим</h2><a class="btn btn-gold btn-sm" href="#import">+ Текст кошуу</a></div><div class="my-texts"><p class="voice-note">Жүктөлүүдө…</p></div>
      <h2 style="margin-top:34px">Деңгээлдүү аңгемелер</h2><div class="readers" style="padding:12px 0 0">${R.map((r) => {
        const k = knownPct(r.paras);
        return `<a class="reader-card" href="#reader-${esc(r.id)}"><span class="lvl" style="align-self:flex-start">${esc(r.level)}</span><span class="kgt" lang="ar" dir="rtl">${esc(A.plain(r.ar))}</span><strong>${esc(r.title)}</strong><span class="voice-note">${esc(r.about)}</span><span class="known-meter"><span class="bar"><i style="width:${k.pct}%"></i></span>${k.pct}% белгилүү · ${k.newN} жаңы сөз</span></a>`;
      }).join('')}</div></div>`;
    const box = $('.my-texts', main);
    const list = await listTexts();
    if (A.main() !== main) return;
    box.innerHTML = list.length ? `<div class="readers" style="padding:0">${list.map((t) => `<div class="reader-card"><a href="#text-${esc(t.id)}" class="stretch"><span class="lvl" style="align-self:flex-start;background:var(--ok)">${esc(t.level || 'Меники')}</span><strong style="font-family:var(--f-kg);font-size:1.2rem" dir="auto">${esc(t.title)}</strong></a><span class="voice-note">${(t.len || 0).toLocaleString()} белги · ${new Date(t.created).toLocaleDateString('ru')}${t.local ? ' · ушул түзмөктө' : ''}</span><button class="btn btn-line btn-sm" data-del="${esc(t.id)}" style="align-self:flex-start">Өчүрүү</button></div>`).join('')}</div>`
      : `<div class="empty panel"><p><b>Китепканаңыз бош.</b> Египетче каалаган текстти — пост, ыр сөздөрү, диалог — кошуп, сөздөрүн басып окуңуз.</p><a class="btn btn-ink btn-sm" href="#import">Биринчи текстти кошуу</a></div>`;
    box.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      if (!d.dataset.sure) { d.dataset.sure = '1'; d.textContent = 'Өчүрүү үчүн дагы бир басыңыз'; return; }
      try { await deleteText(d.dataset.del); toast('Текст өчүрүлдү.'); A.route(); } catch (err) { toast(err.message); }
    });
  };
  A.ROUTES.readers = A.ROUTES.library;
  A.TITLES.library = 'Китепкана';

  /* -------------------------------- Import -------------------------------- */
  const SAMPLE = 'القاهرة أكبر مدينة في مصر. فيها أكتر من عشرين مليون واحد.\n\nالنيل بيعدي في نص المدينة. الناس بتحب تتمشى على الكورنيش بالليل وتشرب شاي. في الصيف الجو حر أوي، بس الشتا لطيف.';
  A.ROUTES.import = function importPage() {
    const main = A.main();
    main.innerHTML = `<header class="page-head"><div class="wrap"><div class="crumbs"><a href="#library">Китепкана</a></div><h1>Текст кошуу</h1><p>Египетче каалаган текстти чаптаңыз: Facebook посту, ырдын сөздөрү, сериалдын субтитри. Ал сөздөрүн басып карай турган сабакка айланат.</p></div></header>
      <div class="narrow" style="padding:30px 0 80px"><form class="panel import-form" novalidate>
        <div class="field"><label for="im-title">Аталышы</label><input id="im-title" type="text" dir="auto" maxlength="120" placeholder="мисалы: أغنية · Ыр" style="font-family:var(--f-kg)"></div>
        <div class="field"><span class="lbl">Деңгээли (болжолдуу)</span><div class="seg" data-seg="lvl">${['A1', 'A2', 'B1', 'B2', 'C1'].map((l, i) => `<button type="button" data-v="${l}" aria-pressed="${i === 2}">${l}</button>`).join('')}</div></div>
        <div class="field"><label for="im-src">Булак шилтемеси (милдеттүү эмес)</label><input class="input" id="im-src" type="url" maxlength="300" placeholder="https://…"></div>
        <div class="field"><label for="im-text">Текст</label><textarea id="im-text" dir="rtl" lang="ar" rows="12" maxlength="30000" placeholder="اكتب أو الصق النص هنا"></textarea><div class="preview"><span class="cc">0</span> / 30 000 белги · <button type="button" class="linkish" data-sample>Үлгү текстти байкап көрүү</button></div></div>
        <div class="form-msg" role="alert"></div>
        <button class="btn btn-ink" type="submit">Китепканама сактоо</button>
        ${signed() ? '' : '<p class="voice-note" style="margin-top:12px">Сиз кирген жоксуз, ошондуктан текст ушул түзмөктө гана сакталат. Аккаунтуңузда сактоо үчүн кириңиз.</p>'}
      </form>
      ${A.BLOCK.tip({ title: 'Автордук укукту сыйлаңыз', html: 'Кошулган тексттер сизге гана көрүнөт — өзүңүздүн окууңуз үчүн колдонуңуз. Бүтүн китепти чаптабаңыз; бир бөлүм же бир макала жетиштүү.' })}
      ${A.BLOCK.tip({ title: 'Окулушу жөнүндө', html: 'Сиз кошкон тексттердин сөздөрү курста же сөздүктө болсо, окулушу так көрсөтүлөт. Башка сөздөрдүн окулушу болжолдуу («≈» белгиси менен), анткени арабча жазууда кыска үндүүлөр жазылбайт.' })}</div>`;
    let level = 'B1';
    const ta = $('#im-text'), cc = $('.cc', main);
    ta.addEventListener('input', () => { cc.textContent = ta.value.length.toLocaleString(); });
    main.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg="lvl"] [data-v]'); if (b) { level = b.dataset.v; $$('[data-seg="lvl"] button', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
      if (e.target.closest('[data-sample]')) { ta.value = SAMPLE; $('#im-title').value = 'القاهرة · Каир'; cc.textContent = SAMPLE.length; }
    });
    $('.import-form', main).addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('.form-msg', main);
      const text = ta.value.trim();
      if (!KG.hasAr(text)) { msg.textContent = 'Бул азырынча арабча текстке окшобойт.'; return; }
      try { const t = await saveText({ title: $('#im-title').value.trim() || text.slice(0, 40), level, source: $('#im-src').value.trim(), text }); toast('Китепканаңызга сакталды.'); location.hash = '#text-' + t.id; }
      catch (err) { msg.textContent = err.message; }
    });
  };
  A.TITLES.import = 'Текст кошуу';

  /* -------------------------------- Reader -------------------------------- */
  function tokenHTML(sentence) {
    return esc(arPart(sentence)).replace(TOKEN, (w) => { const k = norm(w); return k ? `<span class="w ${cls(statusOf(k))}" data-w="${esc(k)}" tabindex="0">${w}</span>` : w; });
  }
  const pronOfKey = (k, shown) => { const r = ROMAN_OF.get(k) || KG.ROMAN.get(k); return r ? KG.pron('x~' + r, store.d.tls) : KG.pron(shown, store.d.tls); };
  function renderReader(doc) {
    const main = A.main();
    const hasEn = doc.paras.some((p) => p.some((s) => s[1]));
    const k = knownPct(doc.paras);
    main.innerHTML = `<header class="page-head"><div class="narrow"><div class="crumbs"><a href="#library">Китепкана</a> › ${esc(doc.level || '')}</div>
      <h1 class="kg" dir="${KG.hasAr(doc.ar || doc.title) ? 'rtl' : 'auto'}" lang="ar" style="color:#fff;font-family:var(--f-kg)">${esc(A.plain(doc.ar || doc.title))}</h1><p>${doc.ar ? esc(doc.title) + ' — ' : ''}${esc(doc.about || '')}${doc.source ? ` <a href="${esc(/^https?:/.test(doc.source) ? doc.source : '#')}" style="color:var(--gold)">Булак</a>` : ''}</p>
      <div class="meta-row">${hasEn ? '<button class="chip-btn" data-act="show-en" aria-pressed="false">Бардык котормону көрсөтүү</button>' : ''}<button class="chip-btn" data-r="listen">Үн чыгарып окуу</button><button class="chip-btn" data-r="smaller" aria-label="Кичирээк текст">A−</button><button class="chip-btn" data-r="bigger" aria-label="Чоңураак текст">A+</button><span class="known-chip">${k.pct}% белгилүү · <span class="new-n">${k.newN}</span> жаңы</span></div></div></header>
      <div class="reader-layout"><div class="narrow story lingq" style="font-size:${store.d.settings.readSize || 1}em">${doc.paras.map((p) => `<div class="para">${p.map((s) => `<div class="sent2">${hasEn ? `<button class="sent-en-btn" aria-label="Сүйлөмдү которуу">KG</button>` : ''}<span class="kg-line" lang="ar" dir="rtl">${tokenHTML(s[0])}</span>${KG.roOf(s[0]) ? `<span class="tl sent-tl">${esc(KG.pron(s[0], store.d.tls))}</span>` : ''}${s[1] ? `<span class="en">${esc(s[1])}</span>` : ''}</div>`).join('')}</div>`).join('')}
        <div class="finish panel"><p><b>Окуп бүттүңүзбү?</b> <span class="fin-text"></span></p><button class="btn btn-gold" data-r="finish">Бетти бүтүрүү</button></div>
        ${doc.glossary ? `<h2>Билүү керек сөздөр</h2><div class="glossary">${doc.glossary.map((g) => `<div>${kgSpan(g[0])} ${tl(g[0])} — ${esc(g[1])}${A.arHint(g[0])}</div>`).join('')}</div>` : ''}
        ${doc.quiz ? '<h2>Түшүндүңүзбү?</h2><div class="quiz"></div>' : ''}</div>
        <aside class="wpanel" aria-live="polite" hidden></aside></div>`;
    const story = $('.story', main), panel = $('.wpanel', main);
    const refreshCounts = () => { const kk = knownPct(doc.paras); $('.new-n', main).textContent = kk.newN; $('.fin-text', main).textContent = kk.newN ? `${kk.newN} көк сөз «билем» деп белгиленет.` : 'Жаңы сөз калган жок — азаматсыз!'; };
    const repaint = (key) => { $$(`.w[data-w="${CSS.escape(key)}"]`, story).forEach((el) => { el.className = 'w ' + cls(statusOf(key)) + (el.classList.contains('sel') ? ' sel' : ''); }); refreshCounts(); };
    refreshCounts();
    let current = null;
    function open(el) {
      $$('.w.sel', story).forEach((x) => x.classList.remove('sel'));
      el.classList.add('sel');
      const key = el.dataset.w, shown = el.textContent; current = { key, el };
      const sentence = el.closest('.sent2').querySelector('.kg-line').textContent.trim();
      const e = W()[key] || {};
      const exact = DICT.get(key);
      const an = exact ? [] : analyze(key);
      const s = statusOf(key);
      const pieces = (x) => `${x.pre ? `<span class="m m1" title="${esc(PIECE[x.pre] || '')}">${esc(x.pre)}</span> + ` : ''}<span class="kg">${esc(x.stem.replace(/ه$/, x.tm ? 'ة' : 'ه'))}</span>${x.rest ? ` + <span class="m m2" title="${esc(PIECE[x.rest] || '')}">${esc(x.rest)}</span>` : ''}`;
      panel.hidden = false;
      panel.innerHTML = `<button class="wp-close" aria-label="Жабуу">×</button>
        <div class="wp-word"><span class="kg" lang="ar" dir="rtl">${esc(shown)}</span> ${sayBtn(shown)}</div><span class="tl">${esc(pronOfKey(key, shown))}</span>
        <div class="wp-mean">${exact ? exact.map((x) => `<div>${esc(x.en)} <small class="wp-src">${esc(/^[0-9]/.test(x.src) ? x.src + '-сабак' : x.src)}</small></div>`).join('') : an.length ? an.map((x) => `<div class="an" dir="ltr"><span lang="ar" dir="rtl">${pieces(x)}</span> — ${esc(x.en[0].en)}${x.pre || x.rest ? `<div class="voice-note">${[x.pre, x.rest].filter(Boolean).map((p) => esc(p) + ' = ' + esc(PIECE[p] || '…')).join(' · ')}</div>` : ''}</div>`).join('') + '<div class="voice-note">Сөздүн башын жана аягын бөлүп чыгарылган болжол. Контексттен текшериңиз.</div>' : '<div class="voice-note">Бул сөз азырынча сөздүктө жок. Төмөнкү шилтемелерди колдонуп, өз маанисиңизди жазыңыз.</div>'}</div>
        ${A.arHint(shown)}
        <label class="lbl" for="wp-note">Сиздин мааниңиз</label><textarea id="wp-note" rows="2" placeholder="Маанисин же эскертүү жазыңыз">${esc(e.m || '')}</textarea>
        <div class="wp-status" role="group" aria-label="Канчалык жакшы билесиз?">${[1, 2, 3, 4].map((n) => `<button data-s="${n}" aria-pressed="${s === n}" title="${STATUS[n]}">${n}</button>`).join('')}<button data-s="5" class="known" aria-pressed="${s === 5}">✓ Билем</button><button data-s="-1" class="ign" aria-pressed="${s === -1}" title="Аттар, сандар, эсепке кошкуңуз келбеген сөздөр">Албоо</button></div>
        <p class="voice-note">${s >= 1 && s <= 4 ? 'Бул сөз кайталоо тизмеңизде.' : 'Кайталоого кошуу үчүн 1–4 тандаңыз.'} Баскычтар: 1–4, K = билем, X = албоо.</p>
        <div class="wp-links"><a href="https://en.wiktionary.org/wiki/${encodeURIComponent(an[0] ? an[0].stem : shown)}#Egyptian_Arabic" target="_blank" rel="noopener">Wiktionary</a><a href="https://glosbe.com/ar/ky/${encodeURIComponent(shown)}" target="_blank" rel="noopener">Glosbe</a><a href="https://translate.google.com/?sl=ar&tl=ky&text=${encodeURIComponent(sentence)}" target="_blank" rel="noopener">Сүйлөмдү которуу</a></div>`;
      const note = $('#wp-note', panel);
      const extra = () => ({ c: sentence.slice(0, 200), w: shown.replace(/[ً-ْـ]/g, ''), r: ROMAN_OF.get(key) || KG.ROMAN.get(key) || '' });
      note.addEventListener('change', () => { const st = statusOf(key) || 1; setStatus(key, st > 0 ? st : 1, Object.assign({ m: note.value.trim() }, extra())); repaint(key); });
      panel.dataset.sentence = sentence;
      panel._extra = extra;
      if (window.innerWidth <= 900) { document.body.classList.add('wp-open'); const r = el.getBoundingClientRect(); if (r.top > window.innerHeight * 0.36 || r.top < 70) window.scrollBy({ top: r.top - window.innerHeight * 0.2, behavior: 'smooth' }); }
    }
    function choose(n) {
      if (!current) return;
      setStatus(current.key, n, panel._extra ? panel._extra() : {});
      repaint(current.key);
      if (n === 5 || n === -1) { const words = $$('.w', story); const i = words.indexOf(current.el); const nx = words.slice(i + 1).find((x) => x.classList.contains('st-new') || /st-[1-4]/.test(x.className)); if (nx) { open(nx); nx.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; } }
      open(current.el);
    }
    main.addEventListener('click', (ev) => {
      const w = ev.target.closest('.w'); if (w) { open(w); A.say(w.textContent); return; }
      const sb = ev.target.closest('[data-s]'); if (sb) { choose(Number(sb.dataset.s)); return; }
      if (ev.target.closest('.wp-close')) { panel.hidden = true; document.body.classList.remove('wp-open'); $$('.w.sel', story).forEach((x) => x.classList.remove('sel')); current = null; return; }
      const en = ev.target.closest('.sent-en-btn'); if (en) { en.parentElement.classList.toggle('open'); return; }
      const r = ev.target.closest('[data-r]'); if (!r) return;
      if (r.dataset.r === 'listen') A.say($$('.kg-line', story).map((x) => x.textContent.trim()).join('\n'));
      if (r.dataset.r === 'smaller' || r.dataset.r === 'bigger') { const v = Math.max(0.8, Math.min(1.6, (store.d.settings.readSize || 1) + (r.dataset.r === 'bigger' ? 0.1 : -0.1))); store.d.settings.readSize = v; story.style.fontSize = v + 'em'; store.save(); }
      if (r.dataset.r === 'finish') {
        let n = 0; uniqueWords(doc.paras).forEach((wd) => { if (!statusOf(wd)) { W()[wd] = { s: 5, t: Date.now() }; n++; } });
        const tokens = doc.paras.reduce((a, p) => a + p.reduce((b, s) => b + (arPart(s[0]).match(TOKEN) || []).length, 0), 0);
        const st = store.d.stats || (store.d.stats = {});
        st.wordsRead = (st.wordsRead || 0) + tokens; st.pages = (st.pages || 0) + 1;
        store.addXP(Math.min(60, 5 + tokens / 6), 'reading');
        $$('.w', story).forEach((el) => { el.className = 'w ' + cls(statusOf(el.dataset.w)); });
        refreshCounts();
        toast(`Бет бүттү: ${tokens} сөз окулду${n ? `, ${n} жаңы сөз «билем» деп белгиленди` : ''}.`);
        r.disabled = true;
      }
    });
    main.addEventListener('keydown', (ev) => {
      if (ev.target.closest('textarea, input')) return;
      if (ev.key === 'Enter' && ev.target.classList.contains('w')) { open(ev.target); return; }
      if (!current) return;
      if ('1234'.includes(ev.key)) choose(Number(ev.key));
      else if (ev.key.toLowerCase() === 'k' || ev.key === 'л') choose(5);
      else if (ev.key.toLowerCase() === 'x' || ev.key === 'ч') choose(-1);
      else if (ev.key === 'Escape') { panel.hidden = true; current = null; document.body.classList.remove('wp-open'); }
    });
    if (doc.quiz) A.mountQuiz($('.quiz', main), doc.quiz, (pct) => store.addXP(pct * 10, 'reader'));
  }

  A.PREFIXES.push(['reader-', (id) => {
    const r = (window.READERS || []).find((x) => x.id === id);
    if (!r) { A.main().innerHTML = '<div class="narrow empty"><h1>Аңгеме табылган жок</h1><p><a href="#library">Китепканага кайтуу</a></p></div>'; return; }
    document.title = 'Масри — ' + r.title;
    renderReader(r);
  }]);
  A.PREFIXES.push(['text-', async (id) => {
    const main = A.main();
    main.innerHTML = '<div class="narrow empty"><p>Текстиңиз ачылууда…</p></div>';
    try {
      const t = await getText(id);
      if (A.main() !== main) return;
      renderReader({ id: t.id, title: t.title, level: t.level, about: 'Китепканаңыздан', source: t.source, paras: splitSentences(t.text) });
    } catch (e) { main.innerHTML = `<div class="narrow empty"><h1>Текст ачылган жок</h1><p>${esc(e.message)} <a href="#library">Китепканага кайтуу</a></p></div>`; }
  }]);
});
