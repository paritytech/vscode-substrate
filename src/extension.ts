import 'array-flat-polyfill';
import * as vscode from 'vscode';
import { setUpCommandsTreeView } from './views/commands/CommandsProvider';
import { setUpMarketplaceTreeView } from './views/marketplace/MarketplaceProvider';
import { setUpRuntimesTreeView } from './views/runtimes/RuntimesProvider';
import Runtimes from './runtimes/Runtimes';

const fs = require('fs');
const path = require('path');

export function activate(context: vscode.ExtensionContext) {
	// TODO dependency management across components

	const isTheia = process.env.SUBSTRATE_PLAYGROUND !== undefined;

	if (isTheia || true) { // TODO as such, should maybe not be

		var resultPanel = vscode.window.createWebviewPanel("welcome", "Getting started", vscode.ViewColumn.One, {enableScripts: true, enableCommandUris: true});
		resultPanel.webview.html = fs.readFileSync(path.join(__filename, '..', '..', 'resources', 'welcome.html')).toString();

		resultPanel.webview.onDidReceiveMessage(message => {
			if (message.command === 'tour') {
				vscode.commands.executeCommand("TheiaSubstrateExtension.tour-command");
			}
		}, undefined, context.subscriptions);
	}

	const runtimes = new Runtimes();

	// Set up commands
	setUpCommandsTreeView();

	// Set up runtimes
	const { selectedRuntimeChanges$ } = setUpRuntimesTreeView(runtimes);

	// Set up marketplace
	setUpMarketplaceTreeView(runtimes, selectedRuntimeChanges$);
}

export function deactivate() { }