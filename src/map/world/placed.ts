import { itemOf } from './catalog';
import type { ItemDef } from './catalog';
import { Pen, lookOf } from './looks';
import { onFloor } from './room';
import type { Rect } from './looks';
import type { LookId, MapDoc, MapPlaced, MapToken } from '../types';

/* Placed things in a city: where they stand, what they cover, in what order
   they are drawn — the model the owner chose from the Stardew Valley notes
   (2026-11-08):

   - the FOOTPRINT is whole cells on the grid and is what "where" means;
   - the SPRITE is drawn anchored to the footprint's bottom edge, centred,
     and may be wider and much taller — a roof covers the cells behind;
   - things are drawn back to front by the footprint's BOTTOM edge (then
     left to right, then in the order placed), tokens among them by their
     own bottom edge, so a token behind a house is hidden by its roof and a
     token in front of it is not. Flat things (flower beds) go under all.

   Nothing blocks: two footprints may overlap. The editor only warns. */

export interface Box { x: number; y: number; w: number; h: number }

/** Width and depth of an item's footprint, and its sprite, as placed. */
export function dims(p: Pick<MapPlaced, 'item' | 'rot' | 'variant'>): { def: ItemDef; w: number; h: number; sw: number; sh: number } {
    const def = itemOf(p.item);
    const t = p.rot && def.turned ? def.turned : null;
    if (t) return { def, w: t.w, h: t.h, sw: t.sw ?? t.w, sh: t.sh };
    const v = def.variants?.[variantOf(def, p.variant)];
    const w = v?.w ?? def.w, h = v?.h ?? def.h;
    return { def, w, h, sw: v?.sw ?? (v?.w !== undefined ? undefined : def.sw) ?? w, sh: v?.sh ?? def.sh };
}

/** A saved variant number made safe for this item: 0 when it has none. */
export function variantOf(def: ItemDef, v: number | undefined): number {
    const n = def.variants?.length ?? 0;
    return v && n && v > 0 && v < n ? Math.floor(v) : 0;
}

export function footprint(p: MapPlaced): Box {
    const { w, h } = dims(p);
    return { x: p.x, y: p.y, w, h };
}

/** The sprite's rectangle in cells. */
export function spriteBox(p: MapPlaced): Box {
    const { w, h, sw, sh } = dims(p);
    return { x: p.x + (w - sw) / 2, y: p.y + h - sh, w: sw, h: sh };
}

/** The point a placed thing is "at" for fog and the table's lists: the
    middle of its footprint's front edge. */
export function anchorOf(p: MapPlaced): [number, number] {
    const { w, h } = dims(p);
    return [p.x + w / 2, p.y + h - 0.01];
}

export type DepthEntry = { kind: 'placed'; obj: MapPlaced } | { kind: 'token'; obj: MapToken };

/** Back to front: flat things first, then by the bottom edge, then left to
    right, then in the order they were placed. */
export function depthOrder(placed: MapPlaced[], tokens: MapToken[]): DepthEntry[] {
    const all: { e: DepthEntry; flat: number; bottom: number; x: number; i: number }[] = [];
    placed.forEach((p, i) => {
        const { def, w, h } = dims(p);
        all.push({ e: { kind: 'placed', obj: p }, flat: def.floor ? 0 : 1, bottom: p.y + h, x: p.x + w / 2, i });
    });
    tokens.forEach((t, i) => {
        all.push({ e: { kind: 'token', obj: t }, flat: 1, bottom: t.y + t.size / 2, x: t.x, i: placed.length + i });
    });
    all.sort((a, b) => a.flat - b.flat || a.bottom - b.bottom || a.x - b.x || a.i - b.i);
    return all.map((a) => a.e);
}

/** Whether a footprint runs off the map or onto another standing thing's. */
export function clashes(doc: MapDoc, p: MapPlaced): boolean {
    const f = footprint(p);
    if (f.x < -0.001 || f.y < -0.001 || f.x + f.w > doc.cols + 0.001 || f.y + f.h > doc.rows + 0.001) return true;
    /* In a room, every cell of it must be floor: not outside, not a wall's face. */
    if (doc.room && !onFloor(doc.room, f)) return true;
    if (itemOf(p.item).floor) return false;
    return doc.placed.some((o) => {
        if (o.id === p.id || itemOf(o.item).floor) return false;
        const g = footprint(o);
        return f.x < g.x + g.w - 0.001 && g.x < f.x + f.w - 0.001 && f.y < g.y + g.h - 0.001 && g.y < f.y + f.h - 0.001;
    });
}

/** Where a footprint's top-left goes for a pointer at `at`: the footprint
    centred under it, on whole cells when snapping. */
export function placeAt(item: string, rot: 1 | undefined, variant: number | undefined, at: [number, number], snap: boolean): [number, number] {
    const { w, h } = dims({ item, rot, variant });
    const x = at[0] - w / 2, y = at[1] - h / 2;
    return snap ? [Math.round(x), Math.round(y)] : [x, y];
}

export function colorsOf(p: Pick<MapPlaced, 'item' | 'colors' | 'variant'>): string[] {
    const def = itemOf(p.item);
    const own = def.variants?.[variantOf(def, p.variant)]?.colors;
    return def.colors.map((c, i) => p.colors?.[i] || own?.[i] || c.value);
}

/* ------------------------------------------------------------- drawing */

/** Room round the sprite for shadows, glow and outlines, in cells. */
export const PAD = 0.6;

/** Draws one placed thing on `ctx`, whose origin is the map's (0,0) and
    whose scale is `u` px per cell. */
export function drawPlaced(ctx: CanvasRenderingContext2D, p: MapPlaced, u: number, look: LookId | undefined): void {
    const { def } = dims(p);
    const b = spriteBox(p);
    const r: Rect = { x: b.x * u, y: b.y * u, w: b.w * u, h: b.h * u };
    ctx.save();
    if (p.flip) {
        ctx.translate(r.x * 2 + r.w, 0);
        ctx.scale(-1, 1);
    }
    const pen = new Pen(ctx, u, lookOf(look));
    pen.reseed(p.id.length * 131 + p.id.charCodeAt(0));
    if (!def.floor && def.group === 'building') pen.groundShadow(r.x + r.w / 2 + 0.25 * u, r.y + r.h - 0.05 * u, r.w * 0.56, 0.42 * u, 0.28);
    def.paint(pen, r, colorsOf(p), !!(p.rot && def.turned), variantOf(def, p.variant));
    ctx.restore();
}

/** One item alone on a canvas of its own: the editor's element and the
    palette's thumbnail. The canvas covers the sprite plus PAD all round. */
export function renderSprite(canvas: HTMLCanvasElement, p: MapPlaced, u: number, look: LookId | undefined): void {
    const b = spriteBox(p);
    const w = Math.max(1, Math.ceil((b.w + PAD * 2) * u)), h = Math.max(1, Math.ceil((b.h + PAD * 2) * u));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate((PAD - b.x) * u, (PAD - b.y) * u);
    drawPlaced(ctx, p, u, look);
}

const thumbs = new Map<string, string>();

/** A small picture of an item in a look, for the palette. Cached. */
export function itemThumb(item: string, look: LookId | undefined, px = 64, variant = 0): string {
    const key = item + '|' + variant + '|' + (look ?? 'colorful') + '|' + px;
    const hit = thumbs.get(key);
    if (hit) return hit;
    const { w, sw, sh } = dims({ item, variant });
    const span = Math.max(sw, w, sh * 0.85) + PAD * 2;
    const u = px / span;
    const c = document.createElement('canvas');
    renderSprite(c, { id: 'thumb', item, x: 0, y: 0, ...(variant ? { variant } : {}) }, u * 2, look);
    const out = document.createElement('canvas');
    out.width = px * 2; out.height = px * 2;
    const ctx = out.getContext('2d')!;
    const k = Math.min(out.width / c.width, out.height / c.height);
    ctx.drawImage(c, (out.width - c.width * k) / 2, (out.height - c.height * k) / 2, c.width * k, c.height * k);
    const url = out.toDataURL();
    thumbs.set(key, url);
    return url;
}

/* --------------------------------------------------------------- data */

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/** Whatever came off disk, made safe: unknown items kept (they draw as a block). */
export function normalizePlaced(raw: unknown): MapPlaced | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.item !== 'string' || !r.item || r.item.length > 80) return null;
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const out: MapPlaced = { id: typeof r.id === 'string' && ID_RE.test(r.id) ? r.id : '', item: r.item, x: num(r.x), y: num(r.y) };
    if (r.flip === true) out.flip = true;
    if (r.rot === 1) out.rot = 1;
    if (typeof r.variant === 'number' && Number.isInteger(r.variant) && r.variant > 0 && r.variant < 16) out.variant = r.variant;
    if (Array.isArray(r.colors)) out.colors = r.colors.slice(0, 8).map((c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : ''));
    if (typeof r.label === 'string') out.label = r.label.replace(/\r\n?/g, '\n').slice(0, 400);
    if (r.labelShow === 'hover') out.labelShow = 'hover';
    if (typeof r.link === 'string' && ID_RE.test(r.link)) out.link = r.link;
    if (typeof r.snap === 'boolean') out.snap = r.snap;
    return out;
}
