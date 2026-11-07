import { EMPTY, decode, encode } from './raster';

/* Painted fillers: a terrain's markers — the peaks of Mountains, the flowers
   of a Flower Field, the trees of a Forest — laid over the ground WITHOUT its
   colour or texture, on top of whatever markers the ground already has. A
   mountain range with flowers among its peaks, a beach with a few palms.

   A layer of samples on the terrain's own grid, like the fog, so every brush
   paints it unchanged: EMPTY where nothing is painted, otherwise the index in
   TERRAINS of the terrain whose markers go there. One filler a sample; the
   ground's own markers are not part of it and stay whatever happens here.
   Stored as runs exactly like the terrain (its codes, `_` for none), and
   empty when nothing was ever painted. */

export const NO_FILLER = EMPTY;

export function encodeFillers(data: Uint8Array): string {
    for (let i = 0; i < data.length; i++) if (data[i] !== NO_FILLER) return encode(data);
    return '';
}

export function decodeFillers(text: string, length: number): Uint8Array {
    return decode(text, length);
}

const cache = new Map<string, Uint8Array>();

export function fillersOf(doc: { cols: number; rows: number; res: number; fillers?: string }): Uint8Array | null {
    if (!doc.fillers) return null;
    const n = doc.cols * doc.res * doc.rows * doc.res;
    let data = cache.get(doc.fillers);
    if (!data || data.length !== n) {
        data = decodeFillers(doc.fillers, n);
        cache.set(doc.fillers, data);
        if (cache.size > 6) cache.delete(cache.keys().next().value as string);
    }
    return data;
}

export function rememberFillers(text: string, data: Uint8Array): void {
    if (!text) return;
    cache.set(text, data);
    if (cache.size > 6) cache.delete(cache.keys().next().value as string);
}

/** A layer with no fillers, to paint into. */
export function blankFillers(doc: { cols: number; rows: number; res: number }): Uint8Array {
    return new Uint8Array(doc.cols * doc.res * doc.rows * doc.res).fill(NO_FILLER);
}
