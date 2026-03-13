import type { Hover, HoverParams } from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver";
import type { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createServicesActionDocs, createServiceDocs, createResourceTypeDocs } from "./documentation.ts";
import { isInsideActionsArray, isInsideResourceArray } from "./documentParser.ts";
import { getArnWordAtPosition, getHoverWordAtPosition, getWordAtPosition } from "./documentParser.ts";
import type { IamServicesByPrefix } from "./domain/index.ts";
import { match, normalize } from "./domain/utility/index.ts";

const handleActionHover = (
  document: TextDocument,
  position: { line: number; character: number },
  iamServicesByPrefix: IamServicesByPrefix
): Hover | null => {
  const { range: wordRange, word: rawWord } = getHoverWordAtPosition(document, position);
  if (!wordRange || !rawWord) { return null; }

  const word = normalize(rawWord);

  let [serviceName, action] = word.split(':');
  if (!iamServicesByPrefix[serviceName]) {
    action = serviceName;
    const { word: prevWord } = getWordAtPosition(document, {
      line: position.line,
      character: wordRange.start.character - 2
    });
    serviceName = prevWord ? normalize(prevWord) : '';
  }

  const services = iamServicesByPrefix[serviceName];
  if (!services) {
    return null;
  }

  if (services && !action) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: services.map(x => createServiceDocs(x)).join('\n\n---\n\n')
      }
    };
  }

  if (word.includes(':') && position.character < wordRange.start.character + serviceName.length + 1) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: services.map(x => createServiceDocs(x)).join('\n\n---\n\n')
      }
    };
  }

  const serviceActions = services
    .map(x => ({ service: x, actions: x.actions.filter(a => match(action, a.name)) }))
    .filter(x => x.actions.length > 0);

  if (serviceActions.length === 0) { return null; }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: createServicesActionDocs(serviceActions)
    }
  };
};

const arnToPattern = (arn: string) =>
  arn.replace(/[-\/{}()[\]\\^$+?.]/g, '\\$&').replace(/\\\$\\\{[^}]+\\\}/g, '[^:]*').replace(/\*/g, '.*');

const handleResourceHover = (
  document: TextDocument,
  position: { line: number; character: number },
  iamServicesByPrefix: IamServicesByPrefix
): Hover | null => {
  const { word: rawWord } = getArnWordAtPosition(document, position);
  if (!rawWord) { return null; }

  const arnParts = rawWord.split(':');
  if (arnParts.length < 3) { return null; }

  const servicePrefix = arnParts[2];
  const services = iamServicesByPrefix[servicePrefix];
  if (!services) { return null; }

  const matchingDocs: string[] = [];
  for (const service of services) {
    if (!service.resourceTypes) continue;
    for (const rt of service.resourceTypes) {
      const pattern = new RegExp(`^${arnToPattern(rt.arn)}$`, 'i');
      if (pattern.test(rawWord) || rawWord.startsWith(rt.arn.split('$')[0])) {
        matchingDocs.push(`**${service.serviceName}**\n\n${createResourceTypeDocs(rt)}`);
      }
    }
  }

  if (matchingDocs.length === 0) { return null; }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: matchingDocs.join('\n\n---\n\n')
    }
  };
};

export const handleHover = (
  params: HoverParams,
  documents: TextDocuments<TextDocument>,
  iamServicesByPrefix: IamServicesByPrefix
): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) { return null; }

  const position = params.position;

  if (isInsideActionsArray(document, position)) {
    return handleActionHover(document, position, iamServicesByPrefix);
  }

  if (isInsideResourceArray(document, position)) {
    return handleResourceHover(document, position, iamServicesByPrefix);
  }

  return null;
};
