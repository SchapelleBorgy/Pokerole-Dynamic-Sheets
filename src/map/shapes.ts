import type { Canvas } from './raster';
import type { Pt } from './geometry';

/* The Shapes tool: exact geometric shapes painted into the terrain (or the
   fillers) in one drag — a line, a rectangle, an ellipse, a triangle, a
   diamond, a hexagon. The drag spans the shape's box, corner to corner; a
   line runs from the press to the pointer.

   Holding Alt evens the shape out: the box becomes as wide as the shape
   needs to be regular — a square, a circle, an equilateral triangle, a
   regular hexagon — whichever way the pointer went, and a line keeps to
   steps of 45°.

   Everything is in cells. A shape is a polygon (an ellipse a 128-gon) or an
   open polyline, painted filled or as an outline `width` cells wide. Each
   row of samples is solved exactly rather than testing every sample against
   every edge, so a big ellipse stays quick enough to redraw on every move. */

export type ShapeKind = 'line' | 'rect' | 'ellipse' | 'triangle' | 'diamond' | 'hexagon';
export type ShapeFill = 'fill' | 'outline';

export interface ShapeDef {
    kind: ShapeKind;
    name: string;
    /** What holding Alt turns it into. */
    even: string;
}

export const SHAPES: ShapeDef[] = [
    { kind: 'line', name: 'Line', even: 'a line at a multiple of 45° — straight across, straight down or a true diagonal' },
    { kind: 'rect', name: 'Rectangle', even: 'a square, with all four sides the same length' },
    { kind: 'ellipse', name: 'Ellipse', even: 'a perfect circle, never an oval' },
    { kind: 'triangle', name: 'Triangle', even: 'an equilateral triangle, with all three sides the same length' },
    { kind: 'diamond', name: 'Diamond', even: 'a square standing on its point' },
    { kind: 'hexagon', name: 'Hexagon', even: 'a regular hexagon, with all six sides the same length' },
];

export const SHAPE_BY_KIND = new Map(SHAPES.map((s) => [s.kind, s]));

export const MIN_SHAPE_WIDTH = 0.1;
export const MAX_SHAPE_WIDTH = 20;

const SQRT3_2 = Math.sqrt(3) / 2;

/** Height over width of the regular version of each boxed shape. */
const EVEN_RATIO: Record<Exclude<ShapeKind, 'line'>, number> = {
    rect: 1, ellipse: 1, diamond: 1, triangle: SQRT3_2, hexagon: SQRT3_2,
};

export interface ShapeGeometry {
    pts: Pt[];
    closed: boolean;
}

/** The shape a drag from `a` to `b` makes; `even` is Alt held. */
export function shapeGeometry(kind: ShapeKind, a: Pt, b: Pt, even: boolean): ShapeGeometry {
    let dx = b[0] - a[0], dy = b[1] - a[1];
    if (kind === 'line') {
        if (even) {
            const len = Math.hypot(dx, dy);
            const step = Math.PI / 4;
            const ang = Math.round(Math.atan2(dy, dx) / step) * step;
            dx = Math.round(Math.cos(ang) * 1e9) / 1e9 * len;
            dy = Math.round(Math.sin(ang) * 1e9) / 1e9 * len;
        }
        return { pts: [a, [a[0] + dx, a[1] + dy]], closed: false };
    }
    if (even) {
        /* As big as the larger of the two sides asks for, kept on the side
           of the press the pointer went to. */
        const ratio = EVEN_RATIO[kind];
        const w = Math.max(Math.abs(dx), Math.abs(dy) / ratio);
        dx = (dx < 0 ? -1 : 1) * w;
        dy = (dy < 0 ? -1 : 1) * w * ratio;
    }
    const x0 = Math.min(a[0], a[0] + dx), x1 = Math.max(a[0], a[0] + dx);
    const y0 = Math.min(a[1], a[1] + dy), y1 = Math.max(a[1], a[1] + dy);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, W = x1 - x0, H = y1 - y0;
    let pts: Pt[];
    switch (kind) {
        case 'rect': pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; break;
        case 'diamond': pts = [[cx, y0], [x1, cy], [cx, y1], [x0, cy]]; break;
        case 'triangle':
            /* Its point away from the press: drawn upwards, it points up. */
            pts = dy < 0 ? [[cx, y0], [x1, y1], [x0, y1]] : [[x0, y0], [x1, y0], [cx, y1]];
            break;
        case 'hexagon': pts = [[x0, cy], [x0 + W / 4, y0], [x1 - W / 4, y0], [x1, cy], [x1 - W / 4, y1], [x0 + W / 4, y1]]; break;
        case 'ellipse': {
            const n = 128;
            pts = [];
            for (let i = 0; i < n; i++) {
                const t = (i / n) * Math.PI * 2;
                pts.push([cx + Math.cos(t) * W / 2, cy + Math.sin(t) * H / 2]);
            }
            break;
        }
    }
    return { pts, closed: true };
}

/** Whether a drag made anything at all: a click paints nothing. */
export function shapeHasSize(g: ShapeGeometry): boolean {
    const xs = g.pts.map((p) => p[0]), ys = g.pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    return g.closed ? w > 1e-3 && h > 1e-3 : w + h > 1e-3;
}

/** Paint a shape into the canvas's layers. A line is always a stroke
    `width` cells wide; a closed shape is filled, or stroked along its edge
    with `width` centred on it. Returns whether any sample changed. */
export function paintShape(c: Canvas, g: ShapeGeometry, fill: ShapeFill, width: number): boolean {
    const { w, h, res, layers, guard } = c;
    let changed = false;
    const span = (sy: number, xa: number, xb: number) => {
        /* Samples whose centres lie in [xa, xb], in cells. */
        const s0 = Math.max(0, Math.ceil(xa * res - 0.5)), s1 = Math.min(w - 1, Math.floor(xb * res - 0.5));
        for (let sx = s0; sx <= s1; sx++) {
            const i = sy * w + sx;
            if (guard && !guard.allow[guard.looks[i]]) continue;
            for (const l of layers) if (l.data[i] !== l.value) { l.data[i] = l.value; changed = true; }
        }
    };
    const rowOf = (sy: number) => (sy + 0.5) / res;
    const pts = g.pts;
    const n = pts.length;

    if (g.closed && fill === 'fill') {
        const ys = pts.map((p) => p[1]);
        const r0 = Math.max(0, Math.ceil(Math.min(...ys) * res - 0.5)), r1 = Math.min(h - 1, Math.floor(Math.max(...ys) * res - 0.5));
        const xs: number[] = [];
        for (let sy = r0; sy <= r1; sy++) {
            const y = rowOf(sy);
            xs.length = 0;
            for (let i = 0; i < n; i++) {
                const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
                /* Half-open, so a vertex on the row is counted once. */
                if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
            }
            xs.sort((p, q) => p - q);
            for (let k = 0; k + 1 < xs.length; k += 2) span(sy, xs[k], xs[k + 1]);
        }
        return changed;
    }

    /* A stroke: each segment is a capsule of radius r, whose cut by a row
       is one interval — the union of its two end discs and its body. */
    const r = Math.max(width, 1 / res) / 2;
    const segs = g.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
        const len = Math.hypot(bx - ax, by - ay);
        const nx = len ? -(by - ay) / len * r : 0, ny = len ? (bx - ax) / len * r : 0;
        const body: Pt[] = [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
        const r0 = Math.max(0, Math.ceil((Math.min(ay, by) - r) * res - 0.5));
        const r1 = Math.min(h - 1, Math.floor((Math.max(ay, by) + r) * res - 0.5));
        for (let sy = r0; sy <= r1; sy++) {
            const y = rowOf(sy);
            let lo = Infinity, hi = -Infinity;
            for (const [cx, cy] of [[ax, ay], [bx, by]]) {
                const d = y - cy;
                if (Math.abs(d) > r) continue;
                const half = Math.sqrt(r * r - d * d);
                lo = Math.min(lo, cx - half); hi = Math.max(hi, cx + half);
            }
            if (len) {
                for (let k = 0; k < 4; k++) {
                    const [px, py] = body[k], [qx, qy] = body[(k + 1) % 4];
                    if ((py <= y && qy >= y) || (qy <= y && py >= y)) {
                        const x = py === qy ? Math.min(px, qx) : px + (y - py) / (qy - py) * (qx - px);
                        const x2 = py === qy ? Math.max(px, qx) : x;
                        lo = Math.min(lo, x); hi = Math.max(hi, x2);
                    }
                }
            }
            if (lo <= hi) span(sy, lo, hi);
        }
    }
    return changed;
}
