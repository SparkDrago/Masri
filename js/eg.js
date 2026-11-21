/* ==========================================================================
   EG — the Egyptian Arabic engine
   Text convention used everywhere in the course data:  "عربي~roman"
     · the Arabic part is what is shown, spoken and checked;
     · the roman part is the pronunciation (Egyptian, Cairo):
         2 = ء/ق (glottal stop)   3 = ع   7 = ح   x = خ   gh = غ   sh = ش
         S D T Z = ص ض ط ظ (heavy letters)   aa ii uu ee oo = long vowels
   The roman part is turned into Kyrgyz Cyrillic (default) or scholarly Latin.
   Also: answer checking, speech, verb conjugation, possessive endings,
   the article, adjective agreement and numbers.
   ========================================================================== */
(function () {
  'use strict';

  const AR_RE = /[؀-ۿ]/;
  const HARAKAT = /[ً-ْٰـ]/g; // tanwin, vowels, shadda, sukun, dagger alif, tatweel
  const hasAr = (s) => AR_RE.test(String(s || ''));

  /* --------------------------- "ar~roman" strings --------------------------- */
  function split(s) {
    s = String(s == null ? '' : s);
    const i = s.indexOf('~');
    return i < 0 ? { ar: s, ro: '' } : { ar: s.slice(0, i), ro: s.slice(i + 1) };
  }
  const arOf = (s) => split(s).ar.replace(/\|/g, '').trim();
  const roOf = (s) => split(s).ro.replace(/\|/g, '').trim();

  /* ------------------------- Roman → Cyrillic / Latin ----------------------- */
  const CYR = [['sh', 'ш'], ['gh', 'ғ'], ['kh', 'х'], ['ya', 'я'], ['yu', 'ю'], ['yo', 'ё'], ['ee', 'ээ'],
    ['a', 'а'], ['b', 'б'], ['c', 'ч'], ['d', 'д'], ['D', 'д̣'], ['f', 'ф'], ['g', 'г'], ['h', 'һ'], ['7', 'ҳ'], ['i', 'и'], ['j', 'ж'],
    ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к̣'], ['r', 'р'], ['s', 'с'], ['S', 'с̣'],
    ['t', 'т'], ['T', 'т̣'], ['u', 'у'], ['v', 'в'], ['w', 'ў'], ['x', 'х'], ['y', 'й'], ['z', 'з'], ['Z', 'з̣'],
    ['2', 'ʼ'], ['3', 'ʻ'], ['A', 'а'], ['I', 'и'], ['U', 'у'], ['E', 'э'], ['O', 'о']];
  const LAT = { S: 'ṣ', D: 'ḍ', T: 'ṭ', Z: 'ẓ', 7: 'ḥ', 3: 'ʿ', 2: 'ʾ', x: 'kh', A: 'a', I: 'i', U: 'u', E: 'e', O: 'o' };
  const CONS_RE = /[бвгдзйклмнпрстфхцчшһҳғўжʼʻ̣]$/;
  function toCyr(ro) {
    const s = String(ro || '');
    let out = '', i = 0;
    while (i < s.length) {
      let hit = false;
      if (s[i] === 'e' && s[i + 1] !== 'e') { // short e: е after a consonant, э elsewhere (Kyrgyz spelling)
        out += CONS_RE.test(out) ? 'е' : 'э'; i++; continue;
      }
      for (const [r, c] of CYR) {
        if (s.startsWith(r, i)) { out += c; i += r.length; hit = true; break; }
      }
      if (!hit) { out += s[i]; i++; }
    }
    return out;
  }
  function toLat(ro) { return String(ro || '').replace(/[SDTZ732xAIUEO]/g, (c) => LAT[c] || c); }

  /* Approximate pronunciation for Arabic that has no roman part (imported texts). */
  const AUTO = { 'ب': 'b', 'ت': 't', 'ث': 's', 'ج': 'g', 'ح': '7', 'خ': 'x', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': '3', 'غ': 'gh', 'ف': 'f', 'ق': '2', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ء': '2', 'ؤ': '2', 'ئ': '2', 'ة': 'a', 'ى': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'گ': 'g', 'پ': 'p', 'ڤ': 'v' };
  function autoRoman(ar) {
    const w = String(ar || '');
    let out = '';
    for (let i = 0; i < w.length; i++) {
      const c = w[i], prev = out.slice(-1);
      if (c === 'َ') { out += 'a'; continue; }
      if (c === 'ِ') { out += 'i'; continue; }
      if (c === 'ُ') { out += 'u'; continue; }
      if (c === 'ّ') { out += prev; continue; }
      if (/[ً-ٍْـٰ]/.test(c)) continue;
      if (c === 'ا') { out += i === 0 ? 'a' : 'aa'; continue; }
      if (c === 'و') { out += (i === 0 || /[aeiou]$/.test(out)) ? 'w' : 'uu'; continue; }
      if (c === 'ي') { out += (i === 0 || /[aeiou]$/.test(out)) ? 'y' : 'ii'; continue; }
      if (c === 'ل' && w[i - 1] === 'ا' && i === 1) { out = 'il-'; continue; }
      out += AUTO[c] !== undefined ? AUTO[c] : c;
    }
    return out;
  }

  // Roman spellings learned from the course data, keyed by normalized Arabic.
  const ROMAN = new Map();
  function learnRoman(s) {
    const p = split(s);
    if (!p.ro || !hasAr(p.ar)) return;
    const a = norm(arOf(s)), r = roOf(s);
    if (a && !ROMAN.has(a)) ROMAN.set(a, r);
    const aw = arOf(s).split(/\s+/), rw = r.split(/\s+/);
    if (aw.length > 1 || rw.length > 1) alignWords(aw, rw).forEach(([w, x]) => { const k = norm(w); if (k && x && !ROMAN.has(k) && vocalize(w, x)) ROMAN.set(k, x.replace(/[.,!?؟،«»:;]+$/, '').replace(/^[«"]+/, '')); });
  }
  function romanFor(s) {
    const r = roOf(s);
    if (r) return { ro: r, guess: false };
    const a = arOf(s);
    if (!hasAr(a)) return { ro: '', guess: false };
    const whole = ROMAN.get(norm(a));
    if (whole) return { ro: whole, guess: false };
    let guess = false;
    const ro = a.split(/(\s+)/).map((w) => {
      if (/^\s+$/.test(w)) return ' ';
      const k = norm(w);
      if (!k) return w.replace(/[،؟؛]/g, (c) => ({ '،': ',', '؟': '?', '؛': ';' }[c]));
      if (ROMAN.has(k)) return ROMAN.get(k);
      guess = true; return autoRoman(w.replace(/[^؀-ۿ]/g, ''));
    }).join('');
    return { ro, guess };
  }
  // script: 'cyr' | 'lat'
  function pron(s, script) {
    const r = romanFor(s);
    if (!r.ro) return '';
    const t = script === 'lat' ? toLat(r.ro) : toCyr(r.ro);
    return (r.guess ? '≈ ' : '') + t;
  }

  /* ------------------------------ Normalizing ------------------------------- */
  function normAr(s) {
    return String(s || '').replace(HARAKAT, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[؟،؛!?.,:"«»“”()\-–—…'’]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const LOOSE_AR = { 'ص': 'س', 'ث': 'س', 'ط': 'ت', 'ض': 'د', 'ذ': 'ز', 'ظ': 'ز', 'ق': 'ا', 'ء': 'ا', 'ؤ': 'ا', 'ئ': 'ا', 'ع': 'ا', 'ح': 'ه', 'غ': 'خ' };
  const looseAr = (s) => normAr(s).split('').map((c) => LOOSE_AR[c] || c).join('').replace(/(.)\1+/g, '$1').replace(/ا+/g, 'ا');
  function norm(s) {
    const t = String(s || '');
    return hasAr(t) ? normAr(t) : t.toLowerCase().replace(/ё/g, 'е').replace(/[.,!?;:"«»“”„'’()\-–—…]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // Transcription typed by the learner (Cyrillic or Latin) → a forgiving key
  const CYR2LAT = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'gh', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'ң': 'n', 'о': 'o', 'ө': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ү': 'u', 'ў': 'w', 'ф': 'f', 'х': 'x', 'ҳ': 'h', 'һ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' };
  function romKey(s, loose) {
    let t = String(s || '').replace(/̣/g, '');
    t = t.split('').map((c) => { const l = c.toLowerCase(); return CYR2LAT[l] !== undefined ? CYR2LAT[l] : c; }).join('');
    t = t.replace(/[ṣ]/g, 's').replace(/[ḍ]/g, 'd').replace(/[ṭ]/g, 't').replace(/[ẓ]/g, 'z').replace(/[ḥ]/g, 'h').toLowerCase()
      .replace(/kh/g, 'x').replace(/7/g, 'h').replace(/[23ʿʾʻʼ'’`]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/(.)\1+/g, '$1');
    if (loose) t = t.replace(/e/g, 'i').replace(/o/g, 'u').replace(/w/g, 'u').replace(/y/g, 'i').replace(/\s/g, '');
    return t;
  }

  /* -------------------------------- Checking -------------------------------- */
  // Returns 'right' | 'almost' | 'wrong'. Answers may be "ar~roman" or plain Kyrgyz.
  function check(input, answers) {
    const list = (Array.isArray(answers) ? answers : [answers]).map(String);
    const g = String(input || '').trim();
    if (!g) return 'wrong';
    if (hasAr(g)) {
      const n = normAr(g);
      if (list.some((a) => hasAr(a) && normAr(arOf(a)) === n)) return 'right';
      if (list.some((a) => hasAr(a) && looseAr(arOf(a)) === looseAr(g))) return 'almost';
      return 'wrong';
    }
    const k = romKey(g);
    if (list.some((a) => { const r = romanFor(a).ro; return r && romKey(r) === k; })) return 'right';
    if (list.some((a) => !hasAr(a) && norm(a) === norm(g))) return 'right';
    if (list.some((a) => { const r = romanFor(a).ro; return r && romKey(r, true) === romKey(g, true); })) return 'almost';
    return 'wrong';
  }

  /* ---------------------------------- Speech -------------------------------- */
  /* Learners must hear CAIRO Arabic, never Fusha. Sources, best first:
       1. a recorded/pre-generated file in /audio (see data-src/build_audio.js)
       2. /api/tts — Microsoft Azure's Egyptian neural voices (ar-EG Salma / Shakir)
       3. an Egyptian (ar-EG) voice installed in the browser (e.g. Edge's "Salma Online")
       4. any other Arabic voice — OFF by default (it reads Fusha), only if the learner allows it
     Text sent to a synthesizer is first "Egyptianized" from the course transcription:
     ق → ء/أ where it is a glottal stop, ث → ت/س, ذ → د/ز, ظ → ض … */
  const AR_LETTER = /[ء-يٱ-ۓ]/;
  const lettersOf = (w) => w.replace(/[^ء-يٱ-ۓ]/g, '');
  const countCh = (s, re) => (String(s).match(re) || []).length;
  function egyWord(w, r) {
    if (!AR_LETTER.test(w)) return w;
    const ro = String(r || '');
    const chars = Array.from(w);
    const letterIdx = chars.map((c, i) => (AR_LETTER.test(c) ? i : -1)).filter((i) => i >= 0);
    const L = (k) => (k >= 0 && k < letterIdx.length ? chars[letterIdx[k]] : '');
    // ق: Egyptian says a glottal stop unless the transcription has q (qur2aan, qaanuun …)
    if (!/q/.test(ro)) {
      letterIdx.forEach((ci, k) => {
        if (chars[ci] !== 'ق') return;
        const before = letterIdx.slice(0, k).map((i) => chars[i]).join('');
        const next = L(k + 1), prev = L(k - 1);
        const start = /^(و|ف|ب|ل|ك)?(ال|لل)?$/.test(before);
        if (start) {
          if (next === 'ا') { chars[ci] = 'آ'; for (let x = ci + 1; x <= letterIdx[k + 1]; x++) chars[x] = ''; }
          else chars[ci] = /(^|-)2[ie]/.test(ro) && !before ? 'إ' : 'أ';
        } else if (!next) chars[ci] = 'ء';
        else if (next === 'ي' || prev === 'ي') chars[ci] = 'ئ';
        else if (next === 'و') chars[ci] = 'ؤ';
        else chars[ci] = 'أ';
      });
    }
    let out = chars.join('');
    const lower = (re) => countCh(ro.replace(/sh|th|dh|zh|gh|kh/g, ''), re);
    // ث → س when the transcription has an extra s, otherwise ت (talaata, tamaniya, kitiir)
    if (out.includes('ث') && !/th/.test(ro)) out = out.replace(/ث/g, ro && lower(/s/g) > countCh(out, /س/g) ? 'س' : 'ت');
    // ذ → ز when the transcription has an extra z, otherwise د (da, haada, diil)
    if (out.includes('ذ') && !/dh/.test(ro)) out = out.replace(/ذ/g, ro && lower(/z/g) > countCh(out, /ز/g) ? 'ز' : 'د');
    // ظ said as ض (Duhr, Dalma …) when the transcription says so
    if (out.includes('ظ') && ro && countCh(ro, /D/g) > countCh(out, /ض/g)) out = out.replace(/ظ/g, 'ض');
    return out;
  }
  /* Vowel marks from the transcription: كتب + "katab" → كَتَبْ, so the synthesizer neither guesses
     the vowels nor adds Fusha case endings. Returns null when the two can't be aligned. */
  const CONS = { 'ب': ['b'], 'ت': ['t'], 'ث': ['t', 's'], 'ج': ['g', 'j'], 'ح': ['7', 'h'], 'خ': ['x', 'kh'], 'د': ['d'], 'ذ': ['d', 'z'], 'ر': ['r'], 'ز': ['z'],
    'س': ['s'], 'ش': ['sh'], 'ص': ['S', 's'], 'ض': ['D', 'd'], 'ط': ['T', 't'], 'ظ': ['Z', 'D', 'z'], 'ع': ['3'], 'غ': ['gh'], 'ف': ['f', 'v'], 'ق': ['2', 'q', 'g'],
    'ك': ['k'], 'ل': ['l'], 'م': ['m'], 'ن': ['n'], 'ه': ['h'], 'و': ['w'], 'ي': ['y'], 'گ': ['g'], 'پ': ['p'], 'ڤ': ['v'], 'ء': ['2'], 'أ': ['2'], 'إ': ['2'], 'ؤ': ['2'], 'ئ': ['2'], 'آ': ['2'] };
  const SUN_L = 'تثدذرزسشصضطظلنجك'; // Cairo also assimilates ج and ك: ig-gum3a, ik-kalb
  const VMARK = { a: 'َ', i: 'ِ', e: 'ِ', u: 'ُ', o: 'ُ' };
  const LONG_OF = { 'ا': ['aa', 'a'], 'ى': ['aa', 'a'], 'و': ['uu', 'oo', 'u', 'o'], 'ي': ['ii', 'ee', 'i', 'e'] };
  const HAMZA_L = 'أإءؤئآ';
  function romTokens(r) {
    const s = String(r).replace(/[^A-Za-z0-9]/g, '').replace(/[AIUEO]/g, (c) => c.toLowerCase());
    const out = [];
    for (let i = 0; i < s.length;) {
      const two = s.slice(i, i + 2);
      if (['sh', 'gh', 'kh'].includes(two)) { out.push(two); i += 2; }
      else if (['aa', 'ii', 'uu', 'ee', 'oo'].includes(two)) { out.push(two); i += 2; }
      else { out.push(s[i]); i++; }
    }
    return out;
  }
  const isVowelTok = (t) => /^[aeiou]{1,2}$/.test(t || '');
  const VCACHE = new Map();
  function vocalize(word, ro) {
    const ck = word + '\u0001' + ro;
    if (VCACHE.has(ck)) return VCACHE.get(ck);
    const v = vocalize1(word, ro);
    if (VCACHE.size < 60000) VCACHE.set(ck, v);
    return v;
  }
  function vocalize1(word, ro) {
    const letters = Array.from(word.replace(HARAKAT, '')).filter((c) => AR_LETTER.test(c));
    const t = romTokens(ro);
    if (!letters.length || !t.length || letters.length > 24) return null;
    const memo = new Map();
    // returns array of marks (one per letter) for letters[i..] against tokens[j..], or null
    function go(i, j) {
      const k = i * 64 + j;
      if (memo.has(k)) return memo.get(k);
      let res = null;
      const c = letters[i], tok = t[j], last = i === letters.length - 1;
      if (i === letters.length) res = j === t.length ? [] : null;
      else {
        const tries = [];
        // vowel after a consonant: short vowel → its mark; long vowel → mark, the vowel letter follows; none → sukun
        const vowelAfter = (jj, ii) => {
          const v = t[jj], out = [];
          if (isVowelTok(v)) {
            const nx = letters[ii + 1];
            if (v.length === 1) out.push([VMARK[v], jj + 1]);
            if (v.length === 1 && nx && (LONG_OF[nx] || []).includes(v)) out.push([VMARK[v], jj]); // ana, illi, katabu
            if (nx && HAMZA_L.includes(nx)) out.push(['ْ', jj]);
            if (nx === 'ا' && v.length === 1) out.push(['ْ', jj]);                              // il-itneen: ا carries the vowel                                  // il-akl: the vowel belongs to أ
            if (v.length === 2 && nx && (LONG_OF[nx] || []).includes(v)) out.push([v === 'ee' || v === 'oo' ? '' : VMARK[v[0]], jj]);
            if (v.length === 2) out.push([v === 'ee' || v === 'oo' ? '' : VMARK[v[0]], jj + 1]); // spelled short
          } else out.push([ii === letters.length - 1 || jj < t.length ? 'ْ' : '', jj]);
          return out;
        };
        const consonant = (allowed, optional) => {
          if (allowed.includes(tok)) {
            let jj = j + 1, sh = '';
            if (t[jj] === tok) { sh = 'ّ'; jj++; }
            vowelAfter(jj, i).forEach(([m, nj]) => tries.push([sh + (m === 'ْ' && sh ? '' : m), nj]));
          }
          if (optional) vowelAfter(j, i).forEach(([m, nj]) => { if (m !== 'ْ') tries.push([m, nj]); });
        };
        const artAt = i === 0 || (i === 1 && 'وبفك'.includes(letters[0]));   // ال, وال, بال, فال, كال
        if (c === 'ا' && artAt && letters[i + 1] === 'ل') {
          // article il-: "il-kitaab", sun letters "is-saa3a" (the ل is silent, the next letter doubles)
          if (tok === 'i' || tok === 'e' || tok === 'a') tries.push(['', j + 1]);
          tries.push(['', j]);
        }
        const artL = (i >= 1 && letters[i - 1] === 'ا' && (i === 1 || (i === 2 && 'وبفك'.includes(letters[0])))) || (i === 1 && letters[0] === 'ل');
        if (c === 'ل' && artL && SUN_L.includes(letters[i + 1] || '') && (CONS[letters[i + 1]] || []).includes(tok) && t[j + 1] === tok) {
          const r2 = go(i + 1, j); if (r2) { res = [''].concat(r2); memo.set(k, res); return res; }
        }
        if (LONG_OF[c] && (LONG_OF[c].includes(tok))) tries.push(['', j + 1]);           // vowel letter
        if (c === 'ا' && i === 0 && isVowelTok(tok) && tok.length === 1) tries.push(['', j + 1]);
        if (c === 'ا' && i === 0) tries.push(['', j]);                                      // اسمك smuk, اشتريته shtareetu
        if (c === 'ا' && i >= 2 && letters[i - 1] === 'ل' && isVowelTok(tok) && tok.length === 1) tries.push(['', j + 1]); // الاتنين il-itneen
        if (c === 'م' && last && letters[i - 1] === 'ك') tries.push(['', j]);               // -كم = -ku
        if ((c === 'ي' || c === 'ى') && last && !tok) tries.push(['', j]);
        if (c === 'ي' && last && (tok === 'a' || tok === 'aa') && j === t.length - 1) tries.push(['', j + 1]); // مستشفي mustashfa
        if (c === 'ا' && last && letters[i - 1] === 'و') tries.push(['', j]);              // كتبوا
        if (c === 'ا' && last && ((tok === 'n' && j === t.length - 1) || (tok === 'a' && t[j + 1] === 'n' && j === t.length - 2))) tries.push(['ً', t.length]); // أهلاً
        if (c === 'ة') { if (tok === 't' || (tok === 'h' && last)) tries.push(['', j + 1]); if (last) tries.push(['', j]); }
        if (c === 'ه' && last) tries.push(['', j]);                                         // بيته beetu
        if (c === 'آ') { if (tok === '2' && t[j + 1] === 'aa') tries.push(['', j + 2]); if (tok === 'aa' || tok === 'a') tries.push(['', j + 1]); } // آسفة asfa
        else if ('أإءؤئ'.includes(c)) consonant(['2'], true);
        else if (CONS[c]) consonant(CONS[c], false);
        for (const [m, nj] of tries) { const r2 = go(i + 1, nj); if (r2) { res = [m].concat(r2); break; } }
      }
      memo.set(k, res);
      return res;
    }
    let marks = go(0, 0);
    if (!marks && isVowelTok(t[0]) && t[0].length === 1 && letters[0] !== 'ا') marks = go(0, 1); // تشرفنا itsharrafna
    if (!marks) return null;
    let li = 0;
    return Array.from(word.replace(HARAKAT, '')).map((ch) => (AR_LETTER.test(ch) ? ch + (marks[li++] || '') : ch)).join('').replace(/َاً/g, 'اً');
  }
  /* Pair Arabic words with roman words. The roman sometimes joins or splits words differently:
     «في الآخر» = "fil-aaxir", «وفي» = "w fi". Returns [[arWord, roman|''], …] maximizing pairs that align. */
  function alignWords(aw, rw) {
    const n = aw.length, m = rw.length, fits = (a, r) => !!(r && hasAr(a) && vocalize(a, r));
    if (n === m && aw.every((a, i) => !hasAr(a) || fits(a, rw[i]))) return aw.map((a, i) => [a, rw[i]]); // the usual case
    const best = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
    best[n][m] = { score: 0, pairs: [] };
    for (let i = n; i >= 0; i--) for (let j = m; j >= 0; j--) {
      if (i === n && j === m) continue;
      const opts = [];
      const take = (ni, nj, pairs, sc) => { const b = best[ni] && best[ni][nj]; if (b) opts.push({ score: b.score + sc, pairs: pairs.concat(b.pairs) }); };
      if (i < n && j < m) take(i + 1, j + 1, [[aw[i], rw[j]]], fits(aw[i], rw[j]) ? 2 : 0);
      // two roman words for one Arabic word: «وفي» = "w fi", «مفيش» = "ma fiish"
      if (i < n && j + 1 < m) { const r = rw[j] + ' ' + rw[j + 1]; if (fits(aw[i], r)) take(i + 1, j + 2, [[aw[i], r]], 2); }
      // one roman word for two Arabic words: «في الآخر» = "fil-aaxir", «على الطول» = "3ala T-Tuul"
      if (i + 1 < n && j < m) {
        const mm = rw[j].match(/^(fi|bi|li|wi|ma3a|3ala|3a|min)([a-zA-Z0-9]{1,2})-(.+)$/);
        if (mm) { const r1 = mm[1], r2 = 'i' + mm[2] + '-' + mm[3]; take(i + 2, j + 1, [[aw[i], r1], [aw[i + 1], r2]], (fits(aw[i], r1) ? 2 : 0) + (fits(aw[i + 1], r2) ? 2 : 0)); }
      }
      // both at once: «وفي الآخر» = "w fil-aaxir"
      if (i + 1 < n && j + 1 < m && /^(w|wi|wa|we|u)$/.test(rw[j]) && aw[i][0] === 'و') {
        const mm = rw[j + 1].match(/^(fi|bi|li|ma3a|3ala|3a|min)([a-zA-Z0-9]{1,2})-(.+)$/);
        if (mm) { const r1 = rw[j] + ' ' + mm[1], r2 = 'i' + mm[2] + '-' + mm[3]; take(i + 2, j + 2, [[aw[i], r1], [aw[i + 1], r2]], (fits(aw[i], r1) ? 2 : 0) + (fits(aw[i + 1], r2) ? 2 : 0)); }
      }
      if (i < n) take(i + 1, j, [[aw[i], '']], 0);      // skip an Arabic word
      if (j < m) take(i, j + 1, [], -1);                 // skip a roman word
      best[i][j] = opts.sort((a, b) => b.score - a.score)[0] || null;
    }
    return best[0][0].pairs;
  }
  // Arabic (+ optional roman) → the text a synthesizer should read
  function ttsText(ar, ro) {
    ar = String(ar || '');
    // digits are read as Egyptian number words (voices tend to read them the Fusha way)
    if (/[0-9٠-٩]/.test(ar)) {
      const dig = (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d) >= 0 ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d) : d);
      ar = ar.replace(/[0-9٠-٩]+/g, (m) => number(+Array.from(m).map(dig).join('')).ar);
      ro = ''; // the word count changed; pronunciations come from the learned words
    }
    const words = ar.split(/\s+/).filter(Boolean);
    const rw = String(ro || '').trim() ? String(ro).trim().split(/\s+/) : [];
    const pairs = rw.length ? alignWords(words, rw) : words.map((w) => [w, '']);
    return pairs.map(([w, r]) => {
      if (!r || !vocalize(w, r)) { const f = romanFor(w); r = f.guess ? (r && !vocalize(w, r) ? '' : r) : f.ro; }
      return egyWord((r && vocalize(w, r)) || w, r);
    }).join(' ');
  }
  // What identifies a spoken text (file names / caches): the Arabic as written in the course (+ its transcription)
  const speechKey = (ar) => String(ar || '').replace(/[‌‍|[\]]/g, '').replace(/\s+/g, ' ').trim();
  // FNV-1a + djb2 → 16 hex chars; identical in the browser and in the Node build script
  function hash(s) {
    let h1 = 0x811c9dc5, h2 = 5381;
    for (const ch of String(s)) { const c = ch.codePointAt(0); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = (Math.imul(h2, 33) + c) >>> 0; }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }
  const audioId = (voice, ar) => hash(voice + '|' + speechKey(ar));
  // Text → spoken pieces (one per line / sentence, at most ~240 characters each)
  // tts (vowel-marked text for a synthesizer) is computed only when a synthesizer needs it
  const chunk = (key, ar, ro) => ({ key, get tts() { if (this._t === undefined) this._t = ttsText(ar, ro); return this._t; } });
  function speechChunks(text) {
    const out = [];
    String(text == null ? '' : text).replace(/\[\[|\]\]/g, '').split(/\s*\n\s*/).forEach((line) => {
      if (!line) return;
      const p = split(line), ar = speechKey(p.ar), ro = p.ro.replace(/\|/g, '').trim();
      if (!hasAr(ar)) return;
      const r = ro || (romanFor(ar).guess ? '' : romanFor(ar).ro);
      // the transcription is part of the key, so homographs (كتب katab / kutub) get their own audio
      if (ar.length <= 240) { out.push(chunk(r ? ar + '~' + r.replace(/\s+/g, ' ') : ar, ar, r)); return; }
      let buf = '';
      ar.split(/(?<=[.!?؟،؛])\s+/).forEach((s) => {
        if (buf && (buf + ' ' + s).length > 240) { out.push(chunk(buf, buf, '')); buf = ''; }
        buf = buf ? buf + ' ' + s : s;
      });
      if (buf) out.push(chunk(buf, buf, ''));
    });
    return out;
  }

  /* By default the site plays ONLY recordings of a real Egyptian speaker (files in /audio, made with
     the recording studio). Synthesized voices (Azure, the browser's ar-EG voice, Fusha voices) are
     switched off; the site owner can turn them back on in js/config.js. Text with no recording shows
     its transcription and no play button. */
  const CONFIG = window.MASRI_CONFIG || {};
  const speech = {
    synth: !!CONFIG.synthesizedVoices,
    local: new Map(),       // audio id → blob URL: recordings still in this browser's studio (not exported yet)
    voice: null, mode: 'none', rate: 0.85, ready: false,
    voiceSel: 'f',          // 'f' = Salma (female), 'm' = Shakir (male)
    allowFusha: false,      // the learner may opt in to non-Egyptian browser voices
    cloud: false,           // /api/tts answered the probe
    egVoice: null, otherVoice: null,
    files: new Map(),       // audio id → file extension (from js/data/audio-manifest.js)
    BASE_RATE: 0.85,        // generated audio is made at this speed; others are played faster/slower
    _token: 0, _audio: null,
    init() {
      const probe = typeof Audio === 'function' ? new Audio() : null;
      const TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', wav: 'audio/wav' };
      String(window.AUDIO_FILES || '').split(/\s+/).forEach((h) => {
        if (!h) return;
        const [id, ext = 'mp3'] = h.split('.');
        // skip formats this browser can't play (e.g. .webm recordings on older iPhones)
        if (ext !== 'mp3' && probe && probe.canPlayType && !probe.canPlayType(TYPES[ext] || '')) return;
        this.files.set(id, ext);
      });
      this.loadLocal();
      if (!this.synth) { this.refresh(); return; }
      if ('speechSynthesis' in window) {
        const pick = () => {
          const vs = window.speechSynthesis.getVoices();
          const eg = vs.filter((v) => /^ar[-_]EG/i.test(v.lang));
          const want = this.voiceSel === 'm' ? /shakir/i : /salma/i;
          const score = (v) => (want.test(v.name) ? 4 : 0) + (/online|natural|neural/i.test(v.name) ? 2 : 0);
          this.egVoice = eg.sort((a, b) => score(b) - score(a))[0] || null;
          this.otherVoice = vs.find((v) => /^ar/i.test(v.lang) && !/^ar[-_]EG/i.test(v.lang)) || null;
          this.refresh();
        };
        pick();
        window.speechSynthesis.onvoiceschanged = pick;
        this._pick = pick;
      }
      let cached = null;
      try { cached = sessionStorage.getItem('masri-tts'); } catch (e) { /* storage blocked */ }
      if (cached !== null) { this.cloud = cached === '1'; this.refresh(); }
      else if (window.fetch && /^https?:$/.test(location.protocol)) {
        fetch('/api/tts?probe=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { ok: false })).catch(() => ({ ok: false })).then((j) => {
          this.cloud = !!(j && j.ok);
          try { sessionStorage.setItem('masri-tts', this.cloud ? '1' : '0'); } catch (e) { /* ignore */ }
          this.refresh();
        });
      }
      this.refresh();
    },
    // On the device where the studio is used, its not-yet-exported recordings play too (a preview).
    loadLocal() {
      let used = false;
      try { used = localStorage.getItem('masri-rec-used') === '1'; } catch (e) { /* storage blocked */ }
      if (!used || !window.indexedDB) return;
      const r = indexedDB.open('masri-rec', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('rec', { keyPath: 'id' }); r.result.createObjectStore('flag', { keyPath: 'key' }); };
      r.onsuccess = () => {
        try {
          const q = r.result.transaction('rec', 'readonly').objectStore('rec').getAll();
          q.onsuccess = () => { (q.result || []).forEach((x) => this.addLocal(x.id, x.blob)); this.refresh(); };
        } catch (e) { /* ignore */ }
      };
    },
    addLocal(id, blob) {
      if (this.local.has(id)) URL.revokeObjectURL(this.local.get(id));
      this.local.set(id, URL.createObjectURL(blob));
    },
    recorded() { return new Set([...this.files.keys(), ...this.local.keys()]).size; },
    // Is every piece of this text recorded (in either voice)?
    has(text) {
      const cs = speechChunks(text);
      return cs.length > 0 && cs.every((c) => this.sources(c).length > 0);
    },
    setVoice(v) { this.voiceSel = v === 'm' ? 'm' : 'f'; if (this._pick) this._pick(); else this.refresh(); },
    setFusha(on) { this.allowFusha = !!on; this.refresh(); },
    refresh() {
      const rec = this.files.size + this.local.size > 0;
      if (!this.synth) { this.voice = null; this.mode = rec ? 'files' : 'none'; }
      else {
        this.voice = this.egVoice || (this.allowFusha ? this.otherVoice : null);
        this.mode = this.cloud ? 'cloud' : this.egVoice ? 'eg' : rec ? 'files' : (this.allowFusha && this.otherVoice) ? 'ar' : 'none';
      }
      this.ready = true;
      document.dispatchEvent(new CustomEvent('kg-voice', { detail: this.mode }));
    },
    fushaBlocked() { return this.synth && !this.cloud && !this.egVoice && !this.allowFusha && !!this.otherVoice; },
    available() { return this.mode !== 'none'; },
    label() {
      return {
        cloud: 'Египет арабчасынын нейрон үнү (Azure ar-EG, ' + (this.voiceSel === 'm' ? 'Шакир' : 'Салма') + ')',
        eg: 'Түзмөгүңүздөгү египетче үн (ar-EG' + (this.egVoice ? ': ' + this.egVoice.name : '') + ')',
        files: this.synth ? 'Сайттагы египетче аудио файлдар (бардык сөздөр үчүн эмес)' : 'Египеттик адамдын жазылган үнү',
        ar: 'Фусха үнү — ЕГИПЕТЧЕ ЭМЕС (сиз өзүңүз күйгүздүңүз)',
        none: !this.synth ? 'Азырынча жазылган аудио жок' : this.fushaBlocked() ? 'Египетче үн жок (түзмөктөгү фусха үнү өчүрүлгөн)' : 'Египетче үн жок'
      }[this.mode];
    },
    // Ordered list of ways to play one chunk
    sources(c) {
      const out = [], v = this.voiceSel, other = v === 'm' ? 'f' : 'm';
      const file = (voice) => {
        const id = audioId(voice, c.key);
        if (this.local.has(id)) return { url: this.local.get(id) };
        return this.files.has(id) ? { url: '/audio/' + id + '.' + this.files.get(id) } : null;
      };
      if (file(v)) out.push(file(v));
      if (this.synth && this.cloud) out.push({ url: '/api/tts?v=' + v + '&t=' + encodeURIComponent(c.tts) });
      if (file(other)) out.push(file(other));
      if (this.synth && this.voice && 'speechSynthesis' in window) out.push({ voice: this.voice });
      return out;
    },
    stop() {
      this._token++;
      if (this._audio) { try { this._audio.pause(); } catch (e) { /* ignore */ } this._audio = null; }
      if (this.synth && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    playOne(c, rate, token) {
      const srcs = this.sources(c);
      return new Promise((done) => {
        const next = () => {
          if (token !== this._token) return done(false);
          const s = srcs.shift();
          if (!s) return done(false);
          if (s.url) {
            const a = new Audio(s.url);
            this._audio = a;
            a.playbackRate = Math.max(0.5, Math.min(2, rate / this.BASE_RATE));
            if ('preservesPitch' in a) a.preservesPitch = true;
            a.onended = () => done(true);
            a.onerror = next;
            const p = a.play(); if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') done(false); else next(); });
          } else {
            const u = new SpeechSynthesisUtterance(c.tts);
            u.voice = s.voice; u.lang = s.voice.lang; u.rate = rate;
            u.onend = () => done(true); u.onerror = next;
            window.speechSynthesis.speak(u);
          }
        };
        next();
      });
    },
    say(text, rate) {
      const chunks = speechChunks(text);
      if (!chunks.length || !chunks.some((c) => this.sources(c).length)) return false;
      this.stop();
      const token = this._token, r = rate || this.rate;
      chunks.reduce((p, c) => p.then(() => (token === this._token ? this.playOne(c, r, token) : false)), Promise.resolve());
      return true;
    }
  };

  /* -------------------------------- Persons --------------------------------- */
  const PERSONS = ['ana', 'inta', 'inti', 'huwwa', 'hiyya', 'i7na', 'intu', 'humma'];
  const PRONOUN = { ana: 'أنا~ana', inta: 'إنت~inta', inti: 'إنتي~inti', huwwa: 'هو~huwwa', hiyya: 'هي~hiyya', i7na: 'إحنا~i7na', intu: 'إنتو~intu', humma: 'هما~humma' };
  const PERSON_KY = { ana: 'мен', inta: 'сен (эркекке)', inti: 'сен (аялга)', huwwa: 'ал (эркек)', hiyya: 'ал (аял)', i7na: 'биз', intu: 'силер / сиздер', humma: 'алар' };

  /* -------------------------------- Nouns ----------------------------------- */
  // Possessive endings: [after a consonant, roman] / Arabic letters
  const POSS = {
    ana: { c: 'i', ar: 'ي', ky: 'менин' }, inta: { c: 'ak', ar: 'ك', ky: 'сенин (эркек)' }, inti: { c: 'ik', ar: 'ك', ky: 'сенин (аял)' },
    huwwa: { c: 'u', ar: 'ه', ky: 'анын (эркек)' }, hiyya: { c: 'ha', ar: 'ها', ky: 'анын (аял)' }, i7na: { c: 'na', ar: 'نا', ky: 'биздин' },
    intu: { c: 'ku', ar: 'كم', ky: 'силердин' }, humma: { c: 'hum', ar: 'هم', ky: 'алардын' }
  };
  const V = 'aeiou';
  const isV = (c) => V.includes(c);
  function possess(noun, person) {
    // noun: { ar, ro }  e.g. { ar:'كتاب', ro:'kitaab' }, { ar:'عربية', ro:'3arabiyya' }
    const P = POSS[person];
    let ar = noun.ar, ro = noun.ro;
    const steps = [];
    const fem = /ة$/.test(ar) && /a$/.test(ro);
    if (fem) {
      ar = ar.replace(/ة$/, 'ت'); ro = ro.replace(/a$/, 'it');
      steps.push({ why: 'Сөз ة (-а) менен бүтөт. Аягына эч нерсе жабышканда ة кайра «т» болуп ачылат: ' + noun.ro + ' → ' + ro + '-.' });
    }
    let suf = P.c;
    const consSuf = !isV(suf[0]);
    const endsCC = !fem && ro.length > 2 && !isV(ro.slice(-1)) && !isV(ro.slice(-2, -1)) && ro.slice(-1) !== ro.slice(-2, -1);
    if (consSuf && endsCC) {
      const helper = suf === 'ha' ? 'a' : (suf === 'na' ? 'i' : 'u');
      steps.push({ why: `Сөз эки үнсүз менен бүтөт (${ro.slice(-2)}), ал эми мүчө да үнсүздөн башталат. Египеттиктер үч үнсүздү катар айтпайт, ортого «${helper}» кошулат.` });
      suf = helper + suf;
    } else if (consSuf && !fem) {
      const m = ro.match(/^(.*?)(aa|ii|uu|ee|oo)([^aeiou]+)$/);
      if (m && m[3].length === 1) {
        ro = m[1] + m[2][0] + m[3];
        steps.push({ why: `Үнсүздөн башталган мүчө (-${suf}) алдында узун үндүү кыскарат: ${noun.ro} → ${ro}-. Жазылышы өзгөрбөйт.` });
      }
    }
    const word = { ar: ar + P.ar, ro: ro + suf };
    steps.push({ add: P.ar, why: `«${P.ky}» мүчөсү: -${P.c} (${P.ar}). Кыргызчадагыдай эле, ээси сөздүн аягына жабышат: ${noun.ro} → ${word.ro}.` });
    return { word, stem: { ar, ro }, steps };
  }
  const SUN = 'تثدذرزسشصضطظلن';
  function article(noun) {
    const first = noun.ar.replace(HARAKAT, '')[0];
    const sun = SUN.includes(first);
    const m = noun.ro.match(/^(sh|[a-zA-Z23]|7)/);
    const c = m ? m[1] : '';
    if (/^[aeiou]/.test(noun.ro)) return { word: { ar: 'ال' + noun.ar, ro: 'il-' + noun.ro.replace(/^[aeiou]/, (v) => v) }, sun: false, why: 'Үндүүдөн башталган сөз: «il-» өзгөрбөйт.' };
    if (sun) return { word: { ar: 'ال' + noun.ar, ro: 'i' + c + '-' + noun.ro }, sun: true, why: `${first} — «күн тамгасы». «il-» деги л айтылбайт, анын ордуна ${c} эки эсе айтылат: i${c}-${noun.ro}. Жазууда ال дагы эле турат.` };
    return { word: { ar: 'ال' + noun.ar, ro: 'il-' + noun.ro }, sun: false, why: `${first} — «ай тамгасы». «il-» толук айтылат.` };
  }
  function dual(noun) {
    const fem = /ة$/.test(noun.ar);
    return fem ? { ar: noun.ar.replace(/ة$/, 'تين'), ro: noun.ro.replace(/a$/, 'iteen') } : { ar: noun.ar + 'ين', ro: noun.ro.replace(/(aa|ii|uu|ee|oo)([^aeiou])$/, (m0, v, c) => v[0] + c) + 'een' };
  }

  /* -------------------------------- Verbs ----------------------------------- */
  /* Each verb: past "he" form, the stem used with -t/-na endings (1st/2nd person),
     the stem used with vowel endings (hiyya -it, humma -u), the present stem with
     its prefix vowel, and the "you (m.)" command.  [arabic, roman] pairs. */
  const VERBS = [
    // sound (a–i), (a–u), (i–a)
    { id: 'katab', ky: 'жаз-', pa: ['كتب', 'katab'], pc: ['كتب', 'katab'], pv: ['كتب', 'katab'], ip: ['كتب', 'ktib', 'i'], imp: ['اكتب', 'iktib'], ap: ['كاتب', 'kaatib'] },
    { id: 'darab', ky: 'ур-', pa: ['ضرب', 'Darab'], pc: ['ضرب', 'Darab'], pv: ['ضرب', 'Darab'], ip: ['ضرب', 'Drab', 'i'], imp: ['اضرب', 'iDrab'] },
    { id: 'fata7', ky: 'ач-', pa: ['فتح', 'fata7'], pc: ['فتح', 'fata7'], pv: ['فتح', 'fat7'], ip: ['فتح', 'fta7', 'i'], imp: ['افتح', 'ifta7'], ap: ['فاتح', 'faati7'] },
    { id: '2afal', ky: 'жап-', pa: ['قفل', '2afal'], pc: ['قفل', '2afal'], pv: ['قفل', '2afal'], ip: ['قفل', '2fil', 'i'], imp: ['اقفل', 'i2fil'] },
    { id: 'daxal', ky: 'кир-', pa: ['دخل', 'daxal'], pc: ['دخل', 'daxal'], pv: ['دخل', 'daxal'], ip: ['دخل', 'dxul', 'u'], imp: ['ادخل', 'udxul'], ap: ['داخل', 'daaxil'] },
    { id: 'xarag', ky: 'чык-', pa: ['خرج', 'xarag'], pc: ['خرج', 'xarag'], pv: ['خرج', 'xarag'], ip: ['خرج', 'xrug', 'u'], imp: ['اخرج', 'uxrug'], ap: ['خارج', 'xaarig'] },
    { id: 'Talab', ky: 'сура-, буйрутма бер-', pa: ['طلب', 'Talab'], pc: ['طلب', 'Talab'], pv: ['طلب', 'Talab'], ip: ['طلب', 'Tlub', 'u'], imp: ['اطلب', 'uTlub'] },
    { id: 'shirib', ky: 'ич-', pa: ['شرب', 'shirib'], pc: ['شرب', 'shirib'], pv: ['شرب', 'shirb'], ip: ['شرب', 'shrab', 'i'], imp: ['اشرب', 'ishrab'] },
    { id: 'fihim', ky: 'түшүн-', pa: ['فهم', 'fihim'], pc: ['فهم', 'fihim'], pv: ['فهم', 'fihm'], ip: ['فهم', 'fham', 'i'], imp: ['افهم', 'ifham'], ap: ['فاهم', 'faahim'] },
    { id: '3irif', ky: 'бил-, тааны-', pa: ['عرف', '3irif'], pc: ['عرف', '3irif'], pv: ['عرف', '3irf'], ip: ['عرف', '3raf', 'i'], imp: ['اعرف', 'i3raf'], ap: ['عارف', '3aarif'] },
    { id: 'simi3', ky: 'ук-', pa: ['سمع', 'simi3'], pc: ['سمع', 'simi3'], pv: ['سمع', 'sim3'], ip: ['سمع', 'sma3', 'i'], imp: ['اسمع', 'isma3'], ap: ['سامع', 'saami3'] },
    { id: 'li3ib', ky: 'ойно-', pa: ['لعب', 'li3ib'], pc: ['لعب', 'li3ib'], pv: ['لعب', 'li3b'], ip: ['لعب', 'l3ab', 'i'], imp: ['العب', 'il3ab'] },
    { id: 'rikib', ky: 'мин-, түш- (унаага)', pa: ['ركب', 'rikib'], pc: ['ركب', 'rikib'], pv: ['ركب', 'rikb'], ip: ['ركب', 'rkab', 'i'], imp: ['اركب', 'irkab'], ap: ['راكب', 'raakib'] },
    { id: 'nizil', ky: 'түш-, ылдый түш-', pa: ['نزل', 'nizil'], pc: ['نزل', 'nizil'], pv: ['نزل', 'nizl'], ip: ['نزل', 'nzil', 'i'], imp: ['انزل', 'inzil'], ap: ['نازل', 'naazil'] },
    { id: 'misik', ky: 'карма-', pa: ['مسك', 'misik'], pc: ['مسك', 'misik'], pv: ['مسك', 'misk'], ip: ['مسك', 'msik', 'i'], imp: ['امسك', 'imsik'] },
    // hollow
    { id: 'shaaf', ky: 'көр-', pa: ['شاف', 'shaaf'], pc: ['شف', 'shuf'], pv: ['شاف', 'shaaf'], ip: ['شوف', 'shuuf', 'i'], imp: ['شوف', 'shuuf'], ap: ['شايف', 'shaayif'] },
    { id: '2aal', ky: 'айт-', pa: ['قال', '2aal'], pc: ['قل', '2ul'], pv: ['قال', '2aal'], ip: ['قول', '2uul', 'i'], imp: ['قول', '2uul'] },
    { id: 'raa7', ky: 'бар-, кет-', pa: ['راح', 'raa7'], pc: ['رح', 'ru7'], pv: ['راح', 'raa7'], ip: ['روح', 'ruu7', 'i'], imp: ['روح', 'ruu7'], ap: ['رايح', 'raayi7'] },
    { id: 'naam', ky: 'укта-', pa: ['نام', 'naam'], pc: ['نم', 'nim'], pv: ['نام', 'naam'], ip: ['نام', 'naam', 'i'], imp: ['نام', 'naam'], ap: ['نايم', 'naayim'] },
    { id: 'zaar', ky: 'зыярат кыл-, конокко бар-', pa: ['زار', 'zaar'], pc: ['زر', 'zur'], pv: ['زار', 'zaar'], ip: ['زور', 'zuur', 'i'], imp: ['زور', 'zuur'] },
    { id: 'baa3', ky: 'сат-', pa: ['باع', 'baa3'], pc: ['بع', 'bi3'], pv: ['باع', 'baa3'], ip: ['بيع', 'bii3', 'i'], imp: ['بيع', 'bii3'] },
    { id: 'kaan', ky: 'бол- (эле)', pa: ['كان', 'kaan'], pc: ['كن', 'kun'], pv: ['كان', 'kaan'], ip: ['كون', 'kuun', 'i'], imp: ['كون', 'kuun'] },
    // defective
    { id: 'mishi', ky: 'бас-, кет-', pa: ['مشي', 'mishi'], pc: ['مشي', 'mishii'], pv: ['مشي', 'mishy'], ip: ['مشي', 'mshi', 'i'], imp: ['امشي', 'imshi'], ap: ['ماشي', 'maashi'] },
    { id: 'nisi', ky: 'унут-', pa: ['نسي', 'nisi'], pc: ['نسي', 'nisii'], pv: ['نسي', 'nisy'], ip: ['نسى', 'nsa', 'i'], imp: ['انسى', 'insa'], ap: ['ناسي', 'naasi'] },
    { id: 'ishtara', ky: 'сатып ал-', pa: ['اشترى', 'ishtara'], pc: ['اشتري', 'ishtarii'], pv: ['اشتر', 'ishtar'], ip: ['شتري', 'shtiri', 'i'], imp: ['اشتري', 'ishtiri'] },
    { id: 'ibtada', ky: 'башта-', pa: ['ابتدى', 'ibtada'], pc: ['ابتدي', 'ibtadii'], pv: ['ابتد', 'ibtad'], ip: ['بتدي', 'btidi', 'i'], imp: ['ابتدي', 'ibtidi'] },
    // doubled
    { id: '7abb', ky: 'сүй-, жакшы көр-', pa: ['حب', '7abb'], pc: ['حبي', '7abbee'], pv: ['حب', '7abb'], ip: ['حب', '7ibb', 'i'], imp: ['حب', '7ibb'] },
    { id: '7aTT', ky: 'кой-', pa: ['حط', '7aTT'], pc: ['حطي', '7aTTee'], pv: ['حط', '7aTT'], ip: ['حط', '7oTT', 'i'], imp: ['حط', '7oTT'] },
    // derived forms
    { id: 'fahhim', ky: 'түшүндүр-', pa: ['فهم', 'fahhim'], pc: ['فهم', 'fahhim'], pv: ['فهم', 'fahm'], ip: ['فهم', 'fahhim', 'i'], imp: ['فهم', 'fahhim'] },
    { id: 'kallim', ky: '(бирөө менен) сүйлөш-, чал-', pa: ['كلم', 'kallim'], pc: ['كلم', 'kallim'], pv: ['كلم', 'kalm'], ip: ['كلم', 'kallim', 'i'], imp: ['كلم', 'kallim'] },
    { id: 'gahhiz', ky: 'даярда-', pa: ['جهز', 'gahhiz'], pc: ['جهز', 'gahhiz'], pv: ['جهز', 'gahz'], ip: ['جهز', 'gahhiz', 'i'], imp: ['جهز', 'gahhiz'] },
    { id: 'saafir', ky: 'сапар чык-', pa: ['سافر', 'saafir'], pc: ['سافر', 'saafir'], pv: ['سافر', 'saafr'], ip: ['سافر', 'saafir', 'i'], imp: ['سافر', 'saafir'], ap: ['مسافر', 'misaafir'] },
    { id: 'saa3id', ky: 'жардам бер-', pa: ['ساعد', 'saa3id'], pc: ['ساعد', 'saa3id'], pv: ['ساعد', 'saa3d'], ip: ['ساعد', 'saa3id', 'i'], imp: ['ساعد', 'saa3id'] },
    { id: 'itkallim', ky: 'сүйлө-', pa: ['اتكلم', 'itkallim'], pc: ['اتكلم', 'itkallim'], pv: ['اتكلم', 'itkalm'], ip: ['تكلم', 'tkallim', 'i'], imp: ['اتكلم', 'itkallim'] },
    { id: 'it3allim', ky: 'үйрөн-', pa: ['اتعلم', 'it3allim'], pc: ['اتعلم', 'it3allim'], pv: ['اتعلم', 'it3alm'], ip: ['تعلم', 't3allim', 'i'], imp: ['اتعلم', 'it3allim'] },
    { id: 'ishtaghal', ky: 'иште-', pa: ['اشتغل', 'ishtaghal'], pc: ['اشتغل', 'ishtaghal'], pv: ['اشتغل', 'ishtaghal'], ip: ['شتغل', 'shtaghal', 'i'], imp: ['اشتغل', 'ishtaghal'] },
    { id: 'ista3mil', ky: 'колдон-', pa: ['استعمل', 'ista3mil'], pc: ['استعمل', 'ista3mil'], pv: ['استعمل', 'ista3mal'], ip: ['ستعمل', 'sta3mil', 'i'], imp: ['استعمل', 'ista3mil'] },
    { id: 'istanna', ky: 'күт-', pa: ['استنى', 'istanna'], pc: ['استني', 'istannee'], pv: ['استن', 'istann'], ip: ['ستنى', 'stanna', 'i'], imp: ['استنى', 'istanna'] },
    // irregular
    { id: 'kal', ky: 'же-', pa: ['كل', 'kal'], pc: ['كل', 'kal'], pv: ['كل', 'kal'], ip: ['اكل', 'akul', 'a'], imp: ['كل', 'kul'], irr: true },
    { id: 'xad', ky: 'ал-', pa: ['خد', 'xad'], pc: ['خد', 'xad'], pv: ['خد', 'xad'], ip: ['اخد', 'axud', 'a'], imp: ['خد', 'xud'], irr: true },
    { id: 'ga', ky: 'кел-', pa: ['جه', 'ga'], pc: ['جي', 'gii'], pv: ['ج', 'g'], ip: ['يجي', 'iigi', 'y'], imp: ['تعالى', 'ta3aala'], ap: ['جاي', 'gaay'], irr: true }
  ];
  const verbById = (id) => VERBS.find((v) => v.id === id);

  const TENSES = {
    past: { name: 'Өткөн чак', ky: '…ды (жазды)', ex: 'katab — ал жазды' },
    bare: { name: 'Жөнөкөй форма (b- жок)', ky: 'лааzim, 3aayiz, mumkin кийин', ex: 'laazim aktib — жазышым керек' },
    present: { name: 'Учур чак (bi-)', ky: '…ат / …ып жатат', ex: 'biyiktib — ал жазат / жазып жатат' },
    future: { name: 'Келер чак (ha-)', ky: '…мак / …ат (келечекте)', ex: 'hayiktib — ал жазат (келечекте)' },
    pastNeg: { name: 'Өткөн чак, тануу', ky: '…баган жок', ex: 'ma katabsh — ал жазган жок' },
    presentNeg: { name: 'Учур чак, тануу', ky: '…байт', ex: 'ma biyiktibsh — ал жазбайт' },
    imperative: { name: 'Буйрук', ky: 'жаз! жазгыла!', ex: 'iktib! — жаз!' }
  };
  const PAST_END = { ana: ['t', 'ت'], inta: ['t', 'ت'], inti: ['ti', 'تي'], huwwa: ['', ''], hiyya: ['it', 'ت'], i7na: ['na', 'نا'], intu: ['tu', 'توا'], humma: ['u', 'وا'] };
  const PRES_PRE = { ana: ['a', 'أ'], inta: ['t', 'ت'], inti: ['t', 'ت'], huwwa: ['y', 'ي'], hiyya: ['t', 'ت'], i7na: ['n', 'ن'], intu: ['t', 'ت'], humma: ['y', 'ي'] };
  const PRES_SUF = { inti: ['i', 'ي'], intu: ['u', 'وا'], humma: ['u', 'وا'] };

  function pastForm(v, p) {
    const e = PAST_END[p];
    if (p === 'huwwa') return { ar: v.pa[0], ro: v.pa[1] };
    if (p === 'hiyya' || p === 'humma') {
      const ro = v.pv[1] + (p === 'hiyya' ? (/[iy]$/.test(v.pv[1]) && /y$/.test(v.pv[1]) ? 'it' : 'it') : 'u');
      let ar = v.pv[0] + e[1];
      if (v.id === 'ga') return p === 'hiyya' ? { ar: 'جت', ro: 'gat' } : { ar: 'جم', ro: 'gum' };
      if (/[^aeiou]$/.test(v.pv[1]) && /y$/.test(v.pv[1])) ar = v.pv[0] + e[1];
      return { ar, ro };
    }
    let base = v.pc[1];
    let ar = v.pc[0] + e[1];
    let ro = base + e[0];
    if (/ee$/.test(base) || /ii$/.test(base)) ro = base + e[0]; // 7abbeet, mishiit
    if (p === 'ana' || p === 'inta') ro = base + 't';
    return { ar, ro };
  }
  function bareForm(v, p) {
    const pre = PRES_PRE[p], suf = PRES_SUF[p];
    const [sAr, sRo, pv] = v.ip;
    let ro, ar;
    if (pv === 'a') { // kal / xad: aakul, taakul, yaakul
      const st = sRo.replace(/^a/, 'aa');
      ro = (p === 'ana' ? '' : pre[0]) + st;
      ar = (p === 'ana' ? 'آ' : pre[1] + 'ا') + sAr.slice(1);
    } else if (pv === 'y') { // ga: aagi, tiigi, yiigi
      ro = p === 'ana' ? 'aagi' : pre[0] + sRo;
      ar = p === 'ana' ? 'آجي' : pre[1] + 'يجي';
    } else {
      ro = (p === 'ana' ? 'a' : pre[0] + 'i') + sRo;
      if (/^[aeiou]/.test(sRo) && p !== 'ana') ro = pre[0] + 'i' + sRo; // yinaam
      if (/^[^aeiou]{1}[aeiou]/.test(sRo) && sRo.length > 3 && /^(fahhim|kallim|gahhiz|saafir|saa3id)$/.test(sRo)) ro = (p === 'ana' ? 'a' : pre[0] + 'i') + sRo;
      ar = pre[1] + sAr;
    }
    if (suf) {
      if (/[ia]$/.test(ro) && !/[^aeiou]i$/.test(ro.slice(-3)) || /(shi|ri|di|gi)$/.test(ro)) {
        // vowel-final stems: imshi → timshi (inti), yimshu (pl)
        if (/[ia]$/.test(ro)) { ro = ro.slice(0, -1) + suf[0]; ar = ar.replace(/[يى]$/, '') + suf[1]; }
        else { ro += suf[0]; ar += suf[1]; }
      } else { ro += suf[0]; ar += suf[1]; }
    }
    return { ar, ro };
  }
  function addB(f, p) {
    // b- present: ana baktib, inta bitiktib ...
    if (p === 'ana') return { ar: 'ب' + f.ar.replace(/^[أآ]/, (c) => (c === 'آ' ? 'ا' : '')), ro: 'b' + f.ro };
    return { ar: 'ب' + f.ar, ro: 'bi' + f.ro };
  }
  function addHa(f, p) {
    if (p === 'ana') return { ar: 'ه' + f.ar.replace(/^[أآ]/, (c) => (c === 'آ' ? 'ا' : '')), ro: 'h' + f.ro };
    return { ar: 'ه' + f.ar, ro: 'ha' + f.ro };
  }
  function negate(f) {
    // ma … sh ; a final vowel gets long: katabu → ma katabuush
    let ro = f.ro, ar = f.ar;
    if (/[aiu]$/.test(ro) && !/(aa|ii|uu)$/.test(ro)) ro = ro + ro.slice(-1) + 'sh';
    else if (/[^aeiou]{2}$/.test(ro) || /(t)$/.test(ro) && /[^aeiou]t$/.test(ro)) ro = ro + 'ish';
    else ro = ro + 'sh';
    ar = ar.replace(/ى$/, 'ا').replace(/وا$/, 'و').replace(/^جه$/, 'جا') + 'ش';
    if (/^i[^aeiou]{2}/.test(ro)) ro = ro.slice(1); // ma + itkallim → ma tkallim
    return { ar: 'ما ' + ar, ro: 'ma ' + ro };
  }
  function conjugate(id, tense) {
    const v = verbById(id);
    if (!v) return { rows: [] };
    const rows = [];
    const add = (p, f) => rows.push({ p, pr: PRONOUN[p], ky: PERSON_KY[p], ar: f.ar, ro: f.ro });
    if (tense === 'imperative') {
      const ms = { ar: v.imp[0], ro: v.imp[1] };
      const vend = /[ia]$/.test(ms.ro) && ms.ro !== '7ibb';
      const fs = v.id === 'ga' ? { ar: 'تعالي', ro: 'ta3aali' } : vend ? { ar: ms.ar.replace(/[ىي]$/, '') + 'ي', ro: ms.ro.slice(0, -1) + 'i' } : { ar: ms.ar + 'ي', ro: ms.ro + 'i' };
      const pl = v.id === 'ga' ? { ar: 'تعالوا', ro: 'ta3aalu' } : vend ? { ar: ms.ar.replace(/[ىي]$/, '') + 'وا', ro: ms.ro.slice(0, -1) + 'u' } : { ar: ms.ar + 'وا', ro: ms.ro + 'u' };
      rows.push({ p: 'inta', pr: PRONOUN.inta, ky: 'сен (эркекке)', ar: ms.ar, ro: ms.ro });
      rows.push({ p: 'inti', pr: PRONOUN.inti, ky: 'сен (аялга)', ar: fs.ar, ro: fs.ro });
      rows.push({ p: 'intu', pr: PRONOUN.intu, ky: 'силер / сиз', ar: pl.ar, ro: pl.ro });
      const neg = (f) => { const b = bareForm(v, f); const n = negate(b); return { ar: n.ar.replace(/^ما /, 'ما ').replace(/^ما ت/, 'ما ت'), ro: n.ro }; };
      ['inta', 'inti', 'intu'].forEach((p) => { const n = neg(p); rows.push({ p, pr: PRONOUN[p], ky: PERSON_KY[p] + ': болбо!', ar: n.ar, ro: n.ro, neg: true }); });
      return { verb: v, tense, rows };
    }
    PERSONS.forEach((p) => {
      let f;
      if (tense === 'past') f = pastForm(v, p);
      else if (tense === 'pastNeg') f = negate(pastForm(v, p));
      else if (tense === 'bare') f = bareForm(v, p);
      else if (tense === 'present') f = addB(bareForm(v, p), p);
      else if (tense === 'presentNeg') f = negate(addB(bareForm(v, p), p));
      else if (tense === 'future') f = addHa(bareForm(v, p), p);
      add(p, f);
    });
    if (tense === 'past' || tense === 'pastNeg') {
      // spelling: "I" and "you (m.)" look the same: كتبت
    }
    return { verb: v, tense, rows };
  }

  /* ----------------------- Adjectives & "to be" ----------------------------- */
  // Egyptian has no "am/is/are" in the present: ana ta3baan = мен чарчадым / чарчаганмын.
  const KAAN = { ana: ['كنت', 'kunt'], inta: ['كنت', 'kunt'], inti: ['كنتي', 'kunti'], huwwa: ['كان', 'kaan'], hiyya: ['كانت', 'kaanit'], i7na: ['كنا', 'kunna'], intu: ['كنتوا', 'kuntu'], humma: ['كانوا', 'kaanu'] };
  const HAYKUUN = { ana: ['هكون', 'hakuun'], inta: ['هتكون', 'hatkuun'], inti: ['هتكوني', 'hatkuuni'], huwwa: ['هيكون', 'haykuun'], hiyya: ['هتكون', 'hatkuun'], i7na: ['هنكون', 'hankuun'], intu: ['هتكونوا', 'hatkuunu'], humma: ['هيكونوا', 'haykuunu'] };
  function agree(adj, p) {
    // adj: { m:[ar,ro], f:[ar,ro], pl:[ar,ro] }
    if (p === 'inti' || p === 'hiyya') return adj.f;
    if (p === 'i7na' || p === 'intu' || p === 'humma') return adj.pl;
    return adj.m;
  }

  /* -------------------------------- Numbers --------------------------------- */
  const N1 = [['صفر', 'Sifr'], ['واحد', 'waa7id'], ['اتنين', 'itneen'], ['تلاتة', 'talaata'], ['أربعة', 'arba3a'], ['خمسة', 'xamsa'], ['ستة', 'sitta'], ['سبعة', 'sab3a'], ['تمانية', 'tamanya'], ['تسعة', 'tis3a'], ['عشرة', '3ashara'],
    ['حداشر', '7idaashar'], ['اتناشر', 'itnaashar'], ['تلاتاشر', 'talattaashar'], ['أربعتاشر', 'arba3taashar'], ['خمستاشر', 'xamastaashar'], ['ستاشر', 'sittaashar'], ['سبعتاشر', 'saba3taashar'], ['تمنتاشر', 'tamantaashar'], ['تسعتاشر', 'tisa3taashar']];
  const N10 = [null, null, ['عشرين', '3ishriin'], ['تلاتين', 'talatiin'], ['أربعين', 'arbi3iin'], ['خمسين', 'xamsiin'], ['ستين', 'sittiin'], ['سبعين', 'sab3iin'], ['تمانين', 'tamaniin'], ['تسعين', 'tis3iin']];
  const N100 = [null, ['مية', 'miyya'], ['ميتين', 'miteen'], ['تلتمية', 'tultumiyya'], ['ربعمية', 'rub3umiyya'], ['خمسمية', 'xumsumiyya'], ['ستمية', 'suttumiyya'], ['سبعمية', 'sub3umiyya'], ['تمنمية', 'tumnumiyya'], ['تسعمية', 'tus3umiyya']];
  const SHORT = { 3: ['تلات', 'talat'], 4: ['أربع', 'arba3'], 5: ['خمس', 'xamas'], 6: ['ست', 'sitt'], 7: ['سبع', 'saba3'], 8: ['تمن', 'taman'], 9: ['تسع', 'tisa3'], 10: ['عشر', '3ashar'] };
  function under100(n) {
    if (n < 20) return N1[n];
    const t = Math.floor(n / 10), o = n % 10;
    if (!o) return N10[t];
    return [N1[o][0] + ' و' + N10[t][0], N1[o][1] + ' w ' + N10[t][1]];
  }
  function under1000(n) {
    const h = Math.floor(n / 100), r = n % 100;
    const parts = [];
    if (h) parts.push(N100[h]);
    if (r || !h) parts.push(under100(r));
    return [parts.map((x) => x[0]).join(' و'), parts.map((x) => x[1]).join(' w ')];
  }
  function bigUnit(n, one, two, plural, plRo) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n <= 10) return [SHORT[n][0] + ' ' + plural, SHORT[n][1] + ' ' + plRo];
    const u = under1000(n); return [u[0] + ' ' + one[0], u[1] + ' ' + one[1]];
  }
  function number(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return { ar: N1[0][0], ro: N1[0][1] };
    const parts = [];
    const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), rest = n % 1000;
    if (mil) parts.push(bigUnit(mil, ['مليون', 'milyoon'], ['مليونين', 'milyoneen'], 'ملايين', 'malayiin'));
    if (th) parts.push(bigUnit(th, ['ألف', 'alf'], ['ألفين', 'alfeen'], 'تلاف', 't-alaaf'));
    if (rest) parts.push(under1000(rest));
    return { ar: parts.map((x) => x[0]).join(' و'), ro: parts.map((x) => x[1]).join(' w ') };
  }
  const ORD = [null, ['أول', 'awwil'], ['تاني', 'taani'], ['تالت', 'taalit'], ['رابع', 'raabi3'], ['خامس', 'xaamis'], ['سادس', 'saadis'], ['سابع', 'saabi3'], ['تامن', 'taamin'], ['تاسع', 'taasi3'], ['عاشر', '3aashir']];
  function ordinal(n) { const o = ORD[n]; return o ? { ar: o[0], ro: o[1] } : null; }
  const DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const easternDigits = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);

  /* -------------------------------- Keyboard -------------------------------- */
  const KBD = ['ا', 'أ', 'إ', 'آ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'ة', 'و', 'ي', 'ى', 'ء', 'ؤ', 'ئ', '؟'];
  const KBD_SPECIAL = 'حعخغقءصضطظ';

  window.KG = {
    hasAr, split, arOf, roOf, toCyr, toLat, autoRoman, learnRoman, romanFor, pron, ROMAN, norm, normAr, looseAr, romKey, check, speech, vocalize, alignWords, ttsText, egyWord, speechKey, speechChunks, hash, audioId,
    PERSONS, PRONOUN, PERSON_KY, POSS, possess, article, dual, SUN, VERBS, verbById, TENSES, conjugate, KAAN, HAYKUUN, agree,
    number, ordinal, easternDigits, KBD, KBD_SPECIAL
  };
})();
