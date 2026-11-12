import type { Pen, Rect } from './looks';
import { darken, lighten } from './looks';

/* Furniture, seen from above at a slant like everything else (the owner's
   Stardew-like interiors). Most furniture is a BLOCK: a lighter top face
   over a front face, with its details drawn on; `block` does that part, so
   each piece is its details. `r` is the sprite in px; its bottom edge is
   the front of the footprint, where the piece meets the floor.

   The house style (2026-11-09, the owner found the first set hard to read):
   light from the top left, so a top face is lighter, the edge where it meets
   the front catches a highlight and the right-hand side of a front is a
   touch darker; doors and drawers are raised panels with knobs; things
   stand on feet or a plinth; and most pieces carry one or two small objects
   that say what they are (a mug, a book, sheet music, a rubber duck). */

const BRASS = '#e0b850';
const STEEL = '#c8ccd4';
const INK_DARK = '#2a2420';

/** A box seen from above-front: top face `top` cells deep, the rest front.
    Returns the two faces for details. */
function block(p: Pen, r: Rect, hex: string, top: number, inset = 0.06): { t: Rect; f: Rect } {
    const u = p.u, i = inset * u;
    const t: Rect = { x: r.x + i, y: r.y + i, w: r.w - i * 2, h: top * u };
    const f: Rect = { x: r.x + i, y: t.y + t.h, w: r.w - i * 2, h: r.h - t.h - i * 2 };
    p.rect(f.x, f.y, f.w, f.h).shadeFill(hex, 0, f.y, 0, f.y + f.h, 0.24).stroke();
    p.rect(f.x + f.w - 0.12 * u, f.y, 0.12 * u, f.h).shade(0.1);
    p.rect(t.x, t.y, t.w, t.h).shadeFill(lighten(hex, 0.2), 0, t.y, 0, t.y + t.h, 0.1).stroke();
    p.line([[t.x + 0.05 * u, t.y + t.h - 0.025 * u], [t.x + t.w - 0.05 * u, t.y + t.h - 0.025 * u]], lighten(hex, 0.45), 0.9, 0.9);
    p.rect(f.x, f.y, f.w, 0.07 * u).shade(0.22);
    return { t, f };
}

/** A raised panel: lit on its top and left edges, shadowed on the others. */
function panel(p: Pen, x: number, y: number, w: number, h: number, hex: string): void {
    const u = p.u, e = 0.035 * u;
    p.rect(x, y, w, h).fill(lighten(hex, 0.05)).stroke(0.45);
    p.line([[x + e, y + h - e], [x + e, y + e], [x + w - e, y + e]], lighten(hex, 0.35), 0.6, 0.8);
    p.line([[x + w - e, y + e * 1.5], [x + w - e, y + h - e], [x + e * 1.5, y + h - e]], darken(hex, 0.3), 0.6, 0.7);
}

/** A round knob with a glint. */
function knob(p: Pen, x: number, y: number, rad: number, hex = BRASS): void {
    p.ell(x, y, rad, rad).fill(hex).stroke(0.4);
    p.ell(x - rad * 0.3, y - rad * 0.3, rad * 0.4, rad * 0.4).shine(0.7);
}

/** A bar handle, across or (`up`) along. */
function handle(p: Pen, x: number, y: number, len: number, up = false, hex = STEEL): void {
    const t = 0.06 * p.u;
    (up ? p.rr(x - t / 2, y, t, len, t / 2) : p.rr(x, y - t / 2, len, t, t / 2)).fill(hex).stroke(0.4);
}

/** Two little block feet under a piece. */
function feet(p: Pen, x: number, w: number, ground: number, hex: string, h = 0.12): void {
    const u = p.u;
    for (const fx of [x + 0.06 * u, x + w - 0.2 * u]) p.rect(fx, ground - h * u - 0.03 * u, 0.14 * u, h * u).paint(darken(hex, 0.3), 0.6);
}

function floorShadow(p: Pen, r: Rect, k = 0.48): void {
    p.groundShadow(r.x + r.w / 2, r.y + r.h - 0.06 * p.u, r.w * k, 0.16 * p.u, 0.2);
}

/** Draw `draw` clipped to a rounded rectangle. */
function clipped(p: Pen, x: number, y: number, w: number, h: number, rad: number, draw: () => void): void {
    p.ctx.save();
    p.rr(x, y, w, h, rad);
    p.ctx.clip();
    draw();
    p.ctx.restore();
}

/** A pillow: soft, with a crease. */
function pillow(p: Pen, x: number, y: number, w: number, h: number, hex = '#ffffff'): void {
    const u = p.u;
    p.rr(x, y, w, h, Math.min(h, w) * 0.42).shadeFill(hex, 0, y, 0, y + h, 0.16).stroke(0.7);
    p.line([[x + w * 0.2, y + h * 0.55], [x + w * 0.5, y + h * 0.42], [x + w * 0.8, y + h * 0.55]], darken(hex, 0.18), 0.5, 0.8);
    p.ell(x + w * 0.3, y + h * 0.3, w * 0.12, h * 0.12).shine(0.6);
    void u;
}

/** A mattress seen from the front: top face, pillow, blanket turned back. */
function mattress(p: Pen, x: number, y: number, w: number, top: number, side: number, sheet: string, blanket: string): void {
    const u = p.u, bx = x + Math.min(0.85 * u, w * 0.4);
    p.rect(x, y, w, top).fill(sheet).stroke(0.7);
    pillow(p, x + 0.08 * u, y + top * 0.15, bx - x - 0.2 * u, top * 0.62);
    p.rect(bx, y, x + w - bx, top).shadeFill(blanket, 0, y, 0, y + top, 0.12).stroke(0.7);
    p.rect(bx, y, 0.14 * u, top).fill(lighten(sheet, 0.05)).stroke(0.5);
    /* The side: sheet under the pillow, the blanket hanging over the edge. */
    p.rect(x, y + top, w, side).fill(darken(sheet, 0.08)).stroke(0.6);
    p.rr(bx, y + top, x + w - bx, side + 0.06 * u, [0, 0, 0.06 * u, 0.06 * u]).shadeFill(darken(blanket, 0.12), 0, y + top, 0, y + top + side, 0.15).stroke(0.6);
    for (let fx = bx + 0.3 * u; fx < x + w - 0.1 * u; fx += 0.32 * u) p.line([[fx, y + top + 0.03 * u], [fx - 0.03 * u, y + top + side]], darken(blanket, 0.3), 0.5, 0.6);
}

/* ------------------------------------------------------------- bedroom */

export function bed(p: Pen, r: Rect, [frame, sheet, blanket]: string[]): void {
    const u = p.u, x = r.x, w = r.w, ground = r.y + r.h, y0 = r.y + 0.05 * u;
    floorShadow(p, r, 0.5);
    /* Headboard, between two posts. */
    p.rr(x + 0.1 * u, y0, w - 0.2 * u, 1.05 * u, [0.4 * u, 0.4 * u, 0, 0]).shadeFill(frame, 0, y0, 0, y0 + 1.05 * u, 0.25).stroke();
    p.rr(x + 0.32 * u, y0 + 0.2 * u, w - 0.64 * u, 0.55 * u, [0.25 * u, 0.25 * u, 0.04 * u, 0.04 * u]).fill(darken(frame, 0.12)).stroke(0.5);
    p.line([[x + 0.36 * u, y0 + 0.72 * u], [x + 0.36 * u, y0 + 0.4 * u]], lighten(frame, 0.3), 0.6, 0.7);
    for (const px of [x + 0.03 * u, x + w - 0.21 * u]) {
        p.rect(px, y0 + 0.2 * u, 0.18 * u, 1.0 * u).shadeFill(frame, px, 0, px + 0.18 * u, 0, 0.3).stroke(0.8);
        p.ell(px + 0.09 * u, y0 + 0.18 * u, 0.11 * u, 0.09 * u).paint(lighten(frame, 0.12), 0.7);
    }
    /* Mattress, pillows, blanket with the sheet turned down over it. */
    const my = y0 + 0.85 * u, front = ground - 0.5 * u;
    p.rr(x + 0.14 * u, my, w - 0.28 * u, front - my, 0.1 * u).fill(sheet).stroke();
    const n = w > 2.5 * u ? 2 : 1, pw = (w - 0.6 * u - (n - 1) * 0.12 * u) / n;
    for (let i = 0; i < n; i++) pillow(p, x + 0.3 * u + i * (pw + 0.12 * u), my + 0.1 * u, pw, 0.46 * u);
    const by = my + 0.72 * u;
    p.rr(x + 0.1 * u, by, w - 0.2 * u, front - by + 0.02 * u, 0.06 * u).shadeFill(blanket, x, by, x + w, front, 0.16).stroke();
    clipped(p, x + 0.1 * u, by, w - 0.2 * u, front - by, 0.06 * u, () => {
        for (let t = -2; t < 8; t++) {
            const sx = x + t * 0.45 * u;
            p.line([[sx, by], [sx + (front - by), front]], darken(blanket, 0.18), 0.45, 0.45);
            p.line([[sx + (front - by), by], [sx, front]], darken(blanket, 0.18), 0.45, 0.45);
        }
    });
    p.rr(x + 0.1 * u, by, w - 0.2 * u, 0.24 * u, 0.06 * u).fill(lighten(sheet, 0.04)).stroke(0.7);
    p.line([[x + 0.18 * u, by + 0.12 * u], [x + w - 0.18 * u, by + 0.12 * u]], darken(sheet, 0.12), 0.4, 0.8);
    /* The blanket hangs over the foot; the frame and its feet below. */
    p.rr(x + 0.1 * u, front - 0.02 * u, w - 0.2 * u, 0.3 * u, [0, 0, 0.08 * u, 0.08 * u]).shadeFill(darken(blanket, 0.14), 0, front, 0, front + 0.3 * u, 0.18).stroke();
    for (let fx = x + 0.45 * u; fx < x + w - 0.3 * u; fx += 0.45 * u) p.line([[fx, front + 0.02 * u], [fx - 0.04 * u, front + 0.26 * u]], darken(blanket, 0.32), 0.5, 0.6);
    p.rect(x + 0.05 * u, ground - 0.22 * u, w - 0.1 * u, 0.12 * u).shadeFill(frame, 0, ground - 0.22 * u, 0, ground - 0.1 * u, 0.2).stroke(0.8);
    feet(p, x + 0.02 * u, w - 0.04 * u, ground + 0.02 * u, frame, 0.1);
}

/** Two beds one over the other, seen from the long side, a ladder up the right. */
export function bunkBed(p: Pen, r: Rect, [frame, blanket]: string[]): void {
    const u = p.u, x = r.x, w = r.w, ground = r.y + r.h, sheet = '#f4f0e8';
    floorShadow(p, r, 0.5);
    const ix = x + 0.2 * u, iw = w - 0.4 * u;
    /* The back rail and the dark space under the top bunk. */
    const uy = r.y + 0.62 * u;
    p.rect(ix, uy - 0.32 * u, iw, 0.24 * u).shadeFill(frame, 0, uy - 0.32 * u, 0, uy - 0.08 * u, 0.2).stroke(0.7);
    p.rect(ix, uy + 1.25 * u, iw, ground - uy - 1.3 * u).fill(darken(frame, 0.6)).stroke(0.6);
    /* Top bunk. */
    mattress(p, ix, uy - 0.1 * u, iw, 0.78 * u, 0.28 * u, sheet, blanket);
    p.rect(x + 0.14 * u, uy + 0.96 * u, w - 0.28 * u, 0.24 * u).shadeFill(frame, 0, uy + 0.96 * u, 0, uy + 1.2 * u, 0.22).stroke(0.8);
    p.line([[x + 0.2 * u, uy + 1.0 * u], [x + w - 0.2 * u, uy + 1.0 * u]], lighten(frame, 0.35), 0.6, 0.8);
    /* Bottom bunk, in the top one's shadow. */
    const ly = uy + 1.48 * u;
    mattress(p, ix, ly, iw, 0.5 * u, 0.26 * u, sheet, blanket);
    p.rect(ix, ly, iw, 0.22 * u).shade(0.3);
    p.rect(x + 0.14 * u, ly + 0.76 * u, w - 0.28 * u, 0.24 * u).shadeFill(frame, 0, ly + 0.76 * u, 0, ly + u, 0.22).stroke(0.8);
    p.line([[x + 0.2 * u, ly + 0.8 * u], [x + w - 0.2 * u, ly + 0.8 * u]], lighten(frame, 0.35), 0.6, 0.8);
    /* Corner posts, in front of the rails. */
    for (const px of [x + 0.04 * u, x + w - 0.22 * u]) {
        p.rect(px, uy - 0.45 * u, 0.18 * u, ground - uy + 0.43 * u).shadeFill(frame, px, 0, px + 0.18 * u, 0, 0.3).stroke(0.8);
        p.rr(px - 0.02 * u, uy - 0.55 * u, 0.22 * u, 0.14 * u, 0.06 * u).paint(lighten(frame, 0.15), 0.7);
    }
    /* The ladder. */
    const lx = x + w - 0.72 * u, lw = 0.36 * u, top = uy + 0.9 * u;
    for (let y = top + 0.3 * u; y < ground - 0.15 * u; y += 0.3 * u) p.line([[lx, y], [lx + lw, y]], lighten(frame, 0.1), 1.6);
    for (const rx of [lx, lx + lw]) p.line([[rx, top], [rx, ground - 0.04 * u]], darken(frame, 0.1), 2.2);
    for (const rx of [lx, lx + lw]) p.ell(rx, top, 0.05 * u, 0.05 * u).fill(darken(frame, 0.2));
}

export function wardrobe(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const body: Rect = { x: r.x + 0.06 * u, y: r.y + 0.12 * u, w: r.w - 0.12 * u, h: r.h - 0.12 * u - 0.16 * u };
    const { f } = block(p, body, wood, 0.32);
    /* A cornice along the top of the front. */
    p.rect(r.x + 0.02 * u, f.y - 0.02 * u, r.w - 0.04 * u, 0.2 * u).shadeFill(darken(wood, 0.06), 0, f.y, 0, f.y + 0.2 * u, 0.25).stroke(0.8);
    p.line([[r.x + 0.06 * u, f.y + 0.02 * u], [r.x + r.w - 0.06 * u, f.y + 0.02 * u]], lighten(wood, 0.35), 0.6, 0.8);
    /* Two doors, each with a tall and a short panel. */
    const dy = f.y + 0.28 * u, dh = f.h - 0.36 * u, dw = (f.w - 0.24 * u) / 2;
    for (const dx of [f.x + 0.08 * u, f.x + 0.16 * u + dw]) {
        p.rect(dx, dy, dw, dh).stroke(0.6);
        panel(p, dx + 0.1 * u, dy + 0.1 * u, dw - 0.2 * u, dh * 0.56, wood);
        panel(p, dx + 0.1 * u, dy + dh * 0.56 + 0.2 * u, dw - 0.2 * u, dh * 0.44 - 0.3 * u, wood);
    }
    for (const kx of [f.x + f.w / 2 - 0.13 * u, f.x + f.w / 2 + 0.13 * u]) knob(p, kx, dy + dh * 0.52, 0.05 * u);
    /* Plinth and feet. */
    p.rect(r.x + 0.04 * u, ground - 0.22 * u, r.w - 0.08 * u, 0.12 * u).fill(darken(wood, 0.22)).stroke(0.7);
    feet(p, r.x + 0.04 * u, r.w - 0.08 * u, ground, wood, 0.1);
}

export function dresser(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const body: Rect = { x: r.x + 0.06 * u, y: r.y + 0.3 * u, w: r.w - 0.12 * u, h: r.h - 0.3 * u - 0.14 * u };
    const { t, f } = block(p, body, wood, 0.32);
    p.rect(r.x + 0.02 * u, f.y - 0.03 * u, r.w - 0.04 * u, 0.1 * u).paint(lighten(wood, 0.06), 0.7);
    /* A little vase and a framed picture on top. */
    const vx = t.x + 0.35 * u, vy = t.y + t.h * 0.75;
    p.rr(vx - 0.09 * u, vy - 0.26 * u, 0.18 * u, 0.26 * u, 0.08 * u).shadeFill('#5a8ac0', vx - 0.09 * u, 0, vx + 0.09 * u, 0, 0.3).stroke(0.5);
    for (const [dx, c] of [[-0.08, '#e86a6a'], [0.06, '#f0c040'], [0, '#f4f0e8']] as const) p.ell(vx + dx * u, vy - 0.34 * u + Math.abs(dx) * u, 0.06 * u, 0.06 * u).paint(c, 0.4);
    const px = t.x + t.w - 0.6 * u;
    p.poly([[px, vy], [px + 0.04 * u, vy - 0.3 * u], [px + 0.36 * u, vy - 0.3 * u], [px + 0.4 * u, vy]]).paint('#c8a060', 0.6);
    p.rect(px + 0.09 * u, vy - 0.24 * u, 0.22 * u, 0.18 * u).fill('#8ac0d8').stroke(0.4);
    /* Three drawers, two knobs each. */
    const rows = 3, rh = (f.h - 0.16 * u) / rows;
    for (let i = 0; i < rows; i++) {
        const y = f.y + 0.1 * u + i * rh;
        panel(p, f.x + 0.1 * u, y, f.w - 0.2 * u, rh - 0.07 * u, wood);
        for (const kx of [f.x + f.w * 0.3, f.x + f.w * 0.7]) knob(p, kx, y + (rh - 0.07 * u) / 2, 0.045 * u);
    }
    feet(p, r.x + 0.06 * u, r.w - 0.12 * u, ground, wood, 0.1);
}

export function nightstand(p: Pen, r: Rect, [wood, lamp]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r, 0.4);
    const body: Rect = { x: r.x + 0.12 * u, y: r.y + 0.82 * u, w: r.w - 0.24 * u, h: r.h - 0.82 * u - 0.12 * u };
    const { t, f } = block(p, body, wood, 0.26);
    panel(p, f.x + 0.08 * u, f.y + 0.1 * u, f.w - 0.16 * u, f.h * 0.36, wood);
    knob(p, f.x + f.w / 2, f.y + 0.1 * u + f.h * 0.18, 0.045 * u);
    /* An open shelf below the drawer, a book on it. */
    const sy = f.y + f.h * 0.5 + 0.06 * u;
    p.rect(f.x + 0.08 * u, sy, f.w - 0.16 * u, f.y + f.h - sy - 0.06 * u).fill(darken(wood, 0.5)).stroke(0.5);
    p.rect(f.x + 0.14 * u, f.y + f.h - 0.2 * u, f.w * 0.5, 0.12 * u).paint('#b8433a', 0.4);
    feet(p, body.x, body.w, ground, wood, 0.09);
    /* The lamp. */
    const cx = t.x + t.w / 2, base = t.y + t.h * 0.7;
    p.glow(cx, r.y + 0.4 * u, 1.3 * u);
    p.ell(cx, base, 0.14 * u, 0.05 * u).paint('#8a8a92', 0.5);
    p.rr(cx - 0.035 * u, r.y + 0.5 * u, 0.07 * u, base - r.y - 0.5 * u, 0.03 * u).fill('#a8a8b0').stroke(0.4);
    p.poly([[cx - 0.25 * u, r.y + 0.58 * u], [cx + 0.25 * u, r.y + 0.58 * u], [cx + 0.15 * u, r.y + 0.12 * u], [cx - 0.15 * u, r.y + 0.12 * u]]);
    if (p.look.night) { p.ctx.save(); p.ctx.shadowColor = 'rgba(255,210,130,.9)'; p.ctx.shadowBlur = u * 0.5; p.ctx.fillStyle = lighten(lamp, 0.45); p.ctx.fill(); p.ctx.restore(); p.stroke(0.8); }
    else p.shadeFill(lamp, cx - 0.25 * u, 0, cx + 0.25 * u, 0, 0.25).stroke(0.8);
    p.ell(cx, r.y + 0.12 * u, 0.15 * u, 0.04 * u).fill(darken(lamp, 0.2)).stroke(0.4);
}

/* --------------------------------------------------------- living room */

/** A sofa (`seats` cushions) or, with one seat, an armchair. */
function couch(p: Pen, r: Rect, cloth: string, seats: number): void {
    const u = p.u, x = r.x, w = r.w, ground = r.y + r.h;
    const arm = seats > 1 ? 0.42 * u : 0.32 * u, seatTop = ground - 0.95 * u, seatFront = ground - 0.5 * u;
    floorShadow(p, r, 0.5);
    /* The back: a frame and its cushions. */
    p.rr(x + 0.1 * u, r.y + 0.05 * u, w - 0.2 * u, seatTop - r.y + 0.1 * u, [seats > 1 ? 0.3 * u : 0.45 * u, seats > 1 ? 0.3 * u : 0.45 * u, 0.06 * u, 0.06 * u])
        .shadeFill(darken(cloth, 0.1), 0, r.y, 0, seatTop, 0.2).stroke();
    const cx0 = x + arm + 0.02 * u, cw = (w - 2 * arm - 0.04 * u) / seats;
    for (let i = 0; i < seats; i++) {
        const bx = cx0 + i * cw;
        p.rr(bx + 0.03 * u, r.y + 0.22 * u, cw - 0.06 * u, seatTop - r.y - 0.12 * u, 0.16 * u).shadeFill(cloth, 0, r.y, 0, seatTop, 0.18).stroke(0.8);
        p.ell(bx + cw * 0.35, r.y + 0.42 * u, cw * 0.18, 0.08 * u).shine(0.35);
    }
    /* Seat cushions: top face, then their fronts. */
    for (let i = 0; i < seats; i++) {
        const bx = cx0 + i * cw;
        p.rr(bx + 0.02 * u, seatTop - 0.08 * u, cw - 0.04 * u, seatFront - seatTop + 0.08 * u, 0.1 * u).shadeFill(lighten(cloth, 0.12), 0, seatTop, 0, seatFront, 0.12).stroke(0.8);
        p.rect(bx + 0.02 * u, seatFront, cw - 0.04 * u, 0.24 * u).shadeFill(darken(cloth, 0.06), 0, seatFront, 0, seatFront + 0.24 * u, 0.2).stroke(0.8);
    }
    p.rect(cx0, seatFront + 0.24 * u, w - 2 * arm - 0.04 * u, 0.1 * u).fill(darken(cloth, 0.25)).stroke(0.6);
    /* Rolled arms. */
    for (const ax of [x + 0.02 * u, x + w - arm - 0.02 * u]) {
        p.rr(ax, seatTop - 0.35 * u, arm, ground - seatTop + 0.2 * u, [arm / 2, arm / 2, 0.06 * u, 0.06 * u]).shadeFill(cloth, ax, 0, ax + arm, 0, 0.25).stroke();
        p.ell(ax + arm / 2, seatTop - 0.22 * u, arm / 2 - 0.04 * u, 0.1 * u).fill(lighten(cloth, 0.14)).stroke(0.5);
    }
    /* Little wooden feet. */
    for (const fx of [x + 0.12 * u, x + w - 0.24 * u]) p.rect(fx, ground - 0.14 * u, 0.12 * u, 0.12 * u).paint('#5a3a24', 0.6);
}

export function sofa(p: Pen, r: Rect, [cloth]: string[]): void {
    couch(p, r, cloth, Math.max(2, Math.round((r.w / p.u - 0.8) / 0.75)));
}

export function armchair(p: Pen, r: Rect, [cloth]: string[]): void { couch(p, r, cloth, 1); }

/** Four legs under a top: the back pair shorter, half hidden. */
function tableLegs(p: Pen, x: number, w: number, top: number, ground: number, wood: string): void {
    const u = p.u, lw = 0.12 * u;
    for (const lx of [x + 0.3 * u, x + w - 0.42 * u]) p.rect(lx, top, lw, ground - top - 0.28 * u).fill(darken(wood, 0.4)).stroke(0.5);
    for (const lx of [x + 0.08 * u, x + w - 0.2 * u]) p.rect(lx, top, lw, ground - top - 0.03 * u).shadeFill(darken(wood, 0.15), lx, 0, lx + lw, 0, 0.3).stroke(0.6);
}

/** A table top: its face (with plank lines) and its front edge. Returns the face. */
function tableTop(p: Pen, x: number, y: number, w: number, depth: number, edge: number, wood: string): Rect {
    const u = p.u;
    const t: Rect = { x, y, w, h: depth };
    p.rect(x, y, w, depth).shadeFill(lighten(wood, 0.16), 0, y, 0, y + depth, 0.1).stroke();
    for (let ly = y + 0.32 * u; ly < y + depth - 0.1 * u; ly += 0.32 * u) p.line([[x + 0.05 * u, ly], [x + w - 0.05 * u, ly]], darken(wood, 0.1), 0.4, 0.6);
    p.rect(x, y + depth, w, edge).shadeFill(wood, 0, y + depth, 0, y + depth + edge, 0.25).stroke();
    p.line([[x + 0.04 * u, y + depth + 0.02 * u], [x + w - 0.04 * u, y + depth + 0.02 * u]], lighten(wood, 0.4), 0.7, 0.8);
    return t;
}

/** A mug of something hot. */
function mug(p: Pen, x: number, y: number, hex = '#e8e4dc'): void {
    const u = p.u;
    p.rr(x + 0.14 * u, y - 0.2 * u, 0.1 * u, 0.12 * u, 0.05 * u).stroke(0.6);
    p.rr(x, y - 0.24 * u, 0.18 * u, 0.24 * u, 0.04 * u).shadeFill(hex, x, 0, x + 0.18 * u, 0, 0.25).stroke(0.5);
    p.ell(x + 0.09 * u, y - 0.24 * u, 0.08 * u, 0.035 * u).fill('#6a4028');
}

/** A closed book lying flat. */
function book(p: Pen, x: number, y: number, w: number, hex: string): void {
    const u = p.u;
    p.rect(x, y - 0.12 * u, w, 0.08 * u).fill('#f4f0e6').stroke(0.4);
    p.rect(x - 0.02 * u, y - 0.2 * u, w + 0.02 * u, 0.09 * u).paint(hex, 0.5);
    p.rect(x - 0.02 * u, y - 0.05 * u, w + 0.02 * u, 0.06 * u).paint(darken(hex, 0.1), 0.5);
}

export function coffeeTable(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r, 0.45);
    /* A lower shelf with magazines, the legs, then the top. */
    const ty = r.y + 0.22 * u, depth = r.h - 0.22 * u - 0.75 * u;
    tableLegs(p, r.x, r.w, ty + depth, ground, wood);
    p.rect(r.x + 0.14 * u, ground - 0.36 * u, r.w - 0.28 * u, 0.1 * u).paint(darken(wood, 0.05), 0.6);
    p.rect(r.x + 0.4 * u, ground - 0.44 * u, 0.5 * u, 0.08 * u).paint('#4a7ab0', 0.4);
    p.rect(r.x + 0.5 * u, ground - 0.5 * u, 0.45 * u, 0.07 * u).paint('#d86a4a', 0.4);
    const t = tableTop(p, r.x + 0.02 * u, ty, r.w - 0.04 * u, depth, 0.14 * u, wood);
    mug(p, t.x + t.w * 0.68, t.y + t.h * 0.75);
    book(p, t.x + 0.25 * u, t.y + t.h * 0.8, 0.45 * u, '#3a8a5a');
}

export function table(p: Pen, r: Rect, [wood, cloth]: string[]): void {
    const u = p.u, ground = r.y + r.h, big = r.w >= 2.5 * u;
    floorShadow(p, r);
    const ty = r.y + 0.3 * u, depth = r.h - 0.3 * u - 1.0 * u;
    tableLegs(p, r.x, r.w, ty + depth + 0.16 * u, ground, wood);
    const t = tableTop(p, r.x + 0.02 * u, ty, r.w - 0.04 * u, depth, 0.16 * u, wood);
    if (big) {
        /* A runner down the middle, hanging over the front; plates either side. */
        const cw = 0.7 * u, cx = t.x + t.w / 2 - cw / 2;
        p.rect(cx, t.y, cw, t.h).fill(cloth).stroke(0.6);
        p.rr(cx, t.y + t.h, cw, 0.36 * u, [0, 0, 0.04 * u, 0.04 * u]).shadeFill(darken(cloth, 0.08), 0, t.y + t.h, 0, t.y + t.h + 0.36 * u, 0.15).stroke(0.6);
        for (let fx = cx + 0.08 * u; fx < cx + cw; fx += 0.1 * u) p.line([[fx, t.y + t.h + 0.36 * u], [fx, t.y + t.h + 0.44 * u]], darken(cloth, 0.2), 0.5);
        for (const fx of [0.18, 0.82]) for (const fy of [0.3, 0.72]) {
            const px = t.x + t.w * fx, py = t.y + t.h * fy;
            p.ell(px, py, 0.26 * u, 0.15 * u).fill('#f8f6f0').stroke(0.5);
            p.ell(px, py, 0.16 * u, 0.09 * u).fill('#ece8de');
            p.line([[px + 0.32 * u, py - 0.08 * u], [px + 0.32 * u, py + 0.1 * u]], STEEL, 0.9);
        }
        vase(p, t.x + t.w / 2, t.y + t.h * 0.55, '#d0e0f0');
    } else {
        /* A cloth over the middle, its corner hanging down the front. */
        const cw = t.w * 0.6, cx = t.x + (t.w - cw) / 2;
        p.rect(cx, t.y + 0.05 * u, cw, t.h - 0.05 * u).fill(cloth).stroke(0.6);
        p.poly([[cx, t.y + t.h], [cx + cw, t.y + t.h], [cx + cw - 0.12 * u, t.y + t.h + 0.32 * u], [cx + cw / 2, t.y + t.h + 0.42 * u], [cx + 0.12 * u, t.y + t.h + 0.32 * u]])
            .shadeFill(darken(cloth, 0.08), 0, t.y + t.h, 0, t.y + t.h + 0.4 * u, 0.15).stroke(0.6);
        teapot(p, t.x + t.w * 0.45, t.y + t.h * 0.8);
        mug(p, t.x + t.w * 0.7, t.y + t.h * 0.85, '#f4f0e8');
    }
}

/** A vase of flowers standing at (x, y). */
function vase(p: Pen, x: number, y: number, hex: string): void {
    const u = p.u;
    for (const [dx, dy, c] of [[-0.12, -0.42, '#e86a6a'], [0.1, -0.46, '#f0c040'], [0, -0.55, '#f4f0e8'], [0.16, -0.32, '#c870c8'], [-0.16, -0.3, '#f0a040']] as const) {
        p.line([[x, y - 0.25 * u], [x + dx * u, y + dy * u]], '#3a7a3a', 0.6);
        p.ell(x + dx * u, y + dy * u, 0.07 * u, 0.07 * u).paint(c, 0.4);
    }
    p.rr(x - 0.1 * u, y - 0.3 * u, 0.2 * u, 0.3 * u, [0.04 * u, 0.04 * u, 0.1 * u, 0.1 * u]).shadeFill(hex, x - 0.1 * u, 0, x + 0.1 * u, 0, 0.3).stroke(0.5);
}

function teapot(p: Pen, x: number, y: number): void {
    const u = p.u;
    p.line([[x + 0.18 * u, y - 0.16 * u], [x + 0.32 * u, y - 0.28 * u]], '#e8e4dc', 1.4);
    p.ell(x, y - 0.14 * u, 0.2 * u, 0.15 * u).shadeFill('#e8e4dc', x - 0.2 * u, 0, x + 0.2 * u, 0, 0.25).stroke(0.6);
    p.ell(x, y - 0.28 * u, 0.1 * u, 0.04 * u).fill('#d0ccc0').stroke(0.4);
    p.ell(x, y - 0.33 * u, 0.04 * u, 0.03 * u).fill('#5a8ac0');
}

export function roundTable(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    floorShadow(p, r, 0.42);
    /* Foot, pedestal, then the top with its thickness. */
    p.ell(cx, ground - 0.12 * u, 0.45 * u, 0.12 * u).shadeFill(darken(wood, 0.2), cx - 0.45 * u, 0, cx + 0.45 * u, 0, 0.3).stroke(0.7);
    p.rr(cx - 0.11 * u, r.y + r.h * 0.42, 0.22 * u, ground - r.y - r.h * 0.42 - 0.14 * u, 0.05 * u).shadeFill(darken(wood, 0.15), cx - 0.11 * u, 0, cx + 0.11 * u, 0, 0.35).stroke(0.7);
    const ty = r.y + r.h * 0.36, rx = r.w * 0.48, ry = r.h * 0.22;
    p.ell(cx, ty + 0.12 * u, rx, ry).fill(darken(wood, 0.12)).stroke();
    p.ell(cx, ty, rx, ry).shadeFill(lighten(wood, 0.16), cx - rx, ty - ry, cx + rx, ty + ry, 0.14).stroke();
    p.ell(cx - rx * 0.3, ty - ry * 0.35, rx * 0.35, ry * 0.25).shine(0.25);
    /* A lace doily and a vase. */
    p.ell(cx, ty, rx * 0.36, ry * 0.4).fill('#f8f4ec').stroke(0.4);
    p.ell(cx, ty, rx * 0.26, ry * 0.28).stroke(0.3);
    vase(p, cx, ty + ry * 0.15, '#e8a050');
}

export function chair(p: Pen, r: Rect, [wood, seat]: string[]): void {
    const u = p.u, ground = r.y + r.h, x = r.x, w = r.w;
    floorShadow(p, r, 0.35);
    const sy = ground - 0.95 * u;
    /* Back legs, then the back: two uprights, a curved top rail, spindles. */
    for (const lx of [x + 0.3 * u, x + w - 0.4 * u]) p.rect(lx, sy, 0.1 * u, ground - sy - 0.28 * u).fill(darken(wood, 0.4)).stroke(0.5);
    for (let i = 1; i <= 3; i++) {
        const sx = x + 0.22 * u + (w - 0.44 * u) * i / 4;
        p.rect(sx - 0.035 * u, r.y + 0.35 * u, 0.07 * u, sy - r.y - 0.3 * u).shadeFill(wood, sx - 0.035 * u, 0, sx + 0.035 * u, 0, 0.3).stroke(0.5);
    }
    for (const px of [x + 0.18 * u, x + w - 0.3 * u]) p.rect(px, r.y + 0.12 * u, 0.12 * u, sy - r.y).shadeFill(wood, px, 0, px + 0.12 * u, 0, 0.3).stroke(0.7);
    p.rr(x + 0.14 * u, r.y + 0.06 * u, w - 0.28 * u, 0.3 * u, [0.14 * u, 0.14 * u, 0.04 * u, 0.04 * u]).shadeFill(wood, 0, r.y, 0, r.y + 0.36 * u, 0.25).stroke(0.8);
    /* The seat, a cushion on it, its front edge; front legs. */
    p.poly([[x + 0.16 * u, sy], [x + w - 0.16 * u, sy], [x + w - 0.1 * u, sy + 0.4 * u], [x + 0.1 * u, sy + 0.4 * u]]).fill(lighten(wood, 0.12)).stroke(0.7);
    p.rr(x + 0.18 * u, sy + 0.03 * u, w - 0.36 * u, 0.34 * u, 0.1 * u).shadeFill(seat, 0, sy, 0, sy + 0.4 * u, 0.18).stroke(0.6);
    p.rect(x + 0.1 * u, sy + 0.4 * u, w - 0.2 * u, 0.12 * u).shadeFill(wood, 0, sy + 0.4 * u, 0, sy + 0.52 * u, 0.25).stroke(0.7);
    for (const lx of [x + 0.12 * u, x + w - 0.24 * u]) p.rect(lx, sy + 0.52 * u, 0.12 * u, ground - sy - 0.55 * u).shadeFill(darken(wood, 0.1), lx, 0, lx + 0.12 * u, 0, 0.3).stroke(0.6);
}

export function bookshelf(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const body: Rect = { x: r.x + 0.04 * u, y: r.y + 0.06 * u, w: r.w - 0.08 * u, h: r.h - 0.2 * u };
    const { f } = block(p, body, wood, 0.26);
    p.rect(r.x, f.y - 0.02 * u, r.w, 0.16 * u).shadeFill(darken(wood, 0.05), 0, f.y, 0, f.y + 0.16 * u, 0.25).stroke(0.7);
    const inner: Rect = { x: f.x + 0.12 * u, y: f.y + 0.2 * u, w: f.w - 0.24 * u, h: f.h - 0.32 * u };
    const shelves = Math.max(2, Math.round(inner.h / u / 0.75));
    const sh = inner.h / shelves;
    const colors = ['#b8433a', '#3f6fb0', '#d0a43c', '#4a8a4c', '#7a4a9a', '#e0d6c0', '#c0643a', '#2a5a5a'];
    p.reseed(Math.round(r.w + r.h * 3));
    for (let s = 0; s < shelves; s++) {
        const y = inner.y + s * sh, floor = y + sh - 0.08 * u;
        p.rect(inner.x, y, inner.w, sh).fill(darken(wood, 0.5)).stroke(0.4);
        p.rect(inner.x, y, inner.w, 0.1 * u).shade(0.3);
        let x = inner.x + 0.04 * u;
        const gap = p.rnd() < 0.6 ? inner.x + inner.w * (0.25 + p.rnd() * 0.5) : -1;
        while (x < inner.x + inner.w - 0.12 * u) {
            if (gap > 0 && x > gap && x < gap + 0.4 * u) {
                /* An ornament in a gap: a little globe or a pot. */
                if (s % 2) { p.ell(x + 0.15 * u, floor - 0.16 * u, 0.13 * u, 0.13 * u).paint('#5a9ac8', 0.5); p.line([[x + 0.06 * u, floor - 0.2 * u], [x + 0.24 * u, floor - 0.12 * u]], '#4a8a4c', 1.2); }
                else p.rr(x + 0.05 * u, floor - 0.22 * u, 0.22 * u, 0.22 * u, 0.05 * u).paint('#c87a4a', 0.5);
                x += 0.4 * u;
                continue;
            }
            const bw = (0.08 + p.rnd() * 0.08) * u, bh = (sh - 0.16 * u) * (0.62 + p.rnd() * 0.36);
            if (x + bw > inner.x + inner.w - 0.04 * u) break;
            const c = colors[Math.floor(p.rnd() * colors.length)];
            if (p.rnd() < 0.08 && x + bh * 0.5 < inner.x + inner.w - 0.1 * u) {
                /* One leaning over. */
                p.poly([[x, floor], [x + bw, floor], [x + bw + bh * 0.45, floor - bh * 0.9], [x + bh * 0.45, floor - bh * 0.9]]).paint(c, 0.4);
                x += bw + bh * 0.45 + 0.02 * u;
                continue;
            }
            p.rect(x, floor - bh, bw, bh).paint(c, 0.4);
            p.line([[x + bw * 0.15, floor - bh + 0.08 * u], [x + bw * 0.85, floor - bh + 0.08 * u]], '#f0e0a0', 0.5, 0.7);
            x += bw + 0.01 * u;
        }
        p.rect(inner.x - 0.04 * u, floor, inner.w + 0.08 * u, 0.09 * u).fill(lighten(wood, 0.12)).stroke(0.5);
    }
    p.rect(r.x + 0.04 * u, ground - 0.16 * u, r.w - 0.08 * u, 0.13 * u).fill(darken(wood, 0.22)).stroke(0.6);
}

export function tv(p: Pen, r: Rect, [cabinet, screen]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    /* A low cabinet with two doors. */
    const stand: Rect = { x: r.x + 0.04 * u, y: r.y + r.h * 0.5, w: r.w - 0.08 * u, h: r.h * 0.5 - 0.12 * u };
    const { t, f } = block(p, stand, cabinet, 0.24);
    const dw = (f.w - 0.3 * u) / 2;
    for (const dx of [f.x + 0.1 * u, f.x + 0.2 * u + dw]) panel(p, dx, f.y + 0.1 * u, dw, f.h - 0.18 * u, cabinet);
    for (const kx of [f.x + f.w / 2 - 0.12 * u, f.x + f.w / 2 + 0.12 * u]) knob(p, kx, f.y + f.h / 2, 0.04 * u);
    feet(p, stand.x, stand.w, ground, cabinet, 0.09);
    /* The set on its foot. */
    const sx = r.x + 0.2 * u, sw = r.w - 0.4 * u, sy = r.y + 0.08 * u, shh = t.y - sy - 0.12 * u;
    p.rect(r.x + r.w / 2 - 0.08 * u, sy + shh - 0.02 * u, 0.16 * u, t.y + t.h * 0.5 - sy - shh).fill('#2a2a30');
    p.rr(r.x + r.w / 2 - 0.35 * u, t.y + t.h * 0.4, 0.7 * u, 0.1 * u, 0.04 * u).fill('#2a2a30').stroke(0.5);
    p.rr(sx, sy, sw, shh, 0.06 * u).shadeFill('#2a2c34', 0, sy, 0, sy + shh, 0.3).stroke();
    p.rect(sx + 0.07 * u, sy + 0.07 * u, sw - 0.14 * u, shh - 0.16 * u);
    if (p.look.night) { p.ctx.save(); p.ctx.shadowColor = 'rgba(140,200,255,.9)'; p.ctx.shadowBlur = u * 0.5; p.ctx.fillStyle = lighten(screen, 0.4); p.ctx.fill(); p.ctx.restore(); }
    else {
        p.shadeFill(screen, sx, sy, sx + sw, sy + shh, 0.4);
        p.poly([[sx + sw * 0.15, sy + 0.07 * u], [sx + sw * 0.4, sy + 0.07 * u], [sx + sw * 0.22, sy + shh - 0.09 * u], [sx + 0.07 * u, sy + shh - 0.09 * u]]).shine(0.18);
    }
    p.ell(sx + sw - 0.12 * u, sy + shh - 0.05 * u, 0.025 * u, 0.025 * u).fill('#60e080');
}

export function computerDesk(p: Pen, r: Rect, [wood, pc]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const ty = r.y + 0.95 * u, depth = r.h - 0.95 * u - 0.9 * u;
    tableLegs(p, r.x, r.w, ty + depth + 0.14 * u, ground, wood);
    const t = tableTop(p, r.x + 0.02 * u, ty, r.w - 0.04 * u, depth, 0.14 * u, wood);
    /* Monitor on a stand. */
    const mw = 1.0 * u, mx = t.x + t.w * 0.42 - mw / 2, my = r.y + 0.05 * u, mh = 0.72 * u;
    p.rr(mx + mw / 2 - 0.2 * u, t.y + t.h * 0.3, 0.4 * u, 0.08 * u, 0.03 * u).fill(pc).stroke(0.5);
    p.rect(mx + mw / 2 - 0.05 * u, my + mh - 0.02 * u, 0.1 * u, t.y + t.h * 0.3 - my - mh + 0.04 * u).fill(pc);
    p.rr(mx, my, mw, mh, 0.06 * u).shadeFill(pc, 0, my, 0, my + mh, 0.25).stroke();
    p.rect(mx + 0.07 * u, my + 0.07 * u, mw - 0.14 * u, mh - 0.16 * u);
    if (p.look.night) { p.ctx.save(); p.ctx.shadowColor = 'rgba(140,220,255,.9)'; p.ctx.shadowBlur = u * 0.4; p.fill('#a8e0f8'); p.ctx.restore(); }
    else {
        p.shadeFill('#3a7ab8', mx, my, mx + mw, my + mh, 0.4);
        p.rect(mx + 0.14 * u, my + 0.14 * u, 0.4 * u, 0.24 * u).fill('#e8f0f8').stroke(0.3);
        p.rect(mx + 0.14 * u, my + 0.14 * u, 0.4 * u, 0.05 * u).fill('#5a8ad0');
        p.rect(mx + 0.6 * u, my + 0.3 * u, 0.24 * u, 0.2 * u).fill('#f0d070').stroke(0.3);
    }
    /* Keyboard, mouse, the tower beside. */
    const ky = t.y + t.h * 0.62;
    p.rr(mx + 0.05 * u, ky, 0.85 * u, 0.2 * u, 0.03 * u).fill('#e4e4e8').stroke(0.5);
    for (let i = 1; i < 7; i++) p.line([[mx + 0.05 * u + 0.85 * u * i / 7, ky + 0.03 * u], [mx + 0.05 * u + 0.85 * u * i / 7, ky + 0.17 * u]], '#a8a8b0', 0.35);
    p.line([[mx + 0.08 * u, ky + 0.1 * u], [mx + 0.87 * u, ky + 0.1 * u]], '#a8a8b0', 0.35);
    p.ell(mx + 1.05 * u, ky + 0.1 * u, 0.06 * u, 0.08 * u).fill('#e4e4e8').stroke(0.4);
    const tx = t.x + t.w - 0.45 * u, tt = r.y + 0.3 * u;
    p.rr(tx, tt, 0.36 * u, t.y + t.h * 0.75 - tt, 0.04 * u).shadeFill(pc, tx, 0, tx + 0.36 * u, 0, 0.3).stroke(0.7);
    p.ell(tx + 0.18 * u, tt + 0.15 * u, 0.04 * u, 0.04 * u).fill(p.look.night ? '#60e080' : '#80d0ff');
    for (let i = 0; i < 3; i++) p.line([[tx + 0.08 * u, tt + (0.32 + i * 0.08) * u], [tx + 0.28 * u, tt + (0.32 + i * 0.08) * u]], lighten(pc, 0.25), 0.4);
}

export function piano(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    /* The cabinet, with a panel and the music stand. */
    const body: Rect = { x: r.x + 0.1 * u, y: r.y + 0.05 * u, w: r.w - 0.2 * u, h: r.h - 0.95 * u };
    const { f } = block(p, body, wood, 0.3);
    panel(p, f.x + 0.2 * u, f.y + 0.14 * u, f.w - 0.4 * u, f.h - 0.32 * u, wood);
    const cx = r.x + r.w / 2;
    p.rect(cx - 0.55 * u, f.y + f.h - 0.62 * u, 1.1 * u, 0.1 * u).fill(lighten(wood, 0.15)).stroke(0.5);
    for (const dx of [-0.48, 0.02]) {
        const sx = cx + dx * u;
        p.rect(sx, f.y + f.h - 1.05 * u, 0.46 * u, 0.45 * u).fill('#f8f4ea').stroke(0.4);
        for (let k = 0; k < 4; k++) p.line([[sx + 0.05 * u, f.y + f.h - 0.95 * u + k * 0.09 * u], [sx + 0.41 * u, f.y + f.h - 0.95 * u + k * 0.09 * u]], '#8a8a8a', 0.3);
    }
    /* Candle sconces either side. */
    for (const sx of [f.x + 0.32 * u, f.x + f.w - 0.32 * u]) {
        p.rect(sx - 0.04 * u, f.y + f.h - 0.75 * u, 0.08 * u, 0.22 * u).fill('#f8f4e6').stroke(0.4);
        p.ell(sx, f.y + f.h - 0.8 * u, 0.03 * u, 0.06 * u).fill('#f0b030');
        p.glow(sx, f.y + f.h - 0.8 * u, 0.6 * u);
    }
    /* The keybed: white keys seen from above, black keys at the back. */
    const kx = r.x + 0.04 * u, kw = r.w - 0.08 * u, ky = f.y + f.h - 0.06 * u;
    p.rect(kx, ky, kw, 0.36 * u).fill('#f8f6f0').stroke(0.7);
    const n = Math.round(kw / (0.13 * u));
    for (let i = 1; i < n; i++) {
        const x = kx + kw * i / n;
        p.line([[x, ky], [x, ky + 0.36 * u]], '#9a968a', 0.35);
        if (i % 7 !== 3 && i % 7 !== 0) p.rect(x - 0.035 * u, ky, 0.07 * u, 0.2 * u).fill('#1a1a1e');
    }
    p.rect(kx, ky, kw, 0.05 * u).fill(darken(wood, 0.1));
    p.rect(kx - 0.02 * u, ky + 0.36 * u, kw + 0.04 * u, 0.12 * u).shadeFill(wood, 0, ky + 0.36 * u, 0, ky + 0.48 * u, 0.25).stroke(0.7);
    /* The lower front, the cheeks, the pedals. */
    const ly = ky + 0.48 * u;
    p.rect(r.x + 0.16 * u, ly, r.w - 0.32 * u, ground - ly - 0.05 * u).shadeFill(darken(wood, 0.05), 0, ly, 0, ground, 0.25).stroke(0.7);
    panel(p, r.x + 0.35 * u, ly + 0.08 * u, r.w - 0.7 * u, ground - ly - 0.3 * u, wood);
    for (const sx of [r.x + 0.02 * u, r.x + r.w - 0.18 * u]) p.rect(sx, ky - 0.04 * u, 0.16 * u, ground - ky + 0.01 * u).shadeFill(wood, sx, 0, sx + 0.16 * u, 0, 0.3).stroke(0.7);
    for (const dx of [-0.16, 0, 0.16]) p.ell(cx + dx * u, ground - 0.1 * u, 0.05 * u, 0.03 * u).fill(BRASS).stroke(0.4);
}

export function fireplace(p: Pen, r: Rect, [stone, fire]: string[]): void {
    const u = p.u, ground = r.y + r.h, cx = r.x + r.w / 2;
    p.glow(cx, ground - 0.7 * u, 2.6 * u);
    /* The chimney breast in stone courses. */
    const top = r.y + 0.42 * u;
    p.rect(r.x + 0.08 * u, top, r.w - 0.16 * u, ground - top - 0.2 * u).shadeFill(stone, r.x, 0, r.x + r.w, 0, 0.25).stroke();
    clipped(p, r.x + 0.08 * u, top, r.w - 0.16 * u, ground - top - 0.2 * u, 0, () => {
        p.reseed(Math.round(r.w));
        for (let y = top + 0.04 * u, row = 0; y < ground; y += 0.3 * u, row++) {
            for (let x = r.x + (row % 2 ? -0.2 : 0.05) * u; x < r.x + r.w; x += 0.55 * u) {
                p.rr(x, y, 0.5 * u, 0.26 * u, 0.05 * u).fill(p.rnd() < 0.5 ? lighten(stone, 0.06) : darken(stone, 0.05)).stroke(0.35);
            }
        }
    });
    /* The mantel shelf with a clock and two candles. */
    p.rect(r.x - 0.04 * u, top - 0.06 * u, r.w + 0.08 * u, 0.2 * u).shadeFill('#7a4a2a', 0, top - 0.06 * u, 0, top + 0.14 * u, 0.25).stroke(0.8);
    p.rect(r.x - 0.04 * u, top - 0.2 * u, r.w + 0.08 * u, 0.14 * u).fill('#9a6440').stroke(0.6);
    p.rr(cx - 0.2 * u, top - 0.55 * u, 0.4 * u, 0.38 * u, [0.2 * u, 0.2 * u, 0.03 * u, 0.03 * u]).paint('#8a5a36', 0.6);
    p.ell(cx, top - 0.38 * u, 0.12 * u, 0.12 * u).fill('#f8f2e0').stroke(0.4);
    for (const sx of [r.x + 0.4 * u, r.x + r.w - 0.4 * u]) {
        p.rect(sx - 0.05 * u, top - 0.48 * u, 0.1 * u, 0.3 * u).fill('#f4ecd8').stroke(0.4);
        p.ell(sx, top - 0.52 * u, 0.035 * u, 0.06 * u).fill('#f0b030');
    }
    /* The firebox: dark arch, logs, flames. */
    const ow = r.w * 0.5, ox = cx - ow / 2, oy = ground - 1.25 * u;
    p.rr(ox - 0.1 * u, oy - 0.1 * u, ow + 0.2 * u, 1.15 * u, [ow / 2, ow / 2, 0, 0]).fill(darken(stone, 0.2)).stroke(0.8);
    p.rr(ox, oy, ow, 1.05 * u, [ow / 2 - 0.08 * u, ow / 2 - 0.08 * u, 0, 0]).fill('#1a1210').stroke();
    p.rr(cx - 0.45 * u, ground - 0.42 * u, 0.9 * u, 0.14 * u, 0.07 * u).paint('#6a4028', 0.6);
    p.rr(cx - 0.35 * u, ground - 0.5 * u, 0.7 * u, 0.13 * u, 0.06 * u).paint('#7a4a2e', 0.6);
    for (const [dx, h, k] of [[-0.18, 0.55, 0], [0.16, 0.48, 0], [0, 0.75, 1]] as const) {
        const fx = cx + dx * u, fb = ground - 0.46 * u;
        p.ctx.beginPath();
        p.ctx.moveTo(fx - 0.16 * u, fb);
        p.ctx.quadraticCurveTo(fx - 0.18 * u, fb - h * 0.6 * u, fx, fb - h * u);
        p.ctx.quadraticCurveTo(fx + 0.18 * u, fb - h * 0.6 * u, fx + 0.16 * u, fb);
        p.ctx.closePath();
        p.fill(k ? lighten(fire, 0.1) : darken(fire, 0.08));
    }
    p.ell(cx, ground - 0.62 * u, 0.1 * u, 0.18 * u).fill('#ffe080');
    /* The hearth slab in front. */
    p.rect(r.x + 0.02 * u, ground - 0.22 * u, r.w - 0.04 * u, 0.18 * u).shadeFill(darken(stone, 0.12), 0, ground - 0.22 * u, 0, ground, 0.2).stroke(0.8);
}

export function grandfatherClock(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    floorShadow(p, r, 0.35);
    /* The hood with a pediment, the face behind glass. */
    const hx = cx - 0.36 * u, hw = 0.72 * u, hy = r.y + 0.25 * u, hh = 0.9 * u;
    p.poly([[hx - 0.04 * u, hy + 0.05 * u], [cx, r.y + 0.02 * u], [hx + hw + 0.04 * u, hy + 0.05 * u]]).shadeFill(wood, 0, r.y, 0, hy, 0.2).stroke(0.8);
    p.ell(cx, r.y + 0.03 * u, 0.05 * u, 0.05 * u).fill(BRASS).stroke(0.4);
    p.rect(hx, hy, hw, hh).shadeFill(wood, hx, 0, hx + hw, 0, 0.3).stroke();
    p.ell(cx, hy + hh * 0.48, 0.27 * u, 0.27 * u).fill(BRASS).stroke(0.5);
    p.ell(cx, hy + hh * 0.48, 0.23 * u, 0.23 * u).fill('#f8f2e0').stroke(0.4);
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, fy = hy + hh * 0.48;
        p.line([[cx + Math.cos(a) * 0.17 * u, fy + Math.sin(a) * 0.17 * u], [cx + Math.cos(a) * 0.21 * u, fy + Math.sin(a) * 0.21 * u]], INK_DARK, i % 3 ? 0.35 : 0.7);
    }
    p.line([[cx, hy + hh * 0.48], [cx, hy + hh * 0.48 - 0.15 * u]], INK_DARK, 0.8);
    p.line([[cx, hy + hh * 0.48], [cx + 0.11 * u, hy + hh * 0.48 + 0.04 * u]], INK_DARK, 0.8);
    /* The trunk, a window onto the pendulum. */
    const tx = cx - 0.27 * u, tw = 0.54 * u, ty = hy + hh, th = ground - ty - 0.42 * u;
    p.rect(tx, ty, tw, th).shadeFill(wood, tx, 0, tx + tw, 0, 0.3).stroke();
    p.rr(tx + 0.1 * u, ty + 0.12 * u, tw - 0.2 * u, th - 0.24 * u, [0.17 * u, 0.17 * u, 0.02 * u, 0.02 * u]).fill(darken(wood, 0.4)).stroke(0.5);
    p.line([[cx, ty + 0.15 * u], [cx, ty + th - 0.4 * u]], BRASS, 0.7);
    p.ell(cx, ty + th - 0.35 * u, 0.1 * u, 0.1 * u).fill(BRASS).stroke(0.4);
    p.rr(tx + 0.12 * u, ty + 0.14 * u, 0.06 * u, th - 0.3 * u, 0.03 * u).shine(0.2);
    /* The base. */
    p.rect(hx, ground - 0.44 * u, hw, 0.36 * u).shadeFill(wood, hx, 0, hx + hw, 0, 0.3).stroke();
    panel(p, hx + 0.1 * u, ground - 0.38 * u, hw - 0.2 * u, 0.22 * u, wood);
    feet(p, hx, hw, ground + 0.02 * u, wood, 0.08);
}

export function pottedPlant(p: Pen, r: Rect, [leaves, pot]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    floorShadow(p, r, 0.35);
    const base = ground - 0.62 * u;
    const leaf = (a: number, len: number, col: string) => {
        p.ctx.save(); p.ctx.translate(cx, base); p.ctx.rotate(a);
        p.ctx.beginPath(); p.ctx.moveTo(0, 0);
        p.ctx.quadraticCurveTo(0.22 * u, -len * 0.5, 0, -len); p.ctx.quadraticCurveTo(-0.22 * u, -len * 0.5, 0, 0);
        p.fill(col).stroke(0.6);
        p.line([[0, -0.05 * u], [0.02 * u, -len * 0.9]], darken(col, 0.25), 0.45, 0.8);
        p.ctx.restore();
    };
    const h = (r.h - 0.6 * u) / u;
    for (const [a, l, c] of [[-1.25, 0.6, darken(leaves, 0.15)], [1.25, 0.6, darken(leaves, 0.15)], [-0.8, 0.8, darken(leaves, 0.05)], [0.8, 0.8, darken(leaves, 0.05)], [-0.4, 0.95, leaves], [0.45, 0.92, leaves], [-0.05, 1.0, lighten(leaves, 0.12)], [0.2, 0.85, lighten(leaves, 0.06)]] as [number, number, string][]) leaf(a, l * h * u, c);
    /* The pot: rim, soil, body with a band. */
    p.poly([[cx - 0.3 * u, base], [cx + 0.3 * u, base], [cx + 0.21 * u, ground - 0.06 * u], [cx - 0.21 * u, ground - 0.06 * u]]).shadeFill(pot, cx - 0.3 * u, 0, cx + 0.3 * u, 0, 0.3).stroke();
    p.rect(cx - 0.27 * u, base + 0.2 * u, 0.54 * u, 0.06 * u).fill(darken(pot, 0.12));
    p.rr(cx - 0.35 * u, base - 0.08 * u, 0.7 * u, 0.15 * u, 0.05 * u).shadeFill(lighten(pot, 0.12), 0, base - 0.08 * u, 0, base + 0.07 * u, 0.2).stroke(0.7);
    p.ell(cx, base - 0.04 * u, 0.26 * u, 0.04 * u).fill('#4a3424');
    p.rect(cx - 0.15 * u, base + 0.05 * u, 0.06 * u, 0.3 * u).shine(0.25);
}

export function rug(p: Pen, r: Rect, [main, border]: string[]): void {
    const u = p.u, x = r.x + 0.2 * u, y = r.y + 0.1 * u, w = r.w - 0.4 * u, h = r.h - 0.2 * u;
    /* Fringes at both ends. */
    for (const fx of [r.x + 0.04 * u, r.x + r.w - 0.2 * u]) for (let fy = y + 0.08 * u; fy < y + h - 0.04 * u; fy += 0.09 * u) p.line([[fx, fy], [fx + 0.16 * u, fy]], lighten(border, 0.2), 0.6);
    p.rect(x, y, w, h).fill(border).stroke(0.7);
    p.rect(x + 0.12 * u, y + 0.12 * u, w - 0.24 * u, h - 0.24 * u).fill(darken(main, 0.15)).stroke(0.4);
    /* A row of little diamonds round the border. */
    for (let dx = x + 0.3 * u; dx < x + w - 0.2 * u; dx += 0.3 * u) for (const dy of [y + 0.06 * u, y + h - 0.06 * u]) p.poly([[dx - 0.05 * u, dy], [dx, dy - 0.04 * u], [dx + 0.05 * u, dy], [dx, dy + 0.04 * u]]).fill(darken(border, 0.25));
    p.rect(x + 0.22 * u, y + 0.22 * u, w - 0.44 * u, h - 0.44 * u).fill(main);
    const cx = x + w / 2, cy = y + h / 2, mx = w * 0.3, my = h * 0.32;
    p.poly([[cx - mx, cy], [cx, cy - my], [cx + mx, cy], [cx, cy + my]]).fill(lighten(main, 0.18)).stroke(0.4);
    p.poly([[cx - mx * 0.6, cy], [cx, cy - my * 0.6], [cx + mx * 0.6, cy], [cx, cy + my * 0.6]]).fill(border);
    p.ell(cx, cy, Math.min(mx, my) * 0.25, Math.min(mx, my) * 0.25).fill(main);
    /* Corner motifs. */
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const ex = qx ? x + w - 0.42 * u : x + 0.42 * u, ey = qy ? y + h - 0.42 * u : y + 0.42 * u;
        p.poly([[ex - 0.12 * u, ey], [ex, ey - 0.12 * u], [ex + 0.12 * u, ey], [ex, ey + 0.12 * u]]).fill(border);
    }
}

export function roundRug(p: Pen, r: Rect, [main, border]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w / 2 - 0.08 * u, ry = r.h / 2 - 0.08 * u;
    /* A braided rug: rings, each with its plait. */
    const rings = 5;
    for (let i = 0; i < rings; i++) {
        const k = 1 - i / rings, c = i % 2 ? border : main;
        p.ell(cx, cy, rx * k, ry * k).fill(i % 2 ? c : (i === 0 ? c : lighten(c, 0.08))).stroke(i ? 0.3 : 0.7);
        const n = Math.round(28 * k);
        for (let j = 0; j < n; j++) {
            const a = j / n * Math.PI * 2, kr = k - 0.5 / rings;
            p.line([[cx + Math.cos(a) * rx * kr, cy + Math.sin(a) * ry * kr], [cx + Math.cos(a + 0.12) * rx * (kr + 0.06), cy + Math.sin(a + 0.12) * ry * (kr + 0.06)]], darken(c, 0.22), 0.45, 0.6);
        }
    }
}

export function doormat(p: Pen, r: Rect, [mat]: string[]): void {
    const u = p.u, x = r.x + 0.1 * u, y = r.y + 0.18 * u, w = r.w - 0.2 * u, h = r.h - 0.36 * u;
    p.rr(x, y, w, h, 0.06 * u).shadeFill(mat, 0, y, 0, y + h, 0.15).stroke(0.6);
    p.rr(x + 0.08 * u, y + 0.08 * u, w - 0.16 * u, h - 0.16 * u, 0.04 * u).fill(lighten(mat, 0.08));
    p.reseed(Math.round(r.w));
    clipped(p, x + 0.08 * u, y + 0.08 * u, w - 0.16 * u, h - 0.16 * u, 0.04 * u, () => {
        for (let lx = x + 0.1 * u; lx < x + w; lx += 0.06 * u) p.line([[lx, y], [lx + (p.rnd() - 0.5) * 0.04 * u, y + h]], darken(mat, 0.15), 0.35, 0.45);
    });
    p.letters('WELCOME', r.x + r.w / 2, y + h / 2, Math.min(h * 0.42, w * 0.15), darken(mat, 0.45));
}

/** Stairs going up to the back (or, turned, to the right): treads and
    risers between two stringers. Each riser faces us under the tread above
    it; the higher a step, the darker. Turned, the near side shows the steps'
    profile, rising to the right. */
export function stairs(p: Pen, r: Rect, [wood]: string[], rot: boolean): void {
    const u = p.u, sw = 0.2 * u;
    const steps = Math.max(3, Math.round((rot ? r.w : r.h) / (0.4 * u)));
    const tread = (k: number) => darken(lighten(wood, 0.2), k), riser = (k: number) => darken(wood, 0.35 + k);
    if (!rot) {
        const x = r.x + sw, w = r.w - sw * 2, sh = r.h / steps;
        for (let i = 0; i < steps; i++) {
            /* i = 0 is the top step, at the back. */
            const y = r.y + i * sh, k = (steps - 1 - i) / Math.max(1, steps - 1) * 0.35, th = sh * 0.7;
            p.rect(x, y, w, th).shadeFill(tread(k), 0, y, 0, y + th, 0.12).stroke(0.6);
            p.line([[x + 0.04 * u, y + th - 0.035 * u], [x + w - 0.04 * u, y + th - 0.035 * u]], lighten(wood, 0.45), 0.8, 0.9);
            p.rect(x, y + th, w, sh - th).fill(riser(k)).stroke(0.6);
        }
        p.rect(x, r.y, w, 0.25 * u).shade(0.35);
        for (const sx of [r.x, r.x + r.w - sw]) {
            p.rect(sx, r.y, sw, r.h).shadeFill(darken(wood, 0.12), sx, 0, sx + sw, 0, 0.3).stroke(0.8);
            p.line([[sx + sw * 0.35, r.y + 0.05 * u], [sx + sw * 0.35, r.y + r.h - 0.05 * u]], lighten(wood, 0.3), 0.8, 0.8);
            for (let i = 0; i < steps; i++) p.ell(sx + sw / 2, r.y + (i + 0.5) * sh, 0.035 * u, 0.035 * u).fill(darken(wood, 0.4));
        }
        return;
    }
    const top = r.y + sw, ground = r.y + r.h, sh = r.w / steps, maxRise = Math.min(0.6 * u, (ground - top) * 0.4);
    p.rect(r.x, r.y, r.w, sw).shadeFill(darken(wood, 0.12), 0, r.y, 0, r.y + sw, 0.3).stroke(0.8);
    for (let i = 0; i < steps; i++) {
        /* i = 0 is the bottom step, on the left. */
        const x = r.x + i * sh, rise = (i + 1) / steps * maxRise, k = i / Math.max(1, steps - 1) * 0.3, side = ground - rise;
        p.rect(x, top, sh, side - top).shadeFill(tread(k), x, 0, x + sh, 0, 0.12).stroke(0.6);
        p.line([[x + 0.035 * u, top + 0.04 * u], [x + 0.035 * u, side - 0.04 * u]], lighten(wood, 0.45), 0.8, 0.9);
        if (i) p.rect(x, top, 0.07 * u, side - top).fill(riser(k));
        /* The near side, stepping up. */
        p.rect(x, side, sh, rise).shadeFill(darken(wood, 0.18), 0, side, 0, ground, 0.25).stroke(0.7);
        p.line([[x, side], [x + sh, side]], lighten(wood, 0.3), 0.7, 0.8);
    }
}

/* ------------------------------------------------------ kitchen & bath */

/** Base cabinets with a worktop. Returns the worktop's face. */
function cabinets(p: Pen, r: Rect, cabinet: string, worktop: string, doors = true): { t: Rect; f: Rect } {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const body: Rect = { x: r.x + 0.06 * u, y: r.y + 0.08 * u, w: r.w - 0.12 * u, h: r.h - 0.08 * u - 0.12 * u };
    const { t, f } = block(p, body, cabinet, 0.5);
    /* The worktop overhangs, with a lit front edge. */
    p.rect(r.x + 0.02 * u, t.y - 0.02 * u, r.w - 0.04 * u, t.h + 0.04 * u).shadeFill(worktop, 0, t.y, 0, t.y + t.h, 0.12).stroke();
    p.rect(r.x + 0.02 * u, t.y + t.h + 0.02 * u, r.w - 0.04 * u, 0.1 * u).fill(darken(worktop, 0.12)).stroke(0.6);
    p.line([[r.x + 0.06 * u, t.y + t.h + 0.03 * u], [r.x + r.w - 0.06 * u, t.y + t.h + 0.03 * u]], lighten(worktop, 0.4), 0.7, 0.8);
    /* A row of drawers, then the doors. */
    const n = Math.max(1, Math.round(f.w / u)), cw = (f.w - 0.12 * u) / n, dy = f.y + 0.2 * u;
    for (let i = 0; i < n; i++) {
        const x = f.x + 0.06 * u + i * cw;
        panel(p, x + 0.04 * u, dy, cw - 0.08 * u, 0.26 * u, cabinet);
        handle(p, x + cw / 2 - 0.14 * u, dy + 0.13 * u, 0.28 * u);
        if (doors) {
            panel(p, x + 0.04 * u, dy + 0.34 * u, cw - 0.08 * u, f.y + f.h - dy - 0.34 * u - 0.18 * u, cabinet);
            handle(p, x + (i % 2 ? 0.16 * u : cw - 0.16 * u), dy + 0.45 * u, 0.3 * u, true);
        }
    }
    p.rect(r.x + 0.1 * u, ground - 0.2 * u, r.w - 0.2 * u, 0.14 * u).fill('#3a3430').stroke(0.5);
    return { t: { x: r.x + 0.02 * u, y: t.y - 0.02 * u, w: r.w - 0.04 * u, h: t.h + 0.04 * u }, f };
}

export function counter(p: Pen, r: Rect, [cabinet, worktop]: string[]): void {
    const u = p.u;
    const { t } = cabinets(p, r, cabinet, worktop);
    /* A chopping board with bread, and a jar. */
    p.rr(t.x + 0.25 * u, t.y + 0.1 * u, 0.6 * u, 0.32 * u, 0.06 * u).paint('#d8aa70', 0.5);
    p.ell(t.x + 0.55 * u, t.y + 0.24 * u, 0.2 * u, 0.1 * u).paint('#c88a40', 0.5);
    p.line([[t.x + 0.48 * u, t.y + 0.18 * u], [t.x + 0.45 * u, t.y + 0.3 * u]], '#a86a2a', 0.5);
    p.line([[t.x + 0.6 * u, t.y + 0.18 * u], [t.x + 0.57 * u, t.y + 0.3 * u]], '#a86a2a', 0.5);
    const jx = t.x + t.w - 0.45 * u, jy = t.y + t.h * 0.75;
    p.rr(jx, jy - 0.34 * u, 0.24 * u, 0.34 * u, 0.06 * u).fill('#d8ecf4').stroke(0.5);
    p.rr(jx + 0.03 * u, jy - 0.22 * u, 0.18 * u, 0.2 * u, 0.04 * u).fill('#e0a040');
    p.rect(jx - 0.01 * u, jy - 0.4 * u, 0.26 * u, 0.08 * u).paint('#c84a3a', 0.5);
}

export function stove(p: Pen, r: Rect, [body]: string[]): void {
    const u = p.u, ground = r.y + r.h, x = r.x + 0.06 * u, w = r.w - 0.12 * u;
    floorShadow(p, r);
    /* The splashback with its dials. */
    p.rect(x + 0.04 * u, r.y + 0.05 * u, w - 0.08 * u, 0.28 * u).shadeFill(darken(body, 0.05), 0, r.y, 0, r.y + 0.33 * u, 0.2).stroke(0.7);
    for (let i = 0; i < 4; i++) knob(p, x + 0.2 * u + i * (w - 0.4 * u) / 3, r.y + 0.19 * u, 0.045 * u, '#3a3a40');
    const b: Rect = { x, y: r.y + 0.33 * u, w, h: ground - r.y - 0.33 * u - 0.1 * u };
    const { t, f } = block(p, b, body, 0.55, 0);
    /* Four burners, two of them alight. */
    for (const [fx, fy, on] of [[0.28, 0.32, 1], [0.72, 0.32, 0], [0.28, 0.75, 0], [0.72, 0.75, 1]] as const) {
        const bx = t.x + t.w * fx, by = t.y + t.h * fy;
        p.ell(bx, by, 0.17 * u, 0.09 * u).fill('#2a2a2e').stroke(0.5);
        p.ell(bx, by, 0.1 * u, 0.05 * u).fill(on ? '#e05a30' : '#4a4a50');
        if (on) p.glow(bx, by, 0.4 * u);
    }
    /* The oven: a handle, a window, a little light. */
    const oy = f.y + 0.14 * u;
    handle(p, f.x + 0.18 * u, oy, f.w - 0.36 * u, false, '#a8a8b0');
    p.rr(f.x + 0.12 * u, oy + 0.12 * u, f.w - 0.24 * u, f.h - 0.32 * u, 0.06 * u).fill(darken(body, 0.1)).stroke(0.6);
    p.rr(f.x + 0.22 * u, oy + 0.24 * u, f.w - 0.44 * u, f.h - 0.58 * u, 0.05 * u).fill(p.look.night ? '#a85a20' : '#2a2a30').stroke(0.5);
    p.rect(f.x + 0.28 * u, oy + 0.28 * u, 0.1 * u, f.h - 0.68 * u).shine(0.25);
    p.rect(x + 0.04 * u, ground - 0.14 * u, w - 0.08 * u, 0.1 * u).fill('#3a3430');
}

export function fridge(p: Pen, r: Rect, [body]: string[]): void {
    const u = p.u, ground = r.y + r.h, x = r.x + 0.08 * u, w = r.w - 0.16 * u;
    floorShadow(p, r, 0.45);
    p.rr(x, r.y + 0.04 * u, w, 0.32 * u, [0.1 * u, 0.1 * u, 0, 0]).shadeFill(lighten(body, 0.1), 0, r.y, 0, r.y + 0.36 * u, 0.1).stroke();
    const fy = r.y + 0.36 * u, fh = ground - fy - 0.12 * u;
    p.rr(x, fy, w, fh, [0, 0, 0.08 * u, 0.08 * u]).shadeFill(body, x, fy, x + w, fy + fh, 0.18).stroke();
    p.rect(x + w - 0.1 * u, fy, 0.1 * u, fh).shade(0.1);
    /* Freezer above, fridge below; handles on the left. */
    const split = fy + fh * 0.36;
    p.line([[x, split], [x + w, split]], null, 1);
    handle(p, x + 0.14 * u, fy + fh * 0.12, fh * 0.18, true, '#b8bcc4');
    handle(p, x + 0.14 * u, split + fh * 0.06, fh * 0.3, true, '#b8bcc4');
    p.rect(x + 0.06 * u, fy + 0.05 * u, 0.06 * u, fh - 0.1 * u).shine(0.3);
    /* Magnets and a note. */
    p.rect(x + w * 0.5, split + 0.25 * u, 0.26 * u, 0.32 * u).fill('#f8f4e0').stroke(0.4);
    for (let k = 0; k < 3; k++) p.line([[x + w * 0.5 + 0.05 * u, split + (0.33 + k * 0.07) * u], [x + w * 0.5 + 0.21 * u, split + (0.33 + k * 0.07) * u]], '#8a8a8a', 0.3);
    p.ell(x + w * 0.5 + 0.13 * u, split + 0.25 * u, 0.04 * u, 0.04 * u).fill('#e04848');
    p.ell(x + w * 0.62, fy + fh * 0.18, 0.06 * u, 0.06 * u).fill('#3a8ad0').stroke(0.3);
    p.rr(x + w * 0.4, fy + fh * 0.1, 0.12 * u, 0.12 * u, 0.03 * u).fill('#f0c040').stroke(0.3);
    /* A grille at the foot. */
    p.rect(x + 0.1 * u, ground - 0.24 * u, w - 0.2 * u, 0.1 * u).fill(darken(body, 0.3));
    for (let gx = x + 0.16 * u; gx < x + w - 0.12 * u; gx += 0.08 * u) p.line([[gx, ground - 0.23 * u], [gx, ground - 0.15 * u]], darken(body, 0.5), 0.4);
}

export function sink(p: Pen, r: Rect, [cabinet]: string[]): void {
    const u = p.u;
    const { t } = cabinets(p, r, cabinet, '#d8dade');
    /* The basin let into the worktop, the tap arching over it. */
    const cx = t.x + t.w / 2, by = t.y + 0.08 * u, bw = 0.95 * u, bh = t.h - 0.14 * u;
    p.rr(cx - bw / 2, by, bw, bh, 0.1 * u).fill('#a8b0b8').stroke(0.7);
    p.rr(cx - bw / 2 + 0.06 * u, by + 0.06 * u, bw - 0.12 * u, bh - 0.08 * u, 0.08 * u).shadeFill('#8ab0c8', 0, by, 0, by + bh, 0.2).stroke(0.4);
    p.rect(cx - bw / 2 + 0.06 * u, by + 0.06 * u, bw - 0.12 * u, 0.08 * u).shade(0.25);
    p.ell(cx, by + bh * 0.6, 0.04 * u, 0.025 * u).fill('#4a4a50');
    p.ctx.beginPath();
    p.ctx.moveTo(cx + 0.02 * u, by + 0.02 * u);
    p.ctx.lineTo(cx + 0.02 * u, by - 0.32 * u);
    p.ctx.quadraticCurveTo(cx + 0.02 * u, by - 0.44 * u, cx - 0.14 * u, by - 0.4 * u);
    p.ctx.lineTo(cx - 0.16 * u, by - 0.28 * u);
    p.ctx.strokeStyle = p.c('#a8acb4');
    p.ctx.lineWidth = 0.07 * u;
    p.ctx.lineCap = 'round';
    p.ctx.stroke();
    for (const dx of [-0.2, 0.24]) p.ell(cx + dx * u, by - 0.02 * u, 0.06 * u, 0.04 * u).fill(dx < 0 ? '#5a8ad0' : '#d05a5a').stroke(0.4);
    /* A sponge and a bottle of washing-up liquid. */
    p.rr(t.x + 0.18 * u, t.y + t.h * 0.45, 0.24 * u, 0.12 * u, 0.03 * u).paint('#f0d040', 0.4);
    p.rect(t.x + 0.18 * u, t.y + t.h * 0.45, 0.24 * u, 0.04 * u).fill('#4a9a4a');
    const bx = t.x + t.w - 0.38 * u;
    p.rr(bx, t.y + t.h * 0.75 - 0.36 * u, 0.16 * u, 0.36 * u, 0.04 * u).fill('#60c080').stroke(0.5);
    p.rect(bx + 0.05 * u, t.y + t.h * 0.75 - 0.44 * u, 0.06 * u, 0.08 * u).fill('#e8e8ec').stroke(0.3);
}

export function kitchenShelf(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const body: Rect = { x: r.x + 0.04 * u, y: r.y + 0.04 * u, w: r.w - 0.08 * u, h: r.h - 0.16 * u };
    const { f } = block(p, body, wood, 0.24);
    const inner: Rect = { x: f.x + 0.1 * u, y: f.y + 0.12 * u, w: f.w - 0.2 * u, h: f.h - 0.22 * u };
    p.rect(inner.x, inner.y, inner.w, inner.h).fill(darken(wood, 0.35)).stroke(0.5);
    const sh = inner.h / 3;
    for (let s = 0; s < 3; s++) {
        const y = inner.y + s * sh, floor = y + sh - 0.07 * u;
        p.rect(inner.x, y, inner.w, 0.08 * u).shade(0.3);
        if (s === 0) {
            /* Plates standing up, a rail in front. */
            for (let x = inner.x + 0.22 * u; x < inner.x + inner.w - 0.15 * u; x += 0.3 * u) {
                p.ell(x, floor - 0.22 * u, 0.2 * u, 0.2 * u).fill('#f4f2ec').stroke(0.5);
                p.ell(x, floor - 0.22 * u, 0.12 * u, 0.12 * u).stroke(0.3);
                p.ell(x, floor - 0.22 * u, 0.16 * u, 0.16 * u).fill('#5a8ac0');
                p.ell(x, floor - 0.22 * u, 0.12 * u, 0.12 * u).fill('#f4f2ec');
            }
            p.line([[inner.x, floor - 0.12 * u], [inner.x + inner.w, floor - 0.12 * u]], darken(wood, 0.1), 1.2);
        } else if (s === 1) {
            /* Jars of things. */
            const fills = ['#e0a040', '#c84a3a', '#8a5a30', '#e8e0c8', '#6aa048'];
            let i = 0;
            for (let x = inner.x + 0.08 * u; x < inner.x + inner.w - 0.26 * u; x += 0.3 * u, i++) {
                const jh = (0.3 + (i % 3) * 0.06) * u;
                p.rr(x, floor - jh, 0.24 * u, jh, 0.05 * u).fill('#dceef4').stroke(0.5);
                p.rr(x + 0.03 * u, floor - jh * 0.72, 0.18 * u, jh * 0.68, 0.04 * u).fill(fills[i % fills.length]);
                p.rect(x - 0.01 * u, floor - jh - 0.06 * u, 0.26 * u, 0.07 * u).paint(i % 2 ? '#c84a3a' : '#e8e0d0', 0.4);
                p.rect(x + 0.04 * u, floor - jh * 0.6, 0.16 * u, 0.1 * u).fill('#f8f4e8');
            }
        } else {
            /* A pot and a stack of bowls. */
            const px = inner.x + 0.15 * u;
            p.rr(px, floor - 0.32 * u, 0.55 * u, 0.32 * u, [0.03 * u, 0.03 * u, 0.1 * u, 0.1 * u]).shadeFill('#8a9098', px, 0, px + 0.55 * u, 0, 0.3).stroke(0.6);
            p.rect(px - 0.06 * u, floor - 0.3 * u, 0.67 * u, 0.06 * u).fill('#6a7078').stroke(0.4);
            p.rr(px + 0.2 * u, floor - 0.4 * u, 0.15 * u, 0.08 * u, 0.03 * u).fill('#3a3a40');
            const bx = inner.x + inner.w - 0.65 * u;
            for (let k = 0; k < 3; k++) p.rr(bx + k * 0.03 * u, floor - (k + 1) * 0.11 * u, 0.5 * u - k * 0.06 * u, 0.12 * u, [0.02 * u, 0.02 * u, 0.06 * u, 0.06 * u]).paint(['#e8c890', '#d8e8f0', '#e86a4a'][k], 0.4);
        }
        p.rect(inner.x - 0.04 * u, floor, inner.w + 0.08 * u, 0.08 * u).fill(lighten(wood, 0.15)).stroke(0.5);
    }
    p.rect(r.x + 0.04 * u, ground - 0.15 * u, r.w - 0.08 * u, 0.12 * u).fill(darken(wood, 0.22)).stroke(0.6);
}

export function bathtub(p: Pen, r: Rect, [tub]: string[]): void {
    const u = p.u, ground = r.y + r.h, x = r.x + 0.08 * u, w = r.w - 0.16 * u;
    floorShadow(p, r);
    /* Claw feet, the tub's front, its rim and the water inside. */
    for (const fx of [x + 0.3 * u, x + w - 0.42 * u]) p.rr(fx, ground - 0.24 * u, 0.14 * u, 0.22 * u, [0.02 * u, 0.02 * u, 0.06 * u, 0.06 * u]).paint(BRASS, 0.6);
    const rimY = r.y + 0.4 * u, rimH = r.h - 1.25 * u;
    p.rr(x, rimY + rimH * 0.5, w, ground - rimY - rimH * 0.5 - 0.18 * u, [0, 0, 0.5 * u, 0.5 * u]).shadeFill(tub, 0, rimY, 0, ground, 0.2).stroke();
    p.rect(x + w - 0.3 * u, rimY + rimH * 0.5, 0.3 * u, ground - rimY - rimH * 0.5 - 0.4 * u).shade(0.08);
    p.rr(x, rimY, w, rimH, 0.4 * u).shadeFill(lighten(tub, 0.05), 0, rimY, 0, rimY + rimH, 0.1).stroke();
    const ix = x + 0.16 * u, iy = rimY + 0.14 * u, iw = w - 0.32 * u, ih = rimH - 0.26 * u;
    p.rr(ix, iy, iw, ih, 0.3 * u).fill(darken(tub, 0.12)).stroke(0.6);
    p.rr(ix + 0.05 * u, iy + 0.12 * u, iw - 0.1 * u, ih - 0.16 * u, 0.26 * u).shadeFill('#9cd0ec', ix, iy, ix + iw, iy + ih, 0.25).stroke(0.4);
    /* Foam, a rubber duck, the taps at the end. */
    p.reseed(Math.round(r.w));
    for (let i = 0; i < 9; i++) p.ell(ix + 0.3 * u + p.rnd() * iw * 0.45, iy + 0.3 * u + p.rnd() * (ih - 0.5 * u), (0.08 + p.rnd() * 0.08) * u, (0.06 + p.rnd() * 0.05) * u).fill('#ffffff').stroke(0.25);
    const dx = ix + iw * 0.68, dy = iy + ih * 0.55;
    p.ell(dx, dy, 0.17 * u, 0.11 * u).fill('#f8d030').stroke(0.5);
    p.ell(dx + 0.1 * u, dy - 0.13 * u, 0.09 * u, 0.09 * u).fill('#f8d030').stroke(0.5);
    p.poly([[dx + 0.17 * u, dy - 0.14 * u], [dx + 0.27 * u, dy - 0.11 * u], [dx + 0.17 * u, dy - 0.08 * u]]).fill('#f08030');
    p.ell(dx + 0.12 * u, dy - 0.15 * u, 0.02 * u, 0.02 * u).fill('#1a1a1a');
    const tx = x + w - 0.42 * u;
    p.rr(tx - 0.04 * u, rimY - 0.3 * u, 0.08 * u, 0.4 * u, 0.04 * u).fill(STEEL).stroke(0.5);
    p.rr(tx - 0.04 * u, rimY - 0.3 * u, 0.25 * u, 0.08 * u, 0.04 * u).fill(STEEL).stroke(0.5);
    for (const kx of [tx - 0.18 * u, tx + 0.18 * u]) knob(p, kx, rimY + 0.02 * u, 0.05 * u, STEEL);
    p.ell(x + 0.45 * u, rimY + 0.06 * u, 0.3 * u, 0.04 * u).shine(0.6);
}

export function toilet(p: Pen, r: Rect, [ceramic]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    floorShadow(p, r, 0.35);
    /* The cistern, its lid and the flush button. */
    const tw = 0.66 * u;
    const { t } = block(p, { x: cx - tw / 2, y: r.y + 0.08 * u, w: tw, h: 0.62 * u }, ceramic, 0.16, 0);
    p.ell(cx, t.y + t.h / 2, 0.08 * u, 0.04 * u).fill(STEEL).stroke(0.4);
    /* The pedestal, then the bowl with its seat and lid up against the cistern. */
    const by = ground - 0.72 * u;
    p.poly([[cx - 0.22 * u, by], [cx + 0.22 * u, by], [cx + 0.15 * u, ground - 0.05 * u], [cx - 0.15 * u, ground - 0.05 * u]]).shadeFill(ceramic, cx - 0.22 * u, 0, cx + 0.22 * u, 0, 0.25).stroke();
    p.rect(cx - 0.2 * u, ground - 0.1 * u, 0.4 * u, 0.06 * u).fill(darken(ceramic, 0.12)).stroke(0.4);
    p.rr(cx - 0.3 * u, r.y + 0.7 * u, 0.6 * u, by - r.y - 0.72 * u, 0.12 * u).shadeFill(darken(ceramic, 0.04), cx - 0.3 * u, 0, cx + 0.3 * u, 0, 0.2).stroke(0.7);
    p.ell(cx, by - 0.05 * u, 0.34 * u, 0.26 * u).shadeFill(ceramic, cx - 0.34 * u, 0, cx + 0.34 * u, 0, 0.2).stroke();
    p.ell(cx, by - 0.07 * u, 0.22 * u, 0.15 * u).fill(darken(ceramic, 0.1)).stroke(0.5);
    p.ell(cx, by - 0.04 * u, 0.16 * u, 0.1 * u).fill('#a8d0e4');
    p.ell(cx - 0.15 * u, by - 0.16 * u, 0.08 * u, 0.04 * u).shine(0.6);
}

export function washbasin(p: Pen, r: Rect, [ceramic]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    floorShadow(p, r, 0.35);
    /* The pedestal. */
    const top = r.y + r.h * 0.5;
    p.poly([[cx - 0.1 * u, top], [cx + 0.1 * u, top], [cx + 0.16 * u, ground - 0.05 * u], [cx - 0.16 * u, ground - 0.05 * u]]).shadeFill(ceramic, cx - 0.16 * u, 0, cx + 0.16 * u, 0, 0.3).stroke();
    /* The bowl's front, its rim, the basin and the taps. */
    const ry = r.y + r.h * 0.36;
    p.ctx.beginPath();
    p.ctx.moveTo(cx - 0.44 * u, ry);
    p.ctx.quadraticCurveTo(cx - 0.4 * u, ry + 0.42 * u, cx, ry + 0.45 * u);
    p.ctx.quadraticCurveTo(cx + 0.4 * u, ry + 0.42 * u, cx + 0.44 * u, ry);
    p.ctx.closePath();
    p.shadeFill(ceramic, cx - 0.44 * u, ry, cx + 0.44 * u, ry + 0.45 * u, 0.25).stroke();
    p.ell(cx, ry, 0.44 * u, 0.2 * u).shadeFill(lighten(ceramic, 0.05), 0, ry - 0.2 * u, 0, ry + 0.2 * u, 0.1).stroke();
    p.ell(cx, ry + 0.02 * u, 0.3 * u, 0.12 * u).shadeFill('#b8d8e8', 0, ry - 0.1 * u, 0, ry + 0.14 * u, 0.25).stroke(0.5);
    p.ell(cx, ry + 0.04 * u, 0.03 * u, 0.02 * u).fill('#4a4a50');
    p.rr(cx - 0.035 * u, ry - 0.36 * u, 0.07 * u, 0.24 * u, 0.03 * u).fill(STEEL).stroke(0.4);
    p.rr(cx - 0.035 * u, ry - 0.36 * u, 0.16 * u, 0.06 * u, 0.03 * u).fill(STEEL).stroke(0.4);
    for (const dx of [-0.2, 0.2]) knob(p, cx + dx * u, ry - 0.12 * u, 0.045 * u, dx < 0 ? '#5a8ad0' : '#d05a5a');
    p.rr(cx + 0.24 * u, ry - 0.06 * u, 0.12 * u, 0.06 * u, 0.03 * u).fill('#f0b0c8').stroke(0.3);
}

/* -------------------------------------------------------- shops & misc */

export function shopShelf(p: Pen, r: Rect, [metal]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const body: Rect = { x: r.x + 0.04 * u, y: r.y + 0.04 * u, w: r.w - 0.08 * u, h: r.h - 0.14 * u };
    const { f } = block(p, body, metal, 0.24);
    const inner: Rect = { x: f.x + 0.08 * u, y: f.y + 0.1 * u, w: f.w - 0.16 * u, h: f.h - 0.22 * u };
    p.rect(inner.x, inner.y, inner.w, inner.h).fill(darken(metal, 0.35)).stroke(0.5);
    const goods = ['#e04848', '#3a8ad0', '#f0b030', '#58a848', '#a060c0', '#f07830'];
    p.reseed(Math.round(r.w * 7));
    const rows = 3, sh = inner.h / rows;
    for (let s = 0; s < rows; s++) {
        const y = inner.y + s * sh, floor = y + sh - 0.08 * u;
        p.rect(inner.x, y, inner.w, 0.07 * u).shade(0.3);
        /* Each shelf in runs of one kind: cans, boxes or bottles. */
        let x = inner.x + 0.05 * u;
        while (x < inner.x + inner.w - 0.3 * u) {
            const kind = Math.floor(p.rnd() * 3), c = goods[Math.floor(p.rnd() * goods.length)];
            const run = Math.min(3 + Math.floor(p.rnd() * 3), Math.floor((inner.x + inner.w - 0.05 * u - x) / (0.2 * u)));
            for (let k = 0; k < run; k++) {
                if (kind === 0) {
                    p.rr(x, floor - 0.28 * u, 0.17 * u, 0.28 * u, 0.03 * u).fill(c).stroke(0.4);
                    p.rect(x, floor - 0.2 * u, 0.17 * u, 0.1 * u).fill('#f4f0e8');
                    x += 0.19 * u;
                } else if (kind === 1) {
                    p.rect(x, floor - 0.38 * u, 0.22 * u, 0.38 * u).shadeFill(c, x, 0, x + 0.22 * u, 0, 0.25).stroke(0.4);
                    p.ell(x + 0.11 * u, floor - 0.22 * u, 0.06 * u, 0.06 * u).fill('#f4f0e8');
                    x += 0.24 * u;
                } else {
                    p.rr(x + 0.02 * u, floor - 0.32 * u, 0.13 * u, 0.32 * u, [0.04 * u, 0.04 * u, 0.02 * u, 0.02 * u]).fill(c).stroke(0.4);
                    p.rect(x + 0.06 * u, floor - 0.42 * u, 0.05 * u, 0.1 * u).fill(darken(c, 0.2));
                    p.rect(x + 0.04 * u, floor - 0.28 * u, 0.04 * u, 0.18 * u).shine(0.4);
                    x += 0.17 * u;
                }
            }
            x += 0.08 * u;
        }
        /* The shelf edge with its price tags. */
        p.rect(inner.x - 0.04 * u, floor, inner.w + 0.08 * u, 0.09 * u).fill(lighten(metal, 0.2)).stroke(0.5);
        for (let tx = inner.x + 0.2 * u; tx < inner.x + inner.w - 0.1 * u; tx += 0.6 * u) p.rect(tx, floor + 0.01 * u, 0.16 * u, 0.07 * u).fill('#f8f8a0');
    }
    p.rect(r.x + 0.04 * u, ground - 0.13 * u, r.w - 0.08 * u, 0.11 * u).fill(darken(metal, 0.3)).stroke(0.6);
}

export function shopCounter(p: Pen, r: Rect, [wood, top]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const body: Rect = { x: r.x + 0.06 * u, y: r.y + 0.35 * u, w: r.w - 0.12 * u, h: r.h - 0.35 * u - 0.08 * u };
    const { t, f } = block(p, body, wood, 0.5);
    p.rect(r.x + 0.02 * u, t.y - 0.02 * u, r.w - 0.04 * u, t.h + 0.04 * u).shadeFill(top, 0, t.y, 0, t.y + t.h, 0.12).stroke();
    p.rect(r.x + 0.02 * u, t.y + t.h + 0.02 * u, r.w - 0.04 * u, 0.1 * u).fill(darken(top, 0.12)).stroke(0.6);
    /* A stripe and panels along the front. */
    p.rect(f.x, f.y + 0.22 * u, f.w, 0.1 * u).fill(lighten(wood, 0.3));
    const n = Math.max(2, Math.round(f.w / (0.9 * u))), pw = (f.w - 0.2 * u) / n;
    for (let i = 0; i < n; i++) panel(p, f.x + 0.1 * u + i * pw + 0.04 * u, f.y + 0.42 * u, pw - 0.08 * u, f.h - 0.55 * u, wood);
    p.rect(f.x, ground - 0.2 * u, f.w, 0.12 * u).fill(darken(wood, 0.3)).stroke(0.5);
    /* The till: drawer, keys, a display; a paper bag beside it. */
    const tx = t.x + t.w - 1.0 * u, ty = t.y + t.h * 0.8;
    p.rect(tx, ty - 0.22 * u, 0.7 * u, 0.22 * u).shadeFill('#4a4a52', 0, ty - 0.22 * u, 0, ty, 0.2).stroke(0.6);
    p.poly([[tx + 0.04 * u, ty - 0.22 * u], [tx + 0.66 * u, ty - 0.22 * u], [tx + 0.58 * u, ty - 0.5 * u], [tx + 0.12 * u, ty - 0.5 * u]]).fill('#5a5a62').stroke(0.6);
    for (let k = 0; k < 6; k++) p.rect(tx + 0.17 * u + (k % 3) * 0.13 * u, ty - 0.45 * u + Math.floor(k / 3) * 0.1 * u, 0.09 * u, 0.06 * u).fill('#e8e8ec');
    p.rect(tx + 0.2 * u, ty - 0.82 * u, 0.36 * u, 0.24 * u).fill('#2a2a30').stroke(0.5);
    p.rect(tx + 0.25 * u, ty - 0.78 * u, 0.26 * u, 0.13 * u).fill('#8ad0a0');
    p.rect(tx + 0.34 * u, ty - 0.58 * u, 0.08 * u, 0.1 * u).fill('#3a3a40');
    const gx = t.x + 0.35 * u;
    p.poly([[gx, ty], [gx + 0.4 * u, ty], [gx + 0.36 * u, ty - 0.48 * u], [gx + 0.04 * u, ty - 0.48 * u]]).shadeFill('#c8a070', gx, 0, gx + 0.4 * u, 0, 0.25).stroke(0.5);
    p.ell(gx + 0.12 * u, ty - 0.52 * u, 0.08 * u, 0.06 * u).fill('#e04848');
    p.line([[gx + 0.24 * u, ty - 0.48 * u], [gx + 0.28 * u, ty - 0.62 * u]], '#58a848', 1.2);
}

export function healingMachine(p: Pen, r: Rect, [body, light]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const b: Rect = { x: r.x + 0.06 * u, y: r.y + 0.05 * u, w: r.w - 0.12 * u, h: r.h - 0.15 * u };
    const { t, f } = block(p, b, body, 0.72);
    /* A tray of six round sockets, each holding a ball. */
    p.rr(t.x + 0.16 * u, t.y + 0.08 * u, t.w - 0.32 * u, t.h - 0.16 * u, 0.12 * u).fill(darken(body, 0.35)).stroke(0.6);
    for (let i = 0; i < 6; i++) {
        const x = t.x + 0.42 * u + (i % 3) * (t.w - 0.84 * u) / 2, y = t.y + 0.24 * u + Math.floor(i / 3) * (t.h - 0.48 * u);
        p.ell(x, y, 0.15 * u, 0.12 * u).fill('#2a2a30').stroke(0.4);
        p.ell(x, y - 0.02 * u, 0.11 * u, 0.1 * u).fill('#f4f4f4').stroke(0.4);
        p.ctx.save(); p.ell(x, y - 0.02 * u, 0.11 * u, 0.1 * u); p.ctx.clip();
        p.rect(x - 0.12 * u, y - 0.13 * u, 0.24 * u, 0.1 * u).fill(light);
        p.ctx.restore();
        p.line([[x - 0.11 * u, y - 0.03 * u], [x + 0.11 * u, y - 0.03 * u]], '#2a2a30', 0.6);
        p.ell(x, y - 0.03 * u, 0.03 * u, 0.03 * u).fill('#f4f4f4').stroke(0.4);
    }
    /* A screen with a heartbeat, buttons, a vent. */
    const sx = f.x + 0.2 * u, sy = f.y + 0.14 * u, sw = f.w * 0.5, sh = f.h - 0.4 * u;
    p.rr(sx, sy, sw, sh, 0.05 * u).fill('#1a2228').stroke(0.6);
    p.glow(sx + sw / 2, sy + sh / 2, 1.2 * u);
    p.line([[sx + 0.06 * u, sy + sh * 0.55], [sx + sw * 0.3, sy + sh * 0.55], [sx + sw * 0.38, sy + sh * 0.2], [sx + sw * 0.46, sy + sh * 0.85], [sx + sw * 0.54, sy + sh * 0.55], [sx + sw - 0.06 * u, sy + sh * 0.55]], light, 1);
    for (let k = 0; k < 3; k++) p.ell(f.x + f.w * 0.72 + k * 0.17 * u, sy + 0.12 * u, 0.06 * u, 0.06 * u).fill(k === 0 ? light : k === 1 ? '#60c080' : '#f0c040').stroke(0.4);
    for (let k = 0; k < 3; k++) p.line([[f.x + f.w * 0.7, sy + (0.32 + k * 0.08) * u], [f.x + f.w - 0.2 * u, sy + (0.32 + k * 0.08) * u]], darken(body, 0.3), 0.6);
    p.rect(f.x, ground - 0.2 * u, f.w, 0.1 * u).fill(darken(body, 0.35));
}

export function chest(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h, x = r.x + 0.08 * u, w = r.w - 0.16 * u;
    floorShadow(p, r, 0.42);
    /* The body in planks, the domed lid, iron bands, the lock. */
    const ly = r.y + 0.08 * u, lh = 0.48 * u, by = ly + lh, bh = ground - by - 0.06 * u;
    p.rect(x, by, w, bh).shadeFill(wood, 0, by, 0, by + bh, 0.25).stroke();
    for (let y = by + bh / 3; y < by + bh - 0.05 * u; y += bh / 3) p.line([[x, y], [x + w, y]], darken(wood, 0.3), 0.5);
    p.rr(x, ly, w, lh + 0.02 * u, [lh * 0.9, lh * 0.9, 0, 0]).shadeFill(lighten(wood, 0.1), 0, ly, 0, by, 0.2).stroke();
    p.line([[x + 0.06 * u, ly + lh * 0.55], [x + w - 0.06 * u, ly + lh * 0.55]], darken(wood, 0.25), 0.45);
    p.line([[x, by], [x + w, by]], INK_DARK, 1);
    for (const bx of [x + 0.14 * u, x + w - 0.26 * u]) {
        p.rr(bx, ly + 0.04 * u, 0.12 * u, ground - ly - 0.1 * u, [0.06 * u, 0.06 * u, 0, 0]).shadeFill('#5a5a62', bx, 0, bx + 0.12 * u, 0, 0.3).stroke(0.5);
        for (const ry of [ly + 0.2 * u, by + 0.15 * u, ground - 0.2 * u]) p.ell(bx + 0.06 * u, ry, 0.025 * u, 0.025 * u).fill('#a8a8b0');
    }
    const cx = r.x + r.w / 2;
    p.rr(cx - 0.12 * u, by - 0.08 * u, 0.24 * u, 0.28 * u, 0.04 * u).fill(BRASS).stroke(0.5);
    p.ell(cx, by + 0.04 * u, 0.035 * u, 0.035 * u).fill(INK_DARK);
    p.rect(cx - 0.015 * u, by + 0.05 * u, 0.03 * u, 0.07 * u).fill(INK_DARK);
}

export function boxes(p: Pen, r: Rect, [card]: string[]): void {
    const u = p.u;
    floorShadow(p, r, 0.45);
    const one = (x: number, y: number, w: number, h: number, label: boolean) => {
        const { t, f } = block(p, { x, y, w, h }, card, Math.min(0.3, h / u * 0.35), 0.02);
        /* Tape over the top and down the front; flaps. */
        p.line([[t.x, t.y + t.h / 2], [t.x + t.w, t.y + t.h / 2]], darken(card, 0.15), 0.4);
        p.rect(t.x + t.w / 2 - 0.05 * u, t.y, 0.1 * u, t.h + 0.12 * u).fill('#e8cc90').stroke(0.3);
        if (label) {
            p.rect(f.x + f.w * 0.15, f.y + f.h * 0.35, f.w * 0.45, f.h * 0.3).fill('#f8f4ea').stroke(0.4);
            for (let k = 0; k < 2; k++) p.line([[f.x + f.w * 0.2, f.y + f.h * (0.45 + k * 0.1)], [f.x + f.w * 0.55, f.y + f.h * (0.45 + k * 0.1)]], '#6a6a6a', 0.35);
        } else {
            /* "This way up" arrows. */
            for (const ax of [0.3, 0.55]) p.line([[f.x + f.w * ax, f.y + f.h * 0.7], [f.x + f.w * ax, f.y + f.h * 0.35], [f.x + f.w * ax - 0.05 * u, f.y + f.h * 0.45], [f.x + f.w * ax, f.y + f.h * 0.35], [f.x + f.w * ax + 0.05 * u, f.y + f.h * 0.45]], darken(card, 0.45), 0.6);
        }
    };
    one(r.x + 0.05 * u, r.y + r.h - 0.95 * u, 0.8 * u, 0.9 * u, true);
    one(r.x + r.w - 0.75 * u, r.y + r.h - 0.72 * u, 0.68 * u, 0.68 * u, false);
    one(r.x + 0.18 * u, r.y + r.h - 1.65 * u, 0.62 * u, 0.72 * u, false);
}

export function standingLamp(p: Pen, r: Rect, [shade]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    p.glow(cx, r.y + 0.45 * u, 1.8 * u);
    floorShadow(p, r, 0.3);
    p.ell(cx, ground - 0.1 * u, 0.26 * u, 0.08 * u).shadeFill('#3a3a40', cx - 0.26 * u, 0, cx + 0.26 * u, 0, 0.3).stroke(0.6);
    p.rr(cx - 0.035 * u, r.y + 0.65 * u, 0.07 * u, ground - r.y - 0.75 * u, 0.03 * u).shadeFill('#5a5a62', cx - 0.035 * u, 0, cx + 0.035 * u, 0, 0.3).stroke(0.4);
    p.ell(cx, ground - 0.85 * u, 0.06 * u, 0.04 * u).fill(BRASS).stroke(0.3);
    p.poly([[cx - 0.32 * u, r.y + 0.72 * u], [cx + 0.32 * u, r.y + 0.72 * u], [cx + 0.2 * u, r.y + 0.14 * u], [cx - 0.2 * u, r.y + 0.14 * u]]);
    if (p.look.night) { p.ctx.save(); p.ctx.shadowColor = 'rgba(255,210,130,.9)'; p.ctx.shadowBlur = u * 0.5; p.ctx.fillStyle = lighten(shade, 0.45); p.ctx.fill(); p.ctx.restore(); p.stroke(0.8); }
    else {
        p.shadeFill(shade, cx - 0.32 * u, 0, cx + 0.32 * u, 0, 0.25).stroke(0.8);
        for (const dx of [-0.12, 0, 0.12]) p.line([[cx + dx * u * 1.5, r.y + 0.7 * u], [cx + dx * u, r.y + 0.16 * u]], darken(shade, 0.12), 0.35, 0.6);
    }
    p.ell(cx, r.y + 0.14 * u, 0.2 * u, 0.05 * u).fill(darken(shade, 0.2)).stroke(0.4);
    p.rect(cx - 0.32 * u, r.y + 0.66 * u, 0.64 * u, 0.06 * u).fill(darken(shade, 0.15));
}

export function desk(p: Pen, r: Rect, [wood]: string[]): void {
    const u = p.u, ground = r.y + r.h;
    floorShadow(p, r);
    const ty = r.y + 0.3 * u, depth = r.h - 0.3 * u - 0.98 * u;
    /* A leg on the left, a pedestal of drawers on the right. */
    const lx = r.x + 0.1 * u;
    p.rect(lx + 0.22 * u, ty + depth + 0.12 * u, 0.12 * u, ground - ty - depth - 0.4 * u).fill(darken(wood, 0.4)).stroke(0.5);
    p.rect(lx, ty + depth + 0.12 * u, 0.13 * u, ground - ty - depth - 0.15 * u).shadeFill(darken(wood, 0.12), lx, 0, lx + 0.13 * u, 0, 0.3).stroke(0.6);
    const t = tableTop(p, r.x + 0.02 * u, ty, r.w - 0.04 * u, depth, 0.14 * u, wood);
    const px = r.x + r.w - 0.85 * u, py = t.y + t.h + 0.14 * u, ph = ground - py - 0.04 * u;
    p.rect(px, py, 0.78 * u, ph).shadeFill(wood, 0, py, 0, ground, 0.25).stroke();
    for (let i = 0; i < 3; i++) {
        const dy = py + 0.06 * u + i * (ph - 0.1 * u) / 3;
        panel(p, px + 0.07 * u, dy, 0.64 * u, (ph - 0.1 * u) / 3 - 0.06 * u, wood);
        knob(p, px + 0.39 * u, dy + ((ph - 0.1 * u) / 3 - 0.06 * u) / 2, 0.04 * u);
    }
    /* Paper and a pen, a pot of pencils, a stack of books. */
    p.poly([[t.x + 0.25 * u, t.y + 0.12 * u], [t.x + 0.8 * u, t.y + 0.08 * u], [t.x + 0.84 * u, t.y + t.h * 0.75], [t.x + 0.28 * u, t.y + t.h * 0.78]]).fill('#f8f6ee').stroke(0.5);
    for (let k = 0; k < 3; k++) p.line([[t.x + 0.34 * u, t.y + (0.2 + k * 0.09) * u], [t.x + 0.74 * u, t.y + (0.18 + k * 0.09) * u]], '#8a9ab0', 0.35);
    p.line([[t.x + 0.9 * u, t.y + t.h * 0.25], [t.x + 1.1 * u, t.y + t.h * 0.55]], '#3a6ad0', 1.3);
    const cx = t.x + t.w - 0.35 * u, cy = t.y + t.h * 0.7;
    for (const [dx, c] of [[-0.05, '#e04848'], [0.02, '#f0c040'], [0.07, '#3a8ad0']] as const) p.line([[cx + dx * u, cy - 0.2 * u], [cx + dx * u * 1.6, cy - 0.38 * u]], c, 1);
    p.rr(cx - 0.11 * u, cy - 0.22 * u, 0.22 * u, 0.22 * u, 0.03 * u).shadeFill('#5a8a6a', cx - 0.11 * u, 0, cx + 0.11 * u, 0, 0.3).stroke(0.5);
    book(p, t.x + t.w * 0.48, t.y + t.h * 0.85, 0.42 * u, '#b8433a');
    book(p, t.x + t.w * 0.48 + 0.03 * u, t.y + t.h * 0.85 - 0.2 * u, 0.36 * u, '#3f6fb0');
}

export function trashBin(p: Pen, r: Rect, [metal]: string[]): void {
    const u = p.u, cx = r.x + r.w / 2, ground = r.y + r.h;
    floorShadow(p, r, 0.3);
    const top = r.y + 0.32 * u;
    p.poly([[cx - 0.24 * u, top], [cx + 0.24 * u, top], [cx + 0.19 * u, ground - 0.06 * u], [cx - 0.19 * u, ground - 0.06 * u]]).shadeFill(metal, cx - 0.24 * u, 0, cx + 0.24 * u, 0, 0.35).stroke();
    for (const dx of [-0.1, 0, 0.1]) p.line([[cx + dx * u, top + 0.1 * u], [cx + dx * u * 0.8, ground - 0.14 * u]], darken(metal, 0.2), 0.5, 0.7);
    p.rect(cx - 0.17 * u, top + 0.06 * u, 0.06 * u, ground - top - 0.2 * u).shine(0.3);
    /* A domed lid and its knob; a pedal at the foot. */
    p.rr(cx - 0.27 * u, top - 0.14 * u, 0.54 * u, 0.18 * u, [0.2 * u, 0.2 * u, 0.04 * u, 0.04 * u]).shadeFill(lighten(metal, 0.1), cx - 0.27 * u, 0, cx + 0.27 * u, 0, 0.3).stroke(0.7);
    p.rr(cx - 0.07 * u, top - 0.22 * u, 0.14 * u, 0.09 * u, 0.04 * u).fill(darken(metal, 0.2)).stroke(0.4);
    p.rr(cx - 0.1 * u, ground - 0.1 * u, 0.2 * u, 0.07 * u, 0.03 * u).fill(darken(metal, 0.35)).stroke(0.4);
}
