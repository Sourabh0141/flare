'use client';

import { MessageSquareText, PanelLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePushToTalkKeys } from '@/hooks/use-push-to-talk-keys';
import { useStageGlow } from '@/hooks/use-stage-glow';
import { useVoiceTurn } from '@/hooks/use-voice-turn';
import { getVoicePlayer } from '@/lib/audio/player';
import { readPrefs, writePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { useAssistantStore } from '@/stores/assistant-store';
import { useConversationStore } from '@/stores/conversation-store';
import { AvatarCanvas } from '../avatar/avatar-canvas';
import { AvatarPlaceholder } from '../avatar/avatar-placeholder';
import { Sidebar } from '../conversation/sidebar';
import { IconButton } from '../ui/icon-button';
import { HandsFreeToggle } from './hands-free-toggle';
import { NoticeBanner } from './notice-banner';
import { PushToTalk } from './push-to-talk';
import { StatusPill } from './status-pill';
import { TranscriptPanel } from './transcript-panel';
import { WelcomeTip } from './welcome-tip';

const getVisemes = () => getVoicePlayer().getVisemes();

/** The assistant screen: sidebar, stage, controls and transcript. */
export function AssistantShell() {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Until the user chooses, the transcript follows the viewport: open on wide screens.
  const [transcriptChoice, setTranscriptChoice] = useState<boolean | null>(null);
  const transcriptOpen = transcriptChoice ?? isWide;

  const activeTitle = useConversationStore(
    (s) => s.conversations.find((c) => c.id === s.activeId)?.title ?? null
  );
  const reset = useAssistantStore((s) => s.reset);
  const {
    startListening,
    stopAndSend,
    interrupt,
    replay,
    startHandsFree,
    stopHandsFree,
    toggleHandsFreeMute,
  } = useVoiceTurn();

  useStageGlow();

  const onPress = useCallback(() => void startListening(), [startListening]);
  const onRelease = useCallback(() => void stopAndSend(), [stopAndSend]);
  usePushToTalkKeys({
    onPress,
    onRelease,
    onInterrupt: interrupt,
    onToggleMute: toggleHandsFreeMute,
  });

  const enableHandsFree = useCallback(() => {
    writePrefs({ handsFreeByDefault: true });
    void startHandsFree();
  }, [startHandsFree]);
  const disableHandsFree = useCallback(() => {
    writePrefs({ handsFreeByDefault: false });
    stopHandsFree();
  }, [stopHandsFree]);

  useEffect(() => () => reset(), [reset]);

  return (
    <div className="stage-glow flex h-dvh w-full overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onInterrupt={interrupt} />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <IconButton
              label="Open conversations"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <PanelLeft className="size-5" />
            </IconButton>
            <h1 className="type-ui max-w-[40vw] truncate text-[15px] font-medium text-linen sm:max-w-xs">
              {activeTitle ?? 'New conversation'}
            </h1>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <StatusPill className="hidden sm:inline-flex" />
            <IconButton
              label={transcriptOpen ? 'Hide transcript' : 'Show transcript'}
              aria-pressed={transcriptOpen}
              onClick={() => setTranscriptChoice(!transcriptOpen)}
              className={cn(transcriptOpen && 'bg-soot-raised text-linen')}
            >
              <MessageSquareText className="size-5" />
            </IconButton>
          </div>
        </header>

        <div className="relative flex-1">
          <AvatarCanvas fullAnimations getVisemes={getVisemes} fallback={<AvatarPlaceholder />} />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 bg-gradient-to-t from-ink via-ink/70 to-transparent px-4 pt-16 pb-6">
          <div className="pointer-events-auto">
            <NoticeBanner />
          </div>
          <div className="pointer-events-auto">
            <PushToTalk
              onPress={onPress}
              onRelease={onRelease}
              onInterrupt={interrupt}
              onToggleMute={toggleHandsFreeMute}
            />
          </div>
          <div className="pointer-events-auto">
            <HandsFreeToggle onEnable={enableHandsFree} onDisable={disableHandsFree} />
          </div>
        </div>

        <WelcomeTip
          onDismiss={(withHandsFree) => {
            if (withHandsFree) enableHandsFree();
          }}
          initialPrefs={readPrefs}
        />
      </main>

      <div
        className={cn(
          'fixed inset-y-0 right-0 z-30 w-full max-w-md lg:static lg:z-auto lg:w-auto lg:max-w-none',
          !transcriptOpen && 'pointer-events-none lg:hidden'
        )}
      >
        <TranscriptPanel
          open={transcriptOpen}
          onClose={() => setTranscriptChoice(false)}
          onReplay={(id) => void replay(id)}
        />
      </div>
    </div>
  );
}
