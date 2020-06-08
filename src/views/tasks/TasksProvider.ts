import * as vscode from 'vscode';
import { BehaviorSubject, of, combineLatest } from 'rxjs';
import { tryShortname } from '../../util';
import { switchMap, tap } from 'rxjs/operators';
import Nodes, {Node} from '../../nodes/Nodes';

export class TasksProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  TaskTreeItems: TaskTreeItem[] = [];

  constructor(tasks: vscode.Task[]) {
    this.TaskTreeItems = tasks.map((task: vscode.Task) => {
      return new TaskTreeItem(task);
    });
  }

  getTreeItem(element: TaskTreeItem): TaskTreeItem | Thenable<TaskTreeItem> {
    return element;
  }

  getChildren(element?: TaskTreeItem | undefined): vscode.ProviderResult<TaskTreeItem[]> {
    if (element === undefined) {
      return this.TaskTreeItems;
    }
    return element.children;
  }
}

export class TaskTreeItem extends vscode.TreeItem {
  children: undefined;
  task: vscode.Task;

  constructor(task: vscode.Task) {
    super(
      task.name,
      vscode.TreeItemCollapsibleState.None);
    this.task = task;
  }
}

async function quickPickTasks(tasks: vscode.Task[]) {
  if (tasks.length === 0) {
    vscode.window.showErrorMessage('No action was found in the workspace.');
    return Promise.reject();
  }

  const tasksReadable = tasks.map(t => t.name);

  const pick = await vscode.window.showQuickPick(tasksReadable, { placeHolder: "Please choose an action to execute." });
  if (pick === undefined)
    return Promise.reject();

  return tasks[tasksReadable.findIndex((x: any) => x === pick)];
}

export async function setupTasksTreeView() {
    const tasks = (await vscode.tasks.fetchTasks()).filter(t => t.source === 'Workspace');
    console.log('Tasks', tasks);

    const treeDataProvider = new TasksProvider(tasks);
    vscode.window.createTreeView('substrateTasks', { treeDataProvider });

    vscode.commands.registerCommand("substrate.runTask", async (taskTreeItem: TaskTreeItem | null) => {
      let task;
      if (taskTreeItem)
        task = taskTreeItem.task;
      else
        task = await quickPickTasks(tasks);

      vscode.tasks.executeTask(task);
    });
}