/* The table itself, once you are in it.

   Two halves, like a GM screen with the dice tray beside it: the shared dice
   on the left, and on the right the GM's whole board for the GM, or just the
   combat trackers for a player. A narrow screen shows one half at a time
   behind a pair of tabs. */

import { useState } from 'react';
import { useTable } from '../../table/TableContext';
import { Credentials } from './Credentials';
import { MemberList } from './MemberList';
import { RollControls } from './RollControls';
import { RollFeed } from './RollFeed';
import { HostBoard } from './HostBoard';
import { PlayerCombat } from './PlayerCombat';
import { HomeButton } from '../common/HomeButton';

/* Whether the invite and the member list are folded away, per browser. */
const PEOPLE_KEY = 'pokerole_table_people_open';

function peopleOpenAtStart(): boolean {
    try { return localStorage.getItem(PEOPLE_KEY) !== '0'; } catch { return true; }
}

export function TableView() {
    const { session, state } = useTable();
    const { status, isHost, hostOnline, pending } = state;
    /* Which half a narrow screen shows. Dice first: it is the half everyone
       at the table uses, and the other is one tap away. */
    const [pane, setPane] = useState<'dice' | 'board'>('dice');
    const [peopleOpen, setPeopleOpen] = useState(peopleOpenAtStart);

    const connection = status === 'online'
        ? (isHost || hostOnline ? 'live' : 'waiting')
        : status === 'connecting' ? 'connecting' : 'offline';

    const CONNECTION_TEXT: Record<string, string> = {
        live: 'Connected',
        waiting: 'Waiting for the GM',
        connecting: 'Reconnecting…',
        offline: 'Offline',
    };

    return (
        <div className="table-page">
            <header className="table-bar">
                <h1><i className="fa-solid fa-dice"></i> Rolling Table</h1>

                <span className={'conn conn-' + connection}>
                    <i className="fa-solid fa-circle"></i> {CONNECTION_TEXT[connection]}
                </span>

                {isHost && <span className="role-badge"><i className="fa-solid fa-crown"></i> Game Master</span>}

                <div className="bar-spacer"></div>
                <HomeButton className="icon-btn" />

                <button className="danger" onClick={() => session.leave()}>
                    <i className="fa-solid fa-right-from-bracket"></i> Leave table
                </button>
            </header>

            {state.statusDetail && (
                <p className="table-banner">{state.statusDetail}</p>
            )}

            {state.notice && (
                /* Plain text child, never innerHTML — names here come from other
                   people's browsers. */
                <p className="table-notice" role="status">{state.notice}</p>
            )}

            <nav className="split-tabs" aria-label="Table sections">
                <button className={pane === 'dice' ? 'active' : ''} aria-current={pane === 'dice' ? 'page' : undefined}
                    onClick={() => setPane('dice')}>
                    <i className="fa-solid fa-dice"></i> Dice
                </button>
                <button className={pane === 'board' ? 'active' : ''} aria-current={pane === 'board' ? 'page' : undefined}
                    onClick={() => setPane('board')}>
                    <i className={'fa-solid ' + (isHost ? 'fa-chess-board' : 'fa-khanda')}></i>
                    {isHost ? ' GM screen' : ' Combat'}
                </button>
            </nav>

            <div className={'table-split show-' + pane}>
                <aside className="table-dock">
                    <div className="dock-scroll">
                        <details
                            className="dock-people"
                            open={peopleOpen}
                            onToggle={(e) => {
                                const open = e.currentTarget.open;
                                setPeopleOpen(open);
                                try { localStorage.setItem(PEOPLE_KEY, open ? '1' : '0'); } catch { /* private mode */ }
                            }}
                        >
                            <summary>
                                <i className="fa-solid fa-users"></i> {isHost ? 'Invite and players' : 'Players'}
                                <span className="count">{state.members.length}</span>
                                <i className="fa-solid fa-chevron-down fold"></i>
                            </summary>
                            <Credentials />
                            <MemberList />
                        </details>

                        <RollFeed rolls={state.rolls} myName={state.myName} />
                    </div>

                    {pending.length > 0 && (
                        <div className="pending-strip">
                            {pending.map((p) => (
                                <span key={p.rid} className="pending-chip">
                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                    {p.label}
                                    <button
                                        className="icon-btn"
                                        title="Cancel this request"
                                        onClick={() => session.cancelPending(p.rid)}
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <RollControls />

                    {isHost && state.rolls.length > 0 && (
                        <button className="clear-feed" onClick={() => session.clearFeed()}>
                            <i className="fa-solid fa-eraser"></i> Clear the feed for everyone
                        </button>
                    )}
                </aside>

                <section className="table-board" aria-label={isHost ? 'GM screen' : 'Combat'}>
                    {isHost ? <HostBoard /> : <PlayerCombat />}
                </section>
            </div>
        </div>
    );
}
