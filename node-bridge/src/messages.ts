import { Writable } from "stream";
import { MessageTypes } from "./messageTypes";

export interface IMessage {
    syncId?: number;
    type: MessageTypes;
    data?: Buffer | number;
}

export class Messages extends Writable {

    // tslint:disable-next-line:variable-name
    private static _write(this: Messages, chunk: Buffer, _encoding: never, callback: (err?: Error) => void) {
        if (chunk.length) {
            // tslint:disable-next-line:no-console
            console.warn("node-spigot-bridge: received " + chunk.length + " bytes of data");
            this.rest.push(chunk);
            this.processData(callback);
        } else {
            callback();
        }
    }

    // tslint:disable-next-line:variable-name
    private static _writev(this: Messages, chunks: Array<{ chunk: Buffer }>, callback: (err?: Error) => void) {
        const l = chunks.reduce((p, x) => p + x.chunk.length, 0);
        // tslint:disable-next-line:no-console
        console.warn("node-spigot-bridge: received " + l + " bytes of data");
        this.rest.push(...chunks.map((x) => x.chunk).filter((x) => x.length !== 0));
        this.processData(callback);
    }

    private readonly rest: Buffer[] = [];

    public constructor(stream: NodeJS.ReadableStream, private readonly messageHandler: (m: IMessage) => void) {
        super({
            write: Messages._write as any,
            writev: Messages._writev as any,
        });
        stream.pipe(this, { end: true });
    }

    // tslint:disable-next-line:no-empty
    public start() {}

    private processData(callback: (err?: Error) => void) {
        try {
            while (this.rest.length) {
                // first byte: type and mods
                const t = this.rest[0][0];
                const m: IMessage = {
                    // tslint:disable-next-line:no-bitwise
                    type: t & 0x3F,
                };
                // check if data is sent
                // tslint:disable-next-line:no-bitwise
                const hasShortData = (t & 0x20) !== 0;
                // tslint:disable-next-line:no-bitwise
                const hasBufferData = (t & 0x40) !== 0;
                const hasData = hasBufferData || hasShortData;
                // tslint:disable-next-line:no-bitwise
                const isSync = (t & 0x80) !== 0;
                const r = hasData ? this.getInt(1, 2) : 0;
                if (isSync) {
                    m.syncId = this.getInt(hasData ? r + 3 : 1, 2);
                }
                if (!hasData) {
                    this.skip(isSync ? 3 : 1);
                } else if (!hasBufferData) {
                    m.data = r;
                    this.skip(isSync ? 5 : 3);
                } else {
                    // tslint:disable-next-line:no-console
                    console.warn("node-spigot-bridge: extracting payload (" + r + ")");
                    const buff = this.extract(r + (isSync ? 5 : 3));
                    m.data = buff.slice(3, r + 3);
                }
                this.messageHandler(m);
            }
        } catch (e) {
            if (e !== null) {
                // tslint:disable-next-line:no-console
                console.warn("node-spigot-bridge: received processing error:", e);
                callback(e);
            }
        }
        callback();
    }

    private getInt(pos: number, len: number = 4) {
        if (len === 0) {
            return 0;
        }
        let v = 0;
        for (const d of this.rest) {
            if (d.length > pos) {
                while (d.length > pos && len !== 0) {
                    // tslint:disable-next-line:no-bitwise
                    v = (v << 8) | d[pos++];
                    len--;
                }
                if (len === 0) {
                    return v;
                }
            }
            pos -= d.length;
        }
        throw null;
    }

    private skip(pos: number) {
        while (pos !== 0) {
            if (this.rest[0].length <= pos) {
                pos -= this.rest[0].length;
                this.rest.shift();
            } else {
                this.rest[0] = this.rest[0].slice(pos);
            }
        }
    }

    private extract(pos: number) {
        const bs: Buffer[] = [];
        const l = pos;
        let i = 0;
        while (pos !== 0) {
            if (this.rest.length <= i) {
                throw null;
            } else if (this.rest[i].length < pos) {
                pos -= this.rest[i].length;
                bs.push(this.rest[i]);
                i++;
            } else {
                if (this.rest[i].length !== pos) {
                    bs.push(this.rest[i].slice(0, pos));
                    this.rest[i] = this.rest[i].slice(pos);
                } else {
                    bs.push(this.rest[i]);
                    i++;
                }
                pos = 0;
                break;
            }
        }
        if (i !== 0) {
            this.rest.splice(0, i);
        }
        if (pos !== 0) {
            throw null;
        }
        return Buffer.concat(bs, l);
    }
}
