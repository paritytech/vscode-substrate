import * as vscode from 'vscode';

export function resolveWhenTerminalClosed(term: vscode.Terminal): Promise<undefined> {
  return new Promise((resolve, reject) => {
    const disp = vscode.window.onDidCloseTerminal(t => {
      if (t === term) {
        disp.dispose();
        resolve();
      }
    });
  });
}