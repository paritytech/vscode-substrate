import * as vscode from 'vscode';

import { Category } from './types';
import { getManifestPath } from './getManifestPath';
import { substrateDepsInstalled } from './substrateDeps';
import { TreeDataProvider, TreePallet } from './TreeDataProvider';
import fetchCategories from './fetchCategories';

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
			const clicked = await vscode.window.showInformationMessage(`Install the pallet ${palletName}?`, { modal: true }, 'Yes');
			if (clicked !== 'Yes') {
				return;
			}

			// Get manifest path
			let manifestPath: string;
			try {
				manifestPath = await getManifestPath();
			} catch (e) {
				return;
			}

			// Prepare command
			const termCommand = [
				'substrate-deps',
				`add ${palletName}`,
				...alias ? [`--alias ${alias}`] : [],
				`--manifest-path '${manifestPath.replace(/'/, `'\\''`)}'`, // Allow spaces in path, prevent command injection
				'&& exit'
			].join(' ');

			// Create terminal and run command
			const term = vscode.window.createTerminal({ name: `Installing ${palletName}` });
			term.sendText(termCommand);

			// Manage outcome

			const revealTerminalTimeout = setTimeout(() => {
				vscode.window.showErrorMessage(`An error might have occurred when installing ${palletName} using project runtime manifest ${manifestPath}. Please check the terminal for more information.`);
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
	// Set the workspace root as working directory for fs.existsSync;
	// this lets us use relative paths (e.g. `./runtime/Cargo.toml`) in
	// the substrateMarketplace.manifestRuntimePath setting
	(p => p && process.chdir(p))(vscode.workspace.rootPath)
	init(context);
}

export function deactivate() { }