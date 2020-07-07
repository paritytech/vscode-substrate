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
  const fsPaths = vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath) || [];
  if (fsPaths.length !== 1) return fullPath;
  return path.relative(fsPaths[0], fullPath);
}

export async function showInputBoxValidate(options: vscode.InputBoxOptions, validateFn: (x: any) => Promise<string>) {
  do {
    const a = await vscode.window.showInputBox(options);
    if (a === undefined)
      return a;
    else {
      let err = await validateFn(a);
      if (err !== '')
        vscode.window.showErrorMessage(err);
      else
        return a;
    }
  } while (true);
}