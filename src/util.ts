import * as vscode from 'vscode';
import { Observable } from 'rxjs';

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
