import 'array-flat-polyfill';
import * as vscode from 'vscode';
import { setUpMarketplaceTreeView } from './views/marketplace/MarketplaceProvider';
import { setUpNodesTreeView } from './views/nodes/NodesProvider';
import Nodes from './nodes/Nodes';
import Processes from './processes/Processes';
import { setupProcessesTreeView } from './views/processes/ProcessesProvider';
import { setupTasksTreeView } from './views/tasks/TasksProvider';

const fs = require('fs');
const path = require('path');

export async function activate(context: vscode.ExtensionContext) {
	const nodes = new Nodes();
	const processes = new Processes();

	// Set up runtimes
	const { selectedNode$ } = setUpNodesTreeView(nodes, processes);

	// Set up marketplace
	setUpMarketplaceTreeView(nodes, selectedNode$);

	// Set up processes
	setupProcessesTreeView(processes);

	// Set up tasks
	const tasks = await setupTasksTreeView();

	const isTheia = process.env.SUBSTRATE_PLAYGROUND !== undefined;

	if (isTheia) { // TODO as such, should maybe not be
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
}

export function deactivate() { }