import * as vscode from 'vscode';
import parseDepsFromFile from './parseDepsFromFile';
import { BehaviorSubject } from 'rxjs';
import { startWith, distinctUntilChanged, map } from 'rxjs/operators';
import { vscToObservable } from '../util';
const isEqual = require('lodash/fp/isEqual');
const path = require('path');

// Manages the auto-detection of a runtime's dependencies
export default class Runtime {

  deps$: BehaviorSubject<string[]>;

  _watcher: vscode.FileSystemWatcher;

  constructor(public runtimePath: string) {
    this._watcher = vscode.workspace.createFileSystemWatcher(
      path.join(runtimePath,'Cargo.toml'), true, false, true
    );
    // Note that moving Cargo.toml around (e.g. removing/adding) will mess up the events.
    // TODO listen to all three events? Probably sounder.
    const fileChange$ = vscToObservable(this._watcher.onDidChange.bind(this._watcher));

    this.deps$ = new BehaviorSubject([] as string[]);
    fileChange$
      .pipe(
        startWith(null),
        map(() => parseDepsFromFile(path.join(runtimePath,'Cargo.toml'))),
        distinctUntilChanged(isEqual)
      ).subscribe(this.deps$);
  }

  dispose() {
    this._watcher.dispose(); // can Runtime still be garbage collected?
    // todo use setinterval unref to check if old runtime gets gc'd
  }
}