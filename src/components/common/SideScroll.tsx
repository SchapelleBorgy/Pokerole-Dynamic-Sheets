import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/* A row of panels wider than the window, made easy to move along.

   The row always scrolled sideways, but only by the thin bar along its
   bottom, a trackpad, or Shift with the wheel, so on a mouse the fights
   added past the right edge were easy to never find. Three ways now:

     - arrows at either edge, shown only while there is more that way, each
       click moving one panel along;
     - the plain mouse wheel, wherever it is over something that does not
       scroll up and down itself: a panel's head, the gap between panels, a
       panel too short to scroll. Over a list that does scroll, the wheel
       scrolls the list, as it always did;
     - a scrollbar that can be seen and grabbed (board.css). */

const NUDGE = 4;

/** Whether the wheel over `from` belongs to something between it and the
    row that scrolls up and down. */
function scrollsItself(from: Element | null, row: HTMLElement): boolean {
    for (let n = from; n && n !== row; n = n.parentElement) {
        if (n.scrollHeight <= n.clientHeight + 1) continue;
        const oy = getComputedStyle(n).overflowY;
        if (oy === 'auto' || oy === 'scroll') return true;
    }
    return false;
}

export function SideScroll({ tag = 'div', className, id, children }: {
    tag?: 'div' | 'main';
    className: string;
    id?: string;
    children: ReactNode;
}) {
    const ref = useRef<HTMLElement | null>(null);
    const [more, setMore] = useState({ left: false, right: false });

    useEffect(() => {
        const row = ref.current;
        if (!row) return;

        const update = () => {
            const max = row.scrollWidth - row.clientWidth;
            const left = row.scrollLeft > NUDGE;
            const right = max > NUDGE && row.scrollLeft < max - NUDGE;
            setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
        };

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // already sideways
            if (row.scrollWidth <= row.clientWidth + 1) return;
            const t = e.target as Element | null;
            if (t && t === document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
            if (scrollsItself(t, row)) return;
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? row.clientWidth : 1;
            row.scrollLeft += e.deltaY * unit;
        };

        /* The row's own size, and every panel's: a panel resized, added or
           taken away changes how far there is to go. */
        const sizes = new ResizeObserver(update);
        const watchKids = () => {
            sizes.disconnect();
            sizes.observe(row);
            for (const kid of Array.from(row.children)) sizes.observe(kid);
            update();
        };
        const kids = new MutationObserver(watchKids);
        kids.observe(row, { childList: true });
        watchKids();

        row.addEventListener('scroll', update, { passive: true });
        row.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            sizes.disconnect();
            kids.disconnect();
            row.removeEventListener('scroll', update);
            row.removeEventListener('wheel', onWheel);
        };
    }, []);

    /** One panel along: the next one's left edge to the row's left edge, or
        the previous one's. */
    const step = useCallback((dir: 1 | -1) => {
        const row = ref.current;
        if (!row) return;
        const box = row.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(row).paddingLeft) || 0;
        const starts = Array.from(row.children)
            .filter((k) => (k as HTMLElement).offsetWidth > 0)
            .map((k) => k.getBoundingClientRect().left - box.left + row.scrollLeft - pad);
        const at = row.scrollLeft;
        const to = dir > 0
            ? starts.find((x) => x > at + NUDGE)
            : starts.filter((x) => x < at - NUDGE).pop();
        row.scrollTo({
            left: to ?? (dir > 0 ? row.scrollWidth : 0),
            behavior: 'smooth',
        });
    }, []);

    return (
        <div className="side-scroll">
            {createElement(tag, { ref, className, id }, children)}
            {more.left && (
                <button
                    type="button"
                    className="side-arrow left"
                    aria-label="Scroll left"
                    title="Scroll left (or use the mouse wheel over a panel's title)"
                    onClick={() => step(-1)}
                >
                    <i className="fa-solid fa-chevron-left"></i>
                </button>
            )}
            {more.right && (
                <button
                    type="button"
                    className="side-arrow right"
                    aria-label="Scroll right"
                    title="Scroll right (or use the mouse wheel over a panel's title)"
                    onClick={() => step(1)}
                >
                    <i className="fa-solid fa-chevron-right"></i>
                </button>
            )}
        </div>
    );
}
