import * as vscode from 'vscode';
import { tryShortname } from '../../util';

const os = require('os');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

export class CommandsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  items: vscode.TreeItem[];

  constructor() {
    // const isTheia = process.env.SUBSTRATE_PLAYGROUND !== undefined;

    this.items = (vscodeCommands).map(command => {
      return new Item(command[0]);
    });
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
    if (element === undefined) {
      return this.items;
    }
    return []; // element.children
  }
}

class Item extends vscode.TreeItem {
  children: undefined;
  name: string;
  contextValue: string;
  description: string | undefined;

  constructor(name: string) {
    super(
      name,
      vscode.TreeItemCollapsibleState.None);
    this.name = name;
    if (name) {
      this.contextValue = 'command';
      this.iconPath = path.join(__filename, '..', '..', '..', '..', 'resources', 'gear.svg');
    } else {
      this.contextValue = 'separator';
      this.description = '—';
    }
  }
}

/**
 * Given a folder path, return a list of substrate node templates contained inside.
 */
const findNodeTemplatesInFolder = (roots: string): string[] => {
  console.log('finding nodes in', roots);
  // TODO use vscode.workspace.findFiles instead
  return glob.sync(path.join(roots, '**/Cargo.toml'), { ignore: '**/node_modules/**' }).filter((b: string) => {
    return fs.readFileSync(b).toString().includes('[[bin]]')
  }).map((nodeRs: string) => path.dirname(nodeRs)); // (todo transducers)
}

async function getNodeTemplatePath() {
  const nodes = vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath).map(root => {
    return findNodeTemplatesInFolder(root);
  }).flat() || [];

  if (nodes.length === 1)
    return nodes[0];

  if (nodes.length === 0) {
    vscode.window.showErrorMessage('No node was found in the workspace.');
    return Promise.reject();
  }

  const nodesReadable = nodes.map(n => tryShortname(n));

  const pick = await vscode.window.showQuickPick(nodesReadable, { placeHolder: "Please choose a node." });
  if (pick === undefined)
    return Promise.reject();

  return nodes[nodesReadable.findIndex(x => x === pick)];
}

type Command = [string, (() => void)];
type Separator = [''];

const vscodeCommands: (Command | Separator)[] = [
  ['Compile node', async () => {
    const term = vscode.window.createTerminal({ name: 'Compile node', cwd: await getNodeTemplatePath() });
    term.sendText('cargo build --release');
    term.show();
  }],
  ['Start node', async () => {
    const term = vscode.window.createTerminal({ name: 'Start node', cwd: await getNodeTemplatePath() });
    term.sendText('cargo run -- --dev --ws-external');
    term.show();
  }],
  ['Purge chain', async () => {
    const term = vscode.window.createTerminal({ name: 'Purge chain', cwd: await getNodeTemplatePath() });
    term.sendText('cargo run -- purge-chain --dev');
    term.show();
  }]
];

export function setUpCommandsTreeView() {
  vscode.window.createTreeView('substrateCommands', { treeDataProvider: new CommandsProvider() });
  vscode.commands.registerCommand("substrateCommands.runCommand", async (item: vscode.TreeItem & { name: string }) => {
    const command = vscodeCommands.find(command => command[0] === item.name);
    if (!command) console.error('No command found with that name');
    (command as Command)[1]();
  });
}