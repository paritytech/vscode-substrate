import * as vscode from 'vscode';
const fs = require('fs');
const os = require('os');
const path = require('path');

import { PLAYGROUND_RUNTIME_MANIFEST_LOCATION } from './constants';

/**
 * NOTE
 * Relative paths: node's CWD is set to the workspace root in {@link extension/activate}
 */

export async function getManifestPath() {
  // Try workspace config
  const pathFromConfig = vscode.workspace.getConfiguration().get('substrateMarketplace.runtimeManifestPath');
  if (pathFromConfig) {
    if (fs.existsSync(pathFromConfig)) {
      return pathFromConfig;
    }
    vscode.window.showErrorMessage(`Runtime manifest path ${pathFromConfig} provided in workspace settings does not exist.`);
  }

  // Try sensible defaults
  const isTheia = os.hostname().startsWith('theia-substrate-');
  let existentPath = [
    path.join(vscode.workspace.rootPath, 'runtime', 'Cargo.toml'),
    path.join(vscode.workspace.rootPath, 'Cargo.toml'),
    ...isTheia ? [PLAYGROUND_RUNTIME_MANIFEST_LOCATION] : []
  ].find(fs.existsSync);
  if (existentPath) return existentPath;

  // Ask the user for location
  const manifestPath = (await vscode.window.showOpenDialog({
    filters: {
      'Cargo.toml': ['toml']
    }, openLabel: 'Select location of runtime manifest'
  }))?.[0]?.path
  if (manifestPath === undefined) { return Promise.reject(); } // User clicked cancel
  if (!manifestPath.toString().endsWith('Cargo.toml')) {
    vscode.window.showErrorMessage('Runtime manifest is invalid, must be Cargo.toml.');
    return Promise.reject();
  }

  // Save user-provided location in workspace settings

  // Favor path relative to workspace root in case the workspace root gets moved
  // around, or parent folders change names.
  const relativeManifestPath = path.relative(vscode.workspace.rootPath, manifestPath).toString();
  vscode.workspace.getConfiguration().update('substrateMarketplace.runtimeManifestPath', relativeManifestPath, vscode.ConfigurationTarget.Workspace);

  return manifestPath;
}