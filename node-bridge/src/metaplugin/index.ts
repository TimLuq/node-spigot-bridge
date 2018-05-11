import Plugin, { ICommandSender, registeredPlugins } from "../plugin";

import Player from "../player";

class MetaPlugin extends Plugin {
    public readonly name = "node-spigot-bridge";
    public readonly version = "0.1.0";

    public start() {
        this.registerCommand("nodejs", (s, a, subcommand) => this.nodejs(s, a, subcommand), {
            description: "Status for node-spigot-bridge.",
            permission: "nodejs.info",
            usage: "<command> version|plugins",
        });
    }

    private nodejs(sender: ICommandSender, _: string, subcommand?: string) {
        if (!subcommand) {
            if (sender.player) {
                return Player.get(sender.player)
                    .sendMessage("node.js is running plugins")
                    .then(() => true);
            }
            return false;
        }
        if (subcommand === "version") {
            if (sender.player) {
                return Player.get(sender.player)
                    .sendMessage(this.name + "@" + this.version)
                    .then(() => true);
            }
            return false;
        }
        if (subcommand === "plugins") {
            if (sender.player) {
                return Player.get(sender.player)
                    .sendMessage(...registeredPlugins.map((p) => p.name + "@" + p.version))
                    .then(() => true);
            }
            return false;
        }
        return true;
    }
}

export default MetaPlugin;
