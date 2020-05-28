import * as vscode from 'vscode';
import { Observable } from 'rxjs';

const path = require('path');

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

export function vscToObservable<T>(fn: (arg0: ((x: T) => any)) => any): Observable<T> {
  return new Observable<T>((subscriber) => {
    return fn((x: T) => subscriber.next(x));
  });
}

export function tryShortname(fullPath: string) {
  return fullPath;
  const workspaceRoot = vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath)[0];
  if (!workspaceRoot) return fullPath;
  return path.relative(workspaceRoot, fullPath);
}
