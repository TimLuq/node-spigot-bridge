import initialize from "./initialize";

if (process.mainModule === module) {
    require.cache["node-spigot-bridge"] = module;
    initialize();
}

export { IMessage } from "./messages";
export { Player } from "./player";
export { Plugin, Plugin as default, IPluginStorage, ICommandOptions, ICommandSender } from "./plugin";
