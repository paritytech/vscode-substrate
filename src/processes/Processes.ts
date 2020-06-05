import { BehaviorSubject} from 'rxjs';
import * as vscode from 'vscode';

export type Process = {nodePath: string; term: vscode.Terminal; command: string;}

export default class Processes {

  processes$: BehaviorSubject<Process[]> = new BehaviorSubject([] as Process[]);

  new(process: Process) {
    this.processes$.next(this.processes$.getValue().concat([process]));
  }

  del(process: Process) {
    this.processes$.next(this.processes$.getValue().filter(p => p != process));
  }
}