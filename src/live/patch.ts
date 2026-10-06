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
