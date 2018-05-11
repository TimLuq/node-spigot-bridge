import { messageHandlers, sendReply, sendSignal } from "./communication";
import { CommandReservedError } from "./errors";
import { IMessage } from "./messages";
import { MessageTypes } from "./messageTypes";
import { backendHandler, IStorageBackend, JSONStorageBackend } from "./storage-backend";

export interface ICommandOptions {
    description?: string;
    label?: string;
    permission?: string;
    permissionMessage?: string;
    sync?: boolean;
    usage?: string;
}

interface IRegCmd {
    /** alias */
    a: string;
    /** complete */
    c?: string;
    /** description */
    d?: string;
    /** label */
    l?: string;
    /** permission */
    p?: string;
    /** permissionMessage */
    pm?: string;
    /** sync */
    s?: true;
    /** usage */
    u?: string;
}

export interface ICommandSender {
    className: string;
    op: boolean;
    player?: string;
}

// tslint:disable-next-line:max-line-length
export type CommandHandler = (sender: ICommandSender, cmd: string, ...args: string[]) => boolean | Promise<boolean>;

/**
 * Commands that have been registered by some plugin.
 */
export const registeredCommands = new Map<string, [CommandHandler, ICommandOptions | undefined]>();

/**
 * List of plugins which have been registered (in order of registration).
 */
export const registeredPlugins: Array<Plugin<IPluginStorage>> = [];

export interface IPluginStorage {
    <T>(key: PropertyKey): Promise<T | undefined>;
    (key: PropertyKey, value: any): Promise<void>;
    readonly lastStoreVersion?: Promise<string>;
    [k: string]: any;
}

// tslint:disable-next-line:interface-name
export interface Plugin<S extends IPluginStorage = IPluginStorage> {
    start?(): void;
    stop?(): void;
}

const symStorage = Symbol("storage");

/**
 * A plugin instance.
 */
export abstract class Plugin<S extends IPluginStorage> {
    public abstract get name(): string;
    public abstract get version(): string;

    public get storage(): S {
        return (this as any)[symStorage] || ((this as any)[symStorage] =
            // tslint:disable-next-line:max-line-length
            new Proxy({ cache: new Map<string, any>(), backend: this.getStorageBackend(this.name, this.version) }, backendHandler));
    }

    public registerCommand(command: string, commandHandler: CommandHandler, options?: ICommandOptions) {
        if (registeredCommands.has(command)) {
            throw new CommandReservedError("Command is already reserved: " + command);
        }
        registeredCommands.set(command, [commandHandler, options]);
        const cmd: IRegCmd = { a: command };
        if (options) {
            if (options.description) {
                cmd.d = options.description;
            }
            if (options.label) {
                cmd.l = options.label;
            }
            if (options.permission) {
                cmd.p = options.permission;
            }
            if (options.permissionMessage) {
                cmd.pm = options.permissionMessage;
            }
            if (options.sync) {
                cmd.s = true;
            }
            if (options.usage) {
                cmd.u = options.usage;
            }
        }
        return sendSignal(MessageTypes.COMPLETE_COMMAND, Buffer.from(JSON.stringify(cmd), "utf8"));
    }

    /**
     * Called when enstablishing a storage location for the plugin.
     * @param pluginName name of the plugin
     * @param pluginVersion version of thew plugin
     */
    protected getStorageBackend(pluginName: string, pluginVersion: string): IStorageBackend {
        return new JSONStorageBackend(pluginName, pluginVersion);
    }
}

interface IExeCommand {
    /** command alias */
    a: string;
    /** parameters */
    p?: string[];
    /** sender */
    s: {
        /** sender class */
        c: string;
        /** sender is op */
        op?: true;
        /** uuid if sender is player */
        p?: string;
    };
}

messageHandlers.set(MessageTypes.EXECUTE_COMMAND, (m: IMessage) => {
    const j = (m.data as Buffer).toString("utf8");
    // tslint:disable-next-line:no-console
    console.warn("node-spigot-bridge: parsing command JSON: " + j);
    const e: IExeCommand = JSON.parse(j);
    const c = registeredCommands.get(e.a);
    if (!c) {
        // tslint:disable-next-line:no-console
        console.warn("node-spigot-bridge: call to unregistered command: " + JSON.stringify(e.a));
        if (m.syncId !== undefined) {
            sendReply(m.syncId, 0);
        }
        return;
    }
    const s: ICommandSender = {
        className: e.s.c,
        op: e.s.op ? true : false,
    };
    if (e.s.p) {
        s.player = e.s.p;
    }
    c[0](s, e.a, ...(e.p || []));
});

export default Plugin;
