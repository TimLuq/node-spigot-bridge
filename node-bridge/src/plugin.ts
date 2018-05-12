import { messageHandlers, sendReply, sendSignal } from "./communication";
import { CommandReservedError } from "./errors";
import { IMessage } from "./messages";
import { MessageTypes } from "./messageTypes";
import { backendHandler, IStorageBackend, jsonStorageBackend } from "./storage-backend";

/**
 * Options used when registering a command.
 */
export interface ICommandOptions {
    /** A description of the command */
    description?: string;
    /** A label for this command */
    label?: string;
    /** Permission needed to execute this command */
    permission?: string;
    /** A message sent if the sender is lacking in permission */
    permissionMessage?: string;
    /** Sets that this command is synchronous and should block until the command has resolved */
    sync?: boolean;
    /** Description on how to use the command */
    usage?: string;
}

/** Over the wire sturcture for command registration */
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

/**
 * The entity which invoked the command.
 */
export interface ICommandSender {
    /** The java class name of the sending entity */
    className: string;
    /** Operator status of the sending entity */
    op: boolean;
    /** If the sending entity was a player this is their UUID */
    player?: string;
}

/**
 * Callback when a command is invoked.
 */
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

/**  */
export interface IPluginStorage {
    /** Gets a stored property */
    <T>(key: PropertyKey): Promise<T | undefined>;
    /** Sets a property */
    (key: PropertyKey, value: any): Promise<void>;
    /** The version of the plugin which were used last time a property was saved.  */
    readonly lastStoreVersion?: Promise<string>;
    [k: string]: any;
}

// tslint:disable-next-line:interface-name
export interface Plugin<S extends IPluginStorage = IPluginStorage> {
    /** Called when the plugin is activated. */
    start?(): void;
    /** Called when the plugin is to be stopped. */
    stop?(): void;
}

/** Symbol to store the storage proxy on */
const symStorage = Symbol("storage");

/**
 * A plugin instance.
 */
export abstract class Plugin<S extends IPluginStorage> {
    /** Name of this plugin */
    public abstract get name(): string;
    /** Version of this plugin */
    public abstract get version(): string;

    /**
     * Storage is a plugin specific storage area.
     *
     * Which storage engine is used is decided by the function `getStorageBackend`,
     * which may be overridden if a specific storage method is needed.
     */
    public get storage(): S {
        return (this as any)[symStorage] || ((this as any)[symStorage] =
            // tslint:disable-next-line:max-line-length
            new Proxy({ cache: new Map<string, any>(), backend: this.getStorageBackend(this.name, this.version) }, backendHandler));
    }

    /**
     * Register a command which may be invoked by a command sender, such as a player.
     *
     * @param {string} command command to register
     * @param {function} commandHandler callback to run when command is called
     * @param {object?} options optional options for command
     * @returns {Promise<void>} promise which resolves when command has been sent to be registered
     */
    public registerCommand(command: string, commandHandler: CommandHandler, options?: ICommandOptions): Promise<void> {
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
     * @param {string} pluginName name of the plugin
     * @param {string} pluginVersion version of thew plugin
     */
    protected getStorageBackend(pluginName: string, pluginVersion: string): IStorageBackend {
        return jsonStorageBackend(pluginName, pluginVersion);
    }
}

/**
 * Interface is the JSON sent over the bridge connection.
 */
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
