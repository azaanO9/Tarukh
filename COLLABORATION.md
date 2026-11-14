# Collaboration

The shared repository is [azaanO9/Tarukh](https://github.com/azaanO9/Tarukh). Git tracks the source; Codex, AI Studio and Antigravity do not automatically share chat history or local edits.

1. Before starting, run `git status`. Commit or otherwise preserve existing work before switching branches or updating.
2. Update from the reviewed `main` branch and create a task branch. Use the remote name shown by `git remote -v` (`origin` in a normal clone).
3. Coordinate edits to shared files, especially `ui/MarsWorld.tsx`. Interface work usually belongs in `ui/`; simulation belongs in `game/`; rendering and animation live in `ui/world/`.
4. Run the checks listed in `README.md`, commit only intended files, push the task branch and open a pull request.
5. Review and merge one change at a time. Update the other developer's checkout before the next task. Resolve overlapping edits without discarding either person's work.

Write the problem, change, checks and known limitations in the pull request. Keep API keys, local configuration and generated output out of commits. Do not force-push shared branches.

## Publishing

Changes merged to `main` trigger `.github/workflows/pages.yml`, which validates and publishes GitHub Pages. Wait for the workflow to succeed, then compare the live `version.json` with the merged commit before sharing a link. A successful Git push alone does not prove publication finished.

The separate Sites build remains supported. Preserve the existing `.openai/hosting.json` in each environment; do not replace a deployed Site's identity with a blank or different value.
