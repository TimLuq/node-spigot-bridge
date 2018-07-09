import { init } from "./communication";

import { promises as fs } from "fs";
import MetaPlugin from "./metaplugin/index";
import { Plugin, registeredPlugins } from "./plugin";

const { readFile, writeFile } = fs;

/** Simplified `package.json` interface */
interface IPackage {
    name: string;
    version: string;

    license?: string;
    private?: boolean;
    flat?: boolean;

    dependencies?: { [k: string]: string; };

    main?: string;
    module?: string;
    spigotmc?: string;
}

/** Overridden plugin loader */
interface IData {
    default: Array<{ new(): Plugin; }> | Promise<Array<{ new(): Plugin; }>>;
    start?(beforeLoad: boolean): Promise<void> | void;
    stop?(): Promise<void>;
}

/**
 * A module exporting a Plugin.
 */
interface IPluginModule {
    default?: { new(): Plugin; } | Promise<{ new(): Plugin; }>;
    Plugin?: { new(): Plugin; } | Promise<{ new(): Plugin; }>;
}

/**
 * Reads the dependency and loads it.
 * @param {string} dep a name of a package dependency
 */
function depToPlugin(dep: string): Promise<{ new(): Plugin; } | null> {
    const dir = "./node_modules/" + dep + "/";
    return readFile(dir + "package.json", "utf8").then(JSON.parse).then((pkg: IPackage) => {
        const main = pkg.spigotmc || pkg.main || "index.js";
        if (!main) {
            throw new Error("No `spigotmc` or `main` definition in package.json");
        }
        const req: IPluginModule = require(dir + main);
        const plugin = req.Plugin || req.default;
        if (!plugin) {
            throw new Error("No exported plugin as `default` or `Plugin`.");
        }
        return Promise.resolve(plugin).then((p) => {
            if (typeof p !== "function" || !p.prototype) {
                throw new Error("Exported type is not a class");
            }
            if (p.prototype === Plugin.prototype) {
                throw new Error("Exported type is a reexport of Plugin");
            }
            if (!(p.prototype instanceof Plugin)) {
                throw new Error("Exported class is not an extension of Plugin");
            }
            try {
                if (!p.prototype.name) {
                    (p.prototype as any).name = pkg.name;
                }
            // tslint:disable-next-line:no-empty
            } catch (_) {}
            try {
                if (!p.prototype.version) {
                    (p.prototype as any).version = pkg.version;
                }
            // tslint:disable-next-line:no-empty
            } catch (_) {}
            return p;
        });
    }).catch((e) => {
        // tslint:disable-next-line:no-console
        console.error("node-spigot-bridge: Failed to load plugin " + JSON.stringify(dep) + ": " + e);
        return null;
    });
}

/**
 * Called to start up plugins.
 */
export default async function initialize() {
    init();
    const plugins: Array<{ new(): Plugin; }> = [
        MetaPlugin,
    ];
    let data: IData | null = null;
    try {
        let pkg: IPackage;
        try {
            pkg = JSON.parse(await readFile("package.json", "utf8"));
        } catch (er) {
            if (er && er.code === "ENOENT") {
                pkg = {
                    dependencies: {},
                    flat: true,
                    license: "PRIVATE",
                    name: "node-spigot-bridge-runtime",
                    private: true,
                    version: "0.0.1",
                };
                writeFile("package.json", JSON.stringify(pkg, null, 4), "utf8").catch(() => null);
            } else {
                throw er;
            }
        }
        const main = pkg.spigotmc || pkg.main;
        if (main) {
            data = require(main);
        } else {
            data = {
                default: Promise.all(Object.keys(pkg.dependencies || {}).map(depToPlugin))
                    .then((a) => a.filter((x) => x ? true : false) as Array<{ new(): Plugin; }>),
            };
        }
        if (!data || !data.default) {
            throw new Error("Initialization script missing default export.");
        }
        const defp = await data.default;
        plugins.push(...defp);
    } catch (e) {
        // tslint:disable-next-line:no-console
        console.error("node-spigot-bridge:", e);
    }

    if (data && data.start) {
        await data.start(true);
    }
    const pstart: Plugin[] = [];
    for (const P of plugins) {
        try {
            const p = new P();
            registeredPlugins.push(p);
            if (p.start) {
                pstart.push(p);
            }
        } catch (e) {
            // tslint:disable-next-line:no-console
            console.error("node-spigot-bridge: failed to instanciate plugin:", e);
        }
    }
    for (const p of pstart) {
        if (p.start) {
            p.start();
        }
    }
    if (data && data.start) {
        await data.start(false);
    }
}
