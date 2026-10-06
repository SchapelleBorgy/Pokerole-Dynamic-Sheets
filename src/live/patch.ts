/* A change between two JSON values, as the few field writes that turn one into
   the other: { p: path, v: value } sets a field, { p, d: 1 } deletes one.
   Objects are compared key by key and equal-length arrays index by index, so
   a typed letter in one field sends that field alone; an array that grows or
   shrinks is sent whole. */

export type Path = (string | number)[];
export type Op = { p: Path; v: unknown; d?: undefined } | { p: Path; d: 1; v?: undefined };

function isObj(x: unknown): x is Record<string, unknown> {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/* Keys that reach the object machinery rather than the sheet. A path through
   `__proto__` would write onto every object on the page, so anything from
   another device naming one is dropped before it gets near applyOps. */
const POISON = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 64;

function safeKey(k: unknown): k is string | number {
    return (typeof k === 'string' && !POISON.has(k))
        || (typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < 1e6);
}

/** A copy of a JSON value from another device with the poison keys left out,
    or undefined if it is not plain JSON or nests absurdly deep. */
export function cleanJson(v: unknown, depth = 0): unknown {
    if (depth > MAX_DEPTH) return undefined;
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (Array.isArray(v)) {
        const out: unknown[] = [];
        for (const x of v) {
            const c = cleanJson(x, depth + 1);
            if (c === undefined) return undefined;
            out.push(c);
        }
        return out;
    }
    if (isObj(v)) {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v)) {
            if (POISON.has(k)) continue;
            const c = cleanJson(v[k], depth + 1);
            if (c === undefined) return undefined;
            out[k] = c;
        }
        return out;
    }
    return undefined;
}

/** Edits from another device, checked: every path made only of ordinary
    keys, every value plain JSON, a whole replacement an object. Null if any
    of it is not, and then none of it is applied. */
export function parseOps(raw: unknown): Op[] | null {
    if (!Array.isArray(raw) || raw.length > 10000) return null;
    const out: Op[] = [];
    for (const op of raw) {
        if (!isObj(op) || !Array.isArray(op.p) || op.p.length > MAX_DEPTH || !op.p.every(safeKey)) return null;
        const p = op.p as Path;
        if (op.d === 1) { if (!p.length) return null; out.push({ p, d: 1 }); continue; }
        const v = cleanJson(op.v);
        if (v === undefined || (!p.length && !isObj(v))) return null;
        out.push({ p, v });
    }
    return out;
}

export function diff(a: unknown, b: unknown, path: Path = [], out: Op[] = []): Op[] {
    if (a === b) return out;
    if (isObj(a) && isObj(b)) {
        for (const k of Object.keys(a)) if (!(k in b)) out.push({ p: [...path, k], d: 1 });
        for (const k of Object.keys(b)) diff(a[k], b[k], [...path, k], out);
    } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
        for (let i = 0; i < b.length; i++) diff(a[i], b[i], [...path, i], out);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
        out.push({ p: path, v: b === undefined ? null : b });
    }
    return out;
}

/** Apply ops to `root` in place. A path of [] replaces the whole object. */
export function applyOps(root: Record<string, unknown>, ops: Op[]): void {
    for (const op of ops) {
        /* parseOps has already refused these; this keeps applyOps safe on its own */
        if (!op.p.every(safeKey)) continue;
        if (!op.p.length) {
            Object.keys(root).forEach((k) => { delete root[k]; });
            Object.assign(root, (op.v as object) || {});
            continue;
        }
        let o = root as Record<string | number, unknown>;
        for (let i = 0; i < op.p.length - 1; i++) {
            const k = op.p[i];
            if (o[k] === null || typeof o[k] !== 'object') o[k] = typeof op.p[i + 1] === 'number' ? [] : {};
            o = o[k] as Record<string | number, unknown>;
        }
        const last = op.p[op.p.length - 1];
        if (op.d) {
            if (Array.isArray(o)) o.splice(Number(last), 1);
            else delete o[last];
        } else {
            o[last] = op.v;
        }
    }
}
