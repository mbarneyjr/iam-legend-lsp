import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Range,
} from "vscode-languageserver";
import {
  CompletionItemKind,
  MarkupKind,
  TextEdit,
} from "vscode-languageserver";
import type { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createActionDocs, createServiceDocs } from "./documentation.ts";
import { getActionOffset, getActionRange, getFullWordAtPosition, getWordAtPosition } from "./documentParser.ts";
import type { IamService, IamServicesByPrefix } from "./domain/index.ts";
import { isInsideActionsArray } from "./documentParser.ts";
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

  if (!isInsideActionsArray(document, position)) {
    return { items: [], isIncomplete: false };
  }

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
};
