import { BehaviorSubject, merge, of } from 'rxjs';
import { map, tap, throttleTime } from 'rxjs/operators';
import * as vscode from 'vscode';
import parseDepsFromFile from '../runtimes/parseDepsFromFile';
import { vscToObservable } from '../util';

const path = require('path');
const fs = require('fs');
const glob = require('glob');

/**
 * Given a folder path, return a list of substrate nodes contained inside.
 */
const findNodesInFolder = (roots: string): string[] => {
  // TODO use vscode.workspace.findFiles instead
  return glob.sync(path.join(roots, '**/Cargo.toml'), { ignore: '**/node_modules/**' }).filter((b: string) => {
    return fs.readFileSync(b).toString().includes('[[bin]]')
  }).map((nodeRs: string) => path.dirname(nodeRs)); // (todo transducers)
}

const findNodesInWorkspace = () => {
  return vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath).map(root => {
    return findNodesInFolder(root);
  }).flat() || [];
}

export type Node = {nodePath: string; runtimePath?: string; deps?: any[]}

// Manages the auto-detection of nodes in the current workspace
export default class Nodes {

  nodes$: BehaviorSubject<Node[]>;

  constructor() {
    // TODO add to the deactivate function of extension.ts? Not sure if vscode
    // does this automatically. Evtl add a dispose() function to the class.
    const watcher = vscode.workspace.createFileSystemWatcher('**/Cargo.toml');

    const nodesPath$ = merge(
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
        map(() => findNodesInWorkspace()),
        // tap(r => console.log('Found nodes',r))
      ); // TODO have a rescan button

    this.nodes$ = new BehaviorSubject(<Node[]>[]);

    nodesPath$.pipe(
      map(nodePaths => {
        return nodePaths.map(nodePath => {
          try{
          const cargoToml = fs.readFileSync(path.join(nodePath, 'Cargo.toml')).toString(); // TODO ASYNC
          const matches = cargoToml.match(/^(?:[^#].*)?path ?= ?"([a-zA-Z./-]*runtime[a-zA-Z./-]*)"|^(?:[^#].*)?path ?= ?'([a-zA-Z./-]*runtime[a-zA-Z./-]*)'/m)
          if (matches === null)
            return {nodePath} as Node;
          else {
            // Important that this be called on any dep change (Cargo.toml)
            const runtimePath = path.join(nodePath, matches[1] || matches[2]);

            return {
              nodePath,
              runtimePath: runtimePath,
              deps: parseDepsFromFile(path.join(runtimePath, 'Cargo.toml'))
            } as Node;
          }
        } catch (e) { console.error('error',e); return {nodePath: ''} }
        });
      }),
      // tap(r => console.log('Found nodes infos', r))
    ).subscribe(this.nodes$);
    this.nodes$.subscribe(x => {});
  }
}