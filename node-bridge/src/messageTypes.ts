export const enum MessageTypes {
    EXIT = 0,
    ENABLE = 1,

    EXECUTE_COMMAND = 2,
    COMPLETE_COMMAND = 3,

    GET_PLAYER = 4,
    SET_PLAYER = 5,
    MSG_PLAYER = 6,
    MSG_PLAYER_MULTI = 7,

    REPLY = 31,
}

export default MessageTypes;
