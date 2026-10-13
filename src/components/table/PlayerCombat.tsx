/* A player's view of the GM's combat trackers: the same rows the GM sees,
   drawn from what the GM's browser sent, with nothing to press. Beside them,
   the GM screen's dice panel, holding only the GM's rolls for someone in
   those fights.

   The one exception is the player's own: a row that is their trainer or one
   of its Pokémon (they hold that trainer's live sheet) has a Moves button,
   which opens the same move list the GM's move panel shows. Picking a move
   asks the GM's browser to roll it, and the result lands in the GM's dice
   like any other roll.

   The markup and class names are the combat panel's own, so the two read the
   same and gm/combat.css styles both. What is missing is every control: the
   initiative is a number rather than a field, the pips and the clash and
   evasion marks are marks rather than buttons, and the status chips do not
   cycle. The board is the GM's to change. */

import { useMemo, useState } from 'react';
import { FallbackImage } from '../common/FallbackImage';
import { SideScroll } from '../common/SideScroll';
import { PoolBar } from '../gm/RosterBits';
import { StatusChips } from '../gm/StatusChips';
import { RollHistoryEntry, RollOutput } from '../gm/DicePanel';
import { CAT_COLORS } from '../gm/MovePanel';
import { useTable } from '../../table/TableContext';
import { ailmentByKey, defaultStatus } from '../../gm/ailments';
import type { GmStatus } from '../../gm/ailments';
import { MAX_ACTIONS } from '../../gm/combat';
import { CRIT_MARGIN } from '../../gm/constants';
import { HISTORY_LIMIT, scoreRoll } from '../../gm/dice';
import type { RollEntry } from '../../gm/dice';
import { tileSpriteChain } from '../../lib/sprites';
import { typeColors } from '../../lib/themeTables';
import type { KitRoll, WireCombatant, WireFight, WireGmRoll, WireKit } from '../../table/protocol';

/** One of the GM's rolls, scored again from its faces by the GM screen's own
    code, so the total, successes and verdict are the ones the GM saw. */
function scored(w: WireGmRoll): RollEntry {
    const e = scoreRoll(w.vals, w.sides, {
        who: w.who || undefined, what: w.what || undefined,
        bonus: w.bonus, pain: w.pain || undefined, need: w.need,
    }, CRIT_MARGIN);
    e.t = w.t;
    return e;
}

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
        <SideScroll className="combat-board">
            {fights.map((f) => <FightPanel key={f.id} fight={f} />)}
            <GmDice fights={fights} />
        </SideScroll>
    );
}

/** The GM's rolls for anyone in the fights this player can see, the latest
    in full and the rest under it, drawn with the GM screen's own markup.
    Each is scored again here from its faces by the GM screen's own code, so
    the total, successes and verdict are the ones the GM saw. A roll for
    someone standing in two of those fights shows once. */
function GmDice({ fights }: { fights: WireFight[] }) {
    const rolls = useMemo(() => {
        const seen = new Set<string>();
        const out: RollEntry[] = [];
        for (const f of fights) {
            for (const w of f.rolls) {
                const key = w.t + ':' + w.sides + ':' + w.vals.join(',');
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(scored(w));
            }
        }
        return out.sort((a, b) => b.t - a.t).slice(0, HISTORY_LIMIT);
    }, [fights]);

    const [latest, ...rest] = rolls;
    return (
        <section className="panel gm-dice" data-panel-kind="dice">
            <div className="panel-head">
                <i className="fa-solid fa-dice panel-icon"></i>
                <h2>GM’s dice</h2>
            </div>
            <div className="panel-body">
                {latest
                    ? <RollOutput entry={latest} sorted={false} />
                    : (
                        <div className="empty-note">
                            No rolls yet. When the GM rolls for anyone in your fight, it shows up here.
                        </div>
                    )}
                {!!rest.length && (
                    <div className="gm-roll-history">
                        {rest.map((e, i) => (
                            <RollHistoryEntry key={e.t + '-' + i} entry={e} sorted={false} withCtx />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function FightPanel({ fight }: { fight: WireFight }) {
    const { state } = useTable();
    const [open, setOpen] = useState<string | null>(null);
    const kitOf = (rowId: string) => (state.kits || []).find((k) => k.rows.includes(rowId)) || null;

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
                        : fight.rows.map((r) => {
                            const kit = kitOf(r.id);
                            const shown = !!kit && open === r.id;
                            return (
                                <div className="combat-entry" key={r.id}>
                                    <FightRow
                                        r={r}
                                        mine={!!kit}
                                        open={shown}
                                        onMoves={kit ? () => setOpen(shown ? null : r.id) : undefined}
                                    />
                                    {shown && kit && <MyMoves kit={kit} fight={fight} />}
                                </div>
                            );
                        })}
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

function FightRow({ r, mine, open, onMoves }: {
    r: WireCombatant;
    mine: boolean;
    open: boolean;
    onMoves?: () => void;
}) {
    const kindIcon = r.kind === 't' ? 'fa-user' : r.kind === 'c' ? 'fa-masks-theater' : 'fa-paw';

    return (
        <div className={'combat-row read-only' + (r.acted >= MAX_ACTIONS ? ' spent' : '') + (mine ? ' mine' : '')}>
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
                    {onMoves && (
                        <button
                            type="button"
                            className={'my-moves-btn' + (open ? ' on' : '')}
                            aria-expanded={open}
                            title={r.kind === 't' ? 'Your rolls: Initiative, Evasion and Clash' : 'Your moves: pick one to roll'}
                            onClick={onMoves}
                        >
                            <i className={'fa-solid ' + (r.kind === 't' ? 'fa-dice-d6' : 'fa-list-ul')}></i>
                            {r.kind === 't' ? 'Rolls' : 'Moves'}
                        </button>
                    )}
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

/** A player's own trainer or Pokémon: the GM's move panel, minus nothing but
    the GM. Every button asks the GM's browser to make that roll, which works
    the dice out again from its own copy of the sheet. */
function MyMoves({ kit, fight }: { kit: WireKit; fight: WireFight }) {
    const { session } = useTable();
    const [busy, setBusy] = useState(false);
    const trainer = kit.tok.startsWith('T:');

    const go = (roll: KitRoll, mi = -1, move = '') => {
        if (busy) return;
        setBusy(true);
        session.act(kit.tok, roll, mi, move);
        /* One roll per click: long enough to swallow a double-click, short
           enough not to be noticed. */
        window.setTimeout(() => setBusy(false), 900);
    };

    const chip = (key: KitRoll, label: string, dice: number, tip: string) => (dice > 0
        ? (
            <button key={key} type="button" className="tip-roll" title={tip} disabled={busy} onClick={() => go(key)}>
                {label} <strong>{dice}</strong>
            </button>
        )
        : <span key={key} title={tip}>{label} <strong>{dice}</strong></span>);

    /* The latest of the GM's rolls for this subject in this fight, so the
       result shows up where the button was pressed. */
    const latest = useMemo(() => {
        const w = fight.rolls.find((x) => x.who === kit.name);
        return w ? scored(w) : null;
    }, [fight.rolls, kit.name]);

    return (
        <div className="my-moves">
            <div className="tip-quick">
                <button type="button" className="tip-roll" title="Dexterity + Alert" disabled={busy} onClick={() => go('init')}>
                    INIT <strong>1d6{kit.init < 0 ? '−' + Math.abs(kit.init) : '+' + kit.init}</strong>
                </button>
                {chip('eva', 'EVA', kit.eva, 'Dexterity + Evasion')}
                {chip('clash-s', 'CLASH-S', kit.clashS, 'Strength + Clash')}
                {chip('clash-sp', 'CLASH-SP', kit.clashSp, 'Special + Clash')}
                {kit.pain > 0 && (
                    <span className="tip-pain" title="Half HP or less: −1 success on every roll, −2 at 1 HP. Already taken off rolls made here.">
                        PAIN −{kit.pain}
                    </span>
                )}
            </div>
            {kit.need != null && (
                <div className="tip-action">
                    Action <strong>{kit.need}</strong> · needs <strong>{kit.need}</strong>{' '}
                    {kit.need === 1 ? 'success' : 'successes'}
                </div>
            )}
            {!kit.moves.length ? (
                <div className="tip-empty">
                    {trainer
                        ? 'A trainer has no move list. Your Pokémon carry theirs.'
                        : 'No pinned moves. Pin them on this Pokémon’s card and they show up here.'}
                </div>
            ) : kit.moves.map((m, mi) => {
                const tc = typeColors[m.type] || '#e5e7eb';
                const cc = CAT_COLORS[m.cat] || 'var(--text-secondary)';
                return (
                    <div className="tip-move" key={m.name + mi}>
                        <div className="tip-move-head">
                            <span className="tip-move-name">{m.name}</span>
                            {m.type && (
                                <span className="tip-badge" style={{ color: tc, borderColor: tc + '66', background: tc + '1a' }}>
                                    {m.type}
                                </span>
                            )}
                            {m.cat && (
                                <span className="tip-badge" style={{ color: cc, borderColor: cc + '66', background: cc + '1a' }}>
                                    {m.cat}
                                </span>
                            )}
                        </div>
                        <div className="tip-pools">
                            {m.acc > 0 ? (
                                <button type="button" className="tip-pool acc" disabled={busy}
                                    title={'Roll ' + m.acc + ' dice for accuracy'}
                                    onClick={() => go('acc', mi, m.name)}>
                                    ACC <strong>{m.accText}</strong>
                                </button>
                            ) : <span className="tip-pool acc">ACC <strong>{m.accText}</strong></span>}
                            {m.dmg > 0 ? (
                                <button type="button" className="tip-pool dmg" disabled={busy}
                                    title={'Roll ' + m.dmg + ' dice for damage (2 more straight after a critical hit with this move)'}
                                    onClick={() => go('dmg', mi, m.name)}>
                                    DMG <strong>{m.dmgText}</strong>
                                </button>
                            ) : <span className="tip-pool dmg">DMG <strong>{m.dmgText}</strong></span>}
                            {m.extra && <span className="tip-bonus">{m.extra}</span>}
                        </div>
                        {m.effect && <div className="tip-effect">{m.effect}</div>}
                    </div>
                );
            })}
            {latest && (
                <div className="my-last">
                    <span className="my-last-label">Last roll</span>
                    <RollHistoryEntry entry={latest} sorted={false} withCtx />
                </div>
            )}
        </div>
    );
}
