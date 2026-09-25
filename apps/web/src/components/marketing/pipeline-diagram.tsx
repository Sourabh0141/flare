/**
 * Inline SVG of the request path. Drawn with the page's tokens so it reads in the dark
 * theme; labelled for screen readers through <title> and <desc>.
 */
export function PipelineDiagram() {
  const box = 'fill-soot-raised stroke-ash';
  const text = 'fill-linen';
  const muted = 'fill-smoke';
  const line = 'stroke-ash-soft';

  return (
    <svg
      viewBox="0 0 880 300"
      role="img"
      aria-labelledby="pipeline-title pipeline-desc"
      className="mx-auto block w-full max-w-4xl min-w-[640px] text-[13px]"
    >
      <title id="pipeline-title">Flare request path</title>
      <desc id="pipeline-desc">
        The browser records audio and sends it to the Worker, which forwards it to Whisper for text.
        The browser then sends the transcript; the Worker reads the conversation from D1, asks Llama
        for a reply with mood and gesture, saves both messages, and returns them. The browser
        finally requests audio for the reply, which the Worker streams from Kokoro.
      </desc>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className="fill-ash-soft" />
        </marker>
      </defs>

      {/* Columns */}
      <g>
        <rect x="20" y="20" width="200" height="260" rx="12" className={box} />
        <text x="120" y="48" textAnchor="middle" className={`${text} font-medium`}>
          Browser
        </text>
        <text x="120" y="70" textAnchor="middle" className={muted}>
          record, transcript, lip-sync
        </text>
      </g>
      <g>
        <rect x="340" y="20" width="200" height="260" rx="12" className={box} />
        <text x="440" y="48" textAnchor="middle" className={`${text} font-medium`}>
          Worker
        </text>
        <text x="440" y="70" textAnchor="middle" className={muted}>
          auth, validation, D1
        </text>
      </g>
      <g>
        <rect x="660" y="20" width="200" height="260" rx="12" className={box} />
        <text x="760" y="48" textAnchor="middle" className={`${text} font-medium`}>
          DeepInfra
        </text>
        <text x="760" y="70" textAnchor="middle" className={muted}>
          Whisper, Llama, Kokoro
        </text>
      </g>

      {/* Stage 1 */}
      <g className={line} strokeWidth="1.5" fill="none" markerEnd="url(#arrow)">
        <path d="M220 110 H340" />
        <path d="M540 110 H660" />
      </g>
      <text x="280" y="102" textAnchor="middle" className={text}>
        audio
      </text>
      <text x="600" y="102" textAnchor="middle" className={text}>
        transcribe
      </text>
      <text x="120" y="114" textAnchor="middle" className={muted}>
        1. hold and speak
      </text>

      {/* Stage 2 */}
      <g className={line} strokeWidth="1.5" fill="none" markerEnd="url(#arrow)">
        <path d="M220 180 H340" />
        <path d="M540 180 H660" />
        <path d="M440 190 v40" />
      </g>
      <text x="280" y="172" textAnchor="middle" className={text}>
        transcript
      </text>
      <text x="600" y="172" textAnchor="middle" className={text}>
        reply as JSON
      </text>
      <text x="120" y="184" textAnchor="middle" className={muted}>
        2. transcript shown
      </text>
      <rect x="395" y="232" width="90" height="26" rx="6" className="fill-ink stroke-ash" />
      <text x="440" y="249" textAnchor="middle" className={muted}>
        D1 history
      </text>

      {/* Stage 3 */}
      <g className={line} strokeWidth="1.5" fill="none" markerEnd="url(#arrow)">
        <path d="M660 250 H540" />
        <path d="M340 250 H220" />
      </g>
      <text x="600" y="242" textAnchor="middle" className={text}>
        mp3 stream
      </text>
      <text x="280" y="242" textAnchor="middle" className={text}>
        streamed through
      </text>
      <text x="120" y="254" textAnchor="middle" className={muted}>
        3. speak and animate
      </text>
    </svg>
  );
}
