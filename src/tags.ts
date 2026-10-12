// Pure helpers, kept free of the vscode module so they can be unit tested.

// More new tags than this in one state change is assumed to come from a fetch or pull.
export const MAX_NEW_TAGS = 3;

export function findNewTags(baseline: Set<string>, current: Set<string>): string[] {
    const added = [...current].filter(tag => !baseline.has(tag));
    return added.length <= MAX_NEW_TAGS ? added : [];
}

export function pickRemote(upstreamRemote: string | undefined, remotes: string[]): string | undefined {
    if (upstreamRemote && remotes.includes(upstreamRemote)) {
        return upstreamRemote;
    }
    if (remotes.includes('origin')) {
        return 'origin';
    }
    return remotes[0];
}
