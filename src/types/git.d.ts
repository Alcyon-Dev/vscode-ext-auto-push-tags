/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Subset of the vscode.git extension API used by this extension.

import { Event, Uri } from 'vscode';

export interface Git {
    readonly path: string;
}

export const enum RefType {
    Head,
    RemoteHead,
    Tag
}

export interface Ref {
    readonly type: RefType;
    readonly name?: string;
    readonly commit?: string;
    readonly remote?: string;
}

export interface UpstreamRef {
    readonly remote: string;
    readonly name: string;
}

export interface Branch extends Ref {
    readonly upstream?: UpstreamRef;
    readonly ahead?: number;
    readonly behind?: number;
}

export interface Remote {
    readonly name: string;
    readonly fetchUrl?: string;
    readonly pushUrl?: string;
    readonly isReadOnly: boolean;
}

export interface RefQuery {
    readonly contains?: string;
    readonly count?: number;
    readonly pattern?: string;
    readonly sort?: 'alphabetically' | 'committerdate';
}

export interface RepositoryState {
    readonly HEAD: Branch | undefined;
    readonly refs: Ref[];
    readonly remotes: Remote[];

    readonly onDidChange: Event<void>;
}

export interface Repository {
    readonly rootUri: Uri;
    readonly state: RepositoryState;

    /** Not available in older VS Code versions. */
    getRefs?(query: RefQuery): Promise<Ref[]>;
}

export interface API {
    readonly git: Git;
    readonly repositories: Repository[];
    readonly onDidOpenRepository: Event<Repository>;
    readonly onDidCloseRepository: Event<Repository>;
}

export interface GitExtension {
    readonly enabled: boolean;
    readonly onDidChangeEnablement: Event<boolean>;

    getAPI(version: 1): API;
}
