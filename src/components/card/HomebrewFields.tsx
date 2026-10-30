import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ALL_TYPES } from '../../card/typeChart';
import { TYPE_ICONS, typeColors } from '../../lib/themeTables';
import { ThemeChip } from '../common/ThemeChip';

/* The homebrew editor's two pickers.

   Combo replaces <datalist>, whose popup is the browser's own grey box and
   takes no styling at all (CLAUDE.md, the native <select> note). It draws the
   card's own suggestion panel (.move-suggestions) in a portal: inside the
   editor the tab body scrolls, and a panel in it would be cut off at its edge. */

const MAX_SHOWN = 60;

export function Combo({ id, className, value, onChange, options, renderOption, titleOf, placeholder, onEnter }: {
    id?: string;
    className?: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
    /** A row's content; the plain name when absent. */
    renderOption?: (v: string) => ReactNode;
    titleOf?: (v: string) => string | undefined;
    placeholder?: string;
    /** Enter with no row highlighted. */
    onEnter?: () => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [box, setBox] = useState<CSSProperties | null>(null);

    const q = value.trim().toLowerCase();
    /* Names that start with what was typed first, then names that contain it. */
    const matches = useMemo(() => {
        if (!q) return options;
        const starts: string[] = [];
        const has: string[] = [];
        options.forEach((o) => {
            const n = o.toLowerCase();
            if (n.startsWith(q)) starts.push(o); else if (n.includes(q)) has.push(o);
        });
        return [...starts, ...has];
    }, [q, options]);
    const shown = matches.slice(0, MAX_SHOWN);

    /* Below the field, or above it when the screen has no room below. */
    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const r = input.current?.getBoundingClientRect();
            if (!r) return;
            const below = innerHeight - r.bottom;
            const up = below < 220 && r.top > below;
            setBox({
                position: 'fixed',
                left: Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 240) - 8)),
                width: Math.min(Math.max(r.width, 240), innerWidth - 16),
                ...(up ? { bottom: innerHeight - r.top + 4, top: 'auto' } : { top: r.bottom + 4 }),
                maxHeight: Math.max(120, Math.min(300, (up ? r.top : below) - 12)),
                zIndex: 400,
            });
        };
        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [open]);

    /* Escape closes the list, not the dialog under it: the dialog listens in
       the capture phase on the document, and the window comes before it. */
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [open]);

    useEffect(() => {
        if (active < 0) return;
        list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const pick = (v: string) => {
        onChange(v);
        setOpen(false);
        setActive(-1);
    };

    return (
        <>
            <input
                ref={input}
                id={id}
                className={'move-edit-input' + (className ? ' ' + className : '')}
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                placeholder={placeholder}
                value={value}
                onChange={(e) => { onChange(e.currentTarget.value); setOpen(true); setActive(-1); }}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onBlur={() => { setOpen(false); setActive(-1); }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setOpen(true);
                        setActive((a) => Math.min(a + 1, shown.length - 1));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActive((a) => Math.max(a - 1, -1));
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (open && active >= 0 && shown[active]) pick(shown[active]);
                        else { setOpen(false); onEnter?.(); }
                    } else if (e.key === 'Tab') {
                        setOpen(false);
                    }
                }}
            />
            {open && box && shown.length > 0 && createPortal(
                <div
                    ref={list}
                    className="move-suggestions hb-combo-list"
                    role="listbox"
                    data-tt-avoid=""
                    style={box}
                >
                    {shown.map((v, i) => (
                        <div
                            key={v}
                            role="option"
                            aria-selected={i === active}
                            className={'move-suggestion' + (i === active ? ' active' : '')}
                            title={titleOf?.(v)}
                            /* mousedown, not click: the field's blur would close
                               the list before a click landed. */
                            onMouseDown={(e) => { e.preventDefault(); pick(v); }}
                            onMouseEnter={() => setActive(i)}
                        >
                            {renderOption ? renderOption(v) : <span className="item-suggestion-name">{v}</span>}
                        </div>
                    ))}
                    {matches.length > shown.length && (
                        <div className="move-suggestion-more">+ {matches.length - shown.length} more, keep typing...</div>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}

/** The eighteen types as the License theme picker's round chips; press one,
    or two for a dual type (the first pressed is the main one). With `max` 1 a
    press swaps the type. */
export function TypePicker({ id, value, max, onChange }: {
    id?: string;
    value: string[];
    max: 1 | 2;
    onChange: (types: string[]) => void;
}) {
    const toggle = (t: string) => {
        if (value.includes(t)) {
            /* A move always has a type; a species may be left without one
               for a moment (Save asks for it). */
            if (max === 2 || value.length > 1) onChange(value.filter((x) => x !== t));
            return;
        }
        if (value.length < max) onChange([...value, t]);
        else onChange(max === 1 ? [t] : [value[0], t]);
    };
    return (
        <div className="hb-type-picker" id={id} role="group">
            {ALL_TYPES.map((t) => {
                const on = value.includes(t);
                return (
                    <ThemeChip
                        key={t}
                        swatch={typeColors[t] || '#6b7280'}
                        icon={TYPE_ICONS[t] || 'fa-circle'}
                        label={t}
                        iconOnly
                        themeType=""
                        selected={on}
                        pressed={on}
                        className={'hb-type-opt' + (on ? ' on' : '')}
                        dataType={t}
                        onClick={() => toggle(t)}
                    />
                );
            })}
        </div>
    );
}
