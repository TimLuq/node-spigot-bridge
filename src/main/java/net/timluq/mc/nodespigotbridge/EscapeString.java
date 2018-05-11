package net.timluq.mc.nodespigotbridge;

import java.io.IOException;
import java.util.UUID;

@SuppressWarnings("unchecked")
public final class EscapeString {
    private static final char[] hexchars = new char[] { '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f' };
    public static <T extends Appendable>T escape(T sb, CharSequence data) throws IOException {
        final int l = data.length();
        for (int i = 0; i < l; i++) {
            char c = data.charAt(i);
            if (c == 8) {
                sb = (T) sb.append("\\t");
            } else if (c == 10) {
                sb = (T) sb.append("\\n");
            } else if (c == 13) {
                sb = (T) sb.append("\\r");
            } else if (c == '"') {
                sb = (T) sb.append("\\\"");
            } else if (c < 32 || c > 126) {
                String s = Integer.toHexString(c);
                sb = (T) sb.append("\\u");
                for (int j = 4 - s.length(); j >= 0; j--) {
                    sb = (T) sb.append('0');
                }
                sb = (T) sb.append(s);
            } else {
                sb = (T) sb.append(c);
            }
        }
        return sb;
    }

    public static String getUUIDString(byte[] bytes) {
        char[] cs = new char[36];
        for (int i = 0; i < 4; i++) {
            cs[i * 2 + 0] = hexchars[(bytes[i] >> 4) & 0x0F];
            cs[i * 2 + 1] = hexchars[bytes[i] & 0x0F];
        }
        cs[8] = '-';
        for (int i = 4; i < 6; i++) {
            cs[i * 2 + 1] = hexchars[(bytes[i] >> 4) & 0x0F];
            cs[i * 2 + 2] = hexchars[bytes[i] & 0x0F];
        }
        cs[13] = '-';
        for (int i = 6; i < 8; i++) {
            cs[i * 2 + 2] = hexchars[(bytes[i] >> 4) & 0x0F];
            cs[i * 2 + 3] = hexchars[bytes[i] & 0x0F];
        }
        cs[18] = '-';
        for (int i = 8; i < 10; i++) {
            cs[i * 2 + 3] = hexchars[(bytes[i] >> 4) & 0x0F];
            cs[i * 2 + 4] = hexchars[bytes[i] & 0x0F];
        }
        cs[23] = '-';
        for (int i = 10; i < 16; i++) {
            cs[i * 2 + 4] = hexchars[(bytes[i] >> 4) & 0x0F];
            cs[i * 2 + 5] = hexchars[bytes[i] & 0x0F];
        }
        return String.valueOf(cs);
    }

    public static UUID getUUID(byte[] bytes) {
        return UUID.fromString(getUUIDString(bytes));
    }

    public static byte[] fromUUID(UUID uuid) {
        final byte[] bs = new byte[16];
        final long a = uuid.getMostSignificantBits();
        final long b = uuid.getLeastSignificantBits();
        for (int i = 0; i < 8; i++) {
            bs[i] = (byte) ((a >> (64 - ((1 + i) * 8))) & 0xFF);
        }
        for (int i = 0; i < 8; i++) {
            bs[i + 8] = (byte) ((b >> (64 - ((1 + i) * 8))) & 0xFF);
        }
        return bs;
    }
}
