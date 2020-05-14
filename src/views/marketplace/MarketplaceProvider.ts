import * as vscode from 'vscode';
import { BehaviorSubject } from 'rxjs';
import Runtimes from '../../runtimes/Runtimes';
import fetchCategories from './fetchCategories';
import { getManifestPath } from './getRuntimeManifestPath';
import { substrateDepsInstalled } from './substrateDeps';
import { Category, Pallet } from './types';

const path = require('path');

type TreeItem = TreePallet | TreeCategory;

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  treeCategories: TreeCategory[];

  private _onDidChangeTreeData: vscode.EventEmitter<TreeCategory | undefined> = new vscode.EventEmitter<TreeCategory | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeCategory | undefined> = this._onDidChangeTreeData.event;

  constructor(data: any, selectedRuntimeChanges$: BehaviorSubject<any>) {
    this.treeCategories = data.map((category: any) => {
      return new TreeCategory(category, category.pallets.map(TreePallet.create.bind(TreePallet)));
    });

    // TODO Reinstantiating all pallets would be cleaner (shared logic when instantiating)
    selectedRuntimeChanges$.subscribe((changes) => {
      this.treeCategories.forEach(treeCategory => {
          treeCategory.children?.forEach(treePallet => {
            treePallet.contextValue = changes && changes.deps.includes(treePallet.name)
              ? 'palletInstalled' // TODO work from a single source of truth and have a clear mapping instead (see above comment); pure functions
              : 'pallet';
            treePallet.iconPath = treePallet.contextValue === 'palletInstalled' ? path.join(__filename, '..', '..', 'resources', 'check.svg') : false;
          });
      });
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: TreeCategory): TreeCategory | Thenable<TreeCategory> {
    return element;
  }

  getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      return this.treeCategories;
    }
    return element.children;
  }
}

export class TreeCategory extends vscode.TreeItem {
  children: TreePallet[] | undefined;

  constructor(info: Category, children?: TreePallet[]) {
    const { category: label } = info;
    super(
      label,
      children === undefined ? vscode.TreeItemCollapsibleState.None :
        vscode.TreeItemCollapsibleState.Expanded);
    this.children = children;
    this.contextValue = 'category';
  }
}

export class TreePallet extends vscode.TreeItem {
  children: TreeItem[] | undefined;
  name: string;
  github: string;
  documentation: string;
  homepage: string;

  static create(info: Pallet) {
    return new this(info);
  }

  constructor(info: Pallet) {
    const { name, description, github, documentation, homepage } = info;
    super(
      name,
      vscode.TreeItemCollapsibleState.None);
    this.name = name;
    this.description = description;
    this.tooltip = `${name} - ${description}`;
    this.contextValue = 'pallet';
    this.github = github;
    this.documentation = documentation;
    this.homepage = homepage;
  }
}

type Change = { runtimePath: string; deps: string[], shortname: string } | null;
export function setUpMarketplaceTreeView(runtimes: Runtimes, selectedRuntimeChanges$: BehaviorSubject<Change>) {
  fetchCategories().then((categories: Category[]) => {
    const treeView = vscode.window.createTreeView('substrateMarketplace', { treeDataProvider: new TreeDataProvider(categories, selectedRuntimeChanges$) });
    selectedRuntimeChanges$.subscribe((change) => {
      if (change && runtimes.runtimes$.getValue().length > 1)
        treeView.message = `Selected runtime: ${change.shortname || change.runtimePath}`; // todo
      else
        treeView.message = ``;
    });

    // Set up commands: documentation, github, homepage
    ([
      { command: 'substrateMarketplace.palletDocumentation', name: 'Documentation', property: 'documentation' },
      { command: 'substrateMarketplace.palletGithub', name: 'GitHub page', property: 'github' },
      { command: 'substrateMarketplace.palletHomepage', name: 'Homepage', property: 'homepage' }
    ] as const).forEach(({ command, name, property }) => {
      vscode.commands.registerCommand(command, (item: TreePallet) => {
        if (!item[property].startsWith('http')) { // Also acts as a safeguard
          vscode.window.showErrorMessage(`${name} is unavailable for this pallet.`);
          return;
        }
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(item[property]));
      });
    });

    // Set up command: install
    vscode.commands.registerCommand("substrateMarketplace.installPallet", async (item: vscode.TreeItem) => {
      // Install substrate-deps if needed
      if (!await substrateDepsInstalled()) {
        return;
      }

      // Verify pallet name to prevent shell injection & derive alias
      const palletName = item.label as string;
      if (!/^[a-z-]+$/.test(palletName)) {
        vscode.window.showErrorMessage('Pallet name is invalid.');
        return;
      }
      const alias = (alias => alias === palletName ? null : alias)(palletName.replace(/^pallet-/, ''));

      // Ask for user confirmation
      // TODO Indicate current runtime in the message in case we have more than
      // one runtime in the workspace.
      const clicked = await vscode.window.showInformationMessage(`Install the pallet ${palletName}?`, { modal: true }, 'Yes');
      if (clicked !== 'Yes') {
        return;
      }

      // Get manifest path
      let manifestPath: string;
      try {
        let selectedRuntimeChanges = selectedRuntimeChanges$.getValue();
        if (!selectedRuntimeChanges) {
          vscode.window.showErrorMessage('Please first select a runtime.');
          return;
        }
        manifestPath = await getManifestPath(selectedRuntimeChanges?.runtimePath || null, runtimes);
      } catch (e) {
        return;
      }

      // Prepare command
      const termCommand = [
        'substrate-deps',
        `add ${palletName}`,
        ...alias ? [`--alias ${alias}`] : [],
        `--manifest-path '${manifestPath.replace(/'/, `'\\''`)}'`, // Allow spaces in path, prevent command injection (TODO Windows?)
        `&& echo '${palletName} was successfully added to the project${alias ? ` as '${alias}'` : ''}.'`
      ].join(' ');

      // Create terminal and run command
      const term = vscode.window.createTerminal({ name: `Installing ${palletName}` });
      term.sendText(termCommand);
      term.show();

    });
  }, (async r => { // Offer to retry in case fetching the categories failed
    const clicked = await vscode.window.showErrorMessage(`An error occured when fetching the list of pallets from the Substrate Marketplace: ${r}`, 'Try again');
    if (clicked === 'Try again') {
      return setUpMarketplaceTreeView(runtimes, selectedRuntimeChanges$);
    }
  }));

}