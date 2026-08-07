import * as vscode from 'vscode';
import { CommandEngine, CommandEngineState } from './CommandEngine';

export class TerminalViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'linuxlabxView';
    private static readonly stateKey = 'linuxlabx.sessionState';
    private _view?: vscode.WebviewView;
    private engine: CommandEngine;
    private readonly autoRestore: boolean;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _state: vscode.Memento
    ) {
        this.engine = new CommandEngine();
        this.autoRestore = vscode.workspace.getConfiguration('linuxlabx').get<boolean>('autoRestoreSession', true);
        if (this.autoRestore) {
            const state = this._state.get<CommandEngineState>(TerminalViewProvider.stateKey);
            this.engine.importState(state);
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('[LinuxLabX] resolveWebviewView called');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            try {
                console.log('[LinuxLabX] webview message:', data?.type);
                switch (data.type) {
                    case 'execute':
                        {
                            console.log('[LinuxLabX] execute command:', data.command);
                            if (data.command === 'clear') {
                                webviewView.webview.postMessage({ type: 'clear' });
                                this.postShellState(webviewView.webview);
                                break;
                            }
                            const result = this.engine.execute(data.command);
                            if (result) {
                                console.log('[LinuxLabX] execute result type:', result.type);
                                webviewView.webview.postMessage(result);
                                this.persistState();
                            }
                            this.postShellState(webviewView.webview, result || undefined);
                            break;
                        }
                    case 'autocomplete':
                        {
                            const suggestions = this.engine.autocomplete(data.command);
                            webviewView.webview.postMessage({
                                type: 'autocomplete_result',
                                suggestions,
                                requestId: data.requestId,
                                query: data.command,
                            });
                            break;
                        }
                    case 'init':
                        {
                            this.postShellState(webviewView.webview);
                            break;
                        }
                    case 'request_state':
                        {
                            this.postShellState(webviewView.webview);
                            break;
                        }
                    case 'reset_session':
                        {
                            this.engine.reset();
                            this.persistState();
                            webviewView.webview.postMessage({ type: 'clear' });
                            this.postShellState(webviewView.webview);
                            break;
                        }
                    case 'run_suggestion':
                        {
                            const cmd = (data.command || '').trim();
                            if (!cmd) {
                                break;
                            }
                            const result = this.engine.execute(cmd);
                            if (result) {
                                webviewView.webview.postMessage({
                                    type: 'echo_command',
                                    command: cmd,
                                    prompt: this.engine.getPrompt()
                                });
                                webviewView.webview.postMessage(result);
                                this.persistState();
                            }
                            this.postShellState(webviewView.webview, result || undefined);
                            break;
                        }
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                webviewView.webview.postMessage({ type: 'error', output: `LinuxLabX backend error: ${message}` });
            }
        });
    }

    public resetSession() {
        this.engine.reset();
        this.persistState();
        if (this._view) {
            this._view.webview.postMessage({ type: 'clear' });
            this.postShellState(this._view.webview);
        }
    }

    private postShellState(webview: vscode.Webview, result?: { tutorialProgress?: unknown; fsTree?: unknown; suggestions?: string[] }) {
        webview.postMessage({
            type: 'state',
            prompt: this.engine.getPrompt(),
            tutorialProgress: result?.tutorialProgress || this.engine.getTutorialProgress(),
            fsTree: result?.fsTree || this.engine.getFileTree(),
            suggestions: result?.suggestions || this.engine.getSuggestions()
        });
    }

    private persistState() {
        if (!this.autoRestore) {
            return;
        }
        void this._state.update(TerminalViewProvider.stateKey, this.engine.exportState());
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const tailwindUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'lib', 'tailwindcss.js'));
        const reactUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'lib', 'react.production.min.js'));
        const reactDomUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'lib', 'react-dom.production.min.js'));
        const babelUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'lib', 'babel.min.js'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LinuxLabX</title>
    <script src="${tailwindUri}"></script>
    <script crossorigin src="${reactUri}"></script>
    <script crossorigin src="${reactDomUri}"></script>
    <script src="${babelUri}"></script>
    <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{overflow:hidden;background:#050805}
        .cs::-webkit-scrollbar{width:5px}
        .cs::-webkit-scrollbar-track{background:transparent}
        .cs::-webkit-scrollbar-thumb{background:rgba(34,197,94,0.15);border-radius:3px}
        .cs::-webkit-scrollbar-thumb:hover{background:rgba(34,197,94,0.35)}
        @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{text-shadow:0 0 8px rgba(34,197,94,0.3)}50%{text-shadow:0 0 14px rgba(34,197,94,0.6)}}
        .cblink{animation:blink 1s steps(1,end) infinite}
        .fin{animation:fadeIn 0.05s ease-out}
        .lglow{animation:glow 3s ease-in-out infinite}
        .ghost{color:rgba(156,163,175,0.45)}
        .tb{background:rgba(0,0,0,0.35);border:1px solid rgba(34,197,94,0.12);color:rgba(134,239,172,0.65);
            border-radius:3px;padding:2px 6px;font-size:9px;cursor:pointer;transition:all 0.05s;white-space:nowrap;font-family:inherit;
            display:inline-flex;align-items:center;justify-content:center;gap:3px}
        .tb:hover{border-color:rgba(74,222,128,0.4);color:#bbf7d0;background:rgba(34,197,94,0.08)}
        .tb.on{border-color:rgba(74,222,128,0.35);background:rgba(34,197,94,0.1)}
        input:focus{outline:none}
    </style>
</head>
<body class="text-green-400 font-mono text-xs">
<div id="root"></div>
<script type="text/babel">
const vscode = acquireVsCodeApi();

function Terminal() {
    const [history, setHistory] = React.useState([]);
    const [input, setInput] = React.useState('');
    const [prompt, setPrompt] = React.useState('linuxuser@linuxlabx:~ $');
    const [cmdHistory, setCmdHistory] = React.useState([]);
    const [historyIdx, setHistoryIdx] = React.useState(-1);
    const [sugOn, setSugOn] = React.useState(true);
    const [suggestions, setSuggestions] = React.useState([]);
    const [cmdCount, setCmdCount] = React.useState(0);
    const [cwd, setCwd] = React.useState('~');

    const inputRef = React.useRef(null);
    const endRef = React.useRef(null);
    const acRef = React.useRef(0);
    const sugRef = React.useRef(true);

    React.useEffect(() => { sugRef.current = sugOn; if(!sugOn) setSuggestions([]); }, [sugOn]);

    const getMatch = (v, s) => {
        for (const x of s) { if (x && x.indexOf(v) === 0 && x !== v) return x; }
        return '';
    };
    const getGhost = (v, s) => { const m = getMatch(v, s); return m ? m.slice(v.length) : ''; };
    const getDanger = (v) => {
        const n = v.trimStart();
        if (/^rm\\s+(-[rRf]+\\s+)*(\\/|~)/.test(n)) return '\\u26a0\\ufe0f WARNING: This targets critical paths!';
        if (/^rm(?:\\s|$)/.test(n)) return '\\ud83d\\udca1 rm removes files permanently.';
        if (/^chmod(?:\\s|$)/.test(n)) return '\\ud83d\\udca1 chmod changes permissions.';
        return '';
    };

    React.useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}); }, [history]);

    React.useEffect(() => {
        const h = (e) => {
            if (e.target && e.target.closest && e.target.closest('button')) return;
            if (!window.getSelection().toString()) inputRef.current?.focus();
        };
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    React.useEffect(() => {
        const handler = (event) => {
            const msg = event.data;
            if (!msg) return;
            if (msg.type === 'clear') { setHistory([]); setSuggestions([]); }
            else if (['success','error','info'].includes(msg.type)) {
                if (msg.output) setHistory(p => [...p, {type:msg.type, content:msg.output}]);
                if (msg.smartTip) setHistory(p => [...p, {type:'tip', content:msg.smartTip}]);
            } else if (msg.type === 'state') {
                if (msg.prompt) {
                    setPrompt(msg.prompt);
                    const m = msg.prompt.match(/:([^\\s]+)\\s*\\$/);
                    if (m) setCwd(m[1]);
                }
            } else if (msg.type === 'autocomplete_result') {
                if (!sugRef.current) return;
                if (typeof msg.requestId === 'number' && msg.requestId !== acRef.current) return;
                setSuggestions(Array.isArray(msg.suggestions) ? msg.suggestions : []);
            } else if (msg.type === 'echo_command') {
                setHistory(p => [...p, {type:'command', content:msg.command, prompt:msg.prompt}]);
            }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({type:'init'});
        return () => window.removeEventListener('message', handler);
    }, []);

    React.useEffect(() => {
        if (!sugOn || !input.trim()) { setSuggestions([]); return; }
        const t = setTimeout(() => {
            acRef.current += 1;
            vscode.postMessage({type:'autocomplete', command:input, requestId:acRef.current});
        }, 100);
        return () => clearTimeout(t);
    }, [input, sugOn]);

    const onKey = (e) => {
        if ((e.key==='Enter'||e.code==='Enter') && !e.isComposing) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('terminal-exec', {detail:input}));
        } else if (e.key==='ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length) {
                const i = historyIdx<0 ? cmdHistory.length-1 : Math.max(0,historyIdx-1);
                setHistoryIdx(i); setInput(cmdHistory[i]);
            }
        } else if (e.key==='ArrowDown') {
            e.preventDefault();
            if (historyIdx>=0) {
                const i=historyIdx+1;
                if (i>=cmdHistory.length) { setHistoryIdx(-1); setInput(''); }
                else { setHistoryIdx(i); setInput(cmdHistory[i]); }
            }
        } else if (e.key==='c' && e.ctrlKey) {
            e.preventDefault();
            setHistory(p=>[...p,{type:'command',content:input+'^C',prompt}]); setInput('');
        } else if (e.key==='l' && e.ctrlKey) {
            e.preventDefault();
            setHistory([]); setSuggestions([]);
            vscode.postMessage({type:'execute',command:'clear'});
        } else if (e.key==='Tab') {
            e.preventDefault();
            if (sugOn) {
                const m = getMatch(input, suggestions);
                if (m) { setInput(m); setHistoryIdx(-1); setSuggestions([]); return; }
                acRef.current += 1;
                vscode.postMessage({type:'autocomplete',command:input,requestId:acRef.current});
            }
        }
    };

    React.useEffect(() => {
        const h = (e) => {
            const cmd = e.detail.trim();
            if (cmd) {
                setHistory(p=>[...p,{type:'command',content:cmd,prompt}]);
                setCmdHistory(p=>[...p,cmd]);
                setHistoryIdx(-1); setCmdCount(p=>p+1);
                vscode.postMessage({type:'execute',command:cmd});
            } else {
                setHistory(p=>[...p,{type:'command',content:'',prompt}]);
            }
            setInput('');
        };
        window.addEventListener('terminal-exec', h);
        return () => window.removeEventListener('terminal-exec', h);
    }, [prompt]);

    const renderPrompt = (p) => {
        const t = String(p||'').trim();
        const at=t.indexOf('@'), colon=t.indexOf(':',at+1), sp=t.lastIndexOf(' ');
        if (at<=0||colon<=at||sp<=colon) return <span className="text-green-500">{p}</span>;
        return (
            <span className="whitespace-pre" style={{fontSize:'11px'}}>
                <span style={{color:'#4ade80',textShadow:'0 0 8px rgba(74,222,128,0.3)'}}>{t.slice(0,at)}</span>
                <span style={{color:'#22c55e'}}>@{t.slice(at+1,colon)}</span>
                <span style={{color:'#22d3ee'}}>:{t.slice(colon+1,sp)}</span>
                <span style={{color:'#f0fdf4',textShadow:'0 0 2px rgba(255,255,255,0.25)'}}> {t.slice(sp+1)}</span>
            </span>
        );
    };

    const hint = sugOn ? getDanger(input) : '';
    const ghost = sugOn ? getGhost(input, suggestions) : '';

    return (
        <div className="flex flex-col h-screen" style={{background:'linear-gradient(180deg,#080c08 0%,#040604 100%)'}}>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-2 shrink-0" style={{
                height:'28px', borderBottom:'1px solid rgba(34,197,94,0.1)',
                background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)'
            }}>
                <span className="lglow" style={{fontSize:'9px',color:'#22c55e',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>
                    ● LINUXLABX <span style={{color: 'rgba(134,239,172,0.5)', textTransform: 'none', marginLeft: '4px'}}>by AK</span>
                </span>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>setSugOn(p=>!p)} className={'tb'+(sugOn?' on':'')} title="Toggle Auto Complete">
                        {sugOn ? 'Auto Complete: ON' : 'Auto Complete: OFF'}
                    </button>
                    <button type="button" onClick={()=>{
                        setInput('');setHistoryIdx(-1);setCmdHistory([]);setSuggestions([]);setCmdCount(0);
                        vscode.postMessage({type:'reset_session'});
                    }} className="tb" title="Restart Session">Restart Session</button>
                </div>
            </div>

            {/* Terminal Output */}
            <div className="flex-1 overflow-y-auto cs" style={{padding:'8px 10px 0 10px'}}>

                {history.length === 0 && (
                    <div className="fin" style={{
                        padding:'8px 10px',borderRadius:'5px',marginBottom:'10px',
                        border:'1px solid rgba(34,197,94,0.08)',background:'rgba(34,197,94,0.03)'
                    }}>
                        <div style={{fontSize:'11px',color:'#4ade80',fontWeight:600,marginBottom:'3px'}}>
                            Welcome to LinuxLabX
                        </div>
                        <div style={{fontSize:'10px',color:'#86efac',opacity:0.65,lineHeight:1.5}}>
                            Interactive Linux terminal simulator.<br/>
                            Type <span style={{color:'#60a5fa',fontWeight:600}}>help</span> for commands
                            or <span style={{color:'#60a5fa',fontWeight:600}}>tutorial</span> to begin.
                        </div>
                    </div>
                )}

                {history.map((entry, idx) => (
                    <div key={idx} className="fin" style={{marginBottom:'5px',wordBreak:'break-word'}}>
                        {entry.type === 'command' ? (
                            <div className="flex flex-wrap items-baseline gap-1" style={{lineHeight:1.4}}>
                                {renderPrompt(entry.prompt || prompt)}
                                <span className="text-green-400 font-bold" style={{fontSize:'11px'}}>{entry.content}</span>
                            </div>
                        ) : (
                            <div style={{
                                whiteSpace:'pre-wrap', lineHeight:1.4, fontSize:'11px',
                                color: entry.type==='error' ? '#f87171' :
                                       entry.type==='info' ? '#60a5fa' :
                                       entry.type==='tip' ? '#fbbf24' : '#bbf7d0',
                                paddingLeft: entry.type==='tip' ? '7px' : '0',
                                borderLeft: entry.type==='tip' ? '2px solid rgba(251,191,36,0.25)' : 'none'
                            }}>
                                {entry.content}
                            </div>
                        )}
                    </div>
                ))}

                {/* Input */}
                <div className="flex items-baseline gap-1" style={{marginTop:'3px',lineHeight:1.4}}>
                    {renderPrompt(prompt)}
                    <div className="relative flex-1 min-w-0 overflow-hidden">
                        <div className="pointer-events-none flex items-baseline whitespace-pre overflow-hidden">
                            <span className="text-green-400 font-bold" style={{fontSize:'11px'}}>{input}</span>
                            <span className="cblink inline-block bg-white" style={{height:'1em',width:'0.55ch'}} />
                            {ghost ? <span className="ghost font-bold" style={{fontSize:'11px'}}>{ghost}</span> : null}
                        </div>
                        <input ref={inputRef} type="text" value={input}
                            onChange={(e)=>{setInput(e.target.value);setHistoryIdx(-1);}}
                            onKeyDown={onKey}
                            className="absolute inset-0 w-full bg-transparent border-none text-transparent caret-transparent font-bold"
                            style={{fontSize:'11px'}}
                            autoFocus spellCheck="false" autoComplete="off" />
                    </div>
                </div>

                {hint ? (
                    <div style={{marginTop:'3px',fontSize:'9px',lineHeight:1.3,color:'#fbbf24',opacity:0.7}}>
                        {hint}
                    </div>
                ) : null}

                <div ref={endRef} style={{height:'32px'}} />
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between shrink-0" style={{
                padding:'2px 8px', borderTop:'1px solid rgba(34,197,94,0.08)',
                background:'rgba(0,0,0,0.55)', fontSize:'8px', color:'rgba(134,239,172,0.4)',
                minHeight:'18px'
            }}>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'70%'}}>
                    \\ud83d\\udcc2 {cwd}
                </span>
                <span>{cmdCount} cmd{cmdCount!==1?'s':''}</span>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Terminal />);
<\/script>
</body>
</html>`;
    }
}
