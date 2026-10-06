import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, ModalClose, ModalTitle } from '../common/Modal';
import { useToast } from '../common/Toast';
import { useSheetStore } from '../../state/SheetContext';
import { useSession } from '../../state/SessionContext';
import { getLive, liveEntries, normalizeCode, shareLink } from '../../live/engine';
import type { LiveEngine } from '../../live/engine';
import { licenseHooks } from '../../live/adapters';

/* The license's side of live sheets: the header button, the Live window, and
   the bridge that lets the engine close the landing and raise toasts. */

/* Whether the Live window is open, shared by the header button, the landing
   and the status pill without threading props through the page. */
let windowOpen = false;
const openListeners = new Set<() => void>();
function setWindowOpen(v: boolean): void {
    windowOpen = v;
    openListeners.forEach((l) => l());
}
export function openLiveWindow(): void { setWindowOpen(true); }

function useLive(): LiveEngine | null {
    const live = getLive();
    const noop = useCallback(() => () => {}, []);
    useSyncExternalStore(live ? live.subscribe : noop, live ? live.getSnapshot : () => 0);
    return live;
}

/** Mounted once inside the license's providers. */
export function LiveBridge() {
    const session = useSession();
    const toast = useToast();
    const live = getLive();

    useEffect(() => {
        licenseHooks.closeLanding = session.closeLanding;
        licenseHooks.toast = toast;
    }, [session.closeLanding, toast]);

    useEffect(() => {
        if (!live) return;
        live.onPillClick = openLiveWindow;
        /* A #live=CODE link joins straight away. Deferred so it runs after the
           session's own boot, which would otherwise reopen the landing. */
        const fromHash = () => {
            const m = /(?:^|[#&])live=([A-Za-z0-9-]+)/.exec(location.hash);
            if (!m) return;
            history.replaceState(null, '', location.href.split('#')[0]);
            const code = normalizeCode(m[1]);
            if (!code) return;
            licenseHooks.closeLanding?.();
            live.join(code);
        };
        const id = window.setTimeout(fromHash, 0);
        window.addEventListener('hashchange', fromHash);
        return () => { clearTimeout(id); window.removeEventListener('hashchange', fromHash); };
    }, [live]);

    return <LiveWindow />;
}

/** The broadcast-tower button in the header tools. */
export function LiveButton() {
    const live = useLive();
    if (!live) return null;
    const s = live.status();
    return (
        <button
            className={'type-eff-btn live-btn' + (s.on ? ' on' : '') + (s.peers ? ' ok' : '') + (s.error ? ' err' : '')}
            id="live-btn"
            onClick={openLiveWindow}
            title="Live sheet: share this trainer with another device, or join one"
        >
            <i className="fa-solid fa-tower-broadcast"></i>
            <span className="live-dot"></span>
        </button>
    );
}

/** The landing's way in for a player with nothing on disk. */
export function LiveLandingButton({ onClick }: { onClick: () => void }) {
    if (!getLive()) return null;
    return (
        <button className="form-btn cancel" style={{ width: '100%' }} onClick={() => { onClick(); openLiveWindow(); }}>
            <i className="fa-solid fa-tower-broadcast"></i> Join a live sheet
        </button>
    );
}

function LiveWindow() {
    const live = useLive();
    const { sheet } = useSheetStore();
    const toast = useToast();
    const open = useSyncExternalStore(
        useCallback((cb: () => void) => { openListeners.add(cb); return () => { openListeners.delete(cb); }; }, []),
        () => windowOpen,
    );
    const [code, setCode] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const close = useCallback(() => setWindowOpen(false), []);

    useEffect(() => {
        if (!open) return;
        const id = window.setTimeout(() => { if (!liveEntries().some((e) => e.tid === sheet.id)) input.current?.focus(); }, 30);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!live) return null;
    const list = liveEntries();
    const cur = list.find((e) => e.tid === sheet.id);
    const others = list.filter((e) => e !== cur);
    const name = sheet.name || 'this trainer';

    const join = () => { if (live.join(code)) { setCode(''); close(); } };
    const copy = (c: string) => {
        const link = shareLink(c);
        const done = () => toast('<i class="fa-solid fa-link"></i> Link copied');
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, () => window.prompt('Copy this link:', link));
        else window.prompt('Copy this link:', link);
    };

    let state = '';
    if (cur) {
        const n = live.peersIn(cur.code);
        state = live.errorIn(cur.code) ? 'Couldn’t reach the other device. Check both are online, or try another network.'
            : n ? n + ' other device' + (n === 1 ? ' is' : 's are') + ' connected. Edits show up on both.'
            : 'Waiting for someone to join…';
    }

    return (
        <Modal open={open} onClose={close} id="live-modal" boxStyle={{ maxWidth: 400 }}>
            <ModalClose onClick={close} />
            <ModalTitle icon="fa-tower-broadcast" centered={false}>Live sheet</ModalTitle>
            {cur ? (
                <>
                    <p className="modal-text">
                        <strong>{name}</strong> is live. Send your player this code or link:
                    </p>
                    <div className="live-code">{cur.code}</div>
                    <p className="live-sub">{state}</p>
                    <div className="modal-actions live-row" style={{ marginTop: 12 }}>
                        <button className="form-btn save" data-act="copy" onClick={() => copy(cur.code)}>
                            <i className="fa-solid fa-link"></i> Copy link
                        </button>
                        <button className="form-btn danger" data-act="stop" onClick={() => live.stop(cur.code)}>
                            <i className="fa-solid fa-power-off"></i> Stop
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="modal-text">
                        Share <strong>{name}</strong> with another device. Every change made on either one
                        shows up on the other.
                    </p>
                    <div className="modal-actions">
                        <button className="form-btn save" style={{ width: '100%' }} data-act="share"
                            onClick={() => live.goLive(sheet.id, sheet.name || '')}>
                            <i className="fa-solid fa-tower-broadcast"></i> Go live with this trainer
                        </button>
                    </div>
                </>
            )}
            {others.length > 0 && (
                <>
                    <hr className="live-sep" />
                    <p className="modal-text" style={{ marginBottom: 4 }}>Also live on this device:</p>
                    <ul className="live-list">
                        {others.map((e) => (
                            <li key={e.code}>
                                <span>
                                    {(e.name || (e.tid ? 'Trainer' : 'Joining…')) + ' · ' + e.code + ' · '
                                        + (live.peersIn(e.code) ? live.peersIn(e.code) + ' connected' : 'waiting')}
                                </span>
                                <button className="form-btn cancel" style={{ padding: '4px 10px' }} data-act="stop"
                                    onClick={() => live.stop(e.code)}>Stop</button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <hr className="live-sep" />
            <p className="modal-text" style={{ marginBottom: 6 }}>Got a code from someone else?</p>
            <div className="live-row">
                <input
                    ref={input}
                    className="live-input"
                    id="live-join-input"
                    placeholder="ABCD-2345"
                    maxLength={9}
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
                />
                <button className="form-btn save" style={{ flex: '0 0 auto' }} data-act="join" onClick={join}>Join</button>
            </div>
        </Modal>
    );
}
