<a href="https://alcyon.dev" target="_blank">![Alcyon Technologies](https://img.shields.io/badge/Alcyon-Technologies-grey?style=plastic&labelColor=orange)</a>
![Open Source](https://img.shields.io/badge/Open-Source-grey?style=plastic&labelColor=limegreen)
![Visual Studio Code](https://img.shields.io/badge/VSCode-Extension-grey?style=plastic&labelColor=0078D4)

![GitHub License](https://img.shields.io/github/license/alcyon-dev/vscode-ext-auto-push-tags?style=plastic&label=License)

# Auto Push Tags

This extension asks whether to push a Git tag to the remote right after you
create it, so you don't forget to push it and leave the remote without the
release tag.

Creating a tag from `Source Control → Tags → Create Tag` only creates it
locally. With this extension, a notification pops up:

> Tag "v1.2.0" was created. Push it to origin?

- `Push` pushes only that tag (`git push origin refs/tags/v1.2.0`).
- `Always push` pushes it, and pushes later tags without asking.
- `Never ask` stops asking.

When more than one repository is open, the notification names the repository.

## Settings

- `autoPushTags.mode`: `ask` (default), `always` or `never`.

## How it works

The extension watches every repository opened by VS Code's Git extension and
reacts to any new local tag:

- Tags that exist when VS Code starts never prompt.
- More than 3 new tags at once is assumed to be a fetch or pull, and ignored.
- The tag is pushed to the current branch's upstream remote, otherwise
  `origin`, otherwise the first remote. Repositories without a remote are
  ignored.
- Tags already on the remote never prompt.

It runs where the repository lives (WSL, SSH, Dev Containers) and uses that
side's Git, SSH keys and credentials.

## Requirements

- VS Code 1.80 or later, with the built-in Git extension enabled.
- A Git credential helper or SSH agent for the remote: the push runs without a
  terminal, so Git can't prompt for a password.

## Known Issues

This is an alpha release, expect the unexpected ! Please open issues in this
GitHub repo and/or contribute a PR.

- The Git API doesn't say which command created a tag, so tags created in the
  terminal prompt too.
- Tags created while VS Code was closed never prompt.

## Release Notes

## 0.1.0

- Initial release
