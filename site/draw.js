'use strict';
// Hand-drawn SVG: pen strokes with a slight bow, coloured-pencil fills, and the card-catalogue cabinet.
window.Draw = (() => {
  const INK = '#2a2522', RED = '#b8443a';
  const WOOD = '#d3a875', WOOD_DEEP = '#a97b4c', TEA = '#8e5a35', BRASS = '#cfa64e', CREAM = '#fbf6ea';
  // the hatch patterns exist for these pencils only; other colours fill flat
  const PENCILS = [WOOD, WOOD_DEEP, TEA, '#9fc6dd', '#8fa9cf', '#a9d4c4', '#c3b1df', '#b88fb3', '#efcd76', '#f2b98f', '#c98a6a', '#9cc27f', '#b7c79a', '#df8797', '#f0a9b7', '#b9c3c9', '#c8a06e'];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let R = rng(1);
  const seed = (s) => { R = rng(hash(s)); };
  const j = (a) => (R() - 0.5) * 2 * a;
  const f = (n) => n.toFixed(1);

  // one pen stroke: a slight bow and a little overshoot at both ends
  function seg(x1, y1, x2, y2, wob = 1) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const o1 = 0.6 + R() * 1.6, o2 = 0.6 + R() * 1.6;
    const sx = x1 - ux * o1 + j(0.5), sy = y1 - uy * o1 + j(0.5), ex = x2 + ux * o2 + j(0.5), ey = y2 + uy * o2 + j(0.5);
    const bow = j(wob) + Math.min(2.2, L * 0.006) * (R() > 0.5 ? 1 : -1);
    return `M${f(sx)} ${f(sy)}Q${f((sx + ex) / 2 + nx * bow)} ${f((sy + ey) / 2 + ny * bow)} ${f(ex)} ${f(ey)}`;
  }
  const path = (pts, closed = true) => pts.slice(0, closed ? pts.length : pts.length - 1).map((a, i) => { const b = pts[(i + 1) % pts.length]; return seg(a[0], a[1], b[0], b[1]); }).join('');
  const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const shape = (pts) => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
  const ink = (d, o = {}) => `<path d="${d}" fill="none" stroke="${o.color ?? INK}" stroke-width="${o.w ?? 1.25}" stroke-linecap="round" stroke-linejoin="round" opacity="${o.op ?? 0.9}"/>`;
  const outline = (pts, o = {}) => ink(path(pts, o.closed ?? true), o) + (o.once ? '' : ink(path(pts, o.closed ?? true), { ...o, w: (o.w ?? 1.25) * 0.5, op: 0.4 }));
  const box = (x, y, w, h, o) => outline(rectPts(x, y, w, h), o);
  const line = (x1, y1, x2, y2, o = {}) => ink(seg(x1, y1, x2, y2, o.wob), o);
  function pencil(d, color, o = {}) {
    const strokes = o.strokes !== false && PENCILS.includes(color);
    return `<path d="${d}" fill="${color}" opacity="${o.op ?? 0.78}" filter="url(#grain)"/>` + (strokes ? `<path d="${d}" fill="url(#h${color.slice(1)}${o.angle === 'b' ? 'b' : ''})" opacity="${o.sop ?? 0.85}" filter="url(#edge)"/>` : '');
  }
  const fillRect = (x, y, w, h, color, o) => pencil(shape(rectPts(x, y, w, h)), color, o);
  const text = (x, y, s, o = {}) => `<text x="${f(x)}" y="${f(y)}" font-family="${o.latin ? 'Kevin Serif, LXGW WenKai, serif' : 'LXGW WenKai, serif'}" font-size="${o.size ?? 14}" font-weight="${o.bold ? 700 : 400}" fill="${o.color ?? INK}" text-anchor="${o.anchor ?? 'start'}" letter-spacing="${o.ls ?? 0}">${esc(s)}</text>`;
  const cw = (s, px) => [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? px : px * 0.56), 0);
  // a drawer name on a plate `w` wide: one line if it fits, else two lines split at the most even space
  // (never starting a line with "&"; the second line keeps clear of the count in the corner), shrunk if still too long
  function plate(name, w, px) {
    if (cw(name, px) <= w) return { lines: [name], size: px + 1 };
    let best = null;
    for (let k = name.indexOf(' '); k > 0; k = name.indexOf(' ', k + 1)) {
      if (name[k + 1] === '&') continue;
      const lines = [name.slice(0, k), name.slice(k + 1)], m = Math.max(cw(lines[0], px), cw(lines[1], px) + 24);
      if (!best || m <= best.m) best = { lines, m };
    }
    if (!best) return { lines: [name], size: Math.min(px + 1, (px * w) / cw(name, px)) };
    return { lines: best.lines, size: best.m > w ? (px * w) / best.m : px };
  }
  function pin(x, y, color) {
    const c = `M${x - 7} ${y}a7 7 0 1 0 14 0a7 7 0 1 0 -14 0`;
    return `<ellipse cx="${f(x + 2.5)}" cy="${f(y + 4)}" rx="7" ry="4" fill="#000" opacity=".16"/>` + pencil(c, color, { op: 0.95, strokes: false }) + ink(c, { w: 1 }) + `<circle cx="${f(x - 2.4)}" cy="${f(y - 2.4)}" r="1.8" fill="#fff" opacity=".8"/>`;
  }

  function defs() {
    const pats = PENCILS.map((c) => {
      const id = 'h' + c.slice(1);
      return `<pattern id="${id}" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="4.2" stroke="${c}" stroke-width="1.1" opacity=".9"/></pattern>` +
        `<pattern id="${id}b" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-52)"><line x1="0" y1="0" x2="0" y2="4.6" stroke="${c}" stroke-width="1" opacity=".8"/></pattern>`;
    }).join('');
    return `<defs>
      <filter id="grain" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="5" result="w"/>
        <feDisplacementMap in="SourceGraphic" in2="w" scale="3.2" result="d"/>
        <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="9" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.55" result="a"/>
        <feComposite in="d" in2="a" operator="in"/>
      </filter>
      <filter id="edge" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="2" result="w"/>
        <feDisplacementMap in="SourceGraphic" in2="w" scale="4"/>
      </filter>${pats}</defs>`;
  }

  /* ---------- the cabinet ---------- */

  // a pulled drawer comes down by PULL of its height and grows by SC; CAP cards make a drawer look full
  const PULL = 0.33, SC = 1.07, CAP = 36;

  // geometry for `n` drawers in `cols` columns: a cabinet `W` wide with `pad` inside its sides, drawers `dh` tall
  // and `gx` apart, labels in `lp` px
  function grid(n, cols, W, pad, gx, dh, lp) {
    const rows = Math.ceil(n / cols), dw = (W - 2 * pad - (cols - 1) * gx) / cols;
    const X = 16, Y = 40, H = 46 + rows * dh + (rows - 1) * gx;
    const cells = Array.from({ length: n }, (_, i) => [X + pad + (i % cols) * (dw + gx), Y + 30 + Math.floor(i / cols) * (dh + gx)]);
    // the cabinet stands on feet just tall enough for a pulled bottom drawer to clear the floor
    const foot = Math.ceil(dh * (PULL + (SC - 1) / 2) - 16 + 6);
    return { W, H, X, Y, dw, dh, cells, foot, lp, vw: W + 32, vh: Y + H + foot + 16 };
  }
  const layout = (n, cols) => (cols < 4 ? grid(n, cols, 342, 12, 10, 128, 13) : grid(n, cols, 780, 20, 14, 160, 14));

  function front(x, y, dw, dh, d, lp) {
    let s = `<rect x="${f(x)}" y="${f(y)}" width="${f(dw)}" height="${dh}" fill="#dcbf92"/>` + fillRect(x, y, dw, dh, WOOD, { op: 0.95 }) + box(x, y, dw, dh, { w: 1.2 }) + box(x + 5, y + 5, dw - 10, dh - 10, { w: 0.6, once: true, op: 0.6 });
    const big = dh > 140, lw = dw - (big ? 40 : 22), lx = x + (dw - lw) / 2, ly = y + (big ? 18 : 12), lh = big ? 54 : 44;
    s += fillRect(lx - 4, ly - 4, lw + 8, lh + 8, BRASS, { op: 0.85, strokes: false }) + box(lx - 4, ly - 4, lw + 8, lh + 8, { w: 0.9, once: true });
    s += `<rect x="${f(lx)}" y="${ly}" width="${f(lw)}" height="${lh}" fill="${CREAM}"/>` + fillRect(lx, ly, lw, 6, d.color, { op: 0.9, strokes: false });
    const { lines, size } = plate(d.name, lw - 10, lp);
    if (lines.length > 1) s += text(lx + lw / 2, ly + lh / 2 - 1, lines[0], { size, anchor: 'middle' }) + text(lx + lw / 2, ly + lh / 2 + size + 1, lines[1], { size, anchor: 'middle' });
    else s += text(lx + lw / 2, ly + lh / 2 + lp * 0.4, lines[0], { size, anchor: 'middle' });
    s += text(lx + lw - 3, ly + lh - 3, String(d.count), { size: 10.5, anchor: 'end', color: RED, latin: true });
    const hx = x + dw / 2, hy = y + dh - (big ? 44 : 30), hr = big ? 9 : 7, ring = `M${f(hx - hr)} ${f(hy)}a${hr} ${hr} 0 1 0 ${2 * hr} 0a${hr} ${hr} 0 1 0 ${-2 * hr} 0`, pull = `M${f(hx - hr * 1.45)} ${f(hy + 2)}a${f(hr * 1.45)} ${f(hr * 1.65)} 0 0 0 ${f(hr * 2.9)} 0`;
    s += pencil(ring, BRASS, { op: 0.95, strokes: false }) + ink(ring, { w: 1 }) + ink(pull, { w: 2, color: '#7a5a22' }) + ink(pull, { w: 0.9 });
    return s;
  }

  // the cabinet without its drawers: top, body, plinth and feet
  function carcass(L) {
    const { W, H, X, Y } = L;
    let s = fillRect(X - 14, Y - 12, W + 28, 22, WOOD_DEEP, { op: 0.9 }) + box(X - 14, Y - 12, W + 28, 22, { w: 1.3 });
    s += `<rect x="${X}" y="${Y + 10}" width="${W}" height="${H - 10}" fill="#b98c5e"/>` + fillRect(X, Y + 10, W, H - 10, TEA, { op: 0.7 }) + box(X, Y + 10, W, H - 10, { w: 1.4 });
    for (let i = 0; i < H / 18; i++) { const yy = Y + 20 + R() * (H - 30); s += line(X + 6, yy, X + W - 6, yy + j(3), { w: 0.5, op: 0.25, color: '#3b2413' }); }
    // the plinth and two tapered feet, with their shadows on the floor
    const by = Y + H, ph = 10, fb = by + L.foot, fw = W < 400 ? 22 : 30;
    s += `<ellipse cx="${X + W / 2}" cy="${fb}" rx="${W / 2 + 6}" ry="3" fill="#3b2a1e" opacity=".1"/>`;
    for (const x0 of [X + 6, X + W - 6 - fw]) {
      const leg = [[x0, by + ph], [x0 + fw, by + ph], [x0 + fw - 4, fb], [x0 + 4, fb]];
      s += `<ellipse cx="${x0 + fw / 2}" cy="${fb}" rx="${fw / 2 + 5}" ry="2.6" fill="#3b2a1e" opacity=".22"/><path d="${shape(leg)}" fill="#9a6d43"/>` + pencil(shape(leg), TEA, { op: 0.8 }) + outline(leg, { w: 1.2 });
    }
    s += `<rect x="${X - 6}" y="${by}" width="${W + 12}" height="${ph}" fill="#9a6d43"/>` + fillRect(X - 6, by, W + 12, ph, WOOD_DEEP, { op: 0.9 }) + box(X - 6, by, W + 12, ph, { w: 1.3 });
    return s;
  }

  // the cabinet body and every drawer, closed; each drawer is its own button
  function cabinet(drawers, cols) {
    const L = layout(drawers.length, cols), { dw, dh } = L;
    seed('cabinet-' + cols);
    let s = defs() + carcass(L);
    drawers.forEach((d, i) => {
      const [x, y] = L.cells[i];
      s += `<g class="drawer" data-cat="${esc(d.id)}" role="button" tabindex="0" aria-label="${esc(d.label)}">` + front(x, y, dw, dh, d, L.lp) +
        `<rect class="hov" x="${f(x)}" y="${y}" width="${f(dw)}" height="${dh}"/><rect class="ring" x="${f(x - 3)}" y="${y - 3}" width="${f(dw + 6)}" height="${dh + 6}" rx="3"/></g>`;
    });
    return { svg: s, L };
  }

  // A drawer pulled straight out towards a viewer standing a little above it: the front comes down and grows a little,
  // and between it and the cabinet you look into the drawer. Its cards (one line each, `d.count` of them) stand at the
  // front, held up by a block; behind that is the empty floor with the rod the cards are threaded on. A guide card for
  // each of `tabs` ({ tag, label }) is spread through the cards, their tabs stepping left to right like the tag tabs in
  // the panel; tab `active` is lit. Each tab is a button of its own, laid over the drawer so a click on it picks that
  // tag instead of closing the drawer.
  function pulled(L, i, d, tabs = [], active = -1) {
    const { s: inner, btns, fx, fy, fw, fh } = inside(L, i, d, tabs, active);
    const s = inner + rim(fx, fy, fw, fh) + `<g transform="translate(${f(fx)} ${f(fy)}) scale(${SC}) translate(${f(-fx)} ${f(-fy)})">` + front(fx, fy, L.dw, L.dh, d, L.lp) + '</g>';
    return `<g class="drawer pulled" data-cat="${esc(d.id)}" role="button" tabindex="0" aria-label="${esc(d.closeLabel)}">${s}</g>` + btns.join('');
  }

  // what a drawer front at x, y, w × h has around it once pulled out: its shadow below and the drawer's top edge above
  const rim = (x, y, w, h) => `<rect x="${f(x + 4)}" y="${f(y + h - 6)}" width="${f(w - 8)}" height="20" fill="#1e140c" opacity=".26" filter="url(#edge)"/><rect x="${f(x + 10)}" y="${f(y + h)}" width="${f(w - 20)}" height="7" fill="#1e140c" opacity=".16"/>` +
    `<rect x="${f(x)}" y="${f(y - 5)}" width="${f(w)}" height="6" fill="#ead2a8"/>` + box(x, y - 5, w, 6, { w: 0.9, once: true });

  // the pulled drawer up to its front: the opening, the floor, the cards and the side walls; also the front's place
  function inside(L, i, d, tabs, active) {
    const [x, y] = L.cells[i], { dw, dh } = L, guides = tabs.length;
    const fw = dw * SC, fh = dh * SC, fx = x + dw / 2 - fw / 2, fy = y + dh * PULL - (fh - dh) / 2;
    seed(d.id + ':pulled');
    let s = `<rect x="${f(x)}" y="${y}" width="${f(dw)}" height="${dh}" fill="#24180f"/>`;
    const wo = 3, wi = 11, back = y + 2, near = fy - 4;
    const Lx = (t, k) => x + k + (fx + k * SC - x - k) * t, Rx = (t, k) => x + dw - k + (fx + fw - k * SC - x - dw + k) * t, Y = (t) => back + (near - back) * t;
    // depth z (0 at the back, 1 at the front) to screen t: the far end is foreshortened
    const T = (z) => Math.pow(Math.max(0, z), 1.6);
    const quad = (t0, t1, k, a = 0, b = 1) => {
      const at = (t, u) => Lx(t, k) + (Rx(t, k) - Lx(t, k)) * u;
      return `M${f(at(t0, a))} ${f(Y(t0))}L${f(at(t0, b))} ${f(Y(t0))}L${f(at(t1, b))} ${f(Y(t1))}L${f(at(t1, a))} ${f(Y(t1))}Z`;
    };
    const mid = (t) => (Lx(t, wi) + Rx(t, wi)) / 2;

    // front to back: guide card k goes in front of card k·n/g; -1 is a plain card
    const n = d.count || 0, items = [];
    for (let c = 0, k = 0; c < n || k < guides;) {
      if (k < guides && k * n <= c * guides) items.push(k++);
      else { items.push(-1); c++; }
    }
    const dz = 1 / Math.max(CAP, items.length + 3), zOf = (m) => 1 - (m + 1) * dz, zLast = 1 - items.length * dz;

    // the floor, with a little grain and the rod down the middle
    const floor = quad(0, 1, wi);
    s += `<path d="${floor}" fill="#d6b384"/>` + pencil(floor, WOOD, { op: 0.55, strokes: false });
    for (let g = 0; g < 4; g++) {
      const u = 0.12 + g * 0.24 + j(0.06), a = Lx(0, wi) + (Rx(0, wi) - Lx(0, wi)) * u, b = Lx(1, wi) + (Rx(1, wi) - Lx(1, wi)) * u;
      s += line(a, back, b, near, { w: 0.5, op: 0.22, color: '#5b3d22' });
    }
    const tr = T(zLast);
    s += `<line x1="${f(mid(0))}" y1="${back}" x2="${f(mid(tr))}" y2="${f(Y(tr))}" stroke="#5b4632" stroke-width="${f(1.2 + tr * 0.8)}" stroke-linecap="round"/>` +
      `<line x1="${f(mid(0) - 0.5)}" y1="${back}" x2="${f(mid(tr) - 0.6)}" y2="${f(Y(tr))}" stroke="#f1dca8" stroke-width=".5" opacity=".8"/>`;

    // the block holding the cards up, just behind the last one
    const b0 = T(zLast - 2.2 * dz), b1 = T(zLast - 0.2 * dz);
    if (b1 - b0 > 0.004) {
      const top = quad(b0, b1, wi, 0.32, 0.68);
      s += `<path d="${quad(b1, Math.min(1, b1 + (b1 - b0) * 0.6), wi, 0.32, 0.68)}" fill="#3b2a1e" opacity=".25"/><path d="${top}" fill="#9a6d43"/>` +
        pencil(top, BRASS, { op: 0.7, strokes: false }) + `<path d="${top}" fill="none" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>`;
    }

    // the cards: faces showing between their top edges; a guide card's tab pokes up above the rest
    if (items.length) s += `<path d="${quad(tr, 1, wi)}" fill="#efe4cb"/>`;
    const tabW = Math.min(0.2, 0.96 / Math.max(guides, 1)), btns = [];
    for (let m = items.length - 1; m >= 0; m--) {
      const z = zOf(m), t = T(z), yy = Y(t), xl = Lx(t, wi) + 1, xr = Rx(t, wi) - 1, k = items[m];
      if (k >= 0) {
        const tw = (xr - xl) * tabW, th = 4 + 6 * z, tx = xl + (xr - xl - tw) * (guides > 1 ? k / (guides - 1) : 0.5);
        const tab = `M${f(tx)} ${f(yy)}L${f(tx + 2)} ${f(yy - th)}L${f(tx + tw - 2)} ${f(yy - th)}L${f(tx + tw)} ${f(yy)}Z`, { tag, label } = tabs[k];
        s += `<path d="${tab}" fill="${k === active ? '#e9a99b' : '#f3e2b8'}" stroke="${INK}" stroke-width=".7"/>`;
        // the tabs never overlap side to side, so each button can reach a little above and below its tab
        btns[k] = `<g class="gtab" data-tag="${esc(tag)}" role="button" tabindex="0" aria-pressed="${k === active}" aria-label="${esc(label)}"><title>${esc(label)}</title>` +
          `<rect class="hit" x="${f(tx)}" y="${f(yy - th - 5)}" width="${f(tw)}" height="${f(th + 9)}"/><path class="lit" d="${tab}"/></g>`;
      }
      s += `<line x1="${f(xl)}" y1="${f(yy)}" x2="${f(xr)}" y2="${f(yy)}" stroke="${k >= 0 ? '#6f5b42' : '#8a7458'}" stroke-width="${f(0.5 + t * 0.9)}" opacity="${(0.45 + t * 0.45).toFixed(2)}"/>`;
      if (m % 2 === 0 || dz > 0.03) s += `<line x1="${f(xl)}" y1="${f(yy + 0.6 + t * 0.6)}" x2="${f(xr)}" y2="${f(yy + 0.6 + t * 0.6)}" stroke="#fffaf0" stroke-width="${f(0.5 + t * 0.7)}" opacity=".9"/>`;
    }
    s += `<rect x="${f(x)}" y="${y}" width="${f(dw)}" height="7" fill="#1a110a" opacity=".55" filter="url(#edge)"/>`;
    for (const side of [0, 1]) {
      const a = side ? (t) => Rx(t, wo) : (t) => Lx(t, wo), b = side ? (t) => Rx(t, wi) : (t) => Lx(t, wi);
      const wall = `M${f(a(0))} ${back}L${f(b(0))} ${back}L${f(b(1))} ${f(near)}L${f(a(1))} ${f(near)}Z`;
      s += `<path d="${wall}" fill="#c9a26e"/>` + pencil(wall, WOOD_DEEP, { op: 0.55, strokes: false }) + ink(wall, { w: 0.8 });
    }
    return { s, btns, fx, fy, fw, fh };
  }

  // The loading picture: a small cabinet of six blank drawers that come out one after another. Each drawer is drawn
  // closed, with its inside as when pulled out underneath; style.css slides the front (.ld-out) down by --dy and grows
  // it about its middle, as pulled() draws it, and shows the inside and the rim (.ld-in, .ld-rim) while it is out.
  // --k is a drawer's turn; the .ld-first one stays out when motion is reduced.
  function loader() {
    const L = grid(6, 3, 560, 20, 14, 160, 14), { dw, dh } = L;
    const colors = ['#9fc6dd', '#efcd76', '#c3b1df', '#9cc27f', '#f2b98f', '#df8797'];
    const turn = [4, 0, 2, 1, 3, 5], tabs = [[2, 3], [1], [3], [2], [1, 2], [2]];
    seed('loader');
    let s = defs() + carcass(L);
    // the bottom row first, so a top drawer coming out lies over the one below it
    for (const i of [3, 4, 5, 0, 1, 2]) {
      const [x, y] = L.cells[i], k = turn[i], first = k === 0 ? ' ld-first' : '';
      const d = { id: 'loader-' + i, name: '', count: 14 + ((i * 7) % 6) * 3, color: colors[i] };
      const { s: inner } = inside(L, i, d, Array.from({ length: tabs[i][0] }, () => ({ tag: '', label: '' })), tabs[i][1] ?? -1);
      const at = `style="--k:${k};--dy:${f(dh * PULL)}px;transform-origin:${f(x + dw / 2)}px ${f(y + dh / 2)}px"`;
      s += `<g class="ld-in${first}" style="--k:${k}">${inner}</g>` +
        `<g class="ld-out${first}" ${at}><g class="ld-rim">${rim(x, y, dw, dh)}</g>${front(x, y, dw, dh, { ...d, count: '' }, L.lp)}</g>`;
    }
    return `<svg class="ld-cab" viewBox="0 0 ${L.vw} ${L.vh}" aria-hidden="true">${s}</svg>`;
  }

  // a red paper flag sticking out of a drawer: how many cards match the search
  function flag(L, i, label, id) {
    const [x, y] = L.cells[i], fx = x + L.dw - 18, fy = y - 8, rot = ((hash(id) % 60) / 10 - 3).toFixed(1);
    return `<g transform="rotate(${rot} ${f(fx)} ${fy})" class="flag"><rect x="${f(fx - 22)}" y="${fy}" width="38" height="24" fill="${RED}"/><rect x="${f(fx - 22)}" y="${fy}" width="38" height="24" fill="#c2544a" opacity=".5"/>` + text(fx - 3, fy + 17, label, { size: 12.5, anchor: 'middle', color: '#fff6ea' }) + '</g>';
  }
  const dim = (L, i) => { const [x, y] = L.cells[i]; return `<rect x="${f(x - 1)}" y="${y - 1}" width="${f(L.dw + 2)}" height="${L.dh + 2}" fill="#3b2a1e" opacity=".42" pointer-events="none"/>`; };

  // a note pinned to the top of the cabinet when new stars are waiting to be filed
  function note(L, label) {
    const cx = L.X + L.W - 140, cy = L.Y - 22;
    seed('note');
    return `<g class="note" data-nav="inbox" role="button" tabindex="0" aria-label="${esc(label)}"><g transform="rotate(-3 ${cx} ${cy + 16})"><rect x="${cx - 66}" y="${cy}" width="132" height="44" fill="${CREAM}"/>` + box(cx - 66, cy, 132, 44, { w: 0.9, once: true }) + text(cx, cy + 28, label, { size: 15, anchor: 'middle', color: RED }) + '</g>' + pin(cx, cy + 4, '#cf4e43') + '</g>';
  }

  return { esc, hash, rng, cabinet, pulled, flag, dim, note, loader, INK, RED };
})();
