import * as vscode from 'vscode';

export class CommandsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  items: vscode.TreeItem[];

  constructor() {
    const commands = [
      {name: 'Getting started'},
      {name: ''},
      {name: 'Compile node'},
      {name: 'Start node'},
      {name: 'Purge chain'},
      {name: 'Polkadot apps'}, // only in theia
      {name: 'Start front-end'}, // only in theia
      {name: 'Open front-end'}, // only in theia
      {name: 'Take the tour'}, // only in theia
      {name: ''}, // only in theia
      {name: 'Download archive'}, // only in theia
      {name: 'Send feedback'}, // only in theia
    ];

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
      this.iconPath = new vscode.ThemeIcon('gear');
    } else {
      this.contextValue = 'separator';
      this.description = '—';
    }
  }
}