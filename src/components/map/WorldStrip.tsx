import { useMap } from '../../map/MapContext';
import { useGmConfirm } from '../gm/ConfirmDialog';
import { keyHint } from '../../map/hotkeys';
import { KIND_ICON, KIND_LABEL, ancestry } from '../../map/world';
import type { TableLiveLink } from '../../map/tableLive';
import { useTableLive } from './TableLinkControl';

/* The strip under the top bar: where the GM is (world › city › building,
   each step a way back), and the scene the players are looking at, with the
   button that makes the map on screen that scene. Navigating never changes
   what players see — only that button does (see tableLive.ts).

   It shows only when there is something to say: a map entered from another,
   or a rolling table to show scenes at. */

export function WorldStrip({ link }: { link: TableLiveLink }) {
    const { store, doc } = useMap();
    const s = useTableLive(link);
    const confirm = useGmConfirm();
    const up = ancestry(store.maps, doc);
    const table = s.connected || s.mode !== 'off';
    if (!up.length && !table) return null;

    const scene = s.mode !== 'off' && s.mapId ? store.maps.find((m) => m.id === s.mapId) ?? null : null;
    const follows = !!scene && scene.id === doc.id;
    const onShow = follows && s.shown && s.activeMap === doc.id;

    const show = async () => {
        if (!follows && link.needsFogWarning()) {
            const ok = await confirm({
                icon: 'fa-eye', danger: true, confirmLabel: 'Show it anyway',
                title: 'This map has no fog of war',
                text: 'Every player will see the whole of it, and every change you make to it. '
                    + 'Paint fog over what they have not found yet first, or show it if they may see it all.',
            });
            if (!ok) return;
        }
        await link.showScene();
    };

    return (
        <nav className="map-world-strip" aria-label="Where you are" data-world-strip="">
            {up.length > 0 && (
                <button
                    className="icon-btn map-world-up" data-world-up=""
                    title={'Back out to ' + (up[up.length - 1].name || 'the map above') + keyHint('deselect')}
                    onClick={() => store.goUp()}
                >
                    <i className="fa-solid fa-arrow-turn-up fa-flip-horizontal"></i>
                </button>
            )}
            <ol className="map-crumbs">
                {up.map((m) => (
                    <li key={m.id}>
                        <button className="map-crumb" data-crumb={m.id} title={'Go to ' + KIND_LABEL[m.kind].toLowerCase() + ' ' + (m.name || '')} onClick={() => store.switchTo(m.id)}>
                            <i className={'fa-solid ' + KIND_ICON[m.kind]}></i><span>{m.name || 'Untitled'}</span>
                        </button>
                        <i className="fa-solid fa-chevron-right map-crumb-sep" aria-hidden="true"></i>
                    </li>
                ))}
                <li aria-current="page">
                    <span className="map-crumb current" title={KIND_LABEL[doc.kind]}>
                        <i className={'fa-solid ' + KIND_ICON[doc.kind]}></i><span>{doc.name || 'Untitled'}</span>
                    </span>
                </li>
            </ol>
            <span className="spacer"></span>
            {table && (
                <div className="map-scene">
                    {scene && !follows && (
                        <button className="map-crumb map-scene-elsewhere" data-scene-goto="" title="Go to the map the players are looking at" onClick={() => store.switchTo(scene.id)}>
                            <i className="fa-solid fa-users"></i><span>Players see <strong>{scene.name || 'Untitled'}</strong></span>
                        </button>
                    )}
                    {onShow ? (
                        <span className="map-scene-on" data-scene-on="">
                            <span className="map-live-dot"></span> On show to the players
                        </span>
                    ) : (
                        <button
                            className="accent map-scene-btn" data-show-scene=""
                            disabled={!s.connected || s.busy}
                            title={s.connected ? 'Players see this map from now on. Moving around here does not change it.' : 'Open your rolling table in another tab of this browser first'}
                            onClick={() => { void show(); }}
                        >
                            <i className="fa-solid fa-eye"></i> Show this scene
                        </button>
                    )}
                </div>
            )}
        </nav>
    );
}
