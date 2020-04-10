const fs = require('fs');
const glob = require('glob');
const path = require('path');

/**
 * Given a folder path, return a list of runtimes contained inside.
 */
const findRuntimesInFolder = (roots: string): string[] => {
  // TODO use vscode.workspace.findFiles instead
  // TODO creating a runtime manually, first build.rs and after Cargo.toml,
  // messed up the system.
  return glob.sync(path.join(roots,'**/build.rs'), {ignore: '**/node_modules/**'}).filter((b: string) => {
    return fs.readFileSync(b).toString().includes('wasm_builder')
  }).map(( buildRs: string ) => path.dirname(buildRs)); // (todo transducers)
}

/**
 * Given a list of folder paths, return a list of runtimes contained inside any
 * one of them.
 */
export default (roots: string[]): string[] =>
  roots.map(findRuntimesInFolder).flat();