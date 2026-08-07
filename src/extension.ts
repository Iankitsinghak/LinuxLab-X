import * as vscode from 'vscode';
import { TerminalViewProvider } from './TerminalViewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('[LinuxLabX] activate called');
    const provider = new TerminalViewProvider(context.extensionUri, context.workspaceState);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(TerminalViewProvider.viewType, provider)
    );
    console.log('[LinuxLabX] Webview provider registered for view id:', TerminalViewProvider.viewType);

    context.subscriptions.push(
        vscode.commands.registerCommand('linuxlabx.start', () => {
            vscode.commands.executeCommand('workbench.view.extension.linuxlabx');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('linuxlabx.resetSession', () => {
            provider.resetSession();
            vscode.window.showInformationMessage('LinuxLabX session reset.');
            vscode.commands.executeCommand('workbench.view.extension.linuxlabx');
        })
    );
}

export function deactivate() {}