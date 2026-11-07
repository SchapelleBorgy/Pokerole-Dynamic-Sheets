import { useEffect, useState } from 'react';
import { useMap } from '../../map/MapContext';
import { MAX_SHAPE_WIDTH, MIN_SHAPE_WIDTH, SHAPES, SHAPE_BY_KIND } from '../../map/shapes';
import type { ShapeKind } from '../../map/shapes';

/* The Shapes tool's own controls: which shape, filled or outlined, how wide
   the outline is — and, each time a shape is picked, a small tip saying
   what holding Alt does to it. What the shape paints (terrain or fillers)
   is the terrain panel below it, shared with the brush.

   The Sketch tool's Shape mode shows the same picker and tip (`sketch`),
   without fill and width: a sketch has its own pen, colour and width. */

function ShapeGlyph({ kind }: { kind: ShapeKind }) {
    const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' as const };
    let body;
    switch (kind) {
        case 'line': body = <line x1="4" y1="20" x2="20" y2="4" {...p} strokeLinecap="round" />; break;
        case 'rect': body = <rect x="3" y="6" width="18" height="12" {...p} />; break;
        case 'ellipse': body = <ellipse cx="12" cy="12" rx="9" ry="6.5" {...p} />; break;
        case 'triangle': body = <polygon points="12,4 21,19 3,19" {...p} />; break;
        case 'diamond': body = <polygon points="12,3 21,12 12,21 3,12" {...p} />; break;
        case 'hexagon': body = <polygon points="3,12 7.5,4.2 16.5,4.2 21,12 16.5,19.8 7.5,19.8" {...p} />; break;
    }
    return <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">{body}</svg>;
}

const clampWidth = (v: number) => Math.round(Math.max(MIN_SHAPE_WIDTH, Math.min(MAX_SHAPE_WIDTH, v)) * 100) / 100;

export function ShapePicker({ sketch = false }: { sketch?: boolean }) {
    const { store, ui } = useMap();
    const def = SHAPE_BY_KIND.get(ui.shape) ?? SHAPES[0];
    const line = ui.shape === 'line';
    const stroked = !sketch && (line || ui.shapeFill === 'outline');
    const [draft, setDraft] = useState<string | null>(null);
    /* The tip comes back each time a shape is picked, then may be closed. */
    const [tipFor, setTipFor] = useState<ShapeKind | null>(ui.shape);
    useEffect(() => { setTipFor(ui.shape); }, [ui.shape]);
    return (
        <div className={'map-shapes' + (sketch ? ' in-sketch' : '')}>
            {!sketch && <h3>Shape</h3>}
            <div className="map-shape-grid" role="group" aria-label="Shape">
                {SHAPES.map((s) => (
                    <button
                        key={s.kind}
                        className="map-shape-choice"
                        data-shape={s.kind}
                        aria-pressed={ui.shape === s.kind}
                        title={s.name + ' — hold Alt while dragging for ' + s.even}
                        onClick={() => { store.setUi({ shape: s.kind }); setTipFor(s.kind); }}
                    >
                        <ShapeGlyph kind={s.kind} />
                        <span>{s.name}</span>
                    </button>
                ))}
            </div>
            {tipFor === ui.shape && (
                <div className="map-shape-tip" role="note" key={ui.shape}>
                    <kbd>Alt</kbd>
                    <span>Hold it while dragging for {def.even}.</span>
                    <button className="map-shape-tip-close" aria-label="Close the tip" onClick={() => setTipFor(null)}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}
            {!line && !sketch && (
                <div className="map-segmented map-shape-fill" role="group" aria-label="Filled or outlined">
                    <button aria-pressed={ui.shapeFill === 'fill'} onClick={() => store.setUi({ shapeFill: 'fill' })}>
                        <i className="fa-solid fa-square"></i> Filled
                    </button>
                    <button aria-pressed={ui.shapeFill === 'outline'} onClick={() => store.setUi({ shapeFill: 'outline' })}>
                        <i className="fa-regular fa-square"></i> Outline
                    </button>
                </div>
            )}
            {stroked && (
                <div className="map-row map-shape-width">
                    <label htmlFor="map-shape-width">{line ? 'Width' : 'Outline'}</label>
                    <input
                        id="map-shape-width" type="range" min={MIN_SHAPE_WIDTH} max={10} step={0.05}
                        value={Math.min(10, ui.shapeWidth)}
                        onChange={(e) => store.setUi({ shapeWidth: clampWidth(Number(e.currentTarget.value)) })}
                    />
                    <input
                        type="number" className="map-shape-width-field"
                        min={MIN_SHAPE_WIDTH} max={MAX_SHAPE_WIDTH} step={0.05}
                        value={draft ?? String(ui.shapeWidth)}
                        aria-label={(line ? 'Line width' : 'Outline width') + ' in cells'}
                        onFocus={() => setDraft(String(ui.shapeWidth))}
                        onBlur={() => setDraft(null)}
                        onChange={(e) => {
                            const text = e.currentTarget.value;
                            setDraft(text);
                            const v = parseFloat(text);
                            if (isFinite(v) && v > 0) store.setUi({ shapeWidth: clampWidth(v) });
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                    <span className="map-unit">cells</span>
                </div>
            )}
        </div>
    );
}
