package net.timluq.mc.nodespigotbridge;

public class InputMessage {
    public final MessageType type;
    public byte[] binaryValue = null;
    public Short shortValue = null;
    public Short reply = null;

    public InputMessage(MessageType type) {
        this.type = type;
    }
}