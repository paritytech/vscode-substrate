import * as vscode from 'vscode';
import {Category, Pallet} from './types';
import { BehaviorSubject } from 'rxjs';
import CurrentRuntime from './runtimes/CurrentRuntime';

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
            treePallet.iconPath = treePallet.contextValue === 'palletInstalled' ? new vscode.ThemeIcon('check') : false;
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