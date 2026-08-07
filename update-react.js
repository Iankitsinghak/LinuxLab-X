const fs = require('fs');
const filepath = __dirname + '/src/TerminalViewProvider.ts';
let content = fs.readFileSync(filepath, 'utf8');

const startIndex = content.indexOf('private _getHtmlForWebview');
if (startIndex !== -1) {
    const header = content.substring(0, startIndex);
    const replacement = `private _getHtmlForWebview(webview: vscode.Webview) {
        return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LinuxLabX Session</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- React & ReactDOM -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <!-- Babel -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        input:focus { outline: none; }
    </style>
</head>
<body class="bg-black text-green-400 font-mono overflow-hidden">
    <div id="root"></div>
    <script type="text/babel">
        const vscode = acquireVsCodeApi();

        function Terminal() {
            const [history, setHistory] = React.useState([
                { type: 'info', content: 'LinuxLabX terminal session started.' },
                { type: 'info', content: 'Type help for commands or tutorial to begin.' }
            ]);
            const [input, setInput] = React.useState('');
            const [prompt, setPrompt] = React.useState('linuxuser@linuxlabx:~ $');
            const [cmdHistory, setCmdHistory] = React.useState([]);
            const [historyIdx, setHistoryIdx] = React.useState(-1);
            
            const inputRef = React.useRef(null);
            const endRef = React.useRef(null);

            // Auto-scroll to bottom whenever history changes
            React.useEffect(() => {
                endRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, [history]);

            // Keep input focused on clicks
            React.useEffect(() => {
                const handleGlobalClick = () => {
                    if (window.getSelection().toString().length === 0) {
                        inputRef.current?.focus();
                    }
                };
                document.addEventListener('click', handleGlobalClick);
                return () => document.removeEventListener('click', handleGlobalClick);
            }, []);

            // Listen to messages from VS Code
            React.useEffect(() => {
                const messageHandler = (event) => {
                    const msg = event.data;
                    if (!msg) return;

                    if (msg.type === 'clear') {
                        setHistory([]);
                    } else if (['success', 'error', 'info'].includes(msg.type)) {
                        let combinedContent = '';
                        if (msg.output) {
                            combinedContent += msg.output;
                        }
                        if (combinedContent) {
                            setHistory(prev => [...prev, { type: msg.type, content: combinedContent }]);
                        }
                        if (msg.smartTip) {
                            setHistory(prev => [...prev, { type: 'tip', content: msg.smartTip }]);
                        }
                    } else if (msg.type === 'state') {
                        if (msg.prompt) setPrompt(msg.prompt);
                    } else if (msg.type === 'autocomplete_result') {
                        const suggestions = msg.suggestions || [];
                        if (suggestions.length === 1) {
                            setInput(prev => {
                                const parts = prev.split(' ');
                                parts[parts.length - 1] = suggestions[0];
                                return parts.join(' ');
                            });
                        } else if (suggestions.length > 1) {
                            setHistory(prev => [
                                ...prev, 
                                { type: 'command', content: input, prompt },
                                { type: 'info', content: suggestions.join('  ') }
                            ]);
                        }
                    }
                };

                window.addEventListener('message', messageHandler);
                vscode.postMessage({ type: 'init' });
                return () => window.removeEventListener('message', messageHandler);
            }, [input, prompt]);

            const handleKeyDown = (e) => {
                if ((e.key === 'Enter' || e.code === 'Enter') && !e.isComposing) {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('terminal-execute', { detail: input }));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (cmdHistory.length > 0) {
                        const newIdx = historyIdx < 0 ? cmdHistory.length - 1 : Math.max(0, historyIdx - 1);
                        setHistoryIdx(newIdx);
                        setInput(cmdHistory[newIdx]);
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (historyIdx >= 0) {
                        const newIdx = historyIdx + 1;
                        if (newIdx >= cmdHistory.length) {
                            setHistoryIdx(-1);
                            setInput('');
                        } else {
                            setHistoryIdx(newIdx);
                            setInput(cmdHistory[newIdx]);
                        }
                    }
                } else if (e.key === 'c' && e.ctrlKey) {
                    e.preventDefault();
                    setHistory(prev => [...prev, { type: 'command', content: input + '^C', prompt }]);
                    setInput('');
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    vscode.postMessage({ type: 'autocomplete', command: input });
                }
            };

            // Dedicated execute effect to avoid strict scope bugs
            React.useEffect(() => {
                const execHandler = (e) => {
                    const cmd = e.detail.trim();
                    if (cmd) {
                        setHistory(prev => [...prev, { type: 'command', content: cmd, prompt }]);
                        setCmdHistory(prev => [...prev, cmd]);
                        setHistoryIdx(-1);
                        vscode.postMessage({ type: 'execute', command: cmd });
                    } else {
                        setHistory(prev => [...prev, { type: 'command', content: '', prompt }]);
                    }
                    setInput('');
                };
                window.addEventListener('terminal-execute', execHandler);
                return () => window.removeEventListener('terminal-execute', execHandler);
            }, [prompt]);

            const renderPrompt = (pText) => {
                const trimmed = String(pText || '').trim();
                const at = trimmed.indexOf('@');
                const colon = trimmed.indexOf(':', at + 1);
                const lastSpace = trimmed.lastIndexOf(' ');
                
                if (at <= 0 || colon <= at || lastSpace <= colon) {
                    return <span className="text-green-500">{pText}</span>;
                }
                
                return (
                    <span className="whitespace-pre">
                        <span className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">{trimmed.slice(0, at)}</span>
                        <span className="text-green-500">@{trimmed.slice(at + 1, colon)}</span>
                        <span className="text-green-300">:{trimmed.slice(colon + 1, lastSpace)}</span>
                        <span className="text-green-50 drop-shadow-[0_0_2px_rgba(255,255,255,0.4)]"> {trimmed.slice(lastSpace + 1)}</span>
                    </span>
                );
            };

            return (
                <div className="flex flex-col h-screen p-4 custom-scrollbar overflow-y-auto">
                    {history.map((entry, idx) => (
                        <div key={idx} className="mb-2 break-words">
                            {entry.type === 'command' ? (
                                <div className="flex flex-wrap items-baseline gap-2">
                                    {renderPrompt(entry.prompt || prompt)}
                                    <span className="text-green-400 font-bold">{entry.content}</span>
                                </div>
                            ) : (
                                <div className={\`whitespace-pre-wrap \${
                                    entry.type === 'error' ? 'text-red-400' :
                                    entry.type === 'info' ? 'text-blue-300' :
                                    entry.type === 'tip' ? 'text-yellow-300' :
                                    'text-green-200'
                                }\`}>
                                    {entry.content}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <div className="flex items-baseline gap-2 mt-1">
                        {renderPrompt(prompt)}
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none text-green-400 font-bold caret-green-400"
                            autoFocus
                            spellCheck="false"
                            autoComplete="off"
                        />
                    </div>
                    <div ref={endRef} className="h-8" />
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<Terminal />);
    </script>
</body>
</html>\`;
    }
}
`;
    fs.writeFileSync(filepath, header + replacement);
    console.log('Successfully updated to React Terminal in ' + filepath);
} else {
    console.log('Could not find replace point');
}