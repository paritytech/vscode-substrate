# Changelog

## v0.4.6
* Workspace tasks (tasks defined by the template) are now listed in a treeview

## v0.4.5
* Polkadot Apps link on Substrate Playground
* Ask user for flags when launching node

## v0.4.4
* List running nodes

## v0.4.3
* The start node command now compiles in release mode.

## v0.4.2
* Retain Getting started view in cache when the tab loses focus

## v0.4.1
* Lint

## v0.4.0

* Reorganized UI : now shows the list of nodes in the workspace. The marketplace is based on the runtime of the selected node.
* Node commands accessible in the Command Palette.

## v0.3.4

* Fix commands "Start node" and "Purge chain"
* Remove playground-specific commands

## v0.3.2

* Fix Playground detection
* Fix pallets GitHub target

## v0.3.1

* Marketplace is now loaded on startup
* Selected runtime now highlighted
* Fix parsing runtime pallets

## v0.3.0

* Support multiple nodes
* Execute operations on the selected node
* Runtime is selected by user and isn't based on the active editor's path any longer.

## v0.2.0

* Support multiple runtimes in the same workspace. Your active editor will determine the runtime used by the extension.
* Display installed pallets.
* Removed setting `substrateMarketplace.runtimeManifestPath` & removed Substrate Playground hardcoded path. Runtimes are now detected and updated automatically.

## v0.1.1

* Your project's runtime manifest location can now be provided using the `substrateMarketplace.runtimeManifestPath` setting.
* If this setting is not provided, the extension will try to use `./runtime/Cargo.toml` or `./Cargo.toml`.