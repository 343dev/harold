import fs from 'node:fs';

export default function writeSnapshotFile(snapshot, filename) {
  return new Promise((resolve, reject) => {
    if (!filename) {
      const currentDate = new Date();
      const date = currentDate.toISOString()
        .slice(0, 10).replaceAll(/\D/g, '');
      const time = currentDate.toISOString()
        .slice(11, 19).replaceAll(/\D/g, '');

      filename = `harold_snapshot_${date}_${time}.json`;
    }

    const output = JSON.stringify(snapshot, undefined, '  ');

    fs.writeFile(filename, output, error => {
      if (error) reject(error);

      resolve(`${filename} has been saved`);
    });
  });
}
