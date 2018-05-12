package net.timluq.mc.nodespigotbridge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

import org.bukkit.OfflinePlayer;
import org.bukkit.command.CommandSender;
import org.bukkit.command.defaults.PluginsCommand;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;

public class BridgedCommand extends PluginsCommand {
    public final boolean isSync;
    public final JavaBridge bridge;
    public final NodeJs node;
    public final String tabcomplete;

    public BridgedCommand(JavaBridge bridge, NodeJs node, String command, YamlConfiguration cmd) {
        super(command);
        this.bridge = bridge;
        this.node = node;
        if (cmd != null) {
            cmd = new YamlConfiguration();
        }
        // sync
        this.isSync = cmd.getBoolean("s", false);

        // label
        String lbl = cmd.getString("l", null);
        if (lbl != null) {
            this.setLabel(lbl);
        }

        // description
        String desc = cmd.getString("d", null);
        if (desc != null) {
            this.setDescription(desc);
        }
        
        // permission
        String perm = cmd.getString("p", null);
        if (perm != null) {
            this.setPermission(perm);
        }
        
        // permissionMessage
        String permM = cmd.getString("pm", null);
        if (permM != null) {
            this.setPermissionMessage(permM);
        }
        
        // usage
        String usage = cmd.getString("u", null);
        if (usage != null) {
            this.setPermissionMessage(usage);
        }
        
        // complete
        this.tabcomplete = cmd.getString("c", null);
    }

    @Override
    public List<String> tabComplete(CommandSender sender, String alias, String[] args) {
        if (this.tabcomplete == null) {
            return new LinkedList<String>();
        } else if (this.tabcomplete.equals("")) {
            try {
                StringBuilder sb = new StringBuilder();
                Encodings.escapeString(sb.append("{\"a\":\""), alias).append("\"");
                if (args != null && args.length != 0) {
                    sb.append(",\"p\":[");
                    for (int i = 0; i < args.length; i++) {
                        if (i != 0) sb.append(",");
                        Encodings.escapeString(sb.append("\""), args[i]).append("\"");
                    }
                    sb.append("]");
                }
                Encodings.escapeString(sb.append(",\"s\":{\"c\":\""), sender.getClass().getCanonicalName()).append("\"");
                if (sender.isOp()) {
                    sb.append(",\"op\":true");
                }
                if (sender instanceof OfflinePlayer) {
                    sb.append(",\"p\":\"").append(((OfflinePlayer) sender).getUniqueId()).append("\"");
                }
                sb.append("}}");
                byte[] b = this.node.sendString(MessageType.COMPLETE_COMMAND, sb.toString(), true).join().binaryValue;
                if (b != null && b.length != 0) {
                    YamlConfiguration r = this.bridge.parseJSON(new String(b, StandardCharsets.UTF_8));
                    return r.getStringList("r");
                }
            } catch (IOException | InvalidConfigurationException e) {
                this.bridge.getLogger().log(Level.SEVERE, "Completion of command failed: " + e.toString(), e);
                return new LinkedList<String>();
            }
        }
        return new LinkedList<String>();
    }

	@Override
	public boolean execute(CommandSender sender, String command, String[] args) {
        try {
            StringBuilder sb = new StringBuilder();
            Encodings.escapeString(sb.append("{\"a\":\""), command).append("\"");
            if (args != null && args.length != 0) {
                sb.append(",\"p\":[");
                for (int i = 0; i < args.length; i++) {
                    if (i != 0) sb.append(",");
                    Encodings.escapeString(sb.append("\""), args[i]).append("\"");
                }
                sb.append("]");
            }
            Encodings.escapeString(sb.append(",\"s\":{\"c\":\""), sender.getClass().getCanonicalName()).append("\"");
            if (sender.isOp()) {
                sb.append(",\"op\":true");
            }
            if (sender instanceof OfflinePlayer) {
                sb.append(",\"p\":\"").append(((OfflinePlayer) sender).getUniqueId()).append("\"");
            }
            sb.append("}}");
            CompletableFuture<InputMessage> f = this.node.sendString(MessageType.EXECUTE_COMMAND, sb.toString(), this.isSync);
            if (f != null) {
                Short b = f.join().shortValue;
                if (b == null || b == 0) {
                    return false;
                }
            }
		} catch (IOException e) {
            this.bridge.getLogger().log(Level.SEVERE, "Execution of command failed: " + e.toString(), e);
            return false;
		}
		return true;
	}
}
