import { WORKING_KEY } from '../state/constants';
import { normalizeState } from '../state/normalize';
import { readWorking, trainerMonEntry } from '../card/persistence';
import { getLive } from './engine';
import type { LiveAdapter, TrainerData } from './engine';
import type { SheetStore } from '../state/store';
import type { WorkingTrainer } from '../state/workingSet';
import type { CardStore } from '../card/store';
import type { TrainerState } from '../state/types';

/* Where each page keeps the trainers it syncs, and how it redraws. */

function quietly(fn: () => void): void {
    const live = getLive();
    if (live) live.quietly(fn); else fn();
}

function readStoredTrainer(tid: string): TrainerData | null {
    const w = readWorking();
    const t = w && Array.isArray(w.trainers) ? w.trainers.find((x) => x.id === tid) : null;
    return t ? t.data as unknown as TrainerData : null;
}

/** Change one trainer straight in localStorage, for pages without a trainer store. */
function applyStored(tid: string, change: (d: TrainerData) => TrainerData): boolean {
    const w = readWorking();
    const t = w && Array.isArray(w.trainers) ? w.trainers.find((x) => x.id === tid) : null;
    if (!w || !t) return false;
    t.data = change(t.data as unknown as TrainerData) as unknown as TrainerState;
    quietly(() => { try { localStorage.setItem(WORKING_KEY, JSON.stringify(w)); } catch { /* quota */ } });
    return true;
}

/* ---- Trainer's License ---- */

/** Filled in by <LiveBridge>, which sits inside the license's providers. */
export const licenseHooks: {
    closeLanding?: () => void;
    toast?: (html: string) => void;
} = {};

export function licenseAdapter(store: SheetStore): LiveAdapter {
    return {
        joinsPending: true,
        hasTrainer: (tid) => store.trainers.some((t) => t.id === tid),
        read: (tid) => (store.trainers.find((t) => t.id === tid)?.data as unknown as TrainerData) ?? null,
        apply(tid, change, whole) {
            /* Card tabs on this device may have written since; start from theirs */
            store.syncFromStorage();
            const t = store.trainers.find((x) => x.id === tid);
            if (!t) return;
            let next = change(structuredClone(t.data) as unknown as TrainerData) as unknown as TrainerState;
            if (whole) next = normalizeState(next);
            t.data = next;
            quietly(() => store.save());
            store.notify();
        },
        adopt(tid, data, name) {
            const entry: WorkingTrainer = {
                id: tid, handle: null, fileName: null, data: normalizeState(data), savedJson: undefined,
            };
            /* An untouched blank card is only a placeholder: replace it */
            const onlyBlank = store.trainers.length === 1 && !store.trainers[0].handle
                && !store.isDirty(store.trainers[0]);
            quietly(() => {
                if (onlyBlank) store.setTrainers([entry], 0);
                else store.addTrainer(entry);
            });
            licenseHooks.closeLanding?.();
            const shown = (entry.data.name || name || 'the trainer').replace(/[<>&"]/g, '');
            licenseHooks.toast?.('<i class="fa-solid fa-tower-broadcast"></i> Joined ' + shown + ' live');
        },
        onSiblingWrite: () => store.syncFromStorage(),
        toast: (html) => licenseHooks.toast?.(html),
    };
}

/* ---- Pokémon card (opened from a trainer) ---- */

export function cardAdapter(store: CardStore): LiveAdapter {
    const ctx = store.ctx;
    const entryJson = () => {
        const e = trainerMonEntry(readWorking(), ctx);
        return e ? JSON.stringify(e) : null;
    };
    let last = entryJson();
    const refresh = () => {
        const now = entryJson();
        if (now === last) return;
        last = now;
        const e = trainerMonEntry(readWorking(), ctx);
        if (!e) return;
        /* Evolved on the other device: a card is built for one species, so
           reopen it as the new one */
        if (e.dexId && e.dexId !== store.pokemon._id) {
            const u = new URL(location.href);
            u.searchParams.set('pokemon', e.dexId);
            location.replace(u.toString());
            return;
        }
        store.reload();
    };
    return {
        joinsPending: false,
        hasTrainer: (tid) => ctx.inTrainerMode && tid === ctx.trainerId,
        read: readStoredTrainer,
        apply(tid, change) { if (applyStored(tid, change)) refresh(); },
        onSiblingWrite: refresh,
    };
}

/* ---- GM screen: it already watches the working set and redraws ---- */

export function workingSetAdapter(): LiveAdapter {
    return {
        joinsPending: false,
        hasTrainer: (tid) => !!readStoredTrainer(tid),
        read: readStoredTrainer,
        apply(tid, change) { applyStored(tid, change); },
    };
}
