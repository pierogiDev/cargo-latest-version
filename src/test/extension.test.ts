import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite', () => {
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('cargo-latest-version'));
    });

    test('Should show latest version decoration', async () => {
        const docUri = vscode.Uri.file(
            path.join(__dirname, '../../test-data/Cargo.toml')
        );
        const document = await vscode.workspace.openTextDocument(docUri);
        const editor = await vscode.window.showTextDocument(document);

        // Give some time for the decorations to be applied
        await new Promise(resolve => setTimeout(resolve, 2000));

        // At this point, decorations should be visible
        // You can add more specific assertions based on your needs
    });
});
