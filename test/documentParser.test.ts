import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  getActionOffset,
  getActionRange,
  getArnWordAtPosition,
  getFullWordAtPosition,
  getWordAtPosition,
  isInsideActionsArray,
  isInsideResourceArray,
} from '../src/documentParser.ts';

const createDoc = (content: string) =>
  TextDocument.create('file:///test.yaml', 'yaml', 1, content);

describe('[documentParser]', () => {
  describe('[getActionOffset]', () => {
    it('should return offset after colon', () => {
      const result = getActionOffset('s3:GetObject', { start: { line: 0, character: 4 }, end: { line: 0, character: 16 } });
      assert.strictEqual(result, 7); // colon at index 2, +1 = 3, + start char 4 = 7
    });

    it('should return 0 when no colon', () => {
      const result = getActionOffset('s3', { start: { line: 0, character: 4 }, end: { line: 0, character: 6 } });
      assert.strictEqual(result, 0);
    });
  });

  describe('[getActionRange]', () => {
    it('should create range from actionOffset to position', () => {
      const range = getActionRange({ line: 5, character: 20 }, 10);
      assert.deepStrictEqual(range, {
        start: { line: 5, character: 10 },
        end: { line: 5, character: 20 }
      });
    });
  });

  describe('[getFullWordAtPosition]', () => {
    it('should return word containing colons and hyphens', () => {
      const doc = createDoc('  - s3:GetObject');
      const { word, range } = getFullWordAtPosition(doc, { line: 0, character: 8 });
      assert.strictEqual(word, 's3:GetObject');
      assert.ok(range !== undefined);
      assert.strictEqual(range!.start.character, 4);
      assert.strictEqual(range!.end.character, 16);
    });

    it('should return undefined for empty position', () => {
      const doc = createDoc('   ');
      const { word, range } = getFullWordAtPosition(doc, { line: 0, character: 1 });
      assert.strictEqual(word, undefined);
      assert.strictEqual(range, undefined);
    });
  });

  describe('[getWordAtPosition]', () => {
    it('should return word without colons', () => {
      const doc = createDoc('  - s3:GetObject');
      const { word } = getWordAtPosition(doc, { line: 0, character: 3 });
      // position 3 is '-', no word match
      assert.strictEqual(word, undefined);
    });

    it('should return alphanumeric word', () => {
      const doc = createDoc('  - s3:GetObject');
      const { word } = getWordAtPosition(doc, { line: 0, character: 5 });
      assert.strictEqual(word, 's3');
    });
  });

  describe('[isInsideActionsArray]', () => {
    it('should return true when on the actions line', () => {
      const doc = createDoc('actions: ["s3:GetObject"]');
      assert.strictEqual(isInsideActionsArray(doc, { line: 0, character: 12 }), true);
    });

    it('should return true for Action (capital A) with = delimiter', () => {
      const doc = createDoc('Actions = ["s3:GetObject"]');
      assert.strictEqual(isInsideActionsArray(doc, { line: 0, character: 14 }), true);
    });

    it('should return true for notActions', () => {
      const doc = createDoc('notActions: ["s3:GetObject"]');
      assert.strictEqual(isInsideActionsArray(doc, { line: 0, character: 16 }), true);
    });

    it('should return true when on a subsequent array line', () => {
      const doc = createDoc('actions:\n  - s3:GetObject\n  - s3:PutObject');
      assert.strictEqual(isInsideActionsArray(doc, { line: 2, character: 6 }), true);
    });

    it('should return false when outside actions array', () => {
      const doc = createDoc('resources:\n  - arn:aws:s3:::bucket');
      assert.strictEqual(isInsideActionsArray(doc, { line: 1, character: 6 }), false);
    });

    it('should return true for JSON-style "Action" field', () => {
      const doc = createDoc('"Action": [\n  "s3:GetObject"\n]');
      assert.strictEqual(isInsideActionsArray(doc, { line: 1, character: 4 }), true);
    });

    it('should return true when preceded by a comment line', () => {
      const doc = createDoc('actions:\n  - s3:GetObject\n  # todo\n  - s3:PutObject');
      assert.strictEqual(isInsideActionsArray(doc, { line: 3, character: 6 }), true);
    });

    it('should return false at line 0 with non-action content', () => {
      const doc = createDoc('something: else');
      assert.strictEqual(isInsideActionsArray(doc, { line: 0, character: 5 }), false);
    });
  });

  describe('[isInsideResourceArray]', () => {
    it('should return true when on the Resource line', () => {
      const doc = createDoc('Resource: ["arn:aws:s3:::bucket"]');
      assert.strictEqual(isInsideResourceArray(doc, { line: 0, character: 14 }), true);
    });

    it('should return true for NotResource', () => {
      const doc = createDoc('NotResource: ["arn:aws:s3:::bucket"]');
      assert.strictEqual(isInsideResourceArray(doc, { line: 0, character: 18 }), true);
    });

    it('should return true when on a subsequent array line', () => {
      const doc = createDoc('Resource:\n  - arn:aws:s3:::bucket\n  - arn:aws:s3:::other');
      assert.strictEqual(isInsideResourceArray(doc, { line: 2, character: 6 }), true);
    });

    it('should return false when inside actions array', () => {
      const doc = createDoc('actions:\n  - s3:GetObject');
      assert.strictEqual(isInsideResourceArray(doc, { line: 1, character: 6 }), false);
    });

    it('should return true for JSON-style "Resource" field', () => {
      const doc = createDoc('"Resource": [\n  "arn:aws:s3:::bucket"\n]');
      assert.strictEqual(isInsideResourceArray(doc, { line: 1, character: 4 }), true);
    });

    it('should return true with = delimiter (Terraform)', () => {
      const doc = createDoc('resources = ["arn:aws:s3:::bucket"]');
      assert.strictEqual(isInsideResourceArray(doc, { line: 0, character: 16 }), true);
    });

    it('should return true when preceded by a comment line', () => {
      const doc = createDoc('Resource:\n  - arn:aws:s3:::bucket\n  # todo\n  - arn:aws:s3:::other');
      assert.strictEqual(isInsideResourceArray(doc, { line: 3, character: 6 }), true);
    });

    it('should return true when preceded by multiple comment lines', () => {
      const doc = createDoc('Resource:\n  - arn:aws:s3:::bucket\n  # line1\n  # line2\n  - arn:aws:s3:::other');
      assert.strictEqual(isInsideResourceArray(doc, { line: 4, character: 6 }), true);
    });

    it('should return false for non-resource field', () => {
      const doc = createDoc('Effect: Allow');
      assert.strictEqual(isInsideResourceArray(doc, { line: 0, character: 10 }), false);
    });
  });

  describe('[getArnWordAtPosition]', () => {
    it('should return full ARN including colons and slashes', () => {
      const doc = createDoc('  - arn:aws:s3:::my-bucket/key');
      const { word } = getArnWordAtPosition(doc, { line: 0, character: 15 });
      assert.strictEqual(word, 'arn:aws:s3:::my-bucket/key');
    });

    it('should return ARN with wildcard', () => {
      const doc = createDoc('  - arn:aws:s3:::*');
      const { word } = getArnWordAtPosition(doc, { line: 0, character: 10 });
      assert.strictEqual(word, 'arn:aws:s3:::*');
    });

    it('should return undefined for empty position', () => {
      const doc = createDoc('   ');
      const { word } = getArnWordAtPosition(doc, { line: 0, character: 1 });
      assert.strictEqual(word, undefined);
    });
  });
});
