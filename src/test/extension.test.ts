import * as assert from 'assert';
import { findNewTags, pickRemote } from '../tags';

suite('Extension Test Suite', () => {

	test('findNewTags returns tags missing from the baseline', () => {
		assert.deepStrictEqual(findNewTags(new Set(['v1.0.0']), new Set(['v1.0.0', 'v1.1.0'])), ['v1.1.0']);
		assert.deepStrictEqual(findNewTags(new Set(['v1.0.0']), new Set(['v1.0.0'])), []);
		assert.deepStrictEqual(findNewTags(new Set(['v1.0.0']), new Set()), []);
	});

	test('findNewTags ignores more than 3 new tags (fetch)', () => {
		assert.deepStrictEqual(findNewTags(new Set(), new Set(['a', 'b', 'c'])), ['a', 'b', 'c']);
		assert.deepStrictEqual(findNewTags(new Set(), new Set(['a', 'b', 'c', 'd'])), []);
	});

	test('pickRemote prefers upstream, then origin, then first remote', () => {
		assert.strictEqual(pickRemote('upstream', ['origin', 'upstream']), 'upstream');
		assert.strictEqual(pickRemote(undefined, ['fork', 'origin']), 'origin');
		assert.strictEqual(pickRemote('.', ['fork', 'origin']), 'origin');
		assert.strictEqual(pickRemote(undefined, ['fork', 'other']), 'fork');
		assert.strictEqual(pickRemote('origin', []), undefined);
	});
});
