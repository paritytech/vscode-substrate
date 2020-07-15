import * as vscode from 'vscode';
import { BehaviorSubject, of, combineLatest } from 'rxjs';
import { tryShortname, resolveWhenTerminalClosed, showInputBoxValidate, wsEndpointFromCommand } from '../../util';
import { switchMap, tap } from 'rxjs/operators';
import Nodes, { Node } from '../../nodes/Nodes';
import { ApiPromise, WsProvider } from '@polkadot/api';

import { Abi } from '@polkadot/api-contract';
import { mnemonicGenerate, randomAsU8a } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';
import { compactAddLength } from '@polkadot/util';

import * as clipboard from 'clipboardy';
import { TreeDataProvider } from '../../common/TreeDataProvider';
import { Substrate } from '../../common/Substrate';
import { Process } from '../../processes/Processes';

const fs = require('fs');
const path = require('path');

type Contract = any;

export class ContractsProvider extends TreeDataProvider<ContractTreeItem> {
  substrate: Substrate;

  constructor(substrate: Substrate) {
    super();
    this.substrate = substrate;
  }

  getChildren(element?: ContractTreeItem): Thenable<ContractTreeItem[]> {
    if (element === undefined) {
      return Promise.resolve([]);
      // return Promise.resolve(this.substrate.getConnectionContracts().map(a => new ContractTreeItem(a)));
    }
    return Promise.resolve(element.children);
  }
}

export class ContractTreeItem extends vscode.TreeItem {
  children: [] = [];
  contract: Contract;

  constructor(contract: Contract) {
    super(
      contract.meta.name,
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
  });

  vscode.commands.registerCommand("substrate.compileAndDeploy", async () => {
try{
    const api = substrate.getConnection();
    if (!api) {
      vscode.window.showErrorMessage('Please connect to a node first.');
      return;
    }
    if (!api.tx.contracts && !api.tx.contract) {
      vscode.window.showErrorMessage('The selected process doesn\'t support smart contracts.');
      return;
    }

    const folders = await vscode.window.showOpenDialog({canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select contract folder'})
    if (folders === undefined) return;

    const term = vscode.window.createTerminal({name: 'Compiling contract', cwd: folders[0]});
    term.sendText('cargo +nightly contract build && cargo +nightly contract generate-metadata && exit');
    term.show();

    await resolveWhenTerminalClosed(term);

    const wasmPath = path.join(folders[0].fsPath, 'target', path.basename(folders[0].fsPath) + '.wasm');
    const abiPath = path.join(folders[0].fsPath, 'target', 'metadata.json');
    console.log(wasmPath, abiPath);
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
      placeHolder: 'ex. Flipper contract'
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
    const _constructor = await vscode.window.showQuickPick(constructors.map((x: any) => x.name), {placeHolder: 'Choose constructor'});
    if (!_constructor) return;
    const constructorI = constructors.findIndex(x => x.name === _constructor)!;
    const constructor = constructors.find(x => x.name === _constructor)!;
    const args = constructor.args

    const argd: any[] = [];
    while (args.length > argd.length) {
      const i = argd.length;
      const prompt = `${args[i].name}: ${args[i].type.displayName}`;

      argd.push(await showInputBoxValidate({
        ignoreFocusOut: true,
        prompt
      }, async (value: any) => {
          return ''
      }));
    }

    const endowment: string | undefined = await showInputBoxValidate({
      ignoreFocusOut: true,
      prompt: 'The allotted endowment for this contract, i.e. the amount transferred to the contract upon instantiation',
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
      placeHolder: 'ex. 100000'
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

    const log = (...a: any[]) => console.log(...a);

    try {
      const { nonce } = await api.query.system.account(account.address);
      const contractApi = api.tx.contracts ? api.tx['contracts'] : api.tx['contract'];
      console.log('contractApi is ', contractApi); // TODO NEXT: contractApi is not defined
      const unsignedTransaction = contractApi.putCode(compiledContract);

      let code_hash = '';
      await unsignedTransaction.sign(account, { nonce: nonce as any }).send(({ events = [], status }: any) => {
        if (status.isFinalized) {
          const finalized = status.asFinalized.toHex();
          log(`Completed at block hash: ${finalized}`, 'info', false);

          log('Events:', 'info', false);
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
            log(res, 'info', false);
          });
          if (error !== '') {
            // Todo: Get error
            vscode.window.showErrorMessage(`Failed on block "${finalized}" with error: ${error}`);
            return;
          }
          if (resultHash === '') {
            log(`Completed on block "${finalized}" but failed to get event result`, 'warn', true);
            return;
          }
          // substrate.saveContractCode(name, resultHash).catch(err => {
          //   log(`Failed to store contract: ${err.message}`, 'error', true);
          // });
          log(`Completed on block ${finalized} with code hash ${resultHash}`, 'info', true);
          code_hash = resultHash;
        }
      });

      // DEPLOY CONTRACT
      try {
        const {nonce} = await api.query.system.account(account.address);
        const contractApi = api.tx.contracts ? api.tx['contracts'] : api.tx['contract'];
        const unsignedTransaction = contractApi.instantiate(
          endowment,
          maxGasDeployment,
          code_hash,
          abi.constructors[constructorI](...Object.values(argd)),
        );

        await unsignedTransaction.sign(account, { nonce: nonce as any }).send(({ events = [], status }: any) => {
          if (status.isFinalized) {
            const finalized = status.asFinalized.toHex();
            log(`Completed at block hash: ${finalized}`, 'info', false);

            log('Events:', 'info', false);
            let error: string = '';
            let resultHash: string = '';
            events.forEach(({ phase, event: { data, method, section } }: any) => {
              const res = `\t ${phase.toString()} : ${section}.${method} ${data.toString()}`;
              if (res.indexOf('Failed') !== -1) {
                error += res;
              }
              if (res.indexOf('indices.NewAccountIndex') !== -1) {
                resultHash = res.substring(
                  res.lastIndexOf('["') + 2,
                  res.lastIndexOf('",'),
                );
              }
              log(res, 'info', false);
            });
            if (error !== '') {
              vscode.window.showErrorMessage(`Failed on block "${finalized}" with error: ${error}`);
              return;
            }
            if (resultHash === '') {
              vscode.window.showInformationMessage(`Completed on block "${finalized}" but failed to get event result`);
              return;
            }
            substrate.saveContract(name, resultHash, abi).catch(err => {
              vscode.window.showErrorMessage(`Failed to store contract: ${err.message}`);
            });
            vscode.window.showInformationMessage(`Completed on block ${finalized} with code hash ${resultHash}`);
          }
        });
      } catch (err) {
        vscode.window.showErrorMessage(`Error on deploy contract: ${err.message}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Error on put code: ${err.message}`);
    }
  } catch (surerr) {
    vscode.window.showErrorMessage(surerr);
  }
  });
}