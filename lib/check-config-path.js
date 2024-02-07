import fs from 'node:fs';
import path from 'node:path';

export default function checkConfigPath(filepath = '') {
  const resolvedPath = path.resolve(filepath);

  if (!fs.existsSync(resolvedPath)) {
    console.error('Provided config path does not exist');
    process.exit(1); // eslint-disable-line unicorn/no-process-exit
  }

  if (!fs.statSync(resolvedPath).isFile()) {
    console.error('Provided config path must point to a file');
    process.exit(1); // eslint-disable-line unicorn/no-process-exit
  }

  return resolvedPath;
}
