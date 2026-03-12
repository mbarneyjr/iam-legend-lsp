import { describe, it } from 'node:test';
import assert from 'node:assert';
import { match } from '../../src/domain/utility/index.ts';

describe("[match]", () => {
  it("should match same values", () => {
    assert.strictEqual(match("abc", "abc"), true);
  });

  it("should not match different values", () => {
    assert.strictEqual(match("abc", "def"), false);
  });

  it("should not match if substring", () => {
    assert.strictEqual(match("abc", "abcdef"), false);
    assert.strictEqual(match("abc", "defabc"), false);
  });

  it("should respect * wildcard at start", () => {
    assert.strictEqual(match("*def", "abcdef"), true);
  });

  it("should respect * wildcard at end", () => {
    assert.strictEqual(match("abc*", "abcdef"), true);
  });

  it("should respect * wildcard in the middle", () => {
    assert.strictEqual(match("ab*ef", "abcdef"), true);
  });

  it("should respect multiple * wildcards", () => {
    assert.strictEqual(match("a*c*ef", "abcdef"), true);
  });

  it("should be case insensitive", () => {
    assert.strictEqual(match("ABC", "abc"), true);
  });
});
