import * as vscode from 'vscode';
import Runtime from '../../runtimes/Runtime';
import Runtimes from '../../runtimes/Runtimes';
import { BehaviorSubject, of } from 'rxjs';
import { tryShortname } from '../../util';
import { withLatestFrom, switchMap, tap, map } from 'rxjs/operators';
import Nodes, {Node} from '../../nodes/Nodes';

export class NodesProvider implements vscode.TreeDataProvider<NodeTreeItem> {
  nodeTreeItems: NodeTreeItem[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<NodeTreeItem | undefined> = new vscode.EventEmitter<NodeTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<NodeTreeItem | undefined> = this._onDidChangeTreeData.event;

  constructor(nodes: Nodes) {
    nodes.nodes$.subscribe((nodes: Node[]) => {

      this.nodeTreeItems = nodes.map((node: Node) => {
        return new NodeTreeItem(node);
      });

      this._onDidChangeTreeData.fire();
    });
  }

  changeSelected(selectedNodePath: string) {
    this.nodeTreeItems.forEach((nodeTreeItem) => {
      console.log(selectedNodePath, nodeTreeItem.nodePath);
      if (nodeTreeItem.nodePath === selectedNodePath)
        nodeTreeItem.select();
      else
        nodeTreeItem.unselect();
    });
    this._onDidChangeTreeData.fire();

  }

  getTreeItem(element: NodeTreeItem): NodeTreeItem | Thenable<NodeTreeItem> {
    return element;
  }

  getChildren(element?: NodeTreeItem | undefined): vscode.ProviderResult<NodeTreeItem[]> {
    if (element === undefined) {
      return this.nodeTreeItems;
    }
    return element.children;
  }
}

export class NodeTreeItem extends vscode.TreeItem {
  children: undefined;
  nodePath: string;

  static create(info: Node) {
    return new this(info);
  }

  constructor(node: Node) {
    const { nodePath } = node;
    super(
      tryShortname(nodePath),
      vscode.TreeItemCollapsibleState.None);
    this.nodePath = nodePath;
    this.command = {
      command: "substrateNodes.selectNode",
      title: "Select Node",
      arguments: [this]
    };
  }

  select() {
    this.label = '▶️ ' + tryShortname(this.nodePath);
  }

  unselect() {
    this.label = tryShortname(this.nodePath);
  }
}

export function setUpNodesTreeView(nodes: Nodes) {

    const selectedNodePath$ = new BehaviorSubject<string | null>(null); // TODO NULL ON UNSELECT

    const selectedNode$ = new BehaviorSubject<Node | null>(null);

    selectedNodePath$.pipe(
      withLatestFrom(nodes.nodes$), // eek todo (&tests to be able to refactor)
      switchMap(([nodePath, nodes]: [string | null, Node[]]) => {
        if (!nodePath) return of(null);
        const selectedNode = nodes.find(node => node.nodePath === nodePath);
        if (selectedNode === undefined) {
          console.error("Selected node but doesn't match any.");
          return of(null);
        }
        return of(selectedNode);

        // let shortname = tryShortname(nodePath);
        // return of(selectedRuntime.deps$.pipe(map(deps => ({ runtimePath: runtimePath, deps, shortname })));
      }),
      tap(r => console.log('Selected node \'changes\' fired with', r))
    ).subscribe(selectedNode$);

    const treeDataProvider = new NodesProvider(nodes);
    vscode.window.createTreeView('substrateNodes', { treeDataProvider });
    vscode.commands.registerCommand("substrateNodes.selectNode", (item: vscode.TreeItem) => {
      selectedNodePath$.next((item as any).nodePath || null);
      treeDataProvider.changeSelected((item as any).nodePath || null);
    });

  return { selectedNode$ };
}