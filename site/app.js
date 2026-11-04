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
  // a drawer's guide cards, as [tag, count]: every tag at least two of its cards share, most used first, plus the one
  // being filtered on. Languages are never guide cards: tags don't name them (see CLAUDE.md).
  function guides(id) {
    const tc = {};
    inCat(id).forEach((r) => r.tags.forEach((x) => { tc[x] = (tc[x] || 0) + 1; }));
    const tabs = Object.entries(tc).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
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
    $('#skip').textContent = t.skip;
    document.querySelectorAll('.lang [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === S.l)));
    if (!D) {
      $('#sub').textContent = t.tagline;
      document.title = t.docTitle('');
      return;
    }
    const n = D.order.length, total = D.repos.length;
    $('#sub').textContent = t.sub(n, total);
    $('#foot').innerHTML = `${esc(t.foot(t.date(D.synced)))} · <a href="https://github.com/${esc(D.user)}?tab=stars" target="_blank" rel="noopener">${esc(t.allOnGitHub)}</a>`;
    drawCabinet();
    SHOWN = S.l;
  }

  /* ---------- the cabinet ---------- */
  const phone = matchMedia('(max-width: 820px)');
  let CAB = null;
  const drawerOf = (id) => { const c = D.cats[id], name = cname(c); return { ...c, name, label: T().drawer(name, c.count), closeLabel: T().close(name) }; };
  function drawCabinet() {
    const cols = phone.matches ? 2 : 4;
    const { svg, floor, L } = Draw.cabinet(D.order.map(drawerOf), cols, T().lift);
    const el = $('#cabinet');
    for (const e of [el, $('#floor')]) e.setAttribute('viewBox', `0 0 ${L.vw} ${L.vh}`);
    $('#floor').innerHTML = floor;
    el.innerHTML = svg + '<g id="overlay"></g>';
    CAB = { L, cols };
  }
  function drawOverlay(v) {
    const L = CAB.L, open = openId(v);
    // the open drawer comes out, to where it was let go of after a drag or else all the way; every other one goes back in
    if (LEFT.id !== open) LEFT = { id: '', p: 1 };
    if (open && !OUT.has(open)) OUT.set(open, { p: 0 });
    for (const [id] of OUT) if (DRAG?.id !== id) slide(id, id !== open ? 0 : LEFT.id === id ? LEFT.p : 1);
    tidy();
    document.querySelectorAll('#cabinet > .drawer').forEach((g) => g.classList.toggle('is-open', OUT.has(g.dataset.cat)));
    let s = '';
    if (v === 'search') {
      const hits = {};
      D.repos.filter((r) => matches(r)).forEach((r) => { hits[r.cat] = (hits[r.cat] || 0) + 1; });
      D.order.forEach((id, i) => { s += hits[id] ? Draw.flag(L, i, T().flag(hits[id]), id) : Draw.dim(L, i); });
    }
    // the lower drawers first, so one coming out of the row above lies over them
    const ids = [...OUT.keys()].sort((a, b) => D.order.indexOf(b) - D.order.indexOf(a));
    for (const id of ids) {
      const tabs = guides(id).map(([x, n]) => ({ tag: x, label: T().guideCard(tag(x), n) }));
      s += Draw.pulled(L, D.order.indexOf(id), drawerOf(id), tabs, S.t && S.c === id ? tabs.findIndex((g) => g.tag === S.t) : -1, OUT.get(id).p);
    }
    const waiting = D.cats[INBOX].count;
    if (waiting) s += Draw.note(L, T().note(waiting));
    // a guide tab picked from the keyboard keeps the focus when the overlay is redrawn
    const a = document.activeElement, keep = a?.matches?.('#overlay .gtab:focus-visible') ? a.dataset.tag : null;
    $('#overlay').innerHTML = s;
    for (const g of document.querySelectorAll('#overlay [data-out]')) OUT.get(g.dataset.out).el = g;
    if (keep !== null) [...document.querySelectorAll('#overlay .gtab')].find((g) => g.dataset.tag === keep)?.focus();
  }

  /* ---------- drawers coming out and going back ---------- */
  // Every drawer drawn pulled out, by id: how far out it is (p: 0 shut … 1 all the way), the slide it is on if any, and
  // its element in the overlay. A drawer opened by a click slides all the way out; one dragged by its handle follows the
  // pointer (DRAG) and stays where it is let go (LEFT). A drawer that is not open slides back in and is dropped once shut.
  const OUT = new Map();
  let LEFT = { id: '', p: 1 }, DRAG = null, RAF = 0, SWALLOW = false;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const easeOut = (k) => 1 - (1 - k) ** 3, easeIn = (k) => k * k;
  // let go less than this far out, a drawer goes back in; moving faster than FLICK px/ms, it goes all the way out or in
  const LEAST = 0.25, FLICK = 0.4;
  const openId = (v = view()) => { const id = v === 'card' ? D.byName[S.r].cat : v === 'drawer' ? S.c : ''; return D.order.includes(id) ? id : ''; };
  const place = (id, o) => { if (o.el?.isConnected) Draw.setPull(o.el, CAB.L, D.order.indexOf(id), o.p); };
  // slide a drawer to `to`: out easing off like a drawer on runners, in gathering speed as if pushed shut
  function slide(id, to, ease) {
    const o = OUT.get(id);
    if (o.to === to) return;
    if (still.matches) { Object.assign(o, { p: to, to, t0: null }); place(id, o); return; }
    ease ||= to > o.p ? easeOut : easeIn;
    Object.assign(o, { from: o.p, to, ease, t0: performance.now(), dur: (to > o.p ? 300 : 240) * Math.abs(to - o.p) + 60 });
    RAF ||= requestAnimationFrame(step);
  }
  function step(now) {
    RAF = 0;
    for (const [id, o] of OUT) {
      if (o.t0 == null) continue;
      const k = Math.min(1, Math.max(0, (now - o.t0) / o.dur));
      o.p = o.from + (o.to - o.from) * o.ease(k);
      if (k < 1) RAF ||= requestAnimationFrame(step); else o.t0 = null;
      place(id, o);
    }
    tidy();
  }
  // drop the drawers that have finished going back in, and show the closed ones in the cabinet again
  function tidy() {
    const open = openId();
    for (const [id, o] of OUT) {
      if (o.p > 0 || o.t0 != null || id === open || DRAG?.id === id) continue;
      OUT.delete(id);
      o.el?.remove();
      [...document.querySelectorAll('#cabinet > .drawer')].find((g) => g.dataset.cat === id)?.classList.remove('is-open');
    }
  }
  function grab(e) {
    const g = e.target.closest('.grip');
    if (!g || !e.isPrimary || e.button || DRAG?.moved) return;
    e.preventDefault(); // no text selection while dragging
    DRAG = { id: g.closest('[data-cat]').dataset.cat, pid: e.pointerId, y0: e.clientY, moved: false, track: [] };
  }
  function drag(e) {
    const d = DRAG;
    if (!d || e.pointerId !== d.pid) return;
    const cab = $('#cabinet');
    // it only becomes a drag once the pointer has moved a little up or down; until then it is a click
    if (!d.moved) {
      if (Math.abs(e.clientY - d.y0) < 4) return;
      d.moved = true;
      try { cab.setPointerCapture(e.pointerId); } catch {}
      document.body.classList.add('dragging');
      if (!OUT.has(d.id)) { OUT.set(d.id, { p: 0 }); drawOverlay(view()); }
      const o = OUT.get(d.id);
      Object.assign(o, { t0: null, to: null });
      d.p0 = o.p;
      d.per = 1 / (Draw.reach(CAB.L) * cab.getScreenCTM().d);
    }
    const o = OUT.get(d.id);
    o.p = Math.min(1, Math.max(0, d.p0 + (e.clientY - d.y0) * d.per));
    place(d.id, o);
    d.track.push([e.timeStamp, e.clientY]);
  }
  function release(e) {
    const d = DRAG;
    if (!d || e.pointerId !== d.pid) return;
    DRAG = null;
    if (!d.moved) return; // a click: the click handler opens or closes the drawer
    document.body.classList.remove('dragging');
    SWALLOW = true;
    setTimeout(() => { SWALLOW = false; });
    // its speed over its last 80 ms of moving, in px/ms, down positive; none if it was held still before being let go
    const n = d.track.length, [t1, y1] = d.track[n - 1], [t0, y0] = d.track[Math.max(0, Math.min(n - 2, d.track.findIndex(([t]) => t1 - t <= 80)))];
    const v = e.type === 'pointerup' && e.timeStamp - t1 < 50 && t1 > t0 ? (y1 - y0) / (t1 - t0) : 0;
    const o = OUT.get(d.id);
    let to = v > FLICK ? 1 : v < -FLICK ? 0 : o.p;
    if (to < LEAST) to = 0;
    const wasOpen = d.id === openId();
    LEFT = to ? { id: d.id, p: to } : { id: '', p: 1 };
    slide(d.id, to, easeOut);
    if (to && !wasOpen) go({ c: d.id, t: '', s: '', q: '', r: '' });
    else if (!to && wasOpen) go({ c: '', t: '', s: '', q: '', r: '' });
  }

  /* ---------- lifting the cabinet by a foot ---------- */
  // Grab a foot and pull it in towards the middle (the left one to the right, the right one to the left): that side of the
  // cabinet comes up, tipping over the other foot, and once it is well up the drawers knock over to the low side of their
  // slots. Let go and it falls, bounces once, and every drawer rattles in its slot, the ones furthest from the foot it
  // tipped over the most. To keep it smooth, things only move by CSS transforms, the cabinet keeps a compositing layer
  // of its own (style.css), the shadows are in their own <svg> under it, the cabinet follows the pointer once a frame
  // through a spring, the fall and the rattling are worked out when it is let go and played as Web Animations, and the
  // pencil textures are pictures (see bake()), so the browser drawing the cabinet again as it turns is quick. In cabinet
  // units and milliseconds; none of it goes in the URL.
  // TIP: which foot is up (side), how high (h), how fast it is going up (v), and whether the drawers have knocked over
  // (slid). HOLD: the pointer on it, and how high the pointer is pulling it (want).
  const TIP = { side: 'l', h: 0, v: 0, slid: false };
  let HOLD = null, FOLLOW = 0;
  // HEAVY: how far a foot is pulled to lift it most of the way (× its highest); CATCH: how quickly a held cabinet catches
  // up with the pointer (per ms); BOUNCE: the share of its speed it keeps off the floor; RATTLE: how long the drawers
  // rattle after each time it hits the floor
  const HEAVY = 1.8, CATCH = 0.04, BOUNCE = 0.3, RATTLE = 1300;
  // each drawer rattles its own way: how far it slides (k), how fast it hops, shifts and turns, which way, and how late
  const QUIRK = new Map();
  function quirk(id) {
    if (!QUIRK.has(id)) {
      const r = Draw.rng(hash('rattle:' + id));
      QUIRK.set(id, { k: 0.6 + 0.4 * r(), hop: 80 + 40 * r(), shift: 100 + 40 * r(), turn: 120 + 50 * r(), sx: r() < 0.5 ? -1 : 1, sr: r() < 0.5 ? -1 : 1, lag: 25 * r() });
    }
    return QUIRK.get(id);
  }
  // what tips: the cabinet, and the raised foot's shadow on the floor
  const tipping = () => ({ cab: $('#cabinet'), shadow: $('#floor .fs-' + TIP.side) });
  // the cabinet shown `h` up, or standing (h = 0)
  function show(h) {
    const els = tipping(), st = Draw.tipped(CAB.L, TIP.side, h);
    for (const k in els) for (const p in st[k]) els[k].style[p] = h ? st[k][p] : '';
  }
  // Stop every drawer where it is, all read first and then all stopped, so the page works out its styles once:
  // [element, place in the cabinet, its transform at that moment, how far it is off to the side].
  function halt() {
    const ds = [...$('#cabinet').querySelectorAll(':scope > .drawer, #overlay > [data-out]')].map((g) => {
      const now = getComputedStyle(g).transform;
      return [g, D.order.indexOf(g.dataset.cat || g.dataset.out), now, new DOMMatrix(now === 'none' ? undefined : now).e];
    });
    for (const [g] of ds) g.getAnimations().forEach((a) => a.cancel());
    return ds;
  }
  // the drawers knock over to the low side of their slots (dir 1 right, -1 left), or slide back to the middle (0)
  function knock(dir) {
    const z = CAB.L.dh / 160, to = (x) => Draw.shaken(x, 0, 0);
    for (const [g, i, from, x0] of halt()) {
      const x1 = 2 * z * quirk(D.order[i]).k * dir;
      g.animate([{ transform: from, easing: 'ease-in' }, { transform: to(x1), offset: 0.6, easing: 'ease-out' }, { transform: to(x1 - 0.25 * (x1 - x0)), offset: 0.8, easing: 'ease-in' }, { transform: to(x1) }], { duration: 240, fill: 'forwards' });
    }
  }
  function grabFoot(e) {
    const g = e.target.closest('.leg');
    if (!g || !e.isPrimary || e.button || DRAG || HOLD) return;
    const cab = $('#cabinet'), falling = cab.getAnimations().length > 0, side = g.dataset.side;
    // the other foot can't be grabbed while this one is up; this one can be caught on its way down, and held from there
    if (falling && side !== TIP.side) return;
    e.preventDefault();
    const top = Draw.rise(CAB.L);
    let h = 0;
    if (falling) { const m = new DOMMatrix(getComputedStyle(cab).transform); h = Math.min(top * 0.99, Math.abs(m.b / m.a) * (CAB.L.W - 20)); }
    for (const el of Object.values(tipping())) el.getAnimations().forEach((a) => a.cancel());
    Object.assign(TIP, { side, h, v: 0 });
    const els = tipping(), at = Draw.pivots(CAB.L, side);
    for (const k in els) els[k].style.transformOrigin = at[k];
    show(h);
    HOLD = { pid: e.pointerId, x0: e.clientX, d0: -top * HEAVY * Math.log(1 - h / top), want: h, moved: false };
  }
  function pullFoot(e) {
    const d = HOLD;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x0) < 3) return;
      d.moved = true;
      try { $('#cabinet').setPointerCapture(e.pointerId); } catch {}
      document.body.classList.add('dragging');
      d.per = 1 / $('#cabinet').getScreenCTM().a;
    }
    // the further it is pulled in, the harder it gets: it never goes past rise()
    const top = Draw.rise(CAB.L), pulled = Math.max(0, d.d0 + (e.clientX - d.x0) * (TIP.side === 'l' ? 1 : -1) * d.per);
    d.want = top * (1 - Math.exp(-pulled / (top * HEAVY)));
    FOLLOW ||= requestAnimationFrame(follow);
  }
  // One frame of a held cabinet catching up with the pointer, once per frame however often the pointer moves: a spring
  // that doesn't overshoot, worked out exactly so a long frame can't throw it.
  function follow(now) {
    FOLLOW = 0;
    const d = HOLD;
    if (!d) return;
    const dt = Math.min(64, now - (d.t ?? now - 16)), x = TIP.h - d.want, c = TIP.v + CATCH * x, k = Math.exp(-CATCH * dt);
    d.t = now;
    TIP.h = Math.max(0, d.want + (x + c * dt) * k);
    TIP.v = (TIP.v - CATCH * c * dt) * k;
    show(TIP.h);
    if (!still.matches) {
      const top = Draw.rise(CAB.L);
      if (!TIP.slid && TIP.h > top * 0.3) { TIP.slid = true; knock(TIP.side === 'l' ? 1 : -1); }
      else if (TIP.slid && TIP.h < top * 0.1) { TIP.slid = false; knock(0); }
    }
    if (Math.abs(TIP.h - d.want) > 0.02 || Math.abs(TIP.v) > 1e-4) FOLLOW = requestAnimationFrame(follow);
    else d.t = undefined;
  }
  function dropFoot(e) {
    const d = HOLD;
    if (!d || e.pointerId !== d.pid) return;
    HOLD = null;
    cancelAnimationFrame(FOLLOW);
    FOLLOW = 0;
    if (d.moved) {
      document.body.classList.remove('dragging');
      SWALLOW = true;
      setTimeout(() => { SWALLOW = false; });
    }
    drop();
  }
  // let go: the cabinet falls under gravity and bounces off the floor, worked out in steps of 2 ms
  function drop() {
    const L = CAB.L, z = L.dh / 160, G = 0.0018 * z, top = Draw.rise(L), full = Math.sqrt(2 * G * top), h0 = TIP.h;
    // still going up when let go, it carries on up a little first (no more than a quarter of the way again)
    const v0 = Math.min(TIP.v, Math.sqrt(2 * G * top * 0.25));
    Object.assign(TIP, { h: 0, v: 0 });
    show(0);
    if (!h0 || still.matches) {
      if (TIP.slid) { TIP.slid = false; knock(0); }
      return;
    }
    // where it is every 16 ms and each time it lands; when it lands and how hard (1 = dropped from as high as it goes)
    const pts = [[0, h0]], hits = [];
    for (let t = 0, h = h0, v = v0; h > 0 || v;) {
      t += 2;
      v -= G * 2;
      h += v * 2;
      if (h > 0) { if (t % 16 === 0) pts.push([t, h]); continue; }
      hits.push([t, Math.min(1.3, -v / full)]);
      pts.push([t, 0]);
      h = 0;
      v = -v * BOUNCE;
      if (v * v < 2 * G * 0.6) v = 0; // a bounce under 0.6 units: it has come to rest
    }
    const end = pts[pts.length - 1][0], els = tipping();
    for (const k in els) els[k].animate(pts.map(([t, h]) => ({ offset: t / end, ...Draw.tipped(L, TIP.side, h)[k] })), { duration: end });

    // The drawers rattle: each hit sends them hopping in their slots, shifting and turning, dying away over RATTLE ms.
    // One that had knocked over to the low side goes back to the middle as it does.
    const T1 = hits[0][0], last = hits[hits.length - 1][0] + RATTLE, pivot = TIP.side === 'l' ? L.X + L.W - 10 : L.X + 10;
    const times = [...new Set([...Array.from({ length: Math.ceil(last / 16) }, (_, k) => k * 16), ...hits.map(([t]) => t), last])].sort((a, b) => a - b);
    for (const [g, i, from, x0] of halt()) {
      const q = quirk(D.order[i]), mid = L.cells[i][0] + L.dw / 2;
      // the further from the foot it tipped over, the faster a drawer was falling when the cabinet landed
      const lever = 0.5 + 0.5 * Math.abs(mid - pivot) / (L.W - 20);
      const at = (t) => {
        const a1 = t - T1 - q.lag;
        let x = a1 > 0 ? x0 * Math.exp(-a1 / 140) * Math.cos((2 * Math.PI * a1) / q.shift) : x0, y = 0, r = 0;
        for (const [th, hs] of hits) {
          const a = t - th - q.lag, s = hs * lever;
          if (a <= 0) continue;
          const e1 = Math.exp(-a / 200), e2 = Math.exp(-a / 300);
          y -= 8 * z * s * e1 * Math.abs(Math.sin((Math.PI * a) / q.hop));
          x += 3 * z * s * e2 * q.sx * Math.sin((2 * Math.PI * a) / q.shift);
          r += 2.2 * s * e2 * q.sr * Math.sin((2 * Math.PI * a) / q.turn);
        }
        return Draw.shaken(x, y, r);
      };
      g.animate(times.map((t) => ({ offset: t / last, transform: t ? at(t) : from })), { duration: last });
    }
    TIP.slid = false;
  }

  /* ---------- pictures of the textures ---------- */
  // The cabinet shows its pencil textures as pictures (Draw.bake), drawn for the size it is shown at on this screen.
  // bake() draws whatever the cabinet now wants; when that leaves the cabinet out of date, it is drawn again, as soon
  // as nothing on it is moving.
  let REDRAW = 0;
  const scale = () => { const w = $('#cabinet').getBoundingClientRect().width; return Math.min(3, ((w || CAB.L.vw) / CAB.L.vw) * devicePixelRatio * 1.1); };
  const bake = () => Draw.bake(scale()).then((stale) => { if (stale) redraw(); });
  function redraw() {
    clearTimeout(REDRAW);
    if (DRAG || HOLD || [...OUT.values()].some((o) => o.t0 != null) || $('.cab-col').getAnimations({ subtree: true }).some((a) => a.playState === 'running')) {
      REDRAW = setTimeout(redraw, 300);
      return;
    }
    drawCabinet();
    drawOverlay(view());
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
    return `<li style="--rot:${rot}deg"><a class="card" href="${href({ r: r.full_name })}" data-r="${esc(r.full_name)}">
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
  const head = (kicker, title, aside = '') => `<header class="ph">${back(T().back)}${kicker ? `<p class="kicker">${kicker}</p>` : ''}<div class="ph-row"><h2 tabindex="-1">${title}</h2>${aside}</div></header>`;

  function home() {
    const t = T(), list = [...D.repos].sort(sortBy('starred')).slice(0, 12);
    return head('', t.homeTitle, `<span class="aside">${t.homeAside}</span>`) + `<div class="tray">${cards(list, { chip: true })}</div>`;
  }

  // the part of a drawer above its tray: the sort links, the drawer's name, its description.
  // The sort links have a line of their own above the name, so long names keep a line to themselves.
  function lid(id) {
    const t = T(), c = D.cats[id], sort = S.s || 'stars';
    const sorter = `<span class="sort" role="group" aria-label="${t.sortLabel}">${SORTS.map((k) => `<a href="${href({ s: k === 'stars' ? '' : k })}"${k === sort ? ' aria-current="true"' : ''}>${t.sorts[k]}${k === sort ? ' ↓' : ''}</a>`).join('')}</span>`;
    return `<div class="lid"><header class="ph">${back(t.back)}<div class="ph-row">${sorter}</div><h2 tabindex="-1">${esc(cname(c))}</h2></header><p class="desc">${esc(cdesc(c))}</p></div>`;
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
    return head('', t.inbox, `<span class="aside">${t.cards(list.length)}</span>`) + `<p class="desc">${t.inboxIntro}</p>` +
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
        <div class="cc-top"><div class="cc-no"><small>${t.callNo}</small><b>${esc(r.no)}</b></div><h2 tabindex="-1">${esc(r.name)}</h2><a class="cc-cat" href="${href({ r: '', q: '', c: r.cat, t: '' })}">${esc(cname(c))}</a></div>
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
  // What a screen reader says when the page changes: a line about it, not the whole panel (index.html #status). While a
  // search is being typed, it waits for the typing to stop.
  let SAID = '', SAYING = 0;
  function say(v) {
    const t = T().said, c = D.cats[S.c];
    let s = t.home;
    if (v === 'search') { const res = D.repos.filter((r) => matches(r)); s = t.search(S.q.trim(), res.length, new Set(res.map((r) => r.cat)).size); }
    else if (v === 'drawer') s = S.t ? t.tag(tag(S.t), inCat(S.c).filter((r) => r.tags.includes(S.t)).length) : t.drawer(cname(c), c.count);
    else if (v === 'inbox') s = t.inbox(c.count);
    else if (v === 'card') s = t.card(D.byName[S.r].name);
    clearTimeout(SAYING);
    SAYING = setTimeout(() => { if (s !== SAID) $('#status').textContent = SAID = s; }, v === 'search' ? 600 : 50);
  }

  // Where the keyboard goes once the panel has been made again (the element it was on is gone). `a` had the focus, and
  // `was` is what was shown before. Typing a search or switching language leaves it where it is; a sort link or a tag tab
  // goes to the one now picked; putting a card back goes to that card, and shutting a drawer to that drawer in the
  // cabinet, once it is back in; anything else goes to the panel's heading. Only after a key press: KEYS says the last
  // thing used was the keyboard, not a mouse or a finger, which leave the focus alone.
  let KEYS = false;
  function refocus(a, was, v) {
    if (!KEYS || !a || a === $('#q') || a.closest('.lang') || a.closest('#overlay .gtab')) return;
    const panel = $('#panel'), wide = !phone.matches;
    const put = (el) => el && el.focus({ preventScroll: wide && el.tagName === 'H2' });
    if (a.closest('.sort')) return put(panel.querySelector('.sort [aria-current]'));
    if (a.closest('.guides')) return put(panel.querySelector('.guides [aria-current]'));
    if (was.v === 'card' && v !== 'card') {
      const back = [...panel.querySelectorAll('a.card')].find((e) => e.dataset.r === was.r);
      if (back) return put(back);
    }
    if (v === 'home' && (was.v === 'drawer' || was.v === 'card') && was.c && was.c !== INBOX) {
      const id = was.c, t0 = performance.now();
      const shut = () => {
        const g = [...document.querySelectorAll('#cabinet > .drawer')].find((e) => e.dataset.cat === id);
        if (g && !OUT.has(id)) g.focus({ preventScroll: wide });
        else if (performance.now() - t0 < 1500 && view() === 'home') requestAnimationFrame(shut);
      };
      return shut();
    }
    put(panel.querySelector('h2'));
  }

  let PREV = null;
  function render() {
    const focused = document.activeElement, was = PREV;
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
    // only when what is shown has changed: not when the same page is made again for a new width or language
    const key = [v, S.c, S.t, S.s, S.q, S.r].join('|');
    PREV = { v, r: S.r, c: S.c, key };
    if (was && was.key !== key) { say(v); refocus(focused, was, v); }
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
    cab.addEventListener('click', (e) => { if (!SWALLOW) activate(e.target); });
    // or drag a drawer out (or back in) by its handle, or lift the cabinet by a foot
    cab.addEventListener('pointerdown', grab);
    cab.addEventListener('pointerdown', grabFoot);
    addEventListener('pointermove', drag);
    addEventListener('pointermove', pullFoot);
    addEventListener('pointerup', release);
    addEventListener('pointerup', dropFoot);
    addEventListener('pointercancel', release);
    addEventListener('pointercancel', dropFoot);
    // (a touch's implicit capture by the handle moving to the cabinet doesn't count)
    cab.addEventListener('lostpointercapture', (e) => { if (e.target === cab) { release(e); dropFoot(e); } });
    // on a touch screen, dragging a handle or a foot moves it, not the page
    cab.addEventListener('touchmove', (e) => { if (DRAG || HOLD) e.preventDefault(); }, { passive: false });
    cab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e.target); } });
    // The window losing focus mid-drag (another window brought up, say) counts as letting go, so a drawer or the cabinet
    // isn't left stuck to the pointer when the button comes up somewhere the page never hears of.
    addEventListener('blur', () => {
      const at = { type: 'blur', timeStamp: performance.now() };
      if (DRAG) { try { cab.releasePointerCapture(DRAG.pid); } catch {} release({ ...at, pointerId: DRAG?.pid }); }
      if (HOLD) { try { cab.releasePointerCapture(HOLD.pid); } catch {} dropFoot({ ...at, pointerId: HOLD?.pid }); }
    });
    addEventListener('keydown', () => { KEYS = true; }, true);
    addEventListener('pointerdown', () => { KEYS = false; }, true);
    // the skip button (the first stop for the Tab key) goes past the drawers to the panel
    $('#skip').addEventListener('click', () => $('#panel h2')?.focus());
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
    phone.addEventListener('change', () => { drawCabinet(); render(); bake(); });
    let resized = 0;
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--cab-h', cab.getBoundingClientRect().height + 'px');
      fitLid();
      // a bigger cabinet wants bigger pictures
      clearTimeout(resized);
      resized = setTimeout(bake, 400);
    }).observe(cab);
    // text gets wider or narrower as the self-hosted fonts arrive
    document.fonts?.addEventListener('loadingdone', fitLid);
  }

  // header and loading picture in the right language before the data arrives
  S.l = hashLang();
  chrome();
  const ld = $('#loading');
  ld.insertAdjacentHTML('afterbegin', Draw.loader());
  $('.ld-msg').innerHTML = `<p>${esc(T().loading)}</p>`;

  // The loading picture stays up for at least SHOW ms from opening the page, even when the data comes sooner. The data
  // loads meanwhile, so a slow connection waits no longer than it would anyway, and once it is in, the cabinet's textures
  // are drawn into pictures (for a cabinet unit about a CSS pixel, as it is on most screens) for what time is left. Then
  // the loading picture fades out and the cabinet in, and its pictures are made again if it turned out to be bigger.
  const SHOW = 3000;
  const shown = new Promise((ok) => setTimeout(ok, Math.max(0, SHOW - performance.now())));
  const baked = load().then(() => {
    Draw.cabinet(D.order.map(drawerOf), phone.matches ? 2 : 4, '');
    return Promise.race([Draw.bake(Math.min(3, devicePixelRatio * 1.1)), new Promise((ok) => setTimeout(ok, Math.max(500, SHOW - performance.now())))]);
  });
  Promise.all([baked, shown]).then(async () => {
    await ld.animate({ opacity: [1, 0] }, { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished;
    ld.remove();
    readHash();
    bind();
    render();
    bake();
    $('.layout').animate({ opacity: [0, 1] }, { duration: 300, easing: 'ease-out' });
  }).catch((err) => {
    // the drawers stop and the message says what went wrong (put back if it failed after the data came)
    document.body.dataset.view = 'loading';
    $('.layout').append(ld);
    ld.classList.add('failed');
    $('.ld-msg').innerHTML = `<p>${esc(T().loadFail)}</p><p>${esc(err.message)}</p><button type="button" class="btn2 ld-retry">${esc(T().reload)}</button>`;
    $('.ld-retry').addEventListener('click', () => location.reload());
  });
})();
