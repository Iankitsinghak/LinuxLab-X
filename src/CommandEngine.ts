import { FileTreeNode, VirtualFileSystem, VirtualFsState } from "./VirtualFileSystem";

export interface CommandResult {
    output: string;
    type: 'success' | 'error' | 'info';
    newPath?: string;
    smartTip?: string;
    tutorialProgress?: {
        active: boolean;
        step: number;
        totalSteps: number;
        title: string;
        objective: string;
    };
    fsTree?: FileTreeNode | null;
    suggestions?: string[];
}

export interface CommandEngineState {
    fs: VirtualFsState;
    tutorialState: {
        active: boolean;
        step: number;
    };
}

export class CommandEngine {
    private fs: VirtualFileSystem;
    private readonly tutorialTotalSteps = 4;
    private readonly knownCommands = [
        "pwd", "ls", "cd", "mkdir", "rm", "touch", "echo", "cat",
        "help", "tutorial", "clear", "exit", "grep", "find", "head",
        "tail", "wc", "cp", "mv", "chmod", "whoami", "date", "uname",
        "hostname", "history", "man"
    ];
    private tutorialState = {
        active: false,
        step: 0
    };

    constructor() {
        this.fs = new VirtualFileSystem();
    }

    public getPrompt(): string {
        return `linuxuser@linuxlabx:${this.fs.getDisplayPath()} $`;
    }

    public reset(): void {
        this.fs = new VirtualFileSystem();
        this.tutorialState = {
            active: false,
            step: 0
        };
    }

    public exportState(): CommandEngineState {
        return {
            fs: this.fs.exportState(),
            tutorialState: this.tutorialState
        };
    }

    public importState(state?: CommandEngineState): void {
        if (!state) {
            return;
        }
        this.fs.importState(state.fs);
        if (state.tutorialState) {
            this.tutorialState = {
                active: !!state.tutorialState.active,
                step: state.tutorialState.step || 0
            };
        }
    }

    public getFileTree(): FileTreeNode | null {
        return this.fs.getTree("~", 6);
    }

    public getSuggestions(): string[] {
        if (this.tutorialState.active) {
            if (this.tutorialState.step === 1) {
                return ["mkdir project", "mkdir -p project/src"];
            }
            if (this.tutorialState.step === 2) {
                return ["cd project", "pwd"];
            }
            if (this.tutorialState.step === 3) {
                return ["touch main.py", "echo hello > main.py"];
            }
            if (this.tutorialState.step === 4) {
                return ["ls", "cat main.py"];
            }
        }

        return ["help", "tutorial", "ls", "pwd", "find . -name main.py"];
    }

    public getTutorialProgress() {
        return {
            active: this.tutorialState.active,
            step: this.tutorialState.step,
            totalSteps: this.tutorialTotalSteps,
            title: "LinuxLabX Basics",
            objective: this.getTutorialObjective()
        };
    }

    public execute(cmdLine: string): CommandResult | null {
        const trimmed = cmdLine.trim();
        if (!trimmed) {return null;}

        let res: CommandResult;

        try {
            const chain = this.splitOutsideQuotes(trimmed, /(&&|;)/g);
            let continueOnSuccessOnly = false;
            let finalType: CommandResult['type'] = "success";
            const outputs: string[] = [];
            let smartTip = "";

            for (const token of chain) {
                if (token === "&&") {
                    continueOnSuccessOnly = true;
                    continue;
                }
                if (token === ";") {
                    continueOnSuccessOnly = false;
                    continue;
                }

                if (continueOnSuccessOnly && finalType === "error") {
                    continue;
                }

                const piped = this.executePipeline(token);
                if (piped.output) {
                    outputs.push(piped.output);
                }
                finalType = piped.type;
                smartTip = piped.smartTip || smartTip;
            }

            res = {
                output: outputs.join("\n"),
                type: finalType,
                smartTip
            };
        } catch (e: any) {
            res = { output: `Error: ${e.message}`, type: "error" };
        }

        // Add tutorial checks
        if (this.tutorialState.active) {
            const firstCommand = this.parseArgs(trimmed)[0] || "";
            this.checkTutorialProgress(firstCommand, res);
        }

        res.newPath = this.getPrompt();
        res.tutorialProgress = this.getTutorialProgress();
        res.fsTree = this.getFileTree();
        res.suggestions = this.getSuggestions();
        return res;
    }

    private executePipeline(command: string): { output: string; type: CommandResult['type']; smartTip?: string } {
        const pipelineParts = this.splitOutsideQuotes(command, /\|/g).filter(Boolean);
        let stdin = "";
        let output = "";
        let type: CommandResult['type'] = "success";
        let smartTip: string | undefined;

        for (let i = 0; i < pipelineParts.length; i++) {
            const part = pipelineParts[i].trim();
            if (!part) {
                continue;
            }
            const result = this.executeSingle(part, stdin);
            output = result.output;
            type = result.type;
            smartTip = result.smartTip || smartTip;

            if (result.type === "error") {
                break;
            }
            stdin = result.output;
        }

        return { output, type, smartTip };
    }

    private executeSingle(cmdLine: string, stdin: string): CommandResult {
        const args = this.parseArgs(cmdLine);
        if (args.length === 0) {return { output: "", type: "success" };}

        const cmd = args[0];
        switch (cmd) {
            case "pwd":
                return this.handlePwd();
            case "ls":
                return this.handleLs(args);
            case "cd":
                return this.handleCd(args);
            case "mkdir":
                return this.handleMkdir(args);
            case "rm":
                return this.handleRm(args);
            case "touch":
                return this.handleTouch(args);
            case "echo":
                return this.handleEcho(args);
            case "cat":
                return this.handleCat(args, stdin);
            case "grep":
                return this.handleGrep(args, stdin);
            case "find":
                return this.handleFind(args);
            case "head":
                return this.handleHead(args, stdin);
            case "tail":
                return this.handleTail(args, stdin);
            case "wc":
                return this.handleWc(args, stdin);
            case "cp":
                return this.handleCp(args);
            case "mv":
                return this.handleMv(args);
            case "chmod":
                return this.handleChmod(args);
            case "help":
                return this.handleHelp();
            case "tutorial":
                return this.handleTutorial();
            case "clear":
                return { output: "", type: "success" };
            case "exit":
                return { output: "logout", type: "info" };
            case "whoami":
                return this.handleWhoami();
            case "date":
                return this.handleDate();
            case "uname":
                return this.handleUname(args);
            case "hostname":
                return this.handleHostname();
            case "history":
                return { output: "history: Use Arrow Up/Down keys to navigate through previous commands.\nCommand history is managed by the terminal UI.", type: "info" };
            case "man":
                return this.handleMan(args);
            default:
                return { output: `bash: ${cmd}: command not found`, type: "error", smartTip: "Type 'help' to see available commands." };
        }
    }

    private parseArgs(cmdLine: string): string[] {
        const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/gi;
        const args: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(cmdLine)) !== null) {
            if (match[1] !== undefined) {
                args.push(match[1]);
            } else if (match[2] !== undefined) {
                args.push(match[2]);
            } else {
                args.push(match[0]);
            }
        }
        return args;
    }

    private handlePwd(): CommandResult {
        return { output: this.fs.getPwd(), type: "success" };
    }

    private handleLs(args: string[]): CommandResult {
        const flags = args.filter(a => a.startsWith('-') && a !== 'ls');
        const longFormat = flags.some(f => f.includes('l'));
        const showAll = flags.some(f => f.includes('a'));
        const target = args.find((a, i) => i > 0 && !a.startsWith('-')) || ".";

        if (longFormat) {
            const entries = this.fs.getEntries(target);
            const node = this.fs.resolvePath(target);
            if (!node) {
                return { output: `ls: cannot access '${target}': No such file or directory`, type: "error" };
            }
            if (!node.isDirectory) {
                const mode = this.formatMode(node.mode);
                return { output: `-${mode} 1 linuxuser linuxuser ${String(node.content.length).padStart(5)} Jan  1 00:00 ${node.name}`, type: "success" };
            }
            if (entries.length === 0) {
                return { output: `total 0`, type: "success" };
            }
            const lines = [`total ${entries.length * 4}`];
            for (const e of entries) {
                const typeChar = e.isDirectory ? 'd' : '-';
                const mode = this.formatMode(e.mode);
                const size = e.isDirectory ? '4096' : '   0';
                lines.push(`${typeChar}${mode} 1 linuxuser linuxuser ${size} Jan  1 00:00 ${e.name}`);
            }
            return { output: lines.join("\n"), type: "success" };
        }

        const res = this.fs.ls(target);
        if (!res.success) {return { output: `ls: cannot access '${target}': ${res.error}`, type: "error" };}
        let output = res.items!.join("  ");
        return { output: output, type: "success" };
    }

    private formatMode(mode: string): string {
        const modeMap: Record<string, string> = {
            '0': '---', '1': '--x', '2': '-w-', '3': '-wx',
            '4': 'r--', '5': 'r-x', '6': 'rw-', '7': 'rwx'
        };
        const digits = mode.padStart(3, '0').slice(-3);
        return digits.split('').map(d => modeMap[d] || '---').join('');
    }

    private handleCd(args: string[]): CommandResult {
        const target = args[1] || "~";
        const res = this.fs.cd(target);
        if (!res.success) {return { output: `cd: ${target}: ${res.error}`, type: "error" };}
        
        return { output: "", type: "success", smartTip: "Tip: Use 'ls' to see the contents of the new directory." };
    }

    private handleMkdir(args: string[]): CommandResult {
        const pFlag = args.includes("-p");
        const paths = args.filter(a => a !== "mkdir" && a !== "-p");
        
        if (paths.length === 0) {return { output: "mkdir: missing operand", type: "error" };}
        
        for (const p of paths) {
            const res = this.fs.mkdir(p, pFlag);
            if (!res.success) {return { output: `mkdir: cannot create directory '${p}': ${res.error}`, type: "error" };}
        }
        
        return { output: "", type: "success", smartTip: `Tip: Use 'cd ${paths[0]}' to navigate into it.` };
    }

    private handleRm(args: string[]): CommandResult {
        const rFlag = args.includes("-r") || args.includes("-R");
        const fFlag = args.includes("-f");
        const targets = args.filter(a => !a.startsWith("-") && a !== "rm");
        
        if (targets.length === 0) {return { output: "rm: missing operand", type: "error" };}
        
        for (const t of targets) {
            const res = this.fs.rm(t, rFlag, fFlag);
            if (!res.success) {return { output: `rm: cannot remove '${t}': ${res.error}`, type: "error" };}
        }
        
        return { output: "", type: "success" };
    }

    private handleTouch(args: string[]): CommandResult {
        if (args.length < 2) {return { output: "touch: missing file operand", type: "error" };}
        
        for (let i = 1; i < args.length; i++) {
            const res = this.fs.touch(args[i]);
            if (!res.success) {return { output: `touch: cannot touch '${args[i]}': ${res.error}`, type: "error" };}
        }
        
        return { output: "", type: "success" };
    }

    private handleEcho(args: string[]): CommandResult {
        // Check for >> append redirect first
        const appendIndex = args.indexOf(">>");
        if (appendIndex !== -1 && appendIndex < args.length - 1) {
            const text = args.slice(1, appendIndex).join(" ");
            const target = args[appendIndex + 1];
            const res = this.fs.appendFile(target, text + "\n");
            if (!res.success) {return { output: `bash: ${target}: ${res.error}`, type: "error" };}
            return { output: "", type: "success" };
        }

        // Check for > overwrite redirect
        const redirectIndex = args.indexOf(">");
        if (redirectIndex !== -1 && redirectIndex < args.length - 1) {
            const text = args.slice(1, redirectIndex).join(" ");
            const target = args[redirectIndex + 1];
            const res = this.fs.writeFile(target, text);
            if (!res.success) {return { output: `bash: ${target}: ${res.error}`, type: "error" };}
            return { output: "", type: "success" };
        }
        
        return { output: args.slice(1).join(" "), type: "success" };
    }

    private handleCat(args: string[], stdin: string): CommandResult {
        if (args.length < 2) {
            return { output: stdin, type: "success" };
        }
        
        const outputs = [];
        for (let i = 1; i < args.length; i++) {
            const res = this.fs.readFile(args[i]);
            if (!res.success) {return { output: `cat: ${args[i]}: ${res.error}`, type: "error" };}
            outputs.push(res.content);
        }
        return { output: outputs.join("\n"), type: "success" };
    }

    private handleGrep(args: string[], stdin: string): CommandResult {
        if (args.length < 2) {
            return { output: "grep: missing search pattern", type: "error" };
        }

        const pattern = args[1];
        let text = "";
        if (args.length > 2) {
            const fileRes = this.fs.readFile(args[2]);
            if (!fileRes.success) {
                return { output: `grep: ${args[2]}: ${fileRes.error}`, type: "error" };
            }
            text = fileRes.content || "";
        } else {
            text = stdin;
        }

        const lines = text.split("\n").filter((line) => line.includes(pattern));
        return { output: lines.join("\n"), type: "success" };
    }

    private handleFind(args: string[]): CommandResult {
        const targetPath = args[1] && !args[1].startsWith("-") ? args[1] : ".";
        const nameIndex = args.indexOf("-name");
        const namePattern = nameIndex !== -1 ? args[nameIndex + 1] : undefined;

        const normalizePattern = (namePattern || "").replace(/\*/g, ".*");
        const matcher = namePattern
            ? (node: any, absolutePath: string) => {
                const nodeName = node.name || absolutePath.split("/").pop() || "";
                return new RegExp(`^${normalizePattern}$`).test(nodeName);
            }
            : undefined;

        const found = this.fs.find(targetPath, matcher);
        if (found.length === 0) {
            return { output: "", type: "success" };
        }
        return { output: found.join("\n"), type: "success" };
    }

    private handleHead(args: string[], stdin: string): CommandResult {
        const parsed = this.parseHeadTailArgs(args);
        if (!parsed.success) {
            return { output: parsed.error!, type: "error" };
        }

        const content = parsed.content ?? stdin;
        const lines = content.split("\n").slice(0, parsed.count);
        return { output: lines.join("\n"), type: "success" };
    }

    private handleTail(args: string[], stdin: string): CommandResult {
        const parsed = this.parseHeadTailArgs(args);
        if (!parsed.success) {
            return { output: parsed.error!, type: "error" };
        }

        const content = parsed.content ?? stdin;
        const lines = content.split("\n");
        return { output: lines.slice(Math.max(0, lines.length - parsed.count)).join("\n"), type: "success" };
    }

    private parseHeadTailArgs(args: string[]): { success: boolean; count: number; content?: string; error?: string } {
        let count = 10;
        const nIndex = args.indexOf("-n");
        if (nIndex !== -1) {
            const parsed = Number(args[nIndex + 1]);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                return { success: false, count, error: `${args[0]}: invalid number of lines` };
            }
            count = Math.floor(parsed);
        }

        const candidateFile = args.filter((arg, idx) => arg !== args[0] && idx !== nIndex && idx !== nIndex + 1)[0];
        if (!candidateFile) {
            return { success: true, count };
        }

        const readRes = this.fs.readFile(candidateFile);
        if (!readRes.success) {
            return { success: false, count, error: `${args[0]}: cannot open '${candidateFile}': ${readRes.error}` };
        }
        return { success: true, count, content: readRes.content || "" };
    }

    private handleWc(args: string[], stdin: string): CommandResult {
        let content = stdin;
        if (args[1]) {
            const readRes = this.fs.readFile(args[1]);
            if (!readRes.success) {
                return { output: `wc: ${args[1]}: ${readRes.error}`, type: "error" };
            }
            content = readRes.content || "";
        }

        const lines = content ? content.split("\n").length : 0;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const bytes = content.length;
        return { output: `${lines} ${words} ${bytes}`, type: "success" };
    }

    private handleCp(args: string[]): CommandResult {
        const recursive = args.includes("-r") || args.includes("-R");
        const targets = args.filter((arg) => !arg.startsWith("-") && arg !== "cp");
        if (targets.length < 2) {
            return { output: "cp: missing file operand", type: "error" };
        }

        const result = this.fs.cp(targets[0], targets[1], recursive);
        if (!result.success) {
            return { output: `cp: cannot copy '${targets[0]}' to '${targets[1]}': ${result.error}`, type: "error" };
        }
        return { output: "", type: "success" };
    }

    private handleMv(args: string[]): CommandResult {
        const targets = args.slice(1);
        if (targets.length < 2) {
            return { output: "mv: missing file operand", type: "error" };
        }

        const result = this.fs.mv(targets[0], targets[1]);
        if (!result.success) {
            return { output: `mv: cannot move '${targets[0]}' to '${targets[1]}': ${result.error}`, type: "error" };
        }
        return { output: "", type: "success" };
    }

    private handleChmod(args: string[]): CommandResult {
        if (args.length < 3) {
            return { output: "chmod: missing operand", type: "error" };
        }

        const mode = args[1];
        const target = args[2];
        const result = this.fs.chmod(target, mode);
        if (!result.success) {
            return { output: `chmod: cannot access '${target}': ${result.error}`, type: "error" };
        }
        return { output: "", type: "success" };
    }

    private handleWhoami(): CommandResult {
        return { output: "linuxuser", type: "success" };
    }

    private handleDate(): CommandResult {
        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const d = days[now.getDay()];
        const m = months[now.getMonth()];
        const day = String(now.getDate()).padStart(2, ' ');
        const time = now.toTimeString().split(' ')[0];
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        return { output: `${d} ${m} ${day} ${time} ${tz} ${now.getFullYear()}`, type: "success" };
    }

    private handleUname(args: string[]): CommandResult {
        const showAll = args.includes('-a');
        if (showAll) {
            return { output: "LinuxLabX 6.1.0-linuxlabx linuxlabx-vm x86_64 GNU/Linux", type: "success" };
        }
        return { output: "LinuxLabX", type: "success" };
    }

    private handleHostname(): CommandResult {
        return { output: "linuxlabx-vm", type: "success" };
    }

    private handleMan(args: string[]): CommandResult {
        if (args.length < 2) {
            return { output: "What manual page do you want?\nUsage: man <command>", type: "error" };
        }
        const manPages: Record<string, string> = {
            ls: "LS(1)\n\nNAME\n    ls - list directory contents\n\nSYNOPSIS\n    ls [-la] [path]\n\nDESCRIPTION\n    List information about files and directories.\n    -l  use a long listing format\n    -a  include hidden entries",
            cd: "CD(1)\n\nNAME\n    cd - change the working directory\n\nSYNOPSIS\n    cd [dir]\n\nDESCRIPTION\n    Change working directory to dir.\n    If dir is not supplied, navigate to home (~).",
            mkdir: "MKDIR(1)\n\nNAME\n    mkdir - make directories\n\nSYNOPSIS\n    mkdir [-p] directory...\n\nDESCRIPTION\n    Create directories if they do not exist.\n    -p  create parent directories as needed",
            rm: "RM(1)\n\nNAME\n    rm - remove files or directories\n\nSYNOPSIS\n    rm [-rf] file...\n\nDESCRIPTION\n    Remove files or directories.\n    -r  remove directories recursively\n    -f  ignore nonexistent files",
            cat: "CAT(1)\n\nNAME\n    cat - concatenate files and print\n\nSYNOPSIS\n    cat [file...]\n\nDESCRIPTION\n    Concatenate FILE(s) to standard output.",
            echo: "ECHO(1)\n\nNAME\n    echo - display a line of text\n\nSYNOPSIS\n    echo [text] [> file] [>> file]\n\nDESCRIPTION\n    Display text. Use > to write to file, >> to append.",
            grep: "GREP(1)\n\nNAME\n    grep - search for patterns\n\nSYNOPSIS\n    grep pattern [file]\n\nDESCRIPTION\n    Search for pattern in each line of file or stdin.",
            find: "FIND(1)\n\nNAME\n    find - search for files\n\nSYNOPSIS\n    find [path] -name pattern\n\nDESCRIPTION\n    Search for files matching pattern.",
            chmod: "CHMOD(1)\n\nNAME\n    chmod - change file mode bits\n\nSYNOPSIS\n    chmod mode file\n\nDESCRIPTION\n    Change the permissions of a file (octal mode).",
            cp: "CP(1)\n\nNAME\n    cp - copy files and directories\n\nSYNOPSIS\n    cp [-r] source dest\n\nDESCRIPTION\n    Copy SOURCE to DEST. -r for recursive.",
            mv: "MV(1)\n\nNAME\n    mv - move/rename files\n\nSYNOPSIS\n    mv source dest\n\nDESCRIPTION\n    Rename SOURCE to DEST or move to directory.",
            touch: "TOUCH(1)\n\nNAME\n    touch - create empty file\n\nSYNOPSIS\n    touch file...\n\nDESCRIPTION\n    Create files if they don't exist.",
            pwd: "PWD(1)\n\nNAME\n    pwd - print working directory\n\nSYNOPSIS\n    pwd\n\nDESCRIPTION\n    Print the current working directory path.",
            whoami: "WHOAMI(1)\n\nNAME\n    whoami - print effective user name\n\nSYNOPSIS\n    whoami\n\nDESCRIPTION\n    Print the current user name.",
            uname: "UNAME(1)\n\nNAME\n    uname - print system information\n\nSYNOPSIS\n    uname [-a]\n\nDESCRIPTION\n    Print system information. -a for all.",
            hostname: "HOSTNAME(1)\n\nNAME\n    hostname - show host name\n\nSYNOPSIS\n    hostname\n\nDESCRIPTION\n    Display the system's host name.",
            date: "DATE(1)\n\nNAME\n    date - display date and time\n\nSYNOPSIS\n    date\n\nDESCRIPTION\n    Display the current date and time.",
            head: "HEAD(1)\n\nNAME\n    head - output first lines of files\n\nSYNOPSIS\n    head [-n count] [file]\n\nDESCRIPTION\n    Print the first 10 (or count) lines.",
            tail: "TAIL(1)\n\nNAME\n    tail - output last lines of files\n\nSYNOPSIS\n    tail [-n count] [file]\n\nDESCRIPTION\n    Print the last 10 (or count) lines.",
            wc: "WC(1)\n\nNAME\n    wc - word, line, byte count\n\nSYNOPSIS\n    wc [file]\n\nDESCRIPTION\n    Print line, word, and byte counts."
        };
        const page = manPages[args[1]];
        if (!page) {
            return { output: `No manual entry for ${args[1]}`, type: "error" };
        }
        return { output: page, type: "info" };
    }

    private handleHelp(): CommandResult {
        const helpText = `
LinuxLabX Quick Help

Basics:
    pwd              Show current directory
    ls [-l]          List files/folders (long format)
    cd <dir>         Move to directory
    mkdir [-p] <dir> Create directory (with parents)
    touch <file>     Create empty file
    cat <file>       Read file content
    echo <text>      Print text
    echo "hi" > f    Write text to file
    echo "hi" >> f   Append text to file

File Tools:
    rm [-rf] <path>  Remove file/directory
    cp [-r] <s> <d>  Copy file/folder
    mv <src> <dst>   Move or rename
    chmod <mode> <f> Change permissions (e.g. 755)

Search/Text:
    grep <pat> <f>   Find matching lines
    find . -name <p> Find files by pattern
    head -n <n> <f>  Show first N lines
    tail -n <n> <f>  Show last N lines
    wc <file>        Line/word/byte counts

System:
    whoami           Show current user
    hostname         Show hostname
    uname [-a]       Show system info
    date             Show current date/time
    man <cmd>        Show manual for command
    history          Command history info

Shell:
    tutorial         Guided learning mode
    clear / Ctrl+L   Clear terminal
    help             Show this help
    Ctrl+C           Cancel current input
    Tab              Auto-complete
    ↑ / ↓            Navigate command history

Pipes & chaining: cmd1 | cmd2, cmd1 && cmd2, cmd1 ; cmd2
        `.trim();
        return { output: helpText, type: "info" };
    }

    private handleTutorial(): CommandResult {
        this.tutorialState.active = true;
        this.tutorialState.step = 1;
        return {
            output: "Welcome to the LinuxLabX Tutorial!\n\nStep 1: Let's create a directory called 'project'.\nHint: Use the 'mkdir' command.", 
            type: "info",
            tutorialProgress: this.getTutorialProgress(),
            suggestions: this.getSuggestions(),
            fsTree: this.getFileTree()
        };
    }

    private checkTutorialProgress(cmd: string, res: CommandResult) {
        if (res.type === "error") {return;}

        if (this.tutorialState.step === 1 && cmd === "mkdir") {
            this.tutorialState.step = 2;
            res.output += "\n\n🎉 Great! Now navigate into the new directory.\nHint: Use the 'cd project' command.";
        } else if (this.tutorialState.step === 2 && cmd === "cd") {
            this.tutorialState.step = 3;
            res.output += "\n\n🎉 Awesome! Now let's create a file.\nHint: Use 'touch main.py' or 'echo \"hello\" > main.py'.";
        } else if (this.tutorialState.step === 3 && (cmd === "touch" || cmd === "echo")) {
            this.tutorialState.step = 4;
            res.output += "\n\n🎉 Perfect! View what's inside the directory to see your file.\nHint: Use the 'ls' command.";
        } else if (this.tutorialState.step === 4 && cmd === "ls") {
            this.tutorialState.active = false;
            this.tutorialState.step = 0;
            res.output += "\n\n🎉 Congratulations! You have completed the basic tutorial.\nYou can now practice other commands or type 'help'!";
        }
    }

    // Auto-complete functionality
    public autocomplete(cmdLine: string): string[] {
        const args = cmdLine.split(" ");
        const lastArg = args[args.length - 1];
        const secondToLast = args.length > 1 ? args[args.length - 2] : null;

        // Command auto-complete
        if (args.length === 1) {
            return this.knownCommands.filter(c => c.startsWith(lastArg));
        }

        // Directory auto-complete for cd
        if (secondToLast === "cd" || secondToLast === "mkdir" || secondToLast === "rm" || secondToLast === "ls" || secondToLast === "cat") {
            // Very basic auto-complete for current dir
            const lsRes = this.fs.ls();
            if (lsRes.success && lsRes.items) {
                return lsRes.items.filter(i => i.startsWith(lastArg)).map(i => {
                    const node = this.fs.resolvePath(i);
                    return node?.isDirectory ? i + "/" : i;
                });
            }
        }
        
        return [];
    }

    private splitOutsideQuotes(input: string, separatorRegex: RegExp): string[] {
        const tokens: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < input.length; i++) {
            const ch = input[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
                current += ch;
                continue;
            }

            if (!inQuotes) {
                const rest = input.slice(i);
                const match = rest.match(separatorRegex);
                if (match && match.index === 0) {
                    if (current.trim()) {
                        tokens.push(current.trim());
                    }
                    tokens.push(match[0]);
                    i += match[0].length - 1;
                    current = "";
                    continue;
                }
            }

            current += ch;
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }
        return tokens;
    }

    private getTutorialObjective(): string {
        if (!this.tutorialState.active) {
            return "Type 'tutorial' to start a guided mission.";
        }

        if (this.tutorialState.step === 1) {
            return "Create a new directory named 'project'.";
        }
        if (this.tutorialState.step === 2) {
            return "Move into the 'project' directory.";
        }
        if (this.tutorialState.step === 3) {
            return "Create a file in the current directory.";
        }
        if (this.tutorialState.step === 4) {
            return "List files to verify your work.";
        }

        return "Tutorial in progress.";
    }
}
