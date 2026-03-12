import type { Hover, HoverParams } from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver";
import type { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createServicesActionDocs, createServiceDocs } from "./documentation.ts";
import { isInsideActionsArray } from "./documentParser.ts";
import { getHoverWordAtPosition, getWordAtPosition } from "./documentParser.ts";
import type { IamServicesByPrefix } from "./domain/index.ts";
import { match, normalize } from "./domain/utility/index.ts";

export const handleHover = (
  params: HoverParams,
  documents: TextDocuments<TextDocument>,
  iamServicesByPrefix: IamServicesByPrefix
): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) { return null; }

  const position = params.position;

  const { range: wordRange, word: rawWord } = getHoverWordAtPosition(document, position);
  if (!wordRange || !rawWord) { return null; }

  if (!isInsideActionsArray(document, position)) {
    return null;
  }

  const word = normalize(rawWord);

  let [serviceName, action] = word.split(':');
  if (!iamServicesByPrefix[serviceName]) {
    // if the hovered word doesn't include a known service, try with previous word
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

  // if word matches 'service' but no action, return hover with documentation for that service
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
