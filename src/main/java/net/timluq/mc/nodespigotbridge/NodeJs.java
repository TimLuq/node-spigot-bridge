package net.timluq.mc.nodespigotbridge;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.ProcessBuilder.Redirect;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public class NodeJs {
    private final String executable;
    private final String startScript;
    private final File directory;

    private static final int SEND_SHORT = 0x20;
    private static final int SEND_SYNC = 0x80;
    private static final int SEND_BUFFER = 0x40;

    protected final Object syncOutput = new Object();

    private final HashMap<Short, CompletableFuture<InputMessage>> syncCallbacks = new HashMap<Short, CompletableFuture<InputMessage>>();
    private short syncIndex = 0;

    private InputCom inputCom = null;
    private Process nodeProcess = null;
    private final JavaBridge bridge;

    public NodeJs(JavaBridge bridge, File directory, String executable, String startScript) {
        this.bridge = bridge;
        this.directory = directory;
        this.executable = executable;
        this.startScript = startScript;
    }

    public void start(Consumer<InputMessage> consumer) throws IOException {
        if (!this.directory.isDirectory()) {
            this.directory.mkdirs();
        }

        ProcessBuilder procb = new ProcessBuilder(this.executable, this.startScript);
        procb.directory(this.directory);
        procb.redirectInput(Redirect.PIPE);
        procb.redirectError(Redirect.INHERIT);
        procb.redirectOutput(Redirect.PIPE);

        this.nodeProcess = procb.start();
        this.inputCom = new InputCom(this.bridge, this.nodeProcess.getInputStream(), (m) -> {
            if (m.type == MessageType.REPLY) {
                syncCallbacks.remove(m.reply).complete(m);
            } else {
                consumer.accept(m);
            }
        });
        this.inputCom.start();
    }

    public void stop() throws InterruptedException {
        final Process p;
        synchronized (this.syncOutput) {
            if (this.nodeProcess == null) {
                return;
            }
            try {
                OutputStream o = this.nodeProcess.getOutputStream();
                o.write(0);
                o.flush();
                o.close();
            } catch (IOException e) {
                e.printStackTrace();
                this.nodeProcess.destroy();
            }
            p = this.nodeProcess;
            this.nodeProcess = null;
            this.inputCom = null;
        }
        p.onExit().completeOnTimeout(null, 16000, TimeUnit.MILLISECONDS).thenAccept((v) -> {
            if (v == null) {
                p.destroy();
                try {
                    p.waitFor(500, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    p.destroyForcibly();
                }
            }
        });
    }
    

    public void sendString(MessageType com, CharSequence data) throws IOException {
        this.sendString(com, data, false);
    }
    
    public CompletableFuture<InputMessage> sendString(MessageType com, CharSequence stringdata, boolean sync) throws IOException {
        final byte[] data = stringdata == null ? null : stringdata.toString().getBytes(StandardCharsets.UTF_8);
        return sendBytes(com, data, sync);
    }
    
    public CompletableFuture<InputMessage> sendBytes(MessageType com, byte[] data, boolean sync) throws IOException {
        if (com == MessageType.REPLY) {
            throw new RuntimeException("Explicit MessageType.REPLY is denied for sendBytes. Use sendReplyBytes instead.");
        }
        final CompletableFuture<InputMessage> future = sync ? new CompletableFuture<InputMessage>() : null;
        int l = 1;
        synchronized (this.syncOutput) {
            int n = com.number;
            short s = 0;
            if (sync) {
                n |= SEND_SYNC;
                this.syncCallbacks.put(s = syncIndex, future);
                syncIndex = (short) ((syncIndex + 1) & 0x7FFF);
            }
            final OutputStream o = this.nodeProcess.getOutputStream();
            if (data == null) {
                o.write(n);
            } else {
                o.write(n | SEND_BUFFER);
                o.write(data.length >> 8);
                o.write(data.length & 0xFF);
                o.write(data);
                l += 2 + data.length;
            }
            if (sync) {
                l += 2;
                o.write(s >> 8);
                o.write(s & 0xFF);
            }
            o.flush();
        }
        this.bridge.getLogger().info("sendBytes(): sent " + l + " bytes of data (payload = " + (data == null ? "null" : String.valueOf(data.length)) + ")");
        return future;
    }

    public void sendShort(MessageType com, short data) throws IOException {
        this.sendShort(com, data, false);
    }

    public CompletableFuture<InputMessage> sendShort(MessageType com, short data, boolean sync) throws IOException {
        if (com == MessageType.REPLY) {
            throw new RuntimeException("Explicit MessageType.REPLY is denied for sendShort. Use sendReplyShort instead.");
        }
        final CompletableFuture<InputMessage> future = sync ? new CompletableFuture<InputMessage>() : null;
        int l = 3;
        synchronized (this.syncOutput) {
            int n = com.number;
            short s = 0;
            if (sync) {
                n |= SEND_SYNC;
                this.syncCallbacks.put(s = syncIndex, future);
                syncIndex = (short) ((syncIndex + 1) & 0x7FFF);
            }
            final OutputStream o = this.nodeProcess.getOutputStream();
            o.write(n | SEND_SHORT);
            o.write((data >> 8) & 0xFF);
            o.write(data & 0xFF);
            if (sync) {
                o.write(s >> 8);
                o.write(s & 0xFF);
                l += 2;
            }
            o.flush();
        }
        this.bridge.getLogger().info("sendShort(): sent " + l + " bytes of data");
        return future;
    }

    public void sendReplyShort(short replyId, short data) throws IOException {
        synchronized (this.syncOutput) {
            final OutputStream o = this.nodeProcess.getOutputStream();
            o.write(MessageType.REPLY.number | SEND_SYNC | SEND_SHORT);
            o.write((data >> 8) & 0xFF);
            o.write(data & 0xFF);
            o.write(replyId >> 8);
            o.write(replyId & 0xFF);
            o.flush();
        }
    }

    public void sendReplySignal(short replyId) throws IOException {
        synchronized (this.syncOutput) {
            final OutputStream o = this.nodeProcess.getOutputStream();
            o.write(MessageType.REPLY.number | SEND_SYNC);
            o.write(replyId >> 8);
            o.write(replyId & 0xFF);
            o.flush();
        }
    }

    public void sendReplyString(short replyId, CharSequence stringdata) throws IOException {
        final byte[] data = stringdata == null ? null : stringdata.toString().getBytes(StandardCharsets.UTF_8);
        sendReplyBytes(replyId, data);
    }

    public void sendReplyBytes(short replyId, byte[] data) throws IOException {
        synchronized (this.syncOutput) {
            final OutputStream o = this.nodeProcess.getOutputStream();
            int n = MessageType.REPLY.number | SEND_SYNC;
            if (data == null) {
                o.write(n);
            } else {
                o.write(n | SEND_BUFFER);
                o.write(data.length >> 8);
                o.write(data.length & 0xFF);
                o.write(data);
            }
            o.write(replyId >> 8);
            o.write(replyId & 0xFF);
            o.flush();
        }
    }
}
