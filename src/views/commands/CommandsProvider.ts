import * as vscode from 'vscode';
import { tryShortname } from '../../util';

const os = require('os');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

export class CommandsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  items: vscode.TreeItem[];

  constructor() {
    const isTheia = process.env.SUBSTRATE_PLAYGROUND !== undefined;

    this.items = (isTheia ? playgroundCommands : vscodeCommands).map(command => {
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
    term.sendText('./target/release/node-template --dev --ws-external');
    term.show();
  }],
  ['Purge chain', async () => {
    const term = vscode.window.createTerminal({ name: 'Purge chain', cwd: await getNodeTemplatePath() });
    term.sendText('./target/release/node-template purge-chain --dev');
    term.show();
  }]
];

const playgroundCommands: (Command | Separator)[] = [
  ['Getting started', () => vscode.commands.executeCommand("getting.started.widget")],
  [''],
  ...vscodeCommands,
  ['Polkadot Apps', () => {
    const INSTANCE_UUID = process.env.SUBSTRATE_PLAYGROUND_INSTANCE;
    const nodeWebSocket = `wss://${INSTANCE_UUID}.playground.substrate.dev/wss`
    const polkadotAppsURL = `https://polkadot.js.org/apps/?rpc=${nodeWebSocket}`;
    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(polkadotAppsURL));
  }],
  ['Start front-end', () => {
    const INSTANCE_UUID = process.env.SUBSTRATE_PLAYGROUND_INSTANCE;
    const nodeWebSocket = `wss://${INSTANCE_UUID}.playground.substrate.dev/wss`
    const port = 8000;
    const term = vscode.window.createTerminal({ name: 'Start front-end', cwd: '/home/workspace/substrate-front-end-template' });
    term.sendText(`REACT_APP_PROVIDER_SOCKET=${nodeWebSocket} yarn build && rm -rf front-end/ && mv build front-end && python -m SimpleHTTPServer ${port}\r`);
    term.show();
  }],
  ['Open front-end', () => {
    const INSTANCE_UUID = process.env.SUBSTRATE_PLAYGROUND_INSTANCE;
    const frontendURL = `https://${INSTANCE_UUID}.playground.substrate.dev/front-end`;
    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(frontendURL));
  }],
  ['Take the tour', () => vscode.commands.executeCommand("TheiaSubstrateExtension.tour-command")],
  [''],
  ['Download archive', () => vscode.commands.executeCommand("TheiaSubstrateExtension.download-archive-command")],
  ['Send feedback', () => vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://docs.google.com/forms/d/e/1FAIpQLSdXpq_fHqS_ow4nC7EpGmrC_XGX_JCIRzAqB1vaBtoZrDW-ZQ/viewform?edit_requested=true'))],
]

export function setUpCommandsTreeView() {
  vscode.window.createTreeView('substrateCommands', { treeDataProvider: new CommandsProvider() });
  vscode.commands.registerCommand("substrateCommands.runCommand", async (item: vscode.TreeItem & { name: string }) => {
    const command = playgroundCommands.find(command => command[0] === item.name);
    if (!command) console.error('No command found with that name');
    (command as Command)[1]();
  });
}