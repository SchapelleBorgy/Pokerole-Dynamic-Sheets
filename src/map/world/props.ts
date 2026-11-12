import type { Pen, Rect } from './looks';
import { darken, lighten } from './looks';

/* Trees, hedges, lamps, benches and the rest of a street, in the same ink
   and shading as the buildings. `r` is the sprite rectangle in px; its
   bottom edge is the front of the footprint. `rot` draws the quarter-turned
   view of the things that have one. */

/** A soft round blob of foliage: a radial wash by day, flat with hatching in Ancient. */
function blob(p: Pen, cx: number, cy: number, rad: number, hex: string, light = 0.18): void {
    /* The flat fill first: it is also what Pastel's outline is darkened from. */
    p.ell(cx, cy, rad, rad).fill(hex);
    if (p.look.shading !== 'hatch') {
        const soft = p.look.shading === 'soft' ? 0.5 : 1;
        const g = p.ctx.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
        g.addColorStop(0, p.c(lighten(hex, light * soft)));
        g.addColorStop(1, p.c(darken(hex, 0.22 * soft)));
        p.ctx.fillStyle = g;
        p.ctx.fill();
    }
    p.stroke();
}

export function tree(p: Pen, r: Rect, [leaves, trunk]: string[]): void {
    /* Drawn for a 2-cell-wide sprite and scaled with it: the big tree is the same tree. */
    const u = p.u * (r.w / (2 * p.u)), cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.12 * u, 0.75 * u, 0.22 * u);
    p.rr(cx - 0.16 * u, r.y + r.h * 0.55, 0.32 * u, r.h * 0.43, 0.06 * u).shadeFill(trunk, cx - 0.16 * u, 0, cx + 0.16 * u, 0, 0.3).stroke();
    blob(p, cx - 0.5 * u, r.y + r.h * 0.42, 0.42 * u, darken(leaves, 0.08));
    blob(p, cx + 0.5 * u, r.y + r.h * 0.42, 0.42 * u, darken(leaves, 0.14));
    blob(p, cx, r.y + r.h * 0.3, 0.62 * u, leaves);
    blob(p, cx - 0.12 * u, r.y + r.h * 0.18, 0.36 * u, lighten(leaves, 0.12));
    p.ell(cx + 0.25 * u, r.y + r.h * 0.42, 0.42 * u, 0.25 * u).shade(0.15);
}

export function pine(p: Pen, r: Rect, [leaves, trunk]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.12 * u, 0.6 * u, 0.2 * u);
    p.rect(cx - 0.12 * u, ground - 0.7 * u, 0.24 * u, 0.62 * u).shadeFill(trunk, cx - 0.12 * u, 0, cx + 0.12 * u, 0).stroke();
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
        const top = r.y + 0.05 * u + i * (r.h - 0.9 * u) / tiers * 0.85;
        const base = top + (r.h - 0.7 * u) / tiers * 1.35;
        const half = r.w / 2 * (0.55 + i * 0.2);
        const col = i === 0 ? lighten(leaves, 0.08) : i === 2 ? darken(leaves, 0.08) : leaves;
        p.poly([[cx, top], [cx + half, base], [cx - half, base]]).shadeFill(col, cx - half, 0, cx + half, 0, 0.3).stroke();
        p.poly([[cx, top], [cx + half, base], [cx + half * 0.15, base]]).shade(0.18);
    }
}

export function bush(p: Pen, r: Rect, [leaves, flower]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.1 * u, r.w * 0.48, 0.16 * u);
    blob(p, cx - r.w * 0.22, ground - 0.42 * u, 0.32 * u, darken(leaves, 0.06));
    blob(p, cx + r.w * 0.22, ground - 0.42 * u, 0.32 * u, darken(leaves, 0.1));
    blob(p, cx, ground - 0.58 * u, 0.38 * u, leaves);
    if (flower) {
        p.reseed(7);
        for (let i = 0; i < 6; i++) p.ell(cx + (p.rnd() - 0.5) * r.w * 0.7, ground - (0.35 + p.rnd() * 0.5) * u, 0.06 * u, 0.06 * u).fill(flower);
    }
}

export function hedge(p: Pen, r: Rect, [leaves]: string[], rot: boolean): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.1 * u, r.w * 0.52, 0.16 * u);
    const top = ground - (rot ? r.h : 1.1 * u);
    p.rr(r.x + 0.05 * u, top, r.w - 0.1 * u, ground - top - 0.05 * u, 0.3 * u).shadeFill(leaves, 0, top, 0, ground, 0.3).stroke();
    p.rr(r.x + 0.12 * u, top + 0.05 * u, r.w - 0.24 * u, 0.3 * u, 0.15 * u).shine(0.2);
    p.reseed(Math.round(r.w * 3 + r.h));
    for (let i = 0; i < (r.w / u) * (rot ? 4 : 2) * 3; i++) {
        const x = r.x + 0.2 * u + p.rnd() * (r.w - 0.4 * u), y = top + 0.2 * u + p.rnd() * (ground - top - 0.4 * u);
        p.ell(x, y, 0.07 * u, 0.05 * u).fill(darken(leaves, 0.22));
    }
}

export function flowers(p: Pen, r: Rect, [a, b]: string[]): void {
    const u = p.u;
    p.reseed(Math.round(r.x + r.y * 7));
    for (let i = 0; i < (r.w / u) * (r.h / u) * 7; i++) {
        const x = r.x + 0.15 * u + p.rnd() * (r.w - 0.3 * u), y = r.y + 0.15 * u + p.rnd() * (r.h - 0.3 * u);
        p.line([[x, y + 0.12 * u], [x, y]], '#4a8a3c', 0.8);
        const col = p.rnd() < 0.5 ? a : b;
        for (let k = 0; k < 5; k++) {
            const t = k / 5 * Math.PI * 2;
            p.ell(x + Math.cos(t) * 0.06 * u, y + Math.sin(t) * 0.06 * u, 0.05 * u, 0.05 * u).fill(col);
        }
        p.ell(x, y, 0.035 * u, 0.035 * u).fill('#f0c030');
    }
}

export function rock(p: Pen, r: Rect, [stone]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.1 * u, r.w * 0.45, 0.14 * u);
    const pts: [number, number][] = [
        [r.x + 0.12 * u, ground - 0.1 * u], [r.x + 0.08 * u, ground - 0.45 * u], [r.x + 0.3 * u, r.y + 0.22 * u],
        [cx + 0.12 * u, r.y + 0.12 * u], [r.x + r.w - 0.15 * u, ground - 0.55 * u], [r.x + r.w - 0.1 * u, ground - 0.1 * u],
    ];
    p.poly(pts).shadeFill(stone, r.x, r.y, r.x + r.w, ground, 0.35).stroke();
    p.poly([[cx + 0.12 * u, r.y + 0.12 * u], [r.x + r.w - 0.15 * u, ground - 0.55 * u], [r.x + r.w - 0.1 * u, ground - 0.1 * u], [cx + 0.05 * u, ground - 0.1 * u]]).shade(0.2);
}

export function lamp(p: Pen, r: Rect, [metal, light]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.glow(cx, r.y + 0.4 * u, 1.6 * u);
    p.groundShadow(cx, ground - 0.08 * u, 0.3 * u, 0.1 * u);
    p.rect(cx - 0.06 * u, r.y + 0.6 * u, 0.12 * u, r.h - 0.68 * u).shadeFill(metal, cx - 0.06 * u, 0, cx + 0.06 * u, 0).stroke(0.8);
    p.rr(cx - 0.18 * u, ground - 0.2 * u, 0.36 * u, 0.14 * u, 0.04 * u).paint(metal, 0.8);
    p.poly([[cx - 0.24 * u, r.y + 0.24 * u], [cx + 0.24 * u, r.y + 0.24 * u], [cx + 0.17 * u, r.y + 0.62 * u], [cx - 0.17 * u, r.y + 0.62 * u]]);
    if (p.look.night) {
        p.ctx.save(); p.ctx.shadowColor = 'rgba(255,210,120,.9)'; p.ctx.shadowBlur = u * 0.6;
        p.ctx.fillStyle = lighten(light, 0.45); p.ctx.fill(); p.ctx.restore();
        p.stroke(0.8);
    } else {
        p.paint(light, 0.8);
    }
    p.poly([[cx - 0.3 * u, r.y + 0.26 * u], [cx, r.y + 0.04 * u], [cx + 0.3 * u, r.y + 0.26 * u]]).paint(metal, 0.8);
}

export function bench(p: Pen, r: Rect, [wood, metal]: string[], rot: boolean): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.1 * u, r.w * 0.5, 0.15 * u);
    if (rot) {
        /* Seen end on: a narrow seat running away from the viewer. */
        const x = r.x + 0.25 * u, w = r.w - 0.5 * u;
        p.rect(x, r.y + 0.3 * u, w, r.h - 0.7 * u).shadeFill(wood, x, 0, x + w, 0).stroke();
        for (let y = r.y + 0.55 * u; y < ground - 0.5 * u; y += 0.3 * u) p.line([[x, y], [x + w, y]], null, 0.5, 0.5);
        p.rect(x - 0.1 * u, r.y + 0.3 * u, 0.12 * u, r.h - 0.7 * u).paint(darken(wood, 0.2), 0.8);
        for (const y of [r.y + 0.5 * u, ground - 0.6 * u]) p.rect(x + 0.05 * u, y, 0.08 * u, 0.4 * u).paint(metal, 0.6);
        return;
    }
    const seatY = ground - 0.62 * u;
    p.rect(r.x + 0.15 * u, r.y + 0.1 * u, r.w - 0.3 * u, 0.32 * u).shadeFill(wood, 0, r.y, 0, r.y + 0.4 * u).stroke();
    p.rect(r.x + 0.1 * u, seatY, r.w - 0.2 * u, 0.26 * u).shadeFill(lighten(wood, 0.1), 0, seatY, 0, seatY + 0.26 * u).stroke();
    for (const fx of [0.25, r.w / u - 0.37]) p.rect(r.x + fx * u, seatY + 0.26 * u, 0.12 * u, 0.32 * u).paint(metal, 0.7);
}

export function fence(p: Pen, r: Rect, [wood]: string[], rot: boolean): void {
    const u = p.u, ground = r.y + r.h;
    if (rot) {
        const cx = r.x + r.w / 2;
        p.rect(cx - 0.06 * u, r.y + 0.3 * u, 0.12 * u, r.h - 0.4 * u).paint(darken(wood, 0.1), 0.7);
        for (let y = r.y + 0.3 * u; y <= ground - 0.2 * u; y += 0.75 * u) {
            p.rect(cx - 0.1 * u, y - 0.45 * u, 0.2 * u, 0.62 * u).shadeFill(wood, cx - 0.1 * u, 0, cx + 0.1 * u, 0).stroke(0.8);
        }
        return;
    }
    for (const fy of [0.45, 0.75]) p.rect(r.x + 0.05 * u, ground - fy * u - 0.06 * u, r.w - 0.1 * u, 0.12 * u).paint(darken(wood, 0.08), 0.7);
    for (let x = r.x + 0.15 * u; x < r.x + r.w - 0.1 * u; x += 0.5 * u) {
        p.poly([[x, ground - 0.08 * u], [x, ground - 0.95 * u], [x + 0.1 * u, ground - 1.08 * u], [x + 0.2 * u, ground - 0.95 * u], [x + 0.2 * u, ground - 0.08 * u]])
            .shadeFill(wood, x, 0, x + 0.2 * u, 0).stroke(0.8);
    }
}

export function signpost(p: Pen, r: Rect, [wood, board]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.08 * u, 0.3 * u, 0.1 * u);
    p.rect(cx - 0.07 * u, r.y + 0.5 * u, 0.14 * u, r.h - 0.55 * u).shadeFill(wood, cx - 0.07 * u, 0, cx + 0.07 * u, 0).stroke(0.8);
    p.rr(r.x + 0.08 * u, r.y + 0.12 * u, r.w - 0.16 * u, 0.6 * u, 0.08 * u).shadeFill(board, 0, r.y, 0, r.y + 0.7 * u).stroke();
    for (const fy of [0.32, 0.5]) p.line([[r.x + 0.25 * u, r.y + fy * u], [r.x + r.w - 0.25 * u, r.y + fy * u]], null, 0.6, 0.6);
}

export function mailbox(p: Pen, r: Rect, [box]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.08 * u, 0.28 * u, 0.1 * u);
    p.rect(cx - 0.06 * u, ground - 0.75 * u, 0.12 * u, 0.7 * u).paint('#6a5a4a', 0.7);
    p.rr(cx - 0.28 * u, r.y + 0.15 * u, 0.56 * u, 0.48 * u, [0.24 * u, 0.24 * u, 0.04 * u, 0.04 * u]).shadeFill(box, cx - 0.28 * u, 0, cx + 0.28 * u, 0, 0.3).stroke();
    p.rect(cx + 0.2 * u, r.y + 0.1 * u, 0.06 * u, 0.25 * u).fill('#d04040');
}

export function fountain(p: Pen, r: Rect, [stone, water]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    const cy = ground - r.w * 0.32, rx = r.w * 0.48, ry = r.w * 0.3;
    p.groundShadow(cx, ground - 0.15 * u, rx, ry * 0.5);
    p.ell(cx, cy + 0.3 * u, rx, ry).shadeFill(stone, 0, cy - ry, 0, cy + ry + 0.3 * u, 0.3).stroke();
    p.rect(cx - rx, cy, rx * 2, 0.3 * u).fill(stone);
    p.ell(cx, cy, rx, ry).fill(lighten(stone, 0.12)).stroke();
    p.ell(cx, cy + 0.03 * u, rx - 0.22 * u, ry - 0.16 * u).shadeFill(water, cx - rx, cy - ry, cx + rx, cy + ry, 0.3).stroke(0.6);
    p.ell(cx - rx * 0.3, cy - ry * 0.2, rx * 0.25, ry * 0.12).shine(0.35);
    /* The middle: a pillar, a bowl, the jet. */
    p.rect(cx - 0.12 * u, cy - 1.2 * u, 0.24 * u, 1.2 * u).shadeFill(stone, cx - 0.12 * u, 0, cx + 0.12 * u, 0, 0.3).stroke(0.8);
    p.ell(cx, cy - 1.2 * u, 0.5 * u, 0.18 * u).paint(lighten(stone, 0.08), 0.8);
    for (const dx of [-0.35, 0, 0.35]) p.line([[cx, cy - 1.5 * u], [cx + dx * u * 0.9, cy - 1.05 * u]], water, 1.6, 0.85);
    p.ell(cx, cy - 1.55 * u, 0.1 * u, 0.18 * u).fill(lighten(water, 0.3));
}

export function well(p: Pen, r: Rect, [stone, roof]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    const cy = ground - 0.75 * u, rx = r.w * 0.38;
    p.groundShadow(cx, ground - 0.12 * u, rx * 1.1, 0.25 * u);
    p.rect(cx - rx, cy, rx * 2, 0.6 * u).shadeFill(stone, cx - rx, 0, cx + rx, 0, 0.3).stroke();
    for (let x = cx - rx + 0.3 * u; x < cx + rx; x += 0.35 * u) p.line([[x, cy + 0.05 * u], [x, cy + 0.55 * u]], null, 0.4, 0.4);
    p.ell(cx, cy + 0.6 * u, rx, 0.18 * u).fill(stone).stroke();
    p.ell(cx, cy, rx, 0.28 * u).fill(lighten(stone, 0.1)).stroke();
    p.ell(cx, cy, rx - 0.15 * u, 0.18 * u).fill('#1a2a3a');
    for (const s of [-1, 1]) p.rect(cx + s * (rx - 0.05 * u) - 0.06 * u, r.y + 0.55 * u, 0.12 * u, cy - r.y - 0.5 * u).paint('#7a5a3a', 0.8);
    p.poly([[cx - rx - 0.2 * u, r.y + 0.75 * u], [cx, r.y + 0.1 * u], [cx + rx + 0.2 * u, r.y + 0.75 * u]]).shadeFill(roof, 0, r.y, 0, r.y + 0.8 * u, 0.3).stroke();
}

export function stall(p: Pen, r: Rect, [canopy, wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.12 * u, r.w * 0.5, 0.25 * u);
    for (const fx of [0.2, r.w / u - 0.32]) p.rect(r.x + fx * u, r.y + 0.6 * u, 0.12 * u, ground - r.y - 0.7 * u).paint(wood, 0.7);
    p.rect(r.x + 0.1 * u, ground - 1.0 * u, r.w - 0.2 * u, 0.55 * u).shadeFill(wood, 0, 0, 0, 0).stroke();
    p.reseed(Math.round(r.w * 11));
    const goods = ['#e04848', '#f0b030', '#58a848', '#e07830'];
    for (let x = r.x + 0.35 * u; x < r.x + r.w - 0.3 * u; x += 0.32 * u) {
        p.ell(x, ground - 1.08 * u, 0.13 * u, 0.11 * u).paint(goods[Math.floor(p.rnd() * goods.length)], 0.5);
    }
    const n = Math.round(r.w / (0.45 * u));
    for (let i = 0; i < n; i++) {
        const sx = r.x + r.w * i / n, sw = r.w / n;
        p.poly([[sx + 0.1 * u, r.y + 0.1 * u], [sx + sw + 0.1 * u, r.y + 0.1 * u], [sx + sw, r.y + 0.75 * u], [sx, r.y + 0.75 * u]]).fill(i % 2 ? '#fbf6ec' : canopy);
    }
    p.poly([[r.x + 0.1 * u, r.y + 0.1 * u], [r.x + r.w + 0.1 * u, r.y + 0.1 * u], [r.x + r.w, r.y + 0.75 * u], [r.x, r.y + 0.75 * u]]).stroke();
    p.rect(r.x, r.y + 0.72 * u, r.w, 0.14 * u).shade(0.2);
}

export function crates(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.1 * u, r.w * 0.5, 0.15 * u);
    const box = (x: number, y: number, s: number) => {
        p.rect(x, y, s, s).shadeFill(wood, x, y, x + s, y + s, 0.3).stroke();
        p.line([[x, y], [x + s, y + s]], null, 0.6, 0.6);
        p.rect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84).stroke(0.5);
    };
    box(r.x + 0.08 * u, ground - 0.62 * u, 0.55 * u);
    box(r.x + 0.5 * u, ground - 0.5 * u, 0.44 * u);
    box(r.x + 0.25 * u, ground - 1.08 * u, 0.46 * u);
}

export function statue(p: Pen, r: Rect, [stone]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.15 * u, r.w * 0.5, 0.25 * u);
    p.rect(r.x + 0.15 * u, ground - 0.9 * u, r.w - 0.3 * u, 0.85 * u).shadeFill(stone, r.x, 0, r.x + r.w, 0, 0.3).stroke();
    p.rect(r.x + 0.05 * u, ground - 0.98 * u, r.w - 0.1 * u, 0.16 * u).paint(lighten(stone, 0.1), 0.8);
    /* A rearing beast on top: a generic silhouette, no particular species. */
    const bx = cx, by = ground - 1.0 * u;
    p.ctx.beginPath();
    p.ctx.moveTo(bx - 0.55 * u, by);
    p.ctx.quadraticCurveTo(bx - 0.6 * u, by - 0.9 * u, bx - 0.15 * u, by - 1.3 * u);
    p.ctx.quadraticCurveTo(bx + 0.05 * u, by - 2.1 * u, bx + 0.35 * u, by - 2.0 * u);
    p.ctx.lineTo(bx + 0.55 * u, by - 1.75 * u);
    p.ctx.quadraticCurveTo(bx + 0.25 * u, by - 1.55 * u, bx + 0.3 * u, by - 1.15 * u);
    p.ctx.quadraticCurveTo(bx + 0.62 * u, by - 0.6 * u, bx + 0.5 * u, by);
    p.ctx.closePath();
    p.shadeFill(lighten(stone, 0.05), bx - 0.6 * u, 0, bx + 0.6 * u, 0, 0.35).stroke();
}
