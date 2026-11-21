/* ==========================================================================
   Dictionary — search every Egyptian Arabic word the app knows
   Course vocabulary · Word drops · the Masri lexicon (js/data/lexicon.js)
   Type Arabic, a Kyrgyz meaning, or the pronunciation in Cyrillic/Latin letters.
   Words with prefixes and endings (مابيكتبوش, عربيتها) are traced back to their stem.
   ========================================================================== */
(window.KG_PLUGINS = window.KG_PLUGINS || []).push(function (A) {
  'use strict';
  const { store, $, $$, esc, tl, toast } = A;
  const KG = window.KG;
  if (!A.NAV_GROUPS.tools.includes('dictionary')) A.NAV_GROUPS.tools.push('dictionary');
  const POS = { n: 'зат атооч', v: 'этиш', adj: 'сын атооч', adv: 'тактооч', num: 'сан', pron: 'ат атооч', name: 'энчилүү ат', phr: 'сөз айкашы', conj: 'байламта', prep: 'предлог', intj: 'сырдык сөз', part: 'бөлүкчө', q: 'суроо сөз' };
  const SRC = { mz: 'Масри сөздүгү', course: 'Сабак', drops: 'Сөз тамчылары' };
  const ABC = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ');
  const keyOf = (s) => KG.normAr(KG.arOf(s)).replace(/^ال(?=..)/, '');
  const lc = (s) => String(s).toLowerCase();

  /* ------------------------------ Index ----------------------------------- */
  let INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    const map = new Map();
    const put = (w, ro, en, pos, src, lesson, pres) => {
      const ar = KG.arOf(w).replace(/[.!?؟]$/, '');
      const k = keyOf(ar); if (!k) return;
      // Unvocalized Arabic has homographs (كتب = kutub "books" / katab "wrote"): key by spelling + pronunciation.
      const mk = k + '|' + (ro ? KG.romKey(ro).replace(/\s/g, '') : '');
      let e = map.get(mk);
      if (!e && !ro) e = [...map.values()].find((x) => x.k === k);
      if (!e) { e = { w: ar, ro: ro || '', k, en: [], pos: pos || '', src: [], lesson: null, pres: '' }; map.set(mk, e); }
      String(en || '').split(/\s*;\s*/).forEach((g) => { g = A.cleanKy(g).trim(); if (g && !e.en.some((x) => lc(x) === lc(g))) e.en.push(g); });
      if (src && !e.src.includes(src)) e.src.push(src);
      if (!e.pos && pos) e.pos = pos;
      if (!e.ro && ro) e.ro = ro;
      if (pres && !e.pres) e.pres = pres;
      if (lesson && !e.lesson) e.lesson = lesson;
    };
    A.allVocab().forEach((v) => { if (!v.mine) put(v.k, v.ro, v.en, /[!?؟.]$/.test(v.k) || v.k.split(' ').length > 2 ? 'phr' : '', 'course', v.lesson); });
    ((window.DROPS && window.DROPS.extra) || []).forEach((x) => put(x[0], KG.roOf(x[0]), x[1], '', 'drops'));
    ((window.LEXICON && window.LEXICON.rows) || []).forEach((r) => put(r[0], r[1], r[2], r[3], r[4] || 'mz', null, r[5] || ''));
    INDEX = [...map.values()].sort((a, b) => a.k.localeCompare(b.k, 'ar'));
    INDEX.forEach((e) => { e.enl = lc(e.en.join(' ; ')); e.rk = e.ro ? KG.romKey(e.ro).replace(/\s/g, '') : ''; e.pk = e.pres ? KG.normAr(KG.arOf(e.pres)) : ''; });
    return INDEX;
  }
  A.dictionaryIndex = index;
  const F = (e) => (e.ro ? e.w + '~' + e.ro : e.w);

  /* ------------------------------ Search ---------------------------------- */
  function search(q) {
    q = q.trim(); if (!q) return { rows: [], how: '' };
    const all = index(), ar = KG.hasAr(q);
    const score = new Map();
    const bump = (e, s) => { if ((score.get(e) || 0) < s) score.set(e, s); };
    if (ar) {
      const kq = keyOf(q);
      all.forEach((e) => {
        if (e.k === kq || e.pk === KG.normAr(q)) bump(e, 100);
        else if (e.k.startsWith(kq)) bump(e, 80 - Math.min(30, e.k.length - kq.length));
        else if (kq.length >= 3 && e.k.includes(kq)) bump(e, 40);
      });
    } else {
      const eq = lc(q), rq = KG.romKey(q).replace(/\s/g, '');
      all.forEach((e) => {
        // Kyrgyz meaning
        const words = e.enl.split(/[^а-яөүңёa-z']+/);
        if (e.en.some((g) => lc(g) === eq)) bump(e, 95);
        else if (words.includes(eq)) bump(e, 72);
        else if (eq.length >= 3 && words.some((w) => w.startsWith(eq))) bump(e, 50);
        else if (eq.length >= 4 && e.enl.includes(eq)) bump(e, 30);
        // pronunciation (Cyrillic or Latin)
        if (rq.length >= 2 && e.rk) {
          if (e.rk === rq) bump(e, 90);
          else if (e.rk.startsWith(rq)) bump(e, 60 - Math.min(20, e.rk.length - rq.length));
        }
      });
    }
    let rows = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].k.length - b[0].k.length).map((x) => x[0]);
    let how = '';
    if (ar && !rows.some((e) => e.k === keyOf(q)) && A.analyze) {
      const an = A.analyze(q).slice(0, 2);
      const byKey = new Map(all.map((e) => [e.k, e]));
      const byPres = new Map(all.filter((e) => e.pk).map((e) => [e.pk, e]));
      const stems = an.map((a) => ({ a, e: byPres.get(a.stem) || byKey.get(a.stem.replace(/^ال/, '')) })).filter((x) => x.e);
      if (stems.length) {
        how = `<b lang="ar" translate="no">${esc(q)}</b> ${stems.map((x) => `<span lang="ar" translate="no" dir="rtl">${x.a.pre ? `<span class="m m1">${esc(x.a.pre)}</span>+` : ''}<b>${esc(x.a.tm ? x.a.stem.replace(/ه$/, 'ة') : x.a.stem)}</b>${x.a.rest ? `+<span class="m m2">${esc(x.a.rest)}</span>` : ''}</span>${x.e.k !== x.a.stem ? ` (сөздүк формасы <span lang="ar" translate="no">${esc(x.e.w)}</span>)` : ''}`).join(' же ')} сөзүнө окшош: «${esc(stems[0].e.en[0] || '')}».`;
        rows = stems.map((x) => x.e).concat(rows.filter((e) => !stems.some((x) => x.e === e)));
      }
    }
    return { rows: rows.slice(0, 80), how, total: rows.length };
  }

  /* ------------------------------ Rendering ------------------------------- */
  const inDeck = (e) => { const s = store.d.srs[e.w]; const w = (store.d.words || {})[e.k]; return !!s || (w && w.s >= 1 && (!w.r || !e.ro || w.r === e.ro)); };
  function row(e) {
    const srcs = e.src.map((s) => s === 'course' && e.lesson ? `<a class="dsrc course" href="#lesson-${esc(e.lesson.id)}">${esc(e.lesson.num)}-сабак</a>` : `<span class="dsrc ${esc(s)}">${esc(SRC[s] || s)}</span>`).join('');
    return `<li class="dict-row">
      <button type="button" class="say-btn" data-say="${esc(e.w)}" aria-label="Угуу: ${esc(e.w)}">${A.ICON_SAY}</button>
      <div class="dict-main"><div class="dict-head"><span class="dict-kg" lang="ar" translate="no" dir="rtl">${esc(e.w)}</span>${tl(F(e))}${e.pos ? `<span class="dict-pos">${esc(POS[e.pos] || e.pos)}</span>` : ''}</div>
        ${e.pres ? `<div class="voice-note">учур чак: <span lang="ar" translate="no">${esc(KG.arOf(e.pres))}</span> ${tl(e.pres)}</div>` : ''}
        <div class="dict-en">${esc(e.en.join('; '))}</div>${A.arHint(e.w)}<div class="dict-srcs">${srcs}</div></div>
      <button type="button" class="dict-add" data-add="${esc(e.k)}" data-ro="${esc(e.ro)}" ${inDeck(e) ? 'disabled' : ''}>${inDeck(e) ? 'Кайталоодо' : '+ Үйрөнүү'}</button>
    </li>`;
  }
  function wordOfDay() {
    const pool = index().filter((e) => e.src.includes('mz') && (e.pos === 'n' || e.pos === 'adj') && e.ro && e.en[0] && e.en[0].length < 40 && e.w.length >= 3 && e.w.length <= 7);
    if (!pool.length) return null;
    const d = new Date(); const n = (d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % pool.length;
    return pool[n];
  }

  A.ROUTES.dictionary = function dictionary() {
    const main = A.main(), all = index();
    const counts = { mz: 0, course: 0, drops: 0 };
    all.forEach((e) => e.src.forEach((s) => { if (s in counts) counts[s]++; }));
    const wod = wordOfDay();
    main.innerHTML = `<header class="page-head"><div class="wrap"><h1>Сөздүк</h1><div class="kgt" lang="ar" translate="no">القاموس</div>
      <p>${all.length.toLocaleString()} египетче сөз жана сөз айкашы. Арабча, кыргызча мааниси же окулушу (кирилл же латын тамгалары) менен издеңиз. Мүчөлөрү бар сөздү, мисалы <span lang="ar" translate="no">مابيكتبوش</span> же <span lang="ar" translate="no">عربيتها</span>, жазсаңыз — негизин табат.</p></div></header>
      <div class="wrap dict">
        <div class="dict-search"><label for="dq" class="sr-only">Сөздүктөн издөө</label>
          <input id="dq" class="input" type="search" dir="auto" autocomplete="off" spellcheck="false" placeholder="Издөө: بيت, бээт, үй…">
          <div class="dict-abc" dir="rtl" role="group" aria-label="Тамга боюнча карап чыгуу">${ABC.map((l) => `<button type="button" data-l="${l}" lang="ar" translate="no">${l}</button>`).join('')}</div></div>
        <div class="dict-out" aria-live="polite"></div>
        ${wod ? `<aside class="dict-wod"><span class="lab">Күндүн сөзү</span><span class="dict-kg" lang="ar" translate="no" dir="rtl">${esc(wod.w)}</span>${tl(F(wod))}<span class="dict-en">${esc(wod.en.join('; '))}</span><button type="button" class="say-btn" data-say="${esc(wod.w)}" aria-label="Угуу">${A.ICON_SAY}</button></aside>` : ''}
        <p class="dict-credits">Булактар: курстун сабактары (${counts.course.toLocaleString()}), Сөз тамчылары (${counts.drops.toLocaleString()}) жана ушул курс үчүн түзүлгөн египетче-кыргызча сөздүк (${counts.mz.toLocaleString()}). Ката таптыңызбы? Окурманда өз мааниңизди кошуңуз.</p>
      </div>`;
    const out = $('.dict-out', main), q = $('#dq', main);
    let letter = '', shown = 0, list = [];
    const drawList = (rows, head, more) => {
      out.innerHTML = `${head || ''}${rows.length ? `<ul class="dict-list">${rows.map(row).join('')}</ul>` : '<p class="dict-empty">Табылган жок. Азыраак тамга, сөздүн негизги формасы же кыргызча сөз менен издеп көрүңүз.</p>'}${more ? '<button type="button" class="btn btn-line dict-more">Дагы көрсөтүү</button>' : ''}`;
    };
    const run = () => {
      const v = q.value; letter = '';
      $$('.dict-abc button', main).forEach((b) => b.setAttribute('aria-pressed', 'false'));
      if (!v.trim()) { out.innerHTML = '<p class="dict-hint">Жаза баштаңыз же тамга тандаңыз.</p>'; return; }
      const r = search(v);
      drawList(r.rows, `${r.how ? `<p class="dict-how">${r.how}</p>` : ''}<p class="dict-count">${r.total ? `${r.total > 80 ? 'Алгачкы 80, жалпы ' : 'Табылды: '}${r.total}` : ''}</p>`);
    };
    let t = null;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
    main.addEventListener('click', (e) => {
      const l = e.target.closest('[data-l]');
      if (l) {
        clearTimeout(t); letter = l.dataset.l; q.value = ''; shown = 100;
        $$('.dict-abc button', main).forEach((b) => b.setAttribute('aria-pressed', String(b === l)));
        list = all.filter((x) => x.k.startsWith(KG.normAr(letter)));
        drawList(list.slice(0, shown), `<p class="dict-count"><b lang="ar" translate="no">${esc(letter)}</b> тамгасынан башталган ${list.length.toLocaleString()} сөз</p>`, list.length > shown);
        return;
      }
      if (e.target.closest('.dict-more')) { shown += 150; drawList(list.slice(0, shown), `<p class="dict-count"><b lang="ar" translate="no">${esc(letter)}</b> тамгасынан башталган ${list.length.toLocaleString()} сөз</p>`, list.length > shown); return; }
      const add = e.target.closest('[data-add]');
      if (add && !add.disabled) {
        const en = all.find((x) => x.k === add.dataset.add && x.ro === add.dataset.ro) || all.find((x) => x.k === add.dataset.add);
        const Wd = store.d.words || (store.d.words = {});
        Wd[add.dataset.add] = Object.assign(Wd[add.dataset.add] || {}, { s: 1, t: Date.now(), m: en ? en.en.join('; ') : '', w: en ? en.w : add.dataset.add, r: en ? en.ro : '' });
        store.save(); add.disabled = true; add.textContent = 'Кайталоодо';
        toast(`«${en ? en.w : add.dataset.add}» кайталоо тизмеңизге кошулду.`);
      }
    });
    out.innerHTML = '<p class="dict-hint">Жаза баштаңыз же тамга тандаңыз.</p>';
    let pre = null; try { pre = sessionStorage.getItem('kg-dict-q'); } catch (e) { /* ignore */ }
    if (pre) { q.value = pre; try { sessionStorage.removeItem('kg-dict-q'); } catch (e) { /* ignore */ } run(); }
    q.focus({ preventScroll: true });
  };
  A.TITLES.dictionary = 'Сөздүк';
});
