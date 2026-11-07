import type { MapStyle } from './styles';
import { TERRAINS } from './terrain';
import { markerArt, patternParts } from './render/patterns';

/* A filler placed on its own: one of a terrain's markers — a single peak, a
   single tree — as a landmark that can be moved, resized, turned and
   mirrored like any other. It is a stamp whose landmark is
   `filler:<terrain slug>` and whose `variant` picks which of the terrain's
   markers (the index into its tile's sprites). The art is the style's own
   marker, so switching style redraws it in the new look; a style whose
   terrain has fewer markers wraps the index round. */

export { FILLER_PREFIX, fillerTerrain } from './landmarks';

/** How many of a terrain's markers the picker offers, at most. */
const MAX_VARIANTS = 12;

function partsOf(style: MapStyle, slug: string) {
    const look = style.terrain[slug];
    if (!look?.pattern) return null;
    const parts = patternParts(look.pattern, look.ink ?? '#0003');
    return parts?.sprites.length ? { parts, look: { pattern: look.pattern, ink: look.ink ?? '#0003' } } : null;
}

/** The terrains a single filler can be taken from in this style. */
export function fillerTerrains(style: MapStyle) {
    return TERRAINS.filter((t) => partsOf(style, t.slug));
}

/** The markers the picker offers for a terrain: biggest first, spread over
    the sizes there are rather than the first dozen, as sprite indices. */
export function fillerVariants(style: MapStyle, slug: string): number[] {
    const p = partsOf(style, slug);
    if (!p) return [];
    const order = p.parts.sprites.map((s, i) => ({ i, a: s.w * s.h })).sort((a, b) => b.a - a.a).map((x) => x.i);
    if (order.length <= MAX_VARIANTS) return order;
    const step = order.length / MAX_VARIANTS;
    return Array.from({ length: MAX_VARIANTS }, (_, k) => order[Math.floor(k * step)]);
}

/** The art of one marker, as big a canvas as `target` px a side asks for;
    `pixel` when it should be scaled up blocky. Null when the terrain has no
    markers in this style. */
export function fillerCanvas(style: MapStyle, slug: string, variant: number, target = 256):
    { canvas: HTMLCanvasElement; pixel: boolean } | null {
    const p = partsOf(style, slug);
    if (!p) return null;
    const n = p.parts.sprites.length;
    const index = ((Math.round(variant) % n) + n) % n;
    const canvas = markerArt(p.look.pattern, p.look.ink, index, target);
    return canvas ? { canvas, pixel: !!style.pixelated } : null;
}

const urls = new Map<string, string>();

/** The same as a data URL, for an <img> in the editor and the side panel. */
export function fillerUrl(style: MapStyle, slug: string, variant: number): string | null {
    const key = style.id + '|' + slug + '|' + variant;
    const hit = urls.get(key);
    if (hit) return hit;
    const art = fillerCanvas(style, slug, variant);
    if (!art) return null;
    const url = art.canvas.toDataURL();
    urls.set(key, url);
    return url;
}
