import { joinRoom as nostrJoinRoom } from '@trystero-p2p/nostr';
import type { DataPayload, JoinRoom, NostrRoomConfig, Room } from '@trystero-p2p/nostr';
import { WORKING_KEY } from '../state/constants';
import { applyOps, cleanJson, diff, parseOps } from './patch';
import type { Op } from './patch';

import '../styles/shared/live.css';

/* Live sheets: one trainer kept in step across devices.

   A device "goes live" with a trainer and gets a room code. Anyone who joins
   with that code receives the trainer, and from then on an edit on either side
   reaches the other within a moment. Devices talk directly over WebRTC
   (Trystero, which finds the other side through public Nostr relays), so there
   is no account and no server of ours. The JSON files stay the real save.

   The engine works on the working set in localStorage — the one channel every
   page already shares. Each write to it is diffed, per live trainer, against
   the last state this tab knew, and only the changed fields go out; incoming
   changes are handed to the page's adapter to apply and redraw. Every tab
   (license, Pokémon cards, GM screen) joins on its own, so a card left open on
   a phone keeps updating even while the license tab sleeps in the background. */

const LIVE_KEY = 'pokerole_live';        // LiveEntry[]: which rooms this browser is in
const META_KEY = 'pokerole_live_meta';   // { tid: time of the last edit seen }
const KEYS_KEY = 'pokerole_live_keys';   // { code: the room name and key worked out from it }
/* v2: rooms are named and locked by a key stretched from the code (below),
   so a device still on v1 simply never meets one on v2. */
const APP_ID = 'pokerole-dynamic-sheets-live-v2';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DIFF_DELAY_MS = 120;

export type TrainerData = Record<string, unknown>;

export interface LiveEntry {
    code: string;
    /** Unknown until a guest hears from the host. */
    tid: string | null;
    name: string;
    role: 'host' | 'guest';
}

/** What a page tells the engine about where its trainers live. */
export interface LiveAdapter {
    /** Whether this tab holds (and so should sync) the trainer. */
    hasTrainer(tid: string): boolean;
    /** The trainer's data as this tab sees it now. */
    read(tid: string): TrainerData | null;
    /** Apply a change from another device: persist (inside `engine.quietly`) and
        redraw. `whole` is set when the change replaces the entire trainer. */
    apply(tid: string, change: (data: TrainerData) => TrainerData, whole: boolean): void;
    /** A trainer this tab doesn't hold yet arrived from the host. License page only. */
    adopt?(tid: string, data: TrainerData, name: string): void;
    /** Another tab on this device wrote the working set. */
    onSiblingWrite?(): void;
    /** Whether this tab joins rooms a guest is still waiting on (no trainer yet). */
    joinsPending: boolean;
    toast?(html: string): void;
}

interface Hello { tid: string | null; role: string; name: string; lastEdit: number; data: TrainerData | null }
interface OpsMsg { tid: string; ts: number; ops: Op[] }

interface RoomState {
    /** Null for the moment between deciding to join and the key being ready. */
    room: Room | null;
    sendHello: (d: Hello, opts?: { target?: string }) => Promise<void>;
    sendOps: (d: OpsMsg) => Promise<void>;
    peers: Set<string>;
    error: string | null;
}

export interface LiveStatus {
    on: boolean;
    peers: number;
    error: boolean;
}

/* ---- localStorage helpers ---- */
const origSetItem = Storage.prototype.setItem;

function readJSON<T>(key: string, fallback: T): T {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v as T; }
    catch { return fallback; }
}
function writeJSON(key: string, value: unknown): void {
    try { origSetItem.call(localStorage, key, JSON.stringify(value)); } catch { /* quota */ }
}

export function liveEntries(): LiveEntry[] {
    const v = readJSON<unknown>(LIVE_KEY, []);
    return Array.isArray(v) ? v as LiveEntry[] : [];
}
function saveLiveEntries(list: LiveEntry[]): void { writeJSON(LIVE_KEY, list); }
function getMeta(tid: string): number { return readJSON<Record<string, number>>(META_KEY, {})[tid] || 0; }
function setMeta(tid: string, t: number): void {
    const m = readJSON<Record<string, number>>(META_KEY, {});
    m[tid] = Math.max(m[tid] || 0, t);
    writeJSON(META_KEY, m);
}

function workingTrainers(raw: string | null): { id: string; data: TrainerData }[] | null {
    try {
        const w = JSON.parse(raw || 'null');
        return w && Array.isArray(w.trainers) ? w.trainers : null;
    } catch { return null; }
}

export function newCode(): string {
    const r = new Uint32Array(8);
    crypto.getRandomValues(r);
    let s = '';
    for (let i = 0; i < 8; i++) s += CODE_ALPHABET[r[i] % CODE_ALPHABET.length];
    return s.slice(0, 4) + '-' + s.slice(4);
}

export function normalizeCode(raw: string | null | undefined): string | null {
    const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : null;
}

export function shareLink(code: string): string {
    const base = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
    return base + 'trainer-license.html#live=' + code;
}

/* The room's name and its key, from the code.

   The code is the only secret, and it is short enough to type: 8 characters,
   about 40 bits. Used as-is, the room name the public relays see would let
   someone collect those names and try every code against them offline, which
   one good graphics card does in under a minute. So the code goes through
   PBKDF2 first, and every guess has to pay for 600,000 rounds of it: the same
   search then takes that card about a year. Two devices with the same code
   still arrive at the same room.

   Worked out once per code per browser (under a second on a laptop, a second
   or two on a phone) and kept beside the live list, which already holds the
   code itself. */
const KDF_ITERATIONS = 600_000;
interface RoomKeys { room: string; pass: string }
const keyJobs = new Map<string, Promise<RoomKeys>>();

function roomKeys(code: string): Promise<RoomKeys> {
    let job = keyJobs.get(code);
    if (!job) {
        job = deriveRoomKeys(code);
        keyJobs.set(code, job);
        job.catch(() => keyJobs.delete(code));
    }
    return job;
}

async function deriveRoomKeys(code: string): Promise<RoomKeys> {
    const saved = readJSON<Record<string, RoomKeys>>(KEYS_KEY, {})[code];
    if (saved && typeof saved.room === 'string' && typeof saved.pass === 'string') return saved;
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode('pokerole-live-room-v2'), iterations: KDF_ITERATIONS, hash: 'SHA-256' },
        material, 512));
    const hex = Array.from(bits, (b) => b.toString(16).padStart(2, '0')).join('');
    const keys = { room: hex.slice(0, 64), pass: hex.slice(64) };
    /* Only codes still in use are kept */
    const inUse = new Set(liveEntries().map((e) => e.code));
    const all = readJSON<Record<string, RoomKeys>>(KEYS_KEY, {});
    const next: Record<string, RoomKeys> = { [code]: keys };
    for (const [c, k] of Object.entries(all)) if (inUse.has(c)) next[c] = k;
    writeJSON(KEYS_KEY, next);
    return keys;
}

/* The transport is swappable so the test harness can use a local relay. */
function transport(): JoinRoom<NostrRoomConfig> {
    const w = window as unknown as { PokeroleLiveTransport?: { joinRoom: JoinRoom<NostrRoomConfig> } };
    return w.PokeroleLiveTransport?.joinRoom || nostrJoinRoom;
}

export class LiveEngine {
    private rooms = new Map<string, RoomState>();
    /** tid -> JSON of the last state this tab knew, the baseline for diffs. */
    private base = new Map<string, string>();
    private applying = 0;
    private diffTimer: number | null = null;
    private listeners = new Set<() => void>();
    private version = 0;
    private pill: HTMLDivElement | null = null;
    private adapter: LiveAdapter;
    /** Clicked on the status pill; the license opens its Live window. */
    onPillClick: (() => void) | null = null;

    constructor(adapter: LiveAdapter) {
        this.adapter = adapter;
    }

    /* ---- React glue ---- */
    subscribe = (cb: () => void): (() => void) => {
        this.listeners.add(cb);
        return () => { this.listeners.delete(cb); };
    };
    getSnapshot = (): number => this.version;
    private changed(): void {
        this.version++;
        this.listeners.forEach((l) => l());
        this.renderPill();
    }

    /** Run a write to the working set without sending it back out. */
    quietly(fn: () => void): void {
        this.applying++;
        try { fn(); } finally { this.applying--; }
    }

    start(): void {
        const engine = this;
        /* Every page writes the working set through localStorage.setItem, from
           several modules; hooking the one call they share catches them all. */
        Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
            origSetItem.call(this, k, v);
            if (this === localStorage && k === WORKING_KEY) engine.onLocalWrite();
        };
        window.addEventListener('storage', (ev) => this.onStorage(ev));
        this.reconcile();
    }

    status(): LiveStatus {
        let peers = 0, error = false;
        this.rooms.forEach((r) => { peers += r.peers.size; if (r.error && !r.peers.size) error = true; });
        return { on: this.rooms.size > 0, peers, error };
    }

    peersIn(code: string): number { return this.rooms.get(code)?.peers.size || 0; }
    errorIn(code: string): boolean {
        const r = this.rooms.get(code);
        return !!(r && r.error && !r.peers.size);
    }

    /* ---- Public actions ---- */
    goLive(tid: string, name: string): string {
        const list = liveEntries();
        const have = list.find((e) => e.tid === tid);
        if (have) return have.code;
        const code = newCode();
        list.push({ code, tid, name, role: 'host' });
        saveLiveEntries(list);
        /* Mark this copy as the freshest, so it beats any stale one a player has */
        setMeta(tid, Date.now());
        this.reconcile();
        return code;
    }

    stop(code: string): void {
        saveLiveEntries(liveEntries().filter((e) => e.code !== code));
        this.reconcile();
    }

    join(raw: string): boolean {
        const code = normalizeCode(raw);
        if (!code) {
            this.adapter.toast?.('<i class="fa-solid fa-triangle-exclamation"></i> A live code has 8 letters and numbers, like ABCD-2345');
            return false;
        }
        const list = liveEntries();
        const have = list.find((e) => e.code === code);
        if (!have) {
            list.push({ code, tid: null, name: '', role: 'guest' });
        } else if (have.tid && !this.adapter.hasTrainer(have.tid)) {
            /* Opened the link again on a fresh page: fetch the trainer anew */
            have.tid = null;
        }
        saveLiveEntries(list);
        this.reconcile();
        this.adapter.toast?.('<i class="fa-solid fa-tower-broadcast"></i> Connecting to ' + code + '…');
        return true;
    }

    /** Join or leave rooms to match the live list and the trainers this tab holds. */
    reconcile(): void {
        const want = new Set(liveEntries()
            .filter((e) => (e.tid ? this.adapter.hasTrainer(e.tid) : this.adapter.joinsPending))
            .map((e) => e.code));
        [...this.rooms.keys()].forEach((c) => { if (!want.has(c)) this.leaveRoom(c); });
        want.forEach((c) => {
            if (this.rooms.has(c)) return;
            const e = liveEntries().find((x) => x.code === c);
            if (e?.tid) this.base.set(e.tid, JSON.stringify(this.adapter.read(e.tid)));
            this.joinRoom(c);
        });
        this.changed();
    }

    /* ---- Rooms ---- */
    private joinRoom(code: string): void {
        const state: RoomState = {
            room: null, peers: new Set<string>(), error: null,
            sendHello: async () => { /* not connected yet */ },
            sendOps: async () => { /* not connected yet */ },
        };
        this.rooms.set(code, state);
        roomKeys(code).then((keys) => {
            /* Left again (Stop, or the trainer closed) while the key was worked out */
            if (this.rooms.get(code) !== state) return;
            this.openRoom(code, state, keys);
        }, (err) => {
            console.warn('Live sheets: key', err);
            state.error = 'could not prepare the connection';
            this.changed();
        });
    }

    private openRoom(code: string, state: RoomState, keys: RoomKeys): void {
        const cfg = {
            appId: APP_ID,
            password: keys.pass,
            ...((window as unknown as { PokeroleLiveConfig?: object }).PokeroleLiveConfig || {}),
        };
        const room = transport()(cfg, 'pokerole-' + keys.room, {
            onJoinError: (d) => {
                state.error = String((d && d.error) || 'connection failed');
                console.warn('Live sheets:', d);
                this.changed();
            },
        });
        const hello = room.makeAction('hello');
        const ops = room.makeAction('ops');
        state.room = room;
        state.sendHello = (d, opts) => hello.send(d as unknown as DataPayload, opts);
        state.sendOps = (d) => ops.send(d as unknown as DataPayload);
        room.onPeerJoin = (peerId) => {
            state.peers.add(peerId);
            state.error = null;
            this.changed();
            const e = liveEntries().find((x) => x.code === code);
            if (!e) return;
            void state.sendHello({
                tid: e.tid, role: e.role, name: e.name || '',
                lastEdit: e.tid ? getMeta(e.tid) : 0,
                data: e.tid ? this.adapter.read(e.tid) : null,
            }, { target: peerId });
        };
        room.onPeerLeave = (peerId) => { state.peers.delete(peerId); this.changed(); };
        hello.onMessage = (h) => this.onHello(code, parseHello(h));
        ops.onMessage = (raw) => {
            /* Anything from another device is checked before it touches the
               working set: see parseOps */
            const m = raw as unknown as Record<string, unknown>;
            if (!m || typeof m !== 'object' || typeof m.tid !== 'string') return;
            const list = parseOps(m.ops);
            if (!list) return;
            const tid = m.tid;
            const ts = typeof m.ts === 'number' && Number.isFinite(m.ts) ? m.ts : 0;
            const e = liveEntries().find((x) => x.code === code);
            if (!e || e.tid !== tid || !this.adapter.hasTrainer(tid)) return;
            this.adapter.apply(tid, (data) => { applyOps(data, list); return data; }, false);
            this.base.set(tid, JSON.stringify(this.adapter.read(tid)));
            if (ts) setMeta(tid, ts);
        };
        this.changed();
    }

    private leaveRoom(code: string): void {
        const r = this.rooms.get(code);
        if (!r) return;
        if (r.room) void r.room.leave().catch(() => { /* already gone */ });
        this.rooms.delete(code);
    }

    private onHello(code: string, h: Hello | null): void {
        if (!h || !h.tid) return;
        const list = liveEntries();
        const e = list.find((x) => x.code === code);
        if (!e) return;
        if (!e.tid) {   // a guest's first contact: learn which trainer this is
            if (!this.adapter.adopt) return;
            e.tid = h.tid;
            e.name = h.name || String((h.data && h.data.name) || '');
            saveLiveEntries(list);
        } else if (e.tid !== h.tid) return;
        if (!h.data) return;
        const tid = h.tid;
        if (!this.adapter.hasTrainer(tid)) {
            if (this.adapter.adopt) {
                this.adapter.adopt(tid, h.data, e.name);
                this.base.set(tid, JSON.stringify(this.adapter.read(tid)));
                setMeta(tid, h.lastEdit || 0);
            }
            this.changed();
            return;
        }
        const mine = getMeta(tid);
        const theirs = h.lastEdit || 0;
        const differs = JSON.stringify(this.adapter.read(tid)) !== JSON.stringify(h.data);
        /* The newer copy wins; on a tie the guest takes the host's */
        if (differs && (theirs > mine || (theirs === mine && e.role === 'guest' && h.role === 'host'))) {
            const incoming = h.data;
            this.adapter.apply(tid, () => incoming, true);
            this.base.set(tid, JSON.stringify(this.adapter.read(tid)));
            setMeta(tid, theirs);
        }
        this.changed();
    }

    /* ---- Outgoing ---- */
    private onLocalWrite(): void {
        if (this.applying || !this.rooms.size) {
            /* A trainer may have been loaded or closed: rooms follow membership */
            if (!this.applying) queueMicrotask(() => this.reconcileIfNeeded());
            return;
        }
        if (this.diffTimer != null) clearTimeout(this.diffTimer);
        this.diffTimer = window.setTimeout(() => { this.diffTimer = null; this.sendLocalChanges(); }, DIFF_DELAY_MS);
        queueMicrotask(() => this.reconcileIfNeeded());
    }

    private lastWanted = '';
    private reconcileIfNeeded(): void {
        const want = liveEntries()
            .filter((e) => (e.tid ? this.adapter.hasTrainer(e.tid) : this.adapter.joinsPending))
            .map((e) => e.code).sort().join(',');
        const have = [...this.rooms.keys()].sort().join(',');
        if (want === have && want === this.lastWanted) return;
        this.lastWanted = want;
        if (want !== have) this.reconcile();
    }

    private sendLocalChanges(): void {
        const trainers = workingTrainers(localStorage.getItem(WORKING_KEY));
        if (!trainers) return;
        this.rooms.forEach((r, code) => {
            const e = liveEntries().find((x) => x.code === code);
            if (!e || !e.tid) return;
            const t = trainers.find((x) => x.id === e.tid);
            if (!t) return;
            const now = JSON.stringify(t.data);
            const before = this.base.get(e.tid);
            if (before === undefined) { this.base.set(e.tid, now); return; }
            if (now === before) return;
            let ops: Op[];
            try { ops = diff(JSON.parse(before), t.data); }
            catch { ops = [{ p: [], v: t.data }]; }
            this.base.set(e.tid, now);
            if (!ops.length) return;
            const ts = Date.now();
            setMeta(e.tid, ts);
            if (r.peers.size) r.sendOps({ tid: e.tid, ts, ops }).catch((err) => console.warn('Live sheets: send', err));
        });
    }

    /* ---- Another tab on this device ---- */
    private onStorage(ev: StorageEvent): void {
        if (ev.storageArea !== localStorage) return;
        if (ev.key === LIVE_KEY) { this.reconcile(); return; }
        if (ev.key !== WORKING_KEY || !this.rooms.size) return;
        const trainers = workingTrainers(ev.newValue);
        if (!trainers) return;
        /* That tab sends its own changes out; this one just catches up */
        liveEntries().forEach((e) => {
            if (!e.tid || !this.rooms.has(e.code)) return;
            const t = trainers.find((x) => x.id === e.tid);
            if (t) this.base.set(e.tid, JSON.stringify(t.data));
        });
        this.adapter.onSiblingWrite?.();
    }

    /* ---- The status pill, on every page that syncs ---- */
    private renderPill(): void {
        const s = this.status();
        if (!this.pill) {
            if (!s.on) return;
            const pill = document.createElement('div');
            pill.id = 'live-pill';
            pill.innerHTML = '<span class="dot"></span><span class="txt"></span>';
            pill.title = 'Live sheet';
            pill.addEventListener('click', () => this.onPillClick?.());
            document.body.appendChild(pill);
            this.pill = pill;
        }
        const pill = this.pill;
        pill.style.display = s.on ? 'flex' : 'none';
        pill.classList.toggle('ok', s.peers > 0);
        pill.classList.toggle('err', s.error);
        pill.querySelector('.txt')!.textContent = s.error ? 'Live · can’t connect'
            : s.peers ? 'Live · ' + s.peers + ' connected' : 'Live · waiting…';
    }
}

/** A hello from another device, checked and with the trainer copied clean,
    or null if it is not one. */
function parseHello(raw: unknown): Hello | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const h = raw as Record<string, unknown>;
    if (h.tid !== null && typeof h.tid !== 'string') return null;
    let data: TrainerData | null = null;
    if (h.data !== null && h.data !== undefined) {
        const c = cleanJson(h.data);
        if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
        data = c as TrainerData;
    }
    return {
        tid: h.tid as string | null,
        role: h.role === 'host' ? 'host' : 'guest',
        name: typeof h.name === 'string' ? h.name.slice(0, 80) : '',
        lastEdit: typeof h.lastEdit === 'number' && Number.isFinite(h.lastEdit) ? h.lastEdit : 0,
        data,
    };
}

/* One engine per page */
let engine: LiveEngine | null = null;

export function startLive(adapter: LiveAdapter): LiveEngine {
    if (!engine) {
        engine = new LiveEngine(adapter);
        engine.start();
    }
    return engine;
}

export function getLive(): LiveEngine | null { return engine; }
