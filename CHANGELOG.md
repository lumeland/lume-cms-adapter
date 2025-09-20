# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - Unreleased
### Changed
- BREAKING: Adapted to LumeCMS 0.13

## [0.2.2] - 2025-04-05
### Fixed
- Use `setEnv` Lume util instead of `Deno.env`.
- Set `LUME_CMS` environment variable.
- Updated deps

## [0.2.1] - 2025-03-19
### Fixed
- TypeError on restart the server.
- Inherit stdout and stderr if `--show-terminal` is disabled.

## [0.2.0] - 2025-03-16
### Added
- Improved cold start with more feedback.
- New option `--show-terminal` to display the terminal output at the cold starts.

## [0.1.3] - 2025-01-16
### Fixed
- Remove console.log created previously for debugging.

## [0.1.2] - 2025-01-16
### Added
- Allow to pass flags to configure the server and LumeCMS.

## [0.1.1] - 2025-01-16
### Fixed
- Multiple servers under the same port.

## [0.1.0] - 2025-01-16
First version

[0.3.0]: https://github.com/oscarotero/cms-lume-adapter/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/oscarotero/cms-lume-adapter/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/oscarotero/cms-lume-adapter/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/oscarotero/cms-lume-adapter/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/oscarotero/cms-lume-adapter/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/oscarotero/cms-lume-adapter/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/oscarotero/cms-lume-adapter/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/oscarotero/cms-lume-adapter/releases/tag/v0.1.0
