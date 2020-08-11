# Substrate - VSCode extension

Features
* Provides a quick access to the VSCode Actions provided in the workspace
* Detects the nodes in the workspace and lets you run them, or purge the chain
* Detects the runtimes in the workspace and lets you see which pallets they use, gives you access to their documentation, and lets you install additional pallets easily from the Substrate Marketplace
* Lists running processes, lets you kill them or access their terminal
* Account management (for testing purposes)
* Compile, deploy and call smart contracts

Walkthrough tasks (separate file)
1. Workspace actions
  1.1 Run workspace actions
2. Node actions
  2.1 Purge a node's chain
  2.2 Run a node
  2.3 Kill a node
3. Runtime actions
  3.1 Get information on installed pallets
  3.2 Add a new pallet
4. Account management
  4.1 Import an account
  4.2 Import an account from JSON
  4.3 Generate a new account
  4.4 Rename, copy address, export, remove account
5. Contracts
  5.1 Compile & deploy a contract (first select a node)
  5.2 Call a contract method (contracts are persisted via connection info)
  5.3 Copy hash, forget contract

Visit the extension's page on Visual Studio Marketplace: https://marketplace.visualstudio.com/items?itemName=paritytech.vscode-substrate

![Screenshot](./screenshot.png)

This extension is work in progress and is in active development. Please [report](https://github.com/paritytech/vscode-substrate/issues/new) any issues you encounter.

## Installation

Launch VS Code Quick Open (Ctrl+P), paste the following command, and press enter.

```
ext install paritytech.vscode-substrate
```

Alternatively, search for "VSCode Substrate" in the extension marketplace.

## Development

Clone, run `yarn` to install the dependencies, open the folder in VSCode, run the command "Debug: Start Debugging" to launch a new VSCode instance with the extension running.