package net.timluq.mc.nodespigotbridge;

public enum PlayerField {
    DISPLAY_NAME(0),
    EXHAUSTION(1),
    EXP(2),
    FLY_SPEED(3),
    FOOD_LEVEL(4),
    HEALTH_SCALE(5),
    LEVEL(6),
    
    PERMISSIONS(0x100),
    PERMISSIONS_MATCHING(0x101);

    public final int number;

    private PlayerField(int v) {
        this.number = v;
    }

    public static PlayerField fromInt(int v) {
        switch (v) {
            case     0: return DISPLAY_NAME;
            case     1: return EXHAUSTION;
            case     2: return EXP;
            case     3: return FLY_SPEED;
            case     4: return FOOD_LEVEL;
            case     5: return HEALTH_SCALE;
            case     6: return LEVEL;
            case 0x100: return PERMISSIONS;
            case 0x101: return PERMISSIONS_MATCHING;
        }
        throw new IndexOutOfBoundsException(v);
    }
}
