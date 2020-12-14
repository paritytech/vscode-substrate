# Substrate - VSCode extension

Manage your node, runtime, browse and install pallets, manage your accounts and your smart contracts within VSCode.

A complete list of features and walkthrough is available in [this document](./docs/features.md).

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

## Publish

Bump the version in `package.json`, tag your commit with the version number (`vX.X.X`) and push. This will trigger the GitHub Action and publish the new version on VSCode Marketplace as well as create a new release on GitHub. Release information can be edited manually and added to CHANGELOG.md