import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Range,
} from "vscode-languageserver";
import {
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  TextEdit,
} from "vscode-languageserver";
import type { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createActionDocs, createResourceTypeDocs, createServiceDocs } from "./documentation.ts";
import { getActionOffset, getActionRange, getArnWordAtPosition, getFullWordAtPosition, getWordAtPosition } from "./documentParser.ts";
import type { IamService, IamServicesByPrefix } from "./domain/index.ts";
import { isInsideActionsArray, isInsideResourceArray } from "./documentParser.ts";
import { getServiceFromServiceAction } from "./domain/utility/index.ts";

const getActionSuggestions = (services: IamService[], range: Range): CompletionList => {
  const suggestions: CompletionItem[] = services.map(x => x.actions.map(action => ({
    label: action.name,
    kind: CompletionItemKind.Field,
    documentation: {
      kind: MarkupKind.Markdown,
      value: createActionDocs(action)
    },
    detail: x.serviceName,
    textEdit: TextEdit.replace(range, action.name),
  }))).flat();

  return { items: suggestions, isIncomplete: true };
};

const getServiceSuggestions = (matchedWord: string | undefined, servicesByPrefix: IamServicesByPrefix, range: Range): CompletionList => {
  const labelPrefix = matchedWord?.startsWith('"')
    ? '"' : matchedWord?.startsWith(`'`)
      ? `'` : '';

  const labelSuffix = matchedWord?.endsWith('"')
    ? '"' : matchedWord?.endsWith(`'`)
      ? `'` : '';

  const suggestions: CompletionItem[] = Object.values(servicesByPrefix).map(service => service.map(x => ({
    label: `${labelPrefix}${x.servicePrefix}`,
    filterText: `${labelPrefix}${x.servicePrefix}${labelSuffix}`,
    kind: CompletionItemKind.Module,
    documentation: {
      kind: MarkupKind.Markdown,
      value: createServiceDocs(x)
    },
    detail: x.serviceName,
    textEdit: TextEdit.replace(range, `${labelPrefix}${x.servicePrefix}`),
  }))).flat();

  if (suggestions.length > 0) {
    suggestions[0].preselect = true;
  }

  return { items: suggestions, isIncomplete: true };
};

const AWS_PARTITIONS = ['aws', 'aws-cn', 'aws-us-gov'];

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1',
  'ap-east-1', 'ap-south-1', 'ap-south-2', 'ap-southeast-1', 'ap-southeast-2',
  'ap-southeast-3', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ca-central-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-south-1', 'eu-south-2', 'eu-north-1',
  'me-south-1', 'me-central-1',
  'sa-east-1',
];

const suffixToSnippet = (suffix: string) => {
  let index = 0;
  return suffix.replace(/\$\{([^}]+)\}/g, (_, name) => `\${${++index}:${name}}`);
};

const getSegmentRange = (word: string | undefined, fullRange: Range | undefined, position: { line: number; character: number }): Range => {
  const lastColon = word ? word.lastIndexOf(':') : -1;
  const rangeStart = fullRange?.start.character ?? position.character;
  const segmentStart = lastColon >= 0 ? rangeStart + lastColon + 1 : rangeStart;
  return {
    start: { line: position.line, character: segmentStart },
    end: { line: position.line, character: position.character }
  };
};

const getCurrentSegment = (word: string | undefined) => {
  if (!word) return '';
  const lastColon = word.lastIndexOf(':');
  return lastColon >= 0 ? word.slice(lastColon + 1) : word;
};

const getResourceSuggestions = (
  servicesByPrefix: IamServicesByPrefix,
  word: string | undefined,
  fullRange: Range | undefined,
  position: { line: number; character: number }
): CompletionList => {
  const colonCount = word ? word.split(':').length - 1 : 0;
  const segments = word ? word.split(':') : [];
  const range = getSegmentRange(word, fullRange, position);
  const typed = getCurrentSegment(word);

  // Segment 1: partition (after "arn:")
  if (colonCount === 1) {
    const items: CompletionItem[] = AWS_PARTITIONS
      .filter(p => p.startsWith(typed.toLowerCase()))
      .map(p => ({
        label: p,
        kind: CompletionItemKind.EnumMember,
        detail: 'AWS Partition',
        textEdit: TextEdit.replace(range, p),
      }));
    return { items, isIncomplete: false };
  }

  // Segment 2: service prefix (after "arn:partition:")
  if (colonCount === 2) {
    const items: CompletionItem[] = [];
    for (const services of Object.values(servicesByPrefix)) {
      for (const service of services) {
        if (typed && !service.servicePrefix.startsWith(typed.toLowerCase())) continue;
        items.push({
          label: service.servicePrefix,
          kind: CompletionItemKind.Module,
          detail: service.serviceName,
          documentation: {
            kind: MarkupKind.Markdown,
            value: createServiceDocs(service)
          },
          textEdit: TextEdit.replace(range, service.servicePrefix),
        });
      }
    }
    return { items, isIncomplete: true };
  }

  // Segment 3: region (after "arn:partition:service:")
  if (colonCount === 3) {
    const items: CompletionItem[] = AWS_REGIONS
      .filter(r => r.startsWith(typed.toLowerCase()))
      .map(r => ({
        label: r,
        kind: CompletionItemKind.EnumMember,
        detail: 'AWS Region',
        textEdit: TextEdit.replace(range, r),
      }));
    return { items, isIncomplete: false };
  }

  // Segment 4: account ID (after "arn:partition:service:region:")
  if (colonCount === 4) {
    const items: CompletionItem[] = [
      {
        label: 'AccountId',
        kind: CompletionItemKind.Value,
        detail: 'AWS Account ID (12 digits)',
        textEdit: TextEdit.replace(range, 'AccountId'),
      },
    ];
    return { items, isIncomplete: false };
  }

  // Segment 5+: resource type suffixes
  if (colonCount >= 5) {
    const servicePrefix = segments[2];
    const services = servicesByPrefix[servicePrefix];
    if (!services) return { items: [], isIncomplete: false };

    const items: CompletionItem[] = [];
    for (const service of services) {
      if (!service.resourceTypes) continue;
      for (const rt of service.resourceTypes) {
        // Extract the resource suffix — everything after the 5th colon in the template ARN
        const templateParts = rt.arn.split(':');
        const suffix = templateParts.slice(5).join(':');
        if (typed && !suffix.toLowerCase().startsWith(typed.toLowerCase())) continue;
        items.push({
          label: suffix || rt.name,
          kind: CompletionItemKind.Value,
          detail: `${service.serviceName} - ${rt.name}`,
          documentation: {
            kind: MarkupKind.Markdown,
            value: createResourceTypeDocs(rt)
          },
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: TextEdit.replace(range, suffixToSnippet(suffix)),
          filterText: suffix,
        });
      }
    }
    return { items, isIncomplete: true };
  }

  return { items: [], isIncomplete: false };
};

export const handleCompletion = (
  params: CompletionParams,
  documents: TextDocuments<TextDocument>,
  servicesByPrefix: IamServicesByPrefix
): CompletionList => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return { items: [], isIncomplete: false };
  }

  const position = params.position;

  if (isInsideActionsArray(document, position)) {
    const { range, word } = getFullWordAtPosition(document, position);
    if (range && word) {
      const serviceWord = getServiceFromServiceAction(word);

      const services = serviceWord && servicesByPrefix[serviceWord];
      if (services) {
        const actionOffset = getActionOffset(word, range);
        const actionRange = getActionRange(position, actionOffset);
        return getActionSuggestions(services, actionRange);
      }
    }

    const { word: serviceWord, range: serviceWordRange } = getWordAtPosition(document, position);

    const serviceRange: Range = {
      start: { line: position.line, character: serviceWordRange?.start.character ?? position.character },
      end: { line: position.line, character: position.character }
    };
    return getServiceSuggestions(serviceWord, servicesByPrefix, serviceRange);
  }

  if (isInsideResourceArray(document, position)) {
    const { range, word } = getArnWordAtPosition(document, position);
    return getResourceSuggestions(servicesByPrefix, word, range, position);
  }

  return { items: [], isIncomplete: false };
};
