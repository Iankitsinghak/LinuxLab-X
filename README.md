<div align="center">
  <img src="https://raw.githubusercontent.com/Iankitsinghak/LinuxLab-X/main/media/icon.svg" width="128" alt="LinuxLabX Logo" />
  
  # LinuxLabX
  
  **The Ultimate Interactive Linux Terminal Simulator for VS Code**

  [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/AnkitSingh.linuxlabx?color=4ade80&label=VS%20Code&logo=visual-studio-code)](#)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#)
  [![Installs](https://img.shields.io/visual-studio-marketplace/i/AnkitSingh.linuxlabx?color=22d3ee)](#)
  
  <p align="center">
    Practice Linux commands, explore virtual file systems, and master the CLI—right inside your editor, without the risk of breaking your real machine.
  </p>
</div>

---

## 🚀 Why LinuxLabX?

Whether you're a beginner taking your first steps in bash, a student preparing for Linux certification, or a developer testing script logic, **LinuxLabX** provides a safe, fully in-memory sandbox. It sits quietly in your Activity Bar, ready whenever you need to spin up a terminal session.

![LinuxLabX Demo](media/demo.png)

*(Note: Save the screenshot you provided as `media/demo.png` in your repository to display it here)*

## ✨ Key Features

- 🛡️ **Zero-Risk Sandbox**: An entirely in-memory virtual file system. Make mistakes, delete files, and run commands without ever touching your real OS.
- 💡 **Smart Auto-Completion**: Press `Tab` for intelligent command and path auto-completion.
- ⚠️ **Danger Warnings & Real-time Hints**: Get instant contextual feedback when typing potentially destructive commands like `rm -rf /` or `chmod 777`.
- 🎓 **Interactive Guided Tutorials**: Type `tutorial` to launch built-in, step-by-step missions that teach you Linux fundamentals interactively.
- 🔗 **Pipes & Chaining**: True terminal feel with support for command chaining (`&&`, `;`) and data piping (`|`).
- 💾 **Session Persistence**: Close VS Code and come back later; your virtual filesystem state is automatically saved and restored.

## 🛠️ Supported Commands

LinuxLabX emulates standard GNU/Linux utilities natively in JavaScript.

| Command | Description | Example Usage |
| :--- | :--- | :--- |
| **`pwd`** | Print working directory | `pwd` |
| **`ls`** | List directory contents | `ls -la` |
| **`cd`** | Change directory | `cd /home/user` |
| **`mkdir`** | Create new directory | `mkdir -p docs/assets` |
| **`touch`** | Create empty file | `touch script.sh` |
| **`cat`** | Display file contents | `cat script.sh` |
| **`echo`** | Write text into a file | `echo "Hello" > msg.txt` |
| **`rm`** | Remove file or directory | `rm -rf old_folder` |
| **`cp`** | Copy file or directory | `cp config.json backup/` |
| **`mv`** | Move or rename file | `mv temp.txt final.txt` |
| **`chmod`** | Change file permissions | `chmod 755 script.sh` |
| **`grep`** | Search text in file | `grep "error" log.txt` |
| **`find`** | Search for files | `find . -name "*.js"` |
| **`wc`** | Count lines, words, bytes | `wc main.ts` |
| **`head`/`tail`** | View file boundaries | `tail -n 10 server.log` |
| **`clear`** | Clear terminal screen | `clear` |

## 🕹️ Getting Started

1. Click on the **LinuxLabX** icon in the left Activity Bar.
2. The terminal will instantly boot up with a fresh session.
3. Type `help` to see available commands, or `tutorial` to start learning.
4. To reset your sandbox environment to factory defaults, click the **Restart Session** button in the toolbar.

## ⚙️ Extension Settings

Customize LinuxLabX through your VS Code settings (`settings.json`):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `linuxlabx.autoRestoreSession` | `boolean` | `true` | Enable/disable restoring the virtual filesystem and tutorial state between VS Code sessions. |

## 🤝 Contributing

This project is open-source! If you want to add new bash commands, improve the terminal UI, or add more tutorials, feel free to submit a Pull Request on [GitHub](https://github.com/Iankitsinghak/LinuxLab-X).

## 📜 License

[MIT License](LICENSE) © Ankit Singh
