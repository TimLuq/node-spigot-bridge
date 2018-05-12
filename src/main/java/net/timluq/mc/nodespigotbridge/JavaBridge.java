package net.timluq.mc.nodespigotbridge;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.UUID;
import java.util.logging.Level;

import org.bukkit.Bukkit;
import org.bukkit.command.CommandMap;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.permissions.PermissionAttachment;
import org.bukkit.permissions.PermissionAttachmentInfo;
import org.bukkit.plugin.java.JavaPlugin;

public class JavaBridge extends JavaPlugin {
    protected NodeJs node = null;


    @Override
    public void onEnable() {
        FileConfiguration config = this.getConfig();

        // set defaults
        config.addDefault("directory", "node-plugins");
        config.addDefault("executable", "node");

        config.options().copyDefaults(true);
        this.saveConfig();

        getLogger().info("onEnable is called!");

        try {
            final NodeJs node = this.node = this.startNode();
            node.start((InputMessage m) -> {
                this.getLogger().info("Received message of type: " + String.valueOf(m.type));
                if (m.type == MessageType.COMPLETE_COMMAND) {
                    YamlConfiguration c;
					try {
						c = this.parseJSON(m.binaryValue);
                        try {
                            this.registerCommand(c);
                        } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
                                | IllegalAccessException e) {
                            this.getLogger().log(Level.WARNING, "Failed to register command: " + String.valueOf(c.getString("a", null)), e);
                        }
					} catch (InvalidConfigurationException e1) {
                        this.getLogger().log(Level.WARNING, "Failed to register some command", e1);
                    }
                    return;
                } else if (m.type == MessageType.GET_PLAYER) {
                    if (m.reply == null) {
                        return;
                    }
                    Player p = this.getServer().getPlayer(Encodings.getUUID(m.binaryValue));
                    PlayerField f = PlayerField.fromInt(m.shortValue);
                    try {
                        if (f == PlayerField.DISPLAY_NAME) {
							node.sendReplyString(m.reply, p.getDisplayName());
						} else if (f == PlayerField.EXHAUSTION) {
                            node.sendReplyShort(m.reply, (short) Math.round(p.getExhaustion() * 100));
                        } else if (f == PlayerField.EXP) {
                            node.sendReplyShort(m.reply, (short) Math.round(p.getExp() * 10000));
                        } else if (f == PlayerField.FLY_SPEED) {
                            node.sendReplyShort(m.reply, (short) Math.round(p.getFlySpeed() * 10000));
                        } else if (f == PlayerField.FOOD_LEVEL) {
                            node.sendReplyShort(m.reply, (short) p.getFoodLevel());
                        } else if (f == PlayerField.HEALTH_SCALE) {
                            node.sendReplyShort(m.reply, (short) Math.round(p.getHealthScale() * 100));
                        } else if (f == PlayerField.LEVEL) {
                            node.sendReplyShort(m.reply, (short) p.getLevel());
                        } else if (f == PlayerField.PERMISSIONS) {
                            final String[] perms = new String(m.binaryValue, 16, m.binaryValue.length - 16, StandardCharsets.UTF_8).split(",");
                            int r = 0;
                            for (int i = 0; i < perms.length; i++) {
                                if (p.hasPermission(perms[i])) {
                                    r |= 1 << i;
                                }
                            }
                            node.sendReplyShort(m.reply, (short) r);
                        } else if (f == PlayerField.PERMISSIONS_MATCHING) {
                            final String pattern = new String(m.binaryValue, 16, m.binaryValue.length - 16, StandardCharsets.UTF_8);
                            final StringBuilder sb = new StringBuilder();
                            sb.append("[");
                            boolean fst = true;
                            for (PermissionAttachmentInfo perm : p.getEffectivePermissions()) {
                                String pr = perm.getPermission();
                                if (!pr.matches(pattern)) {
                                    continue;
                                }
                                if (fst) {
                                    fst = false;
                                    sb.append("[\"");
                                } else {
                                    sb.append(",[\"");
                                }
                                Encodings.escapeString(sb, pr);
                                sb.append("\",").append(perm.getValue() ? '1' : '0').append("]");
                            }
                            sb.append("]");
                            node.sendReplyString(m.reply, sb);
                        } else {
                            node.sendReplySignal(m.reply);
                        }
                    } catch (IOException e) {
                        this.getLogger().log(Level.SEVERE, "Failed to send reply (" + String.valueOf(m.reply) + ") to: GET_PLAYER_" + f.toString(), e);
                    }
                } else if (m.type == MessageType.SET_PLAYER) {
                    Player p = this.getServer().getPlayer(Encodings.getUUID(m.binaryValue));
                    PlayerField f = PlayerField.fromInt(m.shortValue);
                    try {
                        if (f == PlayerField.DISPLAY_NAME) {
                            p.setDisplayName(new String(m.binaryValue, 16, m.binaryValue.length - 16, StandardCharsets.UTF_8));
						} else if (f == PlayerField.EXHAUSTION) {
                            p.setExhaustion(Encodings.leShort(m.binaryValue, 16) / (float) 100.0);
                        } else if (f == PlayerField.EXP) {
                            p.setExp(Encodings.leShort(m.binaryValue, 16) / (float) 10000.0);
                        } else if (f == PlayerField.FLY_SPEED) {
                            p.setFlySpeed(Encodings.leShort(m.binaryValue, 16) / (float) 10000.0);
                        } else if (f == PlayerField.FOOD_LEVEL) {
                            p.setFoodLevel(Encodings.leShort(m.binaryValue, 16));
                        } else if (f == PlayerField.HEALTH_SCALE) {
                            p.setHealthScale(Encodings.leShort(m.binaryValue, 16) / 100.0);
                        } else if (f == PlayerField.LEVEL) {
                            p.setLevel(Encodings.leShort(m.binaryValue, 16));
                        } else if (f == PlayerField.PERMISSIONS || f == PlayerField.PERMISSIONS_MATCHING) {
                            final int off = f == PlayerField.PERMISSIONS ? 16 : 20;
                            final String[] perms = new String(m.binaryValue, off, m.binaryValue.length - off, StandardCharsets.UTF_8).split(",");
                            int r = 0;
                            PermissionAttachment att = f == PlayerField.PERMISSIONS ? p.addAttachment(this) : p.addAttachment(this, Encodings.leInt(m.binaryValue, 16));
                            for (int i = 0; i < perms.length; i++) {
                                if (!p.hasPermission(perms[i])) {
                                    att.setPermission(perms[i], true);
                                    r++;
                                }
                            }
                            if (r == 0) {
                                p.removeAttachment(att);
                            }
                        } else if (m.reply == null) {
                            return;
                        } else {
                            node.sendReplyError(m.reply, new UnsupportedOperationException("No setter is implemented for " + String.valueOf(f)));
                            return;
                        }
                        if (m.reply != null) {
                            node.sendReplySignal(m.reply);
                        }
                    } catch (IOException e) {
                        this.getLogger().log(Level.SEVERE, "Failed to send reply (" + String.valueOf(m.reply) + ") to: GET_PLAYER_" + f.toString(), e);
                    }
                } else if (m.type == MessageType.MSG_PLAYER) {
                    UUID uuid = Encodings.getUUID(m.binaryValue);
                    Player p = this.getServer().getPlayer(uuid);
                    p.sendMessage(new String(m.binaryValue, 16, m.binaryValue.length - 16, StandardCharsets.UTF_8));
                    if (m.reply != null) {
                        try {
							node.sendReplySignal(m.reply);
						} catch (IOException e) {
                            this.getLogger().log(Level.SEVERE, "Failed to send reply (" + String.valueOf(m.reply) + ") to: MSG_PLAYER_" + uuid.toString(), e);
						}
                    }
                    return;
                } else if (m.type == MessageType.MSG_PLAYER_MULTI) {
                    Player p = this.getServer().getPlayer(Encodings.getUUID(m.binaryValue));
                    int offset = 16;
                    while (offset < m.binaryValue.length) {
                        int len = ((m.binaryValue[offset] & 0xFF) << 8) | (m.binaryValue[offset + 1] & 0xFF);
                        offset += 2;
                        p.sendMessage(new String(m.binaryValue, offset, len, StandardCharsets.UTF_8));
                        offset += len;
                    }
                    return;
                }
            });
        } catch (IOException err) {
            this.getLogger().log(Level.SEVERE, "Failed to start node process at: " + config.getString("executable"), err);
        }
        getLogger().info("started node.js process");
    }

    @Override
    public void onDisable() {
        if (this.node != null) {
            final NodeJs node = this.node;
            this.node = null;
            try {
				node.stop();
			} catch (InterruptedException e) {
                this.getLogger().log(Level.SEVERE, "Failed to wait on NodeJs.stop", e);
			}
        }
        getLogger().info("onDisable is called!");
    }

    protected NodeJs startNode() throws IOException {
        FileConfiguration config = this.getConfig();

        final File nodeBridge = new File(this.getDataFolder(), "NodeBridge.js");
        InputStream i = this.getResource("NodeBridge.js");
        FileOutputStream fo = new FileOutputStream(nodeBridge);
        i.transferTo(fo);
        i.close();
        fo.close();

        return new NodeJs(this, new File(config.getString("directory")), config.getString("executable"), nodeBridge.getCanonicalPath());
    }



    public YamlConfiguration parseJSON(byte[] json) throws InvalidConfigurationException {
        return parseJSON(new String(json, StandardCharsets.UTF_8));
    }

    public YamlConfiguration parseJSON(String json) throws InvalidConfigurationException {
        getLogger().info("Parsing JSON: " + json);
        YamlConfiguration conf = new YamlConfiguration();
        conf.loadFromString(json);
        return conf;
    }

    private HashMap<String, BridgedCommand> registeredCommands = new HashMap<String, BridgedCommand>();
    protected void registerCommand(YamlConfiguration cmd) throws NoSuchFieldException, SecurityException, IllegalArgumentException, IllegalAccessException {
        final Field bukkitCommandMap = this.getServer().getClass().getDeclaredField("commandMap");
        final String command = cmd.getString("a", null);

        bukkitCommandMap.setAccessible(true);
        CommandMap commandMap = (CommandMap) bukkitCommandMap.get(Bukkit.getServer());

        BridgedCommand bc = new BridgedCommand(this, this.node, command, cmd);
        commandMap.register(command, bc);
        this.registeredCommands.put(command, bc);
    }
}
