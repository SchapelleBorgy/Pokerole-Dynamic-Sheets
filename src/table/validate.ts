/* Everything arriving from another browser passes through here first.

   The rule this file follows is that a message is not "cleaned up" — it is
   either exactly what the protocol allows or it is dropped. Nothing is coerced,
   no missing field is defaulted, and no unknown field is tolerated. A validator
   that repairs its input is a validator that will one day repair an attack into
   something the rest of the app accepts.

   The one thing that IS rewritten is display text, because there is no valid
   reason for a nickname to contain a bidi override and every reason for someone
   to try. */

import { LIMITS } from './protocol';
import { KIT_ROLLS } from './protocol';
import type {
    Body, Inner, KitRoll, WireClaim, WireCombatant, WireFight, WireGmRoll, WireKit, WireKitMove, WireMember, WireRoll,
} from './protocol';
import { AILMENTS } from '../gm/ailments';
import { MAX_ACTIONS, ROUND_FLAGGED } from '../gm/combat';

/* Keys that must never survive a parse. `__proto__` in a JSON object literal is
   inert on its own, but the moment any code spreads or assigns that object into
   another one it becomes prototype pollution, and this page merges remote data
   into React state on every message. Dropped at the door instead. */
const POISON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** JSON.parse with the prototype-pollution keys removed as they are read. */
export function safeParse(text: string): unknown {
    return JSON.parse(text, function reviver(key, value) {
        if (POISON_KEYS.has(key)) return undefined;
        return value;
    });
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Rejects an object carrying any field the protocol does not define. */
function exactly(o: Record<string, unknown>, allowed: readonly string[]): boolean {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) return false;
    return true;
}

function int(v: unknown, min: number, max: number): number | null {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return null;
    return v;
}

/* C0/C1 controls, zero-width characters, line separators, the byte-order mark
   and the bidirectional overrides. The last group is the interesting one:
   U+202E flips the rendering direction of everything after it, which is the
   classic way to make one display name look like another on screen. */
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g;

/** Display text, normalised and stripped. Returns '' for anything unusable,
    which every caller treats as a missing field rather than an empty one. */
export function cleanText(v: unknown, max: number): string {
    if (typeof v !== 'string') return '';
    if (v.length > max * 4) return '';
    return v.normalize('NFC').replace(UNSAFE_TEXT, '').trim().slice(0, max);
}

/** A short opaque id — request ids, roll ids, session ids. */
function idText(v: unknown): string | null {
    return typeof v === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(v) ? v : null;
}

function fingerprintText(v: unknown): string | null {
    return typeof v === 'string' && /^[A-Z2-7]{16}$/.test(v) ? v : null;
}

const LABEL_RE = /^(\d{1,2})d(\d{1,4})$/;

/** A roll, with every derived number recomputed from the faces.

    This is stricter than a friendly table strictly needs: the host is the only
    one allowed to publish a roll, so in principle its arithmetic could be taken
    on trust. Recomputing means a compromised host cannot show five successes on
    faces that plainly total three — the numbers on screen always describe the
    dice printed next to them.

    It is also what keeps a scripted roll honest. The GM's predetermined result
    has to be real faces that genuinely produce the outcome, not a claimed
    total, which is exactly why scripting fabricates faces rather than numbers. */
export function parseRoll(raw: unknown): WireRoll | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['id', 'label', 'vals', 'total', 'succ', 'net', 't', 'who', 'note'])) return null;

    const id = idText(raw.id);
    if (!id) return null;

    if (typeof raw.label !== 'string') return null;
    const m = LABEL_RE.exec(raw.label);
    if (!m) return null;
    const count = int(Number(m[1]), LIMITS.MIN_COUNT, LIMITS.MAX_COUNT);
    const sides = int(Number(m[2]), LIMITS.MIN_SIDES, LIMITS.MAX_SIDES);
    if (count === null || sides === null) return null;

    if (!Array.isArray(raw.vals) || raw.vals.length !== count) return null;
    const vals: number[] = [];
    for (const v of raw.vals) {
        const face = int(v, 1, sides);
        if (face === null) return null;
        vals.push(face);
    }

    const t = int(raw.t, 0, Number.MAX_SAFE_INTEGER);
    if (t === null) return null;

    const who = cleanText(raw.who, LIMITS.MAX_NAME);
    if (!who) return null;

    const note = raw.note === undefined
        ? undefined
        : cleanText(raw.note, LIMITS.MAX_NOTE) || undefined;

    /* Pokerole counts 4, 5 and 6 as successes; other dice only have a total.
       The same rule as src/gm/dice.ts, applied to the faces we were handed. */
    const total = vals.reduce((a, b) => a + b, 0);
    const succ = sides === 6 ? vals.filter((v) => v >= 4).length : null;

    return { id, label: raw.label, vals, total, succ, net: succ, t, who, note };
}

function parseMember(raw: unknown): WireMember | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['id', 'name', 'host'])) return null;
    const id = fingerprintText(raw.id);
    const name = cleanText(raw.name, LIMITS.MAX_NAME);
    if (!id || !name || typeof raw.host !== 'boolean') return null;
    return { id, name, host: raw.host };
}

/* ---------------------------------------------------------------- combat */

const AILMENT_KEYS = new Set(AILMENTS.map((a) => a.key));
const FLAGGED_KEYS = new Set(ROUND_FLAGGED);

/** A sprite file name and nothing else: no slash, so it can only ever name a
    file inside the sprite folders the page already looks in. */
const IMG_RE = /^[A-Za-z0-9 _.()'-]{1,80}$/;

function intOrNull(v: unknown, min: number, max: number): number | null | undefined {
    if (v === null) return null;
    const n = int(v, min, max);
    return n === null ? undefined : n;
}

function parsePool(v: unknown): [number, number] | null | undefined {
    if (v === null) return null;
    if (!Array.isArray(v) || v.length !== 2) return undefined;
    const cur = int(v[0], -9999, 99999);
    const max = int(v[1], 0, 99999);
    return cur === null || max === null ? undefined : [cur, max];
}

function parseCombatant(raw: unknown): WireCombatant | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['id', 'name', 'kind', 'img', 'init', 'acted', 'clash', 'eva', 'hp', 'will', 'st', 'flags'])) return null;
    const id = idText(raw.id);
    const name = cleanText(raw.name, LIMITS.MAX_COMBAT_NAME) || '?';
    if (!id || (raw.kind !== 't' && raw.kind !== 'p' && raw.kind !== 'c')) return null;
    if (raw.img !== null && (typeof raw.img !== 'string' || !IMG_RE.test(raw.img))) return null;
    const init = intOrNull(raw.init, -999, 9999);
    const acted = int(raw.acted, 0, MAX_ACTIONS);
    if (init === undefined || acted === null) return null;
    if (typeof raw.clash !== 'boolean' || typeof raw.eva !== 'boolean') return null;
    const hp = parsePool(raw.hp);
    const will = parsePool(raw.will);
    if (hp === undefined || will === undefined) return null;

    let st: string[] | null = null;
    if (raw.st !== null) {
        if (!Array.isArray(raw.st) || raw.st.length > AILMENT_KEYS.size) return null;
        st = [];
        for (const k of raw.st) {
            if (typeof k !== 'string' || !AILMENT_KEYS.has(k)) return null;
            st.push(k);
        }
    }

    if (!Array.isArray(raw.flags) || raw.flags.length > FLAGGED_KEYS.size) return null;
    const flags: WireCombatant['flags'] = [];
    for (const f of raw.flags) {
        if (!isRecord(f) || !exactly(f, ['a', 'd', 'x'])) return null;
        const d = int(f.d, 0, 9999);
        if (typeof f.a !== 'string' || !FLAGGED_KEYS.has(f.a) || d === null || typeof f.x !== 'boolean') return null;
        flags.push({ a: f.a, d, x: f.x });
    }

    return {
        id, name, kind: raw.kind, img: raw.img as string | null, init, acted,
        clash: raw.clash, eva: raw.eva, hp, will, st, flags,
    };
}

function parseGmRoll(raw: unknown): WireGmRoll | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['t', 'sides', 'vals', 'bonus', 'pain', 'need', 'who', 'what'])) return null;
    const t = int(raw.t, 0, Number.MAX_SAFE_INTEGER);
    const sides = int(raw.sides, LIMITS.MIN_SIDES, LIMITS.MAX_SIDES);
    const bonus = intOrNull(raw.bonus, -999, 999);
    const pain = int(raw.pain, 0, LIMITS.MAX_COUNT);
    const need = intOrNull(raw.need, 0, LIMITS.MAX_COUNT);
    if (t === null || sides === null || bonus === undefined || pain === null || need === undefined) return null;
    if (typeof raw.who !== 'string' || typeof raw.what !== 'string') return null;
    if (!Array.isArray(raw.vals) || raw.vals.length < LIMITS.MIN_COUNT || raw.vals.length > LIMITS.MAX_COUNT) {
        return null;
    }
    const vals: number[] = [];
    for (const v of raw.vals) {
        const face = int(v, 1, sides);
        if (face === null) return null;
        vals.push(face);
    }
    return {
        t, sides, vals, bonus, pain, need,
        who: cleanText(raw.who, LIMITS.MAX_COMBAT_NAME),
        what: cleanText(raw.what, LIMITS.MAX_NOTE),
    };
}

function parseFight(raw: unknown): WireFight | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['id', 'name', 'round', 'rows', 'rolls'])) return null;
    const id = idText(raw.id);
    const round = int(raw.round, 0, 99999);
    if (!id || round === null) return null;
    if (!Array.isArray(raw.rows) || raw.rows.length > LIMITS.MAX_COMBATANTS) return null;
    const rows: WireCombatant[] = [];
    for (const r of raw.rows) {
        const parsed = parseCombatant(r);
        if (!parsed) return null;
        rows.push(parsed);
    }
    /* Absent from a GM page from before rolls were shared: no rolls, rather
       than no fight. */
    const rolls: WireGmRoll[] = [];
    if (raw.rolls !== undefined) {
        if (!Array.isArray(raw.rolls) || raw.rolls.length > LIMITS.MAX_FIGHT_ROLLS) return null;
        for (const r of raw.rolls) {
            const parsed = parseGmRoll(r);
            if (!parsed) return null;
            rolls.push(parsed);
        }
    }
    return { id, name: cleanText(raw.name, LIMITS.MAX_COMBAT_NAME) || 'Combat', round, rows, rolls };
}

/** A trainer's stored token: the trainer, or a slot on its team. */
const KIT_TOKEN_RE = /^(T:[A-Za-z0-9_-]{1,48}|M:[A-Za-z0-9_-]{1,48}:\d{1,2})$/;

function parseClaim(raw: unknown): WireClaim | null {
    if (!isRecord(raw) || !exactly(raw, ['tid', 'proof'])) return null;
    const tid = idText(raw.tid);
    if (!tid || typeof raw.proof !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw.proof)) return null;
    return { tid, proof: raw.proof };
}

function parseKitMove(raw: unknown): WireKitMove | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['name', 'type', 'cat', 'acc', 'dmg', 'accText', 'dmgText', 'extra', 'effect'])) return null;
    const name = cleanText(raw.name, LIMITS.MAX_KIT_TEXT);
    const acc = int(raw.acc, 0, LIMITS.MAX_COUNT);
    const dmg = int(raw.dmg, 0, LIMITS.MAX_COUNT);
    if (!name || acc === null || dmg === null) return null;
    return {
        name, acc, dmg,
        type: cleanText(raw.type, LIMITS.MAX_KIT_TEXT),
        cat: cleanText(raw.cat, LIMITS.MAX_KIT_TEXT),
        accText: cleanText(raw.accText, LIMITS.MAX_KIT_TEXT),
        dmgText: cleanText(raw.dmgText, LIMITS.MAX_KIT_TEXT),
        extra: cleanText(raw.extra, LIMITS.MAX_NOTE),
        effect: cleanText(raw.effect, LIMITS.MAX_EFFECT),
    };
}

function parseKit(raw: unknown): WireKit | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['tok', 'name', 'rows', 'need', 'pain', 'init', 'eva', 'clashS', 'clashSp', 'moves'])) return null;
    if (typeof raw.tok !== 'string' || !KIT_TOKEN_RE.test(raw.tok)) return null;
    const name = cleanText(raw.name, LIMITS.MAX_COMBAT_NAME);
    const need = intOrNull(raw.need, 1, LIMITS.MAX_COUNT);
    const pain = int(raw.pain, 0, 9);
    const init = int(raw.init, -99, 99);
    const eva = int(raw.eva, 0, LIMITS.MAX_COUNT);
    const clashS = int(raw.clashS, 0, LIMITS.MAX_COUNT);
    const clashSp = int(raw.clashSp, 0, LIMITS.MAX_COUNT);
    if (!name || need === undefined || pain === null || init === null
        || eva === null || clashS === null || clashSp === null) return null;
    if (!Array.isArray(raw.rows) || raw.rows.length > LIMITS.MAX_KIT_ROWS) return null;
    const rows: string[] = [];
    for (const r of raw.rows) {
        const id = idText(r);
        if (!id) return null;
        rows.push(id);
    }
    if (!Array.isArray(raw.moves) || raw.moves.length > LIMITS.MAX_KIT_MOVES) return null;
    const moves: WireKitMove[] = [];
    for (const m of raw.moves) {
        const parsed = parseKitMove(m);
        if (!parsed) return null;
        moves.push(parsed);
    }
    return { tok: raw.tok, name, rows, need, pain, init, eva, clashS, clashSp, moves };
}

export function parseBody(raw: unknown): Body | null {
    if (!isRecord(raw) || typeof raw.k !== 'string') return null;

    switch (raw.k) {
        case 'hello': {
            if (!exactly(raw, ['k', 'name'])) return null;
            const name = cleanText(raw.name, LIMITS.MAX_NAME);
            return name ? { k: 'hello', name } : null;
        }
        case 'roster': {
            if (!exactly(raw, ['k', 'members'])) return null;
            if (!Array.isArray(raw.members) || raw.members.length > LIMITS.MAX_MEMBERS) return null;
            const members: WireMember[] = [];
            for (const m of raw.members) {
                const parsed = parseMember(m);
                if (!parsed) return null;
                members.push(parsed);
            }
            return { k: 'roster', members };
        }
        case 'request': {
            if (!exactly(raw, ['k', 'rid', 'count', 'sides', 'note'])) return null;
            const rid = idText(raw.rid);
            const count = int(raw.count, LIMITS.MIN_COUNT, LIMITS.MAX_COUNT);
            const sides = int(raw.sides, LIMITS.MIN_SIDES, LIMITS.MAX_SIDES);
            if (!rid || count === null || sides === null) return null;
            const note = raw.note === undefined
                ? undefined
                : cleanText(raw.note, LIMITS.MAX_NOTE) || undefined;
            return { k: 'request', rid, count, sides, note };
        }
        case 'result': {
            if (!exactly(raw, ['k', 'rid', 'roll'])) return null;
            const roll = parseRoll(raw.roll);
            if (!roll) return null;
            if (raw.rid !== undefined && !idText(raw.rid)) return null;
            return { k: 'result', rid: raw.rid as string | undefined, roll };
        }
        case 'sync': {
            if (!exactly(raw, ['k', 'rolls'])) return null;
            if (!Array.isArray(raw.rolls) || raw.rolls.length > LIMITS.MAX_SYNC) return null;
            const rolls: WireRoll[] = [];
            for (const r of raw.rolls) {
                const parsed = parseRoll(r);
                if (!parsed) return null;
                rolls.push(parsed);
            }
            return { k: 'sync', rolls };
        }
        case 'clear': {
            if (!exactly(raw, ['k'])) return null;
            return { k: 'clear' };
        }
        case 'kick': {
            if (!exactly(raw, ['k', 'id'])) return null;
            const id = fingerprintText(raw.id);
            return id ? { k: 'kick', id } : null;
        }
        case 'claim': {
            if (!exactly(raw, ['k', 'claims'])) return null;
            if (!Array.isArray(raw.claims) || raw.claims.length > LIMITS.MAX_CLAIMS) return null;
            const claims: WireClaim[] = [];
            for (const c of raw.claims) {
                const parsed = parseClaim(c);
                if (!parsed) return null;
                claims.push(parsed);
            }
            return { k: 'claim', claims };
        }
        case 'moves': {
            if (!exactly(raw, ['k', 'to', 'kits'])) return null;
            const to = fingerprintText(raw.to);
            if (!to || !Array.isArray(raw.kits) || raw.kits.length > LIMITS.MAX_KITS) return null;
            const kits: WireKit[] = [];
            for (const k of raw.kits) {
                const parsed = parseKit(k);
                if (!parsed) return null;
                kits.push(parsed);
            }
            return { k: 'moves', to, kits };
        }
        case 'act': {
            if (!exactly(raw, ['k', 'tok', 'roll', 'mi', 'move'])) return null;
            if (typeof raw.tok !== 'string' || !KIT_TOKEN_RE.test(raw.tok)) return null;
            if (!KIT_ROLLS.includes(raw.roll as KitRoll)) return null;
            const mi = int(raw.mi, -1, LIMITS.MAX_KIT_MOVES - 1);
            if (mi === null || typeof raw.move !== 'string') return null;
            return { k: 'act', tok: raw.tok, roll: raw.roll as KitRoll, mi, move: cleanText(raw.move, LIMITS.MAX_KIT_TEXT) };
        }
        case 'combat': {
            if (!exactly(raw, ['k', 'to', 'fights'])) return null;
            const to = fingerprintText(raw.to);
            if (!to) return null;
            if (!Array.isArray(raw.fights) || raw.fights.length > LIMITS.MAX_FIGHTS) return null;
            const fights: WireFight[] = [];
            for (const f of raw.fights) {
                const parsed = parseFight(f);
                if (!parsed) return null;
                fights.push(parsed);
            }
            return { k: 'combat', to, fights };
        }
        default:
            return null;
    }
}

/** The inner message, before its signature has been checked.

    Order matters and is not an accident: this parses untrusted JSON, and only
    once it is known to be structurally sound does the caller verify the
    signature over the ORIGINAL string. Parsing first is safe precisely because
    nothing in here trusts what it reads. */
export function parseInner(raw: unknown, expectedAddr: string): Inner | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['v', 'a', 'f', 'k', 'sid', 's', 'ts', 'b'])) return null;
    if (raw.v !== 1) return null;
    if (raw.a !== expectedAddr) return null;

    const f = fingerprintText(raw.f);
    const sid = idText(raw.sid);
    const s = int(raw.s, 0, Number.MAX_SAFE_INTEGER);
    const ts = int(raw.ts, 0, Number.MAX_SAFE_INTEGER);
    if (!f || !sid || s === null || ts === null) return null;
    /* An uncompressed P-256 point is 65 bytes, 87 base64url characters. The
       range leaves room for nothing but that. */
    if (typeof raw.k !== 'string' || !/^[A-Za-z0-9_-]{80,120}$/.test(raw.k)) return null;

    const b = parseBody(raw.b);
    if (!b) return null;

    return { v: 1, a: raw.a, f, k: raw.k, sid, s, ts, b };
}

/** The `{p,g}` wrapper. Kept separate so the caller still holds `p` as the
    exact string that was signed. */
export function parseSigned(raw: unknown): { p: string; g: string } | null {
    if (!isRecord(raw)) return null;
    if (!exactly(raw, ['p', 'g'])) return null;
    if (typeof raw.p !== 'string' || typeof raw.g !== 'string') return null;
    if (raw.p.length > LIMITS.MAX_WIRE_CHARS) return null;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(raw.g)) return null;
    return { p: raw.p, g: raw.g };
}
