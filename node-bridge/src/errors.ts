// tslint:disable:max-classes-per-file

export type PluginErrors = "COMMAND_RESERVED";

export abstract class PluginError extends Error {
    public abstract get type(): PluginErrors;
}

export class CommandReservedError extends PluginError {
    public readonly type: "COMMAND_RESERVED" = "COMMAND_RESERVED";
}
