/* Live sheets: keep one trainer (and their Pokémon) in step across devices.

   One device "goes live" with a trainer and gets a room code; anyone who joins
   with that code gets the trainer and from then on every edit on either side
   shows up on the other within a moment. Devices talk to each other directly
   over WebRTC (Trystero, found through public Nostr relays), so there is no
   account and no server of our own. The JSON files stay the real save: Save
   All still writes them, and a guest can keep a copy with the backup button.

   It works on the browser "working set" (localStorage['pokerole_working']),
   which both pages already treat as the single source of truth:
     - every write to the working set is diffed per live trainer against the
       last state this tab knew, and only the changed fields are sent;
     - incoming changes are applied to the working set and the page re-renders.
   Each tab (the Trainer's License and any open Pokémon cards) joins on its
   own, so a card left open on a phone keeps updating by itself.

   Loaded after the page's own script, whose globals (trainers, sheetState,
   renderAll, saveWorkingSet, readWorking, ...) it calls directly. */
(function () {
    'use strict';

    const WK = 'pokerole_working';
    const LIVE_KEY = 'pokerole_live';        // [{ code, tid, name, role }]
    const META_KEY = 'pokerole_live_meta';   // { tid: time of the last edit seen }
    const APP_ID = 'pokerole-dynamic-sheets-live-v1';
    const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    const PAGE = (typeof renderAll === 'function' && typeof trainers !== 'undefined') ? 'trainer'
        : (typeof inTrainerMode !== 'undefined' ? 'card' : null);
    if (!PAGE) return;
    const transport = window.PokeroleLiveTransport || window.TrysteroNostr;
    if (!transport || typeof transport.joinRoom !== 'function') {
        console.warn('Live sheets: transport library missing');
        return;
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------
    function readJSON(key, fallback) {
        try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
        catch (e) { return fallback; }
    }
    const origSetItem = Storage.prototype.setItem;
    function writeJSON(key, value) {
        try { origSetItem.call(localStorage, key, JSON.stringify(value)); } catch (e) { }
    }
    function liveEntries() {
        const v = readJSON(LIVE_KEY, []);
        return Array.isArray(v) ? v : [];
    }
    function saveLiveEntries(list) { writeJSON(LIVE_KEY, list); }
    function getMeta(tid) { return (readJSON(META_KEY, {}) || {})[tid] || 0; }
    function setMeta(tid, t) {
        const m = readJSON(META_KEY, {}) || {};
        m[tid] = Math.max(m[tid] || 0, t);
        writeJSON(META_KEY, m);
    }
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }
    function newCode() {
        const r = new Uint32Array(8);
        crypto.getRandomValues(r);
        let s = '';
        for (let i = 0; i < 8; i++) s += CODE_ALPHABET[r[i] % CODE_ALPHABET.length];
        return s.slice(0, 4) + '-' + s.slice(4);
    }
    function normalizeCode(raw) {
        const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : null;
    }
    function shareLink(code) {
        const base = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
        return base + 'trainer-license.html#live=' + code;
    }
    function toast(html) {
        if (PAGE === 'trainer' && typeof flashToast === 'function') { flashToast(html); return; }
        let t = document.getElementById('live-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'live-toast';
            t.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:10001;'
                + 'padding:9px 16px;border-radius:10px;background:#0b0713ee;color:#fff;font:600 0.85rem Outfit,sans-serif;'
                + 'box-shadow:0 4px 18px #00000080;transition:opacity .25s;pointer-events:none;';
            document.body.appendChild(t);
        }
        t.innerHTML = html;
        t.style.opacity = '1';
        clearTimeout(t._h);
        t._h = setTimeout(() => { t.style.opacity = '0'; }, 2600);
    }

    // ------------------------------------------------------------------
    // Diff / patch: a list of { p: [path...], v } (set) or { p, d: 1 } (delete)
    // ------------------------------------------------------------------
    function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
    function diff(a, b, path, out) {
        if (a === b) return out;
        if (isObj(a) && isObj(b)) {
            for (const k of Object.keys(a)) if (!(k in b)) out.push({ p: path.concat(k), d: 1 });
            for (const k of Object.keys(b)) diff(a[k], b[k], path.concat(k), out);
        } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
            for (let i = 0; i < b.length; i++) diff(a[i], b[i], path.concat(i), out);
        } else if (JSON.stringify(a) !== JSON.stringify(b)) {
            out.push({ p: path, v: b === undefined ? null : b });
        }
        return out;
    }
    function applyOps(root, ops) {
        for (const op of ops) {
            if (!op.p.length) {   // whole document
                Object.keys(root).forEach(k => delete root[k]);
                Object.assign(root, op.v || {});
                continue;
            }
            let o = root;
            for (let i = 0; i < op.p.length - 1; i++) {
                const k = op.p[i];
                if (o[k] === null || typeof o[k] !== 'object') o[k] = (typeof op.p[i + 1] === 'number') ? [] : {};
                o = o[k];
            }
            const last = op.p[op.p.length - 1];
            if (op.d) { if (Array.isArray(o)) o.splice(last, 1); else delete o[last]; }
            else o[last] = op.v;
        }
    }

    // ------------------------------------------------------------------
    // Page adapters: where a live trainer's data lives, and how to redraw
    // ------------------------------------------------------------------
    function workingTrainerData(tid) {
        const w = readJSON(WK, null);
        const t = w && Array.isArray(w.trainers) ? w.trainers.find(x => x.id === tid) : null;
        return t ? t.data : null;
    }

    function hasTrainer(tid) {
        if (PAGE === 'card') return tid === TRAINER_ID;
        return trainers.some(t => t.id === tid);
    }

    /* Run a write to the working set without it being sent back out */
    let applying = 0;
    function quietly(fn) { applying++; try { fn(); } finally { applying--; } }

    /* Keep the cursor where it was across a redraw. Fields save on every
       keystroke, so the model already holds what was typed; only focus and
       the caret need putting back. */
    function withFocusKept(fn) {
        const el = document.activeElement;
        const id = el && el.id;
        let s = null, e = null;
        if (id && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            try { s = el.selectionStart; e = el.selectionEnd; } catch (x) { }
        }
        const y = window.scrollY;
        try { fn(); } finally {
            const now = id ? document.getElementById(id) : null;
            if (now) {
                if (document.activeElement !== now) now.focus({ preventScroll: true });
                if (s !== null) { try { now.setSelectionRange(s, e); } catch (x) { } }
                else if (now.isContentEditable) {
                    try {
                        const r = document.createRange();
                        r.selectNodeContents(now); r.collapse(false);
                        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
                    } catch (x) { }
                }
            }
            if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
        }
    }

    function redrawTrainer() {
        withFocusKept(() => { try { renderAll(); } catch (e) { console.warn('Live sheets: redraw', e); } });
    }

    function cardEntryJson() {
        try { const en = trainerMonEntry(readWorking()); return en ? JSON.stringify(en) : null; }
        catch (e) { return null; }
    }
    let lastCardEntry = null;
    function refreshCard() {
        const w = readWorking();
        const en = trainerMonEntry(w);
        const now = en ? JSON.stringify(en) : null;
        if (now === lastCardEntry) return;
        lastCardEntry = now;
        if (!en) return;
        /* Evolved (or otherwise re-specied) on the other device: the card is
           built for one species, so reopen it as the new one */
        if (en.dexId && pokemonData && pokemonData.pokemon && en.dexId !== pokemonData.pokemon._id) {
            const u = new URL(location.href);
            u.searchParams.set('pokemon', en.dexId);
            location.replace(u.toString());
            return;
        }
        withFocusKept(() => {
            try {
                loadState();
                if (typeof syncAbilityInUse === 'function') syncAbilityInUse();
                applyTheme();
                renderStaticInfo();
                const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
                set('exp-input', sheetState.exp || 0);
                set('notes-area', sheetState.notes || '');
                set('held-item-input', sheetState.heldItem || '');
                set('nature-input', sheetState.nature || '');
                set('rank-input', sheetState.rank || '');
                set('nickname-input', sheetState.nickname || '');
                renderTrackers();
                renderStats();
                renderSkills();
                renderCategories();
                renderSpecialties();
                renderMoves();
                if (typeof updateQuickMoves === 'function') updateQuickMoves();
                if (typeof refreshMoveTotals === 'function') refreshMoveTotals();
            } catch (e) {
                console.warn('Live sheets: card redraw failed, reloading', e);
                location.reload();
            }
        });
    }

    /* Trainer page: pull a trainer's data from the working set into memory
       (another tab on this device, e.g. a Pokémon card, wrote it) */
    function pullTrainerFromWorking(tid, data) {
        const i = trainers.findIndex(t => t.id === tid);
        if (i < 0 || !data) return false;
        const cur = i === activeTrainer ? sheetState : trainers[i].data;
        if (JSON.stringify(cur) === JSON.stringify(data)) return false;
        trainers[i].data = normalizeState(data);
        if (i === activeTrainer) sheetState = trainers[i].data;
        return true;
    }

    /* Apply changes from another device to this tab */
    function applyRemote(tid, ops, ts) {
        if (PAGE === 'trainer') {
            const i = trainers.findIndex(t => t.id === tid);
            if (i < 0) return;
            // Make sure memory holds the latest from any card tab first
            pullTrainerFromWorking(tid, workingTrainerData(tid));
            const target = i === activeTrainer ? sheetState : trainers[i].data;
            applyOps(target, ops);
            trainers[i].data = target;
            quietly(() => saveWorkingSet());
            base[tid] = JSON.stringify(target);
            if (i === activeTrainer) redrawTrainer();
            else { try { renderTrainerNav(); updateSaveIndicator(); } catch (e) { } }
        } else {
            const w = readWorking();
            const t = w && Array.isArray(w.trainers) ? w.trainers.find(x => x.id === tid) : null;
            if (!t) return;
            applyOps(t.data, ops);
            quietly(() => { try { localStorage.setItem(WK, JSON.stringify(w)); } catch (e) { } });
            base[tid] = JSON.stringify(t.data);
            refreshCard();
        }
        if (ts) setMeta(tid, ts);
    }

    /* Replace (or add) a whole trainer with the copy from another device */
    function adoptTrainer(tid, data, ts, name) {
        if (PAGE === 'trainer') {
            const norm = normalizeState(data);
            const i = trainers.findIndex(t => t.id === tid);
            if (i >= 0) {
                trainers[i].data = norm;
                if (i === activeTrainer) sheetState = norm;
            } else {
                const entry = { id: tid, handle: null, fileName: null, data: norm, savedJson: null };
                /* An untouched blank card is just a placeholder: replace it */
                const onlyBlank = trainers.length === 1 && !trainers[0].handle
                    && typeof isDirty === 'function' && !isDirty(trainers[0]);
                if (onlyBlank) trainers = [entry];
                else trainers.push(entry);
                activeTrainer = trainers.length - 1;
                sheetState = norm;
                const lm = document.getElementById('license-landing-modal');
                if (lm) lm.style.display = 'none';
                toast('<i class="fa-solid fa-tower-broadcast"></i> Joined ' + esc(norm.name || name || 'the trainer') + ' live');
            }
            quietly(() => saveWorkingSet());
            base[tid] = JSON.stringify(trainers.find(t => t.id === tid).data);
            redrawTrainer();
        } else {
            const w = readWorking();
            const t = w && Array.isArray(w.trainers) ? w.trainers.find(x => x.id === tid) : null;
            if (!t) return;
            t.data = data;
            quietly(() => { try { localStorage.setItem(WK, JSON.stringify(w)); } catch (e) { } });
            base[tid] = JSON.stringify(data);
            refreshCard();
        }
        setMeta(tid, ts || 0);
    }

    // ------------------------------------------------------------------
    // Rooms
    // ------------------------------------------------------------------
    const rooms = {};   // code -> { room, sendHello, sendOps, peers:Set, error }
    const base = {};    // tid -> JSON of the last state this tab knew

    function currentData(tid) {
        if (PAGE === 'trainer') {
            const i = trainers.findIndex(t => t.id === tid);
            if (i < 0) return null;
            return i === activeTrainer ? sheetState : trainers[i].data;
        }
        return workingTrainerData(tid);
    }

    function entryFor(code) { return liveEntries().find(e => e.code === code); }

    function joinCodeRoom(code) {
        const cfg = Object.assign({ appId: APP_ID, password: 'pokerole:' + code },
            window.PokeroleLiveConfig || {});
        const r = { peers: new Set(), error: null };
        r.room = transport.joinRoom(cfg, 'pokerole-' + code, {
            onJoinError: (d) => {
                r.error = (d && d.error) || 'connection failed';
                console.warn('Live sheets:', d);
                updateBadge();
            }
        });
        const hello = r.room.makeAction('hello');
        const opsA = r.room.makeAction('ops');
        r.sendHello = hello.send;
        r.sendOps = opsA.send;

        r.room.onPeerJoin = (peerId) => {
            r.peers.add(peerId);
            r.error = null;
            updateBadge();
            const e = entryFor(code);
            if (!e) return;
            const data = e.tid ? currentData(e.tid) : null;
            hello.send({ tid: e.tid || null, role: e.role, name: e.name || '', lastEdit: e.tid ? getMeta(e.tid) : 0, data },
                { target: peerId });
        };
        r.room.onPeerLeave = (peerId) => { r.peers.delete(peerId); updateBadge(); };

        hello.onMessage = (h) => {
            if (!h || !h.tid) return;
            const list = liveEntries();
            const e = list.find(x => x.code === code);
            if (!e) return;
            if (!e.tid) {   // first contact for a guest: learn which trainer this is
                if (PAGE !== 'trainer') return;
                e.tid = h.tid;
                e.name = h.name || (h.data && h.data.name) || '';
                saveLiveEntries(list);
            } else if (e.tid !== h.tid) return;
            if (!h.data) return;
            if (!hasTrainer(h.tid)) {
                if (PAGE === 'trainer') adoptTrainer(h.tid, h.data, h.lastEdit, h.name);
                return;
            }
            const mine = getMeta(h.tid);
            const theirs = h.lastEdit || 0;
            const differs = JSON.stringify(currentData(h.tid)) !== JSON.stringify(h.data);
            /* Newer copy wins; on a tie the guest takes the host's copy */
            if (differs && (theirs > mine || (theirs === mine && e.role === 'guest' && h.role === 'host'))) {
                adoptTrainer(h.tid, h.data, theirs);
            }
            updateBadge();
        };
        opsA.onMessage = (m) => {
            if (!m || !Array.isArray(m.ops)) return;
            const e = entryFor(code);
            if (!e || e.tid !== m.tid) return;
            applyRemote(m.tid, m.ops, m.ts);
        };
        rooms[code] = r;
    }

    function leaveCodeRoom(code) {
        const r = rooms[code];
        if (!r) return;
        try { r.room.leave(); } catch (e) { }
        delete rooms[code];
    }

    function wantedCodes() {
        return liveEntries().filter(e => {
            if (!e.tid) return PAGE === 'trainer';
            return hasTrainer(e.tid);
        }).map(e => e.code);
    }

    function reconcile() {
        const want = new Set(wantedCodes());
        Object.keys(rooms).forEach(c => { if (!want.has(c)) leaveCodeRoom(c); });
        want.forEach(c => {
            if (!rooms[c]) {
                const e = entryFor(c);
                if (e && e.tid) base[e.tid] = JSON.stringify(currentData(e.tid));
                joinCodeRoom(c);
            }
        });
        updateBadge();
        if (PAGE === 'trainer') renderLiveModal();
    }

    // ------------------------------------------------------------------
    // Outgoing: diff every local write of the working set
    // ------------------------------------------------------------------
    let diffTimer = null;
    function scheduleDiff() {
        clearTimeout(diffTimer);
        diffTimer = setTimeout(sendLocalChanges, 120);
    }
    function sendLocalChanges() {
        const w = readJSON(WK, null);
        if (!w || !Array.isArray(w.trainers)) return;
        Object.keys(rooms).forEach(code => {
            const e = entryFor(code);
            if (!e || !e.tid) return;
            const t = w.trainers.find(x => x.id === e.tid);
            if (!t) return;
            const now = JSON.stringify(t.data);
            if (base[e.tid] === undefined) { base[e.tid] = now; return; }
            if (now === base[e.tid]) return;
            let ops;
            try { ops = diff(JSON.parse(base[e.tid]), t.data, [], []); }
            catch (x) { ops = [{ p: [], v: t.data }]; }
            base[e.tid] = now;
            if (!ops.length) return;
            const ts = Date.now();
            setMeta(e.tid, ts);
            const r = rooms[code];
            if (r.peers.size) r.sendOps({ tid: e.tid, ts, ops }).catch(err => console.warn('Live sheets: send', err));
        });
    }

    Storage.prototype.setItem = function (k, v) {
        origSetItem.call(this, k, v);
        if (this === localStorage && k === WK && !applying && Object.keys(rooms).length) scheduleDiff();
        if (this === localStorage && k === WK && PAGE === 'trainer') setTimeout(reconcileIfMembershipChanged, 0);
    };

    let lastMembership = '';
    function reconcileIfMembershipChanged() {
        const m = trainers.map(t => t.id).join(',');
        if (m === lastMembership) return;
        lastMembership = m;
        reconcile();
    }

    /* Another tab on this device wrote the working set or the live list */
    window.addEventListener('storage', (ev) => {
        if (ev.storageArea !== localStorage) return;
        if (ev.key === LIVE_KEY) { reconcile(); return; }
        if (ev.key !== WK || !Object.keys(rooms).length) return;
        let w = null;
        try { w = JSON.parse(ev.newValue); } catch (e) { return; }
        if (!w || !Array.isArray(w.trainers)) return;
        let redraw = false;
        Object.keys(rooms).forEach(code => {
            const e = entryFor(code);
            if (!e || !e.tid) return;
            const t = w.trainers.find(x => x.id === e.tid);
            if (!t) return;
            /* That tab sends its own changes out; this one just catches up */
            base[e.tid] = JSON.stringify(t.data);
            if (PAGE === 'trainer' && pullTrainerFromWorking(e.tid, t.data)
                && trainers[activeTrainer] && trainers[activeTrainer].id === e.tid) redraw = true;
        });
        if (PAGE === 'trainer' && redraw) redrawTrainer();
        if (PAGE === 'card') refreshCard();
    });

    // ------------------------------------------------------------------
    // Public actions (trainer page)
    // ------------------------------------------------------------------
    function goLive() {
        const tid = sheetState.id;
        const list = liveEntries();
        if (list.some(e => e.tid === tid)) { renderLiveModal(); return; }
        const code = newCode();
        list.push({ code, tid, name: sheetState.name || '', role: 'host' });
        saveLiveEntries(list);
        /* Mark this copy as the freshest so it wins against stale ones */
        setMeta(tid, Date.now());
        reconcile();
    }
    function stopLive(code) {
        saveLiveEntries(liveEntries().filter(e => e.code !== code));
        reconcile();
    }
    function joinLive(raw) {
        const code = normalizeCode(raw);
        if (!code) { toast('<i class="fa-solid fa-triangle-exclamation"></i> A live code has 8 letters and numbers, like ABCD-2345'); return false; }
        const list = liveEntries();
        if (!list.some(e => e.code === code)) {
            list.push({ code, tid: null, name: '', role: 'guest' });
            saveLiveEntries(list);
        }
        reconcile();
        toast('<i class="fa-solid fa-tower-broadcast"></i> Connecting to ' + code + '…');
        return true;
    }

    // ------------------------------------------------------------------
    // UI: status pill (both pages), Live button + window (trainer page)
    // ------------------------------------------------------------------
    const style = document.createElement('style');
    style.textContent = `
        #live-pill { position: fixed; left: 12px; bottom: 12px; z-index: 9000; display: none;
            align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px; cursor: pointer;
            font: 600 0.78rem Outfit, sans-serif; color: #fff; background: #0b0713e6;
            border: 1px solid var(--border-color, #ffffff33); box-shadow: 0 2px 12px #00000080; }
        #live-pill .dot, #live-btn .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }
        #live-pill.ok .dot, #live-btn.ok .live-dot { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        #live-pill.err .dot, #live-btn.err .live-dot { background: #ef4444; }
        #live-btn { position: relative; }
        #live-btn .live-dot { position: absolute; top: 3px; right: 3px; display: none; }
        #live-btn.on .live-dot { display: block; }
        .live-code { font: 700 1.6rem/1.2 'Outfit', monospace; letter-spacing: 0.12em; text-align: center;
            padding: 10px; border-radius: 10px; border: 1px dashed var(--border-color, #ffffff44); user-select: all; }
        .live-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; font: 600 1rem Outfit, sans-serif;
            text-transform: uppercase; letter-spacing: 0.08em; background: transparent; color: inherit;
            border: 1px solid var(--border-color, #ffffff44); }
        .live-row { display: flex; gap: 8px; }
        .live-row > * { flex: 1; }
        .live-sub { font-size: 0.78rem; opacity: 0.75; text-align: center; margin: 4px 0 0; }
        .live-sep { border: 0; border-top: 1px solid var(--border-color, #ffffff22); margin: 14px 0; }
        .live-list { margin: 0 0 6px; padding: 0; list-style: none; font-size: 0.85rem; }
        .live-list li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; }
    `;
    document.head.appendChild(style);

    const pill = document.createElement('div');
    pill.id = 'live-pill';
    pill.innerHTML = '<span class="dot"></span><span class="txt"></span>';
    pill.title = 'Live sheet';
    pill.addEventListener('click', () => { if (PAGE === 'trainer') openLiveModal(); });
    document.body.appendChild(pill);

    function status() {
        const codes = Object.keys(rooms);
        let peers = 0, err = false;
        codes.forEach(c => { peers += rooms[c].peers.size; if (rooms[c].error && !rooms[c].peers.size) err = true; });
        return { on: codes.length > 0, peers, err };
    }
    function updateBadge() {
        const s = status();
        pill.style.display = s.on ? 'flex' : 'none';
        pill.classList.toggle('ok', s.peers > 0);
        pill.classList.toggle('err', s.err);
        pill.querySelector('.txt').textContent = s.err ? 'Live · can’t connect'
            : s.peers ? 'Live · ' + s.peers + ' connected' : 'Live · waiting…';
        const btn = document.getElementById('live-btn');
        if (btn) {
            btn.classList.toggle('on', s.on);
            btn.classList.toggle('ok', s.peers > 0);
            btn.classList.toggle('err', s.err);
        }
        if (PAGE === 'trainer') renderLiveModal();
    }

    let modal = null;
    function openLiveModal() {
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'live-modal';
            modal.style.display = 'none';
            modal.addEventListener('click', (e) => { if (e.target === modal) closeLiveModal(); });
            modal.innerHTML = '<div class="modal-box" style="max-width:400px;">'
                + '<button class="modal-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>'
                + '<div class="modal-title"><i class="fa-solid fa-tower-broadcast" style="color: var(--ghost-color);"></i> Live sheet</div>'
                + '<div class="live-body"></div></div>';
            modal.querySelector('.modal-close-btn').addEventListener('click', closeLiveModal);
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        renderLiveModal();
    }
    function closeLiveModal() { if (modal) modal.style.display = 'none'; }

    function renderLiveModal() {
        if (!modal || modal.style.display === 'none') return;
        const body = modal.querySelector('.live-body');
        const list = liveEntries();
        const cur = list.find(e => e.tid === sheetState.id);
        let html = '';
        if (cur) {
            const r = rooms[cur.code];
            const n = r ? r.peers.size : 0;
            const state = (r && r.error && !n) ? 'Couldn’t reach the other device. Check both are online, or try another network.'
                : n ? n + ' other device' + (n === 1 ? ' is' : 's are') + ' connected. Edits show up on both.'
                : 'Waiting for someone to join…';
            html += '<p class="modal-text"><strong>' + esc(sheetState.name || 'This trainer') + '</strong> is live. '
                + 'Send your player this code or link:</p>'
                + '<div class="live-code">' + esc(cur.code) + '</div>'
                + '<p class="live-sub">' + esc(state) + '</p>'
                + '<div class="modal-actions live-row" style="margin-top:12px;">'
                + '<button class="form-btn save" data-act="copy" data-code="' + esc(cur.code) + '"><i class="fa-solid fa-link"></i> Copy link</button>'
                + '<button class="form-btn danger" data-act="stop" data-code="' + esc(cur.code) + '"><i class="fa-solid fa-power-off"></i> Stop</button>'
                + '</div>';
        } else {
            html += '<p class="modal-text">Share <strong>' + esc(sheetState.name || 'this trainer') + '</strong> with another device. '
                + 'Every change made on either one shows up on the other.</p>'
                + '<div class="modal-actions"><button class="form-btn save" style="width:100%;" data-act="share">'
                + '<i class="fa-solid fa-tower-broadcast"></i> Go live with this trainer</button></div>';
        }
        const others = list.filter(e => e !== cur);
        if (others.length) {
            html += '<hr class="live-sep"><p class="modal-text" style="margin-bottom:4px;">Also live on this device:</p><ul class="live-list">'
                + others.map(e => {
                    const r = rooms[e.code];
                    const n = r ? r.peers.size : 0;
                    return '<li><span>' + esc(e.name || (e.tid ? 'Trainer' : 'Joining…')) + ' · ' + esc(e.code)
                        + ' · ' + (n ? n + ' connected' : 'waiting') + '</span>'
                        + '<button class="form-btn cancel" style="padding:4px 10px;" data-act="stop" data-code="' + esc(e.code) + '">Stop</button></li>';
                }).join('') + '</ul>';
        }
        html += '<hr class="live-sep"><p class="modal-text" style="margin-bottom:6px;">Got a code from someone else?</p>'
            + '<div class="live-row"><input class="live-input" id="live-join-input" placeholder="ABCD-2345" maxlength="9" autocomplete="off">'
            + '<button class="form-btn save" style="flex:0 0 auto;" data-act="join">Join</button></div>';

        const focusedJoin = document.activeElement && document.activeElement.id === 'live-join-input';
        const typed = focusedJoin ? document.activeElement.value : '';
        body.innerHTML = html;
        if (focusedJoin) { const i = body.querySelector('#live-join-input'); i.value = typed; i.focus(); }
    }

    function bindModalActions() {
        document.addEventListener('click', (ev) => {
            const b = ev.target.closest && ev.target.closest('#live-modal [data-act]');
            if (!b) return;
            const act = b.getAttribute('data-act');
            const code = b.getAttribute('data-code');
            if (act === 'share') goLive();
            else if (act === 'stop') stopLive(code);
            else if (act === 'join') {
                const i = document.getElementById('live-join-input');
                if (joinLive(i && i.value)) closeLiveModal();
            } else if (act === 'copy') {
                const link = shareLink(code);
                const done = () => toast('<i class="fa-solid fa-link"></i> Link copied');
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => prompt('Copy this link:', link));
                else prompt('Copy this link:', link);
            }
        });
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && ev.target && ev.target.id === 'live-join-input') {
                if (joinLive(ev.target.value)) closeLiveModal();
            }
        });
    }

    function installTrainerUi() {
        const save = document.getElementById('save-all-btn');
        if (save && save.parentNode) {
            const btn = document.createElement('button');
            btn.className = 'type-eff-btn';
            btn.id = 'live-btn';
            btn.title = 'Live sheet: share this trainer with another device, or join one';
            btn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i><span class="live-dot"></span>';
            btn.addEventListener('click', openLiveModal);
            save.parentNode.insertBefore(btn, save);
        }
        /* Landing: a guest with nothing on disk goes straight to "join" */
        const landing = document.getElementById('license-landing-modal');
        const actions = landing && landing.querySelector('.modal-actions');
        if (actions) {
            const jb = document.createElement('button');
            jb.className = 'form-btn cancel';
            jb.style.width = '100%';
            jb.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Join a live sheet';
            jb.addEventListener('click', () => {
                landing.style.display = 'none';
                openLiveModal();
                setTimeout(() => { const i = document.getElementById('live-join-input'); if (i) i.focus(); }, 30);
            });
            actions.appendChild(jb);
        }
        bindModalActions();
    }

    function joinFromHash() {
        const m = /(?:^|[#&])live=([A-Za-z0-9-]+)/.exec(location.hash);
        if (!m) return;
        history.replaceState(null, '', location.href.split('#')[0]);
        const code = normalizeCode(m[1]);
        if (!code) return;
        const landing = document.getElementById('license-landing-modal');
        if (landing) landing.style.display = 'none';
        joinLive(code);
    }

    // ------------------------------------------------------------------
    // Start
    // ------------------------------------------------------------------
    if (PAGE === 'card') {
        if (!inTrainerMode) return;
        lastCardEntry = cardEntryJson();
    }
    if (PAGE === 'trainer') {
        installTrainerUi();
        lastMembership = trainers.map(t => t.id).join(',');
        /* The landing may open after this script runs; a #live link skips it */
        setTimeout(joinFromHash, 0);
        window.addEventListener('hashchange', joinFromHash);
    }
    reconcile();

    window.PokeroleLive = { goLive: PAGE === 'trainer' ? goLive : undefined, joinLive, stopLive, rooms, status };
})();
