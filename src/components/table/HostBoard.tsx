/* The GM's half of the table: the whole GM screen, the same board the GM
   screen page keeps, plus the one thing it adds — the combat trackers going
   out to the players as they change. */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { loadAppData, verifyAppData } from '../../data/loadAppData';
import { AppDataProvider, useAppData } from '../../data/AppDataContext';
import { GM_TOAST, ToastProvider } from '../common/Toast';
import { ConfirmProvider } from '../gm/ConfirmDialog';
import { GmStoreProvider, useGmStore } from '../../gm/GmContext';
import { GmStore } from '../../gm/store';
import { GmApp } from '../gm/GmApp';
import { startLive } from '../../live/engine';
import { workingSetAdapter } from '../../live/adapters';
import { useTable } from '../../table/TableContext';
import { combatSnapshot, hiddenFights, setFightHidden, subscribeHiddenFights } from '../../table/combatSnapshot';
import type { AppData, PokedexEntry } from '../../data/types';

/* Made on first use rather than at load: a player's browser never needs the
   GM's board, and reading it would only cost them time. */
let gmStore: GmStore | null = null;

export function HostBoard() {
    const [data, setData] = useState<AppData | null>(null);
    const [dataOk, setDataOk] = useState(true);
    const store = useMemo(() => {
        if (!gmStore) {
            gmStore = new GmStore();
            /* Live sheets shared from this device stay current while this is
               the only page open, exactly as on the GM screen. */
            startLive(workingSetAdapter());
        }
        return gmStore;
    }, []);

    useEffect(() => {
        let live = true;
        loadAppData()
            .then(async (loaded) => {
                if (!live) return;
                setData(loaded);
                const ok = await verifyAppData(loaded);
                setDataOk(ok && loaded.moves.length > 0 && loaded.natures.length > 0);
            })
            .catch(() => { if (live) setDataOk(false); });
        return () => { live = false; };
    }, []);

    if (!data) {
        return (
            <div className="board-loading">
                <i className="fa-solid fa-circle-notch fa-spin"></i> Loading the GM screen…
            </div>
        );
    }

    return (
        <AppDataProvider data={data}>
            <GmStoreProvider store={store}>
                <ToastProvider skin={GM_TOAST}>
                    <ConfirmProvider>
                        <CombatBroadcast />
                        <GmApp
                            dataOk={dataOk}
                            embedded
                            combatActions={(gid) => <ShareToggle gid={gid} />}
                        />
                    </ConfirmProvider>
                </ToastProvider>
            </GmStoreProvider>
        </AppDataProvider>
    );
}

function useHiddenFights(): ReadonlySet<string> {
    return useSyncExternalStore(subscribeHiddenFights, hiddenFights, hiddenFights);
}

/** Sends the combat trackers to the players on every board change. Renders
    nothing. Subscribes to the store directly rather than through a render, so
    an HP change made on a trainer sheet (which redraws the board without
    changing the board's own state) still goes out. */
function CombatBroadcast() {
    const store = useGmStore();
    const { data } = useAppData();
    const { session } = useTable();
    const hidden = useHiddenFights();

    useEffect(() => {
        const byId = new Map(data.pokemon.map((p) => [p._id, p] as const));
        const dexById = (id: string): PokedexEntry | null => byId.get(id) || null;
        const push = () => session.shareCombat(combatSnapshot(store.state, dexById, hidden));
        push();
        return store.subscribe(push);
    }, [store, data, session, hidden]);

    return null;
}

/** The eye on each combat tracker: whether the players can see this fight. */
function ShareToggle({ gid }: { gid: string }) {
    const hidden = useHiddenFights().has(gid);
    return (
        <button
            className={'icon-btn share-fight' + (hidden ? ' off' : '')}
            aria-pressed={!hidden}
            title={hidden
                ? 'Hidden from the players. Click to show them this fight'
                : 'The players can see this fight. Click to hide it from them'}
            onClick={() => setFightHidden(gid, !hidden)}
        >
            <i className={'fa-solid ' + (hidden ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
    );
}
