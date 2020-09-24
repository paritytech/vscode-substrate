import 'array-flat-polyfill';
import * as vscode from 'vscode';
import { setUpMarketplaceTreeView } from './views/marketplace/MarketplaceProvider';
import { setUpNodesTreeView } from './views/nodes/NodesProvider';
import Nodes from './nodes/Nodes';
import Processes from './processes/Processes';
import { setupProcessesTreeView } from './views/processes/ProcessesProvider';
import { setupTasksTreeView } from './views/tasks/TasksProvider';
import { setupAccountsTreeView } from './views/accounts/AccountsProvider';
import { Substrate } from './common/Substrate';
import { setupContractsTreeView } from './views/contracts/ContractsProvider';

export async function activate(context: vscode.ExtensionContext) {
	const substrate = new Substrate(context)

	const nodes = new Nodes();
	const processes = new Processes();

	// Set up runtimes
	const { selectedNode$ } = setUpNodesTreeView(nodes, processes);

	// Set up marketplace
	setUpMarketplaceTreeView(nodes, selectedNode$);

	// Set up processes
	const selectedProcess$ = setupProcessesTreeView(substrate, processes);

	// Set up accounts
	setupAccountsTreeView(substrate, context);

	// Set up contracts
	setupContractsTreeView(substrate, selectedProcess$, context);

	// Set up tasks
	const tasks = await setupTasksTreeView();
}

export function deactivate() { }