import 'array-flat-polyfill';
import * as vscode from 'vscode';
import { setUpCommandsTreeView } from './views/commands/CommandsProvider';
import { setUpMarketplaceTreeView } from './views/marketplace/MarketplaceProvider';
import { setUpRuntimesTreeView } from './views/runtimes/RuntimesProvider';
import Runtimes from './runtimes/Runtimes';

export function activate(context: vscode.ExtensionContext) {
	// TODO dependency management across components

	const runtimes = new Runtimes();

	// Set up commands
	setUpCommandsTreeView();

	// Set up runtimes
	const { selectedRuntimeChanges$ } = setUpRuntimesTreeView(runtimes);

	// Set up marketplace
	setUpMarketplaceTreeView(runtimes, selectedRuntimeChanges$);
}

export function deactivate() { }