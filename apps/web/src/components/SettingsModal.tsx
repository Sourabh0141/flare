'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { X, Settings, User as UserIcon, Loader2, Check } from 'lucide-react';
import { fetchSettings, updateSettings } from '@/lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load initial settings when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function loadSettings() {
      try {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        const token = await getToken();
        if (!token) return;

        const profile = await fetchSettings(token);
        setDisplayName(profile.display_name || clerkUser?.firstName || 'User');
      } catch (err: unknown) {
        console.error('Failed to load settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile settings.');
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [isOpen, getToken, clerkUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }

    if (displayName.trim().length > 50) {
      setError('Display name cannot exceed 50 characters.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      const token = await getToken();
      if (!token) return;

      const updated = await updateSettings(token, displayName.trim());
      setDisplayName(updated.display_name);
      setSuccessMessage('Settings updated successfully!');

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-purple-950/20 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 text-zinc-100">
            <Settings className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-base">User Settings</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Check className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* User Account Info */}
          <div className="flex items-center gap-3.5 p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-semibold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400">Authenticated via Clerk</p>
              <p className="text-sm font-medium text-zinc-200 truncate">
                {clerkUser?.primaryEmailAddress?.emailAddress || clerkUser?.username || 'Authenticated User'}
              </p>
            </div>
          </div>

          {/* Display Name Field */}
          <div className="space-y-2">
            <label htmlFor="displayName" className="block text-sm font-medium text-zinc-300">
              Display Name <span className="text-purple-400">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading || isSaving}
              placeholder="Enter your display name"
              maxLength={50}
              className="w-full px-4 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-50"
            />
            <p className="text-xs text-zinc-500">
              This name is used by the AI companion when addressing you in conversation.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-750 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isSaving || !displayName.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-xl transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
