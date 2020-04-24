import * as vscode from 'vscode';

import { Category } from './types';
import { getManifestPath } from './getManifestPath';
import { substrateDepsInstalled } from './substrateDeps';
import { TreeDataProvider, TreePallet } from './TreeDataProvider';
import fetchCategories from './fetchCategories';
import Runtimes from './runtimes/Runtimes';
import CurrentRuntime from './runtimes/CurrentRuntime';
import { CommandsProvider } from './commands/CommandsProvider';

const glob = require('glob');
const fs = require('fs');
const path = require('path');

export function activate(context: vscode.ExtensionContext) {
	init(context);
}

export function deactivate() { }

/**
 * Given a folder path, return a list of substrate node templates contained inside.
 */
const findNodeTemplatesInFolder = (roots: string): string[] => {
	console.log('finding nodes in',roots);
	// TODO use vscode.workspace.findFiles instead
	return glob.sync(path.join(roots, '**/Cargo.toml'), { ignore: '**/node_modules/**' }).filter((b: string) => {
		return fs.readFileSync(b).toString().includes('[workspace]')
	}).map((nodeRs: string) => path.dirname(nodeRs)); // (todo transducers)
}

async function getNodeTemplatePath() {
	const nodes = vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath).map(root => {
		return findNodeTemplatesInFolder(root);
	}).flat() || [];

	if (nodes.length === 1)
		return nodes[0];

	if (nodes.length === 0) {
		vscode.window.showErrorMessage('substrate-node-template was not found in the workspace.');
		return Promise.reject();
	}

	const pick = await vscode.window.showQuickPick(nodes, {placeHolder: "Please choose a workspace."});
	if (pick === undefined)
		return Promise.reject();

	return pick;
}

function init(context: vscode.ExtensionContext) {
	fetchCategories().then((categories: Category[]) => {
		// TODO make this a class. Makes it easier to have common access to common
		// dependencies (runtimes; currentRuntime), and automatically breaks down
		// the code into functions.

		// Set up commands
		vscode.window.createTreeView('substrateCommands', {treeDataProvider: new CommandsProvider()});
		vscode.commands.registerCommand("substrateCommands.runCommand", async (item: vscode.TreeItem & {name: string}) => {
			// todo use item.command instead
			if (item.name === 'Getting started') { // Theia-specific
				// run TheiaSubstrateExtension.getting.started.widget
			} else if (item.name === 'Compile node') {
				const term = vscode.window.createTerminal({name: 'Compile node', cwd: await getNodeTemplatePath()});
				term.sendText('cargo build --release');
				term.show();
			} else if (item.name === 'Start node') {
				const term = vscode.window.createTerminal({ name: 'Start node', cwd: await getNodeTemplatePath() });
				term.sendText('./target/release/node-template --dev --ws-external');
				term.show();
			} else if (item.name === 'Purge chain') {
				const term = vscode.window.createTerminal({ name: 'Purge chain', cwd: await getNodeTemplatePath() });
				term.sendText('./target/release/node-template purge-chain --dev');
				term.show();
			} else if (item.name === 'Polkadot Apps') { // Theia-specific
				// todo retrieve nodeWebsocket from env or info file (cargo.toml or .vscode)
				// const polkadotAppsURL = `https://polkadot.js.org/apps/?rpc=${nodeWebsocket}`;
				// vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(polkadotAppsURL));
			} else if (item.name === 'Start front-end') { // Theia-specific
				// todo retrieve nodeWebsocket from env or info file (cargo.toml or .vscode)
				// const port = 8000;
				// const term = vscode.window.createTerminal({ name: 'Start front-end', cwd: '/home/workspace/substrate-front-end-template' });
				// term.sendText(`REACT_APP_PROVIDER_SOCKET=${nodeWebsocket} yarn build && rm -rf front-end/ && mv build front-end && python -m SimpleHTTPServer ${port}\r`);
				// term.show();
			} else if (item.name === 'Open front-end') { // Theia-specific
				// todo retrieve hostname from theia
				// todo retrieve port (8000) from theia
				// const frontendURL = localhost ? `//${hostname}:${port}` : `//${hostname}/front-end`;
				// vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(frontendURL));
			} else if (item.name === 'Take the tour') { // Theia-specific
				var theiaSubstrateExtension = vscode.extensions.getExtension('TheiaSubstrateExtension'); // todo should be publisher.fullName but TheiaSubstrateExtension doesn't have a publisher

				if (theiaSubstrateExtension?.isActive == false) {
					theiaSubstrateExtension.activate().then(
						function () {
							console.log("TheiaSubstrateExtension activated");
							vscode.commands.executeCommand("TheiaSubstrateExtension.tour-command");
						},
						function () {
							console.log("Activation of TheiaSubstrateExtension failed");
						}
					);
				} else {
					vscode.commands.executeCommand("TheiaSubstrateExtension.tour-command");
				}
			} else if (item.name === 'Download archive') { // Theia-specific
				// run TheiaSubstrateExtension.download-archive
			} else if (item.name === 'Send feedback') { // Theia-specific
						vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://docs.google.com/forms/d/e/1FAIpQLSdXpq_fHqS_ow4nC7EpGmrC_XGX_JCIRzAqB1vaBtoZrDW-ZQ/viewform?edit_requested=true'));
				}
		});

		// Set up tree view
		const runtimes = new Runtimes();
		const currentRuntime = new CurrentRuntime(runtimes);
		const treeView = vscode.window.createTreeView('substrateMarketplace', {treeDataProvider: new TreeDataProvider(categories, currentRuntime)});
		currentRuntime.changes$.subscribe((change) => {
			if (change && runtimes.runtimes$.getValue().length > 1)
				treeView.message = `Current runtime: ${change.shortname}`;
			else
				treeView.message = ``;
		});

		// Set up commands: documentation, github, homepage
		([
			{ command: 'substrateMarketplace.palletDocumentation', name: 'Documentation', property: 'documentation'},
			{ command: 'substrateMarketplace.palletGithub', name: 'GitHub page', property: 'github'},
			{ command: 'substrateMarketplace.palletHomepage', name: 'Homepage', property: 'homepage'}
		] as const).forEach(({command, name, property}) => {
			vscode.commands.registerCommand(command, (item: TreePallet) => {
				if (!item[property].startsWith('http')) { // Also acts as a safeguard
					vscode.window.showErrorMessage(`${name} is unavailable for this pallet.`);
					return;
				}
				vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(item[property]));
			});
		});

		// Set up command: install
		vscode.commands.registerCommand("substrateMarketplace.installPallet", async (item: vscode.TreeItem) => {
			// Install substrate-deps if needed
			if (!await substrateDepsInstalled()) {
				return;
			}

			// Verify pallet name to prevent shell injection & derive alias
			const palletName = item.label as string;
			if (!/^[a-z-]+$/.test(palletName)) {
				vscode.window.showErrorMessage('Pallet name is invalid.');
				return;
			}
			const alias = (alias => alias === palletName ? null : alias)(palletName.replace(/^pallet-/, ''));

			// Ask for user confirmation
			// TODO Indicate current runtime in the message in case we have more than
			// one runtime in the workspace.
			const clicked = await vscode.window.showInformationMessage(`Install the pallet ${palletName}?`, { modal: true }, 'Yes');
			if (clicked !== 'Yes') {
				return;
			}

			// Get manifest path
			let manifestPath: string;
			try {
				let currentRuntimeChanges = currentRuntime.changes$.getValue();
				manifestPath = await getManifestPath(currentRuntimeChanges?.runtimePath || null, runtimes);
			} catch (e) {
				return;
			}

			// Prepare command
			const termCommand = [
				'substrate-deps',
				`add ${palletName}`,
				...alias ? [`--alias ${alias}`] : [],
				`--manifest-path '${manifestPath.replace(/'/, `'\\''`)}'`, // Allow spaces in path, prevent command injection (TODO Windows?)
				'&& exit'
			].join(' ');

			// Create terminal and run command
			const term = vscode.window.createTerminal({ name: `Installing ${palletName}` });
			term.sendText(termCommand);

			// Manage outcome

			// We currently assume that if the command takes more than a certain time
			// to complete, it probably failed. We then show the hidden terminal to
			// the user. We should find a better way to check if the command error'ed.
			// (IPC?) TODO
			const revealTerminalTimeout = setTimeout(() => {
				vscode.window.showErrorMessage(`An error might have occurred when installing ${palletName} using project runtime manifest ${manifestPath}. Please check the terminal for more information.`);
				term.show();
				disp.dispose();
			}, 5000);

			// TODO Reuse resolveWhenTerminalClosed
			// TODO In case of multiple runtimes, indicate the runtime it was installed on.
			const disp = vscode.window.onDidCloseTerminal(t => {
				if (t === term) {
					disp.dispose();
					if (t?.exitStatus?.code === 0) {
						vscode.window.showInformationMessage(`${palletName} was successfully added to the project${alias ? ` as '${alias}'` : ''}.`);
						clearTimeout(revealTerminalTimeout);
					}
				}
			});

		});
	}, (async r => { // Offer to retry in case fetching the categories failed
			const clicked = await vscode.window.showErrorMessage(`An error occured when fetching the list of pallets from the Substrate Marketplace: ${r}`, 'Try again');
			if (clicked === 'Try again') {
				return init(context);
			}
	}));
}