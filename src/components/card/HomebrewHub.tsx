import { useEffect, useRef, useState } from 'react';
import { Modal, ModalClose } from '../common/Modal';
import { TileSprite } from '../common/TileSprite';
import { HomebrewEditor, blankSpecies, speciesDraft } from './HomebrewEditor';
import {
    HOMEBREW_FIELD, HOMEBREW_MARKER, TIERS, adoptHomebrew, deleteHomebrew, homebrewFor, isHomebrew,
    readHomebrew, saveHomebrew,
} from '../../data/homebrew';
import type { HomebrewSpecies } from '../../data/homebrew';
import type { PokedexEntry } from '../../data/types';
import { showAlert, showConfirm } from '../../lib/dialog';
import { TYPE_ICONS, typeColors } from '../../lib/themeTables';

/* The homebrew library: every species made in this browser, and the way into
   the editor.

   What "use" means depends on the card: on the blank landing, a plain card
   or a wild one, a species is opened like any other; on a trainer's Pokémon
   the slot is fixed, so the Pokémon itself changes species, carrying its
   points over as an evolution does. */

interface Editing {
    draft: HomebrewSpecies;
    isNew: boolean;
    /** A copy of the species on the card, which the card moves onto. */
    customise: boolean;
}

function download(name: string, json: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function exportSpecies(ids: string[], fileBase: string): void {
    const defs = homebrewFor(ids);
    if (!defs.length) return;
    download('homebrew-' + (fileBase.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase() || 'pokemon') + '.json',
        JSON.stringify({ [HOMEBREW_MARKER]: true, [HOMEBREW_FIELD]: defs }, null, 2));
}

export function HomebrewHub({ open, current, inTrainer, openAfterCreate, onClose, onOpen, onUse }: {
    open: boolean;
    /** The species on the card, or null on the blank landing. */
    current: PokedexEntry | null;
    inTrainer: boolean;
    /** The blank landing opens a species as soon as it is made. */
    openAfterCreate: boolean;
    onClose: () => void;
    onOpen: (id: string) => void;
    /** Move the Pokémon on this card onto that species. */
    onUse: (id: string) => void;
}) {
    const [list, setList] = useState<HomebrewSpecies[]>([]);
    const [editing, setEditing] = useState<Editing | null>(null);
    const importInput = useRef<HTMLInputElement>(null);

    const refresh = () => setList(readHomebrew().sort((a, b) => a.Name.localeCompare(b.Name)));
    useEffect(() => { if (open) { refresh(); setEditing(null); } }, [open]);

    if (!open) return null;

    if (editing) {
        const editsCurrent = !!current && current._id === editing.draft._id;
        return (
            <HomebrewEditor
                initial={editing.draft}
                isNew={editing.isNew}
                title={editing.customise && current ? 'Customise ' + current.Name
                    : editing.isNew ? 'New homebrew Pokémon' : 'Edit ' + editing.draft.Name}
                note={editing.customise
                    ? 'Saving makes a new species and moves this Pokémon onto it. Its trained points carry over, as in an evolution.'
                    : !editing.isNew ? 'Every Pokémon of this species changes with it.' : undefined}
                onClose={() => setEditing(null)}
                onSave={(d) => {
                    if (!saveHomebrew(d)) {
                        void showAlert('The browser storage is full, so the species was not saved. '
                            + 'Smaller art, or removing other homebrews, makes room.', { title: 'Not saved', icon: 'fa-triangle-exclamation' });
                        return;
                    }
                    if (editing.customise) { onUse(d._id); return; }
                    /* The card is built around its species at load. */
                    if (editsCurrent) { location.reload(); return; }
                    if (editing.isNew && openAfterCreate) { onOpen(d._id); return; }
                    setEditing(null);
                    refresh();
                }}
            />
        );
    }

    const use = async (sp: HomebrewSpecies) => {
        if (!inTrainer) { onOpen(sp._id); return; }
        const ok = await showConfirm(
            'Change this Pokémon into ' + sp.Name + '?\n\nTrained points, moves you added, HP and everything else '
            + 'carry over as in an evolution; base attributes, limits and the learnset become ' + sp.Name + "'s.",
            { title: 'Change species', icon: 'fa-flask', confirmLabel: 'Change' },
        );
        if (ok) onUse(sp._id);
    };

    const remove = async (sp: HomebrewSpecies) => {
        const ok = await showConfirm(
            'Delete ' + sp.Name + ' from this browser?\n\nA Pokémon of this species will not open until a file '
            + 'that carries it (a trainer or wild Pokémon saved with it, or an export) is loaded again.',
            { title: 'Delete homebrew', icon: 'fa-trash-can', confirmLabel: 'Delete', danger: true },
        );
        if (!ok) return;
        deleteHomebrew(sp._id);
        refresh();
    };

    const importFiles = async (files: File[]) => {
        let adopted = 0, found = 0, bad = 0;
        for (const f of files) {
            try {
                const parsed = JSON.parse(await f.text());
                const defs = parsed && parsed[HOMEBREW_FIELD];
                if (!Array.isArray(defs) || !defs.length) { bad++; continue; }
                found += defs.length;
                adopted += adoptHomebrew(defs);
            } catch { bad++; }
        }
        refresh();
        const bits: string[] = [];
        bits.push(adopted ? adopted + ' species added or updated.' : 'Nothing new: the library already has these.');
        if (found > adopted && adopted) bits.push((found - adopted) + ' already up to date.');
        if (bad) bits.push(bad + ' file' + (bad === 1 ? '' : 's') + ' had no homebrew Pokémon in it.');
        void showAlert(bits.join('\n'), { title: 'Import', icon: 'fa-file-import' });
    };

    const currentIsHomebrew = isHomebrew(current);

    return (
        <Modal open onClose={onClose} boxClassName="poke-picker-box hb-hub" id="homebrew-hub">
            <ModalClose onClick={onClose} />
            <div className="modal-title" style={{ color: 'var(--text-primary)' }}>
                <i className="fa-solid fa-flask" style={{ color: 'var(--ghost-color)' }}></i> Homebrew Pokémon
            </div>
            <p className="hb-note">
                Make a Pokémon from scratch: name, art, typing, attributes, abilities, learnset and evolutions,
                with moves and abilities of its own. It is kept in this browser, and every trainer or wild
                Pokémon file that uses it carries it along.
            </p>

            <div className="hb-hub-actions">
                <button
                    className="form-btn save" id="hb-new"
                    onClick={() => setEditing({ draft: blankSpecies(), isNew: true, customise: false })}
                >
                    <i className="fa-solid fa-plus"></i> New from scratch
                </button>
                {current && currentIsHomebrew && (
                    <button
                        className="form-btn reset" id="hb-edit-current"
                        onClick={() => setEditing({ draft: speciesDraft(current, true), isNew: false, customise: false })}
                    >
                        <i className="fa-solid fa-pen"></i> Edit {current.Name}
                    </button>
                )}
                {current && !currentIsHomebrew && current._id !== 'egg' && (
                    <button
                        className="form-btn reset" id="hb-customise"
                        title={'A homebrew copy of ' + current.Name + ', which this Pokémon then becomes'}
                        onClick={() => setEditing({ draft: speciesDraft(current), isNew: false, customise: true })}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Customise {current.Name}
                    </button>
                )}
                <button className="form-btn cancel" id="hb-import" onClick={() => importInput.current?.click()}>
                    <i className="fa-solid fa-file-import"></i> Import
                </button>
                {list.length > 1 && (
                    <button className="form-btn cancel" id="hb-export-all"
                        onClick={() => exportSpecies(list.map((x) => x._id), 'all')}>
                        <i className="fa-solid fa-file-export"></i> Export all
                    </button>
                )}
            </div>

            <div className="hb-list" id="hb-list">
                {!list.length && <div className="ability-pick-empty">No homebrew Pokémon yet.</div>}
                {list.map((sp) => (
                    <div className={'hb-row' + (current?._id === sp._id ? ' current' : '')} key={sp._id} data-id={sp._id}>
                        <div className="hb-row-sprite"><TileSprite image={sp.Image} /></div>
                        <div className="hb-row-main">
                            <div className="hb-row-name">{sp.Name}</div>
                            <div className="hb-row-types">
                                {[sp.Type1, sp.Type2].filter(Boolean).map((t) => (
                                    <span key={t} className="hb-type-chip" style={{ background: typeColors[t] || '#6b7280' }}>
                                        <i className={'fa-solid ' + (TYPE_ICONS[t] || 'fa-circle')}></i> {t}
                                    </span>
                                ))}
                                <span className="hb-row-meta">
                                    {[TIERS.find((t) => t.v && t.v === sp.Tier)?.label, sp.Moves.length + ' moves'].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                        </div>
                        <div className="hb-row-btns">
                            {current?._id !== sp._id && (
                                <button className="form-btn save hb-use" onClick={() => void use(sp)}
                                    title={inTrainer ? 'Change this Pokémon into ' + sp.Name : 'Open ' + sp.Name + ' on the card'}>
                                    {inTrainer ? 'Use' : 'Open'}
                                </button>
                            )}
                            <button className="hb-icon-btn hb-edit" title={'Edit ' + sp.Name}
                                onClick={() => setEditing({ draft: speciesDraft(sp, true), isNew: false, customise: false })}>
                                <i className="fa-solid fa-pen"></i>
                            </button>
                            <button className="hb-icon-btn" title={'Copy ' + sp.Name + ' into a new species'}
                                onClick={() => setEditing({ draft: speciesDraft(sp), isNew: true, customise: false })}>
                                <i className="fa-solid fa-copy"></i>
                            </button>
                            <button className="hb-icon-btn" title={'Save ' + sp.Name + ' to a file to share'}
                                onClick={() => exportSpecies([sp._id], sp.Name)}>
                                <i className="fa-solid fa-file-export"></i>
                            </button>
                            <button className="hb-icon-btn danger"
                                title={current?._id === sp._id ? 'It is on this card' : 'Delete ' + sp.Name}
                                disabled={current?._id === sp._id}
                                onClick={() => void remove(sp)}>
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <input
                ref={importInput} type="file" accept=".json,application/json" multiple style={{ display: 'none' }}
                onChange={(e) => {
                    const files = Array.from(e.currentTarget.files || []);
                    e.currentTarget.value = '';
                    if (files.length) void importFiles(files);
                }}
            />
        </Modal>
    );
}
