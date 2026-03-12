# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IAM Legend is a standalone, editor-agnostic LSP server providing AWS IAM policy actions autocomplete, hover documentation, and wildcard resolution. Supports Serverless Framework, AWS SAM, CloudFormation, and Terraform. Runs directly on Node 24 with native TypeScript support — no build step.

## Build & Development Commands

```bash
npm start         # Start LSP server (stdio transport)
npm test          # Unit tests (node:test)
npm run types     # Type-check (tsc --noEmit)
```

Use `nix-shell shell.barneylocal.nix` to get a shell with Node 24.

## Architecture

**Entry point**: `src/server.ts` — creates an LSP connection (stdio), registers completion and hover handlers.

**Handler pattern**: Two handlers respond to LSP requests:
- `completionHandler.ts` — suggests IAM service prefixes and actions with inline docs
- `hoverHandler.ts` — shows documentation on hover, supports wildcard patterns (e.g., `s3:Get*`)

**Data flow**: `iamProvider.ts` loads ~490 JSON files from `src/data/iam-services/` at `onInitialize`, grouped by `servicePrefix` for O(1) lookup.

**Domain layer** (`src/domain/`):
- `IamService.ts` / `IamAction.ts` — type aliases (`IamServicesByPrefix = Record<ServicePrefix, IamService[]>`)
- `utility/iam.ts` — `normalize()`, `getServiceFromServiceAction()`
- `utility/match.ts` — wildcard pattern matching (`*` and `?`)
- `utility/groupBy.ts` — groups arrays by key

**Document parsing** (`documentParser.ts`): Reimplements VS Code's `getWordRangeAtPosition` for LSP `TextDocument`. Detects if cursor is inside `actions`/`notActions` arrays by walking backward through YAML/JSON structure.

**Documentation** (`documentation.ts`): Converts domain models to plain markdown strings.

**Data scraper** (`scraper/scraper.ts`): Puppeteer + Cheerio script that scrapes AWS IAM docs to regenerate the JSON data files. Has its own `package.json` with isolated dependencies.

## Key Conventions

- **Minimal runtime dependencies** — only `vscode-languageserver` and `vscode-languageserver-textdocument`
- **No build step** — runs via `node --experimental-strip-types` on Node 24
- **ESM** — `"type": "module"` in package.json; all relative imports use `.ts` extensions
- **`import type`** — all type-only imports must use `import type` (Node's type stripping erases type declarations, so named imports of types fail at runtime)
- **Type aliases over interfaces** — use `export type Foo = { ... }` instead of `export interface Foo { ... }` (interfaces are erased by type stripping and produce no runtime export)
- **TypeScript strict mode** enabled; prefer type inference over explicit return types
- **Functional style** — pure utility functions, handler factories, no classes
- **Tests** use `node:test` and `node:assert` (no test framework dependencies)
- **2-space indentation**, LF line endings, semicolons required
