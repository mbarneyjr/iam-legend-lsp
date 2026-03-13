import { TextDocument } from "vscode-languageserver-textdocument";
import type { Position, Range } from "vscode-languageserver";

const getLineText = (document: TextDocument, line: number) => {
  const start = { line, character: 0 };
  const end = { line, character: Number.MAX_SAFE_INTEGER };
  return document.getText({ start, end });
};

export const getActionOffset = (word: string, range: Range) =>
  word.indexOf(':') >= 0 ? word.indexOf(':') + 1 + range.start.character : 0;

export const getActionRange = (position: Position, actionOffset: number): Range => ({
  start: { line: position.line, character: actionOffset },
  end: { line: position.line, character: position.character }
});

/**
 * Get the word matching the given regex pattern at the given position.
 * Reimplements VS Code's getWordRangeAtPosition for LSP TextDocument.
 */
const getWordRangeAtPosition = (document: TextDocument, position: Position, pattern: RegExp) => {
  const lineText = getLineText(document, position.line);
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

  let match;
  while ((match = regex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start <= position.character && position.character <= end) {
      const range: Range = {
        start: { line: position.line, character: start },
        end: { line: position.line, character: end }
      };
      return { range, word: match[0] };
    }
  }

  return { range: undefined, word: undefined };
};

export const getFullWordAtPosition = (document: TextDocument, position: Position) =>
  getWordRangeAtPosition(document, position, /[a-z0-9:-]+/i);

export const getHoverWordAtPosition = (document: TextDocument, position: Position) =>
  getWordRangeAtPosition(document, position, /[a-z0-9:*-]+/i);

export const getArnWordAtPosition = (document: TextDocument, position: Position) =>
  getWordRangeAtPosition(document, position, /[a-z0-9:*\-\/.${}]+/i);

export const getWordAtPosition = (document: TextDocument, position: Position) =>
  getWordRangeAtPosition(document, position, /[a-z0-9_]+/i);

const isInsideArrayOf = (document: TextDocument, position: Position, sameLinePattern: RegExp, otherLinePattern: RegExp): boolean => {
  let lineText = getLineText(document, position.line).trimStart().toLowerCase();
  if (sameLinePattern.test(lineText)) {
    return true;
  }

  let line = position.line - 1;
  while (line >= 0) {
    lineText = getLineText(document, line).trimStart().toLowerCase();

    if (otherLinePattern.test(lineText)) {
      return true;
    }

    if (/^["\[#-]/.test(lineText)) {
      line--;
      continue;
    }

    return false;
  }

  return false;
};

/**
 * Check whether or not the given position appears to be within an array of actions
 */
export const isInsideActionsArray = (document: TextDocument, position: Position): boolean =>
  isInsideArrayOf(
    document, position,
    /^"?(not)?actions?"?\s*[:=]\s+/i,
    /^"?(not)?actions?"?\s*[:=]/i
  );

/**
 * Check whether or not the given position appears to be within an array of resources
 */
export const isInsideResourceArray = (document: TextDocument, position: Position): boolean =>
  isInsideArrayOf(
    document, position,
    /^"?(not)?resources?"?\s*[:=]\s+/i,
    /^"?(not)?resources?"?\s*[:=]/i
  );
