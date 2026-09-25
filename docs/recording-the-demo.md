# Recording the demo

The README embeds `docs/demo.gif`. It has to be recorded on a real machine with a
microphone; nothing in the repository can generate it. A 20 to 30 second clip is plenty.

## What to capture

1. Open the assistant with the transcript panel visible. Wait for the character to be idle
   and blinking.
2. Hold the button and ask one short question. Release. Watch for: the transcript appearing,
   the "thinking" glow, the first sentence starting to play while the rest is still being
   written, the mood tag.
3. Say something in another language (Spanish works well) so the voice switches.
4. Open the how-it-works page and click two moods and "Laugh" in the playground.

## How

- Desktop Chrome, 1280 x 800 window, system audio muted for the recording (the GIF has no
  sound; the lip-sync is the point).
- Any screen recorder that exports GIF, or record MP4 and convert:

  ```sh
  ffmpeg -i demo.mp4 -vf "fps=15,scale=960:-1:flags=lanczos" -loop 0 docs/demo.gif
  ```

- Keep it under 8 MB so the README loads quickly; trim silences.

Commit the GIF next to this file. `docs/poster.svg` is the static fallback that the README
shows above it.
