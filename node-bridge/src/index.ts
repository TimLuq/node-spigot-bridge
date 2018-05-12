import initialize from "./initialize";

if (process.mainModule === module) {
    require.cache["spigot-bridge"] = module;
    initialize();
}

export { CommandReservedError, PluginError, PluginErrors } from "./errors";
export { Player } from "./player";
export { CommandHandler, Plugin, Plugin as default, IPluginStorage, ICommandOptions, ICommandSender } from "./plugin";
export { IStorageBackend, jsonStorageBackend, sessionStorageBackend } from "./storage-backend";
