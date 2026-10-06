/* The GM's half of the table: the whole GM screen, the same board the GM
   screen page keeps, plus the one thing it adds — the combat trackers going
   out to the players as they change. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { loadAppData, verifyAppData } from '../../data/loadAppData';
import { AppDataProvider, useAppData } from '../../data/AppDataContext';
import { GM_TOAST, ToastProvider } from '../common/Toast';
import { ConfirmProvider } from '../gm/ConfirmDialog';
import { GmStoreProvider, useGm, useGmStore } from '../../gm/GmContext';
import { GmStore } from '../../gm/store';
import { GmApp } from '../gm/GmApp';
import { startLive } from '../../live/engine';
import { workingSetAdapter } from '../../live/adapters';
import { useTable } from '../../table/TableContext';
import {
    accessIds, combatSnapshot, fightAccess, setFightAccess, subscribeFightAccess,
} from '../../table/combatSnapshot';
import type { FightAccess, FightViewer } from '../../table/combatSnapshot';
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
                            combatActions={(gid) => <ShareMenu gid={gid} />}
                        />
                    </ConfirmProvider>
                </ToastProvider>
            </GmStoreProvider>
        </AppDataProvider>
    );
}

function useFightAccess(): FightAccess {
    return useSyncExternalStore(subscribeFightAccess, fightAccess, fightAccess);
}

/** Sends the combat trackers to the players on every board change. Renders
    nothing. Subscribes to the store directly rather than through a render, so
    an HP change made on a trainer sheet (which redraws the board without
    changing the board's own state) still goes out. */
function CombatBroadcast() {
    const store = useGmStore();
    const { data } = useAppData();
    const { session } = useTable();
    const access = useFightAccess();

    useEffect(() => {
        const byId = new Map(data.pokemon.map((p) => [p._id, p] as const));
        const dexById = (id: string): PokedexEntry | null => byId.get(id) || null;
        const ids = accessIds(access);
        const push = () => session.shareCombat(combatSnapshot(store.state, dexById), ids);
        push();
        return store.subscribe(push);
    }, [store, data, session, access]);

    return null;
}

/** The button on each combat tracker that says who can see the fight, and
    the list it opens to change that. */
function ShareMenu({ gid }: { gid: string }) {
    const { state: gm } = useGm();
    const { state: table } = useTable();
    const access = useFightAccess();
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);

    const chosen = access[gid];                 // undefined: everyone
    const everyone = !chosen;
    const name = gm.combats.find((c) => c.gid === gid)?.name || 'this fight';

    /* The players at the table now, then anyone ticked earlier who is not
       here at the moment, so they can still be unticked. */
    const present = table.members.filter((m) => !m.host).map((m) => ({ id: m.id, name: m.name }));
    const away = (chosen || []).filter((v) => !present.some((m) => m.id === v.id));
    const sees = (id: string) => everyone || chosen.some((v) => v.id === id);

    const toggle = (who: FightViewer) => {
        /* From "everyone", unticking one player means everyone here but them. */
        const base: FightViewer[] = everyone ? present : [...chosen];
        const next = sees(who.id) ? base.filter((v) => v.id !== who.id) : [...base, who];
        setFightAccess(gid, next);
    };

    const seen = everyone ? present : chosen;
    const label = everyone ? 'All' : !chosen.length ? 'None' : String(chosen.length);
    const icon = everyone ? 'fa-eye' : !chosen.length ? 'fa-eye-slash' : 'fa-user-check';
    const title = everyone
        ? 'Every player can see this fight. Click to choose who'
        : !chosen.length
            ? 'Hidden from every player. Click to choose who can see it'
            : 'Only ' + chosen.map((v) => v.name).join(', ') + ' can see this fight. Click to change';

    return (
        <>
            <button
                ref={button}
                className={'icon-btn share-fight' + (everyone ? '' : chosen.length ? ' some' : ' off')}
                aria-haspopup="dialog"
                aria-expanded={open}
                title={title}
                onClick={() => setOpen(!open)}
            >
                <i className={'fa-solid ' + icon}></i><span className="share-count">{label}</span>
            </button>
            {open && (
                <SharePopover anchor={button} onClose={() => setOpen(false)}>
                    <div className="share-pop-title">Who can see <strong>{name}</strong></div>
                    <div className="share-quick">
                        <button className={everyone ? 'active' : ''} aria-pressed={everyone}
                            onClick={() => setFightAccess(gid, null)}>
                            <i className="fa-solid fa-eye"></i> Everyone
                        </button>
                        <button className={!everyone && !chosen.length ? 'active' : ''}
                            aria-pressed={!everyone && !chosen.length}
                            onClick={() => setFightAccess(gid, [])}>
                            <i className="fa-solid fa-eye-slash"></i> Nobody
                        </button>
                    </div>
                    {[...present, ...away].map((v) => (
                        <label key={v.id} className="share-player">
                            <input type="checkbox" checked={sees(v.id)} onChange={() => toggle(v)} />
                            <span>{v.name}</span>
                            {away.includes(v) && <em>not here</em>}
                        </label>
                    ))}
                    {!present.length && !away.length && (
                        <p className="muted share-empty">No players at the table yet.</p>
                    )}
                    <p className="muted share-hint">
                        {everyone
                            ? 'Everyone includes players who join later.'
                            : seen.length
                                ? 'Only the ticked players see it. Anyone who joins later doesn\u2019t.'
                                : 'No player sees this fight.'}
                    </p>
                </SharePopover>
            )}
        </>
    );
}

/** A small panel pinned under its button. Drawn on <body> rather than inside
    the combat panel, which clips anything that spills out of it; it follows
    the button when the board scrolls, and closes on a click elsewhere or
    Escape. */
function SharePopover({ anchor, onClose, children }: {
    anchor: React.RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const box = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        const place = () => {
            const r = anchor.current?.getBoundingClientRect();
            if (!r) return;
            const width = 260;
            const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
            setPos({ top: r.bottom + 6, left });
        };
        place();
        window.addEventListener('resize', place);
        document.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            document.removeEventListener('scroll', place, true);
        };
    }, [anchor]);

    useEffect(() => {
        const away = (e: PointerEvent) => {
            const t = e.target as Node;
            if (box.current?.contains(t) || anchor.current?.contains(t)) return;
            onClose();
        };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('pointerdown', away, true);
        document.addEventListener('keydown', key);
        return () => {
            document.removeEventListener('pointerdown', away, true);
            document.removeEventListener('keydown', key);
        };
    }, [anchor, onClose]);

    return createPortal(
        <div
            ref={box}
            className="share-pop"
            role="dialog"
            style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
        >
            {children}
        </div>,
        document.body,
    );
}
