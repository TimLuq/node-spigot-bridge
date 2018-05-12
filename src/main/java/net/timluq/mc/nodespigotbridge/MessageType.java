package net.timluq.mc.nodespigotbridge;

public enum MessageType {
    EXIT(0),
    ENABLE(1),

    EXECUTE_COMMAND(2),
    COMPLETE_COMMAND(3),

    GET_PLAYER(4),
    SET_PLAYER(5),
    MSG_PLAYER(6),
    MSG_PLAYER_MULTI(7),

    ERROR(30),
    REPLY(31);

    public final int number;
    private MessageType(int num) {
        this.number = num;
    }

    public static MessageType fromInt(int v) {
        switch (v) {
            case  0: return MessageType.EXIT;
            case  1: return MessageType.ENABLE;
            case  2: return MessageType.EXECUTE_COMMAND;
            case  3: return MessageType.COMPLETE_COMMAND;
            case  4: return MessageType.GET_PLAYER;
            case  5: return MessageType.SET_PLAYER;
            case  6: return MessageType.MSG_PLAYER;
            case  7: return MessageType.MSG_PLAYER_MULTI;
            case 30: return MessageType.ERROR;
            case 31: return MessageType.REPLY;
        }
        throw new IndexOutOfBoundsException(v);
    }
}
