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

  // geometry for `n` drawers in `cols` columns
  function layout(n, cols) {
    const phone = cols < 4;
    const W = phone ? 342 : 780, pad = phone ? 12 : 20, gx = phone ? 10 : 14, rows = Math.ceil(n / cols);
    const dw = (W - 2 * pad - (cols - 1) * gx) / cols, dh = phone ? 128 : 160;
    const X = 16, Y = 40, H = 46 + rows * dh + (rows - 1) * gx;
    const cells = Array.from({ length: n }, (_, i) => [X + pad + (i % cols) * (dw + gx), Y + 30 + Math.floor(i / cols) * (dh + gx)]);
    return { W, H, X, Y, dw, dh, cells, lp: phone ? 13 : 14, vw: W + 32, vh: Y + H + 14 };
  }

  function front(x, y, dw, dh, d, lp) {
    let s = `<rect x="${f(x)}" y="${f(y)}" width="${f(dw)}" height="${dh}" fill="#dcbf92"/>` + fillRect(x, y, dw, dh, WOOD, { op: 0.95 }) + box(x, y, dw, dh, { w: 1.2 }) + box(x + 5, y + 5, dw - 10, dh - 10, { w: 0.6, once: true, op: 0.6 });
    const big = dh > 140, lw = dw - (big ? 40 : 22), lx = x + (dw - lw) / 2, ly = y + (big ? 18 : 12), lh = big ? 54 : 44;
    s += fillRect(lx - 4, ly - 4, lw + 8, lh + 8, BRASS, { op: 0.85, strokes: false }) + box(lx - 4, ly - 4, lw + 8, lh + 8, { w: 0.9, once: true });
    s += `<rect x="${f(lx)}" y="${ly}" width="${f(lw)}" height="${lh}" fill="${CREAM}"/>` + fillRect(lx, ly, lw, 6, d.color, { op: 0.9, strokes: false });
    const name = d.name, sp = cw(name, lp) > lw - 10 && name.includes(' ') ? name.lastIndexOf(' ', Math.min(name.length - 1, 9)) : -1;
    if (sp > 0) s += text(lx + lw / 2, ly + lh / 2 - 1, name.slice(0, sp), { size: lp, anchor: 'middle' }) + text(lx + lw / 2, ly + lh / 2 + lp + 1, name.slice(sp + 1), { size: lp, anchor: 'middle' });
    else s += text(lx + lw / 2, ly + lh / 2 + lp * 0.4, name, { size: lp + 1, anchor: 'middle' });
    s += text(lx + lw - 3, ly + lh - 3, String(d.count), { size: 10.5, anchor: 'end', color: RED, latin: true });
    const hx = x + dw / 2, hy = y + dh - (big ? 44 : 30), hr = big ? 9 : 7, ring = `M${f(hx - hr)} ${f(hy)}a${hr} ${hr} 0 1 0 ${2 * hr} 0a${hr} ${hr} 0 1 0 ${-2 * hr} 0`, pull = `M${f(hx - hr * 1.45)} ${f(hy + 2)}a${f(hr * 1.45)} ${f(hr * 1.65)} 0 0 0 ${f(hr * 2.9)} 0`;
    s += pencil(ring, BRASS, { op: 0.95, strokes: false }) + ink(ring, { w: 1 }) + ink(pull, { w: 2, color: '#7a5a22' }) + ink(pull, { w: 0.9 });
    return s;
  }

  // the cabinet body and every drawer, closed; each drawer is its own button
  function cabinet(drawers, cols) {
    const L = layout(drawers.length, cols), { W, H, X, Y, dw, dh } = L;
    seed('cabinet-' + cols);
    let s = defs();
    s += fillRect(X - 14, Y - 12, W + 28, 22, WOOD_DEEP, { op: 0.9 }) + box(X - 14, Y - 12, W + 28, 22, { w: 1.3 });
    s += `<rect x="${X}" y="${Y + 10}" width="${W}" height="${H - 10}" fill="#b98c5e"/>` + fillRect(X, Y + 10, W, H - 10, TEA, { op: 0.7 }) + box(X, Y + 10, W, H - 10, { w: 1.4 });
    for (let i = 0; i < H / 18; i++) { const yy = Y + 20 + R() * (H - 30); s += line(X + 6, yy, X + W - 6, yy + j(3), { w: 0.5, op: 0.25, color: '#3b2413' }); }
    drawers.forEach((d, i) => {
      const [x, y] = L.cells[i];
      s += `<g class="drawer" data-cat="${esc(d.id)}" role="button" tabindex="0" aria-label="${esc(d.name)}，${d.count} 张">` + front(x, y, dw, dh, d, L.lp) +
        `<rect class="hov" x="${f(x)}" y="${y}" width="${f(dw)}" height="${dh}"/><rect class="ring" x="${f(x - 3)}" y="${y - 3}" width="${f(dw + 6)}" height="${dh + 6}" rx="3"/></g>`;
    });
    return { svg: s, L };
  }

  // A drawer pulled straight out towards a viewer standing a little above it: the front comes down and grows a little,
  // and between it and the cabinet you look into the drawer, its side walls and the top edges of the standing cards.
  function pulled(L, i, d, activeTab) {
    const [x, y] = L.cells[i], { dw, dh } = L;
    const pull = 0.33, sc = 1.07, fw = dw * sc, fh = dh * sc, fx = x + dw / 2 - fw / 2, fy = y + dh * pull - (fh - dh) / 2;
    seed(d.id + ':pulled');
    let s = `<rect x="${f(x)}" y="${y}" width="${f(dw)}" height="${dh}" fill="#24180f"/>`;
    const wo = 3, wi = 11, back = y + 2, near = fy - 4;
    const Lx = (t, k) => x + k + (fx + k * sc - x - k) * t, Rx = (t, k) => x + dw - k + (fx + fw - k * sc - x - dw + k) * t, Y = (t) => back + (near - back) * t;
    s += `<path d="M${f(Lx(0, wi))} ${back}L${f(Rx(0, wi))} ${back}L${f(Rx(1, wi))} ${f(near)}L${f(Lx(1, wi))} ${f(near)}Z" fill="#efe4cb"/>`;
    for (let k = 0; k <= 26; k++) {
      const t = Math.pow(k / 26, 1.6), yy = Y(t), xl = Lx(t, wi) + 1, xr = Rx(t, wi) - 1;
      s += `<line x1="${f(xl)}" y1="${f(yy)}" x2="${f(xr)}" y2="${f(yy)}" stroke="#8a7458" stroke-width="${f(0.5 + t * 0.9)}" opacity="${(0.45 + t * 0.45).toFixed(2)}"/>`;
      if (k % 2 === 0) s += `<line x1="${f(xl)}" y1="${f(yy + 0.8 + t)}" x2="${f(xr)}" y2="${f(yy + 0.8 + t)}" stroke="#fffaf0" stroke-width="${f(0.6 + t)}" opacity=".9"/>`;
    }
    // guide cards stand taller: their tabs poke up above the others
    [[0.32, 0.18], [0.58, 0.52], [0.82, 0.3]].forEach(([t0, pos], k) => {
      const t = Math.pow(t0, 1.6), yy = Y(t), xl = Lx(t, wi), xr = Rx(t, wi), tw = (xr - xl) * 0.2, th = 5 + 5 * t0, tx = xl + (xr - xl - tw) * pos;
      s += `<path d="M${f(tx)} ${f(yy)}L${f(tx + 2)} ${f(yy - th)}L${f(tx + tw - 2)} ${f(yy - th)}L${f(tx + tw)} ${f(yy)}Z" fill="${k === activeTab ? '#e9a99b' : '#f3e2b8'}" stroke="${INK}" stroke-width=".7"/>`;
    });
    s += `<rect x="${f(x)}" y="${y}" width="${f(dw)}" height="7" fill="#1a110a" opacity=".55" filter="url(#edge)"/>`;
    for (const side of [0, 1]) {
      const a = side ? (t) => Rx(t, wo) : (t) => Lx(t, wo), b = side ? (t) => Rx(t, wi) : (t) => Lx(t, wi);
      const wall = `M${f(a(0))} ${back}L${f(b(0))} ${back}L${f(b(1))} ${f(near)}L${f(a(1))} ${f(near)}Z`;
      s += `<path d="${wall}" fill="#c9a26e"/>` + pencil(wall, WOOD_DEEP, { op: 0.55, strokes: false }) + ink(wall, { w: 0.8 });
    }
    s += `<rect x="${f(fx + 4)}" y="${f(fy + fh - 6)}" width="${f(fw - 8)}" height="20" fill="#1e140c" opacity=".26" filter="url(#edge)"/><rect x="${f(fx + 10)}" y="${f(fy + fh)}" width="${f(fw - 20)}" height="7" fill="#1e140c" opacity=".16"/>`;
    s += `<rect x="${f(fx)}" y="${f(fy - 5)}" width="${f(fw)}" height="6" fill="#ead2a8"/>` + box(fx, fy - 5, fw, 6, { w: 0.9, once: true });
    s += `<g transform="translate(${f(fx)} ${f(fy)}) scale(${sc}) translate(${f(-fx)} ${f(-fy)})">` + front(fx, fy, dw, dh, d, L.lp) + '</g>';
    return `<g class="drawer pulled" data-cat="${esc(d.id)}" role="button" tabindex="0" aria-label="合上「${esc(d.name)}」">${s}</g>`;
  }

  // a red paper flag sticking out of a drawer: how many cards match the search
  function flag(L, i, n, id) {
    const [x, y] = L.cells[i], fx = x + L.dw - 18, fy = y - 8, rot = ((hash(id) % 60) / 10 - 3).toFixed(1);
    return `<g transform="rotate(${rot} ${f(fx)} ${fy})" class="flag"><rect x="${f(fx - 22)}" y="${fy}" width="38" height="24" fill="${RED}"/><rect x="${f(fx - 22)}" y="${fy}" width="38" height="24" fill="#c2544a" opacity=".5"/>` + text(fx - 3, fy + 17, `${n} 张`, { size: 12.5, anchor: 'middle', color: '#fff6ea' }) + '</g>';
  }
  const dim = (L, i) => { const [x, y] = L.cells[i]; return `<rect x="${f(x - 1)}" y="${y - 1}" width="${f(L.dw + 2)}" height="${L.dh + 2}" fill="#3b2a1e" opacity=".42" pointer-events="none"/>`; };

  // a note pinned to the top of the cabinet when new stars are waiting to be filed
  function note(L, n) {
    const cx = L.X + L.W - 140, cy = L.Y - 22;
    seed('note');
    return `<g class="note" data-nav="inbox" role="button" tabindex="0" aria-label="待归档 ${n} 张"><g transform="rotate(-3 ${cx} ${cy + 16})"><rect x="${cx - 66}" y="${cy}" width="132" height="44" fill="${CREAM}"/>` + box(cx - 66, cy, 132, 44, { w: 0.9, once: true }) + text(cx, cy + 28, `待归档 ${n} 张`, { size: 15, anchor: 'middle', color: RED }) + '</g>' + pin(cx, cy + 4, '#cf4e43') + '</g>';
  }

  return { esc, hash, rng, cabinet, pulled, flag, dim, note, INK, RED };
})();
