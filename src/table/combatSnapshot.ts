/* The GM's combat trackers, turned into what the players are shown.

   Built on the GM's machine from the same helpers the combat panel draws with,
   so a player's row says exactly what the GM's row says: initiative with
   paralysis already applied, HP and Will read off the sheets, the ailments
   that are on, and what each one costs this Round. Nothing else of the board
   leaves the GM's browser: no roster, no notes, no NPCs, no sheets. */

import { activeAilments, defaultStatus } from '../gm/ailments';
import { MAX_ACTIONS, initOffset, roundFlags } from '../gm/combat';
import { combatGidOf, isCombatPanelKey } from '../gm/constants';
import { entityPool, entityRef, participantToken, resolveToken } from '../gm/entities';
import type { GmCombatant, GmState } from '../gm/types';
import type { PokedexEntry } from '../data/types';
import { LIMITS } from './protocol';
import type { WireCombatant, WireFight } from './protocol';

/* The same shapes validate.ts accepts. Anything that would not pass there is
   replaced here rather than sent, because one bad field makes the players drop
   the whole message. */
const ID_RE = /^[A-Za-z0-9_-]{1,48}$/;
const IMG_RE = /^[A-Za-z0-9 _.()'-]{1,80}$/;

function whole(v: unknown, min: number, max: number): number | null {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.max(min, Math.min(max, Math.round(v)));
}

function pool(p: { cur: number; max: number } | null): [number, number] | null {
    if (!p) return null;
    return [whole(p.cur, -9999, 99999) ?? 0, whole(p.max, 0, 99999) ?? 0];
}

function row(
    state: GmState, dexById: (id: string) => PokedexEntry | null,
    p: GmCombatant, round: number, index: number,
): WireCombatant {
    const rec = p as unknown as Record<string, unknown>;
    const raw = participantToken(state, dexById, p);
    const token = resolveToken(state, raw) || raw;
    const ref = entityRef(state, dexById, token);
    const status = ref ? ref.status : defaultStatus();

    const init = whole(rec.init, -999, 9999);
    const dexId = typeof rec.dexId === 'string' ? rec.dexId : null;
    const img = dexId ? dexById(dexId)?.Image ?? null : null;
    const dealt = rec.dealt as Record<string, number> | undefined;
    const pid = String(rec.pid ?? '');

    return {
        id: ID_RE.test(pid) ? pid : 'row' + index,
        name: String(rec.label || '').trim().slice(0, LIMITS.MAX_COMBAT_NAME) || '?',
        kind: rec.kind === 'trainer' ? 't' : rec.kind === 'custom' ? 'c' : 'p',
        img: img && IMG_RE.test(img) ? img : null,
        init: init === null ? null : Math.max(-999, init + initOffset(status)),
        acted: whole(rec.acted, 0, MAX_ACTIONS) ?? 0,
        clash: !!rec.usedClash,
        eva: !!rec.usedEva,
        hp: ref ? pool(entityPool(ref, 'hp')) : null,
        will: ref ? pool(entityPool(ref, 'will')) : null,
        st: ref ? activeAilments(status).map((a) => a.key) : null,
        flags: ref
            ? roundFlags(ref, p, round).map((f) => ({
                a: f.ail.key,
                d: whole(f.damage, 0, 9999) ?? 0,
                x: !!(dealt && dealt[f.ail.key] === round),
            }))
            : [],
    };
}

/** Every fight on the board, in the order the GM has the panels, minus the
    ones the GM is keeping from the players. */
export function combatSnapshot(
    state: GmState, dexById: (id: string) => PokedexEntry | null, hidden: ReadonlySet<string>,
): WireFight[] {
    const order = state.layout.order.filter(isCombatPanelKey).map(combatGidOf);
    const at = (gid: string) => {
        const i = order.indexOf(gid);
        return i < 0 ? order.length : i;
    };
    return state.combats
        .filter((c) => !hidden.has(c.gid))
        .slice()
        .sort((a, b) => at(a.gid) - at(b.gid))
        .map((c, i) => {
            const round = whole(c.round, 0, 99999) ?? 1;
            return {
                id: ID_RE.test(c.gid) ? c.gid : 'fight' + i,
                name: String(c.name || '').trim().slice(0, LIMITS.MAX_COMBAT_NAME) || 'Combat',
                round,
                rows: c.participants.map((p, j) => row(state, dexById, p, round, j)),
            };
        });
}

/* Which fights the GM is keeping to themselves, by gid. Kept apart from the
   GM screen's own saved board so the GM screen never has to know about it:
   it is a rolling-table setting, and a fight with no entry here is shown. */
const HIDDEN_KEY = 'pokerole_table_hidden_fights';

let hiddenCache: ReadonlySet<string> | null = null;
const hiddenListeners = new Set<() => void>();

export function hiddenFights(): ReadonlySet<string> {
    if (hiddenCache) return hiddenCache;
    let list: unknown = [];
    try { list = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { /* unreadable: none */ }
    hiddenCache = new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
    return hiddenCache;
}

export function setFightHidden(gid: string, hide: boolean): void {
    const next = new Set(hiddenFights());
    if (hide) next.add(gid); else next.delete(gid);
    hiddenCache = next;
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); } catch { /* private mode */ }
    hiddenListeners.forEach((l) => l());
}

export function subscribeHiddenFights(cb: () => void): () => void {
    hiddenListeners.add(cb);
    return () => { hiddenListeners.delete(cb); };
}
