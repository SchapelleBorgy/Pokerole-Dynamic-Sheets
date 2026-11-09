import type { LookId, StyleId } from '../types';

/* The looks of a city or an interior: four colourings of the same vector
   art (the owner's ask, 2026-11-08: "everything vector, with three or four
   colour styles — a colourful one, one like the Ancient map, the others up
   to you").

   A painter never picks a final colour itself. It asks the PEN, which runs
   every colour through the look (`tint`), strokes in the look's ink, and
   turns "this side is in shadow" into a gradient, a soft wash or engraved
   hatching. So one painter draws an item in every look, and a new look is
   data here plus nothing in the painters.

   The ground under the buildings is the terrain engine's, drawn in the map's
   own style; a look may filter it (`ground`) so a night town is not lit by
   a noon meadow. The same filter string goes to CSS in the editor and to
   `ctx.filter` in the picture. */

export interface Look {
    id: LookId;
    name: string;
    icon: string;
    hint: string;
    /** Every colour a painter asks for passes through here. */
    tint(hex: string): string;
    /** Outline colour, or null for "the fill, darker" (Pastel). */
    ink: string | null;
    /** Outline width, in cells. */
    line: number;
    shading: 'gradient' | 'soft' | 'hatch';
    /** Lights on: windows glow, lamps throw light. */
    night: boolean;
    /** The ground's filter in this look (CSS filter syntax), or ''. */
    ground(style: StyleId): string;
}

/* ------------------------------------------------------------- colour */

type RGB = [number, number, number];

export function rgbOf(hex: string): RGB {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
}

export function hexOf([r, g, b]: RGB): string {
    const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
}

export function mix(a: string, b: string, t: number): string {
    const x = rgbOf(a), y = rgbOf(b);
    return hexOf([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export const darken = (c: string, t: number) => mix(c, '#000000', t);
export const lighten = (c: string, t: number) => mix(c, '#ffffff', t);

function luminance(c: string): number {
    const [r, g, b] = rgbOf(c);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function desaturate(c: string, t: number): string {
    const l = luminance(c) * 255;
    return mix(c, hexOf([l, l, l]), t);
}

/* -------------------------------------------------------------- looks */

const SEPIA_DARK = '#3d2a17';
const SEPIA_LIGHT = '#efe0bd';

export const LOOKS: Look[] = [
    {
        id: 'colorful', name: 'Colorful', icon: 'fa-palette',
        hint: 'Bright, friendly colours with soft shading',
        tint: (c) => c,
        ink: '#3a2418', line: 0.035, shading: 'gradient', night: false,
        ground: () => '',
    },
    {
        id: 'ancient', name: 'Ancient', icon: 'fa-scroll',
        hint: 'Sepia ink on old paper, shaded with hatching — like the Ancient map style',
        /* Each colour keeps only how light it is, laid on a sepia ramp, with a
           breath of its own hue so a red roof still reads warmer than a wall. */
        tint: (c) => mix(mix(SEPIA_DARK, SEPIA_LIGHT, Math.pow(luminance(c), 0.85)), c, 0.1),
        ink: '#3b2614', line: 0.04, shading: 'hatch', night: false,
        ground: (style) => (style === 'ancient' ? '' : 'sepia(0.85) saturate(0.7) brightness(1.04)'),
    },
    {
        id: 'pastel', name: 'Pastel', icon: 'fa-feather',
        hint: 'Watercolour softness: light colours, outlines in the colour itself',
        tint: (c) => desaturate(mix(c, '#fdf7ee', 0.36), 0.18),
        ink: null, line: 0.028, shading: 'soft', night: false,
        ground: () => 'saturate(0.62) brightness(1.1) contrast(0.88)',
    },
    {
        id: 'night', name: 'Night', icon: 'fa-moon',
        hint: 'Moonlit blues, windows and lamps lit',
        tint: (c) => {
            const [r, g, b] = rgbOf(c);
            return hexOf([r * 0.34 + 10, g * 0.38 + 16, b * 0.55 + 40]);
        },
        ink: '#0b1024', line: 0.035, shading: 'gradient', night: true,
        ground: () => 'brightness(0.42) saturate(0.7) sepia(0.35) hue-rotate(185deg) saturate(1.4)',
    },
];

export const LOOK_BY_ID = new Map(LOOKS.map((l) => [l.id, l]));

export function lookOf(id: LookId | undefined): Look {
    return LOOK_BY_ID.get(id ?? 'colorful') ?? LOOKS[0];
}

export function isLookId(v: unknown): v is LookId {
    return typeof v === 'string' && LOOK_BY_ID.has(v as LookId);
}

/** The look a new city or interior takes from the map it opens from. */
export function lookForStyle(style: StyleId): LookId {
    return style === 'ancient' ? 'ancient' : 'colorful';
}

/* ---------------------------------------------------------------- pen */

/** A point or size in px. */
export interface Rect { x: number; y: number; w: number; h: number }

/** A painter's whole vocabulary. `u` is px per cell: painters measure in
    cells and multiply, so an item draws the same at any size. */
export class Pen {
    private fillBase = '#888888';
    private seed = 1;

    constructor(readonly ctx: CanvasRenderingContext2D, readonly u: number, readonly look: Look) {}

    /** A colour in this look. */
    c(hex: string): string { return this.look.tint(hex); }

    /** Repeatable pseudo-random numbers: the same item draws the same twice. */
    reseed(n: number): void { this.seed = (Math.abs(Math.floor(n)) % 2147483646) + 1; }
    rnd(): number { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }

    /* ---- paths. Each remembers its box: Ancient's hatching needs it. */
    rect(x: number, y: number, w: number, h: number): this {
        this.box = { x, y, w, h };
        this.ctx.beginPath(); this.ctx.rect(x, y, w, h); return this;
    }
    rr(x: number, y: number, w: number, h: number, r: number | number[]): this {
        this.box = { x, y, w, h };
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
        return this;
    }
    poly(pts: [number, number][]): this {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys);
        this.box = { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
        this.ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? this.ctx.lineTo(x, y) : this.ctx.moveTo(x, y)));
        this.ctx.closePath();
        return this;
    }
    ell(cx: number, cy: number, rx: number, ry: number): this {
        this.box = { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 };
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
        return this;
    }

    /* ---- fills */
    /** A flat fill in a colour. */
    fill(hex: string): this {
        this.fillBase = hex;
        this.ctx.fillStyle = this.c(hex);
        this.ctx.fill();
        return this;
    }

    /** Light at `from`, the colour darker at `to` — a gradient, a gentler
        one in Pastel, a flat fill in Ancient (whose shade is hatching). */
    shadeFill(hex: string, x0: number, y0: number, x1: number, y1: number, depth = 0.22): this {
        this.fillBase = hex;
        const s = this.look.shading;
        if (s === 'hatch') {
            this.ctx.fillStyle = this.c(hex);
        } else {
            const d = s === 'soft' ? depth * 0.5 : depth;
            /* A gradient with no length paints NOTHING (the canvas spec), so
               shadeFill(hex, 0, 0, 0, 0) left the shape empty and its colour
               picker dead: top to bottom of the path's box instead. */
            if (x0 === x1 && y0 === y1) { x0 = x1 = this.box.x; y0 = this.box.y; y1 = this.box.y + Math.max(1, this.box.h); }
            const g = this.ctx.createLinearGradient(x0, y0, x1, y1);
            g.addColorStop(0, this.c(lighten(hex, d * 0.35)));
            g.addColorStop(1, this.c(darken(hex, d)));
            this.ctx.fillStyle = g;
        }
        this.ctx.fill();
        return this;
    }

    /** The outline of the current path. */
    stroke(width = 1): this {
        const ink = this.look.ink ?? darken(this.c(this.fillBase), 0.38);
        this.ctx.strokeStyle = ink;
        this.ctx.lineWidth = Math.max(1, this.u * this.look.line * width);
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
        return this;
    }

    /** Fill and outline: the usual way to put a shape down. */
    paint(hex: string, width = 1): this { return this.fill(hex).stroke(width); }

    /** A line between points, in ink or a colour. */
    line(pts: [number, number][], hex: string | null = null, width = 1, alpha = 1): this {
        const ctx = this.ctx;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.strokeStyle = hex ? this.c(hex) : (this.look.ink ?? darken(this.c(this.fillBase), 0.38));
        ctx.lineWidth = Math.max(1, this.u * this.look.line * width);
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
        return this;
    }

    /** The current path is in shadow by `amount` (0..1): a dark wash, or
        engraved hatching in Ancient. Call right after building a path. */
    shade(amount = 0.25): this {
        const ctx = this.ctx;
        if (this.look.shading === 'hatch') {
            ctx.save();
            ctx.clip();
            const b = this.bounds();
            ctx.strokeStyle = this.look.ink ?? '#000';
            ctx.globalAlpha = Math.min(0.9, 0.35 + amount);
            ctx.lineWidth = Math.max(0.8, this.u * 0.018);
            const step = Math.max(2, this.u * (0.16 - amount * 0.08));
            ctx.beginPath();
            for (let t = b.x - b.h; t < b.x + b.w; t += step) { ctx.moveTo(t, b.y + b.h); ctx.lineTo(t + b.h, b.y); }
            ctx.stroke();
            ctx.restore();
            return this;
        }
        ctx.fillStyle = this.look.night ? `rgba(0,4,20,${amount * 1.1})`
            : `rgba(30,15,5,${this.look.shading === 'soft' ? amount * 0.55 : amount})`;
        ctx.fill();
        return this;
    }

    /** A highlight on the current path. Ancient leaves the paper showing instead. */
    shine(amount = 0.25): this {
        if (this.look.shading === 'hatch') return this;
        this.ctx.fillStyle = `rgba(255,255,255,${this.look.night ? amount * 0.25 : amount})`;
        this.ctx.fill();
        return this;
    }

    /** A soft shadow on the ground under an object. */
    groundShadow(cx: number, cy: number, rx: number, ry: number, strength = 0.22): void {
        if (this.look.shading === 'hatch') {
            this.ell(cx, cy, rx, ry).shade(0.15);
            return;
        }
        const ctx = this.ctx;
        ctx.save();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, 1));
        const a = this.look.night ? strength * 1.4 : strength;
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.translate(cx, cy);
        ctx.scale(1, ry / Math.max(rx, 0.1));
        ctx.translate(-cx, -cy);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /** A pane of glass: sky by day, a warm light at night. */
    glass(x: number, y: number, w: number, h: number, lit = true, tint?: string): this {
        const ctx = this.ctx;
        this.rr(x, y, w, h, Math.min(w, h) * 0.12);
        if (this.look.night && lit) {
            ctx.save();
            ctx.shadowColor = 'rgba(255,200,110,0.85)';
            ctx.shadowBlur = this.u * 0.5;
            ctx.fillStyle = tint ? lighten(tint, 0.4) : '#ffd98a';
            ctx.fill();
            ctx.restore();
            this.fillBase = '#ffd98a';
        } else if (this.look.shading === 'hatch') {
            this.fill(tint ? lighten(tint, 0.3) : '#c8d8e0');
        } else {
            const g = ctx.createLinearGradient(x, y, x + w, y + h);
            g.addColorStop(0, this.c(tint ? lighten(tint, 0.45) : '#d6f0fc'));
            g.addColorStop(1, this.c(tint ? darken(tint, 0.12) : '#79b4da'));
            ctx.fillStyle = g;
            ctx.fill();
            this.fillBase = tint ?? '#79b4da';
        }
        this.stroke(0.8);
        if (!(this.look.night && lit)) {
            this.line([[x + w * 0.25, y + h * 0.7], [x + w * 0.6, y + h * 0.2]], '#ffffff', 1.2, this.look.shading === 'hatch' ? 0 : 0.7);
        }
        return this;
    }

    /** A pool of light round a lamp, at night only. */
    glow(cx: number, cy: number, r: number): void {
        if (!this.look.night) return;
        const ctx = this.ctx;
        ctx.save();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255,214,140,0.55)');
        g.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = g;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /** Text lettered on a sign. */
    letters(text: string, cx: number, cy: number, size: number, hex: string): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `800 ${size}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.c(hex);
        ctx.fillText(text, cx, cy);
        ctx.restore();
    }

    /** The box of the last path drawn (the canvas does not expose it). */
    private box: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private bounds(): Rect { return this.box.w ? this.box : { x: 0, y: 0, w: this.ctx.canvas.width, h: this.ctx.canvas.height }; }
}
