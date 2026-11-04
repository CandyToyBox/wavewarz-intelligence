# WavID (vendored)

Copy of Quan's WavID Browser Studio modules, MIT licensed (see `LICENSE`,
`THIRD_PARTY_NOTICES.md`): github.com/0xQuan93/WavID at 08f67aa.

- `core/` is `studio/src/core/`, unchanged.
- `renderer/` is `studio/src/renderer/` minus `frame.worker.ts`. Import
  `renderer/WavIdRenderer` directly; `renderer/index.ts` also exports the
  worker-based `usePreparedWavIdFrame`, which the site does not use.
- `roster.ts` is ours: builds the roster from the public leaderboard feeds (the
  same inputs as the studio) and resolves site artists to roster artists.

To update, re-copy those folders from upstream and re-run the prototype pages.
The full studio at /wavid is a separate prebuilt bundle in `public/wavid-studio/`.
