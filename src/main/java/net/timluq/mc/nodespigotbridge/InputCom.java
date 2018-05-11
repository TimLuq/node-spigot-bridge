package net.timluq.mc.nodespigotbridge;

import java.io.IOException;
import java.io.InputStream;
import java.util.function.Consumer;

public class InputCom extends Thread implements Runnable {

    private final InputStream stream;
    private final Consumer<InputMessage> consumer;
    private final JavaBridge bridge;

    public InputCom(JavaBridge bridge, InputStream stream, Consumer<InputMessage> consumer) {
        super("NodeSpigotBridge-InputCom");
        this.bridge = bridge;
        this.stream = stream;
        this.consumer = consumer;
        this.setName("NodeSpigotBridge-InputCom-" + this.hashCode());
    }

	@Override
	public void run() {
        final byte[] b = new byte[65536];
        int rc = 0;
        int rl = 1;
		try {
            while (!Thread.interrupted()) {
                int r = this.stream.read(b, rc, 65536 - rc);
                if (r == -1) {
                    break;
                }
                bridge.getLogger().info("received " + r + " bytes of input");
                rc += r;
                while (rc >= rl) {
                    boolean hasShortData = (b[0] & 0x20) != 0;
                    boolean hasBinaryData = (b[0] & 0x40) != 0;
                    boolean doReply = (b[0] & 0x80) != 0;
                    int neededLength = 1;
                    int binLen = 0;
                    if (hasShortData) {
                        neededLength += 2;
                    }
                    if (hasBinaryData) {
                        if (rc - 2 >= neededLength) {
                            binLen = ((((int) b[neededLength]) & 0xFF) << 8) | (((int) b[neededLength + 1]) & 0xFF);
                            neededLength += binLen;
                        }
                        neededLength += 2;
                    }
                    if (doReply) {
                        neededLength += 2;
                    }
                    if (rc < neededLength) {
                        rl = neededLength;
                        bridge.getLogger().info("total received " + rc + " is less than expected " + rl);
                        break;
                    }
                    rl = 1;
                    InputMessage m = new InputMessage(MessageType.fromInt(b[0] & 0x1F));
                    if (hasShortData) {
                        m.shortValue = (short) (((((int) b[1]) & 0xFF) << 8) | (((int) b[2]) & 0xFF));
                    }
                    if (hasBinaryData) {
                        m.binaryValue = new byte[binLen];
                        if (binLen != 0) {
                            System.arraycopy(b, hasShortData ? 5 : 3, m.binaryValue, 0, binLen);
                        }
                    }
                    if (doReply) {
                        m.reply = (short) (((((int) b[neededLength - 2]) & 0xFF) << 8) | (((int) b[neededLength - 1]) & 0xFF));
                    }
                    rc -= neededLength;
                    if (rc != 0) {
                        System.arraycopy(b, neededLength, b, 0, rc);
                    }
                    bridge.getLogger().info("triggering message of type " + String.valueOf(m.type));
                    try {
                        this.consumer.accept(m);
                    } catch (Exception ex) {
                        if (ex instanceof InterruptedException){
                            throw ex;
                        }
                        ex.printStackTrace();
                    }
                }
            }
		} catch (IOException e) {
            e.printStackTrace();
		}
    }
}