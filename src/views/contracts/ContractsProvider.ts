import * as vscode from 'vscode';
import { tryShortname, resolveWhenTerminalClosed, showInputBoxValidate, wsEndpointFromCommand } from '../../util';
import { Abi } from '@polkadot/api-contract';
import { compactAddLength } from '@polkadot/util';

import * as clipboard from 'clipboardy';
import { TreeDataProvider } from '../../common/TreeDataProvider';
import { Substrate, Contract } from '../../common/Substrate';
import { Process } from '../../processes/Processes';

const fs = require('fs');
const path = require('path');

export class ContractsProvider extends TreeDataProvider<ContractTreeItem> {
  substrate: Substrate;

  constructor(substrate: Substrate) {
    super();
    this.substrate = substrate;
  }

  getChildren(element?: ContractTreeItem): Thenable<ContractTreeItem[]> {
    if (element === undefined) {
      return Promise.resolve(this.substrate.getConnectionContracts().map(a => new ContractTreeItem(a)));
    }
    return Promise.resolve(element.children);
  }
}

export class ContractTreeItem extends vscode.TreeItem {
  children: [] = [];
  contract: Contract;

  constructor(contract: Contract) {
    super(
      contract.name,
      vscode.TreeItemCollapsibleState.None);
    this.description = contract.address;
    this.contract = contract;
  }
}

export async function setupContractsTreeView(substrate: Substrate, selectedProcess$: any, context: vscode.ExtensionContext) {
  const treeDataProvider = new ContractsProvider(substrate);
  const treeView = vscode.window.createTreeView('substrateContracts', { treeDataProvider });

  selectedProcess$.subscribe((process: Process) => {
    if (process)
      treeView.message = `Connected to: ${wsEndpointFromCommand(process.command)} (${tryShortname(process.nodePath) + ' • ' + process.command})`;
    else
      treeView.message = `Not connected to any node.`;
    vscode.commands.executeCommand('substrate.refreshContracts');
  });

  vscode.commands.registerCommand("substrate.refreshContracts", async (contractItem: ContractTreeItem) => {
    treeDataProvider.refresh();
  });

  vscode.commands.registerCommand("substrate.callContractMethod", async (contractItem: ContractTreeItem) => {
    try {
      const api = substrate.getConnection();
      if (!api) {
        vscode.window.showErrorMessage(`Not connected to a node.`);
        return;
      }

      const abi = new Abi(api.registry, contractItem.contract.abiJson);

      const methods = abi.abi.contract.messages;
      const items = methods.map(method => {
        const args = method.args.map((arg) => `${arg.name}: ${arg.type}`);
        const retDisplayName = method.returnType && method.returnType.displayName;
        return {
          label: `🧭 ${method.name}(${args.join(', ')})${retDisplayName ? `: ${retDisplayName}` : ''}`,
          description: method.mutates ? 'will mutate storage' : 'won\'t mutate storage',
          detail: `Method selector: ${method.selector}`,
          method
        };
      });
      const pickedMessage = await vscode.window.showQuickPick(items, { placeHolder: 'ex. get(): bool' });
      if (!pickedMessage) return;
      const method = pickedMessage.method;

      const valueTo: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'The allotted value for this contract, i.e. the amount transferred to the contract as part of this call',
        value: '1000000000000000',
        placeHolder: 'ex. 1000000000000000'
      }, async (value: any) => {
        if (!value || !value.trim()) {
          return 'Value is required';
        }
        if (!value.match(/^-{0,1}\d+$/)) {
          return 'The value specified is not a number';
        }
        return '';
      });
      if (!valueTo) return;

      const maxGas: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'The maximum amount of gas that can be used by this call',
        value: '1000000000000', // too much?
        placeHolder: 'ex. 1000000000000'
      }, async (value: any) => {
        if (!value || !value.trim()) {
          return 'A value is required';
        }
        if (!value.match(/^-{0,1}\d+$/)) {
          return 'The maximum gas specified is not a number';
        }
        return '';
      });
      if (!maxGas) return;

      const argsVals = [];
      const argsDefs = pickedMessage.method.args;

      while (argsDefs.length > argsVals.length) {
        const i: number = argsVals.length;
        const prompt = `${argsDefs[i].name}: ${argsDefs[i].type.displayName}`;

        const vale = await showInputBoxValidate({
          ignoreFocusOut: true,
          prompt
        }, async (value: any) => {
          return ''
        });
        if (vale === undefined) return; // User cancelled
        argsVals.push(vale);
      }

      const accounts = substrate.getAccounts();
      const _account = await vscode.window.showQuickPick(substrate.getAccounts().map((x: any) => x.meta.name));
      if (!_account) return;
      const accountJson = accounts.find(a => a.meta.name === _account)!;

      const keyring = substrate.getKeyring();
      const account = keyring.addFromJson(accountJson);

      const password: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'Account password',
        placeHolder: 'ex. StrongPassword',
        password: true,
        value: '',
      }, async (value: any) => {
        try {
          account.decodePkcs8(value);
          if (account.isLocked) {
            return 'Failed to decode account';
          }
        } catch (e) {
          return 'Failed to decode account';
        }
        return '';
      });
      if (typeof password === 'undefined') return;

      // METHOD CALL

      vscode.window.showInformationMessage('Calling contract method...');

      try {
        const { nonce } = await api.query.system.account(account.address);
        const contractApi = api.tx.contracts ? api.tx['contracts'] : api.tx['contract'];

        const methodExec = abi.messages[method.name];
        const unsignedTransaction = contractApi.call(
          contractItem.description,
          valueTo,
          maxGas,
          methodExec(...argsVals),
        );

        const cb = await unsignedTransaction.sign(account, { nonce: nonce as any }).send(({ events = [], status }: any) => {
          if (status.isFinalized) {
            const finalized = status.asFinalized.toHex();
            console.log(`Completed at block hash: ${finalized}`);

            console.log(`Events:`);
            let error: string = '';
            events.forEach(({ phase, event: { data, method, section } }: any) => {
              const res = `\t ${phase.toString()} : ${section}.${method} ${data.toString()}`;
              if (res.indexOf('Failed') !== -1) {
                error += res;
              }
              console.log(res);
            });
            if (error !== '') {
              // Todo: Get error
              vscode.window.showErrorMessage(`Failed on block "${finalized}" with error: ${error}`);
              return;
            }
            vscode.window.showInformationMessage(`Completed on block ${finalized}`);
          }
        });
        // TODO Get results from contract
      } catch (err) {
        vscode.window.showErrorMessage(`Error on put code: ${err.message}`);
      }
    }
    catch (err) {
      console.error(err);
      vscode.window.showErrorMessage(err);
    }
  });

  vscode.commands.registerCommand("substrate.forgetContract", async (contractItem: ContractTreeItem) => {
    try {
      const contracts = substrate.getConnectionContracts();
      for (let i = 0; i < contracts.length; i++) {
        const contract = contracts[i];
        if (contract.name === contractItem.label || contract.address === contractItem.description) {
          contracts.splice(i, 1);
        }
      }
      await substrate.updateConnectionContracts(contracts);
    } catch (err) {
      vscode.window.showErrorMessage('You are not connected to a node');
    }
    await vscode.commands.executeCommand('substrate.refreshContracts');
    vscode.window.showInformationMessage(`Successfully removed contract "${contractItem.label}"`);
  });

  vscode.commands.registerCommand("substrate.copyContractHash", async (contractItem: ContractTreeItem) => {
    try {
      await clipboard.write((contractItem as any).description);
      vscode.window.showInformationMessage('Hash copied to clipboard');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to copy hash to clipboard: ${err.message}`);
    }
  });

  vscode.commands.registerCommand("substrate.compileAndDeploy", async () => {
    try {
      const api = substrate.getConnection();
      if (!api) {
        vscode.window.showErrorMessage('Please connect to a node first.');
        return;
      }
      if (!api.tx.contracts && !api.tx.contract) {
        vscode.window.showErrorMessage('The selected process doesn\'t support smart contracts.');
        return;
      }

      const folders = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select contract folder' })
      if (folders === undefined) return;

      const term = vscode.window.createTerminal({ name: 'Compiling contract', cwd: folders[0] });
      term.sendText('cargo +nightly contract build && cargo +nightly contract generate-metadata && exit');
      term.show();

      await resolveWhenTerminalClosed(term);

      const wasmPath = path.join(folders[0].fsPath, 'target', path.basename(folders[0].fsPath) + '.wasm');
      const abiPath = path.join(folders[0].fsPath, 'target', 'metadata.json');
      const wasm: Uint8Array = await fs.promises.readFile(wasmPath);
      const isWasmValid = wasm.subarray(0, 4).join(',') === '0,97,115,109'; // '\0asm'
      if (!isWasmValid) {
        console.error('Invalid code');
        throw Error('Invalid code');
      }
      const compiledContract = compactAddLength(wasm);

      const name: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'Contract name',
        placeHolder: 'ex. Flipper contract',
        value: 'flip'
      }, async (value: any) => {
        if (!value || !value.trim()) {
          return 'A name is required';
        }
        return '';
      });
      if (!name) return;

      const accounts = substrate.getAccounts();
      const _account = await vscode.window.showQuickPick(substrate.getAccounts().map((x: any) => x.meta.name));
      if (!_account) return;
      const accountJson = accounts.find(a => a.meta.name === _account)!;

      const keyring = substrate.getKeyring();
      const account = keyring.addFromJson(accountJson);

      const password: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'Account password',
        placeHolder: 'ex. StrongPassword',
        password: true,
        value: '',
      }, async (value: any) => {
        try {
          account.decodePkcs8(value);
          if (account.isLocked) {
            return 'Failed to decode account';
          }
        } catch (e) {
          return 'Failed to decode account';
        }
        return '';
      });
      if (typeof password === 'undefined') return;

      const abiBytes: Uint8Array = await fs.promises.readFile(abiPath);
      const abiJson = JSON.parse(abiBytes.toString());
      const abi = new Abi(api.registry, abiJson);
      const constructors = abi.abi.contract.constructors;
      const _constructor = await vscode.window.showQuickPick(constructors.map((x: any) => x.name), { placeHolder: 'Choose constructor' });
      if (!_constructor) return;
      const constructorI = constructors.findIndex(x => x.name === _constructor)!;
      const constructor = constructors.find(x => x.name === _constructor)!;
      const args = constructor.args

      const constructorParams: any[] = [];
      while (args.length > constructorParams.length) {
        const i = constructorParams.length;
        const prompt = `${args[i].name}: ${args[i].type.displayName}`;

        constructorParams.push(await showInputBoxValidate({
          ignoreFocusOut: true,
          prompt
        }, async (value: any) => {
          return ''
        }));
      }

      const endowment: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'The allotted endowment for this contract, i.e. the amount transferred to the contract upon instantiation.',
        value: '1000000000000000',
        placeHolder: 'ex. 1000000000000000'
      }, async (value: any) => {
        if (!value || !value.trim()) {
          return 'Endowment is required';
        }
        if (!value.match(/^-{0,1}\d+$/)) {
          return 'The endowment specified is not a number';
        }
        return '';
      });
      if (!endowment) return;

      const maxGasDeployment: string | undefined = await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt: 'The maximum amount of gas that can be used for the deployment',
        value: '1000000000000',
        placeHolder: 'ex. 1000000000000'
      }, async (value: any) => {
        if (!value || !value.trim()) {
          return 'A value is required';
        }
        if (!value.match(/^-{0,1}\d+$/)) {
          return 'The maximum gas specified is not a number';
        }
        return '';
      });
      if (!maxGasDeployment) return;

      // PUT CODE

      vscode.window.showInformationMessage('Uploading WASM...');

      try {
        const { nonce } = await api.query.system.account(account.address);
        const contractApi = api.tx.contracts ? api.tx['contracts'] : api.tx['contract'];
        const unsignedTransaction = contractApi.putCode(compiledContract);

        let code_hash = '';
        unsignedTransaction.sign(account, { nonce: nonce as any }).send(async ({ events = [], status }: any) => {
          if (status.isFinalized) {
            const finalized = status.asFinalized.toHex();
            console.log(`Completed at block hash: ${finalized}`);

            console.log('Events:');
            let error: string = '';
            let resultHash: string = '';
            events.forEach(({ phase, event: { data, method, section } }: any) => {
              const res = `\t ${phase.toString()} : ${section}.${method} ${data.toString()}`;
              if (res.indexOf('Failed') !== -1) {
                error += res;
              }
              if (res.indexOf('contracts.CodeStored') !== -1) {
                resultHash = res.substring(
                  res.lastIndexOf('["') + 2,
                  res.lastIndexOf('"]'),
                );
              }
              console.log(res);
            });
            if (error !== '') {
              // Todo: Get error
              vscode.window.showErrorMessage(`Failed on block "${finalized}" with error: ${error}`);
              return;
            }
            if (resultHash === '') {
              vscode.window.showErrorMessage(`Completed on block "${finalized}" but failed to get event result`);
              return;
            }
            console.log(`Completed on block ${finalized} with code hash ${resultHash}`);
            code_hash = resultHash;

            // Deploying contract

            vscode.window.showInformationMessage('Instantiating contract...');

            // DEPLOY CONTRACT
            try {
              const { nonce } = await api.query.system.account(account.address);
              const unsignedTransaction = contractApi.instantiate(
                endowment, // +3 more 0's
                maxGasDeployment,
                code_hash,
                abi.constructors[constructorI](...constructorParams) // TODO test when passing parameters
              );
              await unsignedTransaction.sign(account, { nonce: nonce as any }).send(({ events = [], status }: any) => {
                if (status.isFinalized) {
                  const finalized = status.asFinalized.toHex();
                  console.log(`Completed at block hash: ${finalized}`);

                  console.log('Events:');
                  let error: string = '';
                  let resultHash: string = '';
                  events.forEach(({ phase, event: { data, method, section } }: any) => {
                    const res = `\t ${phase.toString()} : ${section}.${method} ${data.toString()}`;
                    if (res.indexOf('Failed') !== -1) {
                      error += res;
                    }
                    if (res.indexOf('contracts.Instantiated') !== -1) {
                      resultHash = res.substring(
                        res.lastIndexOf('["') + 2,
                        res.lastIndexOf('",'),
                      );
                    }
                    console.log(res);
                  });
                  if (error !== '') {
                    vscode.window.showErrorMessage(`Failed on block "${finalized}" with error: ${error}`);
                    return;
                  }
                  if (resultHash === '') {
                    vscode.window.showWarningMessage(`Completed on block "${finalized}" but failed to get event result`);
                    return;
                  }
                  substrate.saveContract(name, resultHash, abiJson).catch(err => {
                    vscode.window.showErrorMessage(`Failed to store contract: ${err.message}`);
                  });
                  vscode.window.showInformationMessage(`Completed on block ${finalized} with code hash ${resultHash}`);
                }
              });
            } catch (err) {
              vscode.window.showErrorMessage(`Error on deploy contract: ${err.message}`);
            }
          }
        });
      } catch (err) {
        vscode.window.showErrorMessage(`Error on put code: ${err.message}`);
      }
    } catch (surerr) {
      vscode.window.showErrorMessage(surerr);
    }
  });
}