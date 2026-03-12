# IAM Legend LSP Server

A standalone, editor-agnostic LSP server for AWS IAM policy actions.
Supports Serverless Framework, AWS SAM, CloudFormation, and Terraform.

Forked from [IAM Legend](https://github.com/TastefulElk/iam-legend) (VS Code extension).
Rewritten as a general-purpose LSP server with zero build step, expects NodeJS with native TypeScript support.

## Features

- **Autocomplete** — service prefixes and IAM actions with inline documentation
- **Hover** — action descriptions, resource types, condition keys, and dependent actions
- **Wildcard resolution** — hover over patterns like `s3:Get*` to see all matching actions
- **490+ AWS services** — data scraped directly from AWS IAM documentation

## Requirements

- Node.js >= 24.0.0

## Installation

```bash
git clone https://github.com/TastefulElk/iam-legend.git
cd iam-legend
npm install
```

## Usage

Start the LSP server (communicates over stdio):

```bash
npm start
# or directly:
node --experimental-strip-types src/server.ts
```

## Editor Configuration

### Neovim

```lua
vim.lsp.config("iam-legend", {
  cmd = { "node", "--experimental-strip-types", "/path/to/iam-legend/src/server.ts" },
  filetypes = { "yaml", "json", "typescript", "terraform" },
  root_markers = { ".git" },
})

vim.lsp.enable("iam-legend")
```

## Updating IAM Service Data

The `scraper/` directory has a Puppeteer-based scraper that regenerates `src/data/iam-services/` from AWS documentation.

```bash
cd scraper
npm install
npm run scrape
```
