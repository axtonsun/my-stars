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
  const SORTS = { stars: 'Star', starred: '收藏时间', pushed: '最近更新' };
  const CN = '〇一二三四五六七八九';
  const NOW = Date.now();

  const $ = (s) => document.querySelector(s);
  const days = (iso) => (NOW - new Date(iso).getTime()) / 864e5;
  const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n));
  const dot = (iso) => (iso || '').slice(0, 10).replaceAll('-', '·');
  function ago(iso) {
    const d = days(iso);
    if (d < 1) return '今天';
    if (d < 30) return `${Math.floor(d)} 天前`;
    if (d < 365) return `${Math.floor(d / 30)} 个月前`;
    return `${Math.floor(d / 365)} 年前`;
  }
  const cnNum = (n) => (n < 10 ? CN[n] : n === 10 ? '十' : n < 20 ? '十' + CN[n - 10] : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : ''));
  function cnDate(iso) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)).split('-').map(Number);
    return `${[...String(p[0])].map((c) => CN[c]).join('')}年${cnNum(p[1])}月${cnNum(p[2])}日`;
  }

  let D = null;
  const S = { c: '', t: '', s: '', q: '', r: '' };

  /* ---------- data ---------- */
  async function load() {
    const get = (p) => fetch(p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
    const [stars, cls] = await Promise.all([get('data/stars.json'), get('data/classification.json')]);
    const order = cls.groups.flatMap((g) => g.cats).filter((id) => cls.categories[id]);
    for (const id of Object.keys(cls.categories)) if (!order.includes(id)) order.push(id);
    const cats = {};
    order.forEach((id, i) => {
      const c = cls.categories[id];
      cats[id] = { id, name: c.name, desc: c.desc || '', glyph: c.glyph || [...c.name].find((ch) => ch.charCodeAt(0) > 255) || c.name[0], color: COLOR[id] || SPARE[i % SPARE.length] };
    });
    cats[INBOX] = { id: INBOX, name: '待归档', desc: '还没放进抽屉的新卡片', glyph: '新', color: '#e9a99b' };
    const repos = stars.repos.map((r) => {
      const c = cls.repos[r.full_name];
      const cat = c && cats[c.cat] && c.cat !== INBOX ? c.cat : INBOX;
      const tags = c?.tags?.length ? c.tags : r.topics.slice(0, 4);
      const summary = c?.summary || r.description || '（没有简介）';
      const hay = [r.full_name, r.description, summary, tags.join(' '), r.topics.join(' '), r.language, cats[cat].name].join(' ').toLowerCase();
      const seen = [r.name, summary, tags.join(' ')].join(' ').toLowerCase();
      return { ...r, cat, tags, summary, hay, seen };
    });
    for (const id of Object.keys(cats)) {
      const list = repos.filter((r) => r.cat === id).sort((a, b) => b.stars - a.stars);
      list.forEach((r, k) => { r.no = `${cats[id].glyph}·${String(k + 1).padStart(2, '0')}`; });
      cats[id].count = list.length;
    }
    D = { user: stars.user, synced: stars.synced_at, repos, cats, order, byName: Object.fromEntries(repos.map((r) => [r.full_name, r])) };
  }
  const inCat = (id) => D.repos.filter((r) => r.cat === id);
  const terms = () => S.q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (r, t = terms()) => t.every((x) => r.hay.includes(x));

  /* ---------- url hash <-> state ---------- */
  function href(patch) {
    const st = { ...S, ...patch }, p = new URLSearchParams();
    for (const k of ['c', 't', 's', 'q', 'r']) if (st[k]) p.set(k, st[k]);
    const h = p.toString();
    return h ? '#' + h : '#';
  }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const k of Object.keys(S)) S[k] = p.get(k) || '';
    if (S.c && !D.cats[S.c]) S.c = '';
    if (S.r && !D.byName[S.r]) S.r = '';
    if (!SORTS[S.s]) S.s = '';
    const q = $('#q');
    if (document.activeElement !== q) q.value = S.q;
  }
  const go = (patch, replace) => {
    const h = href(patch);
    if (replace) history.replaceState(null, '', h === '#' ? location.pathname : h); else location.hash = h;
    if (replace) { readHash(); render(); }
  };
  const view = () => (S.r ? 'card' : S.q.trim() ? 'search' : S.c === INBOX ? 'inbox' : S.c ? 'drawer' : 'home');

  /* ---------- the cabinet ---------- */
  const phone = matchMedia('(max-width: 820px)');
  let CAB = null;
  function drawCabinet() {
    const cols = phone.matches ? 2 : 4;
    const drawers = D.order.map((id) => D.cats[id]);
    const { svg, L } = Draw.cabinet(drawers, cols);
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
      D.order.forEach((id, i) => { s += hits[id] ? Draw.flag(L, i, hits[id], id) : Draw.dim(L, i); });
    }
    const i = D.order.indexOf(open);
    if (i >= 0) s += Draw.pulled(L, i, D.cats[open], S.t ? 1 : -1);
    const waiting = D.cats[INBOX].count;
    if (waiting) s += Draw.note(L, waiting);
    $('#overlay').innerHTML = s;
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
    const hl = o.hl || esc, c = D.cats[r.cat], rot = ((hash(r.full_name) % 100) / 100 - 0.5).toFixed(2);
    return `<li style="--rot:${rot}deg"><a class="card" href="${href({ r: r.full_name })}">
      <span class="row1"><span class="no">${esc(r.no)}</span><span class="nm">${hl(r.name)}</span><span class="st">★ ${kfmt(r.stars)}</span>${o.chip ? `<span class="chip" style="--c:${c.color}">${esc(c.name.split(' & ')[0])}</span>` : ''}</span>
      <span class="sm">${hl(r.summary)}</span>
      <span class="ft">${hl(r.tags.join(' · '))}<i>${esc(r.owner)} · ${esc(r.language || '未标注')} · 收藏于 ${dot(r.starred_at)}</i></span>
      ${r.cat === INBOX ? '<span class="new">新</span>' : ''}
    </a></li>`;
  }
  const cards = (list, o) => `<ol class="cards">${list.map((r) => card(r, o)).join('')}</ol>`;
  const sortBy = (k) => ({
    stars: (a, b) => b.stars - a.stars,
    starred: (a, b) => (b.starred_at || '').localeCompare(a.starred_at || ''),
    pushed: (a, b) => (b.pushed_at || '').localeCompare(a.pushed_at || ''),
  }[k]);
  const back = (label) => `<a class="back" href="${href({ c: '', t: '', s: '', q: '', r: '' })}">← ${label}</a>`;
  const head = (kicker, title, aside = '') => `<header class="ph">${back('柜子')}<p class="kicker">${kicker}</p><div class="ph-row"><h2>${title}</h2>${aside}</div></header>`;

  function home() {
    const list = [...D.repos].sort(sortBy('starred')).slice(0, 12);
    return head('新到的卡片', '最近收进来的', '<span class="aside">点抽屉，拉开那一类</span>') + `<div class="tray">${cards(list, { chip: true })}</div>`;
  }

  function drawer() {
    const c = D.cats[S.c], all = inCat(S.c), sort = S.s || 'stars';
    const tc = {};
    all.forEach((r) => r.tags.forEach((t) => { tc[t] = (tc[t] || 0) + 1; }));
    let tabs = Object.entries(tc).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (S.t && !tabs.some(([t]) => t === S.t)) tabs.push([S.t, tc[S.t] || 0]);
    const list = all.filter((r) => !S.t || r.tags.includes(S.t)).sort(sortBy(sort));
    const sorter = `<span class="sort" role="group" aria-label="排序">${Object.entries(SORTS).map(([k, l]) => `<a href="${href({ s: k === 'stars' ? '' : k })}"${k === sort ? ' aria-current="true"' : ''}>${l}${k === sort ? ' ↓' : ''}</a>`).join('')}</span>`;
    const guide = `<nav class="guides" aria-label="按标签筛">${[['', all.length], ...tabs].map(([t, n]) => `<a href="${href({ t })}"${t === S.t ? ' aria-current="true"' : ''}>${esc(t || '全部')} <b>${n}</b></a>`).join('')}</nav>`;
    const note = S.t ? `<p class="hint">分隔卡「${esc(S.t)}」下有 ${list.length} 张；<a href="${href({ t: '' })}">点「全部」</a>看这个抽屉的 ${all.length} 张</p>` : '';
    return head('拉开的抽屉', esc(c.name), sorter) + `<p class="desc">${esc(c.desc)}</p><div class="tray">${guide}${cards(list)}</div>${note}`;
  }

  function search() {
    const res = D.repos.filter((r) => matches(r)), t = terms();
    const seen = (r) => (t.some((x) => r.seen.includes(x)) ? 1 : 0);
    res.sort((a, b) => seen(b) - seen(a) || b.stars - a.stars);
    const n = new Set(res.map((r) => r.cat)).size;
    const body = res.length ? cards(res, { chip: true, hl: highlighter() })
      : `<div class="empty"><p>没有找到「${esc(S.q.trim())}」。</p><p>仓库名、中文简介、英文简介、标签和编程语言都能搜，可以换个说法试试。</p></div>`;
    return head(`检索「${esc(S.q.trim())}」`, `${res.length} 张卡片`, res.length ? `<span class="aside">来自 ${n} 个抽屉<span class="wide">，小红旗标着每个抽屉里有几张</span></span>` : '') + `<div class="tray">${body}</div>`;
  }

  function inbox() {
    const list = inCat(INBOX).sort(sortBy('starred'));
    const intro = `<p class="desc">每天同步时，新 Star 的仓库会先放在这个筐里，先用 GitHub 自带的简介和标签；跟 Claude 说一句「更新分类」，它们就会被归进抽屉。筐里的卡片照样能被检索到。</p>`;
    return head('还没放进抽屉的新卡片', '待归档', `<span class="aside">${list.length} 张</span>`) + intro +
      `<div class="tray basket">${list.length ? cards(list) : '<div class="empty"><p>筐是空的，所有卡片都已归档。</p></div>'}</div>`;
  }

  function detail() {
    const r = D.byName[S.r], c = D.cats[r.cat];
    const lic = r.license && r.license !== 'NOASSERTION' ? r.license : '未注明许可';
    const d = days(r.pushed_at);
    const status = r.archived ? ['已归档', '不再维护', '#7b746b'] : d <= 31 ? ['仍在更新', `${ago(r.pushed_at)}有提交`, '#3f6fa8'] : d <= 365 ? ['一年内有更新', `${ago(r.pushed_at)}有提交`, '#3f6fa8'] : [`${Math.floor(d / 365)} 年没更新`, `最后 ${dot(r.pushed_at)}`, '#7b746b'];
    const shared = (x) => x.tags.filter((t) => r.tags.includes(t)).length;
    let rel = D.repos.filter((x) => x !== r && x.cat === r.cat && shared(x)).sort((a, b) => shared(b) - shared(a) || b.stars - a.stars);
    let relTitle = '同一个抽屉里，主题词相近的';
    if (!rel.length) { rel = D.repos.filter((x) => x !== r && shared(x)).sort((a, b) => shared(b) - shared(a) || b.stars - a.stars); relTitle = '别的抽屉里，主题词相近的'; }
    const backTo = S.q ? '回到检索结果' : S.c ? '放回抽屉' : '放回去';
    const tagLinks = r.tags.map((t) => r.cat === INBOX ? esc(t) : `<a href="${href({ r: '', q: '', c: r.cat, t })}">${esc(t)}</a>`).join(' · ') || '—';
    return `<header class="ph">${back('柜子')}</header>
      <article class="catcard" style="--rot:-1.1deg">
        <div class="cc-top"><div class="cc-no"><small>索书号</small><b>${esc(r.no)}</b></div><h2>${esc(r.name)}</h2><a class="cc-cat" href="${href({ r: '', q: '', c: r.cat, t: '' })}">${esc(c.name)}</a></div>
        <p class="cc-by"><span>${esc(r.owner)} 著 · ${esc(r.language || '未标注语言')} · ${esc(lic)} · Fork ${r.forks.toLocaleString()}</span><span class="cc-st">★ ${r.stars.toLocaleString()}</span></p>
        <p class="cc-sum">${esc(r.summary)}</p>
        ${r.description && r.description !== r.summary ? `<p class="cc-desc">${esc(r.description)}</p>` : ''}
        <dl><dt>主题词</dt><dd>${tagLinks}</dd>
          <dt>附　注</dt><dd>最近一次更新：${ago(r.pushed_at)} · 建于 ${(r.created_at || '').slice(0, 4)} 年${r.homepage ? ` · <a href="${esc(r.homepage)}" target="_blank" rel="noopener">主页</a>` : ''}</dd></dl>
        <div class="stamps"><span class="stamp" style="--c:${status[2]};--r:6deg">${status[0]}<br><b>${status[1]}</b></span><span class="stamp" style="--c:#b8443a;--r:-9deg">收　藏<br><b>${dot(r.starred_at).replaceAll('·', '.')}</b></span></div>
        <i class="hole"></i>
      </article>
      <div class="acts"><a class="btn2" href="${esc(r.url)}" target="_blank" rel="noopener">在 GitHub 打开 →</a><button type="button" class="lnk" data-copy="${esc(r.url)}">复制链接</button><a class="esc" href="${href({ r: '' })}">${backTo} <kbd>Esc</kbd></a></div>
      ${rel.length ? `<h3 class="rel">${relTitle}</h3>${cards(rel.slice(0, 3))}` : ''}`;
  }

  /* ---------- render ---------- */
  function render() {
    const v = view();
    document.body.dataset.view = v;
    drawOverlay(v);
    const panel = $('#panel');
    panel.innerHTML = { home, drawer, search, inbox, card: detail }[v]();
    panel.scrollTop = 0;
    const tray = panel.querySelector('.tray');
    if (tray) tray.scrollTop = 0;
    const c = v === 'drawer' || v === 'inbox' ? D.cats[S.c].name : v === 'card' ? D.byName[S.r].name : v === 'search' ? `检索「${S.q.trim()}」` : '';
    document.title = (c ? c + ' · ' : '') + `目录柜 · ${D.user} 的 GitHub Stars`;
  }

  function bind() {
    const cab = $('#cabinet');
    const activate = (el) => {
      const g = el.closest('[data-cat], [data-nav]');
      if (!g) return;
      if (g.dataset.nav === 'inbox') return go({ c: INBOX, t: '', s: '', q: '', r: '' });
      const id = g.dataset.cat;
      const isOpen = (view() === 'drawer' && S.c === id) || (view() === 'card' && D.byName[S.r].cat === id);
      go({ c: isOpen ? '' : id, t: '', s: '', q: '', r: '' });
    };
    cab.addEventListener('click', (e) => activate(e.target));
    cab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e.target); } });

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
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = '已复制'; } catch { b.textContent = '复制失败'; }
      setTimeout(() => { b.textContent = '复制链接'; }, 1600);
    });
    window.addEventListener('hashchange', () => { readHash(); render(); });
    phone.addEventListener('change', () => { drawCabinet(); render(); });
    new ResizeObserver(() => document.documentElement.style.setProperty('--cab-h', cab.getBoundingClientRect().height + 'px')).observe(cab);
  }

  load().then(() => {
    const n = D.order.length, total = D.repos.length;
    $('#sub').textContent = `${n} 个抽屉，${total} 张卡片；一个抽屉一个分类，抽屉里一个仓库一张卡片`;
    $('#foot').innerHTML = `${n} 个抽屉 · ${total} 张卡片 · ${cnDate(D.synced)}校对 · 每天自动同步 · <a href="https://github.com/${esc(D.user)}?tab=stars" target="_blank" rel="noopener">在 GitHub 上看全部 Star</a>`;
    drawCabinet();
    readHash();
    bind();
    render();
  }).catch((err) => {
    $('#panel').innerHTML = `<div class="empty"><p>卡片没有加载出来：${esc(err.message)}</p><p>刷新一下试试。</p></div>`;
  });
})();
