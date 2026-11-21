/* ==========================================================================
   Cloud: accounts, cross-device sync, weekly league XP, installable app (PWA).
   Works in "guest mode" with no server (local file, preview, offline):
   everything is saved on the device and merged into the account on sign-in.
   ========================================================================== */
(window.KG_PLUGINS = window.KG_PLUGINS || []).push(function (A) {
  'use strict';
  const { store, $, esc, toast } = A;
  const cloud = { available: null, user: null, status: 'idle', lastSync: 0, listeners: [] };
  A.cloud = cloud;
  const emit = () => cloud.listeners.forEach((fn) => { try { fn(cloud); } catch (e) { /* ignore */ } });
  cloud.onChange = (fn) => cloud.listeners.push(fn);

  /* ------------------------------ API client ------------------------------ */
  async function api(path, opts) {
    opts = opts || {};
    const r = await fetch(path, {
      method: opts.method || 'GET', credentials: 'same-origin',
      headers: Object.assign({ 'X-KG': '1' }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined, keepalive: !!opts.keepalive
    });
    let j = null;
    try { j = await r.json(); } catch (e) { throw Object.assign(new Error('Сервер жеткиликсиз.'), { offline: true }); }
    if (!r.ok) throw Object.assign(new Error(j.error || 'Бир нерсе туура эмес болду.'), { status: r.status });
    return j;
  }
  cloud.api = api;

  /* --------------------------------- Merge -------------------------------- */
  // Combine progress from this device and the account so nothing is lost.
  function merge(a, b) {
    if (!b) return a; if (!a) return b;
    const out = Object.assign({}, b, a);
    const newer = (a.mod || 0) >= (b.mod || 0) ? a : b;
    ['plan', 'placement', 'settings', 'tl', 'tls', 'ar'].forEach((k) => { if (newer[k] !== undefined) out[k] = newer[k]; });
    const maxMap = (x, y) => { const o = Object.assign({}, y || {}); Object.entries(x || {}).forEach(([k, v]) => { o[k] = Math.max(v || 0, o[k] || 0); }); return o; };
    const byTime = (x, y) => { const o = Object.assign({}, y || {}); Object.entries(x || {}).forEach(([k, v]) => { const w = o[k]; if (!w || (v.t || 0) > (w.t || 0) || (!v.t && !w.t && (v.box || v.s || 0) > (w.box || w.s || 0))) o[k] = v; }); return o; };
    out.done = maxMap(a.done, b.done);
    out.xp = maxMap(a.xp, b.xp);
    out.stats = maxMap(a.stats, b.stats);
    out.srs = byTime(a.srs, b.srs);
    out.words = byTime(a.words, b.words);
    out.certs = Object.assign({}, b.certs || {});
    Object.entries(a.certs || {}).forEach(([k, v]) => { if (!out.certs[k] || v.score > out.certs[k].score) out.certs[k] = v; });
    const seen = new Set(); out.mistakes = [...(a.mistakes || []), ...(b.mistakes || [])].filter((m) => { const k = m.q; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 200);
    const sa = a.streak || {}, sb = b.streak || {};
    out.streak = (sa.last || '') > (sb.last || '') ? sa : (sb.last || '') > (sa.last || '') ? sb : { last: sa.last || '', count: Math.max(sa.count || 0, sb.count || 0) };
    out.reviews = Math.max(a.reviews || 0, b.reviews || 0);
    out.localTexts = a.localTexts || b.localTexts;
    out.mod = Math.max(a.mod || 0, b.mod || 0);
    return out;
  }
  cloud.merge = merge;

  /* --------------------------------- Sync --------------------------------- */
  let timer = null, pushing = false, again = false;
  function payload() { const d = Object.assign({}, store.d); delete d.localTexts; return d; }
  async function pull() {
    cloud.status = 'syncing'; emit();
    const r = await api('/api/state');
    const merged = merge(store.d, r.state);
    store.d = Object.assign(store.d, merged);
    store.save(true);
    await push();
    A.applyTl(); A.applyAr();
  }
  async function push() {
    if (!cloud.user) return;
    if (pushing) { again = true; return; }
    pushing = true; cloud.status = 'syncing'; emit();
    try { await api('/api/state', { method: 'PUT', body: { state: payload() } }); cloud.status = 'synced'; cloud.lastSync = Date.now(); }
    catch (e) { cloud.status = e.offline ? 'offline' : 'error'; cloud.error = e.message; }
    pushing = false; emit();
    if (again) { again = false; push(); }
  }
  cloud.syncNow = async () => { if (cloud.user) { try { await pull(); toast('Жетишкендиктер шайкештирилди.'); } catch (e) { toast(e.message); } } };
  document.addEventListener('kg-save', () => { if (!cloud.user) return; clearTimeout(timer); timer = setTimeout(push, 2500); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && cloud.user && timer) { clearTimeout(timer); timer = null; api('/api/state', { method: 'PUT', body: { state: payload() }, keepalive: true }).catch(() => {}); }
    if (document.visibilityState === 'visible' && cloud.user && Date.now() - cloud.lastSync > 60000) pull().catch(() => {});
  });

  // Weekly league: send earned XP in small batches.
  let pendingXP = 0, xpTimer = null;
  document.addEventListener('kg-xp', (e) => {
    pendingXP += e.detail.n;
    if (!cloud.user) return;
    clearTimeout(xpTimer);
    xpTimer = setTimeout(() => { const n = Math.min(150, pendingXP); pendingXP -= n; api('/api/leaderboard', { method: 'POST', body: { xp: n } }).catch(() => { pendingXP += n; }); }, 4000);
  });

  async function signedIn(user, fresh) {
    cloud.user = user; emit(); renderButton();
    try { await pull(); if (fresh) toast('Кирдиңиз. Бул түзмөктөгү жетишкендиктер аккаунтуңузга кошулду.'); }
    catch (e) { cloud.status = 'error'; cloud.error = e.message; emit(); }
    document.dispatchEvent(new CustomEvent('kg-auth', { detail: user }));
  }

  /* ------------------------------ Header button --------------------------- */
  function renderButton() {
    const b = $('.acct-btn'); if (!b) return;
    if (cloud.user) { b.textContent = cloud.user.name.slice(0, 18); b.title = 'Аккаунтуңуз (' + cloud.user.email + ')'; b.classList.add('in'); }
    else { b.textContent = cloud.available === false ? 'Конок' : 'Кирүү'; b.title = 'Жетишкендиктерди шайкештирүү үчүн кириңиз'; b.classList.remove('in'); }
  }

  /* ------------------------------ Account page ---------------------------- */
  const ago = (t) => { if (!t) return 'эч качан'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'жаңы эле' : s < 3600 ? Math.round(s / 60) + ' мүн мурун' : new Date(t).toLocaleString('ru'); };
  A.ROUTES.account = function account() {
    const main = A.main();
    const head = `<header class="page-head"><div class="wrap"><h1>Аккаунтуңуз</h1><div class="kgt" lang="ar" translate="no">حسابي</div><p>${cloud.user ? 'Жетишкендиктериңиз аккаунтка автоматтык түрдө сакталат — каалаган телефондон, планшеттен же компьютерден уланта аласыз.' : 'Жетишкендиктериңизди сактап, каалаган түзмөктөн — телефон, планшет же компьютерден — улантуу үчүн кириңиз.'}</p></div></header>`;
    if (cloud.available === false) {
      main.innerHTML = head + `<div class="narrow" style="padding:36px 0 80px">${cloud.serverError ? A.BLOCK.warn({ title: 'Серверди жөндөө керек', html: esc(cloud.serverError) }) : ''}${A.BLOCK.tip({ title: 'Конок режими', html: 'Тиркеменин бул нускасы серверсиз иштеп жатат — мисалы, алдын ала көрүү режиминде же файлдан түз ачылган — ошондуктан аккаунттар, шайкештирүү жана коомчулук өчүк. Кылган ишиңиздин баары ушул түзмөктө сакталат.<br><br>Тиркеме Vercel’де маалымат базасы менен жайгаштырылганда (README’ни караңыз), бул бетте аккаунт ача аласыз.' })}${installBlock()}</div>`;
      return;
    }
    if (!cloud.user) {
      const tunduk = `<svg class="auth-tunduk" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="27" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 31 17 13l11 18z M17 13l4 18" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M4 33c5-2 10 2 16 0s11-2 16 0" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
      main.innerHTML = `<section class="auth-wrap"><div class="wrap"><div class="auth-split">
        <div class="auth-side">
          ${tunduk}
          <p class="auth-hello" lang="ar" translate="no" dir="rtl">أهلاً وسهلاً!</p>
          <p class="auth-hello-en">Кош келиңиз! Жетишкендиктериңиз сакталып калышы үчүн кириңиз.</p>
          <ul class="auth-perks">
            <li><b>Каалаган түзмөк.</b> Сабакты ноутбукта баштап, телефондо бүтүрүңүз.</li>
            <li><b>Чыныгы оңдоолор.</b> Бир нече сүйлөм жазыңыз — арабтар оңдоп беришет.</li>
            <li><b>Апталык лига.</b> XP топтоп, рейтингиңизди көрүңүз (баш тартсаңыз болот).</li>
          </ul>
        </div>
        <div class="auth-main">
          <div class="auth-tabs" role="tablist" aria-label="Аккаунт"><button type="button" role="tab" data-tab="in" aria-selected="true" aria-pressed="true">Кирүү</button><button type="button" role="tab" data-tab="up" aria-selected="false" aria-pressed="false">Аккаунт ачуу</button></div>
          <form class="auth-form" novalidate>
            <div class="field up-only hide"><label for="au-name">Атыңыз</label><input class="input" id="au-name" type="text" autocomplete="nickname" maxlength="40" placeholder="Коомчулуктагы посттордун жанында көрүнөт"></div>
            <div class="field"><label for="au-email">Электрондук почта</label><input class="input" id="au-email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
            <div class="field"><label for="au-pw">Сырсөз</label><div class="pw-wrap"><input class="input" id="au-pw" type="password" autocomplete="current-password" minlength="8" required><button type="button" class="pw-toggle" aria-label="Сырсөздү көрсөтүү" aria-pressed="false">Көрсөтүү</button></div><div class="hint up-only hide">Кеминде 8 белги.</div></div>
            <label class="check up-only hide"><input id="au-native" type="checkbox"> Араб тили — эне тилим же эркин сүйлөйм. Башкаларды оңдогондо белги аласыз.</label>
            <div class="form-msg" role="alert"></div>
            <button class="btn btn-ink auth-submit" type="submit">Кирүү</button>
          </form>
          <p class="auth-foot">Кирген учурда бул түзмөктө кылган ишиңиздин баары аккаунтуңузга кошулат. Сырсөздү унуттуңузбу? Тиркеме кат жөнөтө албайт — жаңы аккаунт ачыңыз же сайттын ээсинен калыбына келтирүүнү сураңыз.</p>
        </div>
      </div><div class="auth-install">${installBlock()}</div></div></section>`;
      main.querySelector('.pw-toggle').addEventListener('click', (e) => {
        const b = e.currentTarget, i = $('#au-pw'), show = i.type === 'password';
        i.type = show ? 'text' : 'password'; b.textContent = show ? 'Жашыруу' : 'Көрсөтүү';
        b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Сырсөздү жашыруу' : 'Сырсөздү көрсөтүү'); i.focus();
      });
      let mode = 'in';
      const form = $('.auth-form', main);
      main.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (!t) return;
        mode = t.dataset.tab;
        main.querySelectorAll('[data-tab]').forEach((x) => { x.setAttribute('aria-pressed', String(x === t)); x.setAttribute('aria-selected', String(x === t)); });
        $('.form-msg', main).textContent = '';
        main.querySelectorAll('.up-only').forEach((x) => x.classList.toggle('hide', mode !== 'up'));
        $('#au-pw').setAttribute('autocomplete', mode === 'up' ? 'new-password' : 'current-password');
        form.querySelector('[type=submit]').textContent = mode === 'up' ? 'Аккаунт ачуу' : 'Кирүү';
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = $('.form-msg', main), btn = form.querySelector('[type=submit]');
        msg.textContent = '';
        const email = $('#au-email').value.trim(), pw = $('#au-pw').value;
        const miss = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? ['#au-email', email ? 'Почта дареги туура эмес окшойт. Катаны текшериңиз.' : 'Почта дарегиңизди жазыңыз.']
          : !pw ? ['#au-pw', 'Сырсөзүңүздү жазыңыз.']
          : mode === 'up' && pw.length < 8 ? ['#au-pw', 'Сырсөз кеминде 8 белгиден турушу керек.'] : null;
        form.querySelectorAll('.input').forEach((i) => i.removeAttribute('aria-invalid'));
        if (miss) { const f = $(miss[0]); f.setAttribute('aria-invalid', 'true'); f.focus(); msg.textContent = miss[1]; return; }
        btn.disabled = true; const label = btn.textContent; btn.textContent = mode === 'up' ? 'Аккаунт ачылууда…' : 'Кирүүдө…';
        try {
          const body = { email, password: pw };
          if (mode === 'up') Object.assign(body, { name: $('#au-name').value, native: $('#au-native').checked });
          const r = await api('/api/auth?a=' + (mode === 'up' ? 'signup' : 'login'), { method: 'POST', body });
          await signedIn(r.user, true);
          location.hash = '#home';
        } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = label; }
      });
      return;
    }
    const u = cloud.user;
    const statusText = { idle: 'Даяр', syncing: 'Шайкештирилүүдө…', synced: 'Акыркы абалда', offline: 'Офлайн — интернет кайтканда өзгөртүүлөр шайкештирилет', error: 'Шайкештирүү көйгөйү: ' + (cloud.error || '') }[cloud.status] || '';
    main.innerHTML = head + `<div class="narrow" style="padding:36px 0 80px">
      <section class="panel" style="margin-bottom:20px"><h3>${esc(u.name)} катары кирдиңиз</h3><p class="voice-note">${esc(u.email)} · ${new Date(u.created).toLocaleDateString('ru')} бери мүчө</p>
        <p><span class="sync-dot ${esc(cloud.status)}"></span> ${esc(statusText)} · акыркы шайкештирүү: ${esc(ago(cloud.lastSync))}</p>
        <div class="quiz-actions"><button class="btn btn-line btn-sm" data-acc="sync">Азыр шайкештирүү</button><button class="btn btn-line btn-sm" data-acc="export">Маалыматымды көчүрүү</button><button class="btn btn-ink btn-sm" data-acc="logout">Чыгуу</button></div></section>
      <section class="panel" style="margin-bottom:20px"><h3>Профиль</h3>
        <div class="field"><label for="pf-name">Аты</label><input class="input" id="pf-name" type="text" maxlength="40" value="${esc(u.name)}"></div>
        <label class="check"><input id="pf-native" type="checkbox" ${u.native ? 'checked' : ''}> Араб тили — эне тилим же эркин сүйлөйм</label>
        <label class="check"><input id="pf-board" type="checkbox" ${u.board ? 'checked' : ''}> Мени апталык лигада көрсөтүү</label>
        <div class="quiz-actions"><button class="btn btn-ink btn-sm" data-acc="profile">Профилди сактоо</button></div></section>
      <section class="panel" style="margin-bottom:20px"><h3>Сырсөз</h3>
        <div class="field"><label for="pw-old">Учурдагы сырсөз</label><input class="input" id="pw-old" type="password" autocomplete="current-password"></div>
        <div class="field"><label for="pw-new">Жаңы сырсөз</label><input class="input" id="pw-new" type="password" autocomplete="new-password"></div>
        <div class="quiz-actions"><button class="btn btn-line btn-sm" data-acc="password">Сырсөздү өзгөртүү</button><button class="btn btn-line btn-sm" data-acc="logout-all">Бардык түзмөктөрдөн чыгуу</button></div></section>
      ${installBlock()}
      <section class="panel danger"><h3>Аккаунтту өчүрүү</h3><p class="voice-note">Аккаунтуңуз, жетишкендиктериңиз, тексттериңиз жана коомчулуктагы постторуңуз серверден өчүрүлөт. Муну кайра калыбына келтирүүгө болбойт.</p>
        <div class="field"><label for="del-pw">Ырастоо үчүн сырсөзүңүздү жазыңыз</label><input class="input" id="del-pw" type="password" autocomplete="current-password"></div>
        <button class="btn btn-line btn-sm" data-acc="delete" style="color:var(--red);border-color:var(--red)">Аккаунтумду өчүрүү</button></section>
      <div class="form-msg" role="alert" style="margin-top:14px"></div></div>`;
    const msg = (t) => { $('.form-msg', main).textContent = t; };
    main.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-acc]'); if (!b) return;
      const act = b.dataset.acc; msg('');
      try {
        if (act === 'sync') { await cloud.syncNow(); A.route(); }
        if (act === 'export') { await navigator.clipboard.writeText(JSON.stringify(payload(), null, 1)); toast('Маалыматыңыз алмашуу буферине көчүрүлдү.'); }
        if (act === 'logout' || act === 'logout-all') {
          await push();
          await api('/api/auth?a=' + act, { method: 'POST' });
          cloud.user = null; localStorage.removeItem('masri-v1');
          toast(act === 'logout' ? 'Чыктыңыз. Жетишкендиктериңиз аккаунтта аман-эсен.' : 'Бардык түзмөктөрдөн чыктыңыз.');
          setTimeout(() => location.replace(location.pathname + '#home'), 300); setTimeout(() => location.reload(), 350);
        }
        if (act === 'profile') { const r = await api('/api/auth?a=profile', { method: 'POST', body: { name: $('#pf-name').value, native: $('#pf-native').checked, board: $('#pf-board').checked } }); cloud.user = r.user; renderButton(); toast('Профиль сакталды.'); }
        if (act === 'password') { const r = await api('/api/auth?a=profile', { method: 'POST', body: { password: $('#pw-old').value, newPassword: $('#pw-new').value } }); cloud.user = r.user; toast('Сырсөз өзгөрдү. Башка түзмөктөрдөн чыгарылдыңыз.'); $('#pw-old').value = $('#pw-new').value = ''; }
        if (act === 'delete') {
          if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Биротоло өчүрүү үчүн дагы бир басыңыз'; return; }
          await api('/api/auth?a=delete', { method: 'POST', body: { password: $('#del-pw').value } });
          localStorage.removeItem('masri-v1'); location.replace(location.pathname + '#home'); location.reload();
        }
      } catch (err) { msg(err.message); }
    });
  };
  A.TITLES.account = 'Аккаунт';

  /* -------------------------------- Install ------------------------------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; document.body.classList.add('can-install'); });
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function installBlock() {
    if (standalone()) return '';
    return `<section class="panel" style="margin:20px 0"><h3>Тиркемени орнотуу</h3><p class="voice-note">Масриди башкы экраныңызга коюңуз. Ал толук экранда ачылып, интернетсиз да иштейт.</p>
      <button class="btn btn-gold btn-sm install-btn" data-act="install">Тиркемени орнотуу</button>
      <p class="voice-note install-manual">iPhone же iPad’де: <b>Бөлүшүү</b> → <b>Башкы экранга кошуу</b>. Android’де: браузердин менюсу → <b>Тиркемени орнотуу</b>.</p></section>`;
  }
  cloud.installBlock = installBlock;
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="install"]')) return;
    if (!installEvt) { toast('Браузердин менюсун колдонуңуз: «Башкы экранга кошуу» же «Тиркемени орнотуу».'); return; }
    installEvt.prompt(); const c = await installEvt.userChoice; installEvt = null; document.body.classList.remove('can-install');
    if (c.outcome === 'accepted') toast('Орнотулду! Масриди башкы экраныңыздан табыңыз.');
  });

  /* --------------------------------- Boot --------------------------------- */
  const prevBoot = A.HOOKS.boot;
  A.HOOKS.boot = async function () {
    if (prevBoot) prevBoot();
    renderButton();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* not allowed here */ });
    }
    if (location.protocol === 'file:') { cloud.available = false; renderButton(); emit(); return; }
    try {
      const r = await api('/api/auth?a=me');
      cloud.available = true;
      if (r.user) await signedIn(r.user, false);
    } catch (e) { cloud.available = e.status === 503 ? false : !e.offline ? true : false; if (e.offline && navigator.onLine === false) cloud.available = true; if (e.status) cloud.serverError = e.message; }
    renderButton(); emit();
    const h = location.hash.replace('#', '');
    if (['', 'home', 'account', 'community', 'library', 'review', 'goals'].includes(h)) A.route();
  };
  window.addEventListener('online', () => { if (!cloud.user && cloud.available !== false) A.HOOKS.boot && api('/api/auth?a=me').then((r) => r.user && signedIn(r.user, false)).catch(() => {}); });
});
