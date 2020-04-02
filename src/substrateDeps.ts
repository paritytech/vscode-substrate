
const child_process = require('child_process');
import * as vscode from 'vscode';

import { resolveWhenTerminalClosed } from './util';

export async function substrateDepsInstalled(): Promise<boolean> {
  try {
    child_process.execSync('substrate-deps --version');
    return true;
  } catch (e) {
    const clicked = await vscode.window.showWarningMessage(
      `substrate-deps is required for this extension to work but doesn't seem to be installed. Install it? This will run the following command: 'cargo install substrate-deps'`,
      { modal: true },
      'Yes'
    );

    if (clicked !== 'Yes') {
      return false;
    }

    const term = vscode.window.createTerminal('Installing substrate-deps');
    term.sendText('cargo install substrate-deps && exit');
    term.show();

    await resolveWhenTerminalClosed(term);

    if (term.exitStatus?.code === 0) {
      vscode.window.showInformationMessage(`substrate-deps was successfully installed.`);
      return substrateDepsInstalled();
    } else {
      console.error('Terminal is closed; should have exit status; qed.')
      return false;
    }

    // TODO if users runs this function again with a terminal already running, we have two listeners, this is bad.
  }
}