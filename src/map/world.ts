import { createDoc } from './doc';
import { landmarkOf } from './landmarks';
import { lookForStyle } from './world/looks';
import { itemOf } from './world/catalog';
import { defaultRoom } from './world/room';
import type { DocKind, MapDoc, Selection } from './types';

/* The World Builder's three views and how they hang together.

   A world map's landmark can open a city or an interior; a city's, an
   interior; an interior's, another interior (the next room, the cellar).
   The link is two-way and both ends are plain ids: the landmark names the
   map it opens (`MapStamp.link`), and that map names the landmark it is
   entered from (`MapDoc.parent`). Either end may be gone — a map deleted, a
   landmark rubbed out — so everything here reads them leniently: a link to
   a missing map is no link, a parent that is missing ends the trail. */

export const KIND_LABEL: Record<DocKind, string> = { world: 'World map', city: 'City', interior: 'Interior' };
export const KIND_ICON: Record<DocKind, string> = { world: 'fa-earth-europe', city: 'fa-city', interior: 'fa-couch' };

/** What a landmark on a map of this kind can open. */
export function childKinds(kind: DocKind): DocKind[] {
    return kind === 'world' ? ['city', 'interior'] : ['interior'];
}

/** How deep a trail is followed: a hand-edited file with a loop in it
    must not hang the page. */
const MAX_DEPTH = 12;

/** The maps above this one, outermost first: world, city, … — not the map itself. */
export function ancestry(maps: MapDoc[], doc: MapDoc): MapDoc[] {
    const out: MapDoc[] = [];
    const seen = new Set([doc.id]);
    let at = doc;
    while (at.parent && out.length < MAX_DEPTH) {
        const up = maps.find((m) => m.id === at.parent!.doc);
        if (!up || seen.has(up.id)) break;
        seen.add(up.id);
        out.unshift(up);
        at = up;
    }
    return out;
}

/** The map a landmark (or a building) opens, if it is still there. */
export function linkedDoc(maps: MapDoc[], obj: { link?: string }): MapDoc | undefined {
    return obj.link ? maps.find((m) => m.id === obj.link) : undefined;
}

/** What a map can be entered through: a landmark, or a building in a city. */
export interface Door {
    sel: Selection;
    link?: string;
    label?: string;
    /** What it is, for a name: "Town", "House". */
    what: string;
}

export function doorOf(doc: MapDoc, id: string): Door | null {
    const st = doc.stamps.find((s) => s.id === id);
    if (st) return { sel: { kind: 'stamp', id }, link: st.link, label: st.label, what: landmarkOf(st.landmark).name };
    const pl = doc.placed.find((o) => o.id === id);
    if (pl) return { sel: { kind: 'placed', id }, link: pl.link, label: pl.label, what: itemOf(pl.item).name };
    return null;
}

/** The name a new city or interior takes: the door's label, else what it is. */
export function childName(door: Pick<Door, 'label' | 'what'>, kind: DocKind): string {
    const label = (door.label ?? '').split('\n')[0].trim();
    if (label) return label;
    return kind === 'interior' ? door.what + ' (inside)' : door.what;
}

/** A new map to be entered through `door` on `parent`. Its own builder will
    shape it; for now a city is open grass and an interior bare floor, in the
    style and look of the map it is entered from. */
export function createChild(parent: MapDoc, door: Door, kind: DocKind): MapDoc {
    const city = kind === 'city';
    return createDoc({
        name: childName(door, kind),
        kind,
        parent: { doc: parent.id, object: door.sel.id },
        cols: city ? 48 : 16,
        rows: city ? 36 : 12,
        /* The bright Anime ground suits the vector buildings (the owner's
           pick of looks, 2026-11-08); an Ancient region keeps its paper. */
        styleId: parent.styleId === 'ancient' ? 'ancient' : 'anime',
        look: parent.look ?? lookForStyle(parent.styleId),
        background: city ? 'grassland' : 'town-paving',
        scaleLabel: city ? '1 cell = 5 m' : '1 cell = 1 m',
        /* An interior starts as a plain room a cell in from the edges; its
           corners can then be dragged to the house's real shape. */
        ...(city ? {} : { room: defaultRoom(16, 12) }),
    });
}

/** Maps a landmark on `doc` may be pointed at: of a kind it can open, and
    not `doc` itself or anything above it (no loops). */
export function linkCandidates(maps: MapDoc[], doc: MapDoc): MapDoc[] {
    const kinds = childKinds(doc.kind);
    const above = new Set([doc.id, ...ancestry(maps, doc).map((m) => m.id)]);
    return maps.filter((m) => kinds.includes(m.kind) && !above.has(m.id));
}

/** Every map as a tree for the map list: roots (no parent, or a parent that
    is gone) newest first, each followed by what opens from it. */
export function mapTree(maps: MapDoc[]): { doc: MapDoc; depth: number }[] {
    const ids = new Set(maps.map((m) => m.id));
    const children = new Map<string, MapDoc[]>();
    const roots: MapDoc[] = [];
    for (const m of maps) {
        const p = m.parent && ids.has(m.parent.doc) && m.parent.doc !== m.id ? m.parent.doc : null;
        if (p) children.set(p, [...(children.get(p) ?? []), m]);
        else roots.push(m);
    }
    const out: { doc: MapDoc; depth: number }[] = [];
    const seen = new Set<string>();
    const walk = (m: MapDoc, depth: number) => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        out.push({ doc: m, depth });
        const kids = [...(children.get(m.id) ?? [])].sort((a, b) => a.name.localeCompare(b.name));
        for (const k of kids) walk(k, Math.min(depth + 1, MAX_DEPTH));
    };
    for (const r of [...roots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) walk(r, 0);
    /* A loop of parents with no root: still listed. */
    for (const m of maps) walk(m, 0);
    return out;
}
