import * as vscode from 'vscode';
import { BehaviorSubject, of, combineLatest } from 'rxjs';
import { tryShortname } from '../../util';
import { switchMap, tap } from 'rxjs/operators';
import Nodes, {Node} from '../../nodes/Nodes';
import Processes, { Process } from '../../processes/Processes';

export class ProcessesProvider implements vscode.TreeDataProvider<ProcessTreeItem> {
  ProcessTreeItems: ProcessTreeItem[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<ProcessTreeItem | undefined> = new vscode.EventEmitter<ProcessTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<ProcessTreeItem | undefined> = this._onDidChangeTreeData.event;

  constructor(processes: Processes) {
    processes.processes$.subscribe((processes: Process[]) => {
      this.ProcessTreeItems = processes.map((process: Process) => {
        return new ProcessTreeItem(process);
      });

      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: ProcessTreeItem): ProcessTreeItem | Thenable<ProcessTreeItem> {
    return element;
  }

  getChildren(element?: ProcessTreeItem | undefined): vscode.ProviderResult<ProcessTreeItem[]> {
    if (element === undefined) {
      return this.ProcessTreeItems;
    }
    return element.children;
  }
}

const isTheia = process.env.SUBSTRATE_PLAYGROUND !== undefined;

export class ProcessTreeItem extends vscode.TreeItem {
  children: undefined;
  process: Process;

  constructor(process: Process) {
    const { nodePath, command } = process;
    super(
      tryShortname(nodePath) + ' • ' + command,
      vscode.TreeItemCollapsibleState.None);
    this.process = process;
    this.command = {
      command: "substrate.selectProcess",
      title: "Select Process",
      arguments: [this]
    };

    this.contextValue = isTheia ? 'theia' : 'vscode'
  }
}


async function quickPickProcesses(_processes: Processes) {
  let processes = _processes.processes$.getValue();

  if (processes.length === 1)
    return processes[0];

  if (processes.length === 0) {
    vscode.window.showErrorMessage('No node was found in the workspace.');
    return Promise.reject();
  }

  const processesReadable = processes.map(n => tryShortname(n.nodePath));

  const pick = await vscode.window.showQuickPick(processesReadable, { placeHolder: "Please choose a node." });
  if (pick === undefined)
    return Promise.reject();

  return processes[processesReadable.findIndex(x => x === pick)];
}

const INSTANCE = process.env.SUBSTRATE_PLAYGROUND_INSTANCE;
const HOST = process.env.SUBSTRATE_PLAYGROUND_HOSTNAME;

export function setupProcessesTreeView(processes: Processes) {

    vscode.commands.registerCommand("substrate.polkadotApps", async (processTreeItem?: ProcessTreeItem) => {
      const process = processTreeItem?.process || await quickPickProcesses(processes);

      const port = process.command.match(/--ws-port[ =]\d+/)?.[0] || '9944';
      const wsEndpoint = `wss://${INSTANCE}.${HOST}${port !== '9944' ? `:${port}` : ''}/wss`;
      const apps = `https://polkadot.js.org/apps/?rpc=${wsEndpoint}`;
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(apps));
    });

    vscode.commands.registerCommand("substrate.selectProcess", async (processTreeItem: ProcessTreeItem) => {
      processTreeItem.process.term.show();
    });

    vscode.commands.registerCommand("substrate.stopProcess", async (processTreeItem?: ProcessTreeItem) => {
      const process = processTreeItem?.process || await quickPickProcesses(processes);
      processes.del(process);
      process.term.sendText('\x03');
      process.term.sendText('exit 0');
    });

    const treeDataProvider = new ProcessesProvider(processes);
    const treeView = vscode.window.createTreeView('substrateProcesses', { treeDataProvider });

    processes.processes$.subscribe((processes: Process[]) => {
      if (processes.length === 0 && isTheia)
        treeView.message = `No node is currently running.`;
      else
        treeView.message = undefined;
    });
}