import { joinRoom as nostrJoinRoom } from '@trystero-p2p/nostr';
import type { JoinRoom, NostrRoomConfig, Room } from '@trystero-p2p/nostr';
import type { TableTransport, TransportHandlers } from './transport';

/* The table without a relay: browsers connect to each other directly.

   Used whenever no relay has been deployed (see relay.ts). Trystero finds the
   other browsers in the room through public Nostr relays and then opens WebRTC
   data channels between them, so there is nothing to host. The room is named
   by the same derived address the relay would be told, and the wire strings
   are the same sealed, signed envelopes — this file only carries them, so no
   security decision moves.

   Two differences from a relay, both handled here:
   - Nobody to hold a message for: a send with no one connected reports
     failure, so the session queues a player's roll request and replays it.
   - A new browser arriving is the moment to say hello. Each arrival re-reports
     'online', which is what makes the session announce itself and flush that
     queue, exactly as it does when a relay socket reopens. */

const APP_ID = 'pokerole-rolling-table-v1';

function joinRoom(): JoinRoom<NostrRoomConfig> {
    /* The test harness swaps in a local relay through this seam. */
    const w = window as unknown as { PokeroleLiveTransport?: { joinRoom: JoinRoom<NostrRoomConfig> } };
    return w.PokeroleLiveTransport?.joinRoom || nostrJoinRoom;
}

export class PeerTransport implements TableTransport {
    private room: Room | null = null;
    private sendText: ((text: string) => Promise<void>) | null = null;
    private peers = new Set<string>();

    constructor(private addr: string, private handlers: TransportHandlers) {}

    start(): void {
        this.handlers.onStatus('connecting', '');
        const extra = (window as unknown as { PokeroleLiveConfig?: object }).PokeroleLiveConfig || {};
        const room = joinRoom()({ appId: APP_ID, password: this.addr, ...extra }, 'table-' + this.addr, {
            onJoinError: (d) => {
                console.warn('Rolling table:', d);
                if (!this.peers.size) {
                    this.handlers.onStatus('online', 'Couldn’t connect directly to another player. '
                        + 'Some school, office or mobile networks block it; try another network.');
                }
            },
        });
        const msg = room.makeAction('m');
        msg.onMessage = (data) => { if (typeof data === 'string') this.handlers.onMessage(data); };
        room.onPeerJoin = (id) => {
            this.peers.add(id);
            this.handlers.onStatus('online', '');
        };
        room.onPeerLeave = (id) => { this.peers.delete(id); };
        this.sendText = (text) => msg.send(text);
        this.room = room;
        /* In the room as soon as it is joined, as a relay socket is once open:
           a GM sitting alone can already roll into the feed. */
        this.handlers.onStatus('online', '');
    }

    stop(): void {
        const room = this.room;
        this.room = null;
        this.sendText = null;
        this.peers.clear();
        if (room) void room.leave().catch(() => { /* already gone */ });
        this.handlers.onStatus('offline', '');
    }

    get connected(): boolean {
        return this.room !== null && this.peers.size > 0;
    }

    send(text: string): boolean {
        if (!this.sendText || !this.peers.size) return false;
        this.sendText(text).catch((e) => console.warn('Rolling table: send', e));
        return true;
    }
}
