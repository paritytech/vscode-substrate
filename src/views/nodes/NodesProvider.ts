import * as vscode from 'vscode';
import { BehaviorSubject, of, combineLatest } from 'rxjs';
import { tryShortname } from '../../util';
import { switchMap, tap } from 'rxjs/operators';
import Nodes, {Node} from '../../nodes/Nodes';

export class NodesProvider implements vscode.TreeDataProvider<NodeTreeItem> {
  nodeTreeItems: NodeTreeItem[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<NodeTreeItem | undefined> = new vscode.EventEmitter<NodeTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<NodeTreeItem | undefined> = this._onDidChangeTreeData.event;

  constructor(nodes: Nodes, selectedNode$: BehaviorSubject<Node | null>) {
    nodes.nodes$.subscribe((nodes: Node[]) => {

      this.nodeTreeItems = nodes.map((node: Node) => {
        return new NodeTreeItem(node);
      });

      this.changeSelected(selectedNode$.getValue()?.nodePath || null);
      this._onDidChangeTreeData.fire();
    });

    selectedNode$.subscribe(node => {
      this.changeSelected(node?.nodePath || null);
    });
  }

  changeSelected(selectedNodePath: string | null) {
    console.log('changeSelected fired with',selectedNodePath);
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


async function quickPickNodePath(nodes: Nodes) {
  let nodePaths = nodes.nodes$.getValue().map((node: Node) => node.nodePath);

  if (nodePaths.length === 1)
    return nodePaths[0];

  if (nodePaths.length === 0) {
    vscode.window.showErrorMessage('No node was found in the workspace.');
    return Promise.reject();
  }

  const nodesReadable = nodePaths.map(n => tryShortname(n));

  const pick = await vscode.window.showQuickPick(nodesReadable, { placeHolder: "Please choose a node." });
  if (pick === undefined)
    return Promise.reject();

  return nodePaths[nodesReadable.findIndex(x => x === pick)];
}


export function setUpNodesTreeView(nodes: Nodes) {

    // vscode.commands.registerCommand("substrate.compileNode", async (nodePath?: string) => {
    //   const term = vscode.window.createTerminal({ name: 'Compile node', cwd: nodePath || await quickPickNodePath(nodes) });
    //   term.sendText('cargo build --release');
    //   term.show();
    // });

    vscode.commands.registerCommand("substrate.startNode", async (nodePathLike?: string | NodeTreeItem) => {
      let nodePath = nodePathLike instanceof NodeTreeItem ? nodePathLike.nodePath : nodePathLike;
      if (nodePath) {
        selectedNodePath$.next(nodePath); // select the item we launch the command on
      }
      const term = vscode.window.createTerminal({ name: 'Start node', cwd: nodePath || await quickPickNodePath(nodes) });
      term.sendText('cargo run -- --dev --ws-external');
      term.show();
    });

    vscode.commands.registerCommand("substrate.purgeChain", async (nodePathLike?: string | NodeTreeItem) => {
      let nodePath = nodePathLike instanceof NodeTreeItem ? nodePathLike.nodePath : nodePathLike;
      if (nodePath) {
        selectedNodePath$.next(nodePath); // select the item we launch the command on
      }
      const term = vscode.window.createTerminal({ name: 'Purge chain', cwd: nodePath || await quickPickNodePath(nodes) });
      term.sendText('cargo run -- purge-chain --dev');
      term.show();
    });

    const selectedNodePath$ = new BehaviorSubject<string | null>(null); // TODO NULL ON UNSELECT
    const selectedNode$ = new BehaviorSubject<Node | null>(null);

    combineLatest(selectedNodePath$, nodes.nodes$)
      .pipe(
      switchMap(([nodePath, nodes]: [string | null, Node[]]) => {
        console.log('fire inthe hose',nodePath, nodes);
        if (!nodePath) return of(null);
        const selectedNode = nodes.find(node => node.nodePath === nodePath);
        if (selectedNode === undefined) {
          console.error("Selected node but doesn't match any.");
          return of(null);
        }
        return of(selectedNode);
      }),
      tap(r => console.log('Selected node \'changes\' fired with', r))
    ).subscribe(selectedNode$);

    const treeDataProvider = new NodesProvider(nodes, selectedNode$);
    vscode.window.createTreeView('substrateNodes', { treeDataProvider });
    vscode.commands.registerCommand("substrateNodes.selectNode", (item: vscode.TreeItem) => {
      selectedNodePath$.next((item as any).nodePath || null);
    });


  return { selectedNode$ };
}