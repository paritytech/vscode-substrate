import * as vscode from 'vscode';
const os = require('os');

import { Category } from './types';
import { TreeDataProvider, TreePallet } from './TreeDataProvider';
import fetchCategories from './fetchCategories';
import { PLAYGROUND_RUNTIME_MANIFEST_LOCATION } from './constants';
import { substrateDepsInstalled } from './substrateDeps';

function init(context: vscode.ExtensionContext) {
	fetchCategories().then((categories: Category[]) => {

		// Setting up the tree
		vscode.window.registerTreeDataProvider('substrateMarketplace', new TreeDataProvider(categories));

		// Actions for information on the pallet
		([
			{ command: 'substrateMarketplace.palletDocumentation', name: 'Documentation', property: 'documentation'},
			{ command: 'substrateMarketplace.palletGithub', name: 'GitHub page', property: 'github'},
			{ command: 'substrateMarketplace.palletHomepage', name: 'Homepage', property: 'homepage'}
		] as const).forEach(({command, name, property}) => {
			vscode.commands.registerCommand(command, (item: TreePallet) => {
				if (!item[property].startsWith('http')) {
					vscode.window.showErrorMessage(`${name} is unavailable for this pallet.`);
					return;
				}
				vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(item[property]));
			});
		});

		// Action for installing the pallet
		vscode.commands.registerCommand("substrateMarketplace.installPallet", async (item: vscode.TreeItem) => {
			if (!await substrateDepsInstalled()) {
				return;
			}

			const palletName = item.label as string;
			if (!/^[a-z-]+$/.test(palletName)) {
				vscode.window.showErrorMessage('Pallet name is invalid.');
				return;
			}

			const clicked = await vscode.window.showInformationMessage(`Install the pallet ${palletName}?`, { modal: true }, 'Yes');
			if (clicked !== 'Yes') {
				return;
			}

			// Prepare command arguments
			const alias = (alias => alias === palletName ? null : alias)(palletName.replace(/^pallet-/, ''));
			const isTheia = os.hostname().startsWith('theia-substrate-');
			const manifestPath = await (async isTheia =>
				isTheia
					? PLAYGROUND_RUNTIME_MANIFEST_LOCATION
					: (await vscode.window.showOpenDialog({
						filters: {
							'Cargo.toml': ['toml']
						}, openLabel: 'Select location of runtime manifest'
					}))?.[0]?.path
			)(isTheia);
			if (manifestPath === undefined) { return; } // User clicked cancel
			if (!manifestPath.toString().endsWith('Cargo.toml')) {
				vscode.window.showErrorMessage('Runtime manifest is invalid, must be Cargo.toml.');
				return;
			}

			// Build command
			const command = [];
			command.push('substrate-deps');
			command.push(`add ${palletName}`);
			if (alias) { command.push(`--alias ${alias}`); };
			command.push(`--manifest-path ${manifestPath}`);
			command.push('&& exit');
			const termCommand = command.join(' ');

			// Create terminal and run command
			const term = vscode.window.createTerminal({ name: `Installing ${palletName}` });
			term.sendText(termCommand);

			const revealTerminalTimeout = setTimeout(() => {
				vscode.window.showErrorMessage(`An error might have occurred when installing ${palletName}. Please check the terminal for more information.`);
				term.show();
				disp.dispose();
			}, 5000); // TODO find a better way (IPC?)

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
	}, (async r => {
			const clicked = await vscode.window.showErrorMessage(`An error occured when fetching the list of pallets from the Substrate Marketplace: ${r}`, 'Try again');
			if (clicked === 'Try again') {
				return init(context);
			}
	}));
}

export function activate(context: vscode.ExtensionContext) {
	init(context);
}

export function deactivate() { }