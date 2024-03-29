import { onExit } from 'signal-exit';

import { execSync, spawn } from 'node:child_process';

export default function buildProject(buildCommand, buildEnvironment = process.env) {
	if (!buildCommand) {
		throw new Error('Build command is not set. Check config file or set command using option "--exec"');
	}

	return new Promise((resolve, reject) => {
		const [cmd, ...arguments_] = buildCommand.split(' ');

		const child = spawn(cmd, arguments_, {
			// Detached here for correct stopping the whole process branch on non-Windows systems
			// for Windows `taskkill` is used
			detached: process.platform !== 'win32',
			stdio: 'ignore',
			env: buildEnvironment,
		});

		let removeExitListener;

		if (child.pid) {
			removeExitListener = onExit(() => {
				if (process.platform === 'win32') {
					execSync(`taskkill /PID ${child.pid} /T /F`);
				} else {
					// `-` right before the PID is for killing not only the process itself
					// but for killing its children too
					process.kill(-child.pid);
				}
			});
		}

		child.on('error', reject);
		child.on('close', code => {
			if (code) {
				reject(new Error(`Command "${buildCommand}" exited with status code: ${code}`));
			}

			if (removeExitListener) {
				removeExitListener();
			}

			resolve();
		});
	});
}
