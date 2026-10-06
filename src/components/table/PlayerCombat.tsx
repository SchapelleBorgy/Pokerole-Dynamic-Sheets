/* A player's view of the GM's combat trackers: the same rows the GM sees,
   drawn from what the GM's browser sent, with nothing to press.

   The markup and class names are the combat panel's own, so the two read the
   same and gm/combat.css styles both. What is missing is every control: the
   initiative is a number rather than a field, the pips and the clash and
   evasion marks are marks rather than buttons, and the status chips do not
   cycle. The board is the GM's to change. */

import { FallbackImage } from '../common/FallbackImage';
import { PoolBar } from '../gm/RosterBits';
import { StatusChips } from '../gm/StatusChips';
import { useTable } from '../../table/TableContext';
import { ailmentByKey, defaultStatus } from '../../gm/ailments';
import type { GmStatus } from '../../gm/ailments';
import { MAX_ACTIONS } from '../../gm/combat';
import { tileSpriteChain } from '../../lib/sprites';
import type { WireCombatant, WireFight } from '../../table/protocol';

export function PlayerCombat() {
    const { state } = useTable();
    const fights = state.combat;

    if (!fights || !fights.length) {
        return (
            <div className="combat-board">
                <div className="board-empty combat-waiting">
                    <i className="fa-solid fa-khanda"></i>
                    {!fights
                        ? (state.hostOnline
                            ? ' Waiting for the GM’s combat tracker…'
                            : ' The combat tracker shows up here once the GM is connected.')
                        : ' No fight on the board right now. When the GM starts one, it shows up here.'}
                </div>
            </div>
        );
    }

    return (
        <div className="combat-board">
            {fights.map((f) => <FightPanel key={f.id} fight={f} />)}
        </div>
    );
}

function FightPanel({ fight }: { fight: WireFight }) {
    return (
        <section className="panel" data-panel-kind="combat">
            <div className="panel-head">
                <i className="fa-solid fa-khanda panel-icon"></i>
                <h2 title={fight.name}>{fight.name}</h2>
                <span className="round-pill">
                    <i className="fa-solid fa-rotate"></i> Round <span className="round-num">{fight.round}</span>
                </span>
            </div>
            <div className="panel-body">
                <div className="combat-list">
                    {!fight.rows.length
                        ? <div className="empty-note">No combatants yet.</div>
                        : fight.rows.map((r) => <FightRow key={r.id} r={r} />)}
                </div>
            </div>
        </section>
    );
}

/** Rebuilds the card-style status object from the list of ailments that are
    on, which is all the wire carries. */
function statusOf(keys: string[]): GmStatus {
    const st = defaultStatus();
    for (const k of keys) {
        if (k === 'burn1' || k === 'burn2' || k === 'burn3') {
            st.major = 'burn';
            st.burnDegree = Number(k.slice(4));
        } else if (k === 'poison' || k === 'badlyPoison') {
            st.major = 'poison';
            st.poisonStage = k === 'poison' ? 1 : 2;
        } else if (k === 'paralysis' || k === 'frozen' || k === 'sleep') {
            st.major = k;
        } else if (k === 'confusion' || k === 'flinch' || k === 'inLove') {
            st[k] = true;
        }
    }
    return st;
}

const noCycle = () => { /* read-only */ };

function FightRow({ r }: { r: WireCombatant }) {
    const kindIcon = r.kind === 't' ? 'fa-user' : r.kind === 'c' ? 'fa-masks-theater' : 'fa-paw';

    return (
        <div className={'combat-row read-only' + (r.acted >= MAX_ACTIONS ? ' spent' : '')}>
            {r.img
                ? (
                    <FallbackImage
                        candidates={tileSpriteChain(r.img).map((c) => ({
                            url: c.url,
                            className: ('c-sprite ' + c.className.replace('tile-sprite ', '')).trim(),
                        }))}
                        alt={r.name}
                    />
                )
                : <i className={'fa-solid ' + kindIcon + ' c-icon'}></i>}
            <div className="c-main">
                <div className="c-head">
                    <div className="c-name" title={r.name}>{r.name}</div>
                    <span className="c-init-wrap">
                        <span className="init-label">Init</span>
                        <span className="c-init c-init-ro">{r.init ?? '–'}</span>
                    </span>
                </div>
                {r.hp && r.will && (
                    <div className="pool-bars c-pools">
                        <PoolBar tag="HP" cls="hp" cur={r.hp[0]} max={r.hp[1]} />
                        <PoolBar tag="WILL" cls="will" cur={r.will[0]} max={r.will[1]} />
                    </div>
                )}
                <div className="c-strip">
                    {r.st && <StatusChips status={statusOf(r.st)} twoRows onCycle={noCycle} />}
                    <div className="pips" title={r.acted + ' of ' + MAX_ACTIONS + ' actions used'}>
                        {Array.from({ length: MAX_ACTIONS }, (_, i) => (
                            <span key={i} className={'pip' + (i < r.acted ? ' used' : '')} />
                        ))}
                    </div>
                    <div className="c-used">
                        <span className={'used-mark' + (r.clash ? ' on' : '')}
                            title={r.clash ? 'Clashed this Round' : 'Clash still available this Round'}>
                            <i className="fa-solid fa-hand-fist"></i>CLASH
                        </span>
                        <span className={'used-mark' + (r.eva ? ' on' : '')}
                            title={r.eva ? 'Evaded this Round' : 'Evasion still available this Round'}>
                            <i className="fa-solid fa-person-running"></i>EVA
                        </span>
                    </div>
                </div>
            </div>
            {!!r.flags.length && (
                <div className="round-flags">
                    {r.flags.map((f) => {
                        const ail = ailmentByKey(f.a);
                        if (!ail) return null;
                        return (
                            <span
                                key={f.a}
                                className={'round-flag' + (f.x ? ' dealt' : '')}
                                style={{ borderColor: ail.color, color: ail.color, background: ail.color + '1a' }}
                            >
                                <i className={'fa-solid ' + ail.icon}></i>{ail.name}
                                {!!f.d && <span className="dmg">−{f.d} HP</span>}
                                {f.x && <i className="fa-solid fa-check" title="Dealt this Round"></i>}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
