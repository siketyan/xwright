# AGENTS.md

This file provides guidance to coding agents (Claude Code and others) when working with code in this repository.

Xwright is an end-to-end testing framework that drives the web, mobile and other devices from a single test and
records what every device did on one timeline. It runs on Playwright Test, drives the web through Playwright and iOS /
Android through Mobilewright, and takes any other device through adapters written outside this repository.

## Setup

- Node.js 24, from `.node-version`. The packages support Node.js 22.12 and later.
- pnpm, at the version in `packageManager` of `package.json`.

## Commands

- Install: `pnpm install`
- Build: `pnpm build` (`tsc -b` over the project references of `tsconfig.json`, with TypeScript 7)
- Check: `pnpm check` (Biome formats, lints and sorts imports); `pnpm check:fix` applies the fixes. CI runs
  `biome ci`.
- Test: `pnpm test` (Vitest; every directory under `packages/` is a project)
- Workflows: run `gh actions-lock` after adding or removing a `uses:` in `.github/workflows/`, and never edit
  `.github/workflows/actions.lock` by hand. Before pushing a change to the workflows, check them locally with
  `gh actions-lock --verify` and `zizmor .` (configured in `.github/zizmor.yml`); CI does not run them.

## Architecture

- `packages/xwright` — `xwright`: the CLI, the runner over Playwright Test, `use()`, `step()` and the adapter SDK.
- `packages/playwright` — `@xwright/playwright`: the official adapter for the web.
- `packages/mobilewright` — `@xwright/mobilewright`: the official adapter for iOS and Android.

## Conventions

- Use English everywhere in the repository.
- Use the latest version of every dependency, and follow the official guide when adding a new tool.
- Playwright and Mobilewright are pinned, Playwright at the version Mobilewright pins.
- GitHub Actions: refer to actions by their exact version tag (e.g. `@v7.0.1`); their commits are locked in
  `.github/workflows/actions.lock`. Give each job the least permissions and check out with
  `persist-credentials: false`.

## Git workflow

- Open a pull request per topic from a branch; do not push to `main`.
- Use the Conventional Commits style in Git commits and GitHub PR title.
- Avoid writing long description in Git commits.
- Create multiple commits when the change is large.
- Use English in commit messages and PR description, following `.github/pull_request_template.md`.
