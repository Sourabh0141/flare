'use client';

import React, { useState } from 'react';
import { UserButton, useUser } from '@clerk/clerk-react';
import {
  Plus,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useConversations } from '@/context/ConversationContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SettingsModal } from '@/components/SettingsModal';
import { formatRelativeTime, cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user } = useUser();
  const {
    conversations,
    activeConversationId,
    isLoadingList,
    selectConversation,
    startNewConversation,
    renameConversation,
    deleteConversation,
  } = useConversations();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Handle start inline rename
  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
    setActiveMenuId(null);
  };

  // Handle confirm rename
  const handleSaveRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    await renameConversation(id, editTitle.trim());
    setEditingId(null);
  };

  // Handle delete conversation
  const handleConfirmDelete = async () => {
    if (!deletingId) return;

    try {
      setIsDeleting(true);
      await deleteConversation(deletingId);
      setDeletingId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed lg:static top-0 bottom-0 left-0 z-40 flex flex-col h-full bg-zinc-950/90 border-r border-zinc-800/80 backdrop-blur-xl transition-all duration-300 ease-in-out',
          isOpen ? 'w-72 lg:w-80 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/30 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>

            {isOpen && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-base text-zinc-100 tracking-tight flex items-center gap-1.5">
                  Flare <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">V1</span>
                </span>
                <span className="text-xs text-zinc-400 truncate">3D AI Voice Assistant</span>
              </div>
            )}
          </div>

          {/* Toggle button */}
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-lg transition-colors hidden lg:flex items-center justify-center"
            title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* New Conversation Button (Requirement R16) */}
        <div className="p-3">
          <button
            type="button"
            onClick={startNewConversation}
            className={cn(
              'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md',
              'bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-950/40 active:scale-[0.98]',
              !isOpen && 'justify-center px-0'
            )}
            title="Start New Conversation"
          >
            <Plus className="w-5 h-5 shrink-0" />
            {isOpen && <span className="truncate">New Conversation</span>}
          </button>
        </div>

        {/* Conversation List*/}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            isOpen ? (
              // Empty State
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-zinc-300">No conversations yet</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Hold the voice button on the canvas to start speaking!
                </p>
              </div>
            ) : null
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              const isEditing = editingId === conv.id;
              const isMenuOpen = activeMenuId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => !isEditing && selectConversation(conv.id)}
                  className={cn(
                    'group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all',
                    isActive
                      ? 'bg-purple-950/40 border border-purple-500/30 text-zinc-100 shadow-sm'
                      : 'hover:bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-transparent',
                    !isOpen && 'justify-center p-3'
                  )}
                  title={conv.title}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MessageSquare
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-purple-400' : 'text-zinc-500 group-hover:text-zinc-400'
                      )}
                    />

                    {isOpen && (
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleSaveRename(conv.id, e)}
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              autoFocus
                              className="w-full px-2 py-0.5 text-xs bg-zinc-900 border border-purple-500 rounded text-zinc-100 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-zinc-400 hover:text-zinc-300"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <p className="text-xs font-medium truncate leading-tight">{conv.title}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {formatRelativeTime(conv.updated_at)}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Context Actions Menu*/}
                  {isOpen && !isEditing && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(isMenuOpen ? null : conv.id);
                        }}
                        className={cn(
                          'p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors',
                          isMenuOpen ? 'opacity-100 bg-zinc-800 text-zinc-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                        title="Conversation Options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-7 z-50 w-36 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(conv.id, conv.title, e)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                            <span>Rename</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              setDeletingId(conv.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer with User Profile & Settings Button */}
        <div className="p-3 border-t border-zinc-800/80 flex items-center justify-between gap-2 bg-zinc-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8 rounded-full ring-2 ring-purple-500/30',
                },
              }}
            />
            {isOpen && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-medium text-zinc-200 truncate">
                  {user?.firstName || user?.username || 'User'}
                </span>
                <span className="text-[10px] text-zinc-500 truncate">
                  {user?.primaryEmailAddress?.emailAddress || 'Authenticated'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-colors shrink-0"
            title="User Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Confirmation Modal for Delete*/}
      <ConfirmModal
        isOpen={!!deletingId}
        title="Delete Conversation"
        message="Are you sure you want to permanently delete this conversation and all its voice message history? This action cannot be undone."
        confirmLabel="Delete Conversation"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />

      {/* Settings Modal*/}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
