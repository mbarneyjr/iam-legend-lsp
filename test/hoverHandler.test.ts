import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TextDocuments } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { handleHover } from '../src/hoverHandler.ts';
import type { IamServicesByPrefix } from '../src/domain/index.ts';

const makeServicesByPrefix = (): IamServicesByPrefix => ({
  s3: [{
    serviceName: 'Amazon S3',
    servicePrefix: 's3',
    url: 'https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazons3.html',
    actions: [
      {
        name: 'GetObject',
        description: 'Grants permission to retrieve objects from Amazon S3.',
        resourceTypes: ['object'],
        conditionKeys: [],
        dependentActions: [],
        documentationUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html'
      },
      {
        name: 'PutObject',
        description: 'Grants permission to add an object to a bucket.',
        resourceTypes: ['object'],
        conditionKeys: [],
        dependentActions: [],
        documentationUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html'
      }
    ],
    resourceTypes: [
      { name: 'bucket', arn: 'arn:aws:s3:::${BucketName}', conditionKeys: [] },
      { name: 'object', arn: 'arn:aws:s3:::${BucketName}/${ObjectKey}', conditionKeys: ['s3:ResourceAccount'] }
    ]
  }]
});

const createDocuments = (doc: TextDocument) => {
  const map = new Map<string, TextDocument>();
  map.set(doc.uri, doc);
  return { get: (uri: string) => map.get(uri) } as TextDocuments<TextDocument>;
};

describe('[hoverHandler]', () => {
  it('should return null when not inside actions array', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'resources:\n  - s3:GetObject');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 8 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result, null);
  });

  it('should return null for unknown document', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - s3:GetObject');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: 'file:///unknown.yaml' }, position: { line: 1, character: 8 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result, null);
  });

  it('should return action documentation when hovering over an action', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - s3:GetObject');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 12 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result !== null);
    const contents = result!.contents as { kind: string; value: string };
    assert.ok(contents.value.includes('GetObject'));
    assert.ok(contents.value.includes('Amazon S3'));
  });

  it('should return service documentation when hovering over service prefix', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - s3:GetObject');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 5 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result !== null);
    const contents2 = result!.contents as { kind: string; value: string };
    assert.ok(contents2.value.includes('Amazon S3'));
    assert.ok(contents2.value.includes('IAM Reference'));
  });

  it('should support wildcard pattern matching', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - s3:Get*');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 8 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result !== null);
    const contents3 = result!.contents as { kind: string; value: string };
    assert.ok(contents3.value.includes('GetObject'));
  });

  it('should return null for unknown service', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - unknown:Foo');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 10 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result, null);
  });

  it('should return resource type docs when hovering ARN inside Resource array', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:s3:::my-bucket');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 10 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result !== null);
    const contents = result!.contents as { kind: string; value: string };
    assert.ok(contents.value.includes('bucket'));
    assert.ok(contents.value.includes('Amazon S3'));
  });

  it('should return null for unknown service in Resource array', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:unknown:::foo');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 10 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result, null);
  });

  it('should return resource hover after a comment line', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1,
      'Resource:\n  - arn:aws:s3:::bucket1\n  # todo\n  - arn:aws:s3:::bucket2');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 3, character: 10 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result !== null);
    const contents = result!.contents as { kind: string; value: string };
    assert.ok(contents.value.includes('bucket'));
  });

  it('should return null when hovering non-ARN text in Resource array', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - "*"');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 5 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result, null);
  });

  it('should include condition keys in resource hover docs', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1,
      'Resource:\n  - arn:aws:s3:::my-bucket/my-key');
    const documents = createDocuments(doc);

    const result = handleHover(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 15 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result !== null);
    const contents = result!.contents as { kind: string; value: string };
    assert.ok(contents.value.includes('s3:ResourceAccount'));
  });
});
