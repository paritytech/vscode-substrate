import * as vscode from 'vscode';
import Runtime from '../../runtimes/Runtime';
import Runtimes from '../../runtimes/Runtimes';
import { BehaviorSubject, of } from 'rxjs';
import { tryShortname } from '../../util';
import { withLatestFrom, switchMap, tap, map } from 'rxjs/operators';

export class RuntimesProvider implements vscode.TreeDataProvider<RuntimeTreeItem> {
  runtimeTreeItems: RuntimeTreeItem[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<RuntimeTreeItem | undefined> = new vscode.EventEmitter<RuntimeTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<RuntimeTreeItem | undefined> = this._onDidChangeTreeData.event;

  constructor(runtimes: Runtimes) {
    runtimes.runtimes$.subscribe((runtimes: Runtime[]) => {

      this.runtimeTreeItems = runtimes.map((runtime: Runtime) => {
        return new RuntimeTreeItem(runtime);
      });

      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: RuntimeTreeItem): RuntimeTreeItem | Thenable<RuntimeTreeItem> {
    return element;
  }

  getChildren(element?: RuntimeTreeItem | undefined): vscode.ProviderResult<RuntimeTreeItem[]> {
    if (element === undefined) {
      return this.runtimeTreeItems;
    }
    return element.children;
  }
}

export class RuntimeTreeItem extends vscode.TreeItem {
  children: undefined;
  name: string;

  static create(info: Runtime) {
    return new this(info);
  }

  constructor(runtime: Runtime) {
    const { runtimePath } = runtime;
    super(
      tryShortname(runtimePath),
      vscode.TreeItemCollapsibleState.None);
    this.name = runtimePath;
    this.command = {
      command: "substrateRuntimes.selectRuntime",
      title: "Select Runtime",
      arguments: [this]
    };
  }
}

type Change = { runtimePath: string; deps: string[], shortname: string } | null;

export function setUpRuntimesTreeView(runtimes: Runtimes) {

    const selectedRuntimePath$ = new BehaviorSubject<string | null>(null);
    const selectedRuntimeChanges$ = new BehaviorSubject<Change>(null);

    selectedRuntimePath$.pipe(
      withLatestFrom(runtimes.runtimes$), // eek todo (&tests to be able to refactor)
      switchMap(([runtimePath, runtimes]: [string | null, Runtime[]]) => {
        if (!runtimePath) return of(null);
        const selectedRuntime = runtimes.find(runtime => runtime.runtimePath === runtimePath);
        if (selectedRuntime === undefined) {
          console.error("Selected runtime but doesn't match any.");
          return of(null);
        }

        let shortname = tryShortname(runtimePath);
        return selectedRuntime.deps$.pipe(map(deps => ({ runtimePath: runtimePath, deps, shortname })));
      }),
      tap(r => console.log('Selected runtime \'changes\' fired with', r))
    ).subscribe(selectedRuntimeChanges$);

    vscode.window.createTreeView('substrateRuntimes', { treeDataProvider: new RuntimesProvider(runtimes) });
    vscode.commands.registerCommand("substrateRuntimes.selectRuntime", (item: vscode.TreeItem) => {
      selectedRuntimePath$.next((item as any).name || null);
    });

    return { selectedRuntimeChanges$ };
}