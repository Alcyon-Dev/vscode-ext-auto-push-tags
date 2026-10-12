import * as vscode from 'vscode';
import { API as GitApi, GitExtension, Repository } from './types/git';
import { TagWatcher } from './watcher';

const watchers = new Map<string, TagWatcher>();

export function activate(context: vscode.ExtensionContext) {
    const log = vscode.window.createOutputChannel('Auto Push Tags', { log: true });
    context.subscriptions.push(log);

    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
    if (!gitExtension) {
        log.error('Git extension not found');
        return;
    }

    let started = false;
    const start = () => {
        if (started || !gitExtension.enabled) {
            return;
        }
        started = true;
        watchRepositories(context, gitExtension.getAPI(1), log);
    };

    context.subscriptions.push(gitExtension.onDidChangeEnablement(start));
    start();
}

function watchRepositories(context: vscode.ExtensionContext, gitApi: GitApi, log: vscode.LogOutputChannel) {
    const open = (repository: Repository) => {
        const key = repository.rootUri.toString();
        if (!watchers.has(key)) {
            log.info(`Watching ${repository.rootUri.fsPath}`);
            watchers.set(key, new TagWatcher(gitApi, repository, log));
        }
    };

    const close = (repository: Repository) => {
        const key = repository.rootUri.toString();
        watchers.get(key)?.dispose();
        watchers.delete(key);
        log.info(`Stopped watching ${repository.rootUri.fsPath}`);
    };

    gitApi.repositories.forEach(open);
    context.subscriptions.push(gitApi.onDidOpenRepository(open));
    context.subscriptions.push(gitApi.onDidCloseRepository(close));
}

export function deactivate() {
    watchers.forEach(watcher => watcher.dispose());
    watchers.clear();
}
