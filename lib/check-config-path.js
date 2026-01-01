import fs from 'node:fs';
import path from 'node:path';

export default function checkConfigPath(filepath = '') {
	const resolvedPath = path.resolve(filepath);

	if (!fs.existsSync(resolvedPath)) {
		throw new Error('Provided config path does not exist');
	}

	if (!fs.statSync(resolvedPath).isFile()) {
		throw new Error('Provided config path must point to a file');
	}

	return resolvedPath;
}
