import { sendAsync, sendSignal } from "./communication";
import MessageTypes from "./messageTypes";

const playerCache = new Map<string, Player>();
const nameCache = new Map<string, Promise<string | null>>();

const enum PlayerProp {
    DISPLAY_NAME = 0,
    EXHAUSTION = 1,
    EXP = 2,
    FLY_SPEED = 3,
    FOOD_LEVEL = 4,
    HEALTH_SCALE = 5,
    LEVEL = 6,

    PERMISSIONS = 0x100,
    PERMISSION_MATCHING = 0x101,

    UUID = 0x200,
}

/**
 * An object which represents a specific player.
 */
export class Player {
    /**
     * Get a player by their UUID.
     * @param {string} uuid UUID of the player to reference
     * @returns {Player} a Player which represent the player with the UUID
     */
    public static get(uuid: string): Player {
        if (playerCache.has(uuid)) {
            return playerCache.get(uuid) as Player;
        } else {
            const p = new Player(uuid);
            playerCache.set(uuid, p);
            return p;
        }
    }

    /**
     * Get the UUID of a player by their name.
     * @param {string} name name of the player to lookup
     * @returns {Promise<string | null>} a Promise which resolves to a UUID when the player is found and null otherwise
     */
    public static uuidByName(name: string): Promise<string | null> {
        if (nameCache.has(name)) {
            return nameCache.get(name) as Promise<string | null>;
        } else {
            const d = sendAsync<Buffer>(MessageTypes.GET_PLAYER, PlayerProp.UUID, Buffer.from(name, "utf8"))
                .then((x) => x && x.length ? x.toString("utf8") : null);
            nameCache.set(name, d);
            return d;
        }
    }

    /**
     * Get a player by their name.
     * @param {string} name name of the player to lookup
     * @returns {Promise<Player | null>} a Player which represent the player with the UUID
     */
    public static getByName(name: string): Promise<Player | null> {
        return this.uuidByName(name).then((uuid) => {
            if (uuid === null) {
                return null;
            }
            if (playerCache.has(uuid)) {
                return playerCache.get(uuid) as Player;
            } else {
                const p = new Player(uuid);
                playerCache.set(uuid, p);
                return p;
            }
        });
    }

    private readonly buffered = new Map<PlayerProp, Promise<any>>();
    private readonly uuidBuff: Buffer;

    /**
     * Create a new player reference.
     * @param {string} uuid UUID of the player
     */
    private constructor(public readonly uuid: string) {
        this.uuidBuff = Buffer.from(uuid.replace(/-/g, ""), "hex");
    }

    /**
     * Get the display name of the player.
     * @type {string  | Promise<string>}
     */
    public get displayName(): string | Promise<string> {
        let p: Promise<string> = this.buffered.get(PlayerProp.DISPLAY_NAME) as Promise<string>;
        if (!p) {
            p = sendAsync<Buffer>(MessageTypes.GET_PLAYER, PlayerProp.DISPLAY_NAME, this.uuidBuff)
                .then((x) => x.toString("utf-8"));
            this.buffered.set(PlayerProp.DISPLAY_NAME, p);
        }
        return p;
    }

    /**
     * Set the display name of the player.
     * @type {string  | Promise<string>}
     */
    public set displayName(name: string | Promise<string>) {
        Promise.resolve(name).then((n) => {
            sendSignal(MessageTypes.SET_PLAYER, PlayerProp.DISPLAY_NAME,
                Buffer.concat([ this.uuidBuff, Buffer.from(n, "utf-8") ]));
            this.buffered.delete(PlayerProp.DISPLAY_NAME);
        });
        this.buffered.delete(PlayerProp.DISPLAY_NAME);
    }

    /**
     * Get exhaustion as a float number.
     * @type {number  | Promise<number>}
     */
    public get exhaustion(): number | Promise<number> {
        let p: Promise<number> = this.buffered.get(PlayerProp.EXHAUSTION) as Promise<number>;
        if (!p) {
            p = sendAsync<number>(MessageTypes.GET_PLAYER, PlayerProp.EXHAUSTION, this.uuidBuff)
                .then((x) => x * 0.01);
            this.buffered.set(PlayerProp.EXHAUSTION, p);
            p.then(() => {
                this.buffered.delete(PlayerProp.EXHAUSTION);
            });
        }
        return p;
    }

    /**
     * Set exhaustion as a float number.
     * @type {number  | Promise<number>}
     */
    public set exhaustion(exh: number | Promise<number>) {
        Promise.resolve(exh).then((n) => {
            // tslint:disable-next-line:no-bitwise
            const s = (n * 100) | 0;
            sendSignal(MessageTypes.SET_PLAYER, PlayerProp.EXHAUSTION,
                // tslint:disable-next-line:no-bitwise
                Buffer.concat([ this.uuidBuff, Buffer.from([ s >> 8, s & 0xFF ]) ]));
            this.buffered.delete(PlayerProp.EXHAUSTION);
        });
        this.buffered.delete(PlayerProp.EXHAUSTION);
    }

    /**
     * Get experience ratio as a float number between 0.0 and 1.0.
     * @type {number  | Promise<number>}
     */
    public get exp(): number | Promise<number> {
        let p: Promise<number> = this.buffered.get(PlayerProp.EXP) as Promise<number>;
        if (!p) {
            p = sendAsync<number>(MessageTypes.GET_PLAYER, PlayerProp.EXP, this.uuidBuff)
                .then((x) => x * 0.01);
            this.buffered.set(PlayerProp.EXP, p);
            p.then(() => {
                this.buffered.delete(PlayerProp.EXP);
            });
        }
        return p;
    }

    /**
     * Set experience ratio as a float number between 0.0 and 1.0.
     * @type {number  | Promise<number>}
     */
    public set exp(exh: number | Promise<number>) {
        Promise.resolve(exh).then((n) => {
            // tslint:disable-next-line:no-bitwise
            const s = (n * 10000) | 0;
            sendSignal(MessageTypes.SET_PLAYER, PlayerProp.EXP,
                // tslint:disable-next-line:no-bitwise
                Buffer.concat([ this.uuidBuff, Buffer.from([ s >> 8, s & 0xFF ]) ]));
            this.buffered.delete(PlayerProp.EXP);
        });
        this.buffered.delete(PlayerProp.EXP);
    }

    /**
     * Sends messages to the player.
     * @param {string[]} messages messages to send
     * @returns {Promise<void>} when the message has been flushed
     */
    public sendMessage(...messages: string[]): Promise<void> {
        const len = messages.length;
        if (len === 0) {
            return Promise.resolve();
        } else if (len === 1) {
            return sendSignal(MessageTypes.MSG_PLAYER,
                Buffer.concat([ this.uuidBuff, Buffer.from(messages[0], "utf-8") ]));
        } else {
            const b = Buffer.concat(messages.reduce((p, d) => {
                const dp = Buffer.from(d, "utf-8");
                const dl = dp.length;
                // tslint:disable-next-line:no-bitwise
                p.push(Buffer.from([ dl >> 8, dl & 0xFF ]));
                p.push(dp);
                return p;
            }, [this.uuidBuff] as Buffer[]));
            if (b.length >= 0x8000) {
                throw new RangeError("Messages are too large in bytes.");
            }
            return sendSignal(MessageTypes.MSG_PLAYER_MULTI, b);
        }
    }

    /**
     * Check if player has access to the specified permissions.
     * @param {string[]} perms permissions to check for
     * @returns {Promise<string[]>} a subset of permissions to which the player has access
     */
    public hasPermissions(...perms: string[]): Promise<string[]> {
        perms = perms.filter((x) => x ? true : false);
        if (perms.length === 0) {
            return Promise.resolve([]);
        }
        const p = Buffer.concat([ this.uuidBuff, Buffer.from(perms.join(","), "utf8") ]);
        return sendAsync<number>(MessageTypes.GET_PLAYER, PlayerProp.PERMISSIONS, p).then((x) => {
            const ret: string[] = [];
            for (let i = 0; i < perms.length && x !== 0; i++) {
                // tslint:disable-next-line:no-bitwise
                if ((x & 0x01) === 1) {
                    ret.push(perms[i]);
                }
                // tslint:disable-next-line:no-bitwise
                x >>= 1;
            }
            return ret;
        });
    }

    /**
     * Check if player has access to the specified permission.
     * @param {string} perm permission to check for
     * @returns {Promise<boolean>} a subset of permissions to which the player has access
     */
    public hasPermission(perm: string): Promise<boolean> {
        return this.hasPermissions(perm).then((r) => r.length ? true : false);
    }

    /**
     * Check player access to permissions matching the provided pattern.
     * @param {RegExp} pattern pattern for permissions
     * @returns {Promise<Array<[string, boolean]>>} a set of matching permissions and their value
     */
    public matchingPermissions(pattern: RegExp): Promise<Array<[string, boolean]>> {
        const p = Buffer.concat([ this.uuidBuff, Buffer.from(pattern.source, "utf8") ]);
        return sendAsync<Buffer>(MessageTypes.GET_PLAYER, PlayerProp.PERMISSION_MATCHING, p).then((b) => {
            const v: Array<[string, any]> = JSON.parse(b.toString("utf8"));
            for (const e of v) {
                e[1] = Boolean(e[1]);
            }
            return v;
        });
    }

    /**
     * Set a players permissions.
     * @param {string[]} perms permissions to set
     * @returns {Promise<void>} resolves when the request has been passed to the server
     */
    public setPermissions(...perms: string[]): Promise<void> {
        perms = perms.filter((x) => x ? true : false);
        if (perms.length === 0) {
            return Promise.resolve();
        }
        const p = Buffer.concat([ this.uuidBuff, Buffer.from(perms.join(","), "utf8") ]);
        return sendSignal(MessageTypes.GET_PLAYER, PlayerProp.PERMISSIONS, p);
    }

    /**
     * Set a players permissions temporarily.
     * @param {number} ticks number of ticks the permission is active
     * @param {string[]} perms permissions to set
     * @returns {Promise<void>} resolves when the request has been passed to the server
     */
    public setTempPermissions(ticks: number, ...perms: string[]): Promise<void> {
        perms = perms.filter((x) => x ? true : false);
        if (perms.length === 0) {
            return Promise.resolve();
        }
        const p = Buffer.concat([
            this.uuidBuff,
            // tslint:disable-next-line:no-bitwise
            Buffer.from([(ticks >> 24) & 0xFF, (ticks >> 16) & 0xFF, (ticks >> 8) & 0xFF, ticks & 0xFF]),
            Buffer.from(perms.join(","), "utf8"),
        ]);
        return sendSignal(MessageTypes.GET_PLAYER, PlayerProp.PERMISSION_MATCHING, p);
    }
}

export default Player;
