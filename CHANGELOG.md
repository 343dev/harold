# Changelog

## 4.0.0 (22.02.2024)

Improvements:

- moved primary settings to configuration file;
- added `--config` option to specify the path to the configuration file.

Breaking changes:

- drop support for Node.js 16;
- updated the list of file categories for comparison.

See [MIGRATION.md](./MIGRATION.md) for more info.


## 3.0.0 (29.08.2023)

This package now pure ESM.

Drop support for Node.js 14.


## 2.0.2 (10.06.2021)

Fixed several security vulnerabilities:

- [Regular Expression Denial of Service](https://github.com/advisories/GHSA-43f8-2h32-f4cj) in [hosted-git-info](https://github.com/npm/hosted-git-info). Updated from 2.8.8 to 2.8.9.

- [Command Injection](https://github.com/advisories/GHSA-35jh-r3h4-6jhm) in [lodash](https://github.com/lodash/lodash). Updated from 4.17.20 to 4.17.21.


## 2.0.1 (07.04.2021)

Fixed paths duplication in snapshot.


## 2.0.0 (22.03.2021)

Fixed crash when Harold runs in a directory without `package.json` file.

Suppressed stderr output when Harold runs in a directory without initialized
Git repository.

Replaced absolute paths with relative in the snapshot.

Added trailing slash to directories paths in the snapshot.
See [MIGRATION.md](./MIGRATION.md).


## 1.0.3 (19.03.2021)

Fixed trailing slash processing when `--path` is used.

More info: [#7](https://github.com/funbox/harold/issues/7).


## 1.0.2 (31.12.2020)

Fixed “Diff by category” result color. Difference in Gzip size now also affects
color, but difference in files number does not.


## 1.0.1 (19.11.2020)

Improved error output when project build fails.


## 1.0.0 (12.11.2020)

First major release.

Added `--output` option for `snapshot` command.

Improved documentation. Added LICENSE. Prepared the package to publish on GitHub.


## 0.2.0 (30.10.2020)

Renamed the package: Buildo → Harold.


## 0.1.0 (19.10.2020)

Init version.
