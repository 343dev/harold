import fg from 'fast-glob';
import { gzipSizeFromFileSync } from 'gzip-size';

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectPackageJsonPath = path.resolve(process.cwd(), 'package.json');
const projectPackageJson = fs.existsSync(projectPackageJsonPath)
  ? JSON.parse(await fs.promises.readFile(projectPackageJsonPath))
  : {};

const FILTER_REGEXP = {
  CSS: /\.css$/,
  FONTS: /\.(woff|woff2|ttf|otf|eot)$/,
  IMAGES: /\.(png|jpg|jpeg|gif|svg|webp)$/,
  JS: /^((?!legacy).)*\.js$/,
  JS_LEGACY: /legacy.*\.js$/,
  VIDEOS: /\.(mp4|webm)$/,
};

export default function generateSnapshot(buildPath, buildTime) {
  if (!fs.statSync(buildPath).isDirectory()) {
    throw new Error(`'${buildPath}' is not a directory`);
  }

  const directoryPaths = [
    path.join(buildPath, '/'),
    ...fg.sync(`${buildPath}**/**/*`, {
      onlyDirectories: true,
      markDirectories: true,
    }),
  ];

  const directoriesWithFiles = getDirectoriesWithFiles(directoryPaths);

  const directoriesWithCssFiles = filterByRegexp(directoriesWithFiles, FILTER_REGEXP.CSS);
  const directoriesWithFontFiles = filterByRegexp(directoriesWithFiles, FILTER_REGEXP.FONTS);
  const directoriesWithImageFiles = filterByRegexp(directoriesWithFiles, FILTER_REGEXP.IMAGES);
  const directoriesWithJsFiles = filterByRegexp(directoriesWithFiles, FILTER_REGEXP.JS);
  const directoriesWithJsLegacyFiles = filterByRegexp(directoriesWithFiles, FILTER_REGEXP.JS_LEGACY);
  const directoriesWithVideoFiles = filterByRegexp(directoriesWithFiles, FILTER_REGEXP.VIDEOS);

  const total = {
    all: calculateTotal(directoriesWithFiles),
    css: calculateTotal(directoriesWithCssFiles),
    fonts: calculateTotal(directoriesWithFontFiles),
    images: calculateTotal(directoriesWithImageFiles),
    js: calculateTotal(directoriesWithJsFiles),
    jsLegacy: calculateTotal(directoriesWithJsLegacyFiles),
    videos: calculateTotal(directoriesWithVideoFiles),
  };

  total.other = calculateTotalOther(total);

  const currentGitReference = getCurrentGitReference();

  return {
    project: projectPackageJson.name || 'unknown',
    ...currentGitReference ? { gitRef: currentGitReference } : {},
    date: new Date().toISOString(),
    buildTime,
    total,
    fsEntries: flattenDirectories(directoriesWithFiles),
  };
}

function flattenDirectories(directories) {
  return directories.reduce((accumulator, directory) => {
    accumulator.push(
      {
        path: directory.path,
        size: directory.size,
        gzipSize: directory.gzipSize,
      },
      ...directory.files,
    );

    return accumulator;
  }, []);
}

function getCurrentGitReference() {
  try {
    const gitBranch = execSync(
      'git branch --show-current',
      { stdio: 'pipe' },
    );
    const currentBranch = gitBranch.toString().trim();

    if (currentBranch) return currentBranch;

    const gitRevParse = execSync('git rev-parse HEAD');

    return gitRevParse.toString().trim().slice(0, 6);
  } catch {
    return;
  }
}

function calculateTotalOther(total) {
  const categoriesTotal = Object.keys(total).reduce((accumulator, key) => {
    if (key === 'all') return accumulator;

    accumulator.files += total[key].files;
    accumulator.size += total[key].size;
    accumulator.gzipSize += total[key].gzipSize;

    return accumulator;
  }, { files: 0, size: 0, gzipSize: 0 });

  return {
    files: total.all.files - categoriesTotal.files,
    size: total.all.size - categoriesTotal.size,
    gzipSize: total.all.gzipSize - categoriesTotal.gzipSize,
  };
}

function calculateTotal(directories) {
  const init = { files: 0, size: 0, gzipSize: 0 };

  return directories.reduce((accumulator, directory) => ({
    ...accumulator,
    files: accumulator.files + directory.files.length,
    size: accumulator.size + directory.size,
    gzipSize: accumulator.gzipSize + directory.gzipSize,
  }), init);
}

function filterByRegexp(directories, regexp) {
  return directories
    .map(directory => {
      const files = directory.files.filter(file => regexp.test(file.path));

      return files.length > 0 ? generateDirectoryObject(directory.path, files) : undefined;
    })
    .filter(Boolean);
}

function getDirectoriesWithFiles(directories) {
  return directories.map(directory => {
    const directoryFiles = fg.sync(`${directory}*`, { stats: true })
      .map(file => ({
        path: file.path,
        size: file.stats.size,
        gzipSize: gzipSizeFromFileSync(file.path),
      }));

    return generateDirectoryObject(directory, directoryFiles);
  });
}

function generateDirectoryObject(directoryPath, files) {
  return {
    path: directoryPath,
    size: files.reduce((accumulator, file) => accumulator + file.size, 0),
    gzipSize: files.reduce((accumulator, file) => accumulator + file.gzipSize, 0),
    files,
  };
}
