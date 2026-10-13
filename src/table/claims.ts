/* Which trainer a player at the table plays, without the GM having to say so.

   A player who has joined a trainer's live sheet holds that sheet's code, and
   so does the GM, who shared it. The code is the one thing that already
   decides who may edit the trainer, so it is also what decides who may roll
   for its Pokémon. It never leaves either browser: the player sends an HMAC
   keyed by the live room's secret (worked out from the code, see
   live/engine.ts) over this lobby, this player's id and the trainer's id. The
   GM works out the same from its own copy of the code and compares.

   Binding the lobby and the player into it means a proof copied from one
   player's messages is no use to another player, or at another table. */

import { liveEntries, liveRoomPass } from '../live/engine';
import { fromB64u, toB64u } from './encoding';
import { LIMITS } from './protocol';
import type { WireClaim } from './protocol';

const ID_RE = /^[A-Za-z0-9_-]{1,48}$/;
const enc = new TextEncoder();

function key(pass: string): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', enc.encode(pass), { name: 'HMAC', hash: 'SHA-256' }, false,
        ['sign', 'verify']);
}

function statement(addr: string, member: string, tid: string): Uint8Array<ArrayBuffer> {
    return enc.encode('pokerole-table-claim-v1|' + addr + '|' + member + '|' + tid);
}

/** A player's claims: one for each trainer whose live sheet this browser has
    joined (or shares). */
export async function makeClaims(addr: string, member: string): Promise<WireClaim[]> {
    const out: WireClaim[] = [];
    for (const e of liveEntries()) {
        if (!e.tid || !ID_RE.test(e.tid) || out.some((c) => c.tid === e.tid)) continue;
        try {
            const sig = await crypto.subtle.sign('HMAC', await key(await liveRoomPass(e.code)),
                statement(addr, member, e.tid));
            out.push({ tid: e.tid, proof: toB64u(new Uint8Array(sig)) });
        } catch { /* no crypto, or the code is unusable: no claim */ }
        if (out.length >= LIMITS.MAX_CLAIMS) break;
    }
    return out;
}

/** The GM's side: the trainers out of `claims` that this browser also holds
    the live code for, and whose proof matches. */
export async function checkClaims(addr: string, member: string, claims: WireClaim[]): Promise<string[]> {
    const codes = new Map<string, string>();
    for (const e of liveEntries()) if (e.tid) codes.set(e.tid, e.code);
    const ok: string[] = [];
    for (const c of claims) {
        const code = codes.get(c.tid);
        if (!code || ok.includes(c.tid)) continue;
        try {
            const good = await crypto.subtle.verify('HMAC', await key(await liveRoomPass(code)),
                fromB64u(c.proof) as Uint8Array<ArrayBuffer>, statement(addr, member, c.tid));
            if (good) ok.push(c.tid);
        } catch { /* malformed proof: not a claim */ }
    }
    return ok;
}
