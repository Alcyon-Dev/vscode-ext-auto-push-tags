import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { API as GitApi, RefType, Repository } from './types/git';
import { findNewTags, pickRemote } from './tags';

type Mode = 'ask' | 'always' | 'never';

const ACTION_PUSH = 'Push';
const ACTION_ALWAYS = 'Always push';
const ACTION_NEVER = 'Never ask';

const LS_REMOTE_TIMEOUT_MS = 30_000;
const PUSH_TIMEOUT_MS = 120_000;

class GitError extends Error {
    constructor(message: string, readonly stderr: string) {
        super(message);
    }
}

function getMode(): Mode {
    return vscode.workspace.getConfiguration('autoPushTags').get<Mode>('mode', 'ask');
}

async function setMode(mode: Mode): Promise<void> {
    await vscode.workspace.getConfiguration('autoPushTags').update('mode', mode, vscode.ConfigurationTarget.Global);
}

export class TagWatcher implements vscode.Disposable {

    private baseline: Set<string> | undefined;
    private queue: Promise<void> = Promise.resolve();
    private checkQueued = false;
    private disposed = false;
    private readonly subscription: vscode.Disposable;

    constructor(
        private readonly gitApi: GitApi,
        private readonly repository: Repository,
        private readonly log: vscode.LogOutputChannel,
    ) {
        this.subscription = repository.state.onDidChange(() => this.scheduleCheck());
        this.scheduleCheck();
    }

    dispose(): void {
        this.disposed = true;
        this.subscription.dispose();
    }

    private get repoPath(): string {
        return this.repository.rootUri.fsPath;
    }

    private get repoName(): string {
        return path.basename(this.repoPath);
    }

    // Checks run one at a time; bursts of state changes collapse into a single pending check.
    private scheduleCheck(): void {
        if (this.checkQueued) {
            return;
        }
        this.checkQueued = true;
        this.queue = this.queue
            .then(() => {
                this.checkQueued = false;
                return this.check();
            })
            .catch(err => this.log.error(`[${this.repoName}] Tag check failed: ${err?.message ?? err}`));
    }

    private async check(): Promise<void> {
        if (this.disposed) {
            return;
        }

        // Wait until Git has reported the repository state, so existing tags never look new.
        if (!this.baseline) {
            const state = this.repository.state;
            if (!state.HEAD && state.refs.length === 0) {
                return;
            }
            this.baseline = await this.readTags();
            this.log.info(`[${this.repoName}] Baseline: ${this.baseline.size} tag(s)`);
            return;
        }

        const current = await this.readTags();
        const added = [...current].filter(tag => !this.baseline!.has(tag));
        const newTags = findNewTags(this.baseline, current);
        this.baseline = current;

        if (added.length > newTags.length) {
            this.log.info(`[${this.repoName}] Ignoring ${added.length} new tags (probably fetched)`);
        }

        for (const tag of newTags) {
            // Not awaited: an open prompt must not block later checks.
            this.handleNewTag(tag).catch(err => this.log.error(`[${this.repoName}] ${tag}: ${err?.message ?? err}`));
        }
    }

    private async readTags(): Promise<Set<string>> {
        const refs = this.repository.getRefs
            ? await this.repository.getRefs({ pattern: 'refs/tags' })
            : this.repository.state.refs;

        return new Set(refs
            .filter(ref => ref.type === RefType.Tag && !!ref.name)
            .map(ref => ref.name!));
    }

    private async handleNewTag(tag: string): Promise<void> {
        this.log.info(`[${this.repoName}] New tag: ${tag}`);

        if (getMode() === 'never') {
            return;
        }

        const state = this.repository.state;
        const remote = pickRemote(state.HEAD?.upstream?.remote, state.remotes.map(r => r.name));
        if (!remote) {
            this.log.info(`[${this.repoName}] No remote, skipping ${tag}`);
            return;
        }

        if (await this.existsOnRemote(remote, tag)) {
            this.log.info(`[${this.repoName}] ${tag} already on ${remote}, skipping`);
            return;
        }

        // Re-read the mode: it may have changed while ls-remote ran or another prompt was open.
        const mode = getMode();
        if (mode === 'never') {
            return;
        }
        if (mode === 'always') {
            await this.push(remote, tag);
            return;
        }

        const where = this.gitApi.repositories.length > 1 ? ` in ${this.repoName}` : '';
        const action = await vscode.window.showInformationMessage(
            `Tag "${tag}" was created${where}. Push it to ${remote}?`,
            ACTION_PUSH, ACTION_ALWAYS, ACTION_NEVER,
        );

        switch (action) {
            case ACTION_PUSH:
                await this.push(remote, tag);
                break;
            case ACTION_ALWAYS:
                await setMode('always');
                await this.push(remote, tag);
                break;
            case ACTION_NEVER:
                await setMode('never');
                break;
        }
    }

    private async existsOnRemote(remote: string, tag: string): Promise<boolean> {
        try {
            const out = await this.git(['ls-remote', '--tags', remote, `refs/tags/${tag}`], LS_REMOTE_TIMEOUT_MS);
            return out.trim().length > 0;
        } catch (err: any) {
            // Remote unreachable: still offer the push, which will report the real error.
            this.log.warn(`[${this.repoName}] ls-remote ${remote} failed: ${err.stderr || err.message}`);
            return false;
        }
    }

    private async push(remote: string, tag: string): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Pushing tag ${tag} to ${remote}...`,
            }, () => this.git(['push', remote, `refs/tags/${tag}`], PUSH_TIMEOUT_MS));
        } catch (err: any) {
            this.log.error(`[${this.repoName}] Push of ${tag} to ${remote} failed: ${err.stderr || err.message}`);
            vscode.window.showErrorMessage(`Failed to push tag ${tag} to ${remote}: ${(err.stderr || err.message).trim()}`);
            return;
        }
        this.log.info(`[${this.repoName}] Pushed ${tag} to ${remote}`);
        vscode.window.setStatusBarMessage(`Tag ${tag} pushed to ${remote}`, 5000);
    }

    // Always an argument array through execFile, never a shell string, so paths and names
    // with spaces or special characters work the same on every OS.
    private git(args: string[], timeout: number): Promise<string> {
        return new Promise((resolve, reject) => {
            execFile(this.gitApi.git.path, args, {
                cwd: this.repoPath,
                timeout,
                // No terminal to answer credential prompts: fail instead of hanging.
                env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            }, (err, stdout, stderr) => {
                if (err) {
                    reject(new GitError(err.message, String(stderr)));
                } else {
                    resolve(String(stdout));
                }
            });
        });
    }
}
