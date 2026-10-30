import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, ModalClose } from '../common/Modal';
import { FallbackImage } from '../common/FallbackImage';
import { useAppData } from '../../data/AppDataContext';
import { RANKS } from '../../lib/ranks';
import { TYPE_ICONS, typeColors } from '../../lib/themeTables';
import { speciesSpriteChain } from '../../lib/sprites';
import { isLegendary, isMythical, isParadox, isUltraBeast } from '../../gm/generator';
import { HOMEBREW_PLACEHOLDER, TIERS, isHomebrew, newHomebrewId } from '../../data/homebrew';
import type { HomebrewSpecies, SpriteSet, Tier } from '../../data/homebrew';
import { TileSprite } from '../common/TileSprite';
import { Combo, TypePicker } from './HomebrewFields';
import type { AbilityEntry, MoveEntry, PokedexEntry, PokemonEvolution } from '../../data/types';

/* The species editor: every field of a Pokédex entry, from the name and the
   art to the learnset and the evolution chain, plus moves and abilities of the
   species' own.

   It edits a draft and hands it back whole on Save; the caller stores it
   (data/homebrew) and decides what the card does next. */

type Tab = 'dex' | 'attributes' | 'abilities' | 'moves' | 'evolutions';

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'dex', label: 'Pokédex', icon: 'fa-book-open' },
    { id: 'attributes', label: 'Attributes', icon: 'fa-chart-simple' },
    { id: 'abilities', label: 'Abilities', icon: 'fa-star-of-life' },
    { id: 'moves', label: 'Moves', icon: 'fa-hand-fist' },
    { id: 'evolutions', label: 'Evolutions', icon: 'fa-dna' },
];

const ATTRS = [
    { key: 'Strength', max: 'MaxStrength' },
    { key: 'Dexterity', max: 'MaxDexterity' },
    { key: 'Vitality', max: 'MaxVitality' },
    { key: 'Special', max: 'MaxSpecial' },
    { key: 'Insight', max: 'MaxInsight' },
] as const;

const GENDERS = [
    { v: '', label: 'Male or female' },
    { v: 'M', label: 'Male only' },
    { v: 'F', label: 'Female only' },
    { v: 'N', label: 'Genderless' },
] as const;

const EVO_KINDS = ['Level', 'Stone', 'Item', 'Stat', 'Trade', 'Special', 'Form', 'Mega'];
const EVO_SPEEDS = ['Fast', 'Medium', 'Slow', 'Unknown'];
const EVO_STATS = ['Happiness', 'Loyalty', 'Strength', 'Dexterity', 'Vitality', 'Special', 'Insight',
    'Tough', 'Cool', 'Beauty', 'Cute', 'Clever'];

const MOVE_CATEGORIES = ['Physical', 'Special', 'Support'];
const DAMAGE_POOLS = ['', 'Strength', 'Special', 'Dexterity', 'Vitality', 'Insight'];
const ACC_ATTRS = ['', 'Strength', 'Dexterity', 'Vitality', 'Special', 'Insight',
    'Tough', 'Cool', 'Beauty', 'Cute', 'Clever', 'Will'];
const ACC_SKILLS = ['', 'Brawl', 'Channel', 'Clash', 'Evasion', 'Alert', 'Athletic', 'Nature', 'Stealth',
    'Charm', 'Empathy', 'Intimidate', 'Perform', 'Craft', 'Etiquette', 'Medicine', 'Science'];
const TARGETS = ['Foe', 'Random Foe', 'All Foes', 'Self', 'Ally', 'All Allies', 'Area', 'Battlefield',
    "Foe's Battlefield", "Ally's Battlefield"];

const ART_SETS: { k: SpriteSet; label: string; folder: string }[] = [
    { k: 'Home', label: 'Home', folder: 'HomeSprites' },
    { k: 'Book', label: 'Book', folder: 'BookSprites' },
    { k: 'Box', label: 'Box', folder: 'BoxSprites' },
    { k: 'Shuffle', label: 'Token', folder: 'ShuffleTokens' },
];

/** The kind of special an official species is, for a copy of it. */
function tierOf(p: PokedexEntry): Tier {
    if (isHomebrew(p)) return p.Tier || '';
    if (isParadox(p)) return 'paradox';
    if (isUltraBeast(p)) return 'ultrabeast';
    if (isMythical(p)) return 'mythical';
    if (isLegendary(p) || p.Legendary) return 'legendary';
    return '';
}

/** The longest side of uploaded art, in px. The art lives in localStorage
    and in every file that uses the species, so it is kept small. */
const ART_SIDE = 256;

export function blankSpecies(): HomebrewSpecies {
    const _id = newHomebrewId();
    return {
        Homebrew: true, _id, Image: _id + '.png', Number: 0, DexID: '', Name: '',
        Type1: '', Type2: '', BaseHP: 4,
        Strength: 2, MaxStrength: 4, Dexterity: 2, MaxDexterity: 4, Vitality: 2, MaxVitality: 4,
        Special: 2, MaxSpecial: 4, Insight: 2, MaxInsight: 4,
        Ability1: '', Ability2: '', HiddenAbility: '', EventAbilities: '',
        RecommendedRank: 'Starter', GenderType: '', Legendary: false, Tier: '', GoodStarter: false,
        Arts: {},
        DexCategory: '', Height: {}, Weight: {}, DexDescription: '',
        Evolutions: [], Moves: [], HomebrewMoves: [], HomebrewAbilities: [], Updated: 0,
    };
}

/** A draft that starts as a copy of `src`. A copy of an official species
    borrows its sprites; a copy of a homebrew keeps its art and its own moves.
    `keepId` is for editing the species itself rather than copying it. */
export function speciesDraft(src: PokedexEntry, keepId = false): HomebrewSpecies {
    const clone: PokedexEntry = JSON.parse(JSON.stringify(src));
    const base = blankSpecies();
    const own = isHomebrew(clone);
    return {
        ...clone,
        Homebrew: true,
        _id: keepId ? clone._id : base._id,
        Image: keepId ? clone.Image : base.Image,
        Number: 0,
        Name: keepId ? clone.Name : (own ? clone.Name + ' (copy)' : clone.Name + ' (Homebrew)'),
        Arts: own ? { ...((clone as HomebrewSpecies).Arts || {}) } : {},
        Tier: tierOf(src),
        SpriteOf: own ? (clone as HomebrewSpecies).SpriteOf : clone.Image,
        HomebrewMoves: own ? ((clone as HomebrewSpecies).HomebrewMoves || []) : [],
        HomebrewAbilities: own ? ((clone as HomebrewSpecies).HomebrewAbilities || []) : [],
        Updated: 0,
    };
}

/** Downscale a picked image to a data URL, WebP where the browser makes one. */
function readArt(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, ART_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(1, Math.round(img.naturalWidth * k));
            const h = Math.max(1, Math.round(img.naturalHeight * k));
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d')!.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            const webp = c.toDataURL('image/webp', 0.9);
            resolve(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png'));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a picture this browser can read.')); };
        img.src = url;
    });
}

/** A number field that lets the text be half-typed ("", "-") without the
    value snapping back under the caret. */
function NumField({ value, onChange, min, max, step = 1, id }: {
    value: number; onChange: (n: number) => void; min: number; max: number; step?: number; id?: string;
}) {
    const [text, setText] = useState(String(value));
    useEffect(() => {
        if (parseFloat(text) !== value) setText(String(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
    return (
        <input
            type="number" inputMode="decimal" className="move-edit-input hb-num" id={id}
            min={min} max={max} step={step}
            value={text}
            onChange={(e) => {
                const t = e.currentTarget.value;
                setText(t);
                const n = parseFloat(t);
                if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
            }}
            onBlur={() => setText(String(value))}
        />
    );
}

function Field({ label, children, span, hint }: { label: string; children: ReactNode; span?: boolean; hint?: ReactNode }) {
    return (
        <label className={'move-edit-field' + (span ? ' span-2' : '')}>
            <span className="move-edit-label">{label}</span>
            {children}
            {hint && <span className="move-edit-hint">{hint}</span>}
        </label>
    );
}

function TypeChip({ type }: { type: string }) {
    if (!type) return null;
    return (
        <span className="hb-type-chip" style={{ background: typeColors[type] || '#6b7280' }}>
            <i className={'fa-solid ' + (TYPE_ICONS[type] || 'fa-circle')}></i> {type}
        </span>
    );
}

function Select({ value, options, onChange, id, labels }: {
    value: string; options: readonly string[]; onChange: (v: string) => void; id?: string;
    labels?: Record<string, string>;
}) {
    /* A value from a file that the list lacks stays selectable as itself. */
    const all = options.includes(value) ? options : [...options, value];
    return (
        <select className="move-edit-input" id={id} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
            {all.map((o) => <option key={o} value={o}>{labels?.[o] ?? (o || 'None')}</option>)}
        </select>
    );
}

/** Everything that stops the draft being saved, in words. */
function problemsOf(d: HomebrewSpecies, all: PokedexEntry[], moves: MoveEntry[], abilities: AbilityEntry[]): string[] {
    const out: string[] = [];
    const name = d.Name.trim();
    if (!name) out.push('Give the species a name (Pokédex tab).');
    else if (all.some((p) => p._id !== d._id && p.Name.toLowerCase() === name.toLowerCase())) {
        out.push('Another species is already called "' + name + '". Every species needs a name of its own: evolutions find each other by name.');
    }
    if (!d.Type1) out.push('Pick a type (Pokédex tab).');
    ATTRS.forEach((a) => {
        if ((d[a.key] as number) > (d[a.max] as number)) out.push(a.key + ': the base is above the limit (Attributes tab).');
    });
    const ownMoves = d.HomebrewMoves || [];
    ownMoves.forEach((m, i) => {
        if (!m.Name.trim()) out.push('A move of your own has no name (Moves tab).');
        else if (moves.some((x) => !x.Homebrew && x.Name.toLowerCase() === m.Name.trim().toLowerCase())) {
            out.push('"' + m.Name + '" is already an official move: name yours differently.');
        } else if (ownMoves.findIndex((x) => x.Name.trim().toLowerCase() === m.Name.trim().toLowerCase()) !== i) {
            out.push('Two of your moves are called "' + m.Name + '".');
        }
    });
    const ownAbilities = d.HomebrewAbilities || [];
    ownAbilities.forEach((a, i) => {
        if (!a.Name.trim()) out.push('An ability of your own has no name (Abilities tab).');
        else if (abilities.some((x) => !x.Homebrew && x.Name.toLowerCase() === a.Name.trim().toLowerCase())) {
            out.push('"' + a.Name + '" is already an official ability: name yours differently.');
        } else if (ownAbilities.findIndex((x) => x.Name.trim().toLowerCase() === a.Name.trim().toLowerCase()) !== i) {
            out.push('Two of your abilities are called "' + a.Name + '".');
        }
    });
    d.Evolutions.forEach((e) => {
        if (!(e.To || e.From || '').trim()) out.push('An evolution has no species (Evolutions tab).');
    });
    return out;
}

export function HomebrewEditor({ initial, title, note, isNew, onSave, onClose }: {
    initial: HomebrewSpecies;
    title: string;
    /** A line under the title saying what Save will do. */
    note?: string;
    /** A new species can be started from a copy of another. */
    isNew: boolean;
    onSave: (d: HomebrewSpecies) => void;
    onClose: () => void;
}) {
    const { data } = useAppData();
    const [d, setD] = useState<HomebrewSpecies>(initial);
    const [tab, setTab] = useState<Tab>('dex');
    /* Listed from the first Save on, and kept current as they are fixed. */
    const [tried, setTried] = useState(false);
    const up = (patch: Partial<HomebrewSpecies>) => setD((x) => ({ ...x, ...patch }));

    const official = useMemo(() => data.pokemon.filter((p) => !isHomebrew(p)), [data.pokemon]);
    const species = useMemo(() => data.pokemon.filter((p) => p._id !== d._id), [data.pokemon, d._id]);
    const moveNames = useMemo(() => {
        const names = new Set(data.moves.map((m) => m.Name));
        (d.HomebrewMoves || []).forEach((m) => names.add(m.Name));
        return [...names].sort();
    }, [data.moves, d.HomebrewMoves]);
    const abilityNames = useMemo(() => {
        const names = new Set(data.abilities.map((a) => a.Name));
        (d.HomebrewAbilities || []).forEach((a) => names.add(a.Name));
        return [...names].sort();
    }, [data.abilities, d.HomebrewAbilities]);

    const problems = useMemo(() => tried ? problemsOf(d, data.pokemon, data.moves, data.abilities) : [],
        [tried, d, data.pokemon, data.moves, data.abilities]);

    const save = () => {
        setTried(true);
        if (problemsOf(d, data.pokemon, data.moves, data.abilities).length) return;
        onSave({ ...d, Name: d.Name.trim() });
    };

    return (
        <Modal open onClose={onClose} boxClassName="move-edit-box hb-box" id="homebrew-editor">
            <ModalClose onClick={onClose} />
            <div className="modal-title" style={{ color: 'var(--text-primary)' }}>
                <i className="fa-solid fa-flask" style={{ color: 'var(--ghost-color)' }}></i> {title}
            </div>
            {note && <p className="hb-note">{note}</p>}

            {isNew && <StartFrom all={species} onPick={(p) => setD((x) => ({ ...speciesDraft(p), _id: x._id, Image: x.Image }))} />}

            <div className="hb-tabs" role="tablist">
                {TABS.map((t) => (
                    <button
                        key={t.id} type="button" role="tab" data-hb-tab={t.id}
                        className={'hb-tab' + (tab === t.id ? ' active' : '')}
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                    >
                        <i className={'fa-solid ' + t.icon}></i> {t.label}
                    </button>
                ))}
            </div>

            <div className="hb-body">
                {tab === 'dex' && <DexTab d={d} up={up} setD={setD} official={official} />}
                {tab === 'attributes' && <AttributesTab d={d} up={up} />}
                {tab === 'abilities' && <AbilitiesTab d={d} up={up} abilities={data.abilities} names={abilityNames} />}
                {tab === 'moves' && <MovesTab d={d} up={up} moves={data.moves} names={moveNames} />}
                {tab === 'evolutions' && <EvolutionsTab d={d} up={up} all={species} />}
            </div>

            {problems.length > 0 && (
                <ul className="hb-problems" id="hb-problems">
                    {problems.map((p) => <li key={p}><i className="fa-solid fa-triangle-exclamation"></i> {p}</li>)}
                </ul>
            )}

            <div className="modal-actions">
                <button className="form-btn cancel" onClick={onClose}>Cancel</button>
                <button className="form-btn save" id="hb-save" onClick={save}>Save species</button>
            </div>
        </Modal>
    );
}

function StartFrom({ all, onPick }: { all: PokedexEntry[]; onPick: (p: PokedexEntry) => void }) {
    const [text, setText] = useState('');
    const hit = all.find((p) => p.Name.toLowerCase() === text.trim().toLowerCase());
    return (
        <div className="hb-start-from">
            <span className="move-edit-label">Start from a copy of</span>
            <SpeciesCombo
                id="hb-start-from" all={all} value={text} onChange={setText}
                placeholder="Any species (optional)…"
                onEnter={() => { if (hit) { onPick(hit); setText(''); } }}
            />
            <button
                type="button" className="form-btn reset" disabled={!hit}
                onClick={() => { if (hit) { onPick(hit); setText(''); } }}
            >
                <i className="fa-solid fa-copy"></i> Copy
            </button>
        </div>
    );
}

type Up = (patch: Partial<HomebrewSpecies>) => void;

/** A species field: names with their sprites. */
function SpeciesCombo({ all, ...rest }: {
    all: PokedexEntry[]; id?: string; className?: string; value: string; onChange: (v: string) => void;
    placeholder?: string; onEnter?: () => void;
}) {
    const names = useMemo(() => all.map((p) => p.Name), [all]);
    const byName = useMemo(() => new Map(all.map((p) => [p.Name, p])), [all]);
    return (
        <Combo
            {...rest}
            options={names}
            renderOption={(n) => (
                <>
                    <TileSprite image={byName.get(n)?.Image || ''} />
                    <span className="item-suggestion-name">{n}</span>
                </>
            )}
        />
    );
}

function DexTab({ d, up, setD, official }: {
    d: HomebrewSpecies; up: Up; setD: (f: (x: HomebrewSpecies) => HomebrewSpecies) => void; official: PokedexEntry[];
}) {
    const [artError, setArtError] = useState('');
    const borrowedName = d.SpriteOf ? (official.find((p) => p.Image === d.SpriteOf)?.Name ?? '') : '';
    const [borrow, setBorrow] = useState(borrowedName);

    const arts = d.Arts || {};
    const firstArt = ART_SETS.map((a) => arts[a.k]).find(Boolean);
    const meters = d.Height?.Meters ?? 0;
    const kilos = d.Weight?.Kilograms ?? 0;
    const types = [d.Type1, d.Type2].filter(Boolean);

    return (
        <div className="hb-dex">
            <div className="hb-art">
                {/* One picture per sprite set. A set left empty shows the
                    borrowed species' sprite for it, else another set's art. */}
                <div className="hb-art-sets">
                    {ART_SETS.map(({ k, label, folder }) => {
                        const own = arts[k];
                        const preview = own ? [own]
                            : d.SpriteOf ? speciesSpriteChain(d.SpriteOf, folder) : [firstArt || HOMEBREW_PLACEHOLDER];
                        return (
                            <div className={'hb-art-slot' + (own ? ' own' : ' borrowed')} key={k} data-art-set={k}>
                                <div className="hb-art-well">
                                    <FallbackImage candidates={preview} loading="eager" alt={label} />
                                </div>
                                <div className="hb-art-foot">
                                    <span className="hb-art-label">{label}</span>
                                    <label className="hb-icon-btn" title={(own ? 'Change the ' : 'Upload a ') + label + ' picture'}>
                                        <i className="fa-solid fa-upload"></i>
                                        <input
                                            type="file" accept="image/*" data-art-input={k} style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const file = e.currentTarget.files?.[0];
                                                e.currentTarget.value = '';
                                                if (!file) return;
                                                try {
                                                    const art = await readArt(file);
                                                    setD((x) => ({ ...x, Arts: { ...(x.Arts || {}), [k]: art } }));
                                                    setArtError('');
                                                } catch (err) { setArtError((err as Error).message); }
                                            }}
                                        />
                                    </label>
                                    {own && (
                                        <button
                                            type="button" className="hb-icon-btn danger" title={'Remove the ' + label + ' picture'}
                                            onClick={() => { const next = { ...arts }; delete next[k]; up({ Arts: next }); }}
                                        >
                                            <i className="fa-solid fa-trash-can"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {artError && <span className="hb-error">{artError}</span>}
                <label className="move-edit-field">
                    <span className="move-edit-label">Empty sets use the sprites of</span>
                    <SpeciesCombo
                        id="hb-sprite-of" all={official} placeholder="An official species…"
                        value={borrow}
                        onChange={(t) => {
                            setBorrow(t);
                            const p = official.find((x) => x.Name.toLowerCase() === t.trim().toLowerCase());
                            if (p) up({ SpriteOf: p.Image });
                            else if (!t.trim()) up({ SpriteOf: undefined });
                        }}
                    />
                </label>
            </div>

            <div className="move-edit-grid hb-grid">
                <Field label="Name" span>
                    <input
                        className="move-edit-input" id="hb-name" placeholder="e.g. Emberling"
                        value={d.Name} onChange={(e) => up({ Name: e.currentTarget.value })}
                    />
                </Field>
                <Field label="Dex number">
                    <input
                        className="move-edit-input" id="hb-dexid" placeholder="e.g. H001"
                        value={d.DexID} onChange={(e) => up({ DexID: e.currentTarget.value })}
                    />
                </Field>
                <Field label="Category">
                    <input
                        className="move-edit-input" id="hb-category" placeholder="e.g. Ember Pokémon"
                        value={d.DexCategory} onChange={(e) => up({ DexCategory: e.currentTarget.value })}
                    />
                </Field>
                <div className="move-edit-field span-2">
                    <span className="move-edit-label hb-types-head">
                        Type
                        <span className="hb-types-now">
                            {types.map((t) => <TypeChip key={t} type={t} />)}
                            {types.length === 2 && (
                                <button type="button" className="hb-icon-btn hb-swap" id="hb-type-swap"
                                    title="Swap the two: the first one themes the card"
                                    onClick={() => up({ Type1: d.Type2, Type2: d.Type1 })}>
                                    <i className="fa-solid fa-right-left"></i>
                                </button>
                            )}
                        </span>
                    </span>
                    <TypePicker
                        id="hb-types" value={types} max={2}
                        onChange={(t) => up({ Type1: t[0] || '', Type2: t[1] || '' })}
                    />
                    <span className="move-edit-hint">Press one type, or two. The first is the main one.</span>
                </div>
                <Field label="Gender">
                    <Select
                        id="hb-gender" value={d.GenderType} options={GENDERS.map((g) => g.v)}
                        labels={Object.fromEntries(GENDERS.map((g) => [g.v, g.label]))}
                        onChange={(v) => up({ GenderType: v })}
                    />
                </Field>
                <Field label="Recommended rank">
                    <Select id="hb-rank" value={d.RecommendedRank} options={RANKS} onChange={(v) => up({ RecommendedRank: v })} />
                </Field>
                <Field label="Height (m)">
                    <NumField
                        value={meters} min={0} max={999} step={0.1}
                        onChange={(n) => up({ Height: n ? { Meters: n, Feet: Math.round(n * 32.8084) / 10 } : {} })}
                    />
                </Field>
                <Field label="Weight (kg)">
                    <NumField
                        value={kilos} min={0} max={99999} step={0.1}
                        onChange={(n) => up({ Weight: n ? { Kilograms: n, Pounds: Math.round(n * 22.0462) / 10 } : {} })}
                    />
                </Field>
                <div className="move-edit-field span-2">
                    <span className="move-edit-label">Kind of Pokémon</span>
                    {/* One at a time; clearing the one on goes back to Normal. */}
                    <div className="hb-tiers" id="hb-tiers">
                        {TIERS.map((t) => {
                            const on = (d.Tier || '') === t.v;
                            return (
                                <label className={'hb-check hb-tier' + (on ? ' on' : '')} key={t.v || 'normal'}>
                                    <input
                                        type="checkbox" data-tier={t.v || 'normal'} checked={on}
                                        onChange={() => {
                                            const next: Tier = on ? '' : t.v;
                                            up({ Tier: next, Legendary: next !== '' });
                                        }}
                                    />
                                    {t.label}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <Field label="Pokédex entry" span>
                    <textarea
                        className="move-edit-textarea" id="hb-description"
                        placeholder="Where it lives, how it behaves…"
                        value={d.DexDescription} onChange={(e) => up({ DexDescription: e.currentTarget.value })}
                    />
                </Field>
            </div>
        </div>
    );
}

function AttributesTab({ d, up }: { d: HomebrewSpecies; up: Up }) {
    const total = ATTRS.reduce((n, a) => n + (d[a.key] as number), 0);
    return (
        <div className="hb-attrs">
            <div className="hb-attr-row hb-attr-head">
                <span>Attribute</span><span>Base</span><span>Limit</span>
            </div>
            {ATTRS.map((a) => (
                <div className="hb-attr-row" key={a.key}>
                    <span className="hb-attr-name">{a.key}</span>
                    <NumField id={'hb-' + a.key.toLowerCase()} value={d[a.key] as number} min={0} max={12}
                        onChange={(n) => up({ [a.key]: n } as Partial<HomebrewSpecies>)} />
                    <NumField id={'hb-max-' + a.key.toLowerCase()} value={d[a.max] as number} min={1} max={12}
                        onChange={(n) => up({ [a.max]: n } as Partial<HomebrewSpecies>)} />
                </div>
            ))}
            <div className="hb-attr-row">
                <span className="hb-attr-name">Base HP</span>
                <NumField id="hb-basehp" value={d.BaseHP} min={1} max={20} onChange={(n) => up({ BaseHP: n })} />
                <span className="hb-attr-note">HP = Base HP + Vitality</span>
            </div>
            <p className="hb-hint">
                Base attributes total {total}. The card adds the points a Pokémon earns on top of the base,
                up to the limit. Social attributes start at 0 with a limit of 5 on every Pokémon.
            </p>
        </div>
    );
}

function AbilitiesTab({ d, up, abilities, names }: {
    d: HomebrewSpecies; up: Up; abilities: AbilityEntry[]; names: string[];
}) {
    const own = d.HomebrewAbilities || [];
    const effectOf = (name: string) => (own.find((a) => a.Name === name) || abilities.find((a) => a.Name === name))?.Effect || '';
    const slots = [
        { k: 'Ability1', label: 'Ability' },
        { k: 'Ability2', label: 'Second ability' },
        { k: 'HiddenAbility', label: 'Hidden ability' },
        { k: 'EventAbilities', label: 'Event ability' },
    ] as const;

    const setOwn = (i: number, patch: Partial<AbilityEntry>) => {
        const next = own.map((a, j) => j === i ? { ...a, ...patch } : a);
        const changes: Partial<HomebrewSpecies> = { HomebrewAbilities: next };
        /* A renamed ability stays in the slots that held it. */
        if (patch.Name !== undefined) {
            slots.forEach((s) => { if (d[s.k] === own[i].Name) (changes as Record<string, string>)[s.k] = patch.Name!; });
        }
        up(changes);
    };

    return (
        <div className="hb-abilities">
            <div className="move-edit-grid">
                {slots.map((s) => {
                    const v = d[s.k];
                    const effect = v ? effectOf(v) : '';
                    return (
                        <Field key={s.k} label={s.label} hint={v && !effect && !names.includes(v)
                            ? <span className="hb-error">No ability by that name yet</span> : effect}>
                            <Combo
                                id={'hb-' + s.k.toLowerCase()} placeholder="None" value={v} options={names}
                                titleOf={(n) => { const e = effectOf(n); return e ? n + '\n' + e : undefined; }}
                                onChange={(t) => up({ [s.k]: t } as Partial<HomebrewSpecies>)}
                            />
                        </Field>
                    );
                })}
            </div>

            <div className="hb-section-head">
                <span>Abilities of its own</span>
                <button
                    type="button" className="form-btn reset" id="hb-add-ability"
                    onClick={() => up({ HomebrewAbilities: [...own, { Name: '', Effect: '', Description: '', Homebrew: true }] })}
                >
                    <i className="fa-solid fa-plus"></i> New ability
                </button>
            </div>
            {!own.length && <p className="hb-hint">An ability made here joins the list above, and any Pokémon can be given it.</p>}
            {own.map((a, i) => (
                <div className="hb-own" key={i}>
                    <div className="move-edit-grid">
                        <Field label="Name" span>
                            <input className="move-edit-input hb-own-ability-name" value={a.Name}
                                onChange={(e) => setOwn(i, { Name: e.currentTarget.value })} />
                        </Field>
                        <Field label="Effect" span>
                            <textarea className="move-edit-textarea" value={a.Effect}
                                onChange={(e) => setOwn(i, { Effect: e.currentTarget.value })} />
                        </Field>
                        <Field label="Description" span>
                            <input className="move-edit-input" value={a.Description}
                                onChange={(e) => setOwn(i, { Description: e.currentTarget.value })} />
                        </Field>
                    </div>
                    <button type="button" className="hb-remove" aria-label="Delete this ability"
                        onClick={() => up({ HomebrewAbilities: own.filter((_, j) => j !== i) })}>
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            ))}
        </div>
    );
}

function MovesTab({ d, up, moves, names }: { d: HomebrewSpecies; up: Up; moves: MoveEntry[]; names: string[] }) {
    const own = d.HomebrewMoves || [];
    const [adding, setAdding] = useState('');
    const [addRank, setAddRank] = useState<string>('Starter');
    const [error, setError] = useState('');

    const find = (name: string): MoveEntry | undefined => {
        const q = name.trim().toLowerCase();
        return own.find((m) => m.Name.toLowerCase() === q) || moves.find((m) => m.Name.toLowerCase() === q);
    };

    const add = () => {
        const m = find(adding);
        if (!m) { setError('No move called "' + adding.trim() + '". Make it below as a move of its own.'); return; }
        if (d.Moves.some((x) => x.Name === m.Name)) { setError(m.Name + ' is already in the list.'); return; }
        up({ Moves: [...d.Moves, { Learned: addRank, Name: m.Name }] });
        setAdding(''); setError('');
    };

    const setOwn = (i: number, patch: Partial<MoveEntry>) => {
        const old = own[i].Name;
        const next = own.map((m, j) => j === i ? { ...m, ...patch } : m);
        const changes: Partial<HomebrewSpecies> = { HomebrewMoves: next };
        if (patch.Name !== undefined) {
            changes.Moves = d.Moves.map((x) => x.Name === old ? { ...x, Name: patch.Name } : x);
        }
        up(changes);
    };

    const newMove = () => {
        let n = 1;
        while (own.some((m) => m.Name === 'New Move ' + n) || moves.some((m) => m.Name === 'New Move ' + n)) n++;
        const m: MoveEntry = {
            Name: 'New Move ' + n, Type: d.Type1 || 'Normal', Power: 2, Category: 'Physical',
            Damage1: 'Strength', Damage2: '', Accuracy1: 'Dexterity', Accuracy2: 'Brawl',
            Target: 'Foe', Effect: '', Description: '', Homebrew: true,
        };
        up({ HomebrewMoves: [...own, m], Moves: [...d.Moves, { Learned: addRank, Name: m.Name }] });
    };

    const byRank = RANKS.map((r) => ({ rank: r as string, list: d.Moves.filter((m) => m.Learned === r) }));
    const odd = d.Moves.filter((m) => !(RANKS as readonly string[]).includes(String(m.Learned)));
    if (odd.length) byRank.push({ rank: 'Other', list: odd });

    return (
        <div className="hb-moves">
            <div className="hb-add-move">
                <Combo
                    id="hb-move-add" placeholder="Add a move to the learnset…"
                    value={adding} options={names}
                    renderOption={(n) => {
                        const m = find(n);
                        return (
                            <>
                                <span className="item-suggestion-name">{n}</span>
                                {m && <TypeChip type={m.Type} />}
                            </>
                        );
                    }}
                    onChange={(t) => { setAdding(t); setError(''); }}
                    onEnter={add}
                />
                <Select id="hb-move-rank" value={addRank} options={RANKS} onChange={setAddRank} />
                <button type="button" className="form-btn save" id="hb-move-add-btn" onClick={add} disabled={!adding.trim()}>
                    <i className="fa-solid fa-plus"></i> Add
                </button>
            </div>
            {error && <span className="hb-error">{error}</span>}

            {!d.Moves.length && <p className="hb-hint">No moves yet. Each one is learned at a rank, as in the Pokédex.</p>}
            {byRank.filter((g) => g.list.length).map((g) => (
                <div className="hb-rank-group" key={g.rank}>
                    <div className="hb-rank-head">{g.rank}</div>
                    {g.list.map((lm) => {
                        const m = find(String(lm.Name));
                        return (
                            <div className="hb-move-row" key={String(lm.Name)} data-move={String(lm.Name)}>
                                <span className="hb-move-name">{lm.Name}</span>
                                {m ? <TypeChip type={m.Type} /> : <span className="hb-error">unknown move</span>}
                                <span className="hb-move-power">{m && m.Power ? 'Power ' + m.Power : ''}</span>
                                <Select
                                    value={String(lm.Learned)} options={RANKS}
                                    onChange={(v) => up({ Moves: d.Moves.map((x) => x === lm ? { ...x, Learned: v } : x) })}
                                />
                                <button type="button" className="hb-remove" aria-label={'Remove ' + lm.Name}
                                    onClick={() => up({ Moves: d.Moves.filter((x) => x !== lm) })}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        );
                    })}
                </div>
            ))}

            <div className="hb-section-head">
                <span>Moves of its own</span>
                <button type="button" className="form-btn reset" id="hb-new-move" onClick={newMove}>
                    <i className="fa-solid fa-plus"></i> New move
                </button>
            </div>
            {!own.length && (
                <p className="hb-hint">
                    A move made here is added to the learnset at the rank chosen above, and joins the move list
                    any Pokémon can add.
                </p>
            )}
            {own.map((m, i) => (
                <div className="hb-own" key={i}>
                    <div className="move-edit-grid hb-grid-3">
                        <Field label="Name" span>
                            <input className="move-edit-input hb-own-move-name" value={m.Name}
                                onChange={(e) => setOwn(i, { Name: e.currentTarget.value })} />
                        </Field>
                        <div className="move-edit-field span-2">
                            <span className="move-edit-label">Type</span>
                            <TypePicker value={[m.Type]} max={1} onChange={(t) => setOwn(i, { Type: t[0] })} />
                        </div>
                        <Field label="Category">
                            <Select value={m.Category || 'Support'} options={MOVE_CATEGORIES} onChange={(v) => setOwn(i, { Category: v })} />
                        </Field>
                        <Field label="Power">
                            <NumField value={m.Power || 0} min={0} max={20} onChange={(n) => setOwn(i, { Power: n })} />
                        </Field>
                        <Field label="Damage pool">
                            <Select value={m.Damage1 || ''} options={DAMAGE_POOLS} onChange={(v) => setOwn(i, { Damage1: v })} />
                        </Field>
                        <Field label="Accuracy: attribute">
                            <Select value={m.Accuracy1 || ''} options={ACC_ATTRS} onChange={(v) => setOwn(i, { Accuracy1: v })} />
                        </Field>
                        <Field label="Accuracy: specialty">
                            <Select value={m.Accuracy2 || ''} options={ACC_SKILLS} onChange={(v) => setOwn(i, { Accuracy2: v })} />
                        </Field>
                        <Field label="Target">
                            <Select value={m.Target || 'Foe'} options={TARGETS} onChange={(v) => setOwn(i, { Target: v })} />
                        </Field>
                        <Field label="Effect" span>
                            <textarea className="move-edit-textarea" value={m.Effect}
                                placeholder="e.g. Single Target. Roll 2 Chance Dice to inflict a Burn."
                                onChange={(e) => setOwn(i, { Effect: e.currentTarget.value })} />
                        </Field>
                        <Field label="Description" span>
                            <input className="move-edit-input" value={String(m.Description || '')}
                                onChange={(e) => setOwn(i, { Description: e.currentTarget.value })} />
                        </Field>
                    </div>
                    <button type="button" className="hb-remove" aria-label="Delete this move"
                        onClick={() => up({
                            HomebrewMoves: own.filter((_, j) => j !== i),
                            Moves: d.Moves.filter((x) => x.Name !== m.Name),
                        })}>
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            ))}
        </div>
    );
}

function EvolutionsTab({ d, up, all }: { d: HomebrewSpecies; up: Up; all: PokedexEntry[] }) {
    const set = (i: number, next: PokemonEvolution) => up({ Evolutions: d.Evolutions.map((e, j) => j === i ? next : e) });
    const others = all.filter((p) => p._id !== d._id);
    return (
        <div className="hb-evos">
            <p className="hb-hint">
                Evolutions find their species by name, official or homebrew. One not made yet links up as soon as
                a species with that name exists. A Mega form says so with "Evolves from" and the Mega kind.
            </p>
            {d.Evolutions.map((e, i) => {
                const dir = e.From ? 'From' : 'To';
                const name = e.To || e.From || '';
                const known = !name || others.some((p) => p.Name === name);
                const kind = e.Kind || 'Level';
                const field = (k: keyof PokemonEvolution, label: string, placeholder = '') => (
                    <Field label={label}>
                        <input className="move-edit-input" placeholder={placeholder} value={String(e[k] ?? '')}
                            onChange={(ev) => { const v = ev.currentTarget.value; set(i, { ...e, [k]: v || undefined }); }} />
                    </Field>
                );
                return (
                    <div className="hb-own hb-evo" key={i}>
                        <div className="move-edit-grid hb-grid-3">
                            <Field label="Direction">
                                <Select
                                    value={dir} options={['To', 'From']}
                                    labels={{ To: 'Evolves into', From: 'Evolves from' }}
                                    onChange={(v) => {
                                        const next = { ...e };
                                        delete next.To; delete next.From;
                                        set(i, { ...next, [v]: name });
                                    }}
                                />
                            </Field>
                            <Field label="Species" hint={known ? '' : <span className="hb-error">Not in the Pokédex yet</span>}>
                                <SpeciesCombo className="hb-evo-species" all={all} value={name}
                                    onChange={(t) => set(i, { ...e, [dir]: t })} />
                            </Field>
                            <Field label="How">
                                <Select value={kind} options={EVO_KINDS} onChange={(v) => set(i, { ...e, Kind: v })} />
                            </Field>
                            {kind === 'Level' && (
                                <Field label="Speed">
                                    <Select value={e.Speed || 'Medium'} options={EVO_SPEEDS} onChange={(v) => set(i, { ...e, Speed: v })} />
                                </Field>
                            )}
                            {(kind === 'Stone' || kind === 'Item' || kind === 'Trade' || kind === 'Mega')
                                && field('Item', kind === 'Mega' ? 'Mega stone' : kind === 'Trade' ? 'Holding (optional)' : kind,
                                    kind === 'Stone' ? 'e.g. Fire Stone' : kind === 'Mega' ? 'e.g. Emberite' : '')}
                            {(kind === 'Stat' || kind === 'Special') && (
                                <>
                                    <Field label="Stat">
                                        <Select value={e.Stat || ''} options={['', ...EVO_STATS]} onChange={(v) => set(i, { ...e, Stat: v || undefined })} />
                                    </Field>
                                    <Field label="Value">
                                        <NumField value={e.Value ?? 0} min={0} max={10} onChange={(n) => set(i, { ...e, Value: n || undefined })} />
                                    </Field>
                                </>
                            )}
                            {(kind === 'Special' || kind === 'Form') && field('Special', 'Condition', 'e.g. Sunlight')}
                            {(kind === 'Level' || kind === 'Special') && field('Move', 'Knows move (optional)')}
                            <Field label="Gender">
                                <Select value={e.Gender || ''} options={['', 'Male', 'Female']} labels={{ '': 'Any' }}
                                    onChange={(v) => set(i, { ...e, Gender: v || undefined })} />
                            </Field>
                        </div>
                        <button type="button" className="hb-remove" aria-label="Delete this evolution"
                            onClick={() => up({ Evolutions: d.Evolutions.filter((_, j) => j !== i) })}>
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                );
            })}
            <button
                type="button" className="form-btn reset hb-add-evo" id="hb-add-evo"
                onClick={() => up({ Evolutions: [...d.Evolutions, { To: '', Kind: 'Level', Speed: 'Medium' }] })}
            >
                <i className="fa-solid fa-plus"></i> Add an evolution
            </button>
        </div>
    );
}
