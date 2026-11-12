import type { Pen, Rect } from './looks';
import { darken, lighten } from './looks';
import { building } from './buildings';
import type { BuildingSpec } from './buildings';

/* More of a town: special buildings, odd trees, the clutter of a street.
   Same conventions as props.ts — `r` is the sprite in px, its bottom edge the
   front of the footprint. */

/* ------------------------------------------------------------ buildings */

export function chapel(p: Pen, r: Rect, [roof, wall]: string[], _rot = false, v = 0): void {
    const u = p.u;
    const body: Rect = { x: r.x, y: r.y + 1.6 * u, w: r.w, h: r.h - 1.6 * u };
    building(p, body, {
        roof, wall, floors: 1, roofKind: 'gable', windows: 2, door_: v === 2 ? 'double' : 'wood', door: '#6a3a24',
        ...(v === 1 ? { wallMat: 'brick', windowKind: 'arched', trim: '#e8dcc8' } : v === 2 ? { windowKind: 'tall', wallMat: 'siding' } : {}),
    } as BuildingSpec);
    if (v === 2) {
        /* A round window over the door, no steeple: a bell on the ridge. */
        const cx = r.x + r.w / 2;
        p.ell(cx, body.y + 1.0 * u, 0.32 * u, 0.32 * u).paint('#c8e0f0', 0.8);
        p.rect(cx - 0.3 * u, body.y - 0.2 * u, 0.6 * u, 0.6 * u).fill(wall).stroke(0.8);
        p.ell(cx, body.y + 0.15 * u, 0.15 * u, 0.15 * u).fill('#c8a040');
        p.poly([[cx - 0.42 * u, body.y - 0.15 * u], [cx, body.y - 0.6 * u], [cx + 0.42 * u, body.y - 0.15 * u]]).paint(roof);
        return;
    }
    /* The steeple over the door. */
    const cx = r.x + r.w / 2, sw = 1.1 * u, top = r.y + 0.1 * u, base = body.y + 1.0 * u;
    p.rect(cx - sw / 2, base - 1.5 * u, sw, 1.5 * u).shadeFill(wall, cx - sw / 2, 0, cx + sw / 2, 0, 0.25).stroke();
    p.rr(cx - 0.18 * u, base - 1.25 * u, 0.36 * u, 0.6 * u, [0.18 * u, 0.18 * u, 0, 0]).fill('#3a2a1a').stroke(0.6);
    p.poly([[cx, top], [cx + sw / 2 + 0.12 * u, base - 1.45 * u], [cx - sw / 2 - 0.12 * u, base - 1.45 * u]]).shadeFill(roof, cx - sw, 0, cx + sw, 0, 0.3).stroke();
    p.line([[cx, top], [cx, top - 0.35 * u]], '#c8a040', 1.4);
    p.line([[cx - 0.14 * u, top - 0.22 * u], [cx + 0.14 * u, top - 0.22 * u]], '#c8a040', 1.4);
}

export function lighthouse(p: Pen, r: Rect, [stripe, wall]: string[], _rot = false, v = 0): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.glow(cx, r.y + 0.9 * u, 3 * u);
    const top = r.y + 1.4 * u, tw = r.w * 0.42, bw = r.w * 0.7;
    p.poly([[cx - tw / 2, top], [cx + tw / 2, top], [cx + bw / 2, ground - 0.1 * u], [cx - bw / 2, ground - 0.1 * u]]).shadeFill(wall, cx - bw / 2, 0, cx + bw / 2, 0, 0.3).stroke();
    const ctx = p.ctx;
    ctx.save();
    p.poly([[cx - tw / 2, top], [cx + tw / 2, top], [cx + bw / 2, ground - 0.1 * u], [cx - bw / 2, ground - 0.1 * u]]);
    ctx.clip();
    if (v === 0) for (let y = top + 0.6 * u; y < ground; y += 1.4 * u) p.rect(r.x, y, r.w, 0.7 * u).fill(stripe);
    else if (v === 2) for (let y = ground; y > top; y -= 0.36 * u) p.line([[r.x, y], [r.x + r.w, y]], null, 0.45, 0.45);
    else p.rect(r.x, ground - 1.2 * u, r.w, 1.2 * u).fill(stripe);
    ctx.restore();
    p.poly([[cx - tw / 2, top], [cx + tw / 2, top], [cx + bw / 2, ground - 0.1 * u], [cx - bw / 2, ground - 0.1 * u]]).stroke();
    p.rr(cx - 0.3 * u, ground - 1.0 * u, 0.6 * u, 0.9 * u, [0.3 * u, 0.3 * u, 0, 0]).fill('#5a3a24').stroke(0.7);
    p.rect(cx - tw / 2 - 0.15 * u, top - 0.15 * u, tw + 0.3 * u, 0.2 * u).paint('#3a3a40', 0.8);
    p.glass(cx - tw / 2 + 0.05 * u, top - 0.85 * u, tw - 0.1 * u, 0.7 * u, true);
    p.poly([[cx, r.y + 0.1 * u], [cx + tw / 2 + 0.1 * u, top - 0.8 * u], [cx - tw / 2 - 0.1 * u, top - 0.8 * u]]).paint(stripe);
}

export function windmill(p: Pen, r: Rect, [roof, wall, sails]: string[], _rot = false, v = 0): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    const top = r.y + 1.6 * u, tw = r.w * 0.36, bw = r.w * 0.62;
    const body: [number, number][] = [[cx - tw / 2, top], [cx + tw / 2, top], [cx + bw / 2, ground - 0.1 * u], [cx - bw / 2, ground - 0.1 * u]];
    p.poly(body).shadeFill(wall, cx - bw / 2, 0, cx + bw / 2, 0, 0.3).stroke();
    if (v) {
        p.ctx.save();
        p.poly(body);
        p.ctx.clip();
        if (v === 1) for (let y = ground; y > top; y -= 0.34 * u) p.line([[r.x, y], [r.x + r.w, y]], null, 0.45, 0.5);
        else for (let x = r.x; x < r.x + r.w; x += 0.22 * u) p.line([[x, top], [x, ground]], null, 0.4, 0.45);
        p.ctx.restore();
        if (v === 2) {
            /* A gallery round the middle. */
            const gy = top + (ground - top) * 0.45;
            p.rect(cx - bw * 0.62, gy, bw * 1.24, 0.12 * u).paint('#7a5a3a', 0.6);
            for (let x = cx - bw * 0.6; x <= cx + bw * 0.6; x += 0.2 * u) p.line([[x, gy - 0.3 * u], [x, gy]], '#7a5a3a', 0.6);
            p.line([[cx - bw * 0.62, gy - 0.3 * u], [cx + bw * 0.62, gy - 0.3 * u]], '#7a5a3a', 0.8);
        }
    }
    p.rr(cx - 0.3 * u, ground - 1.0 * u, 0.6 * u, 0.9 * u, [0.3 * u, 0.3 * u, 0, 0]).fill('#6a4428').stroke(0.7);
    p.glass(cx - 0.18 * u, top + 0.7 * u, 0.36 * u, 0.42 * u);
    p.poly([[cx, top - 0.9 * u], [cx + tw / 2 + 0.25 * u, top + 0.1 * u], [cx - tw / 2 - 0.25 * u, top + 0.1 * u]]).shadeFill(roof, cx - tw, 0, cx + tw, 0, 0.3).stroke();
    /* Four sails on a hub, turned a little. */
    const hx = cx, hy = top + 0.05 * u, len = r.w * 0.5;
    for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2 + 0.2;
        const ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len;
        const nx = -Math.sin(a) * 0.22 * u, ny = Math.cos(a) * 0.22 * u;
        p.line([[hx, hy], [ex, ey]], '#5a3a24', 1.4);
        p.poly([[hx + Math.cos(a) * 0.4 * u, hy + Math.sin(a) * 0.4 * u], [ex, ey], [ex + nx, ey + ny], [hx + Math.cos(a) * 0.4 * u + nx, hy + Math.sin(a) * 0.4 * u + ny]]).paint(sails, 0.7);
    }
    p.ell(hx, hy, 0.14 * u, 0.14 * u).paint('#5a3a24', 0.7);
}

export function greenhouse(p: Pen, r: Rect, [frame, plants]: string[], _rot = false, v = 0): void {
    const u = p.u, ground = r.y + r.h, wallTop = ground - 1.6 * u, top = r.y + 0.3 * u;
    if (v === 1) {
        /* A polytunnel: one arch of film over hoops. */
        p.reseed(5);
        for (let i = 0; i < 9; i++) p.ell(r.x + (0.5 + p.rnd() * (r.w / u - 1)) * u, ground - (0.4 + p.rnd() * 1.2) * u, 0.3 * u, 0.25 * u).fill(plants);
        p.ctx.save();
        p.ctx.globalAlpha = 0.55;
        p.rr(r.x + 0.05 * u, top, r.w - 0.1 * u, ground - top - 0.08 * u, [r.w / 2, r.w / 2, 0, 0]).fill('#e6f2f2');
        p.ctx.restore();
        p.rr(r.x + 0.05 * u, top, r.w - 0.1 * u, ground - top - 0.08 * u, [r.w / 2, r.w / 2, 0, 0]).stroke();
        for (let y = top + 0.7 * u; y < ground; y += 0.7 * u) p.line([[r.x + 0.1 * u, y], [r.x + r.w - 0.1 * u, y]], frame, 0.6, 0.6);
        p.rr(r.x + r.w / 2 - 0.4 * u, ground - 1.2 * u, 0.8 * u, 1.1 * u, [0.4 * u, 0.4 * u, 0, 0]).stroke(1.2);
        return;
    }
    p.reseed(5);
    for (let i = 0; i < 9; i++) p.ell(r.x + (0.5 + p.rnd() * (r.w / u - 1)) * u, wallTop + (0.3 + p.rnd() * 1.0) * u, 0.3 * u, 0.25 * u).fill(plants);
    p.ctx.save();
    p.ctx.globalAlpha = p.look.shading === 'hatch' ? 0.5 : 0.55;
    p.poly([[r.x + 0.5 * u, top], [r.x + r.w - 0.5 * u, top], [r.x + r.w, wallTop], [r.x, wallTop]]).fill('#cfeaf2');
    p.rect(r.x + 0.1 * u, wallTop, r.w - 0.2 * u, ground - wallTop - 0.1 * u).fill('#dff2f6');
    p.ctx.restore();
    p.poly([[r.x + 0.5 * u, top], [r.x + r.w - 0.5 * u, top], [r.x + r.w, wallTop], [r.x, wallTop]]).stroke();
    p.rect(r.x + 0.1 * u, wallTop, r.w - 0.2 * u, ground - wallTop - 0.1 * u).stroke();
    for (let x = r.x + 0.1 * u; x <= r.x + r.w; x += 0.8 * u) {
        p.line([[x, wallTop], [x, ground - 0.1 * u]], frame, 1);
        const t = (x - r.x) / r.w;
        p.line([[x, wallTop], [r.x + 0.5 * u + t * (r.w - u), top]], frame, 1);
    }
    p.rr(r.x + r.w / 2 - 0.4 * u, ground - 1.2 * u, 0.8 * u, 1.1 * u, 0.05 * u).stroke(1.2);
}

export function station(p: Pen, r: Rect, [roof, wall]: string[], _rot = false, v = 0): void {
    if (v === 1) {
        building(p, r, { roof, wall, floors: 1, roofKind: 'mansard', roofMat: 'slate', wallMat: 'brick', windowKind: 'arched', door_: 'double', windows: 5, wallH: 2.3, trim: '#e8dcc8', dormers: 3,
            sign: (q, cx, y) => { q.rr(cx - 0.55 * q.u, y - 1.2 * q.u, 1.1 * q.u, 1.1 * q.u, 0.55 * q.u).paint('#f4f0e6'); q.line([[cx, y - 0.65 * q.u], [cx, y - 0.95 * q.u]], null, 1.2); q.line([[cx, y - 0.65 * q.u], [cx + 0.22 * q.u, y - 0.55 * q.u]], null, 1.2); } });
        return;
    }
    if (v === 2) {
        building(p, r, { roof, wall, floors: 1, roofKind: 'flat', wallMat: 'glass', door_: 'glass', windows: 0, wallH: 2.4, trim: '#8a9aa8', storefront: true, accent: roof });
        return;
    }
    building(p, r, { roof, wall, floors: 1, roofKind: 'hip', door_: 'glass', windows: 6, wallH: 2.2, trim: '#7a6a5a',
        sign: (q, cx, y) => { q.rr(cx - 0.6 * q.u, y - 1.3 * q.u, 1.2 * q.u, 1.2 * q.u, 0.6 * q.u).paint('#f4f0e6'); q.line([[cx, y - 0.7 * q.u], [cx, y - 1.05 * q.u]], null, 1.2); q.line([[cx, y - 0.7 * q.u], [cx + 0.25 * q.u, y - 0.6 * q.u]], null, 1.2); } });
}

export function museum(p: Pen, r: Rect, [roof, wall]: string[], _rot = false, v = 0): void {
    const u = p.u, ground = r.y + r.h;
    if (v === 1) {
        building(p, r, { roof, wall, floors: 1, roofKind: 'dome', door_: 'double', windows: 4, windowKind: 'tall', wallH: 2.4, trim: '#b8b0a0', columns: 6 });
        return;
    }
    if (v === 2) {
        building(p, r, { roof, wall, floors: 2, roofKind: 'flat', wallMat: 'glass', door_: 'glass', windows: 0, wallH: 2.8, trim: '#8a9098', storefront: true, accent: roof });
        return;
    }
    building(p, r, { roof, wall, floors: 1, roofKind: 'flat', door_: 'wood', windows: 0, wallH: 2.4, trim: '#b8b0a0' });
    /* A portico: steps, columns, a pediment. */
    const px = r.x + r.w * 0.2, pw = r.w * 0.6, top = ground - 2.9 * u;
    p.poly([[px, top + 0.6 * u], [px + pw / 2, top], [px + pw, top + 0.6 * u]]).shadeFill(wall, 0, top, 0, top + 0.6 * u).stroke();
    p.rect(px, top + 0.6 * u, pw, 0.25 * u).paint(lighten(wall, 0.1), 0.8);
    for (let i = 0; i < 4; i++) {
        const x = px + 0.2 * u + i * (pw - 0.7 * u) / 3;
        p.rect(x, top + 0.85 * u, 0.3 * u, ground - top - 1.2 * u).shadeFill('#f4f0e8', x, 0, x + 0.3 * u, 0, 0.3).stroke(0.8);
    }
    for (let i = 0; i < 3; i++) p.rect(px - (i + 1) * 0.15 * u, ground - 0.36 * u + i * 0.12 * u, pw + (i + 1) * 0.3 * u, 0.12 * u).paint('#d8d0c0', 0.6);
}

export function cabin(p: Pen, r: Rect, [roof, logs]: string[], _rot = false, v = 0): void {
    const u = p.u;
    if (v) {
        building(p, r, {
            roof, wall: logs, floors: 1, roofKind: 'gable', windows: 2, chimney: true, trim: darken(logs, 0.3), wallMat: 'logs',
            ...(v === 1 ? { porch: roof } : { annex: { side: 'right', w: 1.2, roofMat: 'metal', wallMat: 'planks' } }),
        } as BuildingSpec);
        return;
    }
    building(p, r, { roof, wall: logs, floors: 1, roofKind: 'gable', windows: 2, chimney: true, trim: darken(logs, 0.3) });
    const ground = r.y + r.h, wallTop = ground - 1.85 * u;
    for (let y = wallTop + 0.3 * u; y < ground - 0.3 * u; y += 0.28 * u) p.line([[r.x + 0.2 * u, y], [r.x + 0.5 * u, y]], null, 0.5, 0.5);
    for (let y = wallTop + 0.3 * u; y < ground - 0.3 * u; y += 0.28 * u) p.line([[r.x + r.w - 0.5 * u, y], [r.x + r.w - 0.2 * u, y]], null, 0.5, 0.5);
}

export function tent(p: Pen, r: Rect, [cloth]: string[], _rot = false, v = 0): void {
    const u = p.u, ground = r.y + r.h, cx = r.x + r.w / 2;
    p.groundShadow(cx, ground - 0.15 * u, r.w * 0.5, 0.25 * u);
    if (v === 1) {
        /* A dome tent. */
        p.ctx.beginPath();
        p.ctx.ellipse(cx, ground - 0.1 * u, r.w / 2 - 0.05 * u, r.h * 0.7, 0, Math.PI, 0);
        p.ctx.closePath();
        p.shadeFill(cloth, r.x, 0, r.x + r.w, 0, 0.3).stroke();
        for (const t of [-0.5, 0.5]) { p.ctx.beginPath(); p.ctx.ellipse(cx, ground - 0.1 * u, Math.abs(t) * r.w * 0.5, r.h * 0.7, 0, Math.PI, 0); p.stroke(0.5); }
        p.rr(cx - 0.3 * u, ground - 0.8 * u, 0.6 * u, 0.7 * u, [0.3 * u, 0.3 * u, 0, 0]).fill(darken(cloth, 0.45)).stroke(0.6);
        return;
    }
    if (v === 2) {
        /* A striped pavilion with a pennant. */
        const top = r.y + 0.2 * u, eave = ground - 1.0 * u, n = 6;
        p.rect(r.x + 0.15 * u, eave, r.w - 0.3 * u, ground - eave - 0.05 * u).shadeFill(lighten(cloth, 0.5), r.x, 0, r.x + r.w, 0, 0.25).stroke();
        p.rr(cx - 0.3 * u, eave + 0.1 * u, 0.6 * u, ground - eave - 0.15 * u, [0.3 * u, 0.3 * u, 0, 0]).fill(darken(cloth, 0.45));
        for (let i = 0; i < n; i++) {
            const sx = r.x + r.w * i / n;
            p.poly([[cx, top], [sx + r.w / n, eave], [sx, eave]]).fill(i % 2 ? '#fbf6ec' : cloth);
        }
        p.poly([[cx, top], [r.x + r.w, eave], [r.x, eave]]).stroke();
        p.line([[cx, top], [cx, top - 0.4 * u]], '#5a3a24', 1.1);
        p.poly([[cx, top - 0.4 * u], [cx + 0.35 * u, top - 0.3 * u], [cx, top - 0.2 * u]]).paint(cloth, 0.6);
        return;
    }
    p.poly([[cx, r.y + 0.2 * u], [r.x + r.w - 0.05 * u, ground - 0.1 * u], [r.x + 0.05 * u, ground - 0.1 * u]]).shadeFill(cloth, r.x, 0, r.x + r.w, 0, 0.3).stroke();
    p.poly([[cx, r.y + 0.6 * u], [cx + 0.45 * u, ground - 0.1 * u], [cx - 0.45 * u, ground - 0.1 * u]]).fill(darken(cloth, 0.45)).stroke(0.7);
    p.poly([[cx, r.y + 0.2 * u], [r.x + r.w - 0.05 * u, ground - 0.1 * u], [cx + 0.2 * u, ground - 0.1 * u]]).shade(0.15);
    p.line([[cx, r.y + 0.2 * u], [cx, r.y - 0.15 * u]], '#6a4a2a', 1.2);
}

export function torii(p: Pen, r: Rect, [paint]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    for (const fx of [0.55, r.w / u - 0.85]) p.rect(r.x + fx * u, r.y + 0.5 * u, 0.3 * u, ground - r.y - 0.55 * u).shadeFill(paint, r.x + fx * u, 0, r.x + (fx + 0.3) * u, 0, 0.3).stroke();
    p.rect(r.x + 0.3 * u, r.y + 0.95 * u, r.w - 0.6 * u, 0.22 * u).paint(paint);
    p.ctx.beginPath();
    p.ctx.moveTo(r.x, r.y + 0.35 * u);
    p.ctx.quadraticCurveTo(r.x + r.w / 2, r.y + 0.55 * u, r.x + r.w, r.y + 0.35 * u);
    p.ctx.lineTo(r.x + r.w - 0.1 * u, r.y + 0.62 * u);
    p.ctx.quadraticCurveTo(r.x + r.w / 2, r.y + 0.78 * u, r.x + 0.1 * u, r.y + 0.62 * u);
    p.ctx.closePath();
    p.fill('#2a2a30').stroke();
}

export function archGate(p: Pen, r: Rect, [stone]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    for (const fx of [0, r.w / u - 0.7]) p.rect(r.x + fx * u, r.y + 0.6 * u, 0.7 * u, ground - r.y - 0.65 * u).shadeFill(stone, r.x + fx * u, 0, r.x + (fx + 0.7) * u, 0, 0.3).stroke();
    p.ctx.beginPath();
    p.ctx.moveTo(r.x, r.y + 0.3 * u);
    p.ctx.lineTo(r.x + r.w, r.y + 0.3 * u);
    p.ctx.lineTo(r.x + r.w, r.y + 1.6 * u);
    p.ctx.lineTo(r.x + r.w - 0.7 * u, r.y + 1.6 * u);
    p.ctx.quadraticCurveTo(r.x + r.w / 2, r.y + 0.6 * u, r.x + 0.7 * u, r.y + 1.6 * u);
    p.ctx.lineTo(r.x, r.y + 1.6 * u);
    p.ctx.closePath();
    p.shadeFill(stone, 0, r.y, 0, r.y + 1.6 * u, 0.25).stroke();
    p.rect(r.x - 0.1 * u, r.y + 0.15 * u, r.w + 0.2 * u, 0.22 * u).paint(lighten(stone, 0.1), 0.8);
}

/* --------------------------------------------------------------- nature */

export function palm(p: Pen, r: Rect, [leaves, trunk]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.1 * u, 0.6 * u, 0.2 * u);
    p.ctx.beginPath();
    p.ctx.moveTo(cx - 0.12 * u, ground - 0.1 * u);
    p.ctx.quadraticCurveTo(cx - 0.35 * u, r.y + r.h * 0.6, cx + 0.05 * u, r.y + 0.9 * u);
    p.ctx.lineTo(cx + 0.25 * u, r.y + 0.95 * u);
    p.ctx.quadraticCurveTo(cx - 0.1 * u, r.y + r.h * 0.6, cx + 0.14 * u, ground - 0.1 * u);
    p.ctx.closePath();
    p.shadeFill(trunk, cx - 0.3 * u, 0, cx + 0.3 * u, 0, 0.3).stroke();
    const hx = cx + 0.15 * u, hy = r.y + 0.85 * u;
    for (const [a, l] of [[-2.6, 1.0], [-2.0, 1.1], [-1.2, 0.9], [-0.5, 1.1], [0.1, 1.0], [-3.0, 0.8]] as [number, number][]) {
        const ex = hx + Math.cos(a) * l * u, ey = hy + Math.sin(a) * l * u * 0.6 + 0.35 * u;
        p.ctx.beginPath();
        p.ctx.moveTo(hx, hy);
        p.ctx.quadraticCurveTo((hx + ex) / 2 + Math.sin(a) * 0.2 * u, (hy + ey) / 2 - 0.35 * u, ex, ey);
        p.ctx.quadraticCurveTo((hx + ex) / 2, (hy + ey) / 2, hx, hy);
        p.shadeFill(leaves, hx, hy - 0.5 * u, hx, ey, 0.25).stroke(0.8);
    }
    for (const dx of [-0.1, 0.12]) p.ell(hx + dx * u, hy + 0.12 * u, 0.1 * u, 0.1 * u).paint('#6a4a2a', 0.6);
}

export function cactus(p: Pen, r: Rect, [green]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.08 * u, 0.4 * u, 0.12 * u);
    p.rr(cx - 0.22 * u, r.y + 0.15 * u, 0.44 * u, r.h - 0.2 * u, 0.22 * u).shadeFill(green, cx - 0.22 * u, 0, cx + 0.22 * u, 0, 0.3).stroke();
    p.rr(cx - 0.62 * u, r.y + 0.7 * u, 0.3 * u, 0.7 * u, 0.15 * u).shadeFill(green, 0, 0, 0, 0).stroke();
    p.rect(cx - 0.4 * u, r.y + 1.2 * u, 0.2 * u, 0.2 * u).fill(green);
    p.rr(cx + 0.32 * u, r.y + 0.45 * u, 0.3 * u, 0.6 * u, 0.15 * u).shadeFill(green, 0, 0, 0, 0).stroke();
    p.rect(cx + 0.2 * u, r.y + 0.85 * u, 0.2 * u, 0.2 * u).fill(green);
    p.line([[cx, r.y + 0.3 * u], [cx, ground - 0.2 * u]], darken(green, 0.3), 0.6, 0.6);
}

export function deadTree(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.1 * u, 0.5 * u, 0.16 * u);
    const branch = (x0: number, y0: number, a: number, len: number, w: number, depth: number) => {
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
        p.line([[x0, y0], [x1, y1]], wood, w);
        if (depth > 0) { branch(x1, y1, a - 0.5, len * 0.65, w * 0.65, depth - 1); branch(x1, y1, a + 0.45, len * 0.6, w * 0.65, depth - 1); }
    };
    branch(cx, ground - 0.1 * u, -Math.PI / 2, r.h * 0.42, 5, 3);
}

export function stump(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.1 * u, 0.4 * u, 0.13 * u);
    p.rect(cx - 0.32 * u, ground - 0.6 * u, 0.64 * u, 0.5 * u).shadeFill(wood, cx - 0.32 * u, 0, cx + 0.32 * u, 0, 0.3).stroke();
    p.ell(cx, ground - 0.1 * u, 0.32 * u, 0.1 * u).fill(wood).stroke();
    p.ell(cx, ground - 0.6 * u, 0.32 * u, 0.13 * u).fill(lighten(wood, 0.35)).stroke();
    p.ell(cx, ground - 0.6 * u, 0.16 * u, 0.06 * u).stroke(0.5);
}

export function log(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.1 * u, r.w * 0.5, 0.15 * u);
    p.rr(r.x + 0.2 * u, ground - 0.62 * u, r.w - 0.4 * u, 0.52 * u, 0.26 * u).shadeFill(wood, 0, ground - 0.62 * u, 0, ground, 0.3).stroke();
    p.ell(r.x + r.w - 0.3 * u, ground - 0.36 * u, 0.16 * u, 0.26 * u).fill(lighten(wood, 0.35)).stroke();
    for (let x = r.x + 0.5 * u; x < r.x + r.w - 0.5 * u; x += 0.45 * u) p.line([[x, ground - 0.5 * u], [x + 0.2 * u, ground - 0.5 * u]], null, 0.5, 0.5);
}

export function mushrooms(p: Pen, r: Rect, [cap]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    for (const [fx, s] of [[0.35, 1], [0.68, 0.7], [0.5, 0.5]] as [number, number][]) {
        const x = r.x + fx * r.w, y = ground - 0.12 * u;
        p.rect(x - 0.06 * u * s, y - 0.35 * u * s, 0.12 * u * s, 0.35 * u * s).paint('#f4ecdc', 0.6);
        p.ctx.beginPath();
        p.ctx.ellipse(x, y - 0.35 * u * s, 0.24 * u * s, 0.2 * u * s, 0, Math.PI, 0);
        p.ctx.closePath();
        p.fill(cap).stroke(0.7);
        p.ell(x - 0.08 * u * s, y - 0.45 * u * s, 0.04 * u * s, 0.04 * u * s).fill('#ffffff');
    }
}

export function pond(p: Pen, r: Rect, [water, edge]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    p.ell(cx, cy, r.w / 2 - 0.05 * u, r.h / 2 - 0.05 * u).fill(edge).stroke();
    p.ell(cx, cy + 0.03 * u, r.w / 2 - 0.25 * u, r.h / 2 - 0.22 * u).shadeFill(water, cx - r.w / 2, cy - r.h / 2, cx + r.w / 2, cy + r.h / 2, 0.3).stroke(0.6);
    p.ell(cx - r.w * 0.15, cy - r.h * 0.12, r.w * 0.12, r.h * 0.05).shine(0.35);
    p.ell(cx + r.w * 0.2, cy + r.h * 0.1, 0.25 * u, 0.12 * u).fill('#5aa04a');
}

export function grassTuft(p: Pen, r: Rect, [green]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.reseed(Math.round(r.x + r.y));
    for (let i = 0; i < 14; i++) {
        const x = r.x + 0.1 * u + p.rnd() * (r.w - 0.2 * u), h = (0.35 + p.rnd() * 0.45) * u;
        p.line([[x, ground - 0.08 * u], [x + (p.rnd() - 0.5) * 0.25 * u, ground - 0.08 * u - h]], p.rnd() < 0.5 ? green : darken(green, 0.2), 1.4);
    }
}

/* --------------------------------------------------------------- street */

export function barrel(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h, w = 0.62 * u;
    p.groundShadow(cx, ground - 0.08 * u, 0.4 * u, 0.12 * u);
    p.rr(cx - w / 2, r.y + 0.2 * u, w, r.h - 0.3 * u, 0.12 * u).shadeFill(wood, cx - w / 2, 0, cx + w / 2, 0, 0.35).stroke();
    for (const fy of [0.32, 0.72]) p.rect(cx - w / 2, r.y + 0.2 * u + (r.h - 0.3 * u) * fy, w, 0.07 * u).fill('#4a4a50');
    p.ell(cx, r.y + 0.22 * u, w / 2, 0.1 * u).fill(lighten(wood, 0.2)).stroke(0.7);
}

export function trashCan(p: Pen, r: Rect, [metal]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.08 * u, 0.32 * u, 0.1 * u);
    p.poly([[cx - 0.26 * u, r.y + 0.35 * u], [cx + 0.26 * u, r.y + 0.35 * u], [cx + 0.22 * u, ground - 0.1 * u], [cx - 0.22 * u, ground - 0.1 * u]]).shadeFill(metal, cx - 0.26 * u, 0, cx + 0.26 * u, 0, 0.35).stroke();
    for (let x = cx - 0.15 * u; x <= cx + 0.16 * u; x += 0.15 * u) p.line([[x, r.y + 0.45 * u], [x, ground - 0.2 * u]], null, 0.5, 0.5);
    p.rr(cx - 0.3 * u, r.y + 0.22 * u, 0.6 * u, 0.16 * u, 0.06 * u).paint(darken(metal, 0.15), 0.8);
}

export function vending(p: Pen, r: Rect, [body]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.08 * u, r.w * 0.45, 0.12 * u);
    p.rr(r.x + 0.12 * u, r.y + 0.1 * u, r.w - 0.24 * u, r.h - 0.18 * u, 0.08 * u).shadeFill(body, r.x, 0, r.x + r.w, 0, 0.3).stroke();
    p.glass(r.x + 0.22 * u, r.y + 0.25 * u, r.w * 0.55, r.h * 0.55, true);
    const colors = ['#e04848', '#3a8ad0', '#f0b030', '#58a848'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3; i++) {
        p.rr(r.x + 0.3 * u + i * r.w * 0.16, r.y + 0.35 * u + row * r.h * 0.17, 0.1 * u, 0.22 * u, 0.03 * u).fill(colors[(row + i) % 4]);
    }
    p.rect(r.x + r.w * 0.7, r.y + 0.35 * u, 0.15 * u, 0.4 * u).fill('#2a2a30').stroke(0.5);
    p.rect(r.x + 0.25 * u, ground - 0.45 * u, r.w * 0.5, 0.18 * u).fill('#2a2a30').stroke(0.5);
}

export function busStop(p: Pen, r: Rect, [roof, frame]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.1 * u, r.w * 0.5, 0.18 * u);
    p.ctx.save(); p.ctx.globalAlpha = 0.5;
    p.rect(r.x + 0.2 * u, r.y + 0.6 * u, r.w - 0.4 * u, ground - r.y - 0.9 * u).fill('#cfe8f2');
    p.ctx.restore();
    for (const fx of [0.2, r.w / u - 0.28]) p.rect(r.x + fx * u, r.y + 0.5 * u, 0.08 * u, ground - r.y - 0.6 * u).paint(frame, 0.6);
    p.rect(r.x + 0.4 * u, ground - 0.7 * u, r.w - 0.8 * u, 0.18 * u).paint('#a87444', 0.7);
    p.rr(r.x + 0.05 * u, r.y + 0.3 * u, r.w - 0.1 * u, 0.3 * u, 0.06 * u).shadeFill(roof, 0, r.y, 0, r.y + 0.6 * u).stroke();
    p.ell(r.x + r.w - 0.25 * u, r.y + 0.15 * u, 0.18 * u, 0.18 * u).paint('#f0f0f0', 0.7);
}

export function noticeBoard(p: Pen, r: Rect, [wood, paper]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.08 * u, r.w * 0.45, 0.12 * u);
    for (const fx of [0.2, r.w / u - 0.32]) p.rect(r.x + fx * u, r.y + 0.3 * u, 0.12 * u, ground - r.y - 0.38 * u).paint(wood, 0.7);
    p.rect(r.x + 0.1 * u, r.y + 0.25 * u, r.w - 0.2 * u, r.h * 0.5).shadeFill(darken(wood, 0.15), 0, 0, 0, 0).stroke();
    p.reseed(3);
    for (let i = 0; i < 4; i++) p.rect(r.x + (0.25 + (i % 2) * 0.75) * u, r.y + (0.38 + Math.floor(i / 2) * 0.42) * u, 0.55 * u, 0.32 * u).paint(paint4(paper, i), 0.5);
    p.poly([[r.x, r.y + 0.3 * u], [r.x + r.w / 2, r.y], [r.x + r.w, r.y + 0.3 * u]]).paint(wood, 0.8);
}
const paint4 = (c: string, i: number) => [c, '#f0d8a0', '#d8e8f8', '#f8d0d0'][i % 4];

export function picnicTable(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.2 * u, r.w * 0.5, 0.3 * u);
    p.rect(r.x + 0.1 * u, r.y + 0.15 * u, r.w - 0.2 * u, 0.22 * u).paint(darken(wood, 0.05), 0.8);
    p.rect(r.x + 0.25 * u, r.y + 0.5 * u, r.w - 0.5 * u, 0.7 * u).shadeFill(lighten(wood, 0.08), 0, 0, 0, 0).stroke();
    for (let y = r.y + 0.73 * u; y < r.y + 1.2 * u; y += 0.23 * u) p.line([[r.x + 0.25 * u, y], [r.x + r.w - 0.25 * u, y]], null, 0.5, 0.5);
    for (const fx of [0.5, r.w / u - 0.62]) p.rect(r.x + fx * u, r.y + 1.2 * u, 0.12 * u, 0.35 * u).paint(darken(wood, 0.2), 0.6);
    p.rect(r.x + 0.1 * u, ground - 0.45 * u, r.w - 0.2 * u, 0.22 * u).paint(wood, 0.8);
}

export function cafeTable(p: Pen, r: Rect, [umbrella, table]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.15 * u, r.w * 0.45, 0.25 * u);
    p.line([[cx, r.y + 0.6 * u], [cx, ground - 0.3 * u]], '#6a6a70', 1.2);
    p.ell(cx, ground - 0.7 * u, 0.5 * u, 0.2 * u).paint(table, 0.8);
    p.rect(cx - 0.04 * u, ground - 0.7 * u, 0.08 * u, 0.55 * u).paint('#6a6a70', 0.6);
    for (const dx of [-0.75, 0.6]) p.rr(cx + dx * u, ground - 0.62 * u, 0.15 * u, 0.5 * u, 0.04 * u).paint('#8a5a3a', 0.6);
    const n = 8;
    for (let i = 0; i < n; i++) {
        const a0 = Math.PI + i / n * Math.PI, a1 = Math.PI + (i + 1) / n * Math.PI;
        p.poly([[cx, r.y + 0.15 * u], [cx + Math.cos(a0) * r.w * 0.5, r.y + 0.8 * u + Math.sin(a0) * -0.1 * u], [cx + Math.cos(a1) * r.w * 0.5, r.y + 0.8 * u + Math.sin(a1) * -0.1 * u]])
            .fill(i % 2 ? '#fbf6ec' : umbrella);
    }
    p.ctx.beginPath(); p.ctx.moveTo(cx, r.y + 0.15 * u); p.ctx.lineTo(r.x, r.y + 0.8 * u); p.ctx.lineTo(r.x + r.w, r.y + 0.8 * u); p.ctx.closePath(); p.stroke();
}

export function planter(p: Pen, r: Rect, [box, flowersC]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.08 * u, r.w * 0.5, 0.12 * u);
    p.reseed(9);
    for (let i = 0; i < 8; i++) p.ell(r.x + (0.25 + p.rnd() * (r.w / u - 0.5)) * u, ground - (0.7 + p.rnd() * 0.3) * u, 0.18 * u, 0.15 * u).paint(i % 3 ? '#4a9a4a' : flowersC, 0.5);
    p.rect(r.x + 0.08 * u, ground - 0.62 * u, r.w - 0.16 * u, 0.52 * u).shadeFill(box, 0, 0, 0, 0, 0.3).stroke();
    p.rect(r.x + 0.04 * u, ground - 0.66 * u, r.w - 0.08 * u, 0.1 * u).paint(lighten(box, 0.1), 0.6);
}

export function flagpole(p: Pen, r: Rect, [flag]: string[]): void {
    const u = p.u, cx = r.x + r.w * 0.3, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.08 * u, 0.3 * u, 0.1 * u);
    p.line([[cx, ground - 0.1 * u], [cx, r.y + 0.1 * u]], '#8a8a90', 1.5);
    p.ctx.beginPath();
    p.ctx.moveTo(cx, r.y + 0.2 * u);
    p.ctx.quadraticCurveTo(cx + 0.5 * u, r.y + 0.05 * u, cx + 1.0 * u, r.y + 0.3 * u);
    p.ctx.lineTo(cx + 1.0 * u, r.y + 0.9 * u);
    p.ctx.quadraticCurveTo(cx + 0.5 * u, r.y + 0.65 * u, cx, r.y + 0.8 * u);
    p.ctx.closePath();
    p.shadeFill(flag, cx, 0, cx + u, 0, 0.3).stroke(0.8);
    p.ell(cx, r.y + 0.08 * u, 0.07 * u, 0.07 * u).fill('#d8b040');
}

export function campfire(p: Pen, r: Rect, [flame]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.glow(cx, ground - 0.5 * u, 2.2 * u);
    for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        p.ell(cx + Math.cos(a) * 0.36 * u, ground - 0.3 * u + Math.sin(a) * 0.14 * u, 0.12 * u, 0.09 * u).paint('#8a8478', 0.6);
    }
    p.line([[cx - 0.3 * u, ground - 0.2 * u], [cx + 0.3 * u, ground - 0.45 * u]], '#6a4428', 2.2);
    p.line([[cx + 0.3 * u, ground - 0.2 * u], [cx - 0.3 * u, ground - 0.45 * u]], '#5a3820', 2.2);
    p.ctx.beginPath();
    p.ctx.moveTo(cx - 0.25 * u, ground - 0.35 * u);
    p.ctx.quadraticCurveTo(cx - 0.3 * u, ground - 0.8 * u, cx, ground - 1.1 * u);
    p.ctx.quadraticCurveTo(cx + 0.3 * u, ground - 0.8 * u, cx + 0.25 * u, ground - 0.35 * u);
    p.ctx.closePath();
    p.fill(flame).stroke(0.6);
    p.ell(cx, ground - 0.5 * u, 0.1 * u, 0.18 * u).fill('#ffe080');
}

export function cart(p: Pen, r: Rect, [wood, cloth]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.1 * u, r.w * 0.5, 0.15 * u);
    p.line([[r.x + r.w - 0.2 * u, ground - 0.7 * u], [r.x + r.w + 0.3 * u, ground - 0.4 * u]], wood, 1.6);
    p.rect(r.x + 0.15 * u, ground - 1.15 * u, r.w - 0.3 * u, 0.6 * u).shadeFill(wood, 0, 0, 0, 0, 0.3).stroke();
    p.ctx.beginPath();
    p.ctx.moveTo(r.x + 0.2 * u, ground - 1.1 * u);
    p.ctx.quadraticCurveTo(r.x + r.w / 2, r.y - 0.1 * u, r.x + r.w - 0.2 * u, ground - 1.1 * u);
    p.ctx.closePath();
    p.shadeFill(cloth, 0, r.y, 0, ground - u, 0.2).stroke();
    for (const fx of [0.5, r.w / u - 0.5]) {
        p.ell(r.x + fx * u, ground - 0.35 * u, 0.3 * u, 0.3 * u).paint(darken(wood, 0.15));
        p.ell(r.x + fx * u, ground - 0.35 * u, 0.06 * u, 0.06 * u).fill('#3a3a40');
    }
}

export function hydrant(p: Pen, r: Rect, [body]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.groundShadow(cx, ground - 0.06 * u, 0.25 * u, 0.08 * u);
    p.rr(cx - 0.17 * u, r.y + 0.3 * u, 0.34 * u, r.h - 0.38 * u, [0.17 * u, 0.17 * u, 0.03 * u, 0.03 * u]).shadeFill(body, cx - 0.17 * u, 0, cx + 0.17 * u, 0, 0.35).stroke();
    p.rect(cx - 0.28 * u, r.y + 0.55 * u, 0.56 * u, 0.13 * u).paint(darken(body, 0.15), 0.6);
    p.rect(cx - 0.22 * u, ground - 0.15 * u, 0.44 * u, 0.08 * u).paint(darken(body, 0.2), 0.5);
}

export function bridge(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u;
    p.rect(r.x, r.y + 0.15 * u, r.w, r.h - 0.3 * u).shadeFill(wood, 0, 0, 0, 0).stroke();
    for (let x = r.x + 0.25 * u; x < r.x + r.w; x += 0.3 * u) p.line([[x, r.y + 0.15 * u], [x, r.y + r.h - 0.15 * u]], null, 0.5, 0.55);
    for (const y of [r.y + 0.12 * u, r.y + r.h - 0.2 * u]) {
        p.rect(r.x, y, r.w, 0.1 * u).paint(darken(wood, 0.25), 0.6);
        for (let x = r.x + 0.1 * u; x < r.x + r.w; x += 0.9 * u) p.rect(x, y - 0.12 * u, 0.12 * u, 0.25 * u).paint(darken(wood, 0.3), 0.6);
    }
}

export function dock(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u;
    p.rect(r.x + 0.05 * u, r.y + 0.05 * u, r.w - 0.1 * u, r.h - 0.1 * u).shadeFill(wood, 0, 0, 0, 0).stroke();
    for (let y = r.y + 0.35 * u; y < r.y + r.h; y += 0.3 * u) p.line([[r.x + 0.05 * u, y], [r.x + r.w - 0.05 * u, y]], null, 0.5, 0.5);
    for (const [fx, fy] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) p.ell(r.x + r.w * fx, r.y + r.h * fy, 0.12 * u, 0.12 * u).paint(darken(wood, 0.3), 0.6);
}
