// tslint:disable:max-classes-per-file

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

/** A way to store data */
export interface IStorageBackend {
    /** Store data */
    set(key: string, value: any): Promise<void>;
    /** Get stored data */
    get<T>(key: string): undefined | T | Promise<undefined | T>;
}

/** An interface which is used to hold a storage backend and cache. */
export interface IBackendProxy {
    /** A storage backend */
    backend: IStorageBackend;
    /** A cache used for storing iterms previously fetched */
    cache: Map<string, any>;
    /** An object to store symbol properties on */
    symbols?: any;
}

/**
 * Stores one JSON file per plugin.
 */
class JSONStorageBackend implements IStorageBackend {
    private readonly file: string;
    private lastSave = Promise.resolve();
    private queuedWrites: boolean = false;
    private readonly data = new Map<string, string>();
    private loaded: Promise<Map<string, string>> | null = null;
    private isLoaded: boolean = false;
    private readonly pluginVersion: string;

    public constructor(pluginName: string, pluginVersion: string) {
        this.pluginVersion = JSON.stringify(pluginVersion);
        // tslint:disable-next-line:max-line-length
        const fn = "backend." + pluginName.replace(/[^0-9a-zA-Z]/g, (s) => "-" + s.charCodeAt(0).toString(16)) + ".json";
        this.file = join(".config", fn);
    }

    public set(key: string, value: any) {
        // set
        if (value === undefined) {
            this.data.delete(value);
        } else {
            this.data.set(key, JSON.stringify(value));
        }

        // store
        if (!this.queuedWrites) {
            this.queuedWrites = true;
            this.lastSave = this.lastSave.then(() => this.store());
        }
        return this.lastSave;
    }

    public get<T>(key: string): undefined | T | Promise<undefined | T> {
        if (this.isLoaded) {
            const v = this.data.get(key);
            if (!v) {
                return undefined;
            }
            return JSON.parse(v);
        }
        return this.load().then((d) => {
            const v = d.get(key);
            if (!v) {
                return undefined;
            }
            return JSON.parse(v);
        });
    }

    private store(): Promise<void> {
        if (!this.isLoaded) {
            return this.load().then(() => this.store());
        }
        this.data.set("lastStoreVersion", this.pluginVersion);
        const d: string[] = ["{ "];
        let f = true;
        for (const [k, v] of this.data.entries()) {
            if (f) {
                f = false;
            } else {
                d.push(", ");
            }
            d.push(JSON.stringify(k) + ": " + v + "\n");
        }
        d.push("}");
        this.queuedWrites = false;
        return writeFile(this.file, d.join(""), "utf8");
    }

    private load(): Promise<Map<string, string>> {
        if (this.loaded) {
            return this.loaded;
        }
        return this.loaded = readFile(this.file, "utf8")
        .then((v) => JSON.parse(v.replace(/^\s*\/\/.*$/m, "")), (e) => {
            if (e.code === "ENOENT") {
                return [];
            }
            throw e;
        }).then((d) => {
            if (typeof d !== "object") {
                throw new Error("Loading storage using JSON backend requires the JSON file to represent an object.");
            }
            const data = this.data;
            for (const k of Object.keys(d)) {
                if (!data.has(k)) {
                    data.set(k, JSON.stringify(d[k]));
                }
            }
            this.isLoaded = true;
            return data;
        });
    }
}

/**
 * Stores temporary storage which will be deleted when the plugin is reloaded.
 */
class SessionStorageBackend implements IStorageBackend {
    private readonly data = new Map<string, any>();

    public set(key: string, value: any) {
        // set
        if (value === undefined) {
            this.data.delete(value);
        } else {
            this.data.set(key, JSON.parse(JSON.stringify(value)));
        }
        return Promise.resolve();
    }

    public get<T>(key: string): undefined | T {
        return this.data.get(key);
    }
}

/**
 * Stores one JSON file per plugin.
 */
export function jsonStorageBackend(pluginName: string, pluginVersion: string): IStorageBackend {
    return new JSONStorageBackend(pluginName, pluginVersion);
}

/**
 * Temporary storage which will never be stored at rest, a fresh storage is used when the plugin is reloaded.
 */
export function sessionStorageBackend(): IStorageBackend {
    return new SessionStorageBackend();
}

function backendSet(target: IBackendProxy, prop: PropertyKey, val: any) {
    if (typeof prop === "symbol") {
        if (!target.symbols) {
            target.symbols = {};
        }
        target.symbols[prop] = val;
    } else {
        const k = prop.toString();
        target.backend.set(k, val);
        target.cache.delete(k);
    }
    return true;
}

function backendGet(target: IBackendProxy, prop: PropertyKey) {
    if (typeof prop === "symbol") {
        if (!target.symbols) {
            target.symbols = {};
        }
        return target.symbols[prop];
    } else {
        const k = prop.toString();
        if (target.cache.has(k)) {
            return target.cache.get(k);
        } else {
            const p = Promise.resolve(target.backend.get(k)).then((v) => {
                if (target.cache.get(k) === p) {
                    target.cache.set(k, v);
                }
                return v;
            });
            target.cache.set(k, p);
            return p;
        }
    }
}

export const backendHandler: ProxyHandler<IBackendProxy> = {
    apply(target, _, args?: any[]) {
        if (!args || args.length === 0 || args.length > 2) {
            throw new Error("Calling storage requires one argument for get or to arguments for set.");
        }
        const prop: PropertyKey = args[0];
        if (args.length === 2) {
            return backendSet(target, prop, args[1]);
        } else {
            return Promise.resolve(backendGet(target, prop));
        }
    },
    deleteProperty(target, prop: PropertyKey) {
        if (typeof prop === "symbol") {
            if (target.symbols) {
                delete target.symbols[prop];
            }
        } else {
            const k = prop.toString();
            target.cache.delete(k);
            target.backend.set(k, undefined);
            return true;
        }
        return false;
    },
    get: backendGet,
    set: backendSet,
};
