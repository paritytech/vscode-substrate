import { u8aToHex } from '@polkadot/util';
import { mnemonicGenerate, randomAsU8a } from '@polkadot/util-crypto';
import * as clipboard from 'clipboardy';
import * as vscode from 'vscode';
import { Substrate } from '../../common/Substrate';
import { TreeDataProvider } from '../../common/TreeDataProvider';
import { showInputBoxValidate } from '../../util';

const fs = require('fs');

type Account = any;

export class AccountsProvider extends TreeDataProvider<AccountTreeItem> {
  substrate: Substrate;

  constructor(substrate: Substrate) {
    super();
    this.substrate = substrate;
  }

  getChildren(element?: AccountTreeItem): Thenable<AccountTreeItem[]> {
    if (element === undefined) {
      return Promise.resolve(this.substrate.getAccounts().map(a => new AccountTreeItem(a)));
    }
    return Promise.resolve(element.children);
  }
}

export class AccountTreeItem extends vscode.TreeItem {
  children: [] = [];
  account: Account;

  constructor(account: Account) {
    super(
      account.meta.name,
      vscode.TreeItemCollapsibleState.None);
    this.description = account.address;
    this.account = account;
  }
}

export async function setupAccountsTreeView(substrate: Substrate, context: vscode.ExtensionContext) {
    const treeDataProvider = new AccountsProvider(substrate);
    vscode.window.createTreeView('substrateAccounts', { treeDataProvider });

    // Add an existing account
    vscode.commands.registerCommand("substrate.addAccount", async () => {
      const name: string | undefined = await showInputBoxValidate({
          ignoreFocusOut: true,
          prompt: 'Account name',
          placeHolder: 'ex. Alice'
        }, async (value: any) => {
          if (!value || !value.trim()) {
            return 'Name is required';
          }
          if (substrate.isAccountExists(value)) {
            return 'Account with same name already exists';
          }
          return '';
        });
      if (!name) return;

      const type: 'ed25519' | 'sr25519' | undefined = await vscode.window.showQuickPick(['ed25519', 'sr25519']) as 'ed25519' | 'sr25519' | undefined;
      if (!type) return;

      const key: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'The key to the account',
        placeHolder: 'ex. //Alice'
      }, async (value: any) => {
        if (!value || !value.trim()) {
          return 'Key is required';
        }
        return '';
      });
      if (!key) return;

      await substrate.createKeyringPair(key, name, type);

      treeDataProvider.refresh();
    });

  // Generate a new account
  vscode.commands.registerCommand("substrate.createAccount", async () => {
    const name: string | undefined = await showInputBoxValidate({
      ignoreFocusOut: true,
      prompt: 'Account name',
      placeHolder: 'ex. Alice'
    }, async (value: any) => {
      if (!value || !value.trim()) {
        return 'Name is required';
      }
      if (substrate.isAccountExists(value)) {
        return 'Account with same name already exists';
      }
      return '';
    });
    if (!name) return;

    const cryptoType: 'ed25519' | 'sr25519' | undefined = await vscode.window.showQuickPick(['ed25519', 'sr25519']) as 'ed25519' | 'sr25519' | undefined;
    if (!cryptoType) return;

    const keyTypeR: 'Raw seed' | 'Mnemonic seed' | undefined = await vscode.window.showQuickPick(['Raw seed', 'Mnemonic seed']) as 'Raw seed' | 'Mnemonic seed' | undefined;
    if (!keyTypeR) return;
    const keyType = keyTypeR === 'Raw seed' ? 'seed' : 'mnemonic';

    const placeholder = keyType !== 'seed' ?
      'crunch aspect strong flavor enable final display general shy debate stable final'
      : 'ex. 0x89abd2b6b79f4e2df7e89cb6b44c7f02d416719f6970b17d6ad34178423fa922';
    const seed = keyType !== 'seed' ?
      mnemonicGenerate()
      : u8aToHex(randomAsU8a());
    const key: string | undefined = await showInputBoxValidate({
      ignoreFocusOut: true,
      prompt: 'The key to the account',
      placeHolder: placeholder,
      value: seed
    }, async (value: any) => {
      if (!value || !value.trim()) {
        return 'Key is required';
      }
      return '';
    });
    if (!key) return;

    const password: string | undefined = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      prompt: 'Account password',
      placeHolder: 'ex. StrongPassword',
      password: true,
      value: '',
    });
    if (typeof password === 'undefined') return;

    substrate.createKeyringPairWithPassword(key, name, cryptoType, password);

    treeDataProvider.refresh();
  });

  // Rename the selected account in the TreeView
  vscode.commands.registerCommand("substrate.renameAccount", async (item) => {
    // TODO This command and the following ones currently don't work when called
    // from the command palette (no "item" argument provided): we could then ask
    // the user to first quickpick which account to rename.
    const name: string | undefined = await showInputBoxValidate({
      ignoreFocusOut: true,
      prompt: 'Account name',
      value: item.account.meta.name,
      placeHolder: 'ex. Alice'
    }, async (value: any) => {
      if (!value || !value.trim()) {
        return 'Name is required';
      }
      if (substrate.isAccountExists(value) && value !== item.account.meta.name) {
        return 'Account with same name already exists';
      }
      return '';
    });
    if (!name) return;

    await substrate.renameAccount(item.account.meta.name, name);

    treeDataProvider.refresh();
  });

  // Remove the selected account in the TreeView
  vscode.commands.registerCommand("substrate.removeAccount", async (item) => {
    await substrate.removeAccount(item.account.meta.name);
    treeDataProvider.refresh();
  });

  // Copy the address of the selected account in the TreeView
  vscode.commands.registerCommand("substrate.copyAddress", async (item) => {
    try {
      await clipboard.write(item.account.address);
      vscode.window.showInformationMessage(`Address copied to clipboard.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to copy address to clipboard: ${err.message}`);
    }
  });

  // Import a new account
  vscode.commands.registerCommand("substrate.importAccount", async () => {
    const res = await vscode.window.showOpenDialog({
      openLabel: 'Import',
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'JSON': ['json'],
      },
    });
    if (!res) return;
    await substrate.importKeyringPair(res[0].path);

    treeDataProvider.refresh();
  });

  // Export the selected account in the TreeView
  vscode.commands.registerCommand("substrate.exportAccount", async (item) => {
    const result = await vscode.window.showSaveDialog({});
    if (!result) return;

    fs.writeFileSync(result.fsPath, JSON.stringify(item.account), 'utf8');
  });
}