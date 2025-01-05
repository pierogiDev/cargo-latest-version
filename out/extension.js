"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const TOML = __importStar(require("@iarna/toml"));
const axios_1 = __importDefault(require("axios"));
// Global variables
let decorationType;
let outputChannel;
// Store decorations globally with crate names as keys
let currentDecorations = new Map();
// Initialize output channel
function initializeLogging() {
    // Create output channel if it doesn't exist
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Cargo Latest Version');
        outputChannel.show();
    }
    // Override console.log and console.error
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = function (...args) {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        outputChannel?.appendLine(`[LOG] ${message}`);
        originalConsoleLog.apply(console, args);
    };
    console.error = function (...args) {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        outputChannel?.appendLine(`[ERROR] ${message}`);
        originalConsoleError.apply(console, args);
    };
    console.debug = function (...args) {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        outputChannel?.appendLine(`[DEBUG] ${message}`);
    };
}
function activate(context) {
    // Initialize logging first
    initializeLogging();
    console.log('Cargo Latest Version extension is now active');
    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
        }
    });
    // Watch for active editor changes
    let onActiveEditorChanged = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (!editor) {
            console.log('No active editor');
            return;
        }
        console.log('Active editor changed:', {
            fileName: editor.document.fileName,
            languageId: editor.document.languageId
        });
        const isCargoToml = editor.document.fileName.endsWith('Cargo.toml') ||
            (editor.document.languageId === 'toml' && editor.document.fileName.endsWith('Cargo.toml'));
        if (isCargoToml) {
            console.log('Cargo.toml file opened, checking versions automatically');
            updateLatestVersions(editor);
        }
    });
    // Watch for document changes
    let onDocumentChanged = vscode.workspace.onDidChangeTextDocument(async (event) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document) {
            return;
        }
        console.log('Document changed:', {
            fileName: editor.document.fileName,
            languageId: editor.document.languageId
        });
        const isCargoToml = editor.document.fileName.endsWith('Cargo.toml') ||
            (editor.document.languageId === 'toml' && editor.document.fileName.endsWith('Cargo.toml'));
        if (!isCargoToml) {
            return;
        }
        // Process each change
        for (const change of event.contentChanges) {
            const lineNumber = change.range.start.line;
            const lineText = editor.document.lineAt(lineNumber).text;
            const prevText = event.document.getText(change.range);
            console.debug('Processing change:', {
                text: change.text,
                prevText,
                lineNumber,
                lineText,
                range: change.range
            });
            // Check for dependency line patterns
            const isEqualsSign = change.text === '=';
            const isNewDependencyLine = lineText.match(/^\s*[a-zA-Z0-9_-]+\s*=\s*$/);
            const isVersionChange = lineText.match(/^\s*[a-zA-Z0-9_-]+\s*=\s*"[^"]*"/) || // "version"
                lineText.match(/^\s*[a-zA-Z0-9_-]+\s*=\s*'[^']*'/) || // 'version'
                lineText.match(/version\s*=\s*"[^"]*"/); // version = "version"
            console.debug('Change detection:', {
                isEqualsSign,
                isNewDependencyLine,
                isVersionChange,
                lineText
            });
            // Check if this is a new dependency line being created
            if (isEqualsSign || isNewDependencyLine) {
                console.log('Detected new dependency or equals sign');
                // Extract crate name
                const match = lineText.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*$/);
                if (match) {
                    const crateName = match[1];
                    await addNewDependencyDecoration(editor, lineNumber, crateName);
                }
            }
            else if (isVersionChange || change.text === '"' || change.text === "'" || change.text.includes('version')) {
                console.log('Detected version change');
                await updateLatestVersions(editor);
            }
        }
    });
    // Watch for document save
    let onDocumentSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && document === editor.document &&
            document.fileName.toLowerCase().endsWith('Cargo.toml')) {
            console.log('Cargo.toml file saved, updating versions');
            await updateLatestVersions(editor);
        }
    });
    // Register command (as backup)
    let showLatestVersions = vscode.commands.registerCommand('cargo-latest-version.showLatestVersions', () => {
        const editor = vscode.window.activeTextEditor;
        console.log('Command triggered, active editor:', editor?.document.fileName);
        if (!editor) {
            console.log('No active editor');
            vscode.window.showWarningMessage('No active editor found');
            return;
        }
        // Check if it's a Cargo.toml file
        const isCargoToml = editor.document.fileName.endsWith('Cargo.toml') ||
            (editor.document.languageId === 'toml' && editor.document.fileName.endsWith('Cargo.toml'));
        console.log('File check:', {
            fileName: editor.document.fileName,
            isCargoToml
        });
        if (!isCargoToml) {
            console.log('Not a Cargo.toml file');
            vscode.window.showWarningMessage('Please open a Cargo.toml file first');
            return;
        }
        console.log('Starting version check');
        updateLatestVersions(editor);
    });
    context.subscriptions.push(showLatestVersions, onActiveEditorChanged, onDocumentChanged, onDocumentSave);
    // Initial check for already open Cargo.toml
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.fileName.endsWith('Cargo.toml')) {
        console.log('Found already open Cargo.toml, checking versions');
        updateLatestVersions(activeEditor);
    }
}
async function checkCargoTomlDocument(uri) {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        await updateLatestVersions(editor);
    }
    catch (e) {
        console.error('Failed to check Cargo.toml:', e);
    }
}
async function updateLatestVersions(editor) {
    console.log('Updating latest versions');
    const text = editor.document.getText();
    let cargo;
    try {
        cargo = TOML.parse(text);
    }
    catch (e) {
        console.error('Failed to parse TOML:', e);
        return;
    }
    // Process all dependency sections
    const sections = [
        { name: 'dependencies', data: cargo.dependencies },
        { name: 'dev-dependencies', data: cargo['dev-dependencies'] },
        { name: 'build-dependencies', data: cargo['build-dependencies'] }
    ];
    for (const section of sections) {
        if (!section.data || typeof section.data !== 'object')
            continue;
        for (const [crateName, value] of Object.entries(section.data)) {
            console.log(`Processing crate: ${crateName}, value:`, value);
            if (!value) {
                console.log(`Skipping ${crateName}: no value`);
                continue;
            }
            const version = typeof value === 'string' ? value : value.version;
            if (!version) {
                console.log(`Skipping ${crateName}: no version`);
                continue;
            }
            console.log(`Found version for ${crateName}:`, version);
            // Remove any version requirements (^, ~, >=, etc.)
            const cleanVersion = version.replace(/[\^~>=<]/, '').trim();
            console.log(`Clean version for ${crateName}:`, cleanVersion);
            // Find the position of the version in the file
            const pattern = new RegExp(`${crateName}\\s*=\\s*(?:"[^"]*"|'[^']*'|{[^}]*version\\s*=\\s*(?:"[^"]*"|'[^']*')[^}]*})`, 'g');
            const matches = pattern.exec(text);
            if (!matches) {
                console.log(`No matches found for ${crateName}`);
                continue;
            }
            console.log(`Found matches for ${crateName}:`, matches);
            try {
                console.log(`Fetching version for ${crateName}`);
                const response = await axios_1.default.get(`https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`);
                const data = response.data;
                const latestVersion = data.crate.max_version;
                console.log(`Latest version for ${crateName}:`, latestVersion);
                // Find the end of the line
                const lineNumber = editor.document.positionAt(matches.index).line;
                const line = editor.document.lineAt(lineNumber);
                console.log('Line details:', {
                    lineNumber,
                    text: line.text,
                    range: line.range
                });
                // Create decoration at the end of the line
                const position = new vscode.Position(lineNumber, line.text.length);
                const decoration = {
                    range: new vscode.Range(position, position),
                    renderOptions: {
                        after: {
                            contentText: latestVersion === cleanVersion ?
                                ` (latest: ${latestVersion})` :
                                ` ⟶ ${latestVersion}`,
                        }
                    }
                };
                currentDecorations.set(crateName, decoration);
            }
            catch (e) {
                console.error(`Failed to fetch version for ${crateName}:`, e);
                continue;
            }
        }
    }
    // Apply all decorations
    editor.setDecorations(decorationType, Array.from(currentDecorations.values()));
}
async function addNewDependencyDecoration(editor, lineNumber, crateName) {
    try {
        // Remove any existing decoration for this crate
        currentDecorations.delete(crateName);
        console.log(`Fetching version for new dependency: ${crateName}`);
        const response = await axios_1.default.get(`https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`);
        const data = response.data;
        const latestVersion = data.crate.max_version;
        console.log(`Latest version for ${crateName}:`, latestVersion);
        // Create decoration for the new dependency
        const line = editor.document.lineAt(lineNumber);
        const position = new vscode.Position(lineNumber, line.text.length);
        const newDependencyDecoration = {
            range: new vscode.Range(position, position),
            renderOptions: {
                after: {
                    contentText: ` "${latestVersion}"`,
                }
            }
        };
        // Update global decorations
        currentDecorations.set(crateName, newDependencyDecoration);
        editor.setDecorations(decorationType, Array.from(currentDecorations.values()));
    }
    catch (e) {
        console.error(`Failed to fetch version for ${crateName}:`, e);
    }
}
function deactivate() {
    if (decorationType) {
        decorationType.dispose();
    }
}
//# sourceMappingURL=extension.js.map