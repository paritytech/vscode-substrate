import * as vscode from 'vscode';
const path = require('path');

import Runtimes from './runtimes/Runtimes';
import Runtime from './runtimes/Runtime';

/**
 * Returns a manifest path to operate on.
 *
 * @return {Promise<string>}
 */
export async function getManifestPath(currentRuntimePath: string | null, runtimes: Runtimes) {
  // If we're already in an active runtime, use it
  if (currentRuntimePath) return path.join(currentRuntimePath,'Cargo.toml');

  // Ask the user to pick the runtime to use
  const allRuntimes: Runtime[] = runtimes.runtimes$.getValue();
  if (allRuntimes.length > 1) {
    const pick = await vscode.window.showQuickPick(allRuntimes.map(runtime => runtime.runtimePath).concat("Other"), {placeHolder: "Please select the runtime to operate on."});
    if (pick === undefined)
      return Promise.reject();
    if (pick !== "Other")
      return path.join(pick, 'Cargo.toml');
  }

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

  return manifestPath;
}