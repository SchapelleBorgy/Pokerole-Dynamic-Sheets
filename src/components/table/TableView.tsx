/* The table itself, once you are in it.

   Two halves, like a GM screen with the dice tray beside it: the shared dice
   on the left, and on the right the GM's whole board for the GM, or just the
   combat trackers for a player. A narrow screen shows one half at a time
   behind a pair of tabs.

   The turn strip heads the right half when the GM has put a fight on the
   table, and a player's own trainer and team sit in the dice half. The shared
   map and the music need a relay (relay.ts), so at a table whose browsers
   connect directly they are not offered. */

import { useEffect, useState } from 'react';
import { useTable } from '../../table/TableContext';
import { Credentials } from './Credentials';
import { MemberList } from './MemberList';
import { RollControls } from './RollControls';
import { RollFeed } from './RollFeed';
import { HostBoard } from './HostBoard';
import { PlayerCombat } from './PlayerCombat';
import { HomeButton } from '../common/HomeButton';
import { MapStage } from './MapStage';
import { MapControls } from './MapControls';
import { MusicPanel } from './MusicPanel';
import { CharacterPanel } from './CharacterPanel';
import { NpcSheets } from './NpcSheets';
import { GiftDialog } from './GiftDialog';
import { TurnStrip } from './TurnStrip';
import { CHANNELS } from '../../table/protocol';
import { peerToPeer } from '../../table/relay';
import { useTour } from '../../lib/tour';
import { GuidedTour, TourButton, useFirstTimeTour } from '../common/Tour';
import { tableSteps } from './tour/steps';
import { TableConfirm } from './TableConfirm';
import type { TableAsk } from './TableConfirm';

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

    const media = !peerToPeer();
    const map = session.map.view;
    const music = session.music.view;
    const mapOn = media && map.show && (!!map.url || map.loading !== null || !!map.error);
    const silenced = media && !music.unlocked && CHANNELS.some((c) => music.decks[c].playing);
    const [ask, setAsk] = useState<TableAsk | null>(null);
    const tourId = isHost ? 'table-gm' : 'table-player';

    /* A step of the tour may need the other half of a narrow screen, or the
       invite and the players unfolded. That open is the tour's, never saved. */
    const { view: tourView, unfold } = useTour();
    useEffect(() => {
        if (tourView === 'rolls') setPane('dice');
        else if (tourView === 'map' || tourView === 'board') setPane('board');
    }, [tourView]);
    const peopleShown = peopleOpen || unfold === 'invite' || unfold === 'members';

    /* First time in this role on this browser: offer the tour. */
    useFirstTimeTour(tourId);

    const connection = status === 'online'
        ? (isHost || hostOnline ? 'live' : 'waiting')
        : status === 'connecting' ? 'connecting' : 'offline';

    /* The name the GM's roster gives me: a name someone else already had
       comes back with a number after it, and rolls carry that one. */
    const shownName = state.members.find((m) => m.id === state.myId)?.name ?? state.myName;

    const CONNECTION_TEXT: Record<string, string> = {
        live: 'Connected',
        waiting: 'Waiting for the GM',
        connecting: 'Reconnecting…',
        offline: 'Offline',
    };

    return (
        <div className="table-page">
            <header className="table-bar" data-tour="bar">
                <h1><i className="fa-solid fa-dice"></i> Rolling Table</h1>

                <span className={'conn conn-' + connection}>
                    <i className="fa-solid fa-circle"></i> {CONNECTION_TEXT[connection]}
                </span>

                {isHost && <span className="role-badge"><i className="fa-solid fa-crown"></i> Game Master</span>}

                <div className="bar-spacer"></div>
                <TourButton id={tourId} className="icon-btn" />
                <HomeButton className="icon-btn" />

                {isHost ? (
                    <button className="danger" id="close-table" onClick={() => setAsk({
                        title: 'Close the table?', icon: 'fa-door-closed', ok: 'Close table', danger: true,
                        text: <>
                            This browser forgets the table: the roll history is deleted, and so is the room lock.
                            {' '}Players stay in a table with no GM until they leave.
                            {'\n\n'}To open it again, create it from the same lobby id and password.
                        </>,
                        onOk: () => session.leave(),
                    })}>
                        <i className="fa-solid fa-door-closed"></i> Close table
                    </button>
                ) : (
                    <button className="danger" onClick={() => session.leave()}>
                        <i className="fa-solid fa-right-from-bracket"></i> Leave table
                    </button>
                )}
                <TableConfirm ask={ask} onClose={() => setAsk(null)} />
            </header>

            {state.statusDetail && (
                <p className="table-banner">{state.statusDetail}</p>
            )}

            {silenced && (
                <p className="table-sound-banner" role="status">
                    <i className="fa-solid fa-music"></i> The GM is playing music.
                    <button className="accent" onClick={() => session.music.unlock()}>
                        <i className="fa-solid fa-volume-high"></i> Enable sound
                    </button>
                </p>
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
                            open={peopleShown}
                            onToggle={(e) => {
                                const open = e.currentTarget.open;
                                /* Only a click of the person's own: the tour
                                   opening it, or closing it again, is not. */
                                if (open === peopleShown) return;
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

                        {!isHost && <CharacterPanel />}
                        {!isHost && <NpcSheets />}
                        {media && isHost && <MapControls />}
                        {media && <MusicPanel />}

                        <div className="feed-scroll" data-tour="feed">
                            <RollFeed rolls={state.rolls} myName={shownName} members={state.members}
                                sorted={state.successesFirst} />
                        </div>
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

                <section className="table-board" aria-label={isHost ? 'GM screen' : 'Combat'} data-tour="center">
                    <TurnStrip />
                    {mapOn && (
                        <div className="table-stage board-stage" aria-label="The shared map">
                            <MapStage />
                        </div>
                    )}
                    {isHost ? <HostBoard /> : <PlayerCombat />}
                </section>
            </div>

            {!isHost && <GiftDialog />}

            <GuidedTour
                id={tourId}
                steps={tableSteps(session, isHost ? 'gm' : 'player')}
                intro={isHost
                    ? 'A one-minute tour of the Game Master\u2019s side: the table itself, and the GM screen beside it that runs your fights.'
                    : 'A one-minute tour of the table: your character, the dice, the feed and fights.'}
            />
        </div>
    );
}
