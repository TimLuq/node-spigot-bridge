import { JavaError } from "./errors";
import { IMessage, Messages } from "./messages";
import { MessageTypes } from "./messageTypes";

type FReply = [(b?: Buffer | number) => void, (e: Error) => void];

let syncIndex: number = 0;
const waitingReply = new Map<number, FReply>();

/**
 * Global message handlers. Key is of type MessageTypes
 */
export const messageHandlers = new Map<MessageTypes, (m: IMessage) => void>();

export function init() {
    new Messages(process.stdin, (m: IMessage) => {
        if (m.type === MessageTypes.REPLY && m.syncId !== undefined) {
            const repl = waitingReply.get(m.syncId) as FReply;
            try {
                repl[0](m.data);
            } catch (e) {
                // tslint:disable-next-line:no-console
                console.error(e);
            }
            waitingReply.delete(m.syncId);
            return;
        }
        if (m.type === MessageTypes.ERROR && m.syncId !== undefined) {
            const repl = waitingReply.get(m.syncId) as FReply;
            try {
                const j = JSON.parse((m.data as Buffer).toString("utf8"));
                const e = new JavaError(j.m, j.c);
                for (const k of Object.keys(j)) {
                    if (k !== "m" && k !== "c") {
                        (e as any)[k] = j[k];
                    }
                }
                repl[1](e);
            } catch (e) {
                // tslint:disable-next-line:no-console
                console.error(e);
            }
            waitingReply.delete(m.syncId);
            return;
        }
        const h = messageHandlers.get(m.type);
        if (h) {
            h(m);
            return;
        }
        if (m.syncId !== undefined) {
            sendReply(m.syncId);
            return;
        }
    }).start();
}

let lastSend: Promise<void> = Promise.resolve();

function send(...buffers: Buffer[]): Promise<void> {
    return lastSend = lastSend.then(() => new Promise<any | (() => Promise<any>)>((s) => {
        // tslint:disable-next-line:no-console
        console.warn("node-spigot-bridge: Sending data...");
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < buffers.length; i++) {
            if (!process.stdout.write(buffers[i])) {
                process.stdout.once("drain", () => {
                    if (i + 1 === buffers.length) {
                        s();
                    } else {
                        const f: () => Promise<void> = () => send(...buffers.slice(i + 1));
                        s(f);
                    }
                });
                return;
            }
        }
        s();
    })).then((f?: () => Promise<void>) => {
        if (f) {
            return f();
        }
        return;
    });
}

// tslint:disable-next-line:max-line-length
export function sendAsync<R extends Buffer | number | undefined>(type: MessageTypes, data?: Buffer | number): Promise<R>;
// tslint:disable-next-line:max-line-length
export function sendAsync<R extends Buffer | number | undefined>(type: MessageTypes, shortData: number, bufferData: Buffer): Promise<R>;
// tslint:disable-next-line:max-line-length
export function sendAsync<R extends Buffer | number | undefined>(type: MessageTypes, data?: Buffer | number, bufferData?: Buffer): Promise<R> {
    const idx = syncIndex;
    // tslint:disable-next-line:no-bitwise
    syncIndex = (syncIndex + 1) & 0x7FFF;

    const bs: Buffer[] = [Buffer.alloc(3)];
    if (typeof data === "number") {
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = type | 0xA0;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = data >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = data & 0xFF;

        if (typeof bufferData === "object") {
            // tslint:disable-next-line:no-bitwise
            bs[0][0] = type | 0xE0;
            bs.push(Buffer.from([
                // tslint:disable-next-line:no-bitwise
                bufferData.length >> 8,
                // tslint:disable-next-line:no-bitwise
                bufferData.length & 0xFF,
            ]));
            bs.push(bufferData);
        }

        // tslint:disable-next-line:no-bitwise
        bs.push(Buffer.from([idx >> 8, idx & 0xFF]));
    } else if (typeof data === "object") {
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = type | 0xC0;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = data.length >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = data.length & 0xFF;
        bs.push(data);
        // tslint:disable-next-line:no-bitwise
        bs.push(Buffer.from([idx >> 8, idx & 0xFF]));
    } else {
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = type | 0x80;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = idx >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = idx & 0xFF;
    }

    return new Promise<R>((s, r) => {
        waitingReply.set(idx, [s, r] as FReply);
        send(...bs).catch(r);
    });
}

export function sendSignal(type: MessageTypes, data?: Buffer | number): Promise<void>;
export function sendSignal(type: MessageTypes, shortData: number, bufferData: Buffer): Promise<void>;
export function sendSignal(type: MessageTypes, data?: Buffer | number, bufferData?: Buffer): Promise<void> {
    const bs: Buffer[] = [];
    if (typeof data === "number") {
        bs.push(Buffer.from([
            // tslint:disable-next-line:no-bitwise
            type | 0x20,
            // tslint:disable-next-line:no-bitwise
            data >> 8,
            // tslint:disable-next-line:no-bitwise
            data & 0xFF,
        ]));

        if (typeof bufferData === "object") {
            // tslint:disable-next-line:no-bitwise
            bs[0][0] = type | 0x60;
            bs.push(Buffer.from([
                // tslint:disable-next-line:no-bitwise
                bufferData.length >> 8,
                // tslint:disable-next-line:no-bitwise
                bufferData.length & 0xFF,
            ]));
            bs.push(bufferData);
        }
    } else if (typeof data === "object") {
        bs.push(Buffer.from([
            // tslint:disable-next-line:no-bitwise
            type | 0x40,
            // tslint:disable-next-line:no-bitwise
            data.length >> 8,
            // tslint:disable-next-line:no-bitwise
            data.length & 0xFF,
        ]));
        bs.push(data);
    } else {
        bs.push(Buffer.from([ type ]));
    }

    return send(...bs);
}

/**
 * Sends a reply to a message initiated by the java plugin.
 * @param idx replyId
 * @param data data to reply with
 */
export function sendReply(idx: number, data?: Buffer | number): Promise<void> {
    const bs: Buffer[] = [Buffer.alloc(3)];
    if (typeof data === "number") {
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = MessageTypes.REPLY | 0xA0;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = data >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = data & 0xFF;
        // tslint:disable-next-line:no-bitwise
        bs.push(Buffer.from([idx >> 8, idx & 0xFF]));
    } else if (typeof data === "object") {
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = MessageTypes.REPLY | 0xC0;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = data.length >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = data.length & 0xFF;
        bs.push(data);
        // tslint:disable-next-line:no-bitwise
        bs.push(Buffer.from([idx >> 8, idx & 0xFF]));
    } else {
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = MessageTypes.REPLY | 0x80;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = idx >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = idx & 0xFF;
    }
    return send(...bs);
}

/**
 * Respond with an error.
 * @param idx replyId
 * @param error error message
 */
export function sendError(idx: number, error?: Error | string): Promise<void> {
    const s = error && error.toString();
    const bs: Buffer[] = [Buffer.alloc(3)];
    if (s && s.length) {
        const data = Buffer.from(s, "utf8");
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = MessageTypes.REPLY | 0xC0;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = data.length >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = data.length & 0xFF;
        bs.push(data);
        // tslint:disable-next-line:no-bitwise
        bs.push(Buffer.from([idx >> 8, idx & 0xFF]));
    } else {
        // tslint:disable-next-line:no-bitwise
        bs[0][0] = MessageTypes.REPLY | 0x80;
        // tslint:disable-next-line:no-bitwise
        bs[0][1] = idx >> 8;
        // tslint:disable-next-line:no-bitwise
        bs[0][2] = idx & 0xFF;
    }
    return send(...bs);
}
