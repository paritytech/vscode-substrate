import * as vscode from 'vscode';
import { combineLatest, Observable, of, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map, startWith, tap, withLatestFrom, switchMap } from 'rxjs/operators';
import { vscToObservable } from '../util';
import Runtime from './Runtime';
import Runtimes from './Runtimes';

const path = require('path');

// TODO Needs testing, & testing on Windows.
function isInDir(file: string, dir: string): boolean {
  const systemRoot = path.parse(process.cwd()).root;
  if (dir === systemRoot) return true;
  const fileSplits = file.split(path.sep);
  return dir.split(path.sep).every((dirPart, i) => dirPart === fileSplits[i]);
}

/**
 * Returns a user-friendly display name to distinguish one path from a list of
 * others.
 *
 * Given a "folderPath" path and a list of "against" paths, returns the name of
 * the most remote parent folder of folderPath that isn't a parent folder of any
 * of the "against paths".
 */
// e.g. getIdentifyingBit('/home/abc/def/',['/home/abc2/def/', '/home/xyz/']) => 'abc'
// TODO Needs some testing on Windows.
// TODO Actually it's broken in case of ('a/y',['a/x/y']). Should return 'a/y'.
// Currently a/x/z/y returns x, but what if we have another runtime a/z/x and a/z/z? Should return z/x and z/z for them, respectively. i.e. to compute the output we would need to know the output for the other paths, to an extent. Use an external function instead.
function getIdentifyingBit(folderPath: string, against: string[]): string {
  const systemRoot = path.parse(process.cwd()).root;

  // Collect list of absolute paths of every parent folder.
  // Final order is from the root up.
  const parentDirs = [folderPath];
  do {
    parentDirs.unshift(path.dirname(parentDirs[0]))
  } while (parentDirs[0] !== systemRoot)

  // TODO extract to named function
  // TODO use lodash findOr
  // TODO property-testing: Given a set of folders, running the function on each
  //  folder should never produce the same value.
  const f = parentDirs.find(parentDir => !against.some(against => isInDir(against, parentDir)));
  if (f) return path.basename(f);

  console.error('No identifying bit in runtime.');

  return folderPath;
}

// TODO should ideally be Option<{...}>
type Change = {runtimePath: string; deps: string[], shortname: string} | null;

// TODO Does it have to be a class?
export default class CurrentRuntime {

  changes$: BehaviorSubject<Change>;

  _currentRuntime$: Observable<Runtime | null>;

  // TODO Use # instead for private properties.
  constructor(private _runtimes: Runtimes) {

    // TODO Dispose on deactivate?
    const activeEditorPath$ = vscToObservable(vscode.window.onDidChangeActiveTextEditor.bind(vscode.window)).pipe(
      map((te: vscode.TextEditor | undefined) => te?.document.uri.fsPath.toString() || null),
      startWith(vscode.window.activeTextEditor?.document.uri.fsPath || null),
      tap(r => console.log('Active editor is now',r)) // TODO debugTap('Active editor is now',r)
     );

    this._currentRuntime$ = combineLatest(
      this._runtimes.runtimes$,
      activeEditorPath$
    ).pipe(
      map(([runtimes, activeEditorPath]) => {
        if (!runtimes) return null;
        if (runtimes.length === 1) return runtimes[0];
        if (!activeEditorPath) return null;
        return runtimes.find(runtime => activeEditorPath.startsWith(runtime.runtimePath + path.sep)) || null; // TODO what guarantee do we have that the runtimePath doesn't end with path.sep?
      }),
      distinctUntilChanged(),
      tap(r => console.log('Current runtime changed to',r)),
    )

    this.changes$ = new BehaviorSubject<Change>(null);

    this._currentRuntime$.pipe(
          withLatestFrom(this._runtimes.runtimes$), // eek todo (&tests to be able to refactor)
          switchMap(([runtime, runtimes]: [Runtime | null, Runtime[]]) => {
            if (!runtime) return of(null);
            console.assert(runtimes.length !== 0, "Active runtime but no runtimes.")
            let shortname = runtimes.length === 1 // TODO this should be handled by getIdentifyingBit (and should exceptionally return the basename and not the oldest parent)
              ? path.basename(path.dirname(runtime.runtimePath))
              : getIdentifyingBit(runtime.runtimePath, runtimes.map(r => r.runtimePath).filter(runtimePath => runtimePath != runtime.runtimePath));
            return runtime.deps$.pipe(map(deps => ({runtimePath: runtime.runtimePath, deps, shortname})));
          }),
          tap(r => console.log('Current runtime \'changes\' fired with',r))
        ).subscribe(this.changes$);
  }

}