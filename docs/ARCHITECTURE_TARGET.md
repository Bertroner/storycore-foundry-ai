# Architecture Target

```text
StoryCore
  memory / personality / relationships / LLM / voice / images
                       |
                       v
StoryCore Foundry AI Adapter
  state sensors
  normalizer
  tool/intent schema
  validator
  executor
  observer
                       |
                       v
Foundry API Bridge
                       |
           +-----------+-----------+
           |                       |
        D&D5e                   Foundry Canvas
           |
        Midi-QOL
```

Core loop:

`READ → NORMALIZE → LLM DECIDE → VALIDATE → COMMAND → OBSERVE`

The adapter is deliberately thin. It must not become another VTT or D&D rules engine.
