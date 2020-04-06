# Substrate Marketplace VSCode extension

## Features

* Browse and install pallets from the Substrate Marketplace.

* Will install [substrate-deps](https://github.com/paritytech/substrate-deps) if not already installed

* Runtime manifest location is hardcoded when run inside Substrate Playground

## Usage

Pallets are listed in the explorer view in the activity bar to the left. Click the "Download" icon to add a pallet to your project.

## Installation

Head over to the [Releases](https://github.com/axelchalon/vscode-marketplace/releases) page and download the `.vsix` file from the latest release. Open VSCode, and run "Extensions: Install from VSIX" in your command palette.

## Development

Clone, run `yarn` to install the dependencies, open the folder in VSCode, run the command "Debug: Start Debugging" to launch a new VSCode instance with the extension running.