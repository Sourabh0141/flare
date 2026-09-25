export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

/** Newest first. Dates are ISO so they sort and render predictably. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-09-25',
    title: 'Faster replies, more languages, a sharper ear',
    changes: [
      'Flare starts speaking as soon as its first sentence is ready, while the rest is still being written. Replies stream into the transcript word by word.',
      'Speak Spanish, French, Hindi, Italian, Japanese, Portuguese or Chinese and Flare answers in that language with a native voice of the register you chose.',
      'Hands-free now uses a small on-device neural detector (Silero VAD) that tells speech from noise, with the old volume gate as a fallback.',
      'Interrupt by speaking, an option for headphone users: Flare keeps listening while it talks and stops when you cut in.',
      'Emotion intensity: the model says how strongly it feels, and the face and body scale to match. Try the slider in the playground.',
      'Lips follow the words: mouth shapes are timed from the text and driven by the sound, instead of sound alone.',
      'The character reacts while you talk (a small nod when you start, brows that follow your voice), glances away now and then, shifts its weight, and its eyes follow your pointer in the app too.',
      'Pin conversations to the top and archive the rest. Press ? for keyboard shortcuts.',
      'Soft tones when listening starts and a turn is sent.',
      'The 3D models are a fifth of their previous size, so the character appears sooner.',
      'Administrators can review invite requests and send invitations from the app.',
      'A live API reference at /api/docs, a content security policy on every page, and recovery screens if something crashes.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-09-25',
    title: 'Hands-free, voices, and a place to ask for an invite',
    changes: [
      'Hands-free mode: leave the microphone open and talk when you like. Flare pauses listening while it thinks and speaks, so it never answers itself.',
      'Eight voices to choose from, with a preview of each, and four personalities that change how Flare talks.',
      'Settings page with your name, voice, personality, and a button that erases everything Flare holds about you.',
      'A character playground on the how-it-works page: click a mood or gesture and watch.',
      'Request an invite from the site; help, privacy, terms and this changelog.',
      'Transcript export and copy, search in the conversation list, and a daily turn cap so a runaway session cannot run up a bill.',
      'Installable on phones as a web app.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-25',
    title: 'Rebuilt for production',
    changes: [
      'A turn is now three short requests so it fits the free Workers plan and shows the transcript before the reply arrives.',
      'Reply, mood, gesture and title from one language model call.',
      'The character breathes, blinks, follows you with its eyes, leans in while listening, and holds a mood while it talks.',
      'Redesigned interface, landing page and how-it-works page.',
      'Real-database tests for the API, unit tests for the client, CI on every push.',
    ],
  },
];
