---
"@aceshooting/lyra-ui": minor
---
`lr-agent-run`, `lr-subagent-panel`, `lr-agent-eval-dashboard` and `lr-eval-run` share one status label map, so a finished run reads "Done" everywhere (it read "Success" in `lr-eval-run`) and application-defined kinds are title-cased consistently.
