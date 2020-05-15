# Changelog

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