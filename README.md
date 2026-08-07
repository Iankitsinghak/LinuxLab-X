# LinuxLabX - Interactive Linux Terminal Simulator for VS Code

**LinuxLabX** is an interactive, lightweight Linux terminal simulator embedded directly inside VS Code's sidebar activity bar. It allows developers, students, and system administrators to practice Linux bash commands, experiment with virtual file systems, and follow guided interactive tutorials without leaving their editor.

---

## 🚀 Features

- **Embedded Terminal View**: Runs right inside VS Code webview panel in the Activity Bar.
- **In-Memory Virtual File System**: Create, delete, move, copy, and modify virtual files and directories (`mkdir`, `touch`, `rm`, `ls`, `cd`, `cp`, `mv`, `chmod`).
- **Rich Text & File Processing**: Read and inspect files using standard Linux utilities (`cat`, `echo`, `grep`, `find`, `head`, `tail`, `wc`).
- **Command Chaining & Pipes**: Support for command pipelines (`|`) and execution chaining (`&&`, `;`).
- **Interactive Guided Tutorial**: Run `tutorial` to start a step-by-step interactive Linux command mission.
- **Smart Hints & Danger Warnings**: Real-time smart tips and safety warnings when using potentially destructive commands like `rm` or `chmod`.
- **Auto-Suggestions & Completion**: Press `Tab` to auto-complete commands and path names.
- **Session Persistence**: Automatically saves and restores your virtual filesystem state between VS Code sessions.

---

## 🛠️ Usage & Commands

Open the **LinuxLabX** icon from the Activity Bar on the left sidebar, or trigger via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `LinuxLabX: Start LinuxLabX` -> Focuses the LinuxLabX terminal panel.
- `LinuxLabX: Reset Session` -> Resets the virtual filesystem and state back to fresh defaults.

### Common Bash Commands Supported:
| Command | Description |
| :--- | :--- |
| `pwd` | Print working directory |
| `ls` | List directory contents |
| `cd <dir>` | Change directory |
| `mkdir <dir>` | Create new directory (`-p` supported) |
| `touch <file>` | Create empty file |
| `cat <file>` | Display file contents |
| `echo "text" > file` | Write text into a file |
| `rm <path>` | Remove file or directory (`-r`, `-f` supported) |
| `cp <src> <dst>` | Copy file or directory (`-r` supported) |
| `mv <src> <dst>` | Move or rename file or directory |
| `chmod <mode> <file>`| Change file permissions (e.g. `chmod 755 script.sh`) |
| `grep <pattern> <file>`| Search matching lines in file or pipe input |
| `find <path> -name <p>`| Search for files matching pattern |
| `head` / `tail` | View top or bottom lines of a file |
| `wc <file>` | Count lines, words, and bytes |
| `tutorial` | Launch step-by-step interactive Linux course |
| `help` | Display quick help summary |
| `clear` | Clear terminal screen |

---

## ⚙️ Extension Settings

This extension contributes the following settings:

* `linuxlabx.autoRestoreSession`: Enable/disable restoring the virtual filesystem and tutorial state between VS Code sessions (default: `true`).

---

## 📜 License

MIT License. Enjoy practicing Linux inside VS Code!

