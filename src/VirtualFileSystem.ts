export class FsNode {
    name: string;
    isDirectory: boolean;
    parent: FsNode | null;
    children: Map<string, FsNode>;
    content: string;
    mode: string;

    constructor(name: string, isDirectory: boolean, parent: FsNode | null, mode?: string) {
        this.name = name;
        this.isDirectory = isDirectory;
        this.parent = parent;
        this.children = new Map();
        this.content = "";
        this.mode = mode ?? (isDirectory ? "755" : "644");
    }
}

export interface VirtualFsSerializedNode {
    name: string;
    isDirectory: boolean;
    content: string;
    mode: string;
    children: VirtualFsSerializedNode[];
}

export interface VirtualFsState {
    root: VirtualFsSerializedNode;
    currentPath: string;
}

export interface FileTreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children: FileTreeNode[];
}

export class VirtualFileSystem {
    root: FsNode;
    currentDir: FsNode;

    constructor() {
        this.root = new FsNode("", true, null);
        const home = new FsNode("home", true, this.root);
        this.root.children.set("home", home);
        const user = new FsNode("linuxuser", true, home);
        home.children.set("linuxuser", user);
        
        this.currentDir = user;
    }

    exportState(): VirtualFsState {
        return {
            root: this.serializeNode(this.root),
            currentPath: this.getPwd()
        };
    }

    importState(state?: VirtualFsState): void {
        if (!state?.root) {
            return;
        }

        const rebuiltRoot = this.deserializeNode(state.root, null);
        this.root = rebuiltRoot;
        const targetDir = this.resolvePath(state.currentPath);
        this.currentDir = targetDir?.isDirectory ? targetDir : this.root;
    }

    getTree(path = ".", maxDepth = 5): FileTreeNode | null {
        const node = this.resolvePath(path);
        if (!node) {
            return null;
        }

        return this.buildTree(node, this.getAbsolutePath(node), 0, maxDepth);
    }

    getEntries(path = "."): Array<{ name: string; isDirectory: boolean; mode: string }> {
        const node = this.resolvePath(path);
        if (!node || !node.isDirectory) {
            return [];
        }

        return Array.from(node.children.values())
            .map((child) => ({
                name: child.name,
                isDirectory: child.isDirectory,
                mode: child.mode
            }))
            .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
    }

    chmod(path: string, mode: string): { success: boolean; error?: string } {
        if (!/^[0-7]{3,4}$/.test(mode)) {
            return { success: false, error: "invalid mode" };
        }

        const node = this.resolvePath(path);
        if (!node) {
            return { success: false, error: "No such file or directory" };
        }

        node.mode = mode;
        return { success: true };
    }

    cp(srcPath: string, destPath: string, recursive = false): { success: boolean; error?: string } {
        const src = this.resolvePath(srcPath);
        if (!src) {
            return { success: false, error: "No such file or directory" };
        }
        if (src.isDirectory && !recursive) {
            return { success: false, error: "-r not specified; omitting directory" };
        }

        const destination = this.resolvePath(destPath);
        if (destination && destination.isDirectory) {
            if (destination.children.has(src.name)) {
                return { success: false, error: "File exists" };
            }
            destination.children.set(src.name, this.cloneNode(src, destination));
            return { success: true };
        }

        const parts = destPath.split("/");
        const targetName = parts.pop()!;
        const targetParentPath = parts.join("/") || ".";
        const targetParent = this.resolvePath(targetParentPath);
        if (!targetParent || !targetParent.isDirectory) {
            return { success: false, error: "No such file or directory" };
        }
        if (targetParent.children.has(targetName)) {
            return { success: false, error: "File exists" };
        }

        const cloned = this.cloneNode(src, targetParent);
        cloned.name = targetName;
        targetParent.children.set(targetName, cloned);
        return { success: true };
    }

    mv(srcPath: string, destPath: string): { success: boolean; error?: string } {
        const src = this.resolvePath(srcPath);
        if (!src || !src.parent) {
            return { success: false, error: "No such file or directory" };
        }

        const destination = this.resolvePath(destPath);
        if (destination && destination.isDirectory) {
            if (destination.children.has(src.name)) {
                return { success: false, error: "File exists" };
            }
            src.parent.children.delete(src.name);
            src.parent = destination;
            destination.children.set(src.name, src);
            return { success: true };
        }

        const parts = destPath.split("/");
        const targetName = parts.pop()!;
        const targetParentPath = parts.join("/") || ".";
        const targetParent = this.resolvePath(targetParentPath);
        if (!targetParent || !targetParent.isDirectory) {
            return { success: false, error: "No such file or directory" };
        }
        if (targetParent.children.has(targetName)) {
            return { success: false, error: "File exists" };
        }

        src.parent.children.delete(src.name);
        src.name = targetName;
        src.parent = targetParent;
        targetParent.children.set(targetName, src);
        return { success: true };
    }

    find(path = ".", matcher?: (node: FsNode, absolutePath: string) => boolean): string[] {
        const start = this.resolvePath(path);
        if (!start) {
            return [];
        }

        const results: string[] = [];
        this.walk(start, (node) => {
            const abs = this.getAbsolutePath(node);
            if (!matcher || matcher(node, abs)) {
                results.push(abs);
            }
        });

        return results;
    }

    getAbsolutePath(node: FsNode): string {
        let path = [];
        let curr: FsNode | null = node;
        while (curr !== null && curr.name !== "") {
            path.unshift(curr.name);
            curr = curr.parent;
        }
        return "/" + path.join("/");
    }

    getPwd(): string {
        return this.getAbsolutePath(this.currentDir);
    }
    
    getDisplayPath(): string {
        const pwd = this.getPwd();
        if (pwd.startsWith("/home/linuxuser")) {
            return pwd.replace("/home/linuxuser", "~");
        }
        return pwd;
    }

    resolvePath(path: string): FsNode | null {
        if (path === "/") {return this.root;}
        
        let curr = path.startsWith("/") ? this.root : this.currentDir;
        const parts = path.split("/").filter(p => p !== "" && p !== ".");
        
        for (const part of parts) {
            if (part === "..") {
                if (curr.parent) {curr = curr.parent;}
            } else if (part === "~") {
                curr = this.resolvePath("/home/linuxuser")!;
            } else {
                if (!curr.isDirectory) {return null;}
                const next = curr.children.get(part);
                if (!next) {return null;}
                curr = next;
            }
        }
        return curr;
    }

    mkdir(path: string, createParents: boolean = false): { success: boolean, error?: string } {
        const parts = path.split("/");
        const dirName = parts.pop()!;
        const parentPath = parts.join("/") || ".";
        
        let parentDir = this.resolvePath(parentPath);
        
        if (!parentDir && createParents) {
            // Very naive create parents
            let curr = path.startsWith("/") ? this.root : this.currentDir;
            const allParts = path.split("/").filter(p => p);
            for (let i = 0; i < allParts.length - 1; i++) {
                const part = allParts[i];
                if (!curr.children.has(part)) {
                    curr.children.set(part, new FsNode(part, true, curr));
                }
                curr = curr.children.get(part)!;
            }
            parentDir = curr;
        }
        
        if (!parentDir) {return { success: false, error: "No such file or directory" };}
        if (!parentDir.isDirectory) {return { success: false, error: "Not a directory" };}
        if (parentDir.children.has(dirName)) {return { success: false, error: "File exists" };}

        const newNode = new FsNode(dirName, true, parentDir);
        parentDir.children.set(dirName, newNode);
        return { success: true };
    }

    touch(path: string): { success: boolean, error?: string } {
        const parts = path.split("/");
        const fileName = parts.pop()!;
        const parentPath = parts.join("/") || ".";
        
        const parentDir = this.resolvePath(parentPath);
        if (!parentDir) {return { success: false, error: "No such file or directory" };}
        if (!parentDir.isDirectory) {return { success: false, error: "Not a directory" };}
        
        if (!parentDir.children.has(fileName)) {
            const newNode = new FsNode(fileName, false, parentDir);
            parentDir.children.set(fileName, newNode);
        }
        return { success: true };
    }

    writeFile(path: string, content: string): { success: boolean, error?: string } {
        this.touch(path);
        const node = this.resolvePath(path);
        if (node && !node.isDirectory) {
            node.content = content;
            return { success: true };
        }
        return { success: false, error: "Is a directory" };
    }

    appendFile(path: string, content: string): { success: boolean, error?: string } {
        const existing = this.readFile(path);
        if (existing.success) {
            return this.writeFile(path, (existing.content || "") + content);
        }
        return this.writeFile(path, content);
    }

    readFile(path: string): { success: boolean, content?: string, error?: string } {
        const node = this.resolvePath(path);
        if (!node) {return { success: false, error: "No such file or directory" };}
        if (node.isDirectory) {return { success: false, error: "Is a directory" };}
        return { success: true, content: node.content };
    }

    stat(path: string): { success: boolean; node?: FsNode; error?: string } {
        const node = this.resolvePath(path);
        if (!node) {
            return { success: false, error: "No such file or directory" };
        }
        return { success: true, node };
    }

    rm(path: string, recursive: boolean = false, force: boolean = false): { success: boolean, error?: string } {
        const node = this.resolvePath(path);
        if (!node) {return { success: force, error: force ? undefined : "No such file or directory" };}
        
        if (node.isDirectory && !recursive) {
            return { success: false, error: "Is a directory" };
        }

        if (node.parent) {
            node.parent.children.delete(node.name);
            return { success: true };
        }
        return { success: false, error: "Cannot remove root" };
    }

    ls(path: string = "."): { success: boolean, items?: string[], error?: string } {
        const node = this.resolvePath(path);
        if (!node) {return { success: false, error: "No such file or directory" };}
        if (!node.isDirectory) {return { success: true, items: [node.name] };}
        
        return { success: true, items: Array.from(node.children.keys()) };
    }

    cd(path: string): { success: boolean, error?: string } {
        const node = this.resolvePath(path);
        if (!node) {return { success: false, error: "No such file or directory" };}
        if (!node.isDirectory) {return { success: false, error: "Not a directory" };}
        
        this.currentDir = node;
        return { success: true };
    }

    private serializeNode(node: FsNode): VirtualFsSerializedNode {
        return {
            name: node.name,
            isDirectory: node.isDirectory,
            content: node.content,
            mode: node.mode,
            children: Array.from(node.children.values()).map((child) => this.serializeNode(child))
        };
    }

    private deserializeNode(raw: VirtualFsSerializedNode, parent: FsNode | null): FsNode {
        const node = new FsNode(raw.name, raw.isDirectory, parent, raw.mode);
        node.content = raw.content ?? "";
        for (const child of raw.children ?? []) {
            const childNode = this.deserializeNode(child, node);
            node.children.set(childNode.name, childNode);
        }
        return node;
    }

    private cloneNode(node: FsNode, parent: FsNode | null): FsNode {
        const cloned = new FsNode(node.name, node.isDirectory, parent, node.mode);
        cloned.content = node.content;
        for (const child of node.children.values()) {
            const clonedChild = this.cloneNode(child, cloned);
            cloned.children.set(clonedChild.name, clonedChild);
        }
        return cloned;
    }

    private walk(node: FsNode, visitor: (node: FsNode) => void): void {
        visitor(node);
        if (!node.isDirectory) {
            return;
        }

        for (const child of node.children.values()) {
            this.walk(child, visitor);
        }
    }

    private buildTree(node: FsNode, absolutePath: string, depth: number, maxDepth: number): FileTreeNode {
        const treeNode: FileTreeNode = {
            name: node.name || "/",
            path: absolutePath,
            isDirectory: node.isDirectory,
            children: []
        };

        if (!node.isDirectory || depth >= maxDepth) {
            return treeNode;
        }

        const children = Array.from(node.children.values()).sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        treeNode.children = children.map((child) => this.buildTree(child, this.getAbsolutePath(child), depth + 1, maxDepth));
        return treeNode;
    }
}
