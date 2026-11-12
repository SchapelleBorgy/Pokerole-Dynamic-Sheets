import { IMG_BASE } from './paths';
import type {
    AbilityEntry, AppData, Measure, MoveEntry, PokedexEntry, PokemonEvolution, PokemonLearnedMove,
} from './types';

/* Homebrew species: Pokémon made from scratch on the card, kept beside the
   generated Pokédex rather than in it.

   Every page looks species up in `data.pokemon` by id or by name, so a
   homebrew species is simply put INTO that list (and its own moves and
   abilities into theirs) once the bundles have loaded. Nothing downstream —
   the License, the GM screen, the table, the generator's pickers — needs to
   know the difference.

   Where they live:
     - this browser: localStorage under HOMEBREW_KEY, the whole library;
     - a file: every trainer .json and wild .json carries the definitions of
       the homebrew species it uses (`homebrewSpecies`), so a sheet opened in
       another browser still knows what it is. Loading such a file adopts them
       into the library; the newer copy (by `Updated`) wins.

   The art is a downscaled data URL per sprite set (Home, Book, Box, Token)
   in the definition itself; a set left empty borrows that set from an
   official species (`SpriteOf`) — a regional variant keeps the look of the
   species it came from — or else shows another set's art. */

export const HOMEBREW_KEY = 'pokerole_homebrew';
/** Marks an exported homebrew file, as the trainer and wild files are marked. */
export const HOMEBREW_MARKER = '_pokeroleHomebrew';
/** The field a trainer or wild file carries its homebrew definitions in. */
export const HOMEBREW_FIELD = 'homebrewSpecies';

const ID_RE = /^hb-[a-z0-9-]{4,40}$/;
const ART_RE = /^data:image\/(png|webp|jpeg|gif);base64,[A-Za-z0-9+/=]+$/;
/** A pokeball, for a homebrew with neither art of its own nor a sprite to borrow. */
export const HOMEBREW_PLACEHOLDER = IMG_BASE + 'ItemSprites/pokeball.png';

/** The card's sprite sets; `Shuffle` is the Token tab. */
export const SPRITE_SETS = ['Home', 'Book', 'Box', 'Shuffle'] as const;
export type SpriteSet = typeof SPRITE_SETS[number];

/** What the Legendary flag cannot say: which kind of special it is. One at a
    time, as the official lists have them. */
export const TIERS = [
    { v: '', label: 'Normal' },
    { v: 'legendary', label: 'Legendary' },
    { v: 'mythical', label: 'Mythical' },
    { v: 'ultrabeast', label: 'Ultra Beast' },
    { v: 'paradox', label: 'Paradox' },
] as const;
export type Tier = typeof TIERS[number]['v'];

export interface HomebrewSpecies extends PokedexEntry {
    Homebrew: true;
    /** Uploaded art per sprite set, data URLs. Each wins over SpriteOf. */
    Arts?: Partial<Record<SpriteSet, string>>;
    /** '' for an ordinary Pokémon. Legendary is set for every other tier,
        as the dex's own flag is. */
    Tier?: Tier;
    /** An official species' Image whose sprites this one borrows. */
    SpriteOf?: string;
    /** Moves made for this species; they join the move list by name. */
    HomebrewMoves?: MoveEntry[];
    /** Abilities made for this species; they join the ability list by name. */
    HomebrewAbilities?: AbilityEntry[];
    Updated: number;
}

/* ---- Reading what a file or the library hands over ---- */

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

function cleanMeasure(v: unknown): Measure {
    const o = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
    const out: Measure = {};
    (['Meters', 'Feet', 'Kilograms', 'Pounds'] as const).forEach((k) => {
        if (o[k] !== undefined && o[k] !== '') out[k] = num(o[k], 0, 1e6, 0);
    });
    return out;
}

function cleanEvolution(v: unknown): PokemonEvolution | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const out: PokemonEvolution = {};
    (['From', 'To', 'Kind', 'Speed', 'Stat', 'Item', 'Stone', 'Move', 'Gender', 'Region', 'Game', 'Special'] as const)
        .forEach((k) => { const s = str(o[k], 120).trim(); if (s) out[k] = s; });
    if (o.Value !== undefined && o.Value !== '') out.Value = num(o.Value, 0, 99, 0);
    return (out.From || out.To) ? out : null;
}

function cleanMove(v: unknown): MoveEntry | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const Name = str(o.Name, 80).trim();
    if (!Name) return null;
    return {
        Name,
        Type: str(o.Type, 20) || 'Normal',
        Power: num(o.Power, 0, 20, 0),
        Damage1: str(o.Damage1, 40), Damage2: str(o.Damage2, 40),
        Accuracy1: str(o.Accuracy1, 40), Accuracy2: str(o.Accuracy2, 40),
        Target: str(o.Target, 40),
        Effect: str(o.Effect), Description: str(o.Description),
        Category: str(o.Category, 20) || 'Support',
        _id: 'hb-move-' + Name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        Attributes: {},
        Homebrew: true,
    };
}

function cleanAbility(v: unknown): AbilityEntry | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const Name = str(o.Name, 80).trim();
    if (!Name) return null;
    return { Name, Effect: str(o.Effect), Description: str(o.Description), Homebrew: true };
}

/** A species definition as far as it can be trusted, or null. Files come from
    other people: every field is re-typed and clamped, and the art must be an
    inline picture. */
export function cleanSpecies(v: unknown): HomebrewSpecies | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const _id = str(o._id, 60);
    const Name = str(o.Name, 80).trim();
    if (!ID_RE.test(_id) || !Name) return null;
    const attr = (k: string, dflt: number) => num(o[k], 0, 12, dflt);
    /* `Art` was a single picture before the sets: it is the Home one. */
    const rawArts = (o.Arts && typeof o.Arts === 'object') ? o.Arts as Record<string, unknown> : { Home: o.Art };
    const Arts: Partial<Record<SpriteSet, string>> = {};
    SPRITE_SETS.forEach((k) => { const a = str(rawArts[k], 2_000_000); if (ART_RE.test(a)) Arts[k] = a; });
    const Tier = TIERS.find((t) => t.v === o.Tier)?.v ?? (o.Legendary ? 'legendary' : '');
    return {
        Homebrew: true,
        _id,
        Image: _id + '.png',
        Number: 0,
        DexID: str(o.DexID, 12),
        Name,
        Type1: str(o.Type1, 20) || 'Normal',
        Type2: str(o.Type2, 20),
        BaseHP: num(o.BaseHP, 1, 20, 4),
        Strength: attr('Strength', 2), MaxStrength: attr('MaxStrength', 4),
        Dexterity: attr('Dexterity', 2), MaxDexterity: attr('MaxDexterity', 4),
        Vitality: attr('Vitality', 2), MaxVitality: attr('MaxVitality', 4),
        Special: attr('Special', 2), MaxSpecial: attr('MaxSpecial', 4),
        Insight: attr('Insight', 2), MaxInsight: attr('MaxInsight', 4),
        Ability1: str(o.Ability1, 80), Ability2: str(o.Ability2, 80),
        HiddenAbility: str(o.HiddenAbility, 80), EventAbilities: str(o.EventAbilities, 80),
        RecommendedRank: str(o.RecommendedRank, 20) || 'Starter',
        GenderType: (['', 'M', 'F', 'N'] as const).find((g) => g === o.GenderType) ?? '',
        Legendary: Tier !== '',
        Tier,
        GoodStarter: !!o.GoodStarter,
        DexCategory: str(o.DexCategory, 80),
        Height: cleanMeasure(o.Height),
        Weight: cleanMeasure(o.Weight),
        DexDescription: str(o.DexDescription),
        Evolutions: (Array.isArray(o.Evolutions) ? o.Evolutions : [])
            .map(cleanEvolution).filter((e): e is PokemonEvolution => !!e).slice(0, 30),
        Moves: (Array.isArray(o.Moves) ? o.Moves : [])
            .map((m): PokemonLearnedMove | null => {
                const r = (m && typeof m === 'object') ? m as Record<string, unknown> : {};
                const name = str(r.Name, 80).trim();
                return name ? { Learned: str(r.Learned, 20) || 'Starter', Name: name } : null;
            })
            .filter((m): m is PokemonLearnedMove => !!m).slice(0, 300),
        Arts,
        /* Only an official sprite: borrowing another homebrew's could loop. */
        ...(str(o.SpriteOf, 120) && !str(o.SpriteOf).startsWith('hb-') ? { SpriteOf: str(o.SpriteOf, 120) } : {}),
        HomebrewMoves: (Array.isArray(o.HomebrewMoves) ? o.HomebrewMoves : [])
            .map(cleanMove).filter((m): m is MoveEntry => !!m).slice(0, 100),
        HomebrewAbilities: (Array.isArray(o.HomebrewAbilities) ? o.HomebrewAbilities : [])
            .map(cleanAbility).filter((a): a is AbilityEntry => !!a).slice(0, 30),
        Updated: num(o.Updated, 0, 1e15, 0),
    };
}

/* ---- The library ---- */

export function readHomebrew(): HomebrewSpecies[] {
    try {
        const raw = JSON.parse(localStorage.getItem(HOMEBREW_KEY) || '[]');
        return (Array.isArray(raw) ? raw : []).map(cleanSpecies).filter((s): s is HomebrewSpecies => !!s);
    } catch { return []; }
}

function writeHomebrew(list: HomebrewSpecies[]): boolean {
    try { localStorage.setItem(HOMEBREW_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
}

export function isHomebrew(p: PokedexEntry | null | undefined): p is HomebrewSpecies {
    return !!p && (p as Partial<HomebrewSpecies>).Homebrew === true;
}

export function newHomebrewId(): string {
    return 'hb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/* ---- Putting them into the loaded dataset ---- */

let live: AppData | null = null;
const byImage = new Map<string, HomebrewSpecies>();

function insertLive(sp: HomebrewSpecies): void {
    byImage.set(sp.Image, sp);
    if (!live) return;
    const list = live.pokemon;
    const at = list.findIndex((p) => p._id === sp._id);
    /* A name the official dex already uses would be found first by every
       lookup by name and take over that species' evolutions. The editor
       refuses one; a file from elsewhere gets it marked instead. */
    if (list.some((p) => p.Name === sp.Name && !isHomebrew(p))) sp.Name += ' (Homebrew)';
    /* Homebrews lead the list, so the pickers show them first. */
    if (at >= 0) list[at] = sp; else list.unshift(sp);
    (sp.HomebrewMoves || []).forEach((m) => {
        const i = live!.moves.findIndex((x) => x.Name === m.Name);
        if (i < 0) live!.moves.push(m);
        else if (live!.moves[i].Homebrew) live!.moves[i] = m;   // an official move keeps its name
    });
    (sp.HomebrewAbilities || []).forEach((a) => {
        const i = live!.abilities.findIndex((x) => x.Name === a.Name);
        if (i < 0) live!.abilities.push(a);
        else if (live!.abilities[i].Homebrew) live!.abilities[i] = a;
    });
}

/** Called once by the loader: the library joins the dataset. */
export function attachHomebrew(data: AppData): void {
    live = data;
    /* Oldest first, so the newest ends up at the very top. */
    readHomebrew().sort((a, b) => a.Updated - b.Updated).forEach(insertLive);
}

/** Store a species made or changed here. Returns false when storage is full. */
export function saveHomebrew(sp: HomebrewSpecies): boolean {
    const clean = cleanSpecies({ ...sp, Updated: Date.now() });
    if (!clean) return false;
    const list = readHomebrew().filter((x) => x._id !== clean._id);
    list.push(clean);
    if (!writeHomebrew(list)) return false;
    insertLive(clean);
    return true;
}

export function deleteHomebrew(id: string): void {
    writeHomebrew(readHomebrew().filter((x) => x._id !== id));
    if (live) {
        const i = live.pokemon.findIndex((p) => p._id === id);
        if (i >= 0) live.pokemon.splice(i, 1);
    }
}

/** Take in the definitions a file carried: anything new, or newer than the
    library's copy. Returns how many changed. */
export function adoptHomebrew(defs: unknown): number {
    if (!Array.isArray(defs) || !defs.length) return 0;
    const list = readHomebrew();
    let changed = 0;
    defs.map(cleanSpecies).forEach((sp) => {
        if (!sp) return;
        const i = list.findIndex((x) => x._id === sp._id);
        if (i >= 0 && list[i].Updated >= sp.Updated) return;
        if (i >= 0) list[i] = sp; else list.push(sp);
        insertLive(sp);
        changed++;
    });
    if (changed) writeHomebrew(list);
    return changed;
}

/** The definitions a file needs for these species: each homebrew among them,
    plus any homebrew it evolves from or into, so an evolution still finds its
    target in another browser. */
export function homebrewFor(dexIds: Iterable<string>): HomebrewSpecies[] {
    const lib = readHomebrew();
    if (!lib.length) return [];
    const out = new Map<string, HomebrewSpecies>();
    const queue = [...dexIds];
    while (queue.length) {
        const id = queue.pop()!;
        const sp = lib.find((x) => x._id === id);
        if (!sp || out.has(id)) continue;
        out.set(id, sp);
        sp.Evolutions.forEach((e) => {
            const other = lib.find((x) => x.Name === (e.To || e.From));
            if (other) queue.push(other._id);
        });
    }
    return [...out.values()];
}

/* ---- Sprites ---- */

export interface HomebrewLook {
    arts: Partial<Record<SpriteSet, string>>;
    /** The official Image a set without art borrows. */
    spriteOf?: string;
    /** What a set with neither shows: another set's art, else a Poké Ball. */
    fallback: string;
}

/** What a homebrew image is drawn from, or null for an image that is not a
    homebrew's at all (lib/sprites.ts turns this into URL chains). */
export function homebrewLook(image: string | undefined): HomebrewLook | null {
    if (!image || !image.startsWith('hb-')) return null;
    const sp = byImage.get(image) || readHomebrew().find((x) => x.Image === image);
    if (sp) byImage.set(image, sp);
    const arts = (sp && sp.Arts) || {};
    return {
        arts,
        spriteOf: sp ? sp.SpriteOf : undefined,
        fallback: SPRITE_SETS.map((k) => arts[k]).find(Boolean) || HOMEBREW_PLACEHOLDER,
    };
}
