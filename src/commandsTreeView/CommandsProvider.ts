import * as vscode from 'vscode';

const os = require('os');
const path = require('path');

export class CommandsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  items: vscode.TreeItem[];

  constructor() {

    const isTheia = os.hostname().startsWith('theia-substrate-') || true; // temp

    let commands = [];
    if (isTheia) {
      commands = [
        { name: 'Getting started' },
        { name: '' },
        { name: 'Compile node' },
        { name: 'Start node' },
        { name: 'Purge chain' },
        { name: 'Polkadot Apps' },
        { name: 'Start front-end' },
        { name: 'Open front-end' },
        { name: 'Take the tour' },
        { name: '' },
        { name: 'Download archive' },
        { name: 'Send feedback' },
      ];
    } else {
      commands = [
      {name: 'Compile node'},
      {name: 'Start node'},
      {name: 'Purge chain'}
      ];
    }

    this.items = commands.map((category: any) => {
      return new Item(category);
    });
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
    if (element === undefined) {
      return this.items;
    }
    return [];
    // return element.children;
  }
}

class Item extends vscode.TreeItem {
  children: undefined;
  name: string;
  contextValue: string;
  description: string | undefined;

  constructor(info: any) {
    const { name, description } = info;
    super(
      name,
      vscode.TreeItemCollapsibleState.None);
    this.name = name;
    if (name) {
      this.contextValue = 'command';
      this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'gear.svg');
    } else {
      this.contextValue = 'separator';
      this.description = '—';
    }
  }
}