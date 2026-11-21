/* ==========================================================================
   Масри — app
   Hash-routed single page app. No build step, no dependencies.
   Routes: #home #course #lesson-<id> #alphabet #machine #cards #cheatsheet
           #plan #tektesh #about-audio (+ routes added by the feature modules)
   Target-language text is written "عربي~roman" (see js/eg.js).
   ========================================================================== */
(function () {
  'use strict';
  const KG = window.KG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const hasAr = KG.hasAr;
  let main = $('#main');
  const HOOKS = {};

  /* ------------------------------ Storage ------------------------------ */
  const KEY = 'masri-v1';
  const store = {
    d: { done: {}, srs: {}, tl: true, tls: 'cyr', ar: false, streak: { last: '', count: 0 }, reviews: 0, xp: {}, words: {}, plan: null, certs: {}, placement: null, mistakes: [], stats: {}, settings: {}, mod: 0 },
    load() { try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x) Object.assign(this.d, x); } catch (e) { /* storage blocked */ } },
    save(quiet) {
      if (!quiet) this.d.mod = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ }
      if (!quiet) document.dispatchEvent(new CustomEvent('kg-save'));
    },
    today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    addXP(n, why) {
      n = Math.max(0, Math.round(n)); if (!n) return;
      const t = this.today(); this.d.xp[t] = (this.d.xp[t] || 0) + n;
      this.tick(); this.save();
      document.dispatchEvent(new CustomEvent('kg-xp', { detail: { n, why } }));
    },
    tick() {
      const today = this.today();
      const yd = new Date(Date.now() - 864e5);
      const y = yd.getFullYear() + '-' + String(yd.getMonth() + 1).padStart(2, '0') + '-' + String(yd.getDate()).padStart(2, '0');
      const s = this.d.streak;
      if (s.last === today) return;
      s.count = s.last === y ? s.count + 1 : 1; s.last = today; this.save();
    }
  };
  store.load();

  /* ------------------------------ Course ------------------------------- */
  const COURSE = window.COURSE || { stages: [] };
  COURSE.stages.sort((a, b) => a.n - b.n);
  const LESSONS = [];
  COURSE.stages.forEach((st) => st.lessons.forEach((l, i) => { l.stage = st; l.num = st.n + '.' + (i + 1); LESSONS.push(l); }));
  const byId = (id) => LESSONS.find((l) => l.id === id);
  const isDone = (id) => (store.d.done[id] || 0) >= 0.8;

  // Teach the engine every pronunciation written in the data (for tap-a-word and imported texts).
  (function learn(o, depth) {
    if (depth > 9 || o == null) return;
    if (typeof o === 'string') { if (o.includes('~')) { KG.learnRoman(o); const m = o.match(/\[\[(.+?)\]\]/g); if (m) m.forEach((x) => KG.learnRoman(x.slice(2, -2))); } return; }
    if (Array.isArray(o)) { o.forEach((x) => learn(x, depth + 1)); return; }
    if (typeof o === 'object') Object.keys(o).forEach((k) => { if (k !== 'stage') learn(o[k], depth + 1); });
  })([COURSE.stages, window.READERS, window.DROPS, window.ALPHABET, window.READ_DRILL], 0);
  ((window.LEXICON && window.LEXICON.rows) || []).forEach((r) => { if (r[1]) KG.learnRoman(r[0] + '~' + r[1]); });

  /* ---------------------------- Rich text ------------------------------ */
  const ICON_SAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
  const plain = (s) => KG.arOf(s);
  // What a play button hands to the speech engine: Arabic + its Egyptian transcription
  const sayOf = (s) => { const a = KG.arOf(s), r = KG.roOf(s); return r ? a + '~' + r : a; };
  // Letters that join to the next letter (not ا د ذ ر ز و ة ء …)
  const NOJOIN = 'اأإآٱدذرزوؤةءى ';
  const joins = (c) => c && /[ؠ-ي]/.test(c) && !NOJOIN.includes(c);
  function chips(s) {
    const ar = KG.split(s).ar;
    return String(ar).split(/(\s+)/).map((word) => {
      if (!word.includes('|')) return esc(word);
      const m = word.match(/^(.*?)([.,!?…:;»”"،؟]*)$/);
      const parts = m[1].split('|');
      return parts.map((p, i) => {
        const cls = i === parts.length - 1 && hasAr(p) ? 0 : null;
        void cls;
        const prev = parts[i - 1], next = parts[i + 1];
        const zl = prev && joins(prev.slice(-1)) && hasAr(p) ? '‍' : '';
        const zr = next && joins(p.slice(-1)) && hasAr(next) ? '‍' : '';
        return `<span class="m m${i === 0 ? 0 : ((i - 1) % 4) + 1}">${zl}${esc(p)}${zr}</span>`;
      }).join('') + esc(m[2]);
    }).join('');
  }
  const kgSpan = (s) => `<span class="kg" lang="ar" translate="no" dir="rtl" data-say="${esc(sayOf(s))}">${chips(s)}</span>`;
  const sayBtn = (s) => `<button class="say-btn" data-say="${esc(sayOf(s))}" aria-label="Угуу: ${esc(plain(s))}">${ICON_SAY}</button>`;
  const tl = (s) => { const t = KG.pron(s, store.d.tls); return t ? `<span class="tl" translate="no" dir="ltr">${esc(t)}</span>` : ''; };
  function rich(html) {
    if (html == null) return '';
    return String(html).replace(/\[\[(.+?)\]\]/g, (m, t) => hasAr(t) ? kgSpan(t) + (KG.roOf(t) ? ' ' + tl(t).replace('class="tl" translate="no"', 'class="tl tli" translate="no"') : '') : `<b class="ky">${esc(t)}</b>`);
  }
  /* Kyrgyz words that came from Arabic ("Тектештер" hints) */
  const LK = window.LINKS || {};
  const LK_KEYS = Object.keys(LK).map((k) => [KG.normAr(k), k]).sort((a, b) => b[0].length - a[0].length);
  function linkMatch(phrase) {
    const out = [], seen = new Set();
    KG.normAr(plain(phrase)).split(/\s+/).forEach((tok) => {
      if (tok.length < 2) return;
      const forms = [tok, tok.replace(/^ال/, ''), tok.replace(/^(و|ب|ف|ل)ال/, ''), tok.replace(/^[وبفل]/, '')];
      for (const [nk, k] of LK_KEYS) {
        const e = LK[k];
        const exact = forms.includes(nk) || (e.pre && forms.some((f) => f.startsWith(nk) && f.length - nk.length <= 2));
        if (exact) { if (!seen.has(k)) { seen.add(k); out.push(Object.assign({ k }, e)); } break; }
      }
    });
    return out;
  }
  function arHint(phrase) {
    return linkMatch(phrase).map((e) => `<span class="ar-hint"><span class="badge" aria-hidden="true">К</span>Кыргызчада: <b class="ky">${esc(e.ky)}</b>${e.mean ? ` <span class="voice-note">(${esc(e.mean)})</span>` : ''}${e.hint ? ` <i>— ${esc(e.hint)}</i>` : ''}</span>`).join('');
  }
  const arWrap = (html) => String(html).replace(/([؀-ۿ][؀-ۿً-ٟ\s«»:،؟/()]*[؀-ۿ؟»]|[؀-ۿ])/g, '<span class="ar-in" lang="ar" translate="no" dir="rtl">$1</span>');
  const FL = window.FUSHA_LOGIC || {};
  const para = (html) => { const h = rich(html); return /^\s*</.test(h) ? h : `<p>${h}</p>`; };

  /* ----------------------------- Blocks -------------------------------- */
  const BLOCK = {
    p: (b) => para(b.html),
    eli5: (b) => `<div class="eli5"><div class="tag">★ Жөнөкөй тил менен</div>${para(b.html)}</div>`,
    tip: (b) => `<div class="tip"><div class="tag">${rich(esc(b.title || 'Кеңеш'))}</div>${para(b.html)}</div>`,
    warn: (b) => `<div class="warn"><div class="tag">${rich(esc(b.title || 'Абайлаңыз'))}</div>${para(b.html)}</div>`,
    list: (b) => `<${b.ordered ? 'ol' : 'ul'}>${b.items.map((i) => `<li>${rich(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`,
    compare: (b) => `<div class="compare"><div class="cols">
        <div class="col"><div class="lang">Кыргызча</div><div class="en-s">${rich(b.ky)}</div>${b.fus ? `<div class="ar-row"><div class="lang">Адабий араб тили (фусха)</div><span lang="ar" translate="no" dir="rtl">${esc(plain(b.fus))}</span>${KG.roOf(b.fus) ? `<div class="tl" translate="no" dir="ltr" style="text-align:left">${esc(KG.pron(b.fus, store.d.tls))}</div>` : ''}</div>` : ''}</div>
        <div class="col"><div class="lang">Египет арабчасы</div><div class="kg-s">${kgSpan(b.ar)} ${sayBtn(b.ar)}<br>${tl(b.ar)}</div></div></div>
        ${b.gloss || b.note || b.fnote ? `<div class="foot">${b.gloss ? `<b>Сөзмө-сөз:</b> ${rich(esc(b.gloss))}` : ''}${b.gloss && b.note ? '<br>' : ''}${b.note ? rich(b.note) : ''}${b.fnote ? `<div class="ar-note"><span class="badge" aria-hidden="true">ف</span><b>Фусха менен айырмасы:</b> ${arWrap(rich(esc(b.fnote)))}</div>` : ''}</div>` : ''}</div>`,
    table: (b) => {
      const kc = b.kg || [];
      const cell = (c, i) => (kc.includes(i) && c && !String(c).includes('[[') && !String(c).includes('<') && hasAr(c)) ? `${kgSpan(c)}${KG.roOf(c) ? '<br>' + tl(c) : ''}` : rich(c);
      return `<div class="tbl-wrap"><table>${b.caption ? `<caption>${rich(b.caption)}</caption>` : ''}<thead><tr>${b.cols.map((c) => `<th scope="col">${rich(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => `<td>${cell(c, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },
    vocab: (b) => `${b.title ? `<h3>${esc(b.title)}</h3>` : ''}<ul class="vocab">${b.items.map((v) => `<li>${sayBtn(v[0])}<div>${kgSpan(v[0])}<br>${tl(v[0])}</div><div class="en">${rich(v[1])}${v[2] ? `<span class="note">${rich(v[2])}</span>` : ''}${arHint(v[0])}</div></li>`).join('')}</ul>`,
    ex: (b) => `${b.title ? `<h3>${esc(b.title)}</h3>` : ''}<ul class="examples">${b.items.map((x) => `<li>${sayBtn(x[0])}<div>${kgSpan(x[0])}<br>${tl(x[0])}<span class="en">${rich(x[1])}</span>${x[2] ? `<span class="gloss">${rich(esc(x[2]))}</span>` : ''}${plain(x[0]).split(/\s+/).length <= 3 ? arHint(x[0]) : ''}</div></li>`).join('')}</ul>`,
    dialog: (b) => `<div class="dialog">${b.title ? `<h4>${esc(b.title)}</h4>` : ''}${b.lines.map((l) => {
      const side = l[0] === (b.lines[0][0]) ? 'a' : 'b';
      return `<div class="line ${side}"><div class="who" title="${esc(l[0])}">${esc(l[0].slice(0, 2))}</div><div class="bubble">${kgSpan(l[1])} ${sayBtn(l[1])}<br>${tl(l[1])}<span class="en">${rich(l[2])}</span></div></div>`;
    }).join('')}</div>`,
    letters: (b) => `<div class="letters">${b.items.map((ch) => letterCard(ch)).join('')}</div>`,
    widget: (b) => WIDGETS[b.name] ? `<div class="widget" data-widget="${esc(b.name)}"></div>` : ''
  };

  function letterCard(ch) {
    const L = (window.ALPHABET || []).find((x) => x.l === ch);
    if (!L) return '';
    return `<button class="letter ${L.g === 'special' ? 'special' : ''} ${L.g === 'trap' ? 'trap' : ''}" data-say="${esc(sayOf(L.w))}" aria-label="${esc(L.n || L.l)} тамгасы, тыбышы ${esc(L.s)}. Мисал: ${esc(plain(L.w))}">
      <span class="big" lang="ar" translate="no">${esc(L.l)}<small>${esc(L.f || '')}</small></span>
      <span class="lname">${esc(L.n || '')}</span>
      <span class="snd">${esc(L.s)}</span><span class="hint">${esc(L.h)}</span>
      <span class="exw"><span lang="ar" translate="no" dir="rtl">${esc(plain(L.w))}</span> ${tl(L.w)} <span class="voice-note">${esc(L.m)}</span></span></button>`;
  }

  /* ----------------------------- Word lists ---------------------------- */
  const NOUNS = [
    ['كتاب~kitaab', 'китеп', 'كتب~kutub', 'm'], ['بيت~beet', 'үй', 'بيوت~buyuut', 'm'], ['عربية~3arabiyya', 'машина', 'عربيات~3arabiyyaat', 'f'], ['اسم~ism', 'ат (ысым)', 'أسامي~asaami', 'm'],
    ['شنطة~shanTa', 'сумка', 'شنط~shunaT', 'f'], ['أوضة~2ooDa', 'бөлмө', 'أوض~2uwaD', 'f'], ['قلم~2alam', 'калем', 'أقلام~a2laam', 'm'], ['شغل~shughl', 'жумуш', '', 'm'],
    ['صاحب~Saa7ib', 'дос (эркек)', 'صحاب~SuHaab', 'm'], ['صاحبة~Sa7ba', 'дос (кыз)', 'صاحبات~Sa7baat', 'f'], ['أخ~axx', 'ага, ини', 'إخوات~ixwaat', 'm'], ['أخت~uxt', 'эже, сиңди', 'أخوات~axawaat', 'f'],
    ['بنت~bint', 'кыз', 'بنات~banaat', 'f'], ['ولد~walad', 'бала (уул)', 'ولاد~wilaad', 'm'], ['جوز~gooz', 'күйөө', '', 'm'], ['مرات~miraat', 'аял (жубай)', '', 'f'],
    ['تليفون~tilifoon', 'телефон', 'تليفونات~tilifonaat', 'm'], ['مكتب~maktab', 'кеңсе, жазуу столу', 'مكاتب~makaatib', 'm'], ['شقة~sha22a', 'батир', 'شقق~shu2a2', 'f'], ['مدرسة~madrasa', 'мектеп', 'مدارس~madaaris', 'f'],
    ['شمس~shams', 'күн', '', 'f'], ['قمر~2amar', 'ай', '', 'm'], ['نيل~niil', 'Нил', '', 'm'], ['راجل~raagil', 'эркек киши', 'رجالة~riggaala', 'm'],
    ['ست~sitt', 'аял киши', 'ستات~sittaat', 'f'], ['يوم~yoom', 'күн (сутка)', 'أيام~ayyaam', 'm'], ['سنة~sana', 'жыл', 'سنين~siniin', 'f'], ['كلب~kalb', 'ит', 'كلاب~kilaab', 'm'],
    ['قطة~2oTTa', 'мышык', 'قطط~2oTaT', 'f'], ['جامعة~gam3a', 'университет', 'جامعات~gam3aat', 'f'], ['ساعة~saa3a', 'саат', 'ساعات~saa3aat', 'f'], ['دولاب~dulaab', 'шкаф', 'دواليب~dawaliib', 'm']
  ].map((n) => ({ ar: KG.arOf(n[0]), ro: KG.roOf(n[0]), ky: n[1], pl: n[2], g: n[3] }));
  const ADJ = [
    [['تعبان', 'ta3baan'], ['تعبانة', 'ta3baana'], ['تعبانين', 'ta3baniin'], 'чарчаган'], [['مبسوط', 'mabsuuT'], ['مبسوطة', 'mabsuuTa'], ['مبسوطين', 'mabsuTiin'], 'кубанычтуу, ыраазы'],
    [['جعان', 'ga3aan'], ['جعانة', 'ga3aana'], ['جعانين', 'ga3aniin'], 'ачка'], [['عطشان', '3aTshaan'], ['عطشانة', '3aTshaana'], ['عطشانين', '3aTshaniin'], 'суусаган'],
    [['مشغول', 'mashghuul'], ['مشغولة', 'mashghuula'], ['مشغولين', 'mashghuliin'], 'бош эмес'], [['كويس', 'kwayyis'], ['كويسة', 'kwayyisa'], ['كويسين', 'kwayyisiin'], 'жакшы'],
    [['جاهز', 'gaahiz'], ['جاهزة', 'gahza'], ['جاهزين', 'gahziin'], 'даяр'], [['فاهم', 'faahim'], ['فاهمة', 'fahma'], ['فاهمين', 'fahmiin'], 'түшүнүп турат'],
    [['زعلان', 'za3laan'], ['زعلانة', 'za3laana'], ['زعلانين', 'za3laniin'], 'таарынган, капа'], [['مصري', 'maSri'], ['مصرية', 'maSriyya'], ['مصريين', 'maSriyyiin'], 'египеттик'],
    [['قرغيزي', '2irghiizi'], ['قرغيزية', '2irghiiziyya'], ['قرغيز', '2irghiiz'], 'кыргыз'], [['طالب', 'Taalib'], ['طالبة', 'Taliba'], ['طلبة', 'Talaba'], 'студент'],
    [['دكتور', 'duktoor'], ['دكتورة', 'duktoora'], ['دكاترة', 'dakatra'], 'дарыгер'], [['متجوز', 'mitgawwiz'], ['متجوزة', 'mitgawwiza'], ['متجوزين', 'mitgawwiziin'], 'үйлөнгөн / турмушка чыккан'],
    [['هنا', 'hina'], ['هنا', 'hina'], ['هنا', 'hina'], 'бул жерде'], [['في البيت', 'fi l-beet'], ['في البيت', 'fi l-beet'], ['في البيت', 'fi l-beet'], 'үйдө']
  ].map((a) => ({ m: a[0], f: a[1], pl: a[2], ky: a[3] }));
  const pair = (x) => x[0] + '~' + x[1];

  /* ---------------------------- Widgets -------------------------------- */
  const WIDGETS = {
    article(el) {
      el.innerHTML = `<div class="panel"><div class="field"><span class="lbl">Сөздү тандаңыз: «il-» (ال) кантип айтылат?</span></div>
        <div class="seg" style="margin-bottom:12px">${NOUNS.slice(0, 24).map((n, i) => `<button data-i="${i}" lang="ar" translate="no">${esc(n.ar)}</button>`).join('')}</div>
        <div class="out" aria-live="polite"></div></div>`;
      const out = $('.out', el);
      const draw = (i) => {
        const n = NOUNS[i], a = KG.article(n), w = a.word.ar + '~' + a.word.ro;
        out.innerHTML = `<p style="font-size:1.4rem">${kgSpan(w)} ${sayBtn(w)} ${tl(w)}</p><p><b>${a.sun ? '☀ Күн тамгасы' : '☾ Ай тамгасы'}.</b> ${esc(a.why)}</p><p class="voice-note">${esc(n.ky)}</p>`;
      };
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { $$('[data-i]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(+b.dataset.i); } });
      draw(20);
    },
    possess(el) {
      el.innerHTML = `<div class="panel"><div class="field"><span class="lbl">Сөздү тандаңыз</span></div><div class="seg" style="margin-bottom:12px">${NOUNS.slice(0, 16).map((n, i) => `<button data-i="${i}" lang="ar" translate="no">${esc(n.ar)}</button>`).join('')}</div><div class="out" aria-live="polite"></div></div>`;
      const out = $('.out', el);
      const draw = (i) => {
        const n = NOUNS[i];
        out.innerHTML = `<div class="tbl-wrap"><table class="conj"><tbody>${KG.PERSONS.map((p) => { const r = KG.possess(n, p).word, w = r.ar + '~' + r.ro; return `<tr><td>${esc(KG.POSS[p].ky)} ${esc(n.ky)}</td><td>${kgSpan(w)} ${sayBtn(w)}<br>${tl(w)}</td></tr>`; }).join('')}</tbody></table></div>`;
      };
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) draw(+b.dataset.i); });
      draw(0);
    },
    conj(el) {
      const ids = ['katab', 'shirib', 'shaaf', 'mishi', 'kal', 'itkallim', '7abb', 'raa7'];
      let id = ids[0], t = (el.dataset.t || 'present');
      el.innerHTML = `<div class="panel"><div class="seg" style="margin-bottom:10px">${ids.map((v) => { const x = KG.verbById(v); return `<button data-v="${v}" lang="ar" translate="no" aria-pressed="${v === id}">${esc(x.pa[0])}</button>`; }).join('')}</div>
        <div class="seg" style="margin-bottom:12px">${Object.keys(KG.TENSES).map((k) => `<button data-t="${k}" aria-pressed="${k === t}">${esc(KG.TENSES[k].name)}</button>`).join('')}</div><div class="out" aria-live="polite"></div></div>`;
      const out = $('.out', el);
      const draw = () => {
        const c = KG.conjugate(id, t);
        out.innerHTML = `<p><b>${esc(c.verb.ky)}</b> · ${esc(KG.TENSES[t].name)}</p><div class="tbl-wrap"><table class="conj"><tbody>${c.rows.map((r) => { const w = r.ar + '~' + r.ro; return `<tr><td>${kgSpan(r.pr)} — ${esc(r.ky)}</td><td>${kgSpan(w)} ${sayBtn(w)}<br>${tl(w)}</td></tr>`; }).join('')}</tbody></table></div>`;
      };
      el.addEventListener('click', (e) => {
        const v = e.target.closest('[data-v]'); if (v) { id = v.dataset.v; $$('[data-v]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === v))); draw(); }
        const tt = e.target.closest('[data-t]'); if (tt) { t = tt.dataset.t; $$('[data-t]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === tt))); draw(); }
      });
      draw();
    },
    numbers(el) {
      el.innerHTML = `<div class="panel"><div class="field"><label for="nw">Санды жазыңыз</label><input id="nw" type="text" inputmode="numeric" value="1991" style="font-family:var(--f-ui)"></div><div class="out"></div>
        <div class="quiz-actions"><button class="btn btn-line btn-sm" data-r>Кокус сан</button></div></div>`;
      const inp = $('#nw', el), out = $('.out', el);
      const draw = () => {
        const n = parseInt(inp.value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, ''), 10);
        if (isNaN(n)) { out.innerHTML = '<p class="voice-note">Сандарды жазыңыз, мисалы 25 же 1991.</p>'; return; }
        const r = KG.number(Math.min(n, 999999999)), w = r.ar + '~' + r.ro, o = n > 0 && n <= 10 ? KG.ordinal(n) : null;
        out.innerHTML = `<p style="font-size:1.4rem">${kgSpan(w)} ${sayBtn(w)}<br>${tl(w)}</p><p class="voice-note">Араб цифралары менен: <span lang="ar" translate="no" style="font-size:1.4rem">${esc(KG.easternDigits(n))}</span>${o ? ` · иреттик сан: ${kgSpan(o.ar + '~' + o.ro)} ${tl(o.ar + '~' + o.ro)}` : ''}</p>`;
      };
      inp.addEventListener('input', draw);
      el.addEventListener('click', (e) => { if (e.target.closest('[data-r]')) { inp.value = [7, 15, 23, 48, 99, 120, 365, 1000, 2026, 450, 81][Math.floor(Math.random() * 11)] + Math.floor(Math.random() * 3); draw(); } });
      draw();
    },
    readdrill(el) {
      const words = (window.READ_DRILL || []);
      let i = 0;
      const draw = (show) => {
        const w = words[i % words.length];
        el.innerHTML = `<div class="panel" style="text-align:center"><p class="voice-note">Адегенде үн чыгарып окуңуз. Анан текшериңиз.</p>
          <p lang="ar" translate="no" dir="rtl" style="font-family:var(--f-kg);font-size:2.8rem;font-weight:600;margin:0">${esc(plain(w[0]))}</p>
          ${show ? `<p style="font-size:1.1rem">${tl(w[0])}<br><b>${esc(w[1])}</b> ${sayBtn(w[0])}</p>` : '<p>&nbsp;</p>'}
          <div class="quiz-actions" style="justify-content:center">${show ? '<button class="btn btn-ink btn-sm" data-n>Кийинки сөз</button>' : '<button class="btn btn-gold btn-sm" data-s>Текшерүү</button>'}</div></div>`;
      };
      el.addEventListener('click', (e) => { if (e.target.closest('[data-s]')) draw(true); if (e.target.closest('[data-n]')) { i++; draw(false); } });
      i = Math.floor(Math.random() * Math.max(1, words.length)); if (words.length) draw(false);
    }
  };
  function mountWidgets(root) { $$('[data-widget]', root).forEach((el) => WIDGETS[el.dataset.widget](el)); }

  /* ------------------------------ Quiz --------------------------------- */
  function keyboard() { return `<div class="kbd" dir="rtl" aria-label="Арабча клавиатура">${KG.KBD.map((k) => `<button type="button" data-key="${k}" lang="ar" translate="no" class="${KG.KBD_SPECIAL.includes(k) ? 'sp' : ''}">${k}</button>`).join('')}<button type="button" class="wide" data-key=" ">боштук</button><button type="button" class="wide" data-key="⌫">⌫ өчүрүү</button></div>`; }
  const isArOpt = (o) => hasAr(o) && !/[a-zа-яөүң]{3,}/i.test(String(o).replace(/\[\[.*?\]\]/g, '').replace(/<[^>]+>/g, ''));
  function optHTML(o) { return isArOpt(o) && !String(o).includes('[[') ? `${kgSpan(o)}${KG.roOf(o) ? ' ' + tl(o) : ''}` : rich(o); }

  function mountQuiz(el, qs, onFinish) {
    let i = 0, score = 0, done = false, wrong = [];
    function view() {
      if (i >= qs.length) return finish();
      done = false;
      const q = qs[i];
      let body = '';
      if (q.t === 'mc') {
        const opts = shuffle(q.o.map((o, k) => ({ o, k })));
        body = `<div class="opts">${opts.map((x) => `<button class="opt ${isArOpt(x.o) ? 'kgopt' : ''}" data-k="${x.k}">${optHTML(x.o)}</button>`).join('')}</div>`;
      } else if (q.t === 'type') {
        body = `<input class="type-in" type="text" dir="auto" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Жообуңуз" placeholder="Арабча же транскрипция менен жазыңыз">
          <div class="preview" aria-live="polite"></div>${keyboard()}
          <div class="quiz-actions"><button class="btn btn-ink" data-check>Текшерүү</button></div>`;
      } else if (q.t === 'order') {
        const words = plain(q.a).replace(/[.,!?؟،]/g, '').split(/\s+/).filter(Boolean);
        const tiles = shuffle(words.concat(q.extra || []));
        body = `<div class="tiles answer" dir="rtl" aria-label="Сиздин сүйлөм"></div><div class="tiles pool" dir="rtl">${tiles.map((w, k) => `<button class="tile" lang="ar" translate="no" data-tile="${k}">${esc(w)}</button>`).join('')}</div>
          <div class="quiz-actions"><button class="btn btn-ink" data-check>Текшерүү</button><button class="btn btn-line" data-clear>Тазалоо</button></div>`;
      }
      el.innerHTML = `<div class="quiz-top"><span class="count">${i + 1}-суроо, жалпы ${qs.length}</span><div class="bar" style="flex:1;max-width:240px"><i style="width:${(i / qs.length) * 100}%"></i></div></div>
        <div class="q">${rich(q.q)}${q.say ? ' ' + sayBtn(q.say) : ''}</div>${body}<div class="fb"></div>`;
      const inp = $('.type-in', el);
      if (inp) {
        inp.focus({ preventScroll: true });
        inp.addEventListener('input', () => { const v = inp.value; $('.preview', el).textContent = v && !hasAr(v) ? 'Транскрипция катары текшерилет. Арабча жазсаңыз, ого бетер жакшы!' : ''; });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done ? next() : checkType(); } });
      }
    }
    function feedback(kind, html) {
      const msg = { right: 'Туура!', wrong: 'Туура эмес.', almost: 'Дээрлик!' }[kind];
      $('.fb', el).innerHTML = `<div class="feedback ${kind}" role="status"><b>${msg}</b> ${html || ''}</div><div class="quiz-actions"><button class="btn btn-gold" data-next>${i + 1 < qs.length ? 'Кийинки суроо' : 'Жыйынтыкты көрүү'}</button></div>`;
      done = true;
      const nb = $('[data-next]', el); if (nb) nb.focus({ preventScroll: true });
    }
    function mark(ok) { if (ok) score++; else wrong.push(qs[i]); if (onFinish.onAnswer) onFinish.onAnswer(qs[i], ok); }
    function checkType() {
      const q = qs[i], inp = $('.type-in', el);
      const r = KG.check(inp.value, q.a);
      mark(r === 'right');
      const a0 = q.a[0];
      const ans = hasAr(a0) ? `Жообу: ${kgSpan(a0)} ${sayBtn(a0)} ${tl(a0)}` : `Жообу: <b>${esc(a0)}</b>`;
      const typedLatin = inp.value && !hasAr(inp.value) && hasAr(a0);
      feedback(r, (r === 'right' ? (typedLatin ? `${kgSpan(a0)} ${tl(a0)} — арабча ушинтип жазылат.` : '') : ans + (r === 'almost' ? ' — окшош тамгаларды текшериңиз (ص/س, ط/ت, ح/ه, ق/ء, ع/ا).' : '')) + (q.why ? `<br>${rich(q.why)}` : ''));
      inp.disabled = true;
    }
    function next() { i++; view(); }
    function finish() {
      const pct = qs.length ? score / qs.length : 1;
      const pass = pct >= 0.8;
      el.innerHTML = `<div style="text-align:center"><div class="score-big">${Math.round(pct * 100)}%</div>
        <p>${qs.length} суроонун ${score} туура. ${pass ? (onFinish.passText || 'Сабак бүттү — азаматсыз! Анын сөздөрү эми карточкаларыңызда.') : (onFinish.failText || 'Сабакты бүтүрүү үчүн 80% керек. Кыйын жерин кайра окуп, анан дагы аракет кылыңыз — эсте ошентип калат.')}</p>
        ${wrong.length ? `<div style="text-align:left;margin:14px 0"><h4>Булардын үстүнөн кайра иштеңиз</h4><ul>${wrong.map((q) => `<li>${rich(q.q)}${q.why ? `<br><span class="voice-note">${rich(q.why)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
        <div class="quiz-actions" style="justify-content:center"><button class="btn btn-line" data-retry>Кайра аракет</button>${onFinish.nextHref ? `<a class="btn btn-ink" href="${onFinish.nextHref}">Кийинки сабак</a>` : ''}</div></div>`;
      onFinish(pct, wrong);
    }
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-next]')) return next();
      if (t.closest('[data-retry]')) { i = 0; score = 0; wrong = []; return view(); }
      const q = qs[i];
      if (!q) return;
      const opt = t.closest('.opt');
      if (opt && !done && q.t === 'mc') {
        const ok = opt.dataset.k === '0';
        mark(ok);
        $$('.opt', el).forEach((b) => { b.disabled = true; if (b.dataset.k === '0') b.classList.add('right'); });
        if (!ok) opt.classList.add('wrong');
        if (hasAr(q.o[0]) && isArOpt(q.o[0])) say(q.o[0].replace(/\[\[|\]\]/g, ''));
        return feedback(ok ? 'right' : 'wrong', q.why ? rich(q.why) : '');
      }
      const key = t.closest('[data-key]');
      if (key && !done) {
        const inp = $('.type-in', el); const k = key.dataset.key;
        inp.value = k === '⌫' ? inp.value.slice(0, -1) : inp.value + k; inp.focus(); inp.dispatchEvent(new Event('input'));
        return;
      }
      const tile = t.closest('.tile');
      if (tile && !done) {
        const ans = $('.tiles.answer', el), pool = $('.tiles.pool', el);
        (tile.parentElement === pool ? ans : pool).appendChild(tile);
        return;
      }
      if (t.closest('[data-clear]') && !done) { const pool = $('.tiles.pool', el); $$('.tiles.answer .tile', el).forEach((x) => pool.appendChild(x)); return; }
      if (t.closest('[data-check]') && !done) {
        if (q.t === 'type') return checkType();
        if (q.t === 'order') {
          const built = $$('.tiles.answer .tile', el).map((x) => x.textContent).join(' ');
          const ok = KG.norm(built) === KG.norm(plain(q.a));
          mark(ok);
          return feedback(ok ? 'right' : 'wrong', (ok ? '' : `Жообу: ${kgSpan(q.a)} `) + sayBtn(q.a) + ' ' + tl(q.a) + (q.why ? `<br>${rich(q.why)}` : ''));
        }
      }
    });
    view();
  }

  /* ------------------------------ Views -------------------------------- */
  const stageMark = (n, color) => `<div class="stage-mark"><svg viewBox="0 0 88 88" aria-hidden="true"><path d="M44 6 82 76H6z" fill="${color}"/><path d="M44 22 66 64H22z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-dasharray="4 4"/></svg><span>${n}</span></div>`;
  const STAGE_COLORS = ['#8a5a00', '#c0532a', '#12355b', '#1d4e7e', '#1e7a4c', '#8f3a1a', '#0b2240'];

  function stageProgress(st) { const d = st.lessons.filter((l) => isDone(l.id)).length; return { d, t: st.lessons.length, pct: st.lessons.length ? d / st.lessons.length : 0 }; }
  function nextLesson() { return LESSONS.find((l) => !isDone(l.id)) || LESSONS[LESSONS.length - 1]; }
  const cleanKy = (s) => String(s || '').replace(/\[\[(.+?)\]\]/g, (m, t) => plain(t)).replace(/<[^>]+>/g, '');
  function allVocab() {
    const out = [], seen = new Set();
    LESSONS.forEach((l) => (l.blocks || []).forEach((b) => { if (b.t === 'vocab') b.items.forEach((v) => { const k = plain(v[0]); if (!seen.has(k)) { seen.add(k); out.push({ k, ro: KG.roOf(v[0]), en: cleanKy(v[1]), lesson: l }); } }); }));
    if (HOOKS.extraVocab) HOOKS.extraVocab().forEach((x) => { if (!seen.has(x.k)) { seen.add(x.k); out.push(x); } });
    return out;
  }
  // "ar~ro" for a vocabulary item (keeps the pronunciation attached)
  const full = (v) => v.ro ? v.k + '~' + v.ro : v.k;

  const CHAINS = [
    { name: 'Тамыр', steps: [
      { w: 'ك| - |ت| - |ب', c: [1, 0, 2, 0, 3], ro: 'k-t-b', ky: '«жазуу» деген идея', note: 'Араб сөздөрүнүн көбү үч тамгалуу <b>тамырдан</b> турат. ك-ت-ب — «жазуу». Тамыр — сөздүн жаны.' },
      { w: 'ك|ت|ب', c: [1, 2, 3], ro: 'katab', ky: 'ал жазды', note: 'Тамырга үндүүлөрдү кошсок: [[كتب~katab]] — «ал жазды». Үндүүлөр жазылбайт, бирок айтылат.' },
      { w: 'ك|ا|ت|ب', c: [1, 0, 2, 3], ro: 'kaatib', ky: 'жазуучу', note: 'Ортого узун «аа» салсак: [[كاتب~kaatib]] — «жазуучу». Бул калып (вазн) ар дайым «…уучу» дегенди билдирет.' },
      { w: 'م|ك|ت|ب', c: [0, 1, 2, 3], ro: 'maktab', ky: 'кеңсе, жазуу столу', note: 'Алдына «ма-» кошсок — орун: [[مكتب~maktab]] «жазылчу жер» = кеңсе. Кыргызча «мектеп» ушул сөздөн келген!' },
      { w: 'ك|ت|ا|ب', c: [1, 2, 0, 3], ro: 'kitaab', ky: 'китеп', note: '[[كتاب~kitaab]] — китеп. Кыргызчадагы «китеп» да ушул. Бир тамыр — ондогон сөз.' }] },
    { name: 'Этиш', steps: [
      { w: 'ي|كتب', c: [2, 0], ro: 'yiktib', ky: 'ал жазат (жөнөкөй форма)', note: '[[يكتب~yiktib]]: «ي» = «ал». Кыргызча «-т» сөздүн аягында болсо, арабчада адам башында турат.' },
      { w: 'ب|ي|كتب', c: [1, 2, 0], ro: 'biyiktib', ky: 'ал жазат / жазып жатат', note: '«ب» (bi-) кошулса — азыр же дайыма болуп жаткан иш: [[بيكتب~biyiktib]].' },
      { w: 'ب|ي|كتب|وا', c: [1, 2, 0, 3], ro: 'biyiktibu', ky: 'алар жазышат', note: 'Аягына «وا» (-u) кошулса — көптүк: [[بيكتبوا~biyiktibu]]. Кыргызчадагы «-ышат» сыяктуу.' },
      { w: 'ما |ب|ي|كتب|و|ش', c: [4, 1, 2, 0, 3, 4], ro: 'ma biyiktibuush', ky: 'алар жазышпайт', note: 'Тануу эки бөлүктөн турат: алдында «ما», аягында «ش». Ортодо этиш: [[ما بيكتبوش~ma biyiktibuush]]. Кыргызча «-бай» сыяктуу, бирок сөздү курчап алат.' }] }
  ];

  function home() {
    const nx = nextLesson();
    const started = Object.keys(store.d.done).length > 0;
    const vocabN = allVocab().length;
    main.innerHTML = `
    <section class="hero"><div class="wrap hero-grid">
      <div>
        <h1>Египет арабчасын нөлдөн үйрөнүңүз. Бир дагы арабча тамга тааныбасаңыз да.</h1>
        <p class="lede">Кыргыз тилдүүлөр үчүн толук жол: араб арибы, тыбыштар жана B2 деңгээлине чейинки бардык грамматика — жөнөкөй тил менен, ар дайым кыргызча менен катар салыштырылып.</p>
        <div class="cta-row">
          <a class="btn btn-gold" href="#lesson-${esc(nx.id)}">${started ? 'Улантуу: ' + esc(nx.title) : '1-сабакты баштоо'}</a>
          <a class="btn btn-ghost" href="#course">Бүт курсту көрүү</a>
        </div>
        <div class="hero-stats"><div><b>${COURSE.stages.length} баскыч</b>арип → B2</div><div><b>${LESSONS.length} сабак</b>тесттери менен</div><div><b>${vocabN}+ сөз</b>карточкаларда</div>${store.d.streak.count ? `<div><b>${store.d.streak.count} күн</b>катар окуп жатасыз</div>` : ''}</div>
      </div>
      <div class="builder" aria-live="polite">
        <div class="builder-top"><strong style="font-family:var(--f-display);font-size:.9rem">Арабча сөз кантип курулат</strong>
          <div class="tabs seg">${CHAINS.map((c, i) => `<button data-chain="${i}" aria-pressed="${i === 0}">${c.name}</button>`).join('')}</div></div>
        <div class="builder-word" dir="rtl" lang="ar" translate="no"></div>
        <div class="builder-en"></div>
        <div class="builder-note"></div>
        <div class="builder-ctrl"><button class="btn btn-ink btn-sm" data-add>Кийинки кадам</button><button class="btn btn-line btn-sm" data-reset>Башынан</button><button class="btn btn-line btn-sm" data-sayword>${ICON_SAY.replace('<svg', '<svg width="16" height="16"')} Угуу</button></div>
      </div>
    </div></section>

    <section class="section"><div class="wrap">
      <div class="section-head"><h2>Арабчаны ачып берчү алты идея</h2><p>Египет арабчасы кыргызчадан кыйын эмес — болгону логикасы башка жерде турат. Ушул алтоону түшүнсөңүз, ар бир кийинки сабак тааныш сезилет. Түстөр кайсы сөз кайсыга туура келерин көрсөтөт.</p></div>
      <div class="ideas">
        ${idea(1, 'Этиш ортодо турат', 'Кыргызча этишти эң аягына калтырат. Египет арабчасында этиш ээден кийин эле келет — орусча же англисчедегидей. Жазуу оңдон солго окулат.', [['Мен', 1], ['чай', 2], ['ичем', 3]], [['أنا~ana', 1], ['بشرب~bashrab', 3], ['شاي~shaay', 2]])}
        ${idea(2, 'Ээлик мүчө аягына жабышат — кыргызчадай!', '«Менин», «сенин» деген маани кыргызчадагыдай эле сөздүн аягына жабышат. Бул жерде эки тил бир тууган сыяктуу.', [['китеб', 1], ['-им', 2]], [['كتاب|ي~kitaabi', 0]], true)}
        ${idea(3, 'Үч тамгалуу тамыр', 'Ар бир сөздүн ичинде көбүнчө үч тамгалуу тамыр жашайт. ك-ت-ب = «жазуу». Ага ар кандай калып кийгизип, жаңы сөздөр жасалат.', [['жаз-', 1], ['жазуучу', 2], ['кеңсе', 3], ['китеп', 4]], [['كتب~katab', 1], ['كاتب~kaatib', 2], ['مكتب~maktab', 3], ['كتاب~kitaab', 4]])}
        ${idea(4, '«Менде бар» — так кыргызчадай', 'Кыргызча «менде китеп бар» дейбиз. Египеттиктер дагы ушинтип айтышат: [[عندي~3andi]] = «менде». «Have» деген өзүнчө этиш жок.', [['Менде', 1], ['китеп', 2], ['бар', 1]], [['عندي~3andi', 1], ['كتاب~kitaab', 2]])}
        ${idea(5, 'Сын атооч заттан кийин', 'Кыргызча «чоң үй» дейбиз, арабча тескерисинче: «үй чоң» — [[بيت كبير~beet kibiir]]. Сын атооч заттын жынысына да ылайыкташат.', [['чоң', 2], ['үй', 1]], [['بيت~beet', 1], ['كبير~kibiir', 2]])}
        ${idea(6, 'Эркек жана аял тек', 'Кыргызчада «ал», «сен» баарына бирдей. Арабчада «сен» экиге бөлүнөт: [[إنت~inta]] эркекке, [[إنتي~inti]] аялга. Аял тектүү сөздөр көбүнчө ة (-а) менен бүтөт.', [['Сен', 1], ['чарчадыңбы?', 2]], [['إنتي~inti', 1], ['تعبانة؟~ta3baana?', 2]])}
      </div>
    </div></section>

    <section class="section" style="padding-top:0"><div class="wrap">
      <div class="section-head"><h2>Нөлдөн B2ге чейинки жол</h2><p>Жети баскыч, ырааты менен. Ар бир сабак кыска тест менен бүтөт; 80% алсаңыз, сабак бүттү деп белгиленет. Күнүнө 30–60 мүнөт окусаңыз, болжол менен 8–10 айда B1ге, бир жарым жылда B2ге жетесиз.</p></div>
      ${roadmap(true)}
    </div></section>

    <section class="section" style="padding-top:0"><div class="wrap">
      <div class="section-head"><h2>Күн сайын колдоночу куралдар</h2></div>
      <div class="tools">
        <a class="tool big" href="#machine"><span class="glyph" lang="ar" translate="no">كتاب<span style="color:#fff">ي</span></span><h3>Сөз машинасы</h3><p>Сөздү тандаңыз — машина «менин китебим», «биз жаздык», «алар жазышпайт» сыяктуу формаларды курат жана ар бир тамганын себебин кыргызча түшүндүрөт.</p></a>
        <a class="tool" href="#alphabet"><span class="glyph" lang="ar" translate="no">أ ب ت</span><h3>Арип</h3><p>28 тамга, тыбыштары, формалары жана окуу машыгуусу.</p></a>
        <a class="tool" href="#review"><span class="glyph">↻</span><h3>Кайталоо</h3><p>Акылдуу кайталоо, карточкалар жана сүйлөө машыгуусу. Сөздөр унутаар алдында кайра келет.</p></a>
        <a class="tool" href="#library"><span class="glyph" lang="ar" translate="no">حكاية</span><h3>Китепкана</h3><p>A1ден B2ге чейинки аңгемелер жана өз тексттериңиз. Каалаган сөздү басыңыз.</p></a>
        <a class="tool" href="#cheatsheet"><span class="glyph">±</span><h3>Шпаргалка</h3><p>Бардык мүчөлөр жана формалар бир бетте.</p></a>
      </div>
      <a class="ar-band" href="#tektesh"><div><h3 style="margin:0 0 4px">Кыргызча билесизби? Анда жүздөгөн арабча сөздү билесиз.</h3><span>Тизмени, тыбыш өзгөрүү эрежелерин жана «жалган досторду» көрүңүз.</span></div><span class="ar-big" lang="ar" translate="no" dir="rtl">كتاب ← китеп</span></a>
    </div></section>`;
    const dash = HOOKS.dashboard && HOOKS.dashboard();
    if (dash) { $('.hero', main).outerHTML = dash.html; if (dash.mount) dash.mount(main); } else builder();
  }

  function idea(n, title, text, ky, ar, chainAr) {
    const row = (arr, cls) => `<div class="row ${cls}" ${cls === 'kgrow' ? 'dir="rtl"' : ''}>${arr.map((w) => `<span class="w c${w[1]}" ${cls === 'kgrow' ? 'lang="ar" translate="no"' : ''}>${cls === 'kgrow' ? chips(w[0]) : esc(w[0])}</span>`).join('')}</div>`;
    return `<article class="idea"><h3><span class="n">${n}</span>${esc(title)}</h3><p>${rich(text)}</p>
      <div class="mirror"><span class="lab">Кыргызча</span>${row(ky, '')}<span class="lab">Египет арабчасы</span>${chainAr ? `<div class="row kgrow" dir="rtl"><span class="w c0" lang="ar" translate="no" style="font-family:var(--f-kg)">${chips(ar[0][0])}</span></div>` : row(ar, 'kgrow')}<div class="tl" translate="no" style="margin-top:4px">${esc(ar.map((w) => KG.pron(w[0], store.d.tls)).join(' '))}</div></div></article>`;
  }

  function builder() {
    const box = $('.builder'); if (!box) return;
    let c = 0, step = 0, timer = null;
    const word = $('.builder-word', box), en = $('.builder-en', box), note = $('.builder-note', box);
    const draw = () => {
      const ch = CHAINS[c];
      const st = ch.steps[step - 1];
      if (!st) { word.innerHTML = '<span style="color:var(--line)">…</span>'; en.innerHTML = ''; note.innerHTML = '«Кийинки кадам» баскычын басыңыз.'; }
      else {
        const parts = st.w.split('|');
        word.innerHTML = parts.map((p, i) => { const zl = i > 0 && joins(parts[i - 1].slice(-1)) ? '‍' : ''; const zr = i < parts.length - 1 && joins(p.slice(-1)) ? '‍' : ''; return `<span class="m m${st.c[i]}">${zl}${esc(p)}${zr}</span>`; }).join('');
        en.innerHTML = `<span class="m m0" style="background:var(--mist)">${esc(KG.pron('x~' + st.ro, store.d.tls))}</span> <span class="m m1">${esc(st.ky)}</span>`;
        note.innerHTML = rich(st.note);
      }
      $('[data-add]', box).disabled = step >= ch.steps.length;
      $$('[data-chain]', box).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.chain === c)));
    };
    const auto = () => {
      clearInterval(timer);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { step = CHAINS[c].steps.length; draw(); return; }
      step = 1; draw();
      timer = setInterval(() => { if (step >= CHAINS[c].steps.length) return clearInterval(timer); step++; draw(); }, 2600);
    };
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) { clearInterval(timer); step = Math.min(step + 1, CHAINS[c].steps.length); draw(); }
      if (e.target.closest('[data-reset]')) { clearInterval(timer); step = 0; draw(); }
      if (e.target.closest('[data-sayword]')) { const st = CHAINS[c].steps[step - 1]; if (st) say(st.w.replace(/\|/g, '')); }
      const t = e.target.closest('[data-chain]'); if (t) { c = +t.dataset.chain; auto(); }
    });
    auto();
  }

  function roadmap(compact) {
    return `<div class="road">${COURSE.stages.map((st, si) => {
      const p = stageProgress(st);
      return `<div class="stage">${stageMark(st.n, STAGE_COLORS[si % STAGE_COLORS.length])}<div class="stage-body">
        <header><h3>${esc(st.title)} <span class="kg" lang="ar" translate="no" style="font-weight:500;color:var(--muted);font-size:.85em">· ${esc(plain(st.ar))}</span></h3><span class="lvl">${esc(st.level)}</span></header>
        <p class="blurb">${rich(st.blurb)}</p>
        <div class="bar" aria-label="${p.t} сабактын ${p.d} бүттү"><i style="width:${p.pct * 100}%"></i></div>
        <ol class="lesson-list">${st.lessons.map((l) => `<li class="${isDone(l.id) ? 'done' : ''}"><a href="#lesson-${esc(l.id)}"><span class="num">${esc(l.num)}</span><span class="t">${esc(l.title)}${l.ar && !compact ? `<small lang="ar" translate="no">${esc(plain(l.ar))}</small>` : ''}</span></a></li>`).join('')}</ol>
      </div></div>`;
    }).join('')}</div>`;
  }

  function course() {
    const done = LESSONS.filter((l) => isDone(l.id)).length;
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Курс</h1><div class="kgt" lang="ar" translate="no">الكورس</div>
      <p>${COURSE.stages.length} баскычта ${LESSONS.length} сабак. Сиз ${done} сабакты бүтүрдүңүз. Ырааты менен окуңуз — ар бир сабак мурункуларга таянат. Арабча окуй аласызбы? 1-баскычтын тесттерин тез өтүп, андан ары жылыңыз.</p></div></header>
      <div class="wrap" style="padding:40px 0 80px">${HOOKS.courseTop ? HOOKS.courseTop() : ''}${roadmap(false)}
      <div class="tip" style="margin-top:20px"><div class="tag">Жетишкендиктерди тазалоо</div><p>Кирбесеңиз, жетишкендиктер ушул браузерде гана сакталат. <button class="btn btn-line btn-sm" data-act="reset">Жетишкендиктеримди өчүрүү</button></p></div></div>`;
  }

  function lesson(id) {
    const L = byId(id);
    if (!L) return notFound();
    const idx = LESSONS.indexOf(L), prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
    const sections = []; let cur = null;
    (L.blocks || []).forEach((b) => {
      if (b.t === 'h') { cur = { title: b.text, id: 's' + sections.length, blocks: [] }; sections.push(cur); return; }
      if (!cur) { cur = { title: 'Баштайлы', id: 's0', blocks: [] }; sections.push(cur); }
      cur.blocks.push(b);
    });
    const score = store.d.done[id];
    main.innerHTML = `<header class="page-head"><div class="wrap">
      <div class="crumbs"><a href="#course">Курс</a> › ${L.stage.n}-баскыч: ${esc(L.stage.title)}</div>
      <h1>${esc(L.num)} ${esc(L.title)}</h1>${L.ar ? `<div class="kgt" lang="ar" translate="no" dir="rtl">${esc(plain(L.ar))}</div>` : ''}
      ${L.goals ? `<ul class="goals">${L.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
      <div class="meta-row"><span class="lvl" style="background:var(--gold);color:var(--indigo-ink)">${esc(L.stage.level)}</span><span style="color:#cfd6ee;font-size:.9rem">${L.minutes || 25} мүнөт</span>${L.book ? `<a class="pill" href="#plan" style="text-decoration:none" title="Бул сабак Kallimni ʿArabi Bishweesh китебинин ${L.book}-модулунун темасын камтыйт">Kallimni ʿArabi Bishweesh · ${L.book}-модуль</a>` : ''}${score != null ? `<span class="pill ${score >= .8 ? 'ok' : ''}">${score >= .8 ? 'Бүттү' : 'Эң жакшы жыйынтык'} · ${Math.round(score * 100)}%</span>` : ''}</div>
    </div></header>
    <div class="wrap lesson-grid">
      <aside class="toc"><h4>Бул сабакта</h4><ol>${sections.map((s) => `<li><a href="#lesson-${esc(id)}" data-jump="${s.id}">${esc(cleanKy(s.title))}</a></li>`).join('')}<li><a href="#lesson-${esc(id)}" data-jump="practice">Тест</a></li></ol>
      <p class="voice-note">Угуу үчүн каалаган <span class="kg" lang="ar" translate="no" style="border-bottom:1.5px dotted">арабча сөздү</span> басыңыз.</p></aside>
      <article class="lesson-body">
        ${FL[id] ? `<aside class="ar-logic"><div class="tag"><span class="badge" aria-hidden="true">ف</span>Египетче жана фусха</div><p>${arWrap(rich(FL[id]))}</p></aside>` : ''}
        ${sections.map((s) => `<section id="${s.id}"><h2>${rich(esc(s.title))}</h2>${s.blocks.map((b) => (BLOCK[b.t] ? BLOCK[b.t](b) : '')).join('')}</section>`).join('')}
        <section id="practice"><h2>Тест</h2><p>${(L.quiz || []).length} суроо. Сабакты бүтүрүү үчүн 80% алыңыз.</p><div class="quiz"></div></section>
        <nav class="lesson-nav" aria-label="Сабактар боюнча навигация">${prev ? `<a href="#lesson-${esc(prev.id)}"><small>Мурунку</small>${esc(prev.num)} ${esc(prev.title)}</a>` : ''}${next ? `<a class="next" href="#lesson-${esc(next.id)}"><small>Кийинки</small>${esc(next.num)} ${esc(next.title)}</a>` : ''}</nav>
      </article></div>`;
    mountWidgets(main);
    const qel = $('.quiz', main);
    if (L.quiz && L.quiz.length) {
      const cb = (pct, wrong) => { const was = store.d.done[id] || 0; store.d.done[id] = Math.max(was, pct); store.addXP(was >= 0.8 ? 3 : 5 + pct * 20, 'lesson'); if (HOOKS.onQuizDone) HOOKS.onQuizDone(L, pct, wrong); };
      cb.nextHref = next ? '#lesson-' + next.id : '';
      mountQuiz(qel, L.quiz, cb);
    } else qel.innerHTML = '<p>Бул сабакта тест жок. <button class="btn btn-ink btn-sm" data-act="markdone" data-id="' + esc(id) + '">Бүттү деп белгилөө</button></p>';
  }

  function alphabet() {
    const A = window.ALPHABET || [];
    const groups = [
      ['friend', 'Кыргызчадагыдай тыбыштар', 'Бул тамгалардын тыбышын сиз мурунтан билесиз: б, т, д, р, з, с, ш, ф, к, л, м, н… Жаңы болгону — алардын формасы.'],
      ['trap', 'Египетче өзгөчө айтылгандар', 'Бул тамгалар Египетте адабий арабчадан башкача айтылат. Каирде ج — «г», ق — тамак тыгылуусу (ʼ).'],
      ['new', 'Тамак тыбыштары', 'Кыргызчада жок тыбыштар. Алар тамактын терең жеринен чыгат. Башында кыйын, бирок бир жумада көнөсүз.'],
      ['special', 'Оор (калың) тамгалар', 'ص ض ط ظ — с, д, т, з тыбыштарынын «оор», калың варианттары. Тил артка тартылып, жанындагы үндүүлөр да калыңдайт.'],
      ['loan', 'Үндүүлөр жана кошумча белгилер', 'Узун үндүүлөр ا و ي менен жазылат, кыскалары көбүнчө жазылбайт. ة, ى, ء сыяктуу белгилерди да ушул жерден таанышыңыз.']
    ];
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Арип</h1><div class="kgt" lang="ar" translate="no">الحروف العربية · ٢٨ حرف</div>
      <p>Араб арибинде 28 тамга бар, алар оңдон солго жазылат. Тамгалар бири-бирине жабышат, ошондуктан ар биринин сөздүн башында, ортосунда жана аягында башкача формасы бар. Кыска үндүүлөр көбүнчө жазылбайт — ошондуктан бул курста ар бир арабча сөздүн астында кыргызча окулушу турат. Угуу үчүн тамганы басыңыз.</p></div></header>
      <div class="wrap" style="padding:40px 0 80px">
      ${groups.map((g) => `<section style="margin-bottom:36px"><h2>${esc(g[1])}</h2><p style="color:var(--muted)">${esc(g[2])}</p><div class="letters">${A.filter((x) => x.g === g[0]).map((x) => letterCard(x.l)).join('')}</div></section>`).join('')}
      <section class="cols-2"><div><h2>Узун жана кыска үндүүлөр</h2><p>Узун үндүү (ا و ي) маанини өзгөртөт — шашпаңыз. Кыргызчадагы «тоо» менен «то» сыяктуу:</p>
        ${BLOCK.ex({ items: [['كتب~katab', 'ал жазды'], ['كاتب~kaatib', 'жазуучу'], ['جمل~gamal', 'төө'], ['جميل~gamiil', 'сулуу'], ['سكر~sukkar', 'кант'], ['سكران~sakraan', 'мас']] })}</div>
        <div><h2>Окуу машыгуусу</h2><p>Чыныгы сөздөр, кокус тартипте. Ар бирин текшерүүдөн мурун үн чыгарып окуңуз.</p><div data-widget="readdrill"></div></div></section>
      </div>`;
    mountWidgets(main);
  }

  /* ----------------------------- Machine ------------------------------- */
  function machine() {
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Сөз машинасы</h1><div class="kgt" lang="ar" translate="no">ماكينة الكلام</div>
      <p>Сөздү жана формасын тандаңыз — машина египетче форманы курат жана ар бир тамга эмне үчүн ушундай экенин кадам-кадам түшүндүрөт.</p></div></header>
      <div class="wrap"><div class="seg" role="tablist" style="padding-top:28px">${[['nouns', 'Зат атооч'], ['verbs', 'Этиш'], ['tobe', 'Сын атооч жана «бол»'], ['numbers', 'Сандар']].map((t, i) => `<button role="tab" data-tab="${t[0]}" aria-pressed="${i === 0}">${t[1]}</button>`).join('')}</div><div id="mach"></div></div>`;
    const mach = $('#mach');
    const tabs = { nouns: machNouns, verbs: machVerbs, tobe: machToBe, numbers: (el) => { el.innerHTML = '<div style="padding:28px 0 80px;max-width:640px"><div data-widget="numbers"></div></div>'; mountWidgets(el); } };
    main.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (!t) return; $$('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); tabs[t.dataset.tab](mach); });
    machNouns(mach);
  }

  function segBtns(name, list, cur) { return `<div class="seg" data-seg="${name}">${list.map((x) => `<button data-v="${x[0]}" aria-pressed="${String(x[0] === cur)}">${esc(x[1])}</button>`).join('')}</div>`; }
  const pickList = (list, cur, label) => `<div class="field"><label class="lbl">${label}</label><div class="seg pick-list" dir="rtl">${list.map((x, i) => `<button data-pick="${i}" lang="ar" translate="no" aria-pressed="${i === cur}" title="${esc(x.ky)}">${esc(x.ar || x.m[0])}</button>`).join('')}</div></div>`;

  function machNouns(el) {
    const st = { i: 0, poss: '', art: '', num: '' };
    el.innerHTML = `<div class="machine"><div class="panel">
      ${pickList(NOUNS, 0, 'Зат атооч')}
      <div class="field"><span class="lbl">Канча?</span>${segBtns('num', [['', 'Бирөө'], ['dual', 'Экөө (-een)'], ['pl', 'Көп (көптүк)']], st.num)}</div>
      <div class="field"><span class="lbl">Кимдики?</span>${segBtns('poss', [['', 'эч кимдики'], ['ana', 'менин'], ['inta', 'сенин (эр.)'], ['inti', 'сенин (аял)'], ['huwwa', 'анын (эр.)'], ['hiyya', 'анын (аял)'], ['i7na', 'биздин'], ['intu', 'силердин'], ['humma', 'алардын']], st.poss)}</div>
      <div class="field"><span class="lbl">Аныктык</span>${segBtns('art', [['', 'жөнөкөй (бир…)'], ['il', 'аныкталган: «il-» (ال)']], st.art)}</div>
      </div><div class="panel" aria-live="polite"><div class="res"></div></div></div>`;
    const res = $('.res', el);
    const draw = () => {
      const n = NOUNS[st.i];
      const steps = [];
      let w = { ar: n.ar, ro: n.ro }, ky = n.ky;
      steps.push(`Негиз: ${kgSpan(n.ar + '~' + n.ro)} ${tl(n.ar + '~' + n.ro)} — «${esc(n.ky)}». ${n.g === 'f' ? 'Аял тектүү сөз' + (/ة$/.test(n.ar) ? ' (ة менен бүтөт).' : ' (ة жок болсо да).') : 'Эркек тектүү сөз.'}`);
      if (st.num === 'dual') { w = KG.dual(w); ky = 'эки ' + ky; steps.push(`Эки нерсе үчүн өзүнчө форма бар: аягына -een (ين) кошулат${/ة$/.test(n.ar) ? ', ة болсо «т» болуп ачылат' : ''}. Кыргызчада «эки китеп» дейбиз, арабча бир эле сөз жетиштүү.`); }
      if (st.num === 'pl') {
        if (n.pl) { w = { ar: KG.arOf(n.pl), ro: KG.roOf(n.pl) }; ky = ky + 'тар'; steps.push(/(aat|iin)$/.test(w.ro) ? `Көптүк мүчө: -${w.ro.endsWith('aat') ? 'aat (ات)' : 'iin (ين)'} кошулат.` : '«Сынык көптүк»: мүчө кошулбайт, сөздүн ичиндеги үндүүлөр өзгөрөт. Мындай көптүктү сөз менен кошо жаттап алуу керек.'); }
        else steps.push('Бул сөз көбүнчө көптүк түрдө колдонулбайт.');
      }
      if (st.poss) {
        const r = KG.possess(w, st.poss);
        r.steps.forEach((s) => steps.push(esc(s.why)));
        w = r.word; ky = KG.POSS[st.poss].ky + ' ' + ky;
      }
      if (st.art) {
        if (st.poss) steps.push('Ээлик мүчөсү бар сөзгө «il-» кошулбайт — ал мурунтан эле аныкталган. Кыргызчадагыдай: «менин китебим» өзү эле так.');
        else { const a = KG.article(w); steps.push(esc(a.why)); w = a.word; ky = 'ошол ' + ky; }
      }
      const W = w.ar + '~' + w.ro;
      res.innerHTML = `<div class="result-word">${kgSpan(W)} ${sayBtn(W)}</div>${tl(W)}
        <p style="font-size:1.15rem;margin-top:8px"><b>${esc(ky)}</b></p>
        <ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        <h3 style="margin-top:24px">Бардык ээлик формалары</h3>
        <div class="tbl-wrap"><table class="conj"><tbody>${KG.PERSONS.map((p) => { const r = KG.possess({ ar: n.ar, ro: n.ro }, p).word, x = r.ar + '~' + r.ro; return `<tr><td>${esc(KG.POSS[p].ky)}</td><td>${kgSpan(x)} ${sayBtn(x)} ${tl(x)}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="voice-note">Машина негизги эрежелерди колдонот. Кээ бир сөздөр өзгөчө: [[أبو~abu]] (ата) → [[أبويا~abuuya]] «менин атам». Сабактар мындайларды өзүнчө көрсөтөт.</p>`;
    };
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-pick]'); if (p) { st.i = +p.dataset.pick; $$('[data-pick]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === p))); draw(); return; }
      const b = e.target.closest('[data-seg] [data-v]'); if (!b) return;
      const seg = b.parentElement.dataset.seg; st[seg] = b.dataset.v;
      $$('button', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw();
    });
    draw();
  }

  function machVerbs(el) {
    const st = { i: 0, t: 'present' };
    const V = KG.VERBS.map((v) => ({ ar: v.pa[0], ky: v.ky, id: v.id }));
    el.innerHTML = `<div class="machine"><div class="panel">
      ${pickList(V, 0, 'Этиш (өткөн чак, «ал» формасы)')}
      <div class="field"><span class="lbl">Форма</span>${segBtns('t', Object.keys(KG.TENSES).map((k) => [k, KG.TENSES[k].name]), st.t)}</div>
      </div><div class="panel" aria-live="polite"><div class="res"></div></div></div>`;
    const res = $('.res', el);
    const WHY = {
      past: 'Өткөн чакта адам <b>аягына</b> жабышат: -t (мен, сен), -ti (сен, аял), -it (ал, аял), -na (биз), -tu (силер), -u (алар). «Ал (эркек)» — эч мүчөсүз негизги форма. Кыргызча «жаз-ды-м» сыяктуу эле!',
      bare: 'Учур чактын «жылаңач» формасында адам <b>башында</b> турат: a- (мен), ti- (сен, ал аял), yi- (ал эркек, алар), ni- (биз). Бул форма [[لازم~laazim]] «керек», [[عايز~3aayiz]] «каалайм», [[ممكن~mumkin]] «мүмкүн» сөздөрүнөн кийин колдонулат.',
      present: '«bi-» кошулса, иш азыр болуп жатат же дайыма болот: [[بيكتب~biyiktib]] = «жазат / жазып жатат». «Мен» формасында ba- болуп кыскарат: [[بكتب~baktib]].',
      future: '«ha-» кошулса — келер чак: [[هيكتب~hayiktib]] «жазат (кийин)». «Мен» формасында: [[هكتب~haktib]].',
      pastNeg: 'Тануу этишти курчап алат: алдында [[ما~ma]], аягында [[ش~sh]]. Аягы үндүү менен бүтсө, ал үндүү узарат: katabu → ma katabuush.',
      presentNeg: 'Учур чакта да ma…sh: [[ما بيكتبش~ma biyiktibsh]]. Келер чак башкача: [[مش هيكتب~mish hayiktib]] — «mish» колдонулат.',
      imperative: 'Буйрук «жылаңач» формадан башкы ti-/yi- түшүп калып жасалат: tiktib → [[اكتب~iktib]]! Аялга -i, көпкө -u. «Болбо» деген тыюу: [[ما تكتبش~ma tiktibsh]].'
    };
    const draw = () => {
      const v = KG.VERBS[st.i];
      const c = KG.conjugate(v.id, st.t);
      res.innerHTML = `<h3>${kgSpan(v.pa[0] + '~' + v.pa[1])} «${esc(v.ky)}» — ${esc(KG.TENSES[st.t].name)}</h3><p class="voice-note">${rich(WHY[st.t])}</p>
        <div class="tbl-wrap"><table class="conj"><tbody>${c.rows.map((r) => { const w = r.ar + '~' + r.ro; return `<tr><td>${kgSpan(r.pr)} ${tl(r.pr)}<br><span class="voice-note">${esc(r.ky)}</span></td><td>${kgSpan(w)} ${sayBtn((st.t === 'imperative' ? '' : KG.arOf(r.pr) + ' ') + r.ar)}<br>${tl(w)}</td></tr>`; }).join('')}</tbody></table></div>
        ${v.ap ? `<p class="voice-note">Активдүү атоочтук (азыр …уп турган / …уучу): ${kgSpan(v.ap[0] + '~' + v.ap[1])} ${tl(v.ap[0] + '~' + v.ap[1])}. Египеттиктер муну абдан көп колдонушат: [[أنا رايح~ana raayi7]] «мен бара жатам».</p>` : ''}
        ${v.irr ? '<div class="tip"><div class="tag">Өзгөчө этиш</div><p>Бул этиш эрежеден бир аз чыгат — анын формаларын жаттап алыңыз. Бактыга жараша, мындай этиштер аз.</p></div>' : ''}`;
    };
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-pick]'); if (p) { st.i = +p.dataset.pick; $$('[data-pick]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === p))); draw(); return; }
      const b = e.target.closest('[data-seg] [data-v]'); if (!b) return;
      st.t = b.dataset.v; $$('button', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw();
    });
    draw();
  }

  function machToBe(el) {
    const st = { i: 0 };
    el.innerHTML = `<div class="machine"><div class="panel">${pickList(ADJ, 0, 'Сын атооч же сөз')}
      <p class="voice-note" style="margin-top:16px">Египет арабчасында учур чакта «-мын, -сың» сыяктуу байламта жок: [[أنا تعبان~ana ta3baan]] — «мен чарчадым». Бирок сын атооч адамдын жынысына жана санына ылайыкташат: эркек, аял, көптүк.</p></div>
      <div class="panel" aria-live="polite"><div class="res"></div></div></div>`;
    const res = $('.res', el);
    const draw = () => {
      const a = ADJ[st.i];
      res.innerHTML = `<p><b>${esc(a.ky)}</b>: эркек ${kgSpan(pair(a.m))}, аял ${kgSpan(pair(a.f))}, көптүк ${kgSpan(pair(a.pl))}</p><div class="tbl-wrap"><table class="conj"><thead><tr><th>Ким</th><th>азыр</th><th>тануу</th><th>өткөндө</th><th>келечекте</th></tr></thead><tbody>${KG.PERSONS.map((p) => {
        const f = KG.agree(a, p), pr = KG.PRONOUN[p];
        const pos = KG.arOf(pr) + ' ' + f[0] + '~' + KG.roOf(pr) + ' ' + f[1];
        const neg = KG.arOf(pr) + ' مش ' + f[0] + '~' + KG.roOf(pr) + ' mish ' + f[1];
        const past = KG.arOf(pr) + ' ' + KG.KAAN[p][0] + ' ' + f[0] + '~' + KG.roOf(pr) + ' ' + KG.KAAN[p][1] + ' ' + f[1];
        const fut = KG.arOf(pr) + ' ' + KG.HAYKUUN[p][0] + ' ' + f[0] + '~' + KG.roOf(pr) + ' ' + KG.HAYKUUN[p][1] + ' ' + f[1];
        return `<tr><td>${kgSpan(pr)}<br><span class="voice-note">${esc(KG.PERSON_KY[p])}</span></td><td>${kgSpan(pos)} ${sayBtn(pos)}<br>${tl(pos)}</td><td>${kgSpan(neg)}<br>${tl(neg)}</td><td>${kgSpan(past)}<br>${tl(past)}</td><td>${kgSpan(fut)}<br>${tl(fut)}</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="voice-note">«Эмес» = [[مش~mish]]. Өткөн чак үчүн [[كان~kaan]] «болчу», келечек үчүн [[هيكون~haykuun]] «болот» кошулат. Суроо үчүн эч нерсе кошулбайт — үнүңүздү гана көтөрөсүз: [[إنت تعبان؟~inta ta3baan?]]</p>`;
    };
    el.addEventListener('click', (e) => { const p = e.target.closest('[data-pick]'); if (p) { st.i = +p.dataset.pick; $$('[data-pick]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === p))); draw(); } });
    draw();
  }

  /* ---------------------------- Flashcards ----------------------------- */
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90]; // days per box
  function cards() {
    const all = allVocab();
    let scope = sessionStorageGet('kg-scope') || 'done';
    let reverse = sessionStorageGet('kg-rev') === '1';
    const pool = () => all.filter((c) => scope === 'all' || (scope === 'done' ? (c.mine || isDone(c.lesson.id)) : scope === 'mine' ? c.mine : String(c.lesson.stage.n) === scope));
    const due = () => pool().filter((c) => { const s = store.d.srs[c.k]; return !s || s.due <= Date.now(); });
    let queue = [], cur = null, flipped = false;
    const build = () => {
      const d = due();
      const fresh = d.filter((c) => !store.d.srs[c.k]).slice(0, 15);
      const old = d.filter((c) => store.d.srs[c.k]);
      queue = shuffle(old).concat(fresh);
    };
    const boxes = () => { const b = [0, 0, 0, 0, 0, 0, 0]; pool().forEach((c) => { const s = store.d.srs[c.k]; if (s) b[Math.min(s.box, 6)]++; }); return b; };
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Карточкалар</h1><div class="kgt" lang="ar" translate="no">كروت</div>
      <p>Ар бир сөз унутаар алдында кайра келет: 1 күндөн, анан 3, 7, 16, 35 жана 90 күндөн кийин. Карточканы бурардан мурун жоопту үн чыгарып айтыңыз — эсте сактоону таанып билүү эмес, эстеп чыгаруу бекемдейт.</p></div></header>
      <div class="wrap"><div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding-top:26px">
        <div class="seg" data-scope>${[['done', 'Бүткөн сабактар + менин сөздөрүм'], ['all', 'Бардык сөздөр'], ['mine', 'Менин сөздөрүм']].concat(COURSE.stages.map((s) => [String(s.n), s.n + '-баскыч'])).map((x) => `<button data-v="${x[0]}" aria-pressed="${x[0] === scope}">${esc(x[1])}</button>`).join('')}</div>
        <div class="seg"><button data-rev aria-pressed="${reverse}">Адегенде кыргызча</button></div></div>
        <div class="deck"></div></div>`;
    const deck = $('.deck');
    const draw = () => {
      if (!cur) cur = queue.shift();
      if (!cur) {
        const p = pool();
        deck.innerHTML = `<div class="card"><div class="front en" style="font-size:1.5rem">${p.length ? 'Баары кайталанды.' : 'Бул жерде азырынча сөз жок.'}</div><p class="from">${p.length ? `Бул ${p.length} сөздүн ичинен азыр кайталай турган сөз жок. Эртең келиңиз же «Бардык сөздөрдү» тандаңыз.` : 'Сабактын тестин бүтүрсөңүз, анын сөздөрү ушул жерге келет. Же «Бардык сөздөрдү» тандаңыз.'}</p></div>
          <div class="boxes">${boxes().map((n, i) => i ? `<span>${i}-куту: ${n}</span>` : '').join('')}</div>`;
        return;
      }
      const F = full(cur);
      const front = reverse ? `<div class="front en">${esc(cur.en)}</div>` : `<div class="front" lang="ar" translate="no" dir="rtl">${esc(cur.k)}</div>${tl(F)}`;
      const back = (reverse ? `<div class="front" lang="ar" translate="no" dir="rtl" style="font-size:2.4rem">${esc(cur.k)}</div>${tl(F)}` : `<div class="back">${esc(cur.en)}</div>`) + arHint(cur.k);
      deck.innerHTML = `<div class="card">${front}${flipped ? `<hr style="width:60%;border:0;border-top:1px dashed var(--line)">${back}` : ''}
        <div>${sayBtn(cur.k)}</div><p class="from">${esc(cur.lesson.num)} ${esc(cur.lesson.title)} сабагынан · бул сеанста дагы ${queue.length}</p></div>
        <div class="grade">${flipped ? `<button class="btn btn-line" data-g="0">Кайра</button><button class="btn btn-line" data-g="1">Кыйын</button><button class="btn btn-ink" data-g="2">Жакшы</button><button class="btn btn-gold" data-g="3">Оңой</button>` : '<button class="btn btn-ink" data-flip>Жоопту көрсөтүү</button>'}</div>
        <div class="boxes">${boxes().map((n, i) => i ? `<span>${i}-куту: ${n}</span>` : '').join('')}</div>`;
      if (!reverse && !flipped) say(cur.k);
    };
    main.addEventListener('click', (e) => {
      const sc = e.target.closest('[data-scope] [data-v]');
      if (sc) { scope = sc.dataset.v; sessionStorageSet('kg-scope', scope); $$('[data-scope] button').forEach((b) => b.setAttribute('aria-pressed', String(b === sc))); build(); cur = null; flipped = false; draw(); return; }
      const rv = e.target.closest('[data-rev]');
      if (rv) { reverse = !reverse; sessionStorageSet('kg-rev', reverse ? '1' : '0'); rv.setAttribute('aria-pressed', String(reverse)); flipped = false; draw(); return; }
      if (e.target.closest('[data-flip]')) { flipped = true; draw(); if (reverse) say(cur.k); return; }
      const g = e.target.closest('[data-g]');
      if (g && cur) {
        const s = store.d.srs[cur.k] || { box: 0, due: 0 };
        const grade = +g.dataset.g;
        if (grade === 0) { s.box = 1; s.due = Date.now() + 60e3; queue.splice(Math.min(3, queue.length), 0, cur); }
        else { s.box = Math.min(6, s.box + (grade === 1 ? 0 : grade === 2 ? 1 : 2)) || 1; s.due = Date.now() + INTERVALS[s.box] * 864e5 - 36e5; }
        s.t = Date.now(); store.d.srs[cur.k] = s; store.d.reviews++; store.addXP(1, 'review');
        cur = null; flipped = false; draw();
      }
    });
    document.onkeydown = (e) => {
      if (location.hash !== '#cards' || /input|textarea/i.test(document.activeElement.tagName)) return;
      if (e.key === ' ' && !flipped && cur) { e.preventDefault(); flipped = true; draw(); }
      else if (flipped && '1234'.includes(e.key)) { const b = $(`[data-g="${+e.key - 1}"]`); if (b) b.click(); }
    };
    build(); draw();
  }
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------------------------- Cheat sheet ---------------------------- */
  function cheatsheet() {
    const T = (o) => BLOCK.table(o);
    const N = [NOUNS[0], NOUNS[1], NOUNS[2], NOUNS[3]];
    const possRows = KG.PERSONS.map((p) => [esc(KG.POSS[p].ky), `<span lang="ar" translate="no">-${esc(KG.POSS[p].ar)}</span> <span class="voice-note">-${esc(KG.POSS[p].c)}</span>`].concat(N.map((n) => { const r = KG.possess(n, p).word; return r.ar + '~' + r.ro; })));
    const verbs = ['katab', 'shirib', 'shaaf', 'mishi'];
    const tenseTable = (t) => ({ cols: [''].concat(verbs.map((v) => `[[${KG.verbById(v).pa[0]}~${KG.verbById(v).pa[1]}]]`)), kg: [1, 2, 3, 4], rows: KG.PERSONS.map((p, i) => [`${kgSpan(KG.PRONOUN[p])} <span class="voice-note">${esc(KG.PERSON_KY[p])}</span>`].concat(verbs.map((v) => { const r = KG.conjugate(v, t).rows[i]; return r.ar + '~' + r.ro; }))) });
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Шпаргалка</h1><div class="kgt" lang="ar" translate="no">ملخص</div><p>Бардык мүчөлөр жана формалар бир бетте. Таблицалардын көбүн сөз машинасындагы эле кыймылдаткыч түзөт. Басып чыгарыңыз же өзүнчө өтмөктө ачык кармаңыз.</p></div></header>
    <div class="wrap cheat" style="padding:30px 0 80px">
      <h2>1. Ат атоочтор</h2>
      ${T({ cols: ['Кыргызча', 'Египетче', 'Кыргызча', 'Египетче'], kg: [1, 3], rows: [['мен', KG.PRONOUN.ana, 'биз', KG.PRONOUN.i7na], ['сен (эркекке)', KG.PRONOUN.inta, 'силер / сиз', KG.PRONOUN.intu], ['сен (аялга)', KG.PRONOUN.inti, 'алар', KG.PRONOUN.humma], ['ал (эркек)', KG.PRONOUN.huwwa, 'ал (аял)', KG.PRONOUN.hiyya]], caption: 'Сыпайы «Сиз»: [[حضرتك~7aDritak]] (эркекке), [[حضرتك~7aDritik]] (аялга) — «урматтуу сиз».' })}
      <h2>2. Ээлик мүчөлөр — «менин, сенин…»</h2>${T({ cols: ['Кимдики', 'Мүчө'].concat(N.map((n) => `[[${n.ar}~${n.ro}]] <span class="voice-note">${esc(n.ky)}</span>`)), kg: [2, 3, 4, 5], rows: possRows, caption: 'ة менен бүткөн сөздөрдө ة → ت: [[عربية~3arabiyya]] → [[عربيتي~3arabiyyiti]]. Үнсүздөн башталган мүчө алдында узун үндүү кыскарат: [[كتاب~kitaab]] → [[كتابنا~kitabna]].' })}
      <h2>3. «il-» (ال) жана күн тамгалары</h2>
      ${T({ cols: ['Түрү', 'Тамгалар', 'Мисал'], rows: [['☀ Күн тамгалары: л айтылбайт, кийинки тамга эки эсе', '<span lang="ar" translate="no" style="font-size:1.2rem">ت ث د ذ ر ز س ش ص ض ط ظ ل ن</span>', '[[الشمس~ish-shams]] күн, [[النيل~in-niil]] Нил, [[الصبح~iS-SubH]] эртең менен'], ['☾ Ай тамгалары: «il-» толук айтылат', '<span lang="ar" translate="no" style="font-size:1.2rem">ا ب ج ح خ ع غ ف ق ك م ه و ي</span>', '[[القمر~il-2amar]] ай, [[البيت~il-beet]] үй, [[الولد~il-walad]] бала']], caption: 'Каирде ج жана ك да көп учурда күн тамгасындай айтылат: [[الجو~ig-gaww]] «аба ырайы», [[الكلب~ik-kalb]] «ит».' })}
      <h2>4. Этиштин чактары</h2>
      <h3>Өткөн чак: ал жазды</h3>${T(tenseTable('past'))}
      <h3>Учур чак (bi-): жазат / жазып жатат</h3>${T(tenseTable('present'))}
      <h3>Келер чак (ha-): жазат (келечекте)</h3>${T(tenseTable('future'))}
      <h3>Жөнөкөй форма: «керек», «каалайм», «мүмкүн» сөздөрүнөн кийин</h3>${T(tenseTable('bare'))}
      <h3>Тануу</h3>
      ${T({ cols: ['Эмне', 'Курулушу', 'Мисал', 'Мааниси'], rows: [['өткөн чак', 'ma + этиш + sh', '[[ما كتبتش~ma katabtish]]', 'мен жазган жокмун'], ['учур чак', 'ma + bi-этиш + sh', '[[ما بيكتبش~ma biyiktibsh]]', 'ал жазбайт'], ['келер чак', 'mish + ha-этиш', '[[مش هكتب~mish haktib]]', 'мен жазбайм (кийин)'], ['сын атооч, зат атооч', 'mish + сөз', '[[أنا مش تعبان~ana mish ta3baan]]', 'мен чарчаган жокмун'], ['буйрук', 'ma + ti-этиш + sh', '[[ما تكتبش~ma tiktibsh]]', 'жазба!'], ['«бар/жок»', 'fii / ma fiish', '[[مفيش مشكلة~ma fiish mushkila]]', 'көйгөй жок']] })}
      <h3>Дагы этиш калыптары</h3>
      ${T({ cols: ['Маани', 'Курулушу', 'Мисал', 'Кыргызча'], rows: [
        ['каалоо', '3aayiz/3ayza + жөнөкөй форма', '[[أنا عايز أروح~ana 3aayiz aruu7]]', 'мен баргым келет'], ['мүмкүн / болот', 'mumkin + жөнөкөй форма', '[[ممكن أدخل؟~mumkin adxul?]]', 'кирсем болобу?'], ['колунан келүү', '2idir/yi2dar + жөнөкөй форма', '[[أقدر أساعدك~a2dar asaa3dak]]', 'сизге жардам бере алам'], ['керек', 'laazim + жөнөкөй форма', '[[لازم أمشي~laazim amshi]]', 'кетишим керек'],
        ['азыр бара жатам', 'активдүү атоочтук', '[[أنا رايح البيت~ana raayi7 il-beet]]', 'үйгө бара жатам'], ['…чу элем', 'kaan + bi-этиш', '[[كنت بلعب كورة~kunt bal3ab koora]]', 'футбол ойночу элем'], ['…ган болчу', 'kaan + өткөн чак', '[[كان مشي~kaan mishi]]', 'ал кетип калган болчу'], ['ушул убакта', '3ammaal + bi-этиш', '[[عمال بيتكلم~3ammaal biyitkallim]]', 'тынбай сүйлөп жатат'],
        ['качан', 'lamma + өткөн чак', '[[لما وصلت~lamma wiSilt]]', 'келгенимде'], ['…гандан кийин', 'ba3d ma + өткөн чак', '[[بعد ما كلت~ba3d ma kalt]]', 'тамак жегенден кийин'], ['…гандан мурун', '2abl ma + жөнөкөй форма', '[[قبل ما أنام~2abl ma anaam]]', 'уктаардан мурун'], ['эгер', 'law + өткөн чак', '[[لو جيت~law giit]]', 'эгер келсең'],
        ['… үчүн (максат)', '3ashaan + жөнөкөй форма', '[[عشان أتعلم~3ashaan at3allim]]', 'үйрөнүү үчүн'], ['…ганга чейин', 'lighaayit ma', '[[لغاية ما ييجي~lighaayit ma yiigi]]', 'ал келгенге чейин'], ['дагы эле', 'lissa + …', '[[لسه بيذاكر~lissa biyzaakir]]', 'дагы эле сабак окуп жатат'], ['деди', '2aal inn …', '[[قال إنه جاي~2aal innu gaay]]', 'келе жатканын айтты']] })}
      <h2>5. Суроо сөздөр</h2>
      ${T({ cols: ['Египетче', 'Кыргызча', 'Египетче', 'Кыргызча'], kg: [0, 2], rows: [['مين~miin', 'ким', 'فين~feen', 'кайда'], ['إيه~eeh', 'эмне', 'منين~minein', 'кайдан'], ['إمتى~imta', 'качан', 'إزاي~izzaay', 'кантип'], ['ليه~leeh', 'эмне үчүн', 'كام~kaam', 'канча'], ['أنهي~anhi', 'кайсы', 'قد إيه~2add eeh', 'канчалык'], ['بتاع مين~bitaa3 miin', 'кимдики', 'هل~hal', '(суроо белгиси, фусха)']], caption: 'Египетче суроо сөзү көбүнчө сүйлөмдүн аягында турат: [[إنت رايح فين؟~inta raayi7 feen?]] «Сен кайда бара жатасың?» — кыргызчадагыдай!' })}
      <h2>6. «Менде», «менен», «мага» — мүчө кабыл алган предлогдор</h2>
      ${T({ cols: ['', 'мен', 'сен (эр.)', 'сен (аял)', 'ал (эр.)', 'ал (аял)', 'биз', 'силер', 'алар'], kg: [1, 2, 3, 4, 5, 6, 7, 8], rows: [
        ['3and (-да, бар)', 'عندي~3andi', 'عندك~3andak', 'عندك~3andik', 'عنده~3andu', 'عندها~3andaha', 'عندنا~3andina', 'عندكم~3anduku', 'عندهم~3anduhum'],
        ['ma3a (менен)', 'معايا~ma3aaya', 'معاك~ma3aak', 'معاكي~ma3aaki', 'معاه~ma3aah', 'معاها~ma3aaha', 'معانا~ma3aana', 'معاكم~ma3aaku', 'معاهم~ma3aahum'],
        ['li (-га, үчүн)', 'ليا~liyya', 'ليك~liik', 'ليكي~liiki', 'ليه~liih', 'ليها~liiha', 'لينا~liina', 'ليكم~liiku', 'ليهم~liihum'],
        ['fii (-да, ичинде)', 'فيا~fiyya', 'فيك~fiik', 'فيكي~fiiki', 'فيه~fiih', 'فيها~fiiha', 'فينا~fiina', 'فيكم~fiiku', 'فيهم~fiihum'],
        ['3ala (үстүндө)', 'عليا~3alayya', 'عليك~3aleek', 'عليكي~3aleeki', 'عليه~3alee', 'عليها~3aleeha', 'علينا~3aleena', 'عليكم~3aleeku', 'عليهم~3aleehum']] })}
      <h2>7. Байланыштыргыч сөздөр</h2>
      ${T({ cols: ['Египетче', 'Кыргызча', 'Египетче', 'Кыргызча'], kg: [0, 2], rows: [['و~w', 'жана', 'بس~bass', 'бирок; болду, жетет'], ['أو~aw', 'же', 'لكن~laakin', 'бирок (расмий)'], ['عشان~3ashaan', 'үчүн; анткени', 'لأن~la2inn', 'анткени'], ['يعني~ya3ni', 'башкача айтканда, демек', 'كمان~kamaan', 'дагы, да'], ['بعدين~ba3deen', 'анан, кийин', 'دلوقتي~dilwa2ti', 'азыр'], ['لسه~lissa', 'дагы эле; жаңы эле', 'خلاص~xalaaS', 'болду, бүттү'], ['برضه~barDu', 'деле, баары бир', 'طب~Tab', 'макул анда, анда'], ['يا ريت~ya reet', 'кана эми, …са экен', 'عموماً~3umuuman', 'жалпысынан']] })}
      <h2>8. Көрсөтүүчү ат атоочтор</h2>
      ${T({ cols: ['Египетче', 'Кыргызча', 'Мисал'], kg: [0], rows: [['ده~da', 'бул (эркек)', '[[الكتاب ده~il-kitaab da]] — бул китеп'], ['دي~di', 'бул (аял)', '[[العربية دي~il-3arabiyya di]] — бул машина'], ['دول~dool', 'булар', '[[الولاد دول~il-wilaad dool]] — бул балдар'], ['هنا~hina', 'бул жерде', ''], ['هناك~hinaak', 'тиги жерде', '']], caption: 'Египетче «бул» заттан <b>кийин</b> келет: «китеп бул». Кыргызчанын тескериси.' })}
    </div>`;
  }

  /* ---------------------------- How to learn ---------------------------- */
  // Kallimni ʿArabi Bishweesh (book 1): module topics → lessons here (situational lesson first, then grammar)
  const KALLIMNI = [
    ['Саламдашуу, кечирим; өзүн тааныштыруу, улуттар', ['cairo-meet', 'hello', 'i-am']],
    ['Класстагы жана кеңседеги буюмдар; жеке буюмдар', ['cairo-objects', 'questions', 'my-your']],
    ['Телефон номерлери; саат жана жолугушуу', ['cairo-phone-time', 'numbers', 'time']],
    ['Акча жана баа; супермаркетте', ['cairo-money-shop', 'numbers', 'plurals']],
    ['Буюмдардын орду; дарек жана жашаган жер', ['cairo-where-live', 'positions']],
    ['Жол сурау; жайлар жана мейманкана кызматтары', ['cairo-directions', 'have', 'commands']],
    ['Адаттар жана күнүмдүк тартип; аптанын күндөрү', ['cairo-routine', 'present', 'dont']],
    ['Кесиптер; конок тосуу жана меймандостук', ['cairo-jobs-guests', 'phone-hotel-work']],
    ['Чакыруу, кечирим, шылтоо; белек, жактыруу', ['cairo-invite-gifts', 'want-can-must']],
    ['Такси жана поезд; ресторанда буйрутма', ['cairo-taxi-train-food', 'real-life']]
  ];
  function plan() {
    main.innerHTML = rich(`<header class="page-head"><div class="wrap"><h1>Кантип үйрөнөбүз</h1><div class="kgt" lang="ar" translate="no">إزاي نتعلم</div><p>Нөлдөн B2ге чейинки чынчыл план: канча саат кетет, күн сайын эмне кылуу керек, сүйлөөнү жана угууну кантип машыктыруу керек — сайт өзү жасай албаган бөлүктөр.</p></div></header>
    <div class="wrap" style="padding:40px 0 80px"><div class="prose">
      <h2>B2ге канча убакыт керек?</h2>
      <p>Араб тили дүйнөдөгү эң кыйын тилдердин катарына кирет — негизинен арибинен жана тамак тыбыштарынан улам. Бирок кыргыз тилдүүлөрдүн бир артыкчылыгы бар: жүздөгөн арабча сөз кыргызчада мурунтан эле бар, ал эми «менде бар», ээлик мүчө сыяктуу логика тааныш. Чынчыл эсеп (сабак, карточка, окуу жана угуу менен):</p>
      ${BLOCK.table({ cols: ['Деңгээл', 'Эмне кыла аласыз', 'Жалпы саат', 'Күнүнө 1 саат окусаңыз'], rows: [['A1', 'Арабча окуйсуз. Өзүңүздү тааныштырасыз, сандар, соода, жөнөкөй суроолор.', '~150', '5–6 ай'], ['A2', 'Күнүңүз, өткөнүңүз, пландарыңыз жөнүндө айтасыз. Такси, базар, кафе, дарыгер.', '~350', '11–12 ай'], ['B1', 'Окуяларды айтып бересиз, оюңузду түшүндүрөсүз, жай сериалдарды түшүнөсүз.', '~650', '1,5–2 жыл'], ['B2', 'Кадимки ылдамдыктагы сүйлөөнү түшүнөсүз, талашасыз, табигый сүйлөйсүз.', '~1000', '3 жыл']], caption: 'Күнүнө 2 саат окусаңыз, мөөнөт болжол менен эки эсе кыскарат. Египетте жашасаңыз — дагы эки эсе.' })}
      <h2>Күнүмдүк тартип (45–60 мүнөт)</h2>
      <ol>
        <li><b>Карточкалар, 10 мүн.</b> Кезеги келгендерди бүтүрүңүз. Ар бир жоопту бурардан мурун үн чыгарып айтыңыз.</li>
        <li><b>Жаңы сабак, 20 мүн.</b> Окуп, ар бир мисалды угуп кайталап, анан тестти тапшырыңыз. 2–3 күндө бир сабак — жакшы темп.</li>
        <li><b>Көлөкө (shadowing), 10 мүн.</b> Сүйлөмдү ойнотуп, токтотуп, ошол эле ыргак менен кайталаңыз. Адегенде сабактагы диалогдор менен, кийин чыныгы аудио менен.</li>
        <li><b>Угуу/окуу, 10–20 мүн.</b> Китепканадагы аңгеме, египет ыры же YouTube видео. 70% түшүнсөңүз — эң сонун. Ар бир сөздү издебеңиз.</li>
      </ol>
      <h2>Жума-жумага бөлүнгөн план</h2>
      <div class="week"><h3>1–3-жумалар · 0–1-баскычтар</h3><p>Арип жана тыбыштар. Максат: каалаган сөздү транскрипциясыз, жай болсо да окуй алуу. 3-жуманын аягында «Окулушу» баскычын өчүрүңүз.</p></div>
      <div class="week"><h3>4–10-жумалар · 2-баскыч</h3><p>Жашоо үчүн A1: саламдашуу, «мен …», суроолор, сандар, көптүк, «менде бар». Биринчи аңгемени окуп баштаңыз. Күнүнө 10 жаңы сөз.</p></div>
      <div class="week"><h3>11–20-жумалар · 3-баскыч</h3><p>Чыныгы сүйлөмдөр: учур чак, тануу, предлогдор, ээлик курулуш. Сөз машинасын күн сайын колдонуңуз.</p></div>
      <div class="week"><h3>6–10-айлар · 4-баскыч (A2)</h3><p>Өткөн чак, буйрук, каалоо/мүмкүн/керек, сүрөттөө, күнүмдүк кырдаалдар. Азыр сүйлөшүүчү өнөк табыңыз (төмөндү караңыз).</p></div>
      <div class="week"><h3>11–18-айлар · 5-баскыч (B1)</h3><p>Атоочтуктар, «illi», «эгер», «деди», жардамчы этиштер. Телефонуңузду арабчага которуңуз. Египет сериалдарын субтитр менен көрүңүз.</p></div>
      <div class="week"><h3>19–36-айлар · 6-баскыч (B2)</h3><p>Сөз жасоо (тамыр жана калыптар), расмий стиль, макалдар, жаңылыктар. Убактыңыздын көбү чыныгы маалыматка кетет: сериал, подкаст, маек.</p></div>
      <h2 id="kallimni">Kallimni ʿArabi Bishweesh менен окусаңыз</h2>
      <p>Бул курс Каирдеги тил мектептеринде колдонулган <i>Kallimni ʿArabi Bishweesh</i> (Samia Louis, AUC Press) китебинин бардык темаларын камтыйт. Китеп менен окусаңыз же сабакка барсаңыз, ар бир модулдан кийин төмөнкү сабактарды өтүңүз. Сайттагы тексттер жана көнүгүүлөр — өзүнчө жазылган, китептен көчүрүлгөн эмес.</p>
      ${BLOCK.table({ cols: ['Модуль', 'Темалар', 'Ушул сайтта'], rows: KALLIMNI.map((m, i) => [String(i + 1), esc(m[0]), m[1].map((id) => LESSONS.find((l) => l.id === id)).filter(Boolean).map((l) => `<a href="#lesson-${esc(l.id)}">${esc(l.num)} ${esc(l.title)}</a>`).join('<br>')]) })}
      <h2>Тез түшүнүү үчүн</h2>
      <ul>
        <li><b>Тамырды издеңиз.</b> Тааныш эмес сөздөн үч тамгалуу тамырды табууга аракет кылыңыз: [[مكتبة~maktaba]] ичинде ك-ت-ب бар — демек, жазууга же китепке байланыштуу.</li>
        <li><b>Сөздүн башын жана аягын караңыз.</b> «bi-», «ha-», «ma…sh», «-ha», «-hum» сыяктуу бөлүктөрдү бөлүп көрүүнү үйрөнүңүз. 6.7-сабакта ушуну машыгасыз.</li>
        <li><b>Сөз эмес, бүтүн сөз айкаштарын үйрөнүңүз.</b> [[إزيك؟~izzayyak?]], [[مش فاهم~mish faahim]], [[شوية شوية~shwayya shwayya]] — даяр сүйлөмдөр тезирээк чыгат.</li>
        <li><b>Бир аудиону көп жолу угуңуз.</b> Бир клипти он жолу угуу он клипти бир жолудан угуудан пайдалуу.</li>
      </ul>
      <h2>Сүйлөө: сайт сиз үчүн жасай албаган нерсе</h2>
      <p>Сүйлөө — оозго байланыштуу көндүм, ошондуктан сизге адам керек. Арзанынан баштап:</p>
      <ul>
        <li>Тил алмашуу тиркемелери (Tandem, HelloTalk) — орусча же кыргызча үйрөнүп жаткан египеттиктерди издеңиз. Египетте орус тилин үйрөнгөндөр көп.</li>
        <li>italki же Preply сайттарындагы мугалимдер — «Egyptian Arabic» деп издеңиз. 3-баскычтан баштап жумасына бир 30 мүнөттүк сабак чоң өзгөрүү алып келет.</li>
        <li>Шаарыңыздагы египеттиктер: студенттер, ресторандар. Чет элдик [[إزيك؟~izzayyak?]] десе, египеттиктер абдан кубанышат.</li>
        <li><i>Kallimni ʿArabi</i> (AUC Press) — Египет арабчасы боюнча белгилүү окуу китептеринин сериясы. Lingualism басмасынын египетче аңгемелери да жакшы.</li>
      </ul>
      <h2>Угуп, окуй турган чыныгы египетче</h2>
      <ul>
        <li><b>Египет кинолору жана сериалдары</b> — араб дүйнөсүндө эң көп көрүлгөн контент. Комедиялардан баштаңыз, тили жөнөкөй болот.</li>
        <li><b>El Da7ee7 (الدحيح)</b> — YouTube’дагы илимий-популярдуу программа, египетче, тез, бирок абдан кызыктуу. B1–B2.</li>
        <li><b>Ырлар</b> — Амр Диаб, Мухаммад Мунир, Умм Кулсум (классика). Ыр сөздөрүн таап, ырдап көрүңүз.</li>
        <li><a href="https://forvo.com/languages/arz/">Forvo</a> — сөздөрдүн египеттиктер айткан аудиосу.</li>
        <li><a href="https://en.wiktionary.org/wiki/Category:Egyptian_Arabic_language">Wiktionary</a> — египетче сөздөрдүн мааниси жана формалары (англисче).</li>
      </ul>
    </div></div>`);
  }

  /* --------------------------- Kyrgyz ↔ Arabic --------------------------- */
  function tektesh() {
    const vocab = allVocab();
    const groups = {};
    Object.keys(LK).forEach((k) => { const e = LK[k]; if (e.hidden) return; (groups[e.group] = groups[e.group] || []).push([k, e]); });
    const findLesson = (k) => { const n = KG.normAr(k); return vocab.find((v) => KG.normAr(v.k) === n || KG.normAr(v.k).split(' ').includes(n) || KG.normAr(v.k).split(' ').includes('ال' + n)); };
    const rows = (list) => list.map(([k, e]) => {
      const L = findLesson(k);
      const w = k + (e.ro ? '~' + e.ro : '');
      return [`<b class="ky" style="font-size:1.1rem">${esc(e.ky)}</b>`, `${kgSpan(w)} ${sayBtn(w)}<br>${tl(w)}`, `${esc(e.mean)}${e.hint ? `<br><span class="voice-note">${esc(e.hint)}</span>` : ''}`, L && L.lesson.num !== '★' && L.lesson.num !== '💧' ? `<a href="#lesson-${esc(L.lesson.id)}">${esc(L.lesson.num)}</a>` : '<span class="voice-note">кошумча</span>'];
    });
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Тектеш сөздөр</h1><div class="kgt">Кыргызчадагы араб сөздөрү · <span lang="ar" translate="no" dir="rtl" style="font-family:var(--f-ar)">كلمات عربية في القرغيزية</span></div>
      <p>Кылымдар бою арабча сөздөр кыргыз тилине ислам, фарсы тили жана соода аркылуу келген. Ошондуктан сиз жүздөгөн арабча сөздү мурунтан эле жарым-жартылай билесиз — алардын жолдо кантип өзгөргөнүн гана үйрөнүү керек.</p>
      <div class="meta-row"><button class="chip-btn" data-act="toggle-ar" aria-pressed="${!!store.d.ar}">Сабактарда тектештерди жана фусханы көрсөтүү</button></div></div></header>
    <div class="wrap" style="padding:36px 0 80px">
      <div class="prose">
        ${BLOCK.eli5({ html: 'Арабча сөз Кыргызстандын тоолоруна узак кербен жолу менен келди деп элестетиңиз. Жолдо ал кыргызчада жок тамак тыбыштарын (ع ح) жоготту, ق жана خ тыбыштарын жөнөкөй «к» менен алмаштырды, айтууга жеңил болуш үчүн кошумча үндүүлөрдү алды, акырында кыргыз «үндүүлөрдүн үндөшүү» кийимин кийди. [[وقت~wa2t]] кыргызчага «убакыт» болуп, [[عقل~3a2l]] «акыл» болуп, [[دنيا~dunya]] «дүйнө» болуп келди. Төмөнкү өзгөрүүлөрдү үйрөнсөңүз, эч ким үйрөтпөгөн сөздөрдү тааныйсыз.' })}
        ${BLOCK.tip({ title: 'Кеңештер кантип иштейт', html: '<b>Тектештер</b> баскычын басыңыз (беттин жогору жагында же жогорудагы баскыч). Анан бүт курста: кыргызчада тектеши бар ар бир сөздүн астында жашыл <b>К</b> белгиси, ар бир салыштыруу кутусунда ошол эле сүйлөмдүн адабий арабча (фусха) варианты жана ар бир сабактын башында «Египетче жана фусха» деген кыска түшүндүрмө пайда болот.' })}
        <h2>Эки тил кантип ойлойт</h2>
        <p>Кыргызча — түрк тили, арабча — семит тили, ошондуктан грамматика башкача курулган. Бирок ойлогондон көп окшоштук табасыз.</p>
      </div>
      ${BLOCK.table({ cols: ['Тема', 'Кыргызча', 'Египет арабчасы', ''], rows: (window.LINK_MAP || []).map((r) => [`<b>${esc(r[0])}</b>`, rich(r[1]), rich(r[2]), `<span class="verdict ${r[3]}">${{ same: 'Бирдей идея', mirror: 'Күзгүдөгүдөй тескери', easier: 'Арабчада оңой', different: 'Башкача' }[r[3]]}</span>`]) })}
      <div class="prose"><h2 style="margin-top:1.4em">Тыбыштар кантип өзгөргөн</h2></div>
      ${BLOCK.table({ cols: ['Эмне болот', 'Мисалдар'], rows: (window.LINK_RULES || []).map((r) => [esc(r[0]), arWrap(esc(r[1]))]) })}
      <h2 style="margin-top:1.4em">Сөздөр</h2>
      <p class="voice-note">«Сабак» тилкеси сөз курстун кайсы жеринде кездешерин көрсөтөт. «Кошумча» сөздөр сабактарда азырынча жок, бирок колдонулат — бекер баштапкы артыкчылык.</p>
      ${Object.keys(groups).map((g) => `<h3 style="margin-top:1.6em">${esc(g)}</h3>` + BLOCK.table({ cols: ['Кыргызча', 'Египетче', 'Мааниси', 'Сабак'], rows: rows(groups[g]) })).join('')}
      <h2 style="margin-top:1.4em">Жалган достор</h2>
      <p>Тамыры бир, бирок мааниси башка. Кыргыз тилдүүлөрдү эң көп адаштыргандар:</p>
      ${BLOCK.table({ cols: ['Кыргызча', 'Египетче', 'Абайлаңыз'], kg: [1], rows: (window.LINK_FALSE || []).map((f) => [`<b class="ky">${esc(f[0])}</b>`, f[1], rich(f[2])]) })}
      <h2 style="margin-top:1.4em">Египет арабчасы жана фусха</h2>
      <p>Араб дүйнөсүндө эки «кабат» бар: адабий араб тили (фусха — китеп, жаңылык, Куран) жана ар бир өлкөнүн сүйлөшүү тили. Египеттиктер күнүмдүк турмушта египетче сүйлөшөт, ал эми фусханы окушат жана расмий жерде угушат. Бул курс сүйлөшүү тилин үйрөтөт; эң маанилүү айырмачылыктар:</p>
      ${BLOCK.table({ cols: ['Эмне', 'Фусха', 'Египетче', 'Эскертүү'], kg: [1, 2], rows: (window.FUSHA_MAP || []).map((r) => [esc(r[0]), r[1], r[2], rich(r[3])]) })}
      <div class="prose">${BLOCK.warn({ title: 'Грамматика — башка окуя', html: 'Сөздөр арабчадан келген, бирок кыргыз грамматикасы таза түрк грамматикасы бойдон калды. Кыргызчада «китеп» кыргыз мүчөлөрүн алат — «китептеримде», ал эми арабчада көптүгү ички өзгөрүү менен жасалат: [[كتاب~kitaab]] → [[كتب~kutub]].' })}</div>
    </div>`;
  }

  const transTable = () => BLOCK.table({ cols: ['Белги', 'Тамга', 'Кантип айтылат'], rows: [['ʼ', '<span lang="ar" translate="no">ء ق</span>', 'Тамак тыгылуусу: «аʼа» дегенде ортодогу кыска тыным. Египетте ق да ушинтип айтылат.'], ['ʻ', '<span lang="ar" translate="no">ع</span>', 'Тамактын терең жеринен кысылып чыккан үн — кыргызчада жок. «а» дегенде тамакты кысып айтыңыз.'], ['ҳ', '<span lang="ar" translate="no">ح</span>', 'Терең, күчтүү «х» — бирок кырылдабайт. Айнекке «ххх» деп дем чыгаргандай.'], ['һ', '<span lang="ar" translate="no">ه</span>', 'Жеңил «h», англисче hello сыяктуу.'], ['х', '<span lang="ar" translate="no">خ</span>', 'Кыргызча «х» — кырылдаган.'], ['ғ', '<span lang="ar" translate="no">غ</span>', 'Кырылдаган «г», француз «r» тамгасына окшош.'], ['с̣ д̣ т̣ з̣', '<span lang="ar" translate="no">ص ض ط ظ</span>', 'Оор, калың с, д, т, з. Тил артка тартылат.'], ['ў', '<span lang="ar" translate="no">و</span>', 'Англисче «w».'], ['аа, ии, уу, ээ, оо', '<span lang="ar" translate="no">ا ي و</span>', 'Узун үндүүлөр — кыргызчадагыдай эки тамга менен жазылат.']] });
  // Recordings-only mode (the default, see js/config.js)
  function aboutRecordings() {
    const sp = KG.speech, n = sp.recorded();
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Аудио жөнүндө</h1><p>Бул курста египеттик адамдын жазылган үнү гана угулат — жасалма (компьютердик) үн жок.</p></div></header>
    <div class="wrap prose" style="padding:40px 0 80px">
      <p>${n ? `Азыр <b>${n}</b> сүйлөм жазылган. Жазылган сүйлөмдүн жанында ойнотуу баскычы бар; азырынча жазыла элек сүйлөмдөрдө баскыч жок — алардын транскрипциясын окуңуз.` : 'Аудио азырынча жазыла элек. Ар бир сүйлөмдүн транскрипциясын окуңуз — ал египетче айтылышты так көрсөтөт.'}</p>
      ${BLOCK.tip({ title: 'Эмне үчүн компьютердик үн жок?', html: 'Компьютердик үндөр египетче сүйлөмдөрдү көп учурда туура эмес окуйт: фусхача, же туура эмес үндүүлөр менен. Туура эмес айтылышты уга берсеңиз, ал эсиңизде калат. Ошондуктан бул жерде ар бир сүйлөмдү каирлик адам окуйт.' })}
      <p>Ылдамдык: <button class="btn btn-line btn-sm" data-rate="0.65">Жай</button> <button class="btn btn-line btn-sm" data-rate="0.85">Кадимки</button> <button class="btn btn-line btn-sm" data-rate="1">Тез</button></p>
      <h2>Транскрипция белгилери</h2>
      ${transTable()}
      <p>Бир сөздүн чыныгы египеттиктердин айтылышын угуу үчүн <a href="https://forvo.com/languages/arz/">Forvo</a> сайтын колдонуңуз (тил: Egyptian Arabic). Толук сүйлөмдөр үчүн чыныгы сүйлөөчүлөрдү көлөкөдөй кайталаңыз (<a href="#plan">үйрөнүү планын</a> караңыз).</p>
      <p class="muted" style="font-size:.9em">Сүйлөмдөрдү окуп жазуу: <a href="#record">үн жазуу студиясы</a>.</p>
    </div>`;
  }

  function aboutAudio() {
    if (!KG.speech.synth) return aboutRecordings();
    const sp = KG.speech, st = store.d.settings;
    const modeNote = {
      cloud: 'Эң жакшы абал: ар бир сүйлөм Каирдин нейрон үнү менен окулат.',
      eg: 'Жакшы: түзмөгүңүздө египетче (ar-EG) үн бар. Ал сайттагы транскрипция боюнча оңдолгон текстти окуйт.',
      files: 'Сайтта даяр египетче аудио файлдар бар, бирок бардык сөздөр үчүн эмес. Калганы үчүн транскрипцияны окуңуз.',
      ar: 'Абайлаңыз: бул фусха үнү. Ал ق тамгасын «к̣», ج тамгасын «ж» деп, сөздөрдү китептегидей окуйт. Транскрипцияга ишениңиз.',
      none: 'Бул түзмөктө египетче үн жок. Сайт фусха үнүн атайын колдонбойт — туура эмес айтылышты жаттап албашыңыз үчүн. Кыргызча транскрипция египетче айтылышты так көрсөтөт.'
    }[sp.mode];
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Аудио жөнүндө</h1><p>Курс египет (Каир) айтылышын гана угузат — фусханы эмес.</p></div></header>
    <div class="wrap prose" style="padding:40px 0 80px">
      <p>Азыр колдонулуп жаткан үн: <b>${esc(sp.label())}</b>.</p>
      <p>${esc(modeNote)}</p>
      <h2>Үн кайдан келет</h2>
      <ol><li><b>Сайттагы жазуулар</b> — египеттик сүйлөөчү жазган файлдар (эң так) же NAMAA-Egyptian-TTS моделинен алдын ала жасалган египетче үн.</li>
      <li><b>Египет арабчасынын нейрон үнү</b> (Microsoft Azure, ar-EG: Салма же Шакир) — сайттын ээси Azure ачкычын кошкон болсо, бардык текст үчүн иштейт.</li>
      <li><b>Түзмөктөгү египетче үн (ar-EG)</b>. Microsoft Edge браузеринде «Microsoft Salma Online (Natural)» үнү акысыз бар — эгер сайтта үн жок болсо, Edge’де ачып көрүңүз. Windows’та: Settings › Time & language › Speech › Add voices › Arabic (Egypt).</li>
      <li><b>Фусха үндөрү (ar-SA ж.б.)</b> — демейки боюнча <b>өчүк</b>, анткени алар египетче окубайт.</li></ol>
      ${BLOCK.warn({ title: 'Эмне үчүн фусха үнү өчүк?', html: 'Фусха үнү [[قهوة~2ahwa]] сөзүн «к̣аһўа», [[جميل~gamiil]] сөзүн «жамиил» деп окуйт. Каирде «ʼаһўа» жана «гамиил» дешет. Мындай үндү уга берсеңиз, туура эмес айтылыш эсиңизде калат.' })}
      <div class="tip"><div class="tag">Египеттик досуңуз барбы?</div><p>Эң так үн — чыныгы адамдын үнү. Египеттик досуңузга <a href="#record">Үн жазуу студиясын</a> ачып бериңиз: ал сүйлөмдөрдү түз эле браузерде окуп жазат, анан ZIP файлды сизге жиберет. Жазуулар сайттагы жасалма үндүн ордуна ойнойт (README’ни караңыз).</p></div>
      <h2>Үн жөндөөлөрү</h2>
      <p class="audio-set"><span>Үн:</span>
        <label><input type="radio" name="voice" value="f" ${sp.voiceSel !== 'm' ? 'checked' : ''}> Салма (аял)</label>
        <label><input type="radio" name="voice" value="m" ${sp.voiceSel === 'm' ? 'checked' : ''}> Шакир (эркек)</label></p>
      <p class="audio-set"><label><input type="checkbox" id="allow-fusha" ${st.fusha ? 'checked' : ''} ${sp.otherVoice ? '' : 'disabled'}> Египетче үн жок болсо, түзмөктөгү фусха үнүн колдонуу (сунушталбайт)</label>
        ${sp.otherVoice ? '' : '<br><small>Бул түзмөктө фусха үнү да жок.</small>'}</p>
      <p>Ылдамдык: <button class="btn btn-line btn-sm" data-rate="0.65">Жай</button> <button class="btn btn-line btn-sm" data-rate="0.85">Кадимки</button> <button class="btn btn-line btn-sm" data-rate="1">Тез</button> <button class="btn btn-ink btn-sm" data-say="أهلاً! إزيك؟ عامل إيه النهارده؟~ahlan! izzayyak? 3aamil eeh innaharda?">Текшерүү: «أهلاً! إزيك؟»</button></p>
      <h2>Транскрипция белгилери</h2>
      ${transTable()}
      <p class="muted" style="font-size:.9em">Алдын ала жасалган аудио: <a href="https://huggingface.co/NAMAA-Space/NAMAA-Egyptian-TTS">NAMAA-Egyptian-TTS</a> (NAMAA Community, MIT лицензиясы; Resemble AI’дин Chatterbox моделине негизделген).</p>
      <p>Бир сөздүн чыныгы египеттиктердин айтылышын угуу үчүн <a href="https://forvo.com/languages/arz/">Forvo</a> сайтын колдонуңуз (тил: Egyptian Arabic). Толук сүйлөмдөр үчүн чыныгы сүйлөөчүлөрдү көлөкөдөй кайталаңыз (<a href="#plan">үйрөнүү планын</a> караңыз).</p>
    </div>`;
    main.addEventListener('change', (e) => {
      if (e.target.name === 'voice') { st.voice = e.target.value; store.save(); sp.setVoice(st.voice); aboutAudio(); }
      if (e.target.id === 'allow-fusha') { st.fusha = e.target.checked; store.save(); sp.setFusha(st.fusha); aboutAudio(); }
    }, { once: true });
  }

  function notFound() { main.innerHTML = `<div class="narrow empty"><h1>Бет табылган жок</h1><p>Мындай бет жок. <a href="#course">Курска өтүү</a>.</p></div>`; }

  /* ------------------------------ Speech -------------------------------- */
  let warned = 0;
  function say(text) {
    if (!text) return;
    const ok = KG.speech.say(text);
    if (!ok && !KG.speech.synth && Date.now() - warned > 20000) { warned = Date.now(); toast('Бул сүйлөм азырынча жазыла элек — транскрипцияны окуңуз.'); return; }
    if (!ok && !warned && KG.speech.ready) { warned = 1; toast(KG.speech.fushaBlocked() ? 'Бул түзмөктө египетче үн жок (фусха үнү атайын өчүк). Транскрипцияны окуңуз же «Аудио жөнүндө» бетин караңыз.' : 'Бул сүйлөм үчүн египетче үн жок. Транскрипцияны окуңуз же «Аудио жөнүндө» бетин караңыз.'); }
  }
  function toast(msg) {
    const n = document.querySelectorAll('.toast').length; const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; t.style.bottom = (22 + n * 58) + 'px'; document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* ------------------------------ Router -------------------------------- */
  const ROUTES = { home, '': home, course, alphabet, machine, cards, cheatsheet, plan, tektesh, 'about-audio': aboutAudio };
  const PREFIXES = [['lesson-', (x) => lesson(x)]];
  const TITLES = { home: 'Египет арабчасы нөлдөн B2ге чейин', course: 'Курс', alphabet: 'Арип', machine: 'Сөз машинасы', cards: 'Карточкалар', cheatsheet: 'Шпаргалка', plan: 'Кантип үйрөнөбүз', tektesh: 'Тектеш сөздөр', 'about-audio': 'Аудио жөнүндө' };
  const NAV_GROUPS = { course: ['course', 'lesson', 'placement', 'goals'], library: ['library', 'reader', 'text', 'readers', 'import'], review: ['review', 'cards', 'words', 'speak'], community: ['community', 'post', 'league'], tools: ['tools', 'alphabet', 'machine', 'cheatsheet', 'plan', 'tektesh', 'about', 'cert', 'certificates'], account: ['account'] };
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    document.onkeydown = null;
    const fresh = main.cloneNode(false); main.replaceWith(fresh); main = fresh; // drop old listeners
    document.body.classList.remove('wp-open');
    const pre = PREFIXES.slice().reverse().find((p) => h.startsWith(p[0]));
    if (ROUTES[h]) ROUTES[h]();
    else if (pre) pre[1](h.slice(pre[0].length));
    else notFound();
    const head = h.split('-')[0] || 'home';
    const group = Object.keys(NAV_GROUPS).find((g) => NAV_GROUPS[g].includes(head));
    $$('.nav a, .acct-btn').forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + group ? 'page' : 'false'));
    $('#nav').classList.remove('open');
    window.scrollTo(0, 0);
    const L = h.startsWith('lesson-') && byId(h.slice(7));
    document.title = 'Масри — ' + (L ? L.num + ' ' + L.title : TITLES[h] || 'Египет арабчасы');
    if (HOOKS.afterRoute) HOOKS.afterRoute(h);
  }

  /* ---------------------------- Global events --------------------------- */
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-say]');
    if (s && !e.target.closest('.opt') && !e.target.closest('.tile')) { e.preventDefault(); say(s.dataset.say); }
    const sent = e.target.closest('.sent');
    if (sent && !e.target.closest('.say-btn')) sent.classList.toggle('open');
    const j = e.target.closest('[data-jump]');
    if (j) { e.preventDefault(); const t = document.getElementById(j.dataset.jump); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'menu') { const n = $('#nav'); n.classList.toggle('open'); a.setAttribute('aria-expanded', String(n.classList.contains('open'))); }
    if (act === 'toggle-tl') {
      // off → Cyrillic → Latin → off
      if (!store.d.tl) { store.d.tl = true; store.d.tls = 'cyr'; } else if (store.d.tls === 'cyr') store.d.tls = 'lat'; else store.d.tl = false;
      store.save(); applyTl(); route();
      toast(!store.d.tl ? 'Окулушу жашырылды.' : store.d.tls === 'lat' ? 'Окулушу латын тамгалары менен.' : 'Окулушу кирилл тамгалары менен.');
    }
    if (act === 'toggle-ar') { store.d.ar = !store.d.ar; store.save(); applyAr(); toast(store.d.ar ? 'Тектештер күйүк: сөздөрдүн астындагы жашыл «К» белгисин жана фусха кутучаларын караңыз.' : 'Тектештер өчүрүлдү.'); }
    if (act === 'reset') { const btn = a; if (btn.dataset.sure) { store.d.done = {}; store.d.srs = {}; store.save(); route(); toast('Жетишкендиктер өчүрүлдү.'); } else { btn.dataset.sure = '1'; btn.textContent = 'Ырастоо үчүн дагы бир басыңыз'; } }
    if (act === 'markdone') { store.d.done[a.dataset.id] = 1; store.save(); route(); }
    if (act === 'show-en') { const st = $('.story'); st.classList.toggle('show-en'); a.setAttribute('aria-pressed', String(st.classList.contains('show-en'))); }
  });
  document.addEventListener('click', (e) => { const r = e.target.closest('[data-rate]'); if (r) { KG.speech.rate = +r.dataset.rate; toast('Сүйлөө ылдамдыгы өзгөрдү.'); } });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('sent')) { e.preventDefault(); e.target.classList.toggle('open'); } });
  function applyAr() { document.body.classList.toggle('show-ar', !!store.d.ar); $$('[data-act="toggle-ar"]').forEach((b) => b.setAttribute('aria-pressed', String(!!store.d.ar))); }
  function applyTl() {
    document.body.classList.toggle('no-tl', !store.d.tl);
    const b = $('[data-act="toggle-tl"]');
    if (b) { b.setAttribute('aria-pressed', String(!!store.d.tl)); b.textContent = !store.d.tl ? 'Окулушу: жок' : store.d.tls === 'lat' ? 'Окулушу: lat' : 'Окулушу: кир'; }
  }
  document.addEventListener('kg-voice', () => document.body.classList.toggle('no-voice', !KG.speech.available()));

  /* ------------------------------ Plugins ------------------------------- */
  // Feature modules (cloud sync, LingQ-style reader, Busuu-style learning, drops, dictionary) register here.
  const API = {
    store, $, $$, esc, rich, chips, plain, kgSpan, sayBtn, tl, arHint, arWrap, linkMatch, BLOCK, mountQuiz, keyboard, shuffle, hasAr, full, cleanKy,
    COURSE, LESSONS, byId, isDone, allVocab, nextLesson, stageProgress, toast, say, route, ROUTES, PREFIXES, TITLES, HOOKS,
    main: () => main, ICON_SAY, applyTl, applyAr, NAV_GROUPS
  };
  window.APP = API;
  (window.KG_PLUGINS || []).forEach((fn) => { try { fn(API); } catch (e) { console.error('Plugin failed', e); } });

  window.addEventListener('hashchange', route);
  KG.speech.voiceSel = store.d.settings.voice === 'm' ? 'm' : 'f';
  KG.speech.allowFusha = !!store.d.settings.fusha;
  // Play buttons only for text that can actually be played (recorded, in the default mode)
  const markSay = (root) => (root || document).querySelectorAll('button[data-say]').forEach((b) => {
    const missing = !KG.speech.has(b.dataset.say);
    b.classList.toggle('is-missing', missing);
    if (missing) { b.setAttribute('aria-hidden', 'true'); b.tabIndex = -1; } else { b.removeAttribute('aria-hidden'); b.removeAttribute('tabindex'); }
  });
  // Browser auto-translation (e.g. Chrome Kyrgyz → English) corrupts Arabic and transcriptions: opt them out.
  const noTranslate = () => document.querySelectorAll('[lang="ar"]:not([translate]), [dir="rtl"]:not([translate]), .tl:not([translate])').forEach((el) => el.setAttribute('translate', 'no'));
  let markQueued = false;
  new MutationObserver(() => { noTranslate(); if (markQueued) return; markQueued = true; requestAnimationFrame(() => { markQueued = false; markSay(document); }); })
    .observe(document.body, { childList: true, subtree: true });
  document.addEventListener('kg-voice', () => markSay(document));
  API.markSay = markSay;
  KG.speech.init();
  applyTl();
  applyAr();
  route();
  if (HOOKS.boot) HOOKS.boot();
})();
