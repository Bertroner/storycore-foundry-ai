# StoryCore Foundry AI

Workspace target:

`C:\StoryCore-Dev\storycore-foundry-ai`

This project is the StoryCore ↔ Foundry integration. It does **not** replace Foundry combat rules.

## Runtime target

- Foundry VTT v12 Build 343
- D&D5e 3.3.1
- Midi-QOL
- Foundry API Bridge

## Source donors

Run:

```powershell
.\scripts\01_FETCH_REFERENCES.ps1
```

This clones pinned source versions into `_references/`.

### Pinned sources

| Project | Pin | Purpose |
|---|---:|---|
| Foundry API Bridge | v8.11.2 | Existing/proven command bus |
| Foundry AI Tool | v0.18.0 | Backend, tool registry, wire contracts |
| FoundryAI | 1.3.0 | LLM tool/function-calling design |
| mookAI-12 | 1.0.5 | Turn execution/state-machine ideas |
| lib-find-the-path-12 | 2.0.5 | V12 pathfinding reference |
| PF2e AI Combat Assistant | 1.07 | AI combat-state/prompt architecture study |

## Current checkpoint

Phase 0 and the donor audits are complete. The current desktop build implements a bounded supervised vertical slice for movement, legacy Item activation and turn advancement. The LLM chooses the offered action/target/movement intent; deterministic code validates it; Foundry/D&D5e/Midi resolve and fresh state is observed. Live execution acceptance is still open.

```powershell
npm ci
npm run check
npm run dev
```

Electron opens the desktop window directly; Chrome is not required. The Bridge listener remains ws://127.0.0.1:3210/bridge. Optional portable Windows build: `npm run package`. The Run button can dispatch Foundry writes after its per-run authorization checkbox; use only the dedicated test world and inspect the Process log. See [Windows setup and acceptance](docs/PHASE1A_TESTING.md), [project state](docs/PROJECT_STATE.md) and [StoryCore boundary](docs/STORYCORE_BOUNDARY.md). Keys belong only in the desktop masked settings UI, never this repository.
