import * as vscode from 'vscode';
import Runtime from '../runtimes/Runtime';
import Runtimes from '../runtimes/Runtimes';

export class RuntimesProvider implements vscode.TreeDataProvider<RuntimeTreeItem> {
  runtimeTreeItems: RuntimeTreeItem[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<RuntimeTreeItem | undefined> = new vscode.EventEmitter<RuntimeTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<RuntimeTreeItem | undefined> = this._onDidChangeTreeData.event;

  constructor(runtimes: Runtimes) { /* , currentRuntime: CurrentRuntime */

    runtimes.runtimes$.subscribe((runtimes: Runtime[]) => {

      this.runtimeTreeItems = runtimes.map((runtime: Runtime) => {
        return new RuntimeTreeItem(runtime);
      });

      this._onDidChangeTreeData.fire();
    });

    // TODO handle currentRuntime from activeeditor
    // and handle selecting current runtime

    // TODO Reinstantiating all pallets would be cleaner (shared logic when instantiating)
    // currentRuntime.changes$.subscribe((changes) => {
    //   this.treeCategories.forEach(treeCategory => {
    //     treeCategory.children?.forEach(treePallet => {
    //       treePallet.contextValue = changes && changes.deps.includes(treePallet.name)
    //         ? 'palletInstalled' // TODO work from a single source of truth and have a clear mapping instead (see above comment); pure functions
    //         : 'pallet';
    //       treePallet.iconPath = treePallet.contextValue === 'palletInstalled' ? new vscode.ThemeIcon('check') : false;
    //     });
    //   });
    //   this._onDidChangeTreeData.fire();
    // });
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
      runtimePath,
      vscode.TreeItemCollapsibleState.None);
    this.name = runtimePath;
    this.command = {
      command: "substrateRuntimes.selectRuntime",
      title: "Select Runtime",
      arguments: [this]
    };
    // this.description = description;
    // this.tooltip = `${name} - ${description}`;
    // this.contextValue = 'pallet';
  }
}