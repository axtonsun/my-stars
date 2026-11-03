'use strict';
(() => {
  const INBOX = 'inbox';
  const LANG_COLORS = {
    Python: '#3572A5', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', TypeScript: '#3178c6',
    JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#563d7c', SCSS: '#c6538c', Go: '#00ADD8',
    Rust: '#dea584', 'Jupyter Notebook': '#DA5B0B', Shell: '#89e051', TeX: '#3D6117', Java: '#b07219',
    'Objective-C': '#438eff', Markdown: '#083fa1', PostScript: '#da291c', Batchfile: '#C1F12E',
    Swift: '#F05138', Kotlin: '#A97BFF', Ruby: '#701516', PHP: '#4F5D95', Vue: '#41b883',
    Dart: '#00B4AB', Lua: '#000080', Dockerfile: '#384d54', Svelte: '#ff3e00', Zig: '#ec915c',
  };
  const SORTS = {
    starred: ['最近收藏', (a, b) => (b.starred_at || '').localeCompare(a.starred_at || '')],
    stars: ['Star 最多', (a, b) => b.stars - a.stars],
    pushed: ['最近更新', (a, b) => (b.pushed_at || '').localeCompare(a.pushed_at || '')],
    name: ['名称 A–Z', (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })],
  };

  // view: 'home' (overview) | 'all' | 'cat'
  const state = { view: 'home', cat: '', q: '', tag: '', lang: '', sort: 'starred' };
  let D = null;

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n));
  const day = (iso) => (iso ? iso.slice(0, 10) : '');
  const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 864e5;
  function ago(iso) {
    if (!iso) return '';
    const d = daysSince(iso);
    if (d < 1) return '今天';
    if (d < 30) return `${Math.floor(d)} 天前`;
    if (d < 365) return `${Math.floor(d / 30)} 个月前`;
    return `${Math.floor(d / 365)} 年前`;
  }

  /* ---------- data ---------- */
  async function load() {
    const get = (p) => fetch(p, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
      return r.json();
    });
    const [stars, cls] = await Promise.all([get('data/stars.json'), get('data/classification.json')]);
    const cats = {
      ...cls.categories,
      [INBOX]: { icon: '🆕', name: '新收藏 · 待分类', desc: '最近新 Star、还没整理的仓库，暂时用 GitHub topics 当标签' },
    };
    const repos = stars.repos.map((r) => {
      const c = cls.repos[r.full_name] || {};
      const cat = c.cat && c.cat !== INBOX && cats[c.cat] ? c.cat : INBOX;
      const tags = c.tags && c.tags.length ? c.tags : r.topics.slice(0, 4);
      const summary = c.summary || '';
      const search = [r.full_name, r.description, summary, tags.join(' '), r.topics.join(' '), r.language, cats[cat].name]
        .join(' ').toLowerCase();
      return { ...r, cat, tags, summary, search };
    });
    D = { user: stars.user, synced: stars.synced_at, repos, cats, groups: cls.groups };
  }

  const terms = () => state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const filtering = () => Boolean(state.q.trim() || state.tag || state.lang);
  function filterRepos({ ignoreCat = false, ignoreLang = false } = {}) {
    const t = terms();
    return D.repos.filter((r) =>
      t.every((x) => r.search.includes(x)) &&
      (!state.tag || r.tags.includes(state.tag)) &&
      (ignoreLang || !state.lang || r.language === state.lang) &&
      (ignoreCat || state.view !== 'cat' || r.cat === state.cat));
  }
  function highlighter() {
    const t = terms();
    if (!t.length) return esc;
    const re = new RegExp(t.map(escRe).join('|'), 'gi');
    return (text) => {
      text = String(text ?? '');
      let out = '';
      let last = 0;
      for (const m of text.matchAll(re)) {
        if (!m[0]) continue;
        out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
        last = m.index + m[0].length;
      }
      return out + esc(text.slice(last));
    };
  }

  /* ---------- url hash <-> state ---------- */
  function writeHash(push) {
    const p = new URLSearchParams();
    if (state.view === 'all') p.set('c', 'all');
    if (state.view === 'cat') p.set('c', state.cat);
    if (state.q) p.set('q', state.q);
    if (state.tag) p.set('t', state.tag);
    if (state.lang) p.set('l', state.lang);
    if (state.sort !== 'starred') p.set('s', state.sort);
    const hash = p.toString() ? '#' + p.toString() : location.pathname + location.search;
    if (push) history.pushState(null, '', hash);
    else history.replaceState(null, '', hash);
  }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const c = p.get('c') || '';
    state.q = p.get('q') || '';
    state.tag = p.get('t') || '';
    state.lang = p.get('l') || '';
    state.sort = SORTS[p.get('s')] ? p.get('s') : 'starred';
    if (D.cats[c]) { state.view = 'cat'; state.cat = c; }
    else if (c === 'all' || filtering()) { state.view = 'all'; state.cat = ''; }
    else { state.view = 'home'; state.cat = ''; }
    $('#q').value = state.q;
  }

  /* ---------- rendering ---------- */
  function renderNav() {
    const pool = filterRepos({ ignoreCat: true });
    const n = {};
    pool.forEach((r) => { n[r.cat] = (n[r.cat] || 0) + 1; });
    const f = filtering();
    const item = (nav, icon, label, count, active) =>
      `<button class="nav-item${active ? ' active' : ''}${f && count === 0 ? ' empty' : ''}" data-nav="${esc(nav)}">` +
      `<span class="ico">${icon}</span><span class="lbl">${esc(label)}</span>` +
      (count == null ? '' : `<span class="n">${count}</span>`) + '</button>';
    const catItem = (id) => item('cat:' + id, D.cats[id].icon, D.cats[id].name, n[id] || 0, state.view === 'cat' && state.cat === id);

    let h = item('home', '🏠', '概览', null, state.view === 'home');
    h += item('all', '⭐', '全部仓库', pool.length, state.view === 'all');
    if (D.repos.some((r) => r.cat === INBOX)) h += catItem(INBOX);
    for (const g of D.groups) {
      h += `<div class="nav-group">${esc(g.name)}</div>` + g.cats.filter((id) => D.cats[id]).map(catItem).join('');
    }
    const nav = $('#nav');
    nav.innerHTML = h;
    if (matchMedia('(max-width: 820px)').matches) {
      const a = nav.querySelector('.active');
      if (a) nav.scrollLeft = a.offsetLeft - 16;
    }
  }

  function tile(id) {
    const c = D.cats[id];
    const list = D.repos.filter((r) => r.cat === id).sort(SORTS.stars[1]);
    return `<button class="tile" data-nav="cat:${esc(id)}">
      <span class="tile-top"><span class="ico">${c.icon}</span><span class="n">${list.length} 个</span></span>
      <h3>${esc(c.name)}</h3><p>${esc(c.desc || '')}</p>
      <span class="peek">${list.slice(0, 3).map((r) => `<span>${esc(r.name)}</span>`).join('')}</span>
    </button>`;
  }
  function mini(r) {
    const c = D.cats[r.cat];
    return `<a class="mini" href="${esc(r.url)}" target="_blank" rel="noopener">
      <span class="mini-name">${esc(r.full_name)}</span>
      <span class="mini-sum">${esc(r.summary || r.description || '（没有简介）')}</span>
      <span class="mini-meta">${c.icon} ${esc(c.name)} · ${day(r.starred_at)} 收藏</span>
    </a>`;
  }
  function renderHome() {
    const recent = [...D.repos].sort(SORTS.starred[1]).slice(0, 8);
    const inbox = D.repos.filter((r) => r.cat === INBOX).length;
    let h = '';
    if (inbox) {
      h += `<div class="callout"><span>🆕 有 ${inbox} 个新收藏还没分类</span><button class="btn" data-nav="cat:${INBOX}">去看看</button></div>`;
    }
    h += `<section class="home-sec"><h2>最近收藏</h2><div class="recent">${recent.map(mini).join('')}</div></section>`;
    for (const g of D.groups) {
      const ids = g.cats.filter((id) => D.cats[id]);
      h += `<section class="home-sec"><h2>${esc(g.name)}</h2><div class="tiles">${ids.map(tile).join('')}</div></section>`;
    }
    return h;
  }

  function card(r, hl) {
    const c = D.cats[r.cat];
    const badges = [];
    if (r.archived) badges.push('<span class="badge" title="作者已归档，不再维护">已归档</span>');
    else if (r.pushed_at && daysSince(r.pushed_at) > 730) {
      badges.push(`<span class="badge" title="最后提交：${day(r.pushed_at)}">${Math.floor(daysSince(r.pushed_at) / 365)} 年未更新</span>`);
    }
    const showDesc = r.description && r.description !== r.summary;
    const color = LANG_COLORS[r.language] || 'var(--faint)';
    return `<article class="card">
      <div class="card-top">
        <a class="name" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="owner">${hl(r.owner)}/</span><b>${hl(r.name)}</b></a>
        ${badges.length ? `<span class="badges">${badges.join('')}</span>` : ''}
      </div>
      ${r.summary ? `<p class="summary">${hl(r.summary)}</p>` : ''}
      ${showDesc ? `<p class="desc" title="${esc(r.description)}">${hl(r.description)}</p>` : ''}
      ${r.tags.length ? `<div class="tags">${r.tags.map((t) => `<button class="tag${t === state.tag ? ' on' : ''}" data-tag="${esc(t)}">${hl(t)}</button>`).join('')}</div>` : ''}
      <div class="foot">
        ${r.language ? `<span class="lang"><i class="dot" style="background:${color}"></i>${esc(r.language)}</span>` : ''}
        <span title="${r.stars.toLocaleString()} stars">★ ${kfmt(r.stars)}</span>
        ${r.pushed_at ? `<span title="最后提交：${day(r.pushed_at)}">${ago(r.pushed_at)}更新</span>` : ''}
        ${r.starred_at ? `<span title="你 Star 它的时间">${day(r.starred_at)} 收藏</span>` : ''}
        ${state.view !== 'cat' ? `<button class="catlink" data-nav="cat:${esc(r.cat)}">${c.icon} ${esc(c.name)}</button>` : ''}
      </div>
    </article>`;
  }

  function renderList() {
    const list = filterRepos().sort(SORTS[state.sort][1]);
    let title;
    let desc = '';
    if (state.view === 'cat') {
      const c = D.cats[state.cat];
      title = `${c.icon} ${esc(c.name)}`;
      desc = c.desc || '';
    } else {
      title = state.q.trim() ? `搜索「${esc(state.q.trim())}」` : '⭐ 全部仓库';
    }

    const chips = [];
    if (state.tag) chips.push(`<button class="chip" data-clear="tag" title="去掉这个筛选">标签：${esc(state.tag)} <b>✕</b></button>`);
    if (state.lang) chips.push(`<button class="chip" data-clear="lang" title="去掉这个筛选">语言：${esc(state.lang)} <b>✕</b></button>`);

    const langCount = {};
    filterRepos({ ignoreLang: true }).forEach((r) => { if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1; });
    if (state.lang && !langCount[state.lang]) langCount[state.lang] = 0;
    const langs = Object.entries(langCount).sort((a, b) => b[1] - a[1]);

    let body;
    if (list.length) {
      const hl = highlighter();
      body = `<div class="grid">${list.map((r) => card(r, hl)).join('')}</div>`;
    } else {
      const elsewhere = state.view === 'cat' ? filterRepos({ ignoreCat: true }).length : 0;
      body = `<div class="empty-state">
        <p>${elsewhere ? `这个分类里没有匹配的仓库，其他分类里有 ${elsewhere} 个。` : '没有找到匹配的仓库。'}</p>
        ${elsewhere ? '<button class="btn" data-nav="all">在全部仓库里看</button>' : '<button class="btn" data-clear="all">清除搜索和筛选</button>'}
      </div>`;
    }

    return `<div class="list-head"><h2>${title}</h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div>
      <div class="toolbar">
        <div class="info"><span>共 ${list.length} 个</span>${chips.join('')}</div>
        <div class="controls">
          <select id="lang" aria-label="按语言筛选">
            <option value="">所有语言</option>
            ${langs.map(([l, k]) => `<option value="${esc(l)}"${l === state.lang ? ' selected' : ''}>${esc(l)}（${k}）</option>`).join('')}
          </select>
          <select id="sort" aria-label="排序">
            ${Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}"${k === state.sort ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
      ${body}`;
  }

  function render() {
    renderNav();
    const main = $('#main');
    const syncedAt = new Date(D.synced).toLocaleString('zh-CN', { hour12: false });
    main.innerHTML = (state.view === 'home' ? renderHome() : renderList()) +
      `<footer class="site-foot">共 ${D.repos.length} 个仓库 · 每天自动从 GitHub 同步，最近一次：${esc(syncedAt)} · ` +
      `<a href="https://github.com/${esc(D.user)}?tab=stars" target="_blank" rel="noopener">在 GitHub 上查看</a></footer>`;
  }

  /* ---------- interactions ---------- */
  function go(nav) {
    if (nav === 'home') {
      Object.assign(state, { view: 'home', cat: '', q: '', tag: '', lang: '' });
      $('#q').value = '';
    } else if (nav === 'all') {
      Object.assign(state, { view: 'all', cat: '' });
    } else if (nav.startsWith('cat:') && D.cats[nav.slice(4)]) {
      Object.assign(state, { view: 'cat', cat: nav.slice(4) });
    }
    writeHash(true);
    render();
    window.scrollTo(0, 0);
  }

  function bind() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { e.preventDefault(); go(nav.dataset.nav); return; }
      const tag = e.target.closest('[data-tag]');
      if (tag) {
        state.tag = state.tag === tag.dataset.tag ? '' : tag.dataset.tag;
        if (state.view === 'home') state.view = 'all';
        writeHash(true);
        render();
        return;
      }
      const clr = e.target.closest('[data-clear]');
      if (clr) {
        const k = clr.dataset.clear;
        if (k === 'all') { state.q = ''; state.tag = ''; state.lang = ''; $('#q').value = ''; } else state[k] = '';
        writeHash(true);
        render();
      }
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'lang') state.lang = e.target.value;
      else if (e.target.id === 'sort') state.sort = e.target.value;
      else return;
      writeHash(false);
      render();
    });
    const q = $('#q');
    q.addEventListener('input', () => {
      // A new search starts global; the sidebar then shows matches per category,
      // and clicking one narrows the results down.
      if (!state.q.trim() && q.value.trim() && state.view !== 'all') Object.assign(state, { view: 'all', cat: '' });
      state.q = q.value;
      writeHash(false);
      render();
    });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { q.value = ''; q.dispatchEvent(new Event('input')); q.blur(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        q.focus();
        q.select();
      }
    });
    window.addEventListener('popstate', () => { readHash(); render(); });
  }

  load().then(() => {
    const name = `${D.user} 的 GitHub Stars`;
    document.title = name;
    $('#title').textContent = name;
    $('#meta').textContent = `${D.repos.length} 个仓库 · ${Object.keys(D.cats).length - 1} 个分类`;
    readHash();
    bind();
    render();
  }).catch((err) => {
    $('#meta').textContent = '加载失败';
    $('#main').innerHTML = `<div class="empty-state"><p>数据加载失败：${esc(err.message)}</p></div>`;
  });
})();
