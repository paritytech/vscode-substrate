import * as vscode from 'vscode';

const fs = require('fs');
const path = require('path');

export function showGettingStarted(context: vscode.ExtensionContext, tasks: vscode.Task[]) {
  var resultPanel = vscode.window.createWebviewPanel("welcome", "Getting started", vscode.ViewColumn.One, { enableScripts: true, enableCommandUris: true, retainContextWhenHidden: true });
  resultPanel.webview.html = fs.readFileSync(path.join(__filename, '..', '..', 'resources', 'welcome.html')).toString();

  resultPanel.webview.postMessage({
    command: 'tasks',
    payload: tasks.map((task, i) => ({ id: i, name: task.name }))
  });

  resultPanel.webview.onDidReceiveMessage(message => {
    if (message.command === 'tour') {
      vscode.commands.executeCommand("TheiaSubstrateExtension.tour-command");
    } else if (message.command === 'showPanel') {
      vscode.commands.executeCommand("workbench.view.extension.substrate");
    } else if (message.command === 'runTask') {
      vscode.tasks.executeTask(tasks[message.taskId] as vscode.Task);
    }
  }, undefined, context.subscriptions);
}