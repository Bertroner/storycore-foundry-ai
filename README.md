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

## First task

Open this folder in Codex and give Codex the contents of `CODEX_START_PROMPT.md`.

Codex must first audit donor source and document what can be reused/adapted. No large implementation before that audit.
