import { desktop, extension } from './build.mjs';
import { spawn } from 'node:child_process';
import electron from 'electron';
await desktop();
await extension();
const child = spawn(electron, ['.'], { stdio: 'inherit', windowsHide: true });
child.on('exit', code => process.exit(code ?? 0));
