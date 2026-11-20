/* ==========================================================================
   Learning layer (Busuu-style)
   Today dashboard · study plan & daily goal · placement test · smart review ·
   mistakes · my words · speaking practice · community writing corrections ·
   weekly league · level tests & certificates · tools hub
   ========================================================================== */
(window.KG_PLUGINS = window.KG_PLUGINS || []).push(function (A) {
  'use strict';
  const { store, $, $$, esc, rich, kgSpan, sayBtn, tl, toast, shuffle, full } = A;
  const KG = window.KG;
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];
  const cleanEn = (s) => String(s || '').replace(/\[\[(.+?)\]\]/g, (m, t) => KG.arOf(t)).replace(/<[^>]+>/g, '').trim();
  const signed = () => A.cloud && A.cloud.user;
  const page = (title, kgt, lede, crumbs) => `<header class="page-head"><div class="wrap">${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${esc(title)}</h1>${kgt ? `<div class="kgt" lang="ar" dir="rtl">${esc(kgt)}</div>` : ''}${lede ? `<p>${lede}</p>` : ''}</div></header>`;
  ['goals', 'placement', 'smart', 'mistakes', 'words', 'speak', 'community', 'post', 'league', 'tools', 'certificates', 'cert', 'certtest'].forEach((k) => {
    const g = { goals: 'course', placement: 'course', smart: 'review', mistakes: 'review', words: 'review', speak: 'review', community: 'community', post: 'community', league: 'community', tools: 'tools', certificates: 'tools', cert: 'tools', certtest: 'tools' }[k];
    if (!A.NAV_GROUPS[g].includes(k)) A.NAV_GROUPS[g].push(k);
  });
  const LOC = 'ky';
  const date = (t, o) => { try { return new Date(t).toLocaleDateString(LOC, o); } catch (e) { return new Date(t).toLocaleDateString('ru', o); } };

  /* ------------------------------ Shared data ----------------------------- */
  const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const goalXP = () => ((store.d.plan && store.d.plan.minutes) || 20) * 2;
  const todayXP = () => store.d.xp[store.today()] || 0;
  function week() {
    const out = [], now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); out.push({ d, k: dayKey(d), xp: store.d.xp[dayKey(d)] || 0, future: d > now }); }
    return out;
  }
  const WD = ['Дш', 'Шш', 'Шр', 'Бш', 'Жм', 'Иш', 'Жк'];
  function deck() {
    const now = Date.now(), all = A.allVocab().filter((v) => !v.k.includes('…'));
    const srs = store.d.srs || {};
    const due = all.filter((v) => srs[v.k] && srs[v.k].due <= now).sort((a, b) => srs[a.k].box - srs[b.k].box);
    const fresh = all.filter((v) => !srs[v.k] && (v.mine || A.isDone(v.lesson.id)));
    const strength = { weak: 0, medium: 0, strong: 0 };
    all.forEach((v) => { const s = srs[v.k]; if (!s) return; if (s.box <= 2) strength.weak++; else if (s.box <= 4) strength.medium++; else strength.strong++; });
    return { all, due, fresh, strength };
  }
  function grade(k, ok) {
    const s = store.d.srs[k] || { box: 0, due: 0 };
    if (ok) { s.box = Math.min(6, (s.box || 0) + 1); s.due = Date.now() + INTERVALS[s.box] * 864e5 - 36e5; }
    else { s.box = 1; s.due = Date.now() + 10 * 60e3; }
    s.t = Date.now(); store.d.srs[k] = s;
  }
  A.HOOKS.onQuizDone = (L, pct, wrong) => {
    const m = store.d.mistakes || (store.d.mistakes = []);
    (wrong || []).forEach((q) => { if (!m.some((x) => x.q === q.q)) m.unshift(Object.assign({ from: L.id }, q)); });
    store.d.mistakes = m.slice(0, 200); store.save();
  };

  /* ------------------------------- Dashboard ------------------------------ */
  A.HOOKS.dashboard = function () {
    const started = Object.keys(store.d.done).length || Object.keys(store.d.xp).length || signed();
    if (!started) return null;
    const nx = A.nextLesson(), dk = deck(), ws = A.wordStats ? A.wordStats() : { known: 0 };
    const g = goalXP(), t = todayXP(), pct = Math.min(1, t / g);
    const wk = week(), maxXP = Math.max(g, ...wk.map((d) => d.xp));
    const plan = store.d.plan, pl = planInfo();
    const name = signed() ? A.cloud.user.name : '';
    const R = 34, C = 2 * Math.PI * R;
    const html = `<section class="dash"><div class="wrap">
      <div class="dash-head"><div><h1>${name ? 'Ахлан, ' + esc(name) + '!' : 'Ахлан!'} <span lang="ar" style="font-family:var(--f-ar)">أهلاً</span></h1><p>${t >= g ? 'Күнүмдүк максат аткарылды. Мындан аркысы — бонус.' : `Бүгүнкү максатка ${g - t} XP калды.`}</p></div>
        ${A.cloud && A.cloud.available && !signed() ? '<a class="btn btn-ghost btn-sm" href="#account">Шайкештирүү үчүн кириңиз</a>' : ''}</div>
      <div class="dash-grid">
        <div class="dcard goal"><svg viewBox="0 0 80 80" width="96" height="96" aria-hidden="true"><circle cx="40" cy="40" r="${R}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="9"/><circle cx="40" cy="40" r="${R}" fill="none" stroke="#e9b949" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 40 40)"/></svg>
          <div><b>${t} / ${g} XP</b><span>бүгүн</span><b>🔥 ${store.d.streak.count || 0}</b><span>катар күн</span></div></div>
        <a class="dcard next" href="#lesson-${esc(nx.id)}"><span class="lab">Курсту улантуу</span><b>${esc(nx.num)} ${esc(nx.title)}</b><span class="kg" lang="ar">${esc(A.plain(nx.ar || ''))}</span><span class="go">Сабакты баштоо</span></a>
        <a class="dcard" href="#smart"><span class="lab">Акылдуу кайталоо</span><b>${dk.due.length} сөз кезекте</b><span>${dk.fresh.length} жаңы сөз күтүп турат · ${dk.strength.weak} алсыз</span><span class="go">Азыр кайталоо</span></a>
        <a class="dcard" href="#library"><span class="lab">Китепкана</span><b>${ws.known.toLocaleString()} белгилүү сөз</b><span>Бүгүн жаңы бир нерсе окуңуз</span><span class="go">Китепкананы ачуу</span></a>
      </div>
      <div class="dash-grid three">
        ${A.dropsPlan ? (() => { const q = A.dropsPlan(); return `<a class="dcard drops-card" href="#drops"><span class="lab">Сөз тамчылары</span><b>${q.due ? q.due + ' сөздү жаңылоо' : esc(q.t.icon) + ' ' + esc(q.t.name)}</b><span>${q.due ? 'Анан жаңы сүрөттүү сөздөр' : q.fresh + ' жаңы сүрөттүү сөз'}</span><span class="go">5 мүнөт ойноо</span></a>`; })() : ''}
        <div class="dcard light"><span class="lab">Ушул жума</span><div class="wbars">${wk.map((d, i) => `<div class="wb ${d.future ? 'fut' : ''} ${d.xp >= g ? 'met' : ''}"><i style="height:${Math.max(4, (d.xp / maxXP) * 100)}%"></i><span>${WD[i]}</span></div>`).join('')}</div>
          <span class="voice-note">Бул жумада максатка ${wk.filter((d) => d.xp >= g).length}/${(plan && plan.days) || 5} күн жеттиңиз</span></div>
        <div class="dcard light"><span class="lab">Сиздин план</span>${plan ? `<b>${esc(plan.level)} деңгээлине ${esc(pl.finish)} жетүү</b><div class="bar"><i style="width:${pl.pct}%"></i></div><span class="voice-note">${pl.total} сабактын ${pl.done} бүттү · күнүнө ${plan.minutes} мүн, жумасына ${plan.days} күн</span><a href="#goals">Планды өзгөртүү</a>`
          : `<b>Максат коюңуз</b><span class="voice-note">Деңгээлди жана канча убактыңыз бар экенин тандаңыз — жумаларды биз пландайбыз.</span><a class="btn btn-ink btn-sm" href="#goals">Максатымды коюу</a>`}
          ${!store.d.placement && Object.keys(store.d.done).length < 3 ? '<span class="voice-note" style="margin-top:8px">Арабча бир аз билесизби? <a href="#placement">Деңгээл тестин тапшырыңыз</a></span>' : ''}</div>
      </div>
      <div class="dash-extra"></div>
    </div></section>`;
    return { html, mount: async (main) => {
      if (!signed()) return;
      const box = $('.dash-extra', main);
      try {
        const [mine, lb] = await Promise.all([A.cloud.api('/api/community?a=mine'), A.cloud.api('/api/leaderboard')]);
        if (A.main() !== main) return;
        const meRow = lb.rows.find((r) => r.me);
        box.innerHTML = `<div class="dash-grid two">${mine.unread ? `<a class="dcard light" href="#community"><span class="lab">Коомчулук</span><b>${mine.unread} жаңы оңдоо</b><span>Кимдир бирөө жазганыңызды оңдоп берди</span><span class="go">Оңдоолорду көрүү</span></a>` : `<a class="dcard light" href="#community"><span class="lab">Коомчулук</span><b>Бүгүн бир нерсе жазыңыз</b><span>Башка үйрөнүүчүлөр жана арабтар оңдоп беришет</span><span class="go">Коомчулукту ачуу</span></a>`}
          <a class="dcard light" href="#league"><span class="lab">Апталык лига</span><b>${meRow ? '#' + meRow.rank + ' · ' + meRow.xp + ' XP' : 'Азырынча рейтингде жоксуз'}</b><span>${lb.rows.slice(0, 3).map((r) => esc(r.name) + ' ' + r.xp).join(' · ') || 'Бул жумада биринчи болуңуз'}</span><span class="go">Лиганы көрүү</span></a></div>`;
      } catch (e) { /* offline */ }
    } };
  };

  /* ------------------------------- Study plan ----------------------------- */
  const LEVEL_STAGE = { A1: 2, 'A1+': 3, A2: 4, B1: 5, B2: 6 };
  function planInfo() {
    const p = store.d.plan; if (!p) return {};
    const target = LEVEL_STAGE[p.level] || 6;
    const ls = A.LESSONS.filter((l) => l.stage.n <= target);
    const left = ls.filter((l) => !A.isDone(l.id));
    const mins = left.reduce((a, l) => a + (l.minutes || 30) * 1.8, 0); // lesson + practice + review
    const perWeek = p.minutes * p.days;
    const weeks = perWeek ? mins / perWeek : 0;
    const finish = new Date(Date.now() + weeks * 7 * 864e5);
    return { total: ls.length, done: ls.length - left.length, pct: Math.round(((ls.length - left.length) / ls.length) * 100), weeks: Math.ceil(weeks), finish: date(finish, { month: 'long', year: 'numeric' }) };
  }
  A.ROUTES.goals = function goals() {
    const main = A.main();
    const p = Object.assign({ level: 'A2', minutes: 20, days: 5 }, store.d.plan || {});
    main.innerHTML = page('Окуу планыңыз', 'هدفي', 'Максатты жана канча убактыңыз бар экенин тандаңыз. Күнүмдүк XP максаты жана бүтүрүү датасы берилет; ал окуган сайын жаңыланып турат.') + `<div class="narrow" style="padding:30px 0 80px"><div class="panel">
      <div class="field"><span class="lbl">Жетким келет</span><div class="seg" data-g="level">${Object.keys(LEVEL_STAGE).map((l) => `<button data-v="${l}" aria-pressed="${l === p.level}">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Күнүнө мүнөт</span><div class="seg" data-g="minutes">${[10, 20, 30, 45, 60].map((m) => `<button data-v="${m}" aria-pressed="${m === p.minutes}">${m} мүн</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Жумасына күн</span><div class="seg" data-g="days">${[3, 4, 5, 6, 7].map((d) => `<button data-v="${d}" aria-pressed="${d === p.days}">${d} күн</button>`).join('')}</div></div>
      <div class="plan-out"></div><div class="quiz-actions"><button class="btn btn-gold" data-save>Планымды сактоо</button></div></div>
      ${A.BLOCK.tip({ title: 'Деңгээлдер эмнени билдирет', html: '<b>A1</b>: арабча окуйсуз, өзүңүздү тааныштырасыз, соода кыласыз. <b>A2</b>: күнүңүз, өткөнүңүз жана пландарыңыз жөнүндө сүйлөйсүз. <b>B1</b>: окуяларды айтасыз, пикириңизди билдиресиз, жай сериалдарды түшүнөсүз. <b>B2</b>: кадимки сүйлөөнү жана жаңылыктарды түшүнөсүз. Убакыттар күн сайын бир аз кайталоо жана окуу менен эсептелген.' })}</div>`;
    const draw = () => {
      const keep = store.d.plan; store.d.plan = p; const pl = planInfo(); store.d.plan = keep;
      $('.plan-out', main).innerHTML = `<p style="font-size:1.1rem"><b>Күнүнө ${p.minutes} мүнөт, жумасына ${p.days} күн</b> окусаңыз, курстун ${esc(p.level)} бөлүгүн болжол менен <b>${esc(pl.finish)}</b> бүтүрөсүз (${pl.weeks} жума). Күнүмдүк максат: <b>${p.minutes * 2} XP</b>.</p><p class="voice-note">${pl.total} сабактын ${pl.done} мурунтан бүткөн.</p>`;
    };
    main.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g] [data-v]');
      if (b) { const g = b.parentElement.dataset.g; p[g] = g === 'level' ? b.dataset.v : Number(b.dataset.v); $$('button', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }
      if (e.target.closest('[data-save]')) { store.d.plan = Object.assign({ start: Date.now() }, p); store.save(); toast('План сакталды. Күнүмдүк максатыңыз — ' + p.minutes * 2 + ' XP.'); location.hash = '#home'; }
    });
    draw();
  };
  A.TITLES.goals = 'Окуу планы';

  /* ------------------------------ Placement ------------------------------- */
  A.ROUTES.placement = function placement() {
    const main = A.main();
    main.innerHTML = page('Деңгээл тести', 'تحديد المستوى', 'Болжол менен 5–10 мүнөт. Суроолор баскыч сайын кыйындайт; тест деңгээлиңизди тапканда токтойт. Таба албасаңыз, «Билбейм» деп жооп бериңиз — бул туура жооп.') + '<div class="narrow" style="padding:30px 0 80px"><div class="quiz pt"></div></div>';
    const box = $('.pt', main);
    const pools = {};
    A.COURSE.stages.filter((s) => s.n >= 1).forEach((s) => { pools[s.n] = shuffle(s.lessons.flatMap((l) => (l.quiz || []).filter((q) => q.t === 'mc'))).slice(0, 4); });
    let stage = 1, i = 0, right = 0, total = 0;
    const optHtml = (o) => (KG.hasAr(o) && !String(o).includes('[[') ? kgSpan(o) + ' ' + tl(o) : rich(o));
    const show = () => {
      const q = pools[stage][i];
      box.innerHTML = `<div class="quiz-top"><span class="count">${stage}-баскыч (6дан) · ${i + 1}-суроо (4төн)</span><div class="bar" style="flex:1;max-width:240px"><i style="width:${((stage - 1) * 4 + i) / 24 * 100}%"></i></div></div>
        <div class="q">${rich(q.q)}</div><div class="opts">${shuffle(q.o.map((o, k) => ({ o, k }))).map((x) => `<button class="opt" data-k="${x.k}">${optHtml(x.o)}</button>`).join('')}<button class="opt idk" data-k="-1">Билбейм</button></div>`;
    };
    const finish = (start) => {
      store.d.placement = { stage: start, date: Date.now() }; store.save();
      const st = A.COURSE.stages.find((s) => s.n === start) || A.COURSE.stages[1];
      box.innerHTML = `<div style="text-align:center"><div class="score-big">${start}-баскыч</div><p style="font-size:1.1rem"><b>${esc(st.title)}</b> (${esc(st.level)}) баскычынан баштаңыз. Сиз ${total} суроонун ${right} туура жооп бердиңиз.</p>
        ${start > 1 ? `<p class="voice-note">Мурунку ${A.LESSONS.filter((l) => l.stage.n < start && l.stage.n > 0).length} сабакты бүттү деп белгилесек болот, ошондо алардын сөздөрү кайталоого кошулат.</p><div class="quiz-actions" style="justify-content:center"><button class="btn btn-gold" data-skip="${start}">Мурунку баскычтарды белгилеп, баштоо</button><a class="btn btn-line" href="#lesson-${esc(st.lessons[0].id)}">Ошол жерден эле баштоо</a></div>` : `<div class="quiz-actions" style="justify-content:center"><a class="btn btn-gold" href="#lesson-${esc(A.LESSONS[0].id)}">Башынан баштоо</a></div>`}</div>`;
    };
    box.addEventListener('click', (e) => {
      const sk = e.target.closest('[data-skip]');
      if (sk) { const n = Number(sk.dataset.skip); A.LESSONS.forEach((l) => { if (l.stage.n < n) store.d.done[l.id] = Math.max(store.d.done[l.id] || 0, 0.8); }); store.save(); location.hash = '#lesson-' + A.COURSE.stages.find((s) => s.n === n).lessons[0].id; return; }
      const o = e.target.closest('.opt'); if (!o || o.disabled) return;
      total++; if (o.dataset.k === '0') right++;
      $$('.opt', box).forEach((b) => { b.disabled = true; if (b.dataset.k === '0') b.classList.add('right'); });
      if (o.dataset.k !== '0') o.classList.add('wrong');
      setTimeout(() => {
        i++;
        if (i < 4) return show();
        const stageRight = right - (pools.__prev || 0); pools.__prev = right;
        if (stageRight >= 3 && stage < 6) { stage++; i = 0; return show(); }
        finish(stageRight >= 3 ? 6 : stage);
      }, 700);
    });
    show();
  };
  A.TITLES.placement = 'Деңгээл тести';
  A.HOOKS.courseTop = () => `<div class="course-top">${!store.d.placement && Object.keys(store.d.done).length < 3 ? '<a class="ct" href="#placement"><b>Арабча бир аз билесизби?</b><span>5 мүнөттүк деңгээл тестин тапшырыңыз</span></a>' : ''}<a class="ct" href="#goals"><b>${store.d.plan ? 'Максатыңыз: ' + esc(store.d.plan.level) : 'Максат коюңуз'}</b><span>${store.d.plan ? 'Болжолдуу бүтүрүү: ' + esc(planInfo().finish) : 'Күнүмдүк максат жана бүтүрүү датасы'}</span></a><a class="ct" href="#certificates"><b>Деңгээл тесттери</b><span>A1, A2, B1 жана B2 сертификаттары</span></a></div>`;

  /* --------------------------------- Review ------------------------------- */
  A.ROUTES.review = function review() {
    const main = A.main(), dk = deck(), m = (store.d.mistakes || []).length;
    main.innerHTML = page('Кайталоо', 'مراجعة', 'Аз-аздан, бирок көп жолу — узак жана сейрек окуудан пайдалуу. Сөздөр унутаар алдында кайра келет.') + `<div class="wrap" style="padding:30px 0 80px">
      <div class="lib-stats"><div><b>${dk.due.length}</b>азыр кезекте</div><div><b>${dk.strength.weak}</b>алсыз сөз</div><div><b>${dk.strength.medium}</b>орто</div><div><b>${dk.strength.strong}</b>бекем</div><div><b>${m}</b>оңдой турган ката</div></div>
      <div class="tools" style="margin-top:22px">
        <a class="tool big" href="#smart"><span class="glyph">↻</span><h3>Акылдуу кайталоо</h3><p>${dk.due.length || dk.fresh.length ? `Болжол менен 5 мүнөт. Кезектеги ${dk.due.length} сөз, анан сабактардан жана китепканадан жаңылары.` : dk.strength.weak + dk.strength.medium + dk.strength.strong ? 'Баары кайталанды. Сөздөрүңүз убагы келгенде ушул жерге кайтып келет.' : 'Сабакты бүтүрүңүз, сөз тамчысын ойноңуз же китепканадан сөз белгилеңиз — ошондо кайталоо толот.'}</p></a>
        <a class="tool tool-drops" href="#drops"><span class="glyph">💧</span><h3>Сөз тамчылары</h3><p>Беш мүнөттүк сүрөттүү сеанстар. ${A.dropsPlan ? (A.dropsPlan().due ? A.dropsPlan().due + ' сөздү жаңылоо керек.' : 'Кийинки тема: ' + esc(A.dropsPlan().t.name) + '.') : ''}</p></a>
        <a class="tool" href="#mistakes"><span class="glyph">✗→✓</span><h3>Каталарымды оңдоо</h3><p>${m ? 'Сабактарда туура эмес жооп берген ' + m + ' суроо.' : 'Азырынча эч нерсе жок — сабак тесттериндеги каталар ушул жерге түшөт.'}</p></a>
        <a class="tool" href="#cards"><span class="glyph">▭</span><h3>Карточкалар</h3><p>Классикалык карточкалар: Кайра / Кыйын / Жакшы / Оңой.</p></a>
        <a class="tool" href="#speak"><span class="glyph">🎙</span><h3>Сүйлөө машыгуусу</h3><p>Угуңуз, өзүңүздү жаздырыңыз, салыштырыңыз.</p></a>
        <a class="tool" href="#words"><span class="glyph" lang="ar">أ</span><h3>Менин сөздөрүм</h3><p>Кездештирген ар бир сөз жана анын бекемдиги.</p></a>
      </div></div>`;
  };
  A.TITLES.review = 'Кайталоо';

  function sessionQs(items) {
    const pool = deck().all;
    const opts = (v) => shuffle([v].concat(shuffle(pool.filter((x) => x.k !== v.k && cleanEn(x.en) !== cleanEn(v.en))).slice(0, 3)));
    return items.map((v) => {
      const typable = !/[\/…()]/.test(v.k) && v.k.split(/\s+/).length <= 3;
      const en = cleanEn(v.en), types = ['mean', 'rev'].concat(typable ? ['type'] : [], KG.speech.available() ? ['listen'] : []);
      const t = types[Math.floor(Math.random() * types.length)];
      if (t === 'mean') { const o = opts(v); return { t: 'mc', q: `[[${full(v)}]] эмнени билдирет?`, say: v.k, o: [en].concat(o.filter((x) => x !== v).map((x) => cleanEn(x.en))), why: v.ctx ? 'Кездешкен жери: [[' + v.ctx + ']]' : '', _k: v.k }; }
      if (t === 'rev') { const o = opts(v); return { t: 'mc', q: `Кайсы сөз «${esc(en)}» дегенди билдирет?`, o: [`[[${full(v)}]]`].concat(o.filter((x) => x !== v).map((x) => `[[${full(x)}]]`)), _k: v.k }; }
      if (t === 'listen') { const o = opts(v); return { t: 'mc', q: 'Угуп, уккан сөзүңүздү тандаңыз.', say: v.k, o: [`[[${v.k}]]`].concat(o.filter((x) => x !== v).map((x) => `[[${x.k}]]`)), why: `[[${full(v)}]] — ${esc(en)}`, _k: v.k }; }
      return { t: 'type', q: `Арабча жазыңыз: «${esc(en)}»`, a: [full(v).replace(/[.!?؟]$/, '')], _k: v.k };
    });
  }
  A.ROUTES.smart = function smart() {
    const main = A.main(), dk = deck();
    let items = dk.due.slice(0, 10).concat(shuffle(dk.fresh).slice(0, Math.max(0, 12 - Math.min(10, dk.due.length))));
    if (items.length < 4) items = items.concat(shuffle(dk.all.filter((v) => v.lesson.stage && v.lesson.stage.n === 2)).slice(0, 8 - items.length));
    main.innerHTML = page('Акылдуу кайталоо', '', `${items.length} сөз · жазыңыз, тандаңыз жана угуңуз. Туура жооп сөздү келечекке түртөт.`, '<a href="#review">Кайталоо</a>') + '<div class="narrow" style="padding:30px 0 80px"><div class="quiz"></div></div>';
    const cb = () => { store.save(); };
    cb.onAnswer = (q, ok) => { grade(q._k, ok); if (ok) store.addXP(2, 'review'); else store.save(); };
    cb.passText = 'Сеанс бүттү. Кийинки кайталоодо көрүшөбүз!'; cb.failText = 'Сеанс бүттү. Кыйын сөздөр жакында кайра келет.';
    A.mountQuiz($('.quiz', main), sessionQs(shuffle(items)), cb);
  };
  A.TITLES.smart = 'Акылдуу кайталоо';

  A.ROUTES.mistakes = function mistakes() {
    const main = A.main(), list = (store.d.mistakes || []).slice(0, 15);
    main.innerHTML = page('Каталарымды оңдоо', '', 'Сабак тесттеринде туура эмес жооп берген суроолоруңуз. Туура жооп берсеңиз, суроо тизмеден чыгат.', '<a href="#review">Кайталоо</a>') + `<div class="narrow" style="padding:30px 0 80px">${list.length ? '<div class="quiz"></div>' : '<div class="empty panel"><p>Сакталган ката жок. Сабактын тестин тапшырып, кайра келиңиз.</p><a class="btn btn-ink btn-sm" href="#course">Курска өтүү</a></div>'}</div>`;
    if (!list.length) return;
    const cb = () => {}; cb.onAnswer = (q, ok) => { if (ok) { store.d.mistakes = store.d.mistakes.filter((x) => x.q !== q.q); store.addXP(3, 'mistakes'); } };
    cb.passText = 'Азамат — ал каталар оңдолду.'; cb.failText = 'Кээ бирлери дагы эле кыйын. Туура жооп бермейинче ушул жерде калат.';
    A.mountQuiz($('.quiz', main), list, cb);
  };
  A.TITLES.mistakes = 'Каталарымды оңдоо';

  A.ROUTES.words = function words() {
    const main = A.main(), srs = store.d.srs || {};
    const all = deck().all.filter((v) => srs[v.k] || v.mine);
    let filter = 'all', q = '';
    main.innerHTML = page('Менин сөздөрүм', 'كلماتي', `Сиз машыккан же сактаган ${all.length} сөз. Алсыз сөздөр кайталоодо эң көп чыгат.`, '<a href="#review">Кайталоо</a>') + `<div class="wrap" style="padding:30px 0 80px"><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
      <div class="seg" data-f>${[['all', 'Баары'], ['weak', 'Алсыз'], ['medium', 'Орто'], ['strong', 'Бекем'], ['mine', 'Окуганымдан']].map((x, i) => `<button data-v="${x[0]}" aria-pressed="${i === 0}">${x[1]}</button>`).join('')}</div>
      <input class="search" type="search" dir="auto" placeholder="Сөз издөө" aria-label="Сөз издөө"></div><ul class="vocab wordlist" style="margin-top:16px"></ul></div>`;
    const draw = () => {
      const rows = all.filter((v) => {
        const b = srs[v.k] ? srs[v.k].box : 0;
        if (filter === 'weak' && !(b <= 2)) return false; if (filter === 'medium' && !(b >= 3 && b <= 4)) return false; if (filter === 'strong' && !(b >= 5)) return false; if (filter === 'mine' && !v.mine) return false;
        return !q || KG.normAr(v.k).includes(KG.normAr(q)) || cleanEn(v.en).toLowerCase().includes(q) || (v.ro && KG.romKey(v.ro).includes(KG.romKey(q)));
      }).slice(0, 400);
      $('.wordlist', main).innerHTML = rows.length ? rows.map((v) => { const b = srs[v.k] ? srs[v.k].box : 0; return `<li>${sayBtn(v.k)}<div>${kgSpan(full(v))}<br>${tl(full(v))}</div><div class="en">${esc(cleanEn(v.en))}<span class="strength s${b <= 2 ? 1 : b <= 4 ? 2 : 3}" title="${b}-куту"><i></i><i></i><i></i></span></div></li>`; }).join('') : '<li class="empty" style="display:block">Бул жерде азырынча сөз жок.</li>';
    };
    main.addEventListener('click', (e) => { const b = e.target.closest('[data-f] [data-v]'); if (b) { filter = b.dataset.v; $$('[data-f] button', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); } });
    $('.search', main).addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  };
  A.TITLES.words = 'Менин сөздөрүм';

  /* -------------------------------- Speaking ------------------------------ */
  function speakItems() {
    const out = [];
    const done = A.LESSONS.filter((l) => A.isDone(l.id));
    (done.length ? done : A.LESSONS.filter((l) => l.stage.n === 2)).forEach((l) => (l.blocks || []).forEach((b) => {
      if (b.t === 'dialog') b.lines.forEach((ln) => out.push([ln[1].replace(/\|/g, ''), cleanEn(ln[2])]));
      if (b.t === 'compare') out.push([b.ar.replace(/\|/g, ''), cleanEn(b.ky)]);
    }));
    return shuffle(out.filter((x) => KG.arOf(x[0]).length < 70));
  }
  A.ROUTES.speak = function speak() {
    const main = A.main(), items = speakItems();
    let i = 0, rec = null, chunks = [], url = null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    main.innerHTML = page('Сүйлөө машыгуусу', 'كلام', 'Угуңуз, үн чыгарып айтыңыз, өзүңүздү жаздырып, салыштырыңыз. Күн сайын сүйлөө — жалгыз болсо да — оозуңузду жана кулагыңызды машыктырат.', '<a href="#review">Кайталоо</a>') + '<div class="narrow" style="padding:30px 0 80px"><div class="card speak-card" style="margin:auto"></div></div>';
    const card = $('.speak-card', main);
    const draw = (msg) => {
      const it = items[i % items.length];
      card.innerHTML = `<p class="from">${i % items.length + 1}-сүйлөм, жалпы ${items.length}</p><div class="front" lang="ar" dir="rtl" style="font-size:clamp(1.6rem,4.5vw,2.3rem)">${esc(KG.arOf(it[0]))}</div>${tl(it[0])}<p>${esc(it[1])}</p>
        <div class="grade"><button class="btn btn-line" data-sp="listen">${A.ICON_SAY.replace('<svg', '<svg width="16" height="16"')} Угуу</button><button class="btn btn-line" data-sp="slow">Жай</button>
        <button class="btn ${rec ? 'btn-gold' : 'btn-ink'}" data-sp="rec">${rec ? '■ Токтотуу' : '● Жаздыруу'}</button>${url ? '<button class="btn btn-line" data-sp="play">▶ Менин жазуум</button>' : ''}${SR ? '<button class="btn btn-line" data-sp="check">Айтылышымды текшерүү</button>' : ''}</div>
        <div class="sp-msg">${msg || ''}</div><div class="grade"><button class="btn btn-gold" data-sp="next">Кийинки сүйлөм</button></div>`;
    };
    card.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sp]'); if (!b) return;
      const it = items[i % items.length];
      if (b.dataset.sp === 'listen') A.say(it[0]);
      if (b.dataset.sp === 'slow') KG.speech.say(it[0], 0.6);
      if (b.dataset.sp === 'next') { i++; url = null; store.addXP(2, 'speaking'); draw(); }
      if (b.dataset.sp === 'play' && url) new Audio(url).play();
      if (b.dataset.sp === 'rec') {
        if (rec) { rec.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          rec = new MediaRecorder(stream); chunks = [];
          rec.ondataavailable = (ev) => chunks.push(ev.data);
          rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })); rec = null; draw('Жазылды. Угуп, үлгү менен салыштырыңыз.'); };
          rec.start(); draw('Жазылып жатат… сүйлөмдү айтып, анан «Токтотууну» басыңыз.');
          setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 12000);
        } catch (err) { draw('Микрофон жеткиликсиз. Браузерде микрофонго уруксат бериңиз же жөн гана үн чыгарып машыгыңыз.'); }
      }
      if (b.dataset.sp === 'check') {
        try {
          const r = new SR(); r.lang = 'ar-EG'; r.maxAlternatives = 3; r.interimResults = false;
          draw('Угуп жатам… азыр сүйлөмдү айтыңыз.');
          r.onresult = (ev) => {
            const heard = Array.from(ev.results[0]).map((x) => x.transcript);
            const results = heard.map((h) => KG.check(h, [it[0]]));
            const res = results.includes('right') ? 'right' : results.includes('almost') ? 'almost' : 'wrong';
            draw(`Мен уктум: <b class="kg" lang="ar" dir="rtl">${esc(heard[0])}</b><br>${res === 'right' ? '✓ Сонун — дал келди!' : res === 'almost' ? '≈ Абдан жакын. Тамак тыбыштарын (ع ح) жана оор тамгаларды текшериңиз.' : 'Туура эмес. Дагы бир угуп, кайра аракет кылыңыз.'}`);
            if (res !== 'wrong') store.addXP(3, 'speaking');
          };
          r.onerror = (ev) => draw(ev.error === 'language-not-supported' ? 'Бул браузер арабча сүйлөөнү тааный албайт. Жаздырып, кулак менен салыштырыңыз.' : 'Угулган жок (' + esc(ev.error) + '). Микрофонду текшерип, кайра аракет кылыңыз.');
          r.start();
        } catch (err) { draw('Бул браузерде сүйлөөнү таануу жок.'); }
      }
    });
    if (!items.length) { card.innerHTML = '<p>Азырынча сүйлөм жок.</p>'; return; }
    draw();
  };
  A.TITLES.speak = 'Сүйлөө машыгуусу';

  /* -------------------------------- Community ----------------------------- */
  const PROMPTS = [
    ['intro', 'A1', 'Өзүңүздү тааныштырыңыз', '3–5 сүйлөм жазыңыз: атыңыз, кайдансыз, эмне иш кыласыз.', 'اسمي … · أنا من … · أنا …', 'hello'],
    ['family', 'A1', 'Менин үй-бүлөм', 'Үй-бүлөңүздө кимдер бар? «عندي» жана ээлик мүчөлөрдү колдонуңуз.', 'عندي … · اسمه … · اسمها …', 'have'],
    ['food', 'A1', 'Тамак-аш', 'Адатта эмне жейсиз жана ичесиз? Эмнени жебейсиз?', 'باكل … · بشرب … · ما باكلش …', 'dont'],
    ['yesterday', 'A2', 'Кечээ', 'Кечээ эртең мененден кечке чейин эмне кылдыңыз?', 'الصبح … · وبعدين … · بالليل …', 'past'],
    ['home', 'A2', 'Менин бөлмөм', 'Бөлмөңүздү сүрөттөңүз: эмне эмненин үстүндө, астында, жанында?', 'فيه … · على … · جنب … · تحت …', 'positions'],
    ['weekend', 'A2', 'Дем алыш пландары', 'Дем алышта эмне кылгыңыз келет? Эмне кыла албайсыз?', 'عايز … · مش هقدر … · لازم …', 'want-can-must'],
    ['bazaar', 'A2', 'Базарда', 'Кыска диалог жазыңыз: бир нерсе сатып алуу жана соодалашуу.', 'بكام ده؟ · غالي أوي! · ماشي', 'real-life'],
    ['city', 'B1', 'Менин шаарым', 'Шаарыңызды «… турган жер» сыяктуу сүйлөмдөр менен сүрөттөңүз.', 'المدينة اللي … · الناس اللي …', 'relative'],
    ['memory', 'B1', 'Балалык эскерүү', 'Кыска эскерүү жазыңыз: эмне кылчу элеңиз, качан эмне болду…', 'لما كنت صغير … · كنت ب…', 'when-because'],
    ['advice', 'B1', 'Жаңы үйрөнүүчүгө кеңеш', 'Баштоочуга үч кеңеш бериңиз. «Эгер» жана «керек» колдонуңуз.', 'لو … · لازم … · في رأيي …', 'if'],
    ['travel', 'B1', 'Египетке саякат', 'Египетте кайда баргыңыз келет жана эмне үчүн?', 'نفسي أروح … عشان … · قالوا إن …', 'said-that'],
    ['opinion', 'B2', 'Шаарбы же айылбы?', 'Кайда жашоо жакшы? Эки тараптын далилдерин жана өз пикириңизди жазыңыз.', 'من ناحية … ومن ناحية تانية … · في رأيي', 'complex'],
    ['phones', 'B2', 'Балдар жана телефон', 'Балдарга смартфон берүү керекпи? Пикириңизди далилдеңиз.', 'مع إن … · عشان كده … · أنا شايف إن …', 'natural-speech'],
    ['proverb', 'B2', 'Макалды түшүндүрүңүз', 'Египет макалын тандап, анын мааниси эмне экенин жазыңыз.', 'المثل ده معناه إن …', 'proverbs']
  ];
  const promptOf = (id) => PROMPTS.find((p) => p[0] === id);
  const when = (t) => { const s = (Date.now() - t) / 1000; return s < 3600 ? Math.max(1, Math.round(s / 60)) + ' мүн мурун' : s < 86400 ? Math.round(s / 3600) + ' саат мурун' : date(t); };
  const who = (p) => `<span class="who-name">${esc(p.name)}</span>${p.native ? ' <span class="pill ok">Эне тили араб</span>' : ''}`;
  function diff(a, b) {
    const x = a.split(/(\s+)/).filter(Boolean), y = b.split(/(\s+)/).filter(Boolean);
    if (x.length * y.length > 250000) return esc(b);
    const m = x.length, n = y.length, L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0, out = '';
    while (i < m && j < n) { if (x[i] === y[j]) { out += esc(x[i]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { out += /\S/.test(x[i]) ? `<del>${esc(x[i])}</del>` : esc(x[i]); i++; } else { out += /\S/.test(y[j]) ? `<ins>${esc(y[j])}</ins>` : esc(y[j]); j++; } }
    while (i < m) { out += /\S/.test(x[i]) ? `<del>${esc(x[i])}</del>` : ''; i++; }
    while (j < n) { out += /\S/.test(y[j]) ? `<ins>${esc(y[j])}</ins>` : esc(y[j]); j++; }
    return out;
  }
  function needServer(main, what) {
    if (A.cloud && A.cloud.available === false) { main.innerHTML += `<div class="narrow" style="padding:30px 0 80px">${A.BLOCK.tip({ title: 'Онлайн тиркеме керек', html: what + ' тиркеме өз серверинде иштегенде (мисалы, Vercel’де маалымат базасы туташтырылганда) иштейт. Бул нуска офлайн же алдын ала көрүү режиминде.' })}</div>`; return true; }
    return false;
  }
  A.ROUTES.community = async function community() {
    const main = A.main();
    main.innerHTML = page('Коомчулук', 'المجتمع', 'Кыска тексттерди жазыңыз — аларды башка үйрөнүүчүлөр жана эне тили араб тили болгондор оңдоп беришет. Башкалардыкын оңдосоңуз, эки эсе тез үйрөнөсүз.');
    if (needServer(main, 'Коомчулук')) return;
    main.insertAdjacentHTML('beforeend', `<div class="wrap" style="padding:26px 0 80px"><div class="seg" role="tablist"><button data-ct="write" aria-pressed="true">Жазуу</button><button data-ct="feed" aria-pressed="false">Башкаларга жардам</button><button data-ct="mine" aria-pressed="false">Менин посттарым <span class="unread"></span></button><a class="btn btn-line btn-sm" href="#league" style="margin-left:auto">Апталык лига</a></div><div class="ctab" style="margin-top:22px"></div></div>`);
    const tab = $('.ctab', main);
    const tabs = {
      write() {
        tab.innerHTML = `<div class="prompts">${['A1', 'A2', 'B1', 'B2'].map((lv) => `<h3>${lv}</h3><div class="prompt-grid">${PROMPTS.filter((p) => p[1] === lv).map((p) => `<button class="prompt" data-p="${p[0]}"><b>${esc(p[2])}</b><span>${esc(p[3])}</span></button>`).join('')}</div>`).join('')}</div>`;
      },
      async feed() {
        tab.innerHTML = '<p class="voice-note">Жүктөлүүдө…</p>';
        try {
          const { posts } = await A.cloud.api('/api/community?a=feed');
          tab.innerHTML = posts.length ? `<div class="posts">${posts.map((p) => { const pr = promptOf(p.prompt); return `<a class="post-card" href="#post-${esc(p.id)}"><div class="pc-top">${who(p)} <span class="lvl">${esc(p.level)}</span><span class="voice-note">${when(p.created)}</span></div><b>${esc(pr ? pr[2] : 'Эркин жазуу')}</b><p class="kg" dir="auto">${esc(p.text.slice(0, 220))}${p.text.length > 220 ? '…' : ''}</p><span class="voice-note">${p.nc ? p.nc + ' оңдоо' : 'Азырынча оңдоо жок — биринчи болуңуз'}${p.mine ? ' · сиздин пост' : ''}</span></a>`; }).join('')}</div>` : '<div class="empty panel"><p>Азырынча пост жок. Биринчи болуп бир нерсе жазыңыз!</p></div>';
        } catch (e) { tab.innerHTML = `<p class="form-msg">${esc(e.message)}</p>`; }
      },
      async mine() {
        if (!signed()) { tab.innerHTML = '<div class="empty panel"><p>Посттарыңызды жана оңдоолорду көрүү үчүн кириңиз.</p><a class="btn btn-ink btn-sm" href="#account">Кирүү</a></div>'; return; }
        tab.innerHTML = '<p class="voice-note">Жүктөлүүдө…</p>';
        try {
          const { posts } = await A.cloud.api('/api/community?a=mine');
          A.cloud.api('/api/community?a=seen', { method: 'POST' }).catch(() => {}); $('.unread', main).textContent = '';
          tab.innerHTML = posts.length ? `<div class="posts">${posts.map((p) => `<a class="post-card" href="#post-${esc(p.id)}"><div class="pc-top"><span class="lvl">${esc(p.level)}</span><span class="voice-note">${when(p.created)}</span></div><p class="kg" dir="auto">${esc(p.text.slice(0, 220))}</p><b>${p.nc} оңдоо</b></a>`).join('')}</div>` : '<div class="empty panel"><p>Сиз азырынча эч нерсе жарыялаган жоксуз. «Жазуу» бөлүмүнөн тема тандаңыз.</p></div>';
        } catch (e) { tab.innerHTML = `<p class="form-msg">${esc(e.message)}</p>`; }
      }
    };
    main.addEventListener('click', (e) => {
      const t = e.target.closest('[data-ct]'); if (t) { $$('[data-ct]', main).forEach((x) => x.setAttribute('aria-pressed', String(x === t))); tabs[t.dataset.ct](); return; }
      const p = e.target.closest('[data-p]'); if (p) writeForm(promptOf(p.dataset.p));
    });
    function writeForm(p) {
      tab.innerHTML = `<div class="narrow" style="margin:0"><button class="linkish" data-ct="write">← Бардык темалар</button><h2 style="margin-top:12px">${esc(p[2])} <span class="lvl">${esc(p[1])}</span></h2><p>${esc(p[3])}</p>
        <p class="voice-note">Пайдалуу калыптар: <span class="kg" lang="ar" dir="rtl">${esc(p[4])}</span> · <a href="#lesson-${esc(p[5])}">Сабакты кайталоо</a></p>
        <textarea class="type-in write-ta" dir="rtl" lang="ar" rows="7" maxlength="2000" placeholder="اكتب هنا… (арабча жазыңыз)"></textarea>${A.keyboard()}
        <div class="form-msg" role="alert"></div><div class="quiz-actions"><button class="btn btn-gold" data-post>Оңдоого жарыялоо</button></div>
        ${signed() ? '' : '<p class="voice-note">Жарыялоо үчүн <a href="#account">кириңиз</a>.</p>'}</div>`;
      const ta = $('.write-ta', tab);
      tab.addEventListener('click', async (ev) => {
        const k = ev.target.closest('[data-key]'); if (k) { const v = k.dataset.key; ta.value = v === '⌫' ? ta.value.slice(0, -1) : ta.value + v; ta.focus(); return; }
        if (!ev.target.closest('[data-post]')) return;
        try {
          if (!signed()) throw new Error('Адегенде кириңиз — андан кийин жарыялай аласыз.');
          const { post } = await A.cloud.api('/api/community?a=post', { method: 'POST', body: { prompt: p[0], level: p[1], text: ta.value } });
          store.addXP(10, 'writing'); toast('Жарыяланды! Оңдоолорду «Менин посттарым» бөлүмүнөн көрөсүз.'); location.hash = '#post-' + post.id;
        } catch (err) { $('.form-msg', tab).textContent = err.message; }
      });
    }
    tabs.write();
    if (signed()) A.cloud.api('/api/community?a=mine').then((r) => { if (r.unread) $('.unread', main).textContent = '(' + r.unread + ' жаңы)'; }).catch(() => {});
  };
  A.TITLES.community = 'Коомчулук';

  A.PREFIXES.push(['post-', async (id) => {
    const main = A.main();
    main.innerHTML = page('Жазуу', '', '', '<a href="#community">Коомчулук</a>');
    if (needServer(main, 'Коомчулук')) return;
    main.insertAdjacentHTML('beforeend', '<div class="narrow post-body" style="padding:26px 0 80px"><p class="voice-note">Жүктөлүүдө…</p></div>');
    const box = $('.post-body', main);
    try {
      const { post, corrections } = await A.cloud.api('/api/community?a=post&id=' + encodeURIComponent(id));
      const pr = promptOf(post.prompt);
      box.innerHTML = `<div class="panel"><div class="pc-top">${who(post)} <span class="lvl">${esc(post.level)}</span><span class="voice-note">${when(post.created)}</span></div><h3>${esc(pr ? pr[2] : 'Эркин жазуу')}</h3>${pr ? `<p class="voice-note">${esc(pr[3])}</p>` : ''}<p class="kg post-text" dir="auto">${esc(post.text).replace(/\n/g, '<br>')}</p>
        <div class="quiz-actions">${sayBtn(post.text)}${post.mine ? '<button class="btn btn-line btn-sm" data-pa="delete">Постту өчүрүү</button>' : '<button class="linkish" data-pa="report">Даттануу</button>'}</div></div>
        <h2 style="margin-top:28px">${corrections.length} оңдоо</h2>
        ${corrections.map((c) => `<div class="panel corr"><div class="pc-top">${who(c)}<span class="voice-note">${when(c.created)}</span>${c.helpful ? '<span class="pill ok">Пайдалуу</span>' : ''}</div>${c.text && c.text !== post.text ? `<p class="kg diff" dir="auto">${diff(post.text, c.text).replace(/\n/g, '<br>')}</p>` : c.text ? '<p class="voice-note">Өзгөртүү жок — баары туура окшойт!</p>' : ''}${c.comment ? `<p dir="auto">${esc(c.comment)}</p>` : ''}${post.mine && !c.helpful ? `<button class="btn btn-line btn-sm" data-pa="helpful" data-c="${esc(c.id)}">Пайдалуу деп белгилөө</button>` : ''}</div>`).join('')}
        ${post.mine ? '' : `<div class="panel"><h3>Бул текстти оңдоо</h3><p class="voice-note">Текстти түздөн-түз өзгөртүңүз — өзгөртүүлөрүңүз автор үчүн белгиленип көрсөтүлөт. Сылык болуңуз жана кыйын жерлерин түшүндүрүңүз.</p>
          <textarea class="type-in corr-ta" dir="rtl" lang="ar" rows="6" maxlength="2000">${esc(post.text)}</textarea>
          <label class="lbl" for="corr-cm" style="margin-top:12px">Комментарий (милдеттүү эмес)</label><textarea id="corr-cm" class="corr-cm" rows="2" maxlength="600" placeholder="Мисалы: «бинт» аял тектүү, ошондуктан сын атооч -а менен бүтөт: بنت حلوة."></textarea>
          <div class="form-msg" role="alert"></div><div class="quiz-actions"><button class="btn btn-gold" data-pa="correct">Оңдоону жөнөтүү</button></div>${signed() ? '' : '<p class="voice-note">Оңдоо жөнөтүү үчүн <a href="#account">кириңиз</a>.</p>'}</div>`}`;
      box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pa]'); if (!b) return;
        try {
          if (b.dataset.pa === 'correct') { await A.cloud.api('/api/community?a=correct', { method: 'POST', body: { id: post.id, text: $('.corr-ta', box).value, comment: $('.corr-cm', box).value } }); store.addXP(5, 'correcting'); toast('Рахмат! Оңдооңуз жөнөтүлдү.'); A.route(); }
          if (b.dataset.pa === 'helpful') { await A.cloud.api('/api/community?a=helpful', { method: 'POST', body: { id: post.id, cid: b.dataset.c } }); A.route(); }
          if (b.dataset.pa === 'report') { await A.cloud.api('/api/community?a=report', { method: 'POST', body: { id: post.id } }); toast('Даттануу кабыл алынды. Коомчулукту достук маанайда сактаганыңыз үчүн рахмат.'); }
          if (b.dataset.pa === 'delete') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Өчүрүү үчүн дагы бир басыңыз'; return; } await A.cloud.api('/api/community?a=delete', { method: 'POST', body: { id: post.id } }); location.hash = '#community'; }
        } catch (err) { const m = $('.form-msg', box); if (m) m.textContent = err.message; else toast(err.message); }
      });
    } catch (e) { box.innerHTML = `<p class="form-msg">${esc(e.message)}</p>`; }
  }]);

  A.ROUTES.league = async function league() {
    const main = A.main();
    main.innerHTML = page('Апталык лига', 'دوري الأسبوع', 'Ушул жумада XP тапкандардын баары, рейтинг боюнча. Ар дүйшөмбү сайын жаңыдан башталат. Аккаунт жөндөөлөрүнөн өзүңүздү жашырсаңыз болот.', '<a href="#community">Коомчулук</a>');
    if (needServer(main, 'Лига')) return;
    main.insertAdjacentHTML('beforeend', '<div class="narrow" style="padding:26px 0 80px"><div class="lb">Жүктөлүүдө…</div></div>');
    try {
      const { rows, week } = await A.cloud.api('/api/leaderboard');
      $('.lb', main).innerHTML = rows.length ? `<p class="voice-note">Жума ${esc(week)}</p><div class="tbl-wrap"><table><thead><tr><th>#</th><th>Үйрөнүүчү</th><th>XP</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td>${r.rank}</td><td>${esc(r.name)}${r.me ? ' (сиз)' : ''}</td><td>${r.xp}</td></tr>`).join('')}</tbody></table></div>${signed() ? '' : '<p class="voice-note">Лигага кошулуу үчүн <a href="#account">кириңиз</a>.</p>'}` : '<div class="empty panel"><p>Бул жумада азырынча эч ким XP тапкан жок. Сабак өтүп, биринчи орунду алыңыз!</p></div>';
    } catch (e) { $('.lb', main).innerHTML = `<p class="form-msg">${esc(e.message)}</p>`; }
  };
  A.TITLES.league = 'Апталык лига';

  /* ------------------------------ Certificates ---------------------------- */
  const LEVELS = [['A1', 2], ['A1p', 3], ['A2', 4], ['B1', 5], ['B2', 6]];
  const label = (c) => c.replace('p', '+');
  const LOGO = '<svg viewBox="0 0 40 40" width="70" height="70" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#12355b"/><circle cx="27" cy="13" r="4" fill="#e9b949"/><path d="M6 31 17 13l11 18z" fill="#e9b949"/><path d="M17 13l11 18h-6z" fill="#c0532a"/><path d="M4 32c5-2 10 2 16 0s11-2 16 0" fill="none" stroke="#7fb2e5" stroke-width="1.8"/></svg>';
  A.ROUTES.certificates = function certificates() {
    const main = A.main(), certs = store.d.certs || {};
    main.innerHTML = page('Деңгээл тесттери жана сертификаттар', 'شهادات', 'Ар бир тестте курстун бир баскычынан 25 суроо бар. 80% же андан көп алсаңыз, басып чыгара же бөлүшө турган сертификат аласыз.') + `<div class="wrap" style="padding:30px 0 80px"><div class="cert-grid">${LEVELS.map(([c, n]) => {
      const st = A.COURSE.stages.find((s) => s.n === n), got = certs[c], pr = A.stageProgress(st);
      return `<div class="panel cert-tile ${got ? 'got' : ''}"><span class="lvl">${label(c)}</span><h3>${esc(st.title)}</h3><p class="voice-note">${pr.t} сабактын ${pr.d} бүттү${got ? ` · ${Math.round(got.score * 100)}% менен тапшырылды` : ''}</p><div class="quiz-actions">${got ? `<a class="btn btn-gold btn-sm" href="#cert-${c}">Сертификатты көрүү</a>` : ''}<a class="btn ${got ? 'btn-line' : 'btn-ink'} btn-sm" href="#certtest-${c}">${got ? 'Кайра тапшыруу' : 'Тестти тапшыруу'}</a></div></div>`;
    }).join('')}</div>
    <p class="voice-note" style="margin-top:20px">Бул сертификаттар ушул курстун деңгээл тесттерин тапшырганыңызды көрсөтөт. Алар расмий тил экзамени эмес.</p></div>`;
  };
  A.TITLES.certificates = 'Сертификаттар';
  A.PREFIXES.push(['certtest-', (c) => {
    const main = A.main(), lv = LEVELS.find((x) => x[0] === c);
    if (!lv) return A.ROUTES.certificates();
    const st = A.COURSE.stages.find((s) => s.n === lv[1]);
    const qs = shuffle(st.lessons.flatMap((l) => l.quiz || [])).slice(0, 25);
    main.innerHTML = page(`${label(c)} деңгээл тести`, A.plain(st.ar), `«${esc(st.title)}» баскычынан 25 суроо. Кеңеш жок, артка кайтуу жок — шашпаңыз.`, '<a href="#certificates">Сертификаттар</a>') + '<div class="narrow" style="padding:30px 0 80px"><div class="quiz"></div></div>';
    const cb = (pct) => {
      store.addXP(pct * 40, 'test');
      if (pct >= 0.8) {
        const prev = store.d.certs[c];
        if (!prev || pct > prev.score) store.d.certs[c] = { score: pct, date: Date.now(), name: signed() ? A.cloud.user.name : (store.d.settings.certName || '') };
        store.save();
      }
    };
    cb.passText = `Тапшырдыңыз! <a href="#cert-${c}">${label(c)} сертификатыңызды көрүү</a>.`;
    cb.failText = 'Бул жолу болбоду — 80% керек. Төмөнкү суроолорду карап, баскычты кайталап, дагы аракет кылыңыз.';
    A.mountQuiz($('.quiz', main), qs, cb);
  }]);
  A.PREFIXES.push(['cert-', (c) => {
    const main = A.main(), got = (store.d.certs || {})[c], lv = LEVELS.find((x) => x[0] === c);
    if (!got || !lv) { main.innerHTML = page('Сертификат', '', 'Сиз бул сертификатты азырынча алган жоксуз.', '<a href="#certificates">Сертификаттар</a>'); return; }
    const st = A.COURSE.stages.find((s) => s.n === lv[1]);
    const name = (signed() && A.cloud.user.name) || got.name || store.d.settings.certName || '';
    const code = ('MZ' + c + ':' + name + ':' + got.date).split('').reduce((h, ch) => ((h * 31 + ch.charCodeAt(0)) >>> 0), 7).toString(36).toUpperCase();
    main.innerHTML = `<div class="wrap cert-page" style="padding:30px 0 80px"><div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px"><a class="btn btn-line btn-sm" href="#certificates">← Сертификаттар</a>${signed() ? '' : `<input class="cert-name" type="text" maxlength="40" placeholder="Сертификаттагы атыңыз" value="${esc(name)}">`}<button class="btn btn-ink btn-sm" data-print>Басып чыгаруу же PDF катары сактоо</button></div>
      <div class="certificate"><div class="cert-in">
        ${LOGO}
        <p class="c-small">Масри · Египет арабчасы курсу</p><h1>Жетишкендик сертификаты</h1><p class="c-small">Бул сертификат төмөнкүнү тастыктайт:</p>
        <p class="c-name">${esc(name) || '________________'}</p>
        <p>Масри курсунун <b>${label(c)}</b> деңгээл тестин ийгиликтүү тапшырды</p><p class="c-stage">${esc(st.title)} · <span class="kg" lang="ar">${esc(A.plain(st.ar))}</span></p>
        <div class="c-row"><div><b>${Math.round(got.score * 100)}%</b><span>жыйынтык</span></div><div><b>${date(got.date, { day: 'numeric', month: 'long', year: 'numeric' })}</b><span>дата</span></div><div><b>${code}</b><span>сертификаттын ID</span></div></div>
        <p class="c-note">Курсту бүтүргөндүгү тууралуу сертификат · расмий тил экзамени эмес</p></div></div></div>`;
    main.addEventListener('click', (e) => { if (e.target.closest('[data-print]')) { try { window.print(); } catch (err) { toast('Бул жерде басып чыгарууга болбойт — жайгаштырылган тиркемени ачыңыз.'); } } });
    const nm = $('.cert-name', main); if (nm) nm.addEventListener('change', () => { store.d.settings.certName = nm.value.trim(); got.name = nm.value.trim(); store.save(); A.route(); });
  }]);

  /* --------------------------------- Tools -------------------------------- */
  A.ROUTES.tools = function tools() {
    const main = A.main();
    const t = (href, glyph, title, text, ar) => `<a class="tool" href="${href}"><span class="glyph" ${ar ? 'lang="ar"' : ''}>${glyph}</span><h3>${title}</h3><p>${text}</p></a>`;
    main.innerHTML = page('Куралдар', 'أدوات', 'Курсту колдогон бардык нерселер.') + `<div class="wrap" style="padding:30px 0 80px"><div class="tools tools-hub">
      ${t('#dictionary', 'قاموس', 'Сөздүк', (A.dictionaryIndex ? A.dictionaryIndex().length.toLocaleString() + ' сөз' : 'Бардык сөздөр') + ', арабча, транскрипция же кыргызча менен издөө.', true)}
      ${t('#alphabet', 'أ ب ت', 'Арип', '28 тамга, тыбыштары, формалары жана окуу машыгуусу.', true)}
      ${t('#machine', 'كتابي', 'Сөз машинасы', 'Каалаган зат атооч же этиш формасын себептери менен куруңуз.', true)}
      ${t('#cheatsheet', '±', 'Шпаргалка', 'Бардык мүчөлөр бир бетте.')}
      ${t('#certificates', '★', 'Деңгээл тесттери', 'A1ден B2ге чейинки сертификаттар.')}
      ${t('#placement', '?', 'Деңгээл тести', 'Кайдан баштоону табыңыз.')}
      ${t('#goals', '◎', 'Окуу планы', 'Максатыңыз, күнүмдүк XP жана бүтүрүү датасы.')}
      ${t('#plan', '☰', 'Кантип үйрөнөбүз', 'Сааттар, тартип жана булактар.')}
      ${t('#tektesh', 'К', 'Тектеш сөздөр', 'Кыргызчадагы араб сөздөрү жана фусха менен айырмачылыктар.')}
      ${t('#about-audio', '♪', 'Аудио жөнүндө', 'Үндөр, ылдамдык жана транскрипция белгилери.')}
    </div></div>`;
  };
  A.TITLES.tools = 'Куралдар';
});
