/* What a player may roll for their own trainer and Pokémon, worked out on the
   GM's machine.

   The same numbers the GM screen's move panel shows, off the same helpers:
   pinned moves with their accuracy and damage pools, Initiative, Evasion and
   the two Clashes, the pain penalty, and how many successes this action
   needs. Only subjects standing in a fight the player can see, and only
   those belonging to a trainer the player holds the live sheet for
   (claims.ts).

   A roll a player asks for is worked out here again from the GM's own copy
   of the sheet at that moment: the player names the move, never the dice. */

import { CRIT_DAMAGE } from '../gm/constants';
import type { RollEntry, RollMeta } from '../gm/dice';
import {
    entityPool, entityRef, participantForToken, participantToken, resolveToken, storedToken,
} from '../gm/entities';
import { computeMoveTotals, painFromHp, painPenalty, pinnedMoveObjects } from '../gm/moves';
import type { GmMove } from '../gm/moves';
import type { GmState } from '../gm/types';
import type { AppData, ItemEntry, PokedexEntry } from '../data/types';
import { rowIdOf } from './combatSnapshot';
import { LIMITS } from './protocol';
import type { Body, WireKit } from './protocol';

interface KitMove { move: GmMove; accN: number; powN: number; acc: string | null; pow: string | null; extra: string }

interface Subject {
    /** Stored, `T:<id>` or `M:<id>:<slot>`: what the player names it by. */
    tok: string;
    /** Resolved for this render, `t:<i>` or `m:<i>:<slot>`. */
    live: string;
    name: string;
    rows: string[];
    need: number | null;
    pain: number;
    value: (n: string) => number;
    moves: KitMove[];
}

type DexById = (id: string) => PokedexEntry | null;

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));

/** Move names travel cleaned and cut to length; compared the same way. */
const clip = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);

function trainerOf(tok: string): string | null {
    const p = tok.split(':');
    return p[0] === 'T' || p[0] === 'M' ? p[1] : null;
}

function build(
    state: GmState, dexById: DexById, data: AppData, live: string, tok: string,
    itemByName: (name: string) => ItemEntry | null,
): Subject | null {
    const ref = entityRef(state, dexById, live);
    if (!ref || (ref.kind !== 'trainer' && ref.kind !== 'mon')) return null;
    /* The pip is filled for the action being taken, so the count of filled
       pips is the number of this action, as on the GM's move panel. */
    const part = participantForToken(state, dexById, live);
    const need = part ? Math.max(1, Number((part as unknown as Record<string, unknown>).acted) || 0) : null;
    const base = { tok, live, name: ref.name || '?', rows: [] as string[], need, value: ref.value };

    if (ref.kind === 'trainer') {
        const hp = entityPool(ref, 'hp');
        return { ...base, pain: hp ? painFromHp(hp.cur, hp.max) : 0, moves: [] };
    }
    const dex = ref.dex || null;
    const sheet = ref.sheet || {};
    const moves: KitMove[] = dex
        ? pinnedMoveObjects(dex, sheet, data.moves).map((move) => {
            const t = computeMoveTotals(dex, sheet, move, itemByName);
            return {
                move,
                accN: Math.max(0, t.accN ?? 0),
                powN: Math.max(0, t.powN ?? 0),
                acc: t.acc,
                pow: t.pow,
                extra: t.bonus.parts.map((b) => b.label + ' +' + b.value).join(' · '),
            };
        })
        : [];
    return { ...base, pain: painPenalty(dex, sheet), moves };
}

/** Everything `tids`' trainers have standing in the fights `gids`. */
function subjects(
    state: GmState, dexById: DexById, data: AppData,
    tids: readonly string[], gids: ReadonlySet<string>,
): Subject[] {
    if (!tids.length) return [];
    const itemByName = (name: string): ItemEntry | null => {
        const want = String(name || '').trim().toLowerCase();
        return want ? data.items.find((i) => String(i.Name || '').trim().toLowerCase() === want) || null : null;
    };
    const out = new Map<string, Subject>();
    for (const c of state.combats) {
        if (!gids.has(c.gid)) continue;
        c.participants.forEach((p, j) => {
            const live = resolveToken(state, participantToken(state, dexById, p));
            const tok = live ? storedToken(state, live) : null;
            const tid = tok ? trainerOf(tok) : null;
            if (!live || !tok || !tid || !tids.includes(tid)) return;
            let s = out.get(tok);
            if (!s) {
                if (out.size >= LIMITS.MAX_KITS) return;
                const made = build(state, dexById, data, live, tok, itemByName);
                if (!made) return;
                out.set(tok, made);
                s = made;
            }
            if (s.rows.length < LIMITS.MAX_KIT_ROWS) s.rows.push(rowIdOf(p, j));
        });
    }
    return [...out.values()];
}

/** What one player is sent: their subjects, in wire shape. Kept inside the
    limits validate.ts checks, so a long name or effect is cut rather than the
    whole message dropped. */
export function kitsFor(
    state: GmState, dexById: DexById, data: AppData,
    tids: readonly string[], gids: ReadonlySet<string>,
): WireKit[] {
    return subjects(state, dexById, data, tids, gids).map((s) => {
        const v = s.value;
        return {
            tok: s.tok,
            name: clip(s.name, LIMITS.MAX_COMBAT_NAME) || '?',
            rows: s.rows,
            need: s.need === null ? null : clamp(s.need, 1, LIMITS.MAX_COUNT),
            pain: clamp(s.pain, 0, 9),
            init: clamp(v('Dexterity') + v('Alert'), -99, 99),
            eva: clamp(v('Dexterity') + v('Evasion'), 0, LIMITS.MAX_COUNT),
            clashS: clamp(v('Strength') + v('Clash'), 0, LIMITS.MAX_COUNT),
            clashSp: clamp(v('Special') + v('Clash'), 0, LIMITS.MAX_COUNT),
            moves: s.moves.slice(0, LIMITS.MAX_KIT_MOVES).map((m) => ({
                name: clip(m.move.Name, LIMITS.MAX_KIT_TEXT) || '?',
                type: clip(m.move.Type, LIMITS.MAX_KIT_TEXT),
                cat: clip(m.move.Category, LIMITS.MAX_KIT_TEXT),
                acc: clamp(m.accN, 0, LIMITS.MAX_COUNT),
                dmg: clamp(m.powN, 0, LIMITS.MAX_COUNT),
                accText: clip(m.acc ?? '—', LIMITS.MAX_KIT_TEXT),
                dmgText: clip(m.pow ?? '—', LIMITS.MAX_KIT_TEXT),
                extra: clip(m.extra, LIMITS.MAX_NOTE),
                effect: clip(m.move.Effect, LIMITS.MAX_EFFECT),
            })),
        };
    });
}

/** The roll a player asked for, as the GM's move panel would make it, or
    null when it is not theirs to make (not their subject, not in a fight they
    can see, a move that is not pinned, an empty pool). */
export function kitRoll(
    state: GmState, dexById: DexById, data: AppData,
    tids: readonly string[], gids: ReadonlySet<string>,
    act: Extract<Body, { k: 'act' }>,
): { count: number; meta: RollMeta } | null {
    const s = subjects(state, dexById, data, tids, gids).find((x) => x.tok === act.tok);
    if (!s) return null;
    const v = s.value;
    const who = s.name;
    const pain = s.pain;
    const pool = (n: number, meta: RollMeta) =>
        (n > 0 ? { count: Math.min(n, LIMITS.MAX_COUNT), meta: { ...meta, tok: s.tok } } : null);

    switch (act.roll) {
        case 'init':
            /* 1d6 plus Dexterity + Alert, added up: not a pool, so no pain */
            return { count: 1, meta: { who, what: 'Initiative', bonus: v('Dexterity') + v('Alert'), tok: s.tok } };
        case 'eva':
            return pool(v('Dexterity') + v('Evasion'), { who, what: 'Evasion', pain });
        case 'clash-s':
            return pool(v('Strength') + v('Clash'), { who, what: 'Clash (Strength)', pain });
        case 'clash-sp':
            return pool(v('Special') + v('Clash'), { who, what: 'Clash (Special)', pain });
        case 'acc':
        case 'dmg': {
            const m = s.moves[act.mi];
            if (!m || clip(m.move.Name, LIMITS.MAX_KIT_TEXT) !== act.move) return null;
            const name = m.move.Name;
            if (act.roll === 'acc') {
                return pool(m.accN, {
                    who, what: name + ' accuracy', need: s.need, pain,
                    dmg: m.powN > 0 ? { token: s.live, mi: act.mi, dice: m.powN, what: name + ' damage' } : null,
                });
            }
            /* Straight after a critical hit with this move, the damage comes
               boosted, as the GM's own "Roll damage" after a critical does. */
            const last = (state.dice.history as RollEntry[]).find((e) => !!e && e.tok === s.tok);
            const crit = !!last && last.verdict === 'crit' && !!last.dmg
                && last.dmg.mi === act.mi && last.what === name + ' accuracy';
            return pool(m.powN + (crit ? CRIT_DAMAGE : 0), {
                who, what: name + ' damage' + (crit ? ' (critical)' : ''), pain,
            });
        }
        default:
            return null;
    }
}
