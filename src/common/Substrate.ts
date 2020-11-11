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
    private context: vscode.ExtensionContext
  ) { }

  async connectTo(wsEndpoint: string) {
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

  isAccountExists(name: string): boolean {
    const result = this.getAccounts();
    const exKey = result.find((val) => val.meta.name === name);
    if (!exKey) {
      return false;
    }
    return true;
  }

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

  getConnectionContracts() : any[] {
    if (!this.wsEndpoint) return [];
    const contractCodes = this.getContracts();
    const nodeContractCodes = contractCodes[this.wsEndpoint] || []; // TODO LATER SHOULD BE ID'D BY CONNECTION
    return nodeContractCodes;
  }

  getContracts() {
    const contractsString = this.context.globalState.get<string>('contracts');
    if (!contractsString) {
      return {};
    }
    return JSON.parse(contractsString);
  }

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
    await vscode.commands.executeCommand('substrate.refreshContracts');
  }
}
