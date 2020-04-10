import * as vscode from 'vscode';
import { BehaviorSubject, merge, of } from 'rxjs';
import { filter, map, tap, throttleTime } from 'rxjs/operators';
import { vscToObservable } from '../util';
import findRuntimes from './findRuntimes';
import Runtime from './Runtime';

export default class Runtimes {

  // State should be used very carefully. Tenacious references to any one of the
  // enclosed Runtime would result in memory leaks. Processing on the value of
  // the observable should be done without keeping any reference to the Runtime.
  // TODO Find a fool-proof way to let users use this variable without leaving
  // dangling references.
  runtimes$: BehaviorSubject<Runtime[]>;

  constructor() {
    // TODO add to the deactivate function of extension.ts? Not sure if vscode
    // does this automatically. Evtl add a dispose() function to the class.
    const watcher = vscode.workspace.createFileSystemWatcher('**/build.rs');

    const runtimesPaths$ = merge(
      // Scan on startup
      of(null),
      // Scan on file changes involving build.rs
      merge(
        vscToObservable(watcher.onDidChange.bind(watcher)),
        vscToObservable(watcher.onDidCreate.bind(watcher)),
        vscToObservable(watcher.onDidDelete.bind(watcher))
      ).pipe(throttleTime(100)) // e.g. in case of renaming folders, we receive a delete + added event.
    ).pipe
      (
        map(() => findRuntimes(vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath) || [])),
        tap(r => console.log('Found runtimes paths',r))
      );

    this.runtimes$ = new BehaviorSubject(<Runtime[]>[]);

    runtimesPaths$.pipe(
        // Only keep if runtimes have changed
        filter(newRuntimePaths =>
          this.runtimes$.getValue().length !== newRuntimePaths.length
          || !this.runtimes$.getValue().every(runtime => newRuntimePaths.includes(runtime.runtimePath))
        ),
        map(newRuntimePaths => {
          // Compute which of the previous Runtime instances to keep, which one
          // to discard, and which new Runtime instances to create.
          // We could also dispose of all of them and recreate them anew each
          // time (TODO).
          const remainingRuntimes = [...this.runtimes$.getValue()];
          const newRuntimes = newRuntimePaths.map(newRuntimePath =>
             (remainingRuntimes.find((oldRuntime, index) => oldRuntime.runtimePath === newRuntimePath && remainingRuntimes.splice(index,1))
             || new Runtime(newRuntimePath))
          );
          remainingRuntimes.forEach(remainingRuntime => remainingRuntime.dispose());
          return newRuntimes;
        }),
        tap(r => console.log('Runtimes are now',r))
      )
      .subscribe(this.runtimes$);
  }
}