import type { Pen, Rect } from './looks';
import { darken, lighten } from './looks';
import { building } from './buildings';

/* More of a modern town (owner's request, 2026-11-08: more variety): towers,
   a factory, a petrol station, cars and a playground. Same conventions as
   props.ts; `v` is the catalogue's variant. */

/** An office tower: a glass curtain wall (v0), a concrete grid (v1), stepped (v2). */
export function officeTower(p: Pen, r: Rect, [wall, glass, roof]: string[], _rot: boolean, v: number): void {
    const u = p.u;
    if (v === 2) {
        const lower: Rect = { x: r.x, y: r.y + r.h * 0.45, w: r.w, h: r.h * 0.55 };
        const upper: Rect = { x: r.x + r.w * 0.18, y: r.y, w: r.w * 0.64, h: r.h * 0.62 };
        building(p, upper, { roof, wall: glass, floors: 4, roofKind: 'flat', wallMat: 'glass', door_: 'none', windows: 0, trim: darken(wall, 0.2) });
        building(p, lower, { roof, wall, floors: 3, roofKind: 'flat', wallMat: 'glass', door_: 'glass', windows: 0, trim: darken(wall, 0.2), storefront: true, glass });
        return;
    }
    building(p, r, {
        roof, wall: v === 0 ? glass : wall, floors: Math.max(3, Math.round((r.h / u - 2) / 1.4)), roofKind: 'flat',
        wallMat: v === 0 ? 'glass' : 'plaster', windowKind: 'wide', windows: v === 0 ? 0 : Math.max(2, Math.round(r.w / u / 1.3)),
        door_: 'glass', trim: darken(wall, 0.25), storefront: v === 0, glass: v === 1 ? glass : undefined,
    });
    /* An antenna on the roof. */
    const ax = r.x + r.w * 0.7;
    p.line([[ax, r.y + 0.6 * u], [ax, r.y - 0.6 * u]], '#5a5a60', 1);
    p.ell(ax, r.y - 0.6 * u, 0.07 * u, 0.07 * u).fill('#e04040');
}

/** A factory: saw-tooth roof with a stack (v0), a big shed with two stacks (v1), a plant with tanks (v2). */
export function factory(p: Pen, r: Rect, [wall, roof, stack]: string[], _rot: boolean, v: number): void {
    const u = p.u, ground = r.y + r.h;
    const stackAt = (x: number, top: number) => {
        p.rect(x, top, 0.5 * u, ground - top - 1.5 * u).shadeFill(stack, x, 0, x + 0.5 * u, 0, 0.35).stroke();
        for (const t of [0.15, 0.3]) p.rect(x, top + (ground - top) * t, 0.5 * u, 0.12 * u).fill('#f4f0e8');
        p.ell(x + 0.25 * u, top, 0.25 * u, 0.08 * u).fill('#2a2420');
        if (!p.look.night) for (let i = 0; i < 3; i++) p.ell(x + (0.3 + i * 0.35) * u, top - (0.35 + i * 0.3) * u, (0.22 + i * 0.08) * u, (0.18 + i * 0.06) * u).fill('#d8d8dc');
    };
    if (v === 2) {
        building(p, { x: r.x, y: r.y + 1.0 * u, w: r.w * 0.6, h: r.h - 1.0 * u }, { roof, wall, floors: 2, roofKind: 'flat', wallMat: 'siding', door_: 'barn', door: darken(wall, 0.3), windows: 2, trim: darken(wall, 0.3) });
        for (const [fx, fh] of [[0.66, 0.6], [0.84, 0.48]] as const) {
            const tw = r.w * 0.16, tx = r.x + r.w * fx, th = r.h * fh;
            p.rr(tx, ground - th, tw, th - 0.05 * u, [0, 0, tw * 0.2, tw * 0.2]).shadeFill('#d8dce0', tx, 0, tx + tw, 0, 0.35).stroke();
            p.ell(tx + tw / 2, ground - th, tw / 2, 0.18 * u).fill('#eef0f2').stroke(0.7);
            p.line([[tx, ground - th * 0.5], [tx + tw, ground - th * 0.5]], null, 0.6);
        }
        stackAt(r.x + r.w * 0.45, r.y);
        return;
    }
    const body: Rect = { x: r.x, y: r.y + 1.4 * u, w: r.w, h: r.h - 1.4 * u };
    building(p, body, { roof, wall, floors: 1, roofKind: v === 1 ? 'gable' : 'flat', roofMat: 'metal', wallMat: v === 1 ? 'siding' : 'brick', door_: 'barn', door: '#8a9098', windows: 3, wallH: 2.3, windowKind: 'wide', trim: darken(wall, 0.3) });
    if (v === 0) {
        /* Saw-tooth skylights along the flat roof. */
        const top = body.y + 0.3 * u, n = Math.max(2, Math.floor(r.w / u / 1.4));
        for (let i = 0; i < n; i++) {
            const x = r.x + 0.3 * u + i * (r.w - 0.6 * u) / n, w = (r.w - 0.6 * u) / n;
            p.poly([[x, top + 1.0 * u], [x + w * 0.7, top + 0.2 * u], [x + w * 0.7, top + 1.0 * u]]).fill(roof).stroke(0.7);
            p.poly([[x + w * 0.7, top + 0.2 * u], [x + w, top + 1.0 * u], [x + w * 0.7, top + 1.0 * u]]).fill('#9cc8e4').stroke(0.7);
        }
        stackAt(r.x + r.w - 1.0 * u, r.y);
        return;
    }
    stackAt(r.x + 0.6 * u, r.y);
    stackAt(r.x + 1.4 * u, r.y + 0.5 * u);
}

/** A petrol station: canopy over pumps with a shop behind; v1 a single pump; v2 a charging station. */
export function fuelStation(p: Pen, r: Rect, [canopy, wall, pump]: string[], _rot: boolean, v: number): void {
    const u = p.u, ground = r.y + r.h;
    if (v !== 1) building(p, { x: r.x + r.w * 0.45, y: r.y + 0.4 * u, w: r.w * 0.55, h: r.h - 1.6 * u }, { roof: canopy, wall, floors: 1, roofKind: 'flat', door_: 'glass', storefront: true, windows: 0, accent: canopy });
    p.groundShadow(r.x + r.w * 0.3, ground - 0.15 * u, r.w * 0.32, 0.3 * u);
    const cx = r.x + (v === 1 ? r.w / 2 : r.w * 0.3), cw = v === 1 ? r.w * 0.7 : r.w * 0.55, ct = r.y + 0.9 * u;
    for (const s of [-1, 1]) p.rect(cx + s * cw * 0.32 - 0.1 * u, ct + 0.4 * u, 0.2 * u, ground - ct - 0.5 * u).paint(darken(wall, 0.08), 0.7);
    for (const s of v === 1 ? [0] : [-0.5, 0.5]) {
        const px = cx + s * cw * 0.6 - 0.2 * u, py = ground - 1.15 * u;
        p.rr(px, py, 0.4 * u, 1.0 * u, 0.06 * u).shadeFill(pump, px, 0, px + 0.4 * u, 0, 0.3).stroke();
        p.rect(px + 0.07 * u, py + 0.12 * u, 0.26 * u, 0.22 * u).fill(v === 2 ? '#7ae0a0' : '#e8f0f4').stroke(0.5);
        if (v === 2) p.line([[px + 0.4 * u, py + 0.5 * u], [px + 0.55 * u, py + 0.75 * u], [px + 0.45 * u, py + 0.95 * u]], '#2a2a30', 0.9);
    }
    p.rect(cx - cw / 2, ct, cw, 0.42 * u).shadeFill(canopy, 0, ct, 0, ct + 0.42 * u, 0.2).stroke();
    p.rect(cx - cw / 2, ct + 0.3 * u, cw, 0.12 * u).fill('#ffffff');
    p.rect(cx - cw / 2, ct - 0.5 * u, cw, 0.5 * u).fill(lighten(canopy, 0.2)).stroke(0.7);
    if (p.look.night) p.glow(cx, ct + 0.6 * u, cw * 0.6);
}

/** A parked car seen from the slant: a saloon (v0), a van (v1), a small hatchback (v2). Turned, nose down the map. */
export function car(p: Pen, r: Rect, [body]: string[], rot: boolean, v: number): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.2 * u, r.w * 0.5, 0.25 * u);
    const wheels = (pts: number[], y: number) => pts.forEach((x) => p.ell(x, y, 0.17 * u, 0.13 * u).fill('#22222a'));
    if (rot) {
        /* Front-on: a box, a windscreen, two lights. */
        const x = r.x + 0.1 * u, w = r.w - 0.2 * u, top = r.y + 0.3 * u;
        p.rr(x, top, w, r.h - 0.6 * u, 0.3 * u).shadeFill(body, x, 0, x + w, 0, 0.3).stroke();
        p.rr(x + 0.12 * u, top + 0.2 * u, w - 0.24 * u, (v === 1 ? 0.5 : 0.7) * u, 0.15 * u).fill(darken(body, 0.15)).stroke(0.6);
        p.glass(x + 0.15 * u, ground - 1.35 * u, w - 0.3 * u, 0.42 * u, false);
        for (const s of [0.18, 0.82]) p.ell(x + w * s, ground - 0.62 * u, 0.1 * u, 0.07 * u).fill(p.look.night ? '#fff0b0' : '#f4f4e8');
        if (p.look.night) p.glow(r.x + r.w / 2, ground - 0.3 * u, 1.2 * u);
        wheels([x + 0.2 * u, x + w - 0.2 * u], ground - 0.3 * u);
        return;
    }
    const x = r.x + 0.08 * u, w = r.w - 0.16 * u, base = ground - 0.35 * u;
    const roofH = v === 1 ? 1.0 * u : 0.65 * u;
    const cab = v === 1 ? [x + 0.1 * u, x + w - 0.6 * u] : v === 2 ? [x + w * 0.2, x + w * 0.85] : [x + w * 0.25, x + w * 0.72];
    p.rr(x, base - 0.55 * u, w, 0.55 * u, 0.18 * u).shadeFill(body, 0, base - 0.55 * u, 0, base, 0.25).stroke();
    p.poly([[cab[0] - 0.25 * u, base - 0.5 * u], [cab[0], base - 0.5 * u - roofH], [cab[1], base - 0.5 * u - roofH], [cab[1] + (v === 1 ? 0.5 : 0.35) * u, base - 0.5 * u]])
        .shadeFill(body, 0, base - roofH, 0, base, 0.2).stroke();
    p.rect(cab[0] + 0.05 * u, base - 0.45 * u - roofH, cab[1] - cab[0] - 0.1 * u, 0.12 * u).shine(0.35);
    const gy = base - 0.45 * u - roofH * 0.75, gh = roofH * 0.6;
    p.glass(cab[0] + 0.02 * u, gy, (cab[1] - cab[0]) * 0.46, gh, false);
    p.glass(cab[0] + (cab[1] - cab[0]) * 0.52, gy, (cab[1] - cab[0]) * 0.46, gh, false);
    p.ell(x + w - 0.08 * u, base - 0.35 * u, 0.06 * u, 0.08 * u).fill(p.look.night ? '#fff0b0' : '#f4f4e8');
    p.ell(x + 0.06 * u, base - 0.35 * u, 0.05 * u, 0.08 * u).fill('#e04040');
    wheels([x + 0.45 * u, x + w - 0.45 * u], base + 0.05 * u);
}

/** A traffic light (v0) or a pedestrian crossing light (v1). */
export function trafficLight(p: Pen, r: Rect, [metal]: string[], _rot: boolean, v: number): void {
    const u = p.u, ground = r.y + r.h, cx = r.x + r.w / 2;
    p.groundShadow(cx, ground - 0.08 * u, 0.2 * u, 0.07 * u);
    p.line([[cx, ground], [cx, r.y + 0.6 * u]], metal, 1.4);
    const n = v === 1 ? 2 : 3, bh = n * 0.3 * u + 0.1 * u, by = r.y + 0.15 * u;
    p.rr(cx - 0.18 * u, by, 0.36 * u, bh, 0.08 * u).shadeFill(metal, cx - 0.18 * u, 0, cx + 0.18 * u, 0).stroke();
    const lamps = v === 1 ? ['#e04040', '#40c060'] : ['#e04040', '#f0b030', '#40c060'];
    lamps.forEach((c, i) => {
        const on = i === lamps.length - 1;
        p.ell(cx, by + 0.2 * u + i * 0.3 * u, 0.1 * u, 0.1 * u).fill(on ? c : darken(c, 0.55));
        if (on) p.glow(cx, by + 0.2 * u + i * 0.3 * u, 0.8 * u);
    });
}

export function phoneBooth(p: Pen, r: Rect, [body]: string[]): void {
    const u = p.u, ground = r.y + r.h, x = r.x + 0.08 * u, w = r.w - 0.16 * u;
    p.groundShadow(r.x + r.w / 2, ground - 0.08 * u, r.w * 0.5, 0.12 * u);
    p.rr(x, r.y + 0.2 * u, w, r.h - 0.25 * u, [0.12 * u, 0.12 * u, 0, 0]).shadeFill(body, x, 0, x + w, 0, 0.3).stroke();
    p.glass(x + 0.1 * u, r.y + 0.6 * u, w - 0.2 * u, r.h - 1.0 * u, true);
    for (let y = r.y + 0.9 * u; y < ground - 0.4 * u; y += 0.3 * u) p.line([[x + 0.1 * u, y], [x + w - 0.1 * u, y]], body, 0.7);
    p.rect(x + 0.1 * u, r.y + 0.28 * u, w - 0.2 * u, 0.2 * u).fill('#ffffff');
}

/** A billboard on legs (v0), a bus-stop style advert column (v1). */
export function billboard(p: Pen, r: Rect, [frame, poster]: string[], _rot: boolean, v: number): void {
    const u = p.u, ground = r.y + r.h, cx = r.x + r.w / 2;
    if (v === 1) {
        p.groundShadow(cx, ground - 0.1 * u, 0.4 * u, 0.12 * u);
        p.rr(cx - 0.35 * u, r.y + 0.3 * u, 0.7 * u, r.h - 0.35 * u, 0.1 * u).shadeFill(frame, cx - 0.35 * u, 0, cx + 0.35 * u, 0, 0.35).stroke();
        p.rect(cx - 0.3 * u, r.y + 0.55 * u, 0.6 * u, r.h - 1.0 * u).shadeFill(poster, cx - 0.3 * u, 0, cx + 0.3 * u, 0, 0.3).stroke(0.6);
        p.ell(cx, r.y + 0.3 * u, 0.4 * u, 0.12 * u).paint(darken(frame, 0.2), 0.7);
        return;
    }
    p.groundShadow(cx, ground - 0.1 * u, r.w * 0.45, 0.15 * u);
    for (const s of [0.25, 0.75]) p.line([[r.x + r.w * s, ground], [r.x + r.w * s, r.y + 1.2 * u]], frame, 1.6);
    const by = r.y + 0.1 * u, bh = 1.3 * u;
    p.rect(r.x, by, r.w, bh).fill(frame).stroke();
    p.rect(r.x + 0.1 * u, by + 0.1 * u, r.w - 0.2 * u, bh - 0.2 * u).shadeFill(poster, r.x, by, r.x + r.w, by + bh, 0.3);
    p.ell(r.x + r.w * 0.3, by + bh * 0.5, 0.35 * u, 0.35 * u).fill('#ffffff');
    p.ell(r.x + r.w * 0.3, by + bh * 0.5, 0.35 * u, 0.35 * u).stroke(0.6);
    p.rect(r.x + r.w * 0.5, by + 0.35 * u, r.w * 0.38, 0.14 * u).fill('#ffffff');
    p.rect(r.x + r.w * 0.5, by + 0.65 * u, r.w * 0.28, 0.1 * u).fill('#ffffff');
    if (p.look.night) p.glow(r.x + r.w / 2, by + bh / 2, r.w * 0.6);
}

/** Playground: a slide (v0), swings (v1), a sandpit (v2, flat). */
export function playground(p: Pen, r: Rect, [paint, metal]: string[], _rot: boolean, v: number): void {
    const u = p.u, ground = r.y + r.h;
    if (v === 2) {
        p.rr(r.x + 0.1 * u, r.y + 0.1 * u, r.w - 0.2 * u, r.h - 0.2 * u, 0.15 * u).fill(paint).stroke();
        p.rr(r.x + 0.25 * u, r.y + 0.25 * u, r.w - 0.5 * u, r.h - 0.5 * u, 0.1 * u).fill('#ecd8a0');
        p.ell(r.x + r.w * 0.35, r.y + r.h * 0.55, 0.3 * u, 0.2 * u).fill(darken('#ecd8a0', 0.1));
        p.rect(r.x + r.w * 0.6, r.y + r.h * 0.4, 0.25 * u, 0.2 * u).paint('#e04848', 0.5);
        return;
    }
    p.groundShadow(r.x + r.w / 2, ground - 0.15 * u, r.w * 0.5, 0.2 * u);
    if (v === 1) {
        const top = r.y + 0.3 * u;
        for (const x of [r.x + 0.2 * u, r.x + r.w - 0.2 * u]) {
            p.line([[x - 0.25 * u, ground - 0.05 * u], [x, top]], metal, 1.4);
            p.line([[x + 0.25 * u, ground - 0.05 * u], [x, top]], metal, 1.4);
        }
        p.line([[r.x + 0.2 * u, top], [r.x + r.w - 0.2 * u, top]], metal, 1.6);
        for (const t of [0.33, 0.66]) {
            const sx = r.x + r.w * t;
            p.line([[sx - 0.18 * u, top], [sx - 0.18 * u, ground - 0.7 * u]], '#5a5a60', 0.6);
            p.line([[sx + 0.18 * u, top], [sx + 0.18 * u, ground - 0.7 * u]], '#5a5a60', 0.6);
            p.rect(sx - 0.24 * u, ground - 0.72 * u, 0.48 * u, 0.1 * u).paint(paint, 0.6);
        }
        return;
    }
    const tx = r.x + 0.2 * u, tw = 0.8 * u, top = ground - 1.8 * u;
    for (const x of [tx, tx + tw]) p.line([[x, ground], [x, top]], metal, 1.4);
    for (let y = ground - 0.3 * u; y > top; y -= 0.3 * u) p.line([[tx, y], [tx + tw, y]], metal, 0.9);
    p.rect(tx - 0.05 * u, top - 0.1 * u, tw + 0.1 * u, 0.15 * u).paint(paint, 0.7);
    p.poly([[tx + tw, top], [tx + tw + 0.15 * u, top - 0.05 * u], [r.x + r.w - 0.1 * u, ground - 0.25 * u], [r.x + r.w - 0.35 * u, ground - 0.15 * u]])
        .shadeFill(paint, tx + tw, top, r.x + r.w, ground, 0.3).stroke();
}

export function bikeRack(p: Pen, r: Rect, [metal, bike]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    p.groundShadow(r.x + r.w / 2, ground - 0.15 * u, r.w * 0.5, 0.15 * u);
    for (let x = r.x + 0.3 * u; x < r.x + r.w - 0.2 * u; x += 0.45 * u) {
        p.ctx.beginPath();
        p.ctx.moveTo(x, ground - 0.1 * u);
        p.ctx.lineTo(x, ground - 0.55 * u);
        p.ctx.arc(x + 0.15 * u, ground - 0.55 * u, 0.15 * u, Math.PI, 0);
        p.ctx.lineTo(x + 0.3 * u, ground - 0.1 * u);
        p.stroke(1.1);
    }
    /* One bike in it. */
    const bx = r.x + r.w * 0.55, by = ground - 0.35 * u;
    for (const dx of [-0.4, 0.4]) p.ell(bx + dx * u, by, 0.25 * u, 0.25 * u).stroke(0.8);
    p.line([[bx - 0.4 * u, by], [bx, by - 0.05 * u], [bx + 0.4 * u, by], [bx + 0.15 * u, by - 0.4 * u], [bx - 0.15 * u, by - 0.35 * u], [bx, by - 0.05 * u]], bike, 1.1);
    p.line([[bx + 0.15 * u, by - 0.4 * u], [bx + 0.2 * u, by - 0.55 * u]], metal, 1);
}
