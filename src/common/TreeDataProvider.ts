import * as vscode from 'vscode';

export abstract class TreeDataProvider<T> implements vscode.TreeDataProvider<T> {
  protected _onDidChangeTreeData: vscode.EventEmitter<T | undefined> = new vscode.EventEmitter<T | undefined>();
  readonly onDidChangeTreeData: vscode.Event<T | undefined> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: T): vscode.TreeItem {
    return element;
  }

  abstract getChildren(element?: T): Thenable<T[]>;
}
