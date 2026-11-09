import { Pen, darken, lighten, lookOf } from './looks';
import type { LookId, MapRoom } from '../types';

/* An interior's floor plan (owner's request, 2026-11-08): the room is any
   outline of corners on the grid, inside the rectangular map. Outside it is
   nothing (dark); inside is floor; and like Stardew Valley only the BACK
   walls are seen standing — every edge with the room below it rises as a
   face of wallpaper `wallH` cells tall, drawn over the top of the floor.
   The other edges show only as the thick top of the wall (the trim).

   Corners sit on whole cells, so the furniture's footprints line up with
   the walls. A room may have a notch, an L, a T or a U: any simple outline.

   Everything is drawn through the Pen, so the four looks apply. */

export type FloorKind = 'planks' | 'parquet' | 'tiles' | 'checker' | 'stone' | 'carpet' | 'tatami' | 'dirt';
export type WallKind = 'plain' | 'stripes' | 'dots' | 'flowers' | 'panels' | 'wainscot' | 'brick' | 'stone' | 'logs';

export const FLOORS: { id: FloorKind; name: string; color: string }[] = [
    { id: 'planks', name: 'Wooden planks', color: '#c08a58' },
    { id: 'parquet', name: 'Parquet', color: '#b07a48' },
    { id: 'tiles', name: 'Tiles', color: '#e4e0d8' },
    { id: 'checker', name: 'Checkerboard', color: '#e8e4dc' },
    { id: 'stone', name: 'Flagstones', color: '#a8a090' },
    { id: 'carpet', name: 'Carpet', color: '#7a8ab8' },
    { id: 'tatami', name: 'Tatami', color: '#d4c890' },
    { id: 'dirt', name: 'Earth and straw', color: '#a88a60' },
];

export const WALLS: { id: WallKind; name: string; color: string }[] = [
    { id: 'plain', name: 'Plain', color: '#efe4cc' },
    { id: 'stripes', name: 'Stripes', color: '#e8d8b8' },
    { id: 'dots', name: 'Dots', color: '#dfe8f0' },
    { id: 'flowers', name: 'Flowers', color: '#f2e2e0' },
    { id: 'panels', name: 'Wood panels', color: '#a87a50' },
    { id: 'wainscot', name: 'Wainscot', color: '#d8e4d0' },
    { id: 'brick', name: 'Brick', color: '#b0644a' },
    { id: 'stone', name: 'Stone', color: '#b0a898' },
    { id: 'logs', name: 'Logs', color: '#9a6a40' },
];

const FLOOR_IDS = new Set(FLOORS.map((f) => f.id));
const WALL_IDS = new Set(WALLS.map((f) => f.id));
export const isFloorKind = (v: unknown): v is FloorKind => typeof v === 'string' && FLOOR_IDS.has(v as FloorKind);
export const isWallKind = (v: unknown): v is WallKind => typeof v === 'string' && WALL_IDS.has(v as WallKind);

/** Most corners a room may have. */
export const MAX_CORNERS = 48;

/* --------------------------------------------------------------- shapes */

export type Pt = [number, number];

/** The room presets, fitted to a map of `cols` x `rows` with a cell of margin. */
export function presetShape(kind: 'rect' | 'L' | 'T' | 'U' | 'plus', cols: number, rows: number): Pt[] {
    const x0 = 1, y0 = 1, x1 = Math.max(x0 + 3, cols - 1), y1 = Math.max(y0 + 3, rows - 1);
    const w = x1 - x0, h = y1 - y0;
    const mx = (t: number) => x0 + Math.round(w * t), my = (t: number) => y0 + Math.round(h * t);
    switch (kind) {
        case 'L': return [[x0, y0], [mx(0.55), y0], [mx(0.55), my(0.45)], [x1, my(0.45)], [x1, y1], [x0, y1]];
        case 'T': return [[x0, y0], [x1, y0], [x1, my(0.45)], [mx(0.68), my(0.45)], [mx(0.68), y1], [mx(0.32), y1], [mx(0.32), my(0.45)], [x0, my(0.45)]];
        case 'U': return [[x0, y0], [mx(0.35), y0], [mx(0.35), my(0.55)], [mx(0.65), my(0.55)], [mx(0.65), y0], [x1, y0], [x1, y1], [x0, y1]];
        case 'plus': return [[mx(0.33), y0], [mx(0.67), y0], [mx(0.67), my(0.33)], [x1, my(0.33)], [x1, my(0.67)], [mx(0.67), my(0.67)], [mx(0.67), y1], [mx(0.33), y1], [mx(0.33), my(0.67)], [x0, my(0.67)], [x0, my(0.33)], [mx(0.33), my(0.33)]];
        default: return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    }
}

/** A new interior's room: a rectangle a cell in from the edges. */
export function defaultRoom(cols: number, rows: number): MapRoom {
    return { pts: presetShape('rect', cols, rows), wallH: 2, floor: 'planks', floorColor: '#c08a58', wall: 'stripes', wallColor: '#e8d8b8', trim: '#6a4a34' };
}

/** Whether a point is inside the outline (even-odd). */
export function insidePoly(pts: Pt[], x: number, y: number): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** How many times the outline crosses or folds onto itself (0 = a proper
    room). Two walls that are not neighbours may not touch at all; two
    neighbours may not double back along each other; no wall has length 0.
    The Room tool refuses any move that raises this (owner's report,
    2026-11-08: dragged corners made walls overlap). */
export function crossings(pts: Pt[]): number {
    const n = pts.length;
    if (n < 3) return 1;
    let bad = 0;
    const seg = (i: number): [Pt, Pt] => [pts[i], pts[(i + 1) % n]];
    const orient = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    const onSeg = (a: Pt, b: Pt, c: Pt) => Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
    const meet = ([a, b]: [Pt, Pt], [c, d]: [Pt, Pt]) => {
        const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
        if (o1 !== o2 && o3 !== o4 && o1 * o2 <= 0 && o3 * o4 <= 0) return true;
        return (o1 === 0 && onSeg(a, b, c)) || (o2 === 0 && onSeg(a, b, d)) || (o3 === 0 && onSeg(c, d, a)) || (o4 === 0 && onSeg(c, d, b));
    };
    for (let i = 0; i < n; i++) {
        const [a, b] = seg(i);
        if (a[0] === b[0] && a[1] === b[1]) { bad++; continue; }
        /* A neighbour folding straight back along this wall. */
        const c = pts[(i + 2) % n];
        if (orient(a, b, c) === 0 && (c[0] - b[0]) * (a[0] - b[0]) + (c[1] - b[1]) * (a[1] - b[1]) > 0) bad++;
        for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            if (meet(seg(i), seg(j))) bad++;
        }
    }
    return bad;
}

/** The edges that stand as back walls: the room lies just below them. */
export function backWalls(pts: Pt[]): [Pt, Pt][] {
    const out: [Pt, Pt][] = [];
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (Math.abs(a[0] - b[0]) < 1e-6) continue;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (insidePoly(pts, mx, my + 0.02)) out.push(a[0] < b[0] ? [a, b] : [b, a]);
    }
    /* Back to front: a nearer wall covers the face of one behind it. */
    return out.sort((p, q) => Math.min(p[0][1], p[1][1]) - Math.min(q[0][1], q[1][1]));
}

/** What is at a point of the map: outside the room, a wall's face, or floor. */
export function roomAt(room: MapRoom, x: number, y: number): 'out' | 'wall' | 'floor' {
    if (!insidePoly(room.pts, x, y)) return 'out';
    for (const [a, b] of backWalls(room.pts)) {
        if (x < a[0] || x > b[0]) continue;
        const ey = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
        if (y >= ey && y < ey + room.wallH) return 'wall';
    }
    return 'floor';
}

/** Whether every cell of a footprint is floor. */
export function onFloor(room: MapRoom, f: { x: number; y: number; w: number; h: number }): boolean {
    for (let y = f.y; y < f.y + f.h - 0.01; y++) {
        for (let x = f.x; x < f.x + f.w - 0.01; x++) {
            if (roomAt(room, x + 0.5, y + 0.5) !== 'floor') return false;
        }
    }
    return true;
}

/** Saved data made safe; null when there is no usable room. */
export function normalizeRoom(raw: unknown, cols: number, rows: number): MapRoom | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Record<string, unknown>;
    if (!Array.isArray(r.pts)) return undefined;
    const pts: Pt[] = [];
    for (const p of r.pts.slice(0, MAX_CORNERS)) {
        if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number' || !isFinite(p[0]) || !isFinite(p[1])) continue;
        pts.push([Math.max(0, Math.min(cols, Math.round(p[0]))), Math.max(0, Math.min(rows, Math.round(p[1])))]);
    }
    if (pts.length < 3) return undefined;
    const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
    const def = defaultRoom(cols, rows);
    return {
        pts,
        wallH: typeof r.wallH === 'number' && isFinite(r.wallH) ? Math.max(0, Math.min(4, Math.round(r.wallH))) : 2,
        floor: isFloorKind(r.floor) ? r.floor : def.floor,
        floorColor: hex(r.floorColor, def.floorColor),
        wall: isWallKind(r.wall) ? r.wall : def.wall,
        wallColor: hex(r.wallColor, def.wallColor),
        trim: hex(r.trim, def.trim),
    };
}

/** The room on a map resized to `cols` x `rows`: corners kept on it. */
export function resizeRoom(room: MapRoom | undefined, cols: number, rows: number): MapRoom | undefined {
    if (!room) return undefined;
    return { ...room, pts: room.pts.map(([x, y]) => [Math.min(x, cols), Math.min(y, rows)] as Pt) };
}

/* --------------------------------------------------------------- drawing */

/** Draws the room on `ctx`, whose origin is the map's (0,0) and scale `u` px a cell. */
export function drawRoom(ctx: CanvasRenderingContext2D, room: MapRoom, u: number, look: LookId | undefined, cols: number, rows: number): void {
    const p = new Pen(ctx, u, lookOf(look));
    const pts = room.pts.map(([x, y]) => [x * u, y * u] as Pt);
    const outline = () => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
    };
    const W = cols * u, H = rows * u;

    /* The floor, clipped to the room. */
    ctx.save();
    outline();
    ctx.clip('evenodd');
    floorPattern(p, room, W, H);

    /* The back walls: a face of wallpaper hanging down from each. */
    const walls = backWalls(room.pts);
    for (const [a, b] of walls) {
        const ax = a[0] * u, ay = a[1] * u, bx = b[0] * u, by = b[1] * u, h = room.wallH * u;
        if (h <= 0) continue;
        const face: Pt[] = [[ax, ay], [bx, by], [bx, by + h], [ax, ay + h]];
        ctx.save();
        p.poly(face);
        ctx.clip();
        wallPattern(p, room, Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), h + Math.abs(by - ay));
        /* The skirting board, and the shadow the wall throws on the floor. */
        p.poly([[ax, ay + h - 0.18 * u], [bx, by + h - 0.18 * u], [bx, by + h], [ax, ay + h]]).fill(darken(room.trim, 0.05));
        p.line([[ax, ay + h - 0.18 * u], [bx, by + h - 0.18 * u]], null, 0.5, 0.6);
        p.poly([[ax, ay], [bx, by], [bx, by + 0.18 * u], [ax, ay + 0.18 * u]]).shade(0.25);
        ctx.restore();
        p.poly([[ax, ay + h], [bx, by + h], [bx, by + h + 0.35 * u], [ax, ay + h + 0.35 * u]]).shade(0.16);
    }
    /* A soft shade down the left and right walls too, where they meet the floor. */
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (Math.abs(a[0] - b[0]) > 0.5) continue;
        const inRight = insidePoly(room.pts, a[0] / u + 0.05, (a[1] + b[1]) / 2 / u);
        const x = inRight ? a[0] : a[0] - 0.22 * u;
        p.rect(x, Math.min(a[1], b[1]), 0.22 * u, Math.abs(b[1] - a[1])).shade(0.14);
    }
    ctx.restore();

    /* Outside the room: nothing, dark. */
    ctx.save();
    ctx.beginPath();
    ctx.rect(-u, -u, W + 2 * u, H + 2 * u);
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = p.c(p.look.night ? '#06080f' : '#1e1a1c');
    ctx.fill('evenodd');
    ctx.restore();

    /* The top of the walls all round: a thick band just outside the outline. */
    ctx.save();
    ctx.beginPath();
    ctx.rect(-u, -u, W + 2 * u, H + 2 * u);
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip('evenodd');
    outline();
    ctx.lineJoin = 'miter';
    ctx.lineWidth = 0.7 * u;
    ctx.strokeStyle = p.c(room.trim);
    ctx.stroke();
    ctx.lineWidth = 0.18 * u;
    ctx.strokeStyle = p.c(lighten(room.trim, 0.25));
    ctx.stroke();
    ctx.restore();
    outline();
    p.stroke(1.2);
}

function floorPattern(p: Pen, room: MapRoom, W: number, H: number): void {
    const u = p.u, c = room.floorColor;
    p.rect(0, 0, W, H).fill(c);
    p.reseed(7);
    switch (room.floor) {
        case 'planks':
            for (let y = 0, row = 0; y < H; y += 0.5 * u, row++) {
                p.line([[0, y], [W, y]], darken(c, 0.3), 0.6, 0.7);
                for (let x = ((row * 1.7) % 3) * u; x < W; x += 3 * u) p.line([[x, y], [x, y + 0.5 * u]], darken(c, 0.3), 0.6, 0.7);
                if (row % 3 === 1) p.rect(0, y, W, 0.5 * u).shade(0.05);
            }
            break;
        case 'parquet':
            for (let y = 0; y < H; y += u) {
                for (let x = 0; x < W; x += u) {
                    const flip = (Math.round(x / u) + Math.round(y / u)) % 2 === 0;
                    for (let k = 0; k < 3; k++) {
                        if (flip) p.line([[x, y + k * u / 3], [x + u, y + k * u / 3]], darken(c, 0.3), 0.5, 0.7);
                        else p.line([[x + k * u / 3, y], [x + k * u / 3, y + u]], darken(c, 0.3), 0.5, 0.7);
                    }
                    if (flip) p.rect(x, y, u, u).shade(0.06);
                }
            }
            break;
        case 'tiles':
            for (let y = 0; y < H; y += u) p.line([[0, y], [W, y]], darken(c, 0.2), 0.6, 0.8);
            for (let x = 0; x < W; x += u) p.line([[x, 0], [x, H]], darken(c, 0.2), 0.6, 0.8);
            for (let y = 0; y < H; y += u) for (let x = 0; x < W; x += u) p.rect(x + 0.08 * u, y + 0.08 * u, 0.3 * u, 0.12 * u).shine(0.18);
            break;
        case 'checker':
            for (let y = 0; y < H; y += u) for (let x = 0; x < W; x += u) {
                if ((Math.round(x / u) + Math.round(y / u)) % 2) p.rect(x, y, u, u).fill(darken(c, 0.55));
            }
            break;
        case 'stone':
            for (let y = 0, row = 0; y < H; y += 0.9 * u, row++) {
                let x = -p.rnd() * u;
                while (x < W) {
                    const w = (0.8 + p.rnd() * 0.7) * u;
                    p.rr(x + 0.05 * u, y + 0.05 * u, w - 0.1 * u, 0.8 * u, 0.12 * u).fill(p.rnd() < 0.5 ? lighten(c, 0.06) : darken(c, 0.07));
                    p.rr(x + 0.05 * u, y + 0.05 * u, w - 0.1 * u, 0.8 * u, 0.12 * u).stroke(0.4);
                    x += w;
                }
            }
            break;
        case 'carpet':
            for (let i = 0; i < W * H / (u * u) * 3; i++) p.ell(p.rnd() * W, p.rnd() * H, 0.05 * u, 0.05 * u).fill(lighten(c, 0.12));
            break;
        case 'tatami':
            for (let y = 0, row = 0; y < H; y += 2 * u, row++) {
                for (let x = (row % 2) * u - u; x < W; x += 2 * u) {
                    p.rect(x + 0.04 * u, y + 0.04 * u, 1.92 * u, 1.92 * u).stroke(0.5);
                    p.rect(x + 0.04 * u, y + 0.04 * u, 1.92 * u, 0.12 * u).fill(darken(c, 0.45));
                    for (let k = 0.3; k < 1.9; k += 0.18) p.line([[x + 0.1 * u, y + k * u], [x + 1.9 * u, y + k * u]], darken(c, 0.15), 0.35, 0.6);
                }
            }
            break;
        case 'dirt':
            for (let i = 0; i < W * H / (u * u) * 2; i++) {
                const x = p.rnd() * W, y = p.rnd() * H;
                if (p.rnd() < 0.5) p.line([[x, y], [x + 0.25 * u, y + (p.rnd() - 0.5) * 0.15 * u]], '#e0c060', 0.6, 0.8);
                else p.ell(x, y, 0.05 * u, 0.04 * u).fill(darken(c, 0.2));
            }
            break;
    }
}

function wallPattern(p: Pen, room: MapRoom, x: number, y: number, w: number, h: number): void {
    const u = p.u, c = room.wallColor;
    p.rect(x, y, w, h).shadeFill(c, 0, y, 0, y + h, 0.12);
    p.reseed(3);
    const x0 = Math.floor(x / u) * u;
    switch (room.wall) {
        case 'stripes':
            for (let sx = x0; sx < x + w; sx += 0.5 * u) p.rect(sx, y, 0.22 * u, h).fill(darken(c, 0.1));
            break;
        case 'dots':
            for (let sy = y + 0.25 * u, r = 0; sy < y + h; sy += 0.4 * u, r++) for (let sx = x0 + (r % 2) * 0.25 * u; sx < x + w; sx += 0.5 * u) p.ell(sx, sy, 0.06 * u, 0.06 * u).fill(darken(c, 0.2));
            break;
        case 'flowers':
            for (let sy = y + 0.35 * u, r = 0; sy < y + h; sy += 0.7 * u, r++) for (let sx = x0 + (r % 2) * 0.4 * u; sx < x + w; sx += 0.8 * u) {
                for (let k = 0; k < 4; k++) p.ell(sx + Math.cos(k * Math.PI / 2) * 0.08 * u, sy + Math.sin(k * Math.PI / 2) * 0.08 * u, 0.06 * u, 0.06 * u).fill(darken(c, 0.25));
                p.ell(sx, sy, 0.04 * u, 0.04 * u).fill(lighten(c, 0.4));
            }
            break;
        case 'panels':
            for (let sx = x0; sx < x + w; sx += 0.4 * u) p.line([[sx, y], [sx, y + h]], darken(c, 0.3), 0.6, 0.8);
            p.rect(x, y + h * 0.15, w, 0.06 * u).fill(darken(c, 0.2));
            break;
        case 'wainscot': {
            const mid = y + h * 0.55;
            p.rect(x, mid, w, y + h - mid).fill(room.trim);
            for (let sx = x0 + 0.1 * u; sx < x + w; sx += u) p.rect(sx, mid + 0.15 * u, 0.8 * u, y + h - mid - 0.4 * u).stroke(0.5);
            p.rect(x, mid - 0.06 * u, w, 0.12 * u).fill(lighten(room.trim, 0.2));
            break;
        }
        case 'brick':
            for (let sy = y + h, r = 0; sy > y; sy -= 0.25 * u, r++) {
                p.line([[x, sy], [x + w, sy]], lighten(c, 0.35), 0.5, 0.6);
                for (let sx = x0 + (r % 2 ? 0.25 * u : 0); sx < x + w; sx += 0.5 * u) p.line([[sx, sy - 0.25 * u], [sx, sy]], lighten(c, 0.35), 0.45, 0.55);
            }
            break;
        case 'stone':
            for (let sy = y + h, r = 0; sy > y - 0.4 * u; sy -= 0.4 * u, r++) {
                let sx = x0 - p.rnd() * 0.5 * u;
                while (sx < x + w) {
                    const bw = (0.5 + p.rnd() * 0.5) * u;
                    p.rr(sx + 0.03 * u, sy - 0.37 * u, bw - 0.06 * u, 0.34 * u, 0.06 * u).fill(p.rnd() < 0.5 ? lighten(c, 0.06) : darken(c, 0.06));
                    p.rr(sx + 0.03 * u, sy - 0.37 * u, bw - 0.06 * u, 0.34 * u, 0.06 * u).stroke(0.4);
                    sx += bw;
                }
            }
            break;
        case 'logs':
            for (let sy = y + h - 0.35 * u; sy > y - 0.35 * u; sy -= 0.35 * u) {
                p.rr(x - 0.1 * u, sy, w + 0.2 * u, 0.35 * u, 0.17 * u).fill(p.rnd() < 0.5 ? c : darken(c, 0.07));
                p.rr(x - 0.1 * u, sy, w + 0.2 * u, 0.35 * u, 0.17 * u).stroke(0.45);
            }
            break;
    }
    /* A picture rail along the top. */
    p.rect(x, y + 0.12 * u, w, 0.07 * u).fill(darken(c, 0.25));
}
