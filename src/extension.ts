import 'array-flat-polyfill';
import * as vscode from 'vscode';
import { setUpMarketplaceTreeView } from './views/marketplace/MarketplaceProvider';
import { setUpNodesTreeView } from './views/nodes/NodesProvider';
import Nodes from './nodes/Nodes';
import Processes from './processes/Processes';
import { setupProcessesTreeView } from './views/processes/ProcessesProvider';
import { setupTasksTreeView } from './views/tasks/TasksProvider';
import { showGettingStarted } from './gettingstarted';

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

	if (isTheia && !vscode.window.activeTextEditor) {
		showGettingStarted(context, tasks);
	}

	vscode.commands.registerCommand("substrate.gettingStarted", () => {
		showGettingStarted(context, tasks);
	});
}

export function deactivate() { }