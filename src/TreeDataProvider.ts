
import * as vscode from 'vscode';
import {Category, Pallet} from './types';

type TreeItem = TreePallet | TreeCategory;

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  onDidChangeTreeData?: vscode.Event<TreeItem | null | undefined> | undefined;

  treeCategories: TreeItem[];

  constructor(data: any) {
    this.treeCategories = data.map((category: any) => {
      return new TreeCategory(category, category.pallets.map(TreePallet.create.bind(TreePallet)));
    });
  }

  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
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
    this.description = description;
    this.tooltip = `${name} - ${description}`;
    this.contextValue = 'pallet';
    this.github = github;
    this.documentation = documentation;
    this.homepage = homepage;
  }
}