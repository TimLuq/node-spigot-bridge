// tslint:disable:max-classes-per-file

export type PluginErrors = "COMMAND_RESERVED" | "JAVA_ERROR";

export abstract class PluginError extends Error {
    public abstract get type(): PluginErrors;
}

export class CommandReservedError extends PluginError {
    public readonly type: "COMMAND_RESERVED" = "COMMAND_RESERVED";
}

export class JavaError extends PluginError {
    public readonly type: "JAVA_ERROR" = "JAVA_ERROR";
    public constructor(message: string, public readonly className: string) {
        super(message);
    }
}
