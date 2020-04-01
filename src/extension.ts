import * as vscode from 'vscode';
const os = require('os');
const child_process = require('child_process');

import { Category } from './types';
import { TreeDataProvider, TreePallet } from './TreeDataProvider';
import fetchCategories from './fetchCategories';

async function substrateDepsInstalled(): Promise<undefined> {
	try {
		child_process.execSync('substrate-deps --version');
	} catch(e) {
		const selectedButton = await vscode.window.showWarningMessage(
			`substrate-deps is required for this extension to work but doesn't seem to be installed. Install it? This will run the following command: 'cargo install substrate-deps'`,
			{modal: true},
			'Yes'
		);

		if (selectedButton !== 'Yes') {
			return Promise.reject();
		}

		const term = vscode.window.createTerminal('Installing substrate-deps');
		term.sendText('cargo install substrate-deps && exit');
		term.show();

		return new Promise((resolve, reject) => {
			const disp = vscode.window.onDidCloseTerminal(t => {
				if (t === term) {
					disp.dispose();
					if (t?.exitStatus?.code === 0) {
						vscode.window.showInformationMessage(`substrate-deps was successfully installed.`);
						resolve(); // memory leaks
					} else {
						reject();
					}
				}
			});
		}).then(() => substrateDepsInstalled());
	}
}

function init(context: vscode.ExtensionContext) {
	fetchCategories().then((data: Category[]) => {

		// Setting up the tree
		vscode.window.registerTreeDataProvider('substrateMarketplace', new TreeDataProvider(data));

		// Actions for information on the pallet
		vscode.commands.registerCommand("substrateMarketplace.palletDocumentation", (item: TreePallet) => {
			if (!item.documentation.startsWith('http')) {
				vscode.window.showErrorMessage('Documentation is unavailable for this pallet.');
				return;
			}
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(item.documentation));
		});
		vscode.commands.registerCommand("substrateMarketplace.palletGithub", (item: TreePallet) => {
			if (!item.github.startsWith('http')) {
				vscode.window.showErrorMessage('GitHub page is unavailable for this pallet.');
				return;
			}
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(item.github));
		});
		vscode.commands.registerCommand("substrateMarketplace.palletHomepage", (item: TreePallet) => {
			if (!item.homepage.startsWith('http')) {
				vscode.window.showErrorMessage('Homepage is unavailable for this pallet.');
				return;
			}
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(item.homepage));
		});

		// Action for installing the pallet
		vscode.commands.registerCommand("substrateMarketplace.installPallet", async (item: vscode.TreeItem) => {
			try {
				await substrateDepsInstalled();
			}
			catch {
				return;
			}

			const palletName = item.label as string;

			if (!/^[a-z-]+$/.test(palletName)) {
				vscode.window.showErrorMessage('Pallet name is invalid.');
				return;
			}

			vscode.window.showInformationMessage(`Install the pallet ${item.label}?`, { modal: true }, 'Yes')
				.then(async (selectedButton: any) => {
					if (selectedButton === 'Yes') {
						// Prepare command arguments
						const alias = (alias => alias === palletName ? null : alias)(palletName.replace(/^pallet-/, ''));
						const isTheia = os.hostname().startsWith('theia-substrate-');
						const manifestPath = await (async isTheia =>
							isTheia
								? '/home/workspace/substrate-node-template/runtime/Cargo.toml'
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

						// Create terminal
						const term = vscode.window.createTerminal({ name: 'Installing ' + palletName });
						term.sendText(termCommand);

						const revealTerminalTimeout = setTimeout(() => {
							vscode.window.showErrorMessage(`An error occurred when installing ${palletName}. Please check the terminal for more information.`);
							term.show();
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
					}
				});
		});
	}, (r => {
		vscode.window.showErrorMessage(`An error occured when fetching the list of pallets from the Substrate Marketplace: ${r}`, 'Try again').then((x) => {
			if (x === 'Try again') {
				return init(context);
			}
		});
	}));
}

export function activate(context: vscode.ExtensionContext) {
	init(context);
}

export function deactivate() { }