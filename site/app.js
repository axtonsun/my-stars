'use strict';
(() => {
  const { esc, hash } = Draw;
  const INBOX = 'inbox';
  // one coloured pencil per drawer; a new category falls back to the spare pencils
  const COLOR = {
    agent: '#9fc6dd', design: '#8fa9cf', content: '#a9d4c4', 'research-ai': '#c3b1df', academia: '#b88fb3',
    llm: '#efcd76', ml: '#f2b98f', coding: '#c98a6a', career: '#d3a875', sketch: '#9cc27f', graph: '#b7c79a',
    fraud: '#df8797', tools: '#f0a9b7', proxy: '#b9c3c9', finance: '#c8a06e', life: '#f2b3be',
  };
  const SPARE = ['#a9d4c4', '#efcd76', '#c3b1df', '#9cc27f', '#f2b98f', '#9fc6dd'];
  const SORTS = ['stars', 'starred', 'pushed'];
  const CJK = /[　-鿿＀-￯]/;
  const NOW = Date.now();

  const $ = (s) => document.querySelector(s);
  const days = (iso) => (NOW - new Date(iso).getTime()) / 864e5;
  const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n));
  const dot = (iso) => (iso || '').slice(0, 10).replaceAll('-', '·');

  let D = null;
  const S = { c: '', t: '', s: '', q: '', r: '', l: '' };

  /* ---------- language ---------- */
  // The hash's `l` wins; otherwise the language picked last time; otherwise the browser's (Chinese if any preferred language is Chinese).
  const LANG_KEY = 'my-stars:lang';
  let PREF = null;
  try { PREF = localStorage.getItem(LANG_KEY); } catch {}
  if (!I18N[PREF]) PREF = null;
  const browserLang = () => ((navigator.languages?.length ? navigator.languages : [navigator.language || '']).some((l) => /^zh\b/i.test(l)) ? 'zh' : 'en');
  const defLang = () => PREF || browserLang();
  const hashLang = () => { const l = new URLSearchParams(location.hash.slice(1)).get('l'); return I18N[l] ? l : defLang(); };
  const T = () => I18N[S.l];
  const en = () => S.l === 'en';
  const cname = (c) => (en() && c.name_en) || c.name;
  const cdesc = (c) => (en() && c.desc_en) || c.desc;
  const tag = (t) => (en() && D.tagsEn[t]) || t;
  const summary = (r) => (en() ? r.summaryEn : r.summary) || T().noDesc;
  function setLang(l) {
    PREF = l;
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    go({ l }, true);
  }

  /* ---------- data ---------- */
  async function load() {
    const get = (p) => fetch(p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
    const [stars, cls] = await Promise.all([get('data/stars.json'), get('data/classification.json')]);
    const tagsEn = cls.tags_en || {};
    const order = cls.groups.flatMap((g) => g.cats).filter((id) => cls.categories[id]);
    for (const id of Object.keys(cls.categories)) if (!order.includes(id)) order.push(id);
    const cats = {};
    order.forEach((id, i) => {
      const c = cls.categories[id];
      cats[id] = { id, name: c.name, name_en: c.name_en, desc: c.desc || '', desc_en: c.desc_en, glyph: c.glyph || [...c.name].find((ch) => ch.charCodeAt(0) > 255) || c.name[0], color: COLOR[id] || SPARE[i % SPARE.length] };
    });
    cats[INBOX] = { id: INBOX, name: I18N.zh.inbox, name_en: I18N.en.inbox, desc: I18N.zh.inboxDesc, desc_en: I18N.en.inboxDesc, glyph: '新', color: '#e9a99b' };
    const repos = stars.repos.map((r) => {
      const c = cls.repos[r.full_name];
      const cat = c && cats[c.cat] && c.cat !== INBOX ? c.cat : INBOX;
      const tags = c?.tags?.length ? c.tags : r.topics.slice(0, 4);
      const summary = c?.summary || r.description || '';
      // English: the hand-written one, else GitHub's description when it is English, else the Chinese summary
      const summaryEn = c?.summary_en || (r.description && !CJK.test(r.description) ? r.description : '') || summary;
      const tagText = [...tags, ...tags.map((t) => tagsEn[t] || '')].join(' ');
      // search both languages, whichever one is showing
      const hay = [r.full_name, r.description, summary, summaryEn, tagText, r.topics.join(' '), r.language, cats[cat].name, cats[cat].name_en].join(' ').toLowerCase();
      const seen = [r.name, summary, summaryEn, tagText].join(' ').toLowerCase();
      return { ...r, cat, tags, summary, summaryEn, hay, seen };
    });
    for (const id of Object.keys(cats)) {
      const list = repos.filter((r) => r.cat === id).sort((a, b) => b.stars - a.stars);
      list.forEach((r, k) => { r.no = `${cats[id].glyph}·${String(k + 1).padStart(2, '0')}`; });
      cats[id].count = list.length;
    }
    D = { user: stars.user, synced: stars.synced_at, repos, cats, order, tagsEn, byName: Object.fromEntries(repos.map((r) => [r.full_name, r])) };
  }
  const inCat = (id) => D.repos.filter((r) => r.cat === id);
  // a drawer's guide cards, as [tag, count]: its most used tags, plus the one being filtered on
  function guides(id) {
    const tc = {};
    inCat(id).forEach((r) => r.tags.forEach((x) => { tc[x] = (tc[x] || 0) + 1; }));
    const tabs = Object.entries(tc).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (S.t && S.c === id && !tabs.some(([x]) => x === S.t)) tabs.push([S.t, tc[S.t] || 0]);
    return tabs;
  }
  const terms = () => S.q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (r, t = terms()) => t.every((x) => r.hay.includes(x));

  /* ---------- url hash <-> state ---------- */
  // `l` goes into links when it is English (so English links can be shared), or when it differs from this visitor's default
  function href(patch) {
    const st = { ...S, ...patch }, p = new URLSearchParams();
    for (const k of ['c', 't', 's', 'q', 'r']) if (st[k]) p.set(k, st[k]);
    if (st.l === 'en' || st.l !== defLang()) p.set('l', st.l);
    const h = p.toString();
    return h ? '#' + h : '#';
  }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const k of Object.keys(S)) S[k] = p.get(k) || '';
    S.l = hashLang();
    if (S.c && !D.cats[S.c]) S.c = '';
    if (S.r && !D.byName[S.r]) S.r = '';
    if (!SORTS.includes(S.s)) S.s = '';
    const q = $('#q');
    if (document.activeElement !== q) q.value = S.q;
  }
  const go = (patch, replace) => {
    const h = href(patch);
    if (replace) history.replaceState(null, '', h === '#' ? location.pathname : h); else location.hash = h;
    if (replace) { readHash(); render(); }
  };
  const view = () => (S.r ? 'card' : S.q.trim() ? 'search' : S.c === INBOX ? 'inbox' : S.c ? 'drawer' : 'home');

  /* ---------- page chrome in the current language ---------- */
  let SHOWN = '';
  function chrome() {
    const t = T();
    document.documentElement.lang = t.html;
    $('meta[name="description"]').content = t.meta;
    $('h1').textContent = t.title;
    $('#alt').textContent = t.alt;
    $('#q').placeholder = t.placeholder;
    $('#q').setAttribute('aria-label', t.search);
    $('#cabinet').setAttribute('aria-label', t.cabinet);
    document.querySelectorAll('.lang [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === S.l)));
    if (!D) {
      $('#sub').textContent = t.tagline;
      document.title = t.docTitle('');
      return;
    }
    const n = D.order.length, total = D.repos.length;
    $('#sub').textContent = t.sub(n, total);
    $('#foot').innerHTML = `${esc(t.foot(n, total, t.date(D.synced)))} · <a href="https://github.com/${esc(D.user)}?tab=stars" target="_blank" rel="noopener">${esc(t.allOnGitHub)}</a>`;
    drawCabinet();
    SHOWN = S.l;
  }

  /* ---------- the cabinet ---------- */
  const phone = matchMedia('(max-width: 820px)');
  let CAB = null;
  const drawerOf = (id) => { const c = D.cats[id], name = cname(c); return { ...c, name, label: T().drawer(name, c.count), closeLabel: T().close(name) }; };
  function drawCabinet() {
    const cols = phone.matches ? 2 : 4;
    const { svg, L } = Draw.cabinet(D.order.map(drawerOf), cols);
    const el = $('#cabinet');
    el.setAttribute('viewBox', `0 0 ${L.vw} ${L.vh}`);
    el.innerHTML = svg + '<g id="overlay"></g>';
    CAB = { L, cols };
  }
  function drawOverlay(v) {
    const L = CAB.L;
    let s = '';
    const open = v === 'card' ? D.byName[S.r].cat : v === 'drawer' ? S.c : '';
    document.querySelectorAll('#cabinet .drawer').forEach((g) => g.classList.toggle('is-open', g.dataset.cat === open));
    if (v === 'search') {
      const hits = {};
      D.repos.filter((r) => matches(r)).forEach((r) => { hits[r.cat] = (hits[r.cat] || 0) + 1; });
      D.order.forEach((id, i) => { s += hits[id] ? Draw.flag(L, i, T().flag(hits[id]), id) : Draw.dim(L, i); });
    }
    const i = D.order.indexOf(open);
    if (i >= 0) {
      const tabs = guides(open).map(([x, n]) => ({ tag: x, label: T().guideCard(tag(x), n) }));
      s += Draw.pulled(L, i, drawerOf(open), tabs, S.t && S.c === open ? tabs.findIndex((g) => g.tag === S.t) : -1);
    }
    const waiting = D.cats[INBOX].count;
    if (waiting) s += Draw.note(L, T().note(waiting));
    // a guide tab picked from the keyboard keeps the focus when the overlay is redrawn
    const a = document.activeElement, keep = a?.matches?.('#overlay .gtab:focus-visible') ? a.dataset.tag : null;
    $('#overlay').innerHTML = s;
    if (keep !== null) [...document.querySelectorAll('#overlay .gtab')].find((g) => g.dataset.tag === keep)?.focus();
  }

  /* ---------- cards ---------- */
  function highlighter() {
    const t = terms();
    if (!t.length) return esc;
    const re = new RegExp(t.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
    return (s) => {
      s = String(s ?? ''); let out = '', last = 0;
      for (const m of s.matchAll(re)) { if (!m[0]) continue; out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
      return out + esc(s.slice(last));
    };
  }
  function card(r, o = {}) {
    const hl = o.hl || esc, c = D.cats[r.cat], rot = ((hash(r.full_name) % 100) / 100 - 0.5).toFixed(2), t = T();
    return `<li style="--rot:${rot}deg"><a class="card" href="${href({ r: r.full_name })}">
      <span class="row1"><span class="no">${esc(r.no)}</span><span class="nm">${hl(r.name)}</span><span class="st">★ ${kfmt(r.stars)}</span>${o.chip ? `<span class="chip" style="--c:${c.color}">${esc(cname(c).split(' & ')[0])}</span>` : ''}</span>
      <span class="sm">${hl(summary(r))}</span>
      <span class="ft">${hl(r.tags.map(tag).join(' · '))}<i>${esc(r.owner)} · ${esc(r.language || t.noLang)} · ${esc(t.starredOn(dot(r.starred_at)))}</i></span>
      ${r.cat === INBOX ? `<span class="new">${t.newStamp}</span>` : ''}
    </a></li>`;
  }
  const cards = (list, o) => `<ol class="cards">${list.map((r) => card(r, o)).join('')}</ol>`;
  const sortBy = (k) => ({
    stars: (a, b) => b.stars - a.stars,
    starred: (a, b) => (b.starred_at || '').localeCompare(a.starred_at || ''),
    pushed: (a, b) => (b.pushed_at || '').localeCompare(a.pushed_at || ''),
  }[k]);
  const back = (label) => `<a class="back" href="${href({ c: '', t: '', s: '', q: '', r: '' })}">← ${label}</a>`;
  const head = (kicker, title, aside = '') => `<header class="ph">${back(T().back)}<p class="kicker">${kicker}</p><div class="ph-row"><h2>${title}</h2>${aside}</div></header>`;

  function home() {
    const t = T(), list = [...D.repos].sort(sortBy('starred')).slice(0, 12);
    return head(t.homeKicker, t.homeTitle, `<span class="aside">${t.homeAside}</span>`) + `<div class="tray">${cards(list, { chip: true })}</div>`;
  }

  // the part of a drawer above its tray: kicker and sort links, the drawer's name, its description.
  // The sort links share the kicker's line so long names keep a line to themselves.
  function lid(id) {
    const t = T(), c = D.cats[id], sort = S.s || 'stars';
    const sorter = `<span class="sort" role="group" aria-label="${t.sortLabel}">${SORTS.map((k) => `<a href="${href({ s: k === 'stars' ? '' : k })}"${k === sort ? ' aria-current="true"' : ''}>${t.sorts[k]}${k === sort ? ' ↓' : ''}</a>`).join('')}</span>`;
    return `<div class="lid"><header class="ph">${back(t.back)}<div class="ph-row"><p class="kicker">${t.drawerKicker}</p>${sorter}</div><h2>${esc(cname(c))}</h2></header><p class="desc">${esc(cdesc(c))}</p></div>`;
  }

  function drawer() {
    const t = T(), all = inCat(S.c), tabs = guides(S.c);
    const list = all.filter((r) => !S.t || r.tags.includes(S.t)).sort(sortBy(S.s || 'stars'));
    const guide = `<nav class="guides" aria-label="${t.filterLabel}">${[['', all.length], ...tabs].map(([x, n]) => `<a href="${href({ t: x })}"${x === S.t ? ' aria-current="true"' : ''}>${esc(x ? tag(x) : t.all)} <b>${n}</b></a>`).join('')}</nav>`;
    const note = S.t ? `<p class="hint">${t.tagHint(esc(tag(S.t)), list.length, all.length, href({ t: '' }))}</p>` : '';
    return lid(S.c) + `<div class="tray">${guide}${cards(list)}</div>${note}`;
  }

  // Every drawer's tray has the same size and place: the part above it is made as tall as the
  // tallest drawer's at this width and in this language (style.css reads --lid-h). Phones scroll
  // the whole page instead, so there it is left alone.
  function fitLid() {
    if (!D || view() !== 'drawer' || phone.matches) return;
    const m = document.createElement('div');
    m.className = 'measure';
    m.innerHTML = D.order.map((id) => lid(id)).join('');
    $('#panel').append(m);
    const h = Math.max(...[...m.children].map((e) => e.getBoundingClientRect().height));
    m.remove();
    document.documentElement.style.setProperty('--lid-h', Math.ceil(h) + 'px');
  }

  function search() {
    const t = T(), res = D.repos.filter((r) => matches(r)), words = terms(), q = esc(S.q.trim());
    const seen = (r) => (words.some((x) => r.seen.includes(x)) ? 1 : 0);
    res.sort((a, b) => seen(b) - seen(a) || b.stars - a.stars);
    const n = new Set(res.map((r) => r.cat)).size;
    const body = res.length ? cards(res, { chip: true, hl: highlighter() })
      : `<div class="empty"><p>${t.notFound(q)}</p><p>${t.notFoundHint}</p></div>`;
    return head(t.searchKicker(q), t.nCards(res.length), res.length ? `<span class="aside">${t.searchAside(n)}</span>` : '') + `<div class="tray">${body}</div>`;
  }

  function inbox() {
    const t = T(), list = inCat(INBOX).sort(sortBy('starred'));
    return head(t.inboxKicker, t.inbox, `<span class="aside">${t.cards(list.length)}</span>`) + `<p class="desc">${t.inboxIntro}</p>` +
      `<div class="tray basket">${list.length ? cards(list) : `<div class="empty"><p>${t.inboxEmpty}</p></div>`}</div>`;
  }

  function detail() {
    const t = T(), r = D.byName[S.r], c = D.cats[r.cat];
    const lic = r.license && r.license !== 'NOASSERTION' ? r.license : t.noLicense;
    const d = days(r.pushed_at), ago = t.ago(d);
    const status = r.archived ? [...t.archived, '#7b746b'] : d <= 31 ? [...t.active(ago), '#3f6fa8'] : d <= 365 ? [...t.recent(ago), '#3f6fa8'] : [...t.idle(Math.floor(d / 365), dot(r.pushed_at)), '#7b746b'];
    const shared = (x) => x.tags.filter((g) => r.tags.includes(g)).length;
    let rel = D.repos.filter((x) => x !== r && x.cat === r.cat && shared(x)).sort((a, b) => shared(b) - shared(a) || b.stars - a.stars);
    let relTitle = t.relSame;
    if (!rel.length) { rel = D.repos.filter((x) => x !== r && shared(x)).sort((a, b) => shared(b) - shared(a) || b.stars - a.stars); relTitle = t.relOther; }
    const backTo = S.q ? t.backToResults : S.c ? t.backToDrawer : t.putBack;
    const tagLinks = r.tags.map((g) => r.cat === INBOX ? esc(tag(g)) : `<a href="${href({ r: '', q: '', c: r.cat, t: g })}">${esc(tag(g))}</a>`).join(' · ') || '—';
    const sum = summary(r);
    return `<header class="ph">${back(t.back)}</header>
      <article class="catcard" style="--rot:-1.1deg">
        <div class="cc-top"><div class="cc-no"><small>${t.callNo}</small><b>${esc(r.no)}</b></div><h2>${esc(r.name)}</h2><a class="cc-cat" href="${href({ r: '', q: '', c: r.cat, t: '' })}">${esc(cname(c))}</a></div>
        <p class="cc-by"><span>${esc(t.by(r.owner))} · ${esc(r.language || t.noLangLong)} · ${esc(lic)} · Fork ${r.forks.toLocaleString()}</span><span class="cc-st">★ ${r.stars.toLocaleString()}</span></p>
        <p class="cc-sum">${esc(sum)}</p>
        ${r.description && r.description !== sum ? `<p class="cc-desc">${esc(r.description)}</p>` : ''}
        <dl><dt>${t.subjects}</dt><dd>${tagLinks}</dd>
          <dt>${t.notes}</dt><dd>${t.lastUpdate(ago)} · ${t.created((r.created_at || '').slice(0, 4))}${r.homepage ? ` · <a href="${esc(r.homepage)}" target="_blank" rel="noopener">${t.homepage}</a>` : ''}</dd></dl>
        <div class="stamps"><span class="stamp" style="--c:${status[2]};--r:6deg">${status[0]}<br><b>${status[1]}</b></span><span class="stamp" style="--c:#b8443a;--r:-9deg">${t.starred}<br><b>${dot(r.starred_at).replaceAll('·', '.')}</b></span></div>
        <i class="hole"></i>
      </article>
      <div class="acts"><a class="btn2" href="${esc(r.url)}" target="_blank" rel="noopener">${t.openOnGitHub}</a><button type="button" class="lnk" data-copy="${esc(r.url)}">${t.copy}</button><a class="esc" href="${href({ r: '' })}">${backTo} <kbd>Esc</kbd></a></div>
      ${rel.length ? `<h3 class="rel">${relTitle}</h3>${cards(rel.slice(0, 3))}` : ''}`;
  }

  /* ---------- render ---------- */
  // When the tag tabs get a scrollbar that takes up room (not an overlay one), it stands in for the
  // guide strip's bottom padding. It comes and goes with the panel width and the fonts loading.
  // render() sets it straight away, so a new tab row never shows a frame with both the padding and
  // the bar; the observer catches later changes, one frame late so it doesn't resize what it watches.
  const fitBar = (g) => g.classList.toggle('has-bar', g.offsetHeight - g.clientHeight > 2);
  const tabBar = new ResizeObserver(([e]) => requestAnimationFrame(() => fitBar(e.target)));
  function render() {
    if (S.l !== SHOWN) chrome();
    const v = view();
    document.body.dataset.view = v;
    drawOverlay(v);
    const panel = $('#panel');
    panel.innerHTML = { home, drawer, search, inbox, card: detail }[v]();
    fitLid();
    panel.scrollTop = 0;
    const tray = panel.querySelector('.tray');
    if (tray) tray.scrollTop = 0;
    // tag tabs: bring the chosen one into view, and watch for the scrollbar (see tabBar)
    const g = panel.querySelector('.guides'), cur = g && g.querySelector('[aria-current]');
    if (cur) g.scrollLeft = cur.offsetLeft - (g.clientWidth - cur.offsetWidth) / 2;
    tabBar.disconnect();
    if (g) { fitBar(g); tabBar.observe(g, { box: 'border-box' }); }
    const c = v === 'drawer' || v === 'inbox' ? cname(D.cats[S.c]) : v === 'card' ? D.byName[S.r].name : v === 'search' ? T().searchKicker(S.q.trim()) : '';
    document.title = (c ? c + ' · ' : '') + T().docTitle(D.user);
  }

  function bind() {
    const cab = $('#cabinet');
    const activate = (el) => {
      const g = el.closest('[data-tag], [data-cat], [data-nav]');
      if (!g) return;
      if (g.dataset.nav === 'inbox') return go({ c: INBOX, t: '', s: '', q: '', r: '' });
      // a guide tab in the pulled drawer works like the tag tab in the panel; picking the lit one again goes back to All
      if (g.dataset.tag !== undefined) {
        const x = g.dataset.tag;
        if (view() === 'card') return go({ c: D.byName[S.r].cat, t: x, q: '', r: '' });
        return go({ t: x === S.t ? '' : x });
      }
      const id = g.dataset.cat;
      const isOpen = (view() === 'drawer' && S.c === id) || (view() === 'card' && D.byName[S.r].cat === id);
      go({ c: isOpen ? '' : id, t: '', s: '', q: '', r: '' });
    };
    cab.addEventListener('click', (e) => activate(e.target));
    cab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e.target); } });
    // a plain mouse wheel over the tag tabs scrolls them sideways (trackpads scroll sideways already)
    $('#panel').addEventListener('wheel', (e) => {
      const g = e.target.closest('.guides');
      if (!g || e.deltaX || g.scrollWidth <= g.clientWidth) return;
      const x = g.scrollLeft;
      g.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      if (g.scrollLeft !== x) e.preventDefault();
    }, { passive: false });

    const q = $('#q');
    q.addEventListener('input', () => go({ q: q.value, r: '' }, true));
    q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; go({ q: '' }, true); q.blur(); } });
    document.addEventListener('keydown', (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === '/') { e.preventDefault(); q.focus(); q.select(); }
      if (e.key === 'Escape') {
        if (S.r) go({ r: '' });
        else if (S.q) { q.value = ''; go({ q: '' }); }
        else if (S.c || S.t) go({ c: '', t: '', s: '' });
      }
    });
    document.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-copy]');
      if (!b) return;
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = T().copied; } catch { b.textContent = T().copyFailed; }
      setTimeout(() => { b.textContent = T().copy; }, 1600);
    });
    document.querySelectorAll('.lang [data-lang]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang !== S.l) setLang(b.dataset.lang); }));
    window.addEventListener('hashchange', () => { readHash(); render(); });
    phone.addEventListener('change', () => { drawCabinet(); render(); });
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--cab-h', cab.getBoundingClientRect().height + 'px');
      fitLid();
    }).observe(cab);
    // text gets wider or narrower as the self-hosted fonts arrive
    document.fonts?.addEventListener('loadingdone', fitLid);
  }

  // header and loading text in the right language before the data arrives
  S.l = hashLang();
  chrome();
  $('#panel .loading').textContent = T().loading;

  load().then(() => {
    readHash();
    bind();
    render();
  }).catch((err) => {
    $('#panel').innerHTML = `<div class="empty"><p>${esc(T().loadFail(err.message))}</p><p>${T().retry}</p></div>`;
  });
})();
