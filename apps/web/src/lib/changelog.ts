export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

/** Newest first. Dates are ISO so they sort and render predictably. */
export const CHANGELOG: ChangelogEntry[] = [
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
