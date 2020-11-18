import * as vscode from 'vscode';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair$Json } from '@polkadot/keyring/types';
import { KeypairType } from '@polkadot/util-crypto/types';
import { ApiPromise, WsProvider } from '@polkadot/api';
const fs = require('fs');

export type Contracts = { [index: string]: Contract[] };

export type Contract = { name: string, address: string, abiJson: any };

// Manages API connection and extension storage (accounts, contracts)
export class Substrate {
  private keyring = new Keyring({ type: 'sr25519' });
  private api?: ApiPromise;
  private wsEndpoint?: string;

  getConnection(): ApiPromise | undefined {
    return this.api;
  }

  constructor(
    // Necessary to access the extension's persistent storage
    private context: vscode.ExtensionContext
  ) { }

  async connectTo(wsEndpoint: string) {
    this.disconnect();
    this.wsEndpoint = wsEndpoint;
    const api = new ApiPromise({provider: new WsProvider(wsEndpoint)});
    await api.isReady;
    this.api = api;
  }

  async disconnect() {
    if (this.api) {
      this.api!.disconnect();
    }
    this.wsEndpoint = undefined;
    this.api = undefined;
  }

  getAccounts(): KeyringPair$Json[] {
    const accounts = this.context.globalState.get<string>('accounts');
    if (!accounts) {
      return [];
    }
    return JSON.parse(accounts);
  }

  getKeyring(): Keyring {
    return this.keyring;
  }

  // Verify if an account with the given name exists
  isAccountExists(name: string): boolean {
    const result = this.getAccounts();
    const exKey = result.find((val) => val.meta.name === name);
    if (!exKey) {
      return false;
    }
    return true;
  }

  // Replace all accounts with new accounts list
  async updateAccounts(accounts: KeyringPair$Json[]) {
    await this.context.globalState.update('accounts', JSON.stringify(accounts));
  }

  async createKeyringPair(key: string, name: string, type: KeypairType) {
    const pair = this.keyring.addFromUri(key, { name }, type);
    const accounts = this.getAccounts();
    accounts.push(pair.toJson());
    await this.updateAccounts(accounts);
  }

  async createKeyringPairWithPassword(key: string, name: string, type: KeypairType, pass: string) {
    const pair = this.keyring.addFromUri(key, { name }, type);

    const json = pair.toJson(pass);
    json.meta.whenEdited = Date.now();

    const accounts = this.getAccounts();
    accounts.push(json);
    await this.updateAccounts(accounts);
  }

  // Forget an account
  async removeAccount(name: string) {
    const accounts = this.getAccounts();
    const index = accounts.findIndex((val) => val.meta['name'] === name);
    accounts.splice(index, 1);
    await this.updateAccounts(accounts);
  }

  async renameAccount(oldName: string, newName: string) {
    const accounts = this.getAccounts();
    for (const account of accounts) {
      if (account.meta['name'] === oldName) {
        account.meta['name'] = newName;
        break;
      }
    }
    await this.updateAccounts(accounts);
  }

  // Import a new keyring pair globally
  // @TODO Keyring pairs are currently global, maybe scope them?
  async importKeyringPair(path: string) {
    const rawdata = fs.readFileSync(path);
    const pair: KeyringPair$Json = JSON.parse(rawdata.toString());
    if (this.isAccountExists(pair.meta['name'] as string)) {
      vscode.window.showWarningMessage('Account with same key already exists. Account not added');
      return;
    }
    const accounts = this.getAccounts();
    accounts.push(pair);
    await this.updateAccounts(accounts);
  }

  // Get the list of contracts for the current endpoint
  getConnectionContracts() : any[] {
    if (!this.wsEndpoint) return [];
    const contractCodes = this.getContracts();
    // @TODO Contracts are currently scoped to a websocket endpoint
    // We could use better heuristics instead
    const nodeContractCodes = contractCodes[this.wsEndpoint] || [];
    return nodeContractCodes;
  }

  // Get the list of all contracts for all endpoints
  getContracts() {
    const contractsString = this.context.globalState.get<string>('contracts');
    if (!contractsString) {
      return {};
    }
    return JSON.parse(contractsString);
  }

  // Add a new contract for the current endpoint
  async saveContract(contractName: string, contractAddress: string, abiJson: any) {
    const contracts = this.getConnectionContracts();
    const existingContract = contracts.find(
      contract => contract.name === contractName || contract.address === contractAddress
    );
    if (existingContract) {
      existingContract.name = contractName;
      existingContract.address = contractAddress;
      existingContract.abiJson = abiJson;
    } else {
      contracts.push({
        name: contractName,
        address: contractAddress,
        abiJson: abiJson,
      });
    }
    await this.updateConnectionContracts(contracts);
  }

  // Update contracts for the current endpoint
  async updateConnectionContracts(codes: Contract[]) {
    const connectedNode = this.wsEndpoint;
    if (!connectedNode) {
      throw Error('Not connected to node');
    }
    const contracts = this.getContracts();
    contracts[connectedNode] = codes;
    await this.updateContracts(contracts);
  }

  async updateContracts(codes: Contracts) {
    await this.context.globalState.update('contracts', JSON.stringify(codes));
    await vscode.commands.executeCommand('substrate.refreshContracts'); // Refresh TreeView
  }
}
