import * as vscode from 'vscode';
import * as TOML from '@iarna/toml';
import axios from 'axios';

interface CargoDepValue {
    version?: string;
    [key: string]: any;
}

type CargoDependency = string | CargoDepValue;

interface CargoDependencies {
    [key: string]: CargoDependency;
}

interface CargoToml {
    dependencies?: CargoDependencies;
    'dev-dependencies'?: CargoDependencies;
    'build-dependencies'?: CargoDependencies;
    [key: string]: any;
}

// Global variables
let decorationType: vscode.TextEditorDecorationType;
let outputChannel: vscode.OutputChannel;
// Store decorations globally with crate names as keys
let currentDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

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

    console.log = function(...args: any[]) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        outputChannel?.appendLine(`[LOG] ${message}`);
        originalConsoleLog.apply(console, args);
    };

    console.error = function(...args: any[]) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        outputChannel?.appendLine(`[ERROR] ${message}`);
        originalConsoleError.apply(console, args);
    };

    console.debug = function(...args: any[]) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        outputChannel?.appendLine(`[DEBUG] ${message}`);
    };
}

export function activate(context: vscode.ExtensionContext) {
    // Initialize logging first
    initializeLogging();
    console.log('Cargo Latest Version extension is now active');
    
    decorationType = vscode.window.createTextEditorDecorationType({
        before: {
            margin: '0 0 0 1em',
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
        }
    });

    // Subscribe to document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || event.document !== editor.document) {
                return;
            }

            if (!editor.document.fileName.endsWith('Cargo.toml')) {
                return;
            }

            // Process each change
            for (const change of event.contentChanges) {
                const lineNumber = change.range.start.line;
                const lineText = editor.document.lineAt(lineNumber).text;

                // Check for new dependency line patterns
                const isEqualsSign = change.text === '=';
                const isNewDependencyLine = lineText.match(/^\s*[a-zA-Z0-9_-]+\s*=\s*$/);

                // Check if this is a new dependency line being created
                if (isEqualsSign || isNewDependencyLine) {
                    const match = lineText.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*$/);
                    if (match) {
                        const crateName = match[1];
                        await addNewDependencyDecoration(editor, lineNumber, crateName);
                    }
                } else {
                    await updateLatestVersions(editor);
                }
            }
        })
    );

    // Subscribe to active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor) {
                await updateLatestVersions(editor);
            }
        })
    );

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

    context.subscriptions.push(showLatestVersions);

    // Initial check for already open Cargo.toml
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.fileName.endsWith('Cargo.toml')) {
        console.log('Found already open Cargo.toml, checking versions');
        updateLatestVersions(activeEditor);
    }
}

async function checkCargoTomlDocument(uri: vscode.Uri) {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        await updateLatestVersions(editor);
    } catch (e) {
        console.error('Failed to check Cargo.toml:', e);
    }
}

async function updateLatestVersions(editor: vscode.TextEditor) {
    if (!editor || !editor.document) {
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'toml' || !document.fileName.endsWith('Cargo.toml')) {
        return;
    }

    // Clear all existing decorations
    currentDecorations.clear();
    editor.setDecorations(decorationType, []);

    const text = document.getText();
    let cargo: CargoToml;
    
    try {
        cargo = TOML.parse(text);
    } catch (e) {
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
        if (!section.data || typeof section.data !== 'object') continue;

        for (const [crateName, value] of Object.entries<CargoDependency>(section.data)) {
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
                const response = await axios.get(`https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`);
                const data = response.data as any;
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
                const decoration: vscode.DecorationOptions = {
                    range: new vscode.Range(position.line, position.character, position.line, position.character),
                    renderOptions: {
                        before: {
                            contentText: latestVersion === cleanVersion ? 
                                ` ( = latest: ${latestVersion} )` : 
                                ` ( < latest: ${latestVersion} )`,
                            color: latestVersion === cleanVersion ? '#4EC9B0' : '#FFA500'
                        }
                    }
                };
                currentDecorations.set(crateName, [decoration]);
            } catch (e) {
                console.error(`Failed to fetch version for ${crateName}:`, e);
                continue;
            }
        }
    }

    // Apply all decorations
    editor.setDecorations(decorationType, Array.from(currentDecorations.values()).flat());
}

async function addNewDependencyDecoration(editor: vscode.TextEditor, lineNumber: number, crateName: string) {
    try {
        const latestVersion = await getLatestVersion(crateName);
        if (!latestVersion) {
            return;
        }

        const line = editor.document.lineAt(lineNumber);
        const position = new vscode.Position(lineNumber, line.text.length);
        const newDependencyDecoration: vscode.DecorationOptions = {
            range: new vscode.Range(position.line, position.character, position.line, position.character),
            renderOptions: {
                before: {
                    contentText: ` "${latestVersion}"`,
                    color: '#4EC9B0'
                }
            }
        };

        // Add to decoration map
        currentDecorations.set(crateName, [newDependencyDecoration]);
        editor.setDecorations(decorationType, [newDependencyDecoration]);

    } catch (error) {
        console.error('Error adding new dependency decoration:', error);
    }
}

async function getLatestVersion(crateName: string) {
    try {
        const response = await axios.get(`https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`);
        const data = response.data as any;
        return data.crate.max_version;
    } catch (error) {
        console.error('Error fetching latest version:', error);
        return null;
    }
}

export function deactivate() {
    if (decorationType) {
        decorationType.dispose();
    }
}
