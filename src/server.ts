import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getIamServicesByPrefix } from "./iamProvider.ts";
import { handleCompletion } from "./completionHandler.ts";
import { handleHover } from "./hoverHandler.ts";
import type { IamServicesByPrefix } from "./domain/index.ts";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let servicesByPrefix: IamServicesByPrefix;

connection.onInitialize(async () => {
  servicesByPrefix = await getIamServicesByPrefix();
  connection.console.log(`Loaded ${Object.keys(servicesByPrefix).length} IAM service prefixes`);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [':', '*']
      },
      hoverProvider: true
    }
  };
});

connection.onCompletion((params) =>
  handleCompletion(params, documents, servicesByPrefix)
);

connection.onHover((params) =>
  handleHover(params, documents, servicesByPrefix)
);

documents.listen(connection);
connection.listen();
