import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Origin } from '@plannotator/shared/agents';
import type { DiffLineBgIntensity } from '@plannotator/shared/config';
import { configStore, useConfigValue } from '../config';
import { TaterSpritePullup } from './TaterSpritePullup';
import { getIdentity, regenerateIdentity, setCustomIdentity } from '../utils/identity';
import { GitUser } from '../icons/GitUser';
import {
  getAgentSwitchSettings,
  saveAgentSwitchSettings,
  AGENT_OPTIONS,
  type AgentSwitchSettings,
} from '../utils/agentSwitch';
import {
  getPlanSaveSettings,
  savePlanSaveSettings,
  type PlanSaveSettings,
} from '../utils/planSave';
import {
  getUIPreferences,
  saveUIPreferences,
  PLAN_WIDTH_OPTIONS,
  type UIPreferences,
  type PlanWidth,
} from '../utils/uiPreferences';
import {
  getPermissionModeSettings,
  savePermissionModeSettings,
  PERMISSION_MODE_OPTIONS,
  type PermissionMode,
} from '../utils/permissionMode';
import { getAutoCloseDelay, setAutoCloseDelay, AUTO_CLOSE_OPTIONS, type AutoCloseDelay } from '../utils/storage';
import { useAgents } from '../hooks/useAgents';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { type QuickLabel, getQuickLabels, saveQuickLabels, resetQuickLabels, DEFAULT_QUICK_LABELS, getLabelColors, LABEL_COLOR_MAP } from '../utils/quickLabels';
import { ThemeTab } from './ThemeTab';
import { isMac, altKey } from '../utils/platform';
import { getAIProviderSettings, resolveAIProviderSelection } from '../utils/aiProvider';
import { AISettingsTab } from './AISettingsTab';
import { HooksTab } from './settings/HooksTab';
import { GitTab } from './settings/ReviewGitTab';
import { CommentsTab } from './settings/CommentsTab';
import { OverlayScrollArea } from './OverlayScrollArea';
import {
  getFileBrowserSettings,
  saveFileBrowserSettings,
  type FileBrowserSettings,
} from '../utils/fileBrowser';

type SettingsTab = 'general' | 'theme' | 'git' | 'display' | 'saving' | 'labels' | 'shortcuts' | 'ai' | 'files' | 'comments' | 'hooks';

interface SettingsProps {
  taterMode: boolean;
  onTaterModeChange: (enabled: boolean) => void;
  onIdentityChange?: (oldIdentity: string, newIdentity: string) => void;
  origin?: Origin | null;
  mode?: 'plan' | 'review';
  onUIPreferencesChange?: (prefs: UIPreferences) => void;
  /** Externally controlled open state (for mobile menu integration) */
  externalOpen?: boolean;
  onExternalClose?: () => void;
  /** Available AI providers (from /api/ai/capabilities). */
  aiProviders?: Array<{ id: string; name: string; capabilities: Record<string, boolean>; models?: Array<{ id: string; label: string; default?: boolean }> }>;
  /** Git user name from `git config user.name`, for quick identity set */
  gitUser?: string;
}

// --- Review-mode Display tab (diff display options) ---
// Extracted to ./settings/ReviewDisplayTab (this monolith is being deleted).
import { ReviewDisplayTab } from './settings/ReviewDisplayTab';

function ToggleSwitch({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export const Settings: React.FC<SettingsProps> = ({ taterMode, onTaterModeChange, onIdentityChange, origin, mode = 'plan', onUIPreferencesChange, externalOpen, onExternalClose, aiProviders = [], gitUser }) => {
  const [showDialog, setShowDialog] = useState(false);
  const [themePreview, setThemePreview] = useState(false);

  useEffect(() => {
    if (!themePreview) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setThemePreview(false); setShowDialog(true); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [themePreview]);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [identity, setIdentity] = useState('');
  const [agent, setAgent] = useState<AgentSwitchSettings>({ switchTo: 'build' });
  const [planSave, setPlanSave] = useState<PlanSaveSettings>({ enabled: true, customPath: null });
  const [uiPrefs, setUiPrefs] = useState<UIPreferences>({ tocEnabled: true, stickyActionsEnabled: true });
  const planWidth = useConfigValue('planWidth');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('bypassPermissions');
  const [agentWarning, setAgentWarning] = useState<string | null>(null);
  const [autoCloseDelay, setAutoCloseDelayState] = useState<AutoCloseDelay>('off');
  const [quickLabelsState, setQuickLabelsState] = useState<QuickLabel[]>([]);
  const [editingTipIndex, setEditingTipIndex] = useState<number | null>(null);
  const [editingTipValue, setEditingTipValue] = useState('');
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [fileBrowserSettings, setFileBrowserSettings] = useState<FileBrowserSettings>({ enabled: false, directories: [] });
  const [newDirPath, setNewDirPath] = useState('');

  // Fetch available agents for OpenCode
  const { agents: availableAgents, validateAgent, getAgentWarning } = useAgents(origin ?? null);

  const mainTabs = useMemo(() => {
    const t: { id: SettingsTab; label: string }[] = [{ id: 'general', label: 'General' }];
    t.push({ id: 'theme', label: 'Theme' });
    if (mode === 'plan') {
      t.push({ id: 'display', label: 'Display' });
      t.push({ id: 'saving', label: 'Saving' });
      t.push({ id: 'labels', label: 'Labels' });
    }
    if (mode === 'review') {
      t.push({ id: 'git', label: 'Git' });
      t.push({ id: 'display', label: 'Display' });
      t.push({ id: 'comments', label: 'Comments' });
      if (aiProviders.length > 0) {
        t.push({ id: 'ai', label: 'AI' });
      }
    }
    t.push({ id: 'files', label: 'Files' });
    t.push({ id: 'shortcuts', label: 'Shortcuts' });
    if (mode === 'plan') {
      t.push({ id: 'hooks', label: 'Hooks' });
    }
    return t;
  }, [mode, aiProviders.length]);

  // Sync external open state
  useEffect(() => {
    if (externalOpen) {
      setShowDialog(true);
      onExternalClose?.();
    }
  }, [externalOpen, onExternalClose]);

  useEffect(() => {
    if (showDialog) {
      setIdentity(getIdentity())
      setAgent(getAgentSwitchSettings());
      setPlanSave(getPlanSaveSettings());
      setUiPrefs(getUIPreferences());
      setPermissionMode(getPermissionModeSettings().mode);
      setAutoCloseDelayState(getAutoCloseDelay());
      setQuickLabelsState(getQuickLabels());
      const aiSettings = getAIProviderSettings();
      setAiProvider(resolveAIProviderSelection({ providers: aiProviders, origin, settings: aiSettings }).providerId);
      setFileBrowserSettings(getFileBrowserSettings());

      // Validate agent setting when dialog opens
      if (origin === 'opencode') {
        setAgentWarning(getAgentWarning());
      }
    }
  }, [showDialog, availableAgents, origin, getAgentWarning, aiProviders.length]);

  const handleFileBrowserChange = (updates: Partial<FileBrowserSettings>) => {
    const newSettings = { ...fileBrowserSettings, ...updates };
    setFileBrowserSettings(newSettings);
    saveFileBrowserSettings(newSettings);
    if (onUIPreferencesChange) onUIPreferencesChange({ ...uiPrefs });
  };

  const addDirectory = () => {
    const trimmed = newDirPath.trim();
    if (trimmed && !fileBrowserSettings.directories.includes(trimmed)) {
      handleFileBrowserChange({
        directories: [...fileBrowserSettings.directories, trimmed],
      });
    }
    setNewDirPath('');
  };

  const handleAgentChange = (switchTo: AgentSwitchSettings['switchTo'], customName?: string) => {
    const newSettings = { switchTo, customName: customName ?? agent.customName };
    setAgent(newSettings);
    saveAgentSwitchSettings(newSettings);
  };

  const handlePlanSaveChange = (updates: Partial<PlanSaveSettings>) => {
    const newSettings = { ...planSave, ...updates };
    setPlanSave(newSettings);
    savePlanSaveSettings(newSettings);
  };

  const handleUIPrefsChange = (updates: Partial<UIPreferences>) => {
    const newPrefs = { ...uiPrefs, ...updates };
    setUiPrefs(newPrefs);
    saveUIPreferences(newPrefs);
    onUIPreferencesChange?.(newPrefs);
  };

  const handlePermissionModeChange = (mode: PermissionMode) => {
    setPermissionMode(mode);
    savePermissionModeSettings(mode);
  };

  // Server write-back is handled automatically by configStore.getState().set() (debounced POST /api/config)

  const handleRegenerateIdentity = () => {
    const oldIdentity = identity;
    const newIdentity = regenerateIdentity();
    setIdentity(newIdentity);
    onIdentityChange?.(oldIdentity, newIdentity);
  };

  const handleIdentitySave = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === identity) return;
    const oldIdentity = identity;
    const saved = setCustomIdentity(trimmed);
    setIdentity(saved);
    onIdentityChange?.(oldIdentity, saved);
  };

  const handleUseGitName = () => {
    if (!gitUser) return;
    handleIdentitySave(gitUser);
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Settings"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {showDialog && !themePreview && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {taterMode && <TaterSpritePullup />}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-sm">Settings</h3>
              <button
                onClick={() => setShowDialog(false)}
                className="p-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:min-h-[420px] flex-1 min-h-0 overflow-hidden">
              {/* Mobile: horizontal tab bar */}
              <nav className="md:hidden flex overflow-x-auto border-b border-border px-2 py-1.5 gap-1 flex-shrink-0">
                {mainTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              {/* Desktop: sidebar */}
              <nav className="hidden md:block w-40 border-r border-border p-2 flex-shrink-0">
                <div className="space-y-0.5">
                  {mainTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center justify-between ${
                        activeTab === tab.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </nav>

              {/* Content — scrollable */}
              <OverlayScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-4">

                {/* === GENERAL TAB === */}
                {activeTab === 'general' && (
                  <>
                    {/* Identity */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Your Identity</div>
                      <div className="text-xs text-muted-foreground">
                        Used when sharing annotations with others
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          key={identity}
                          type="text"
                          defaultValue={identity}
                          onBlur={(e) => handleIdentitySave(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleIdentitySave((e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs font-mono truncate border border-transparent focus:border-primary/50 focus:outline-none transition-colors"
                          placeholder="Enter your name..."
                        />
                        {gitUser && (
                          <button
                            onClick={handleUseGitName}
                            onMouseDown={(e) => e.preventDefault()}
                            className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                            title={`Use git identity: ${gitUser}`}
                          >
                            <GitUser className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={handleRegenerateIdentity}
                          onMouseDown={(e) => e.preventDefault()}
                          className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                          title="Regenerate random identity"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Permission Mode (Claude Code only) */}
                    {origin === 'claude-code' && mode === 'plan' && (
                      <>
                        <div className="border-t border-border" />
                        <div className="space-y-2">
                          <div>
                            <div className="text-sm font-medium">Permission Mode</div>
                            <div className="text-xs text-muted-foreground">
                              Automation level after plan approval
                            </div>
                          </div>
                          <select
                            value={permissionMode}
                            onChange={(e) => handlePermissionModeChange(e.target.value as PermissionMode)}
                            className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                          >
                            {PERMISSION_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-muted-foreground/70">
                            {PERMISSION_MODE_OPTIONS.find(o => o.value === permissionMode)?.description}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Agent Switching (OpenCode only) */}
                    {origin === 'opencode' && (
                      <>
                        <div className="border-t border-border" />
                        <div className="space-y-2">
                          <div>
                            <div className="text-sm font-medium">Agent Switching</div>
                            <div className="text-xs text-muted-foreground">
                              Which agent to switch to after plan approval
                            </div>
                          </div>

                          {agentWarning && (
                            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>{agentWarning}</span>
                            </div>
                          )}

                          <select
                            value={agent.switchTo}
                            onChange={(e) => {
                              handleAgentChange(e.target.value);
                              setAgentWarning(null);
                            }}
                            className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                          >
                            {availableAgents.length > 0 ? (
                              <>
                                {agent.switchTo !== 'custom' &&
                                 agent.switchTo !== 'disabled' &&
                                 !availableAgents.some(a => a.id.toLowerCase() === agent.switchTo.toLowerCase()) && (
                                  <option value={agent.switchTo} disabled>
                                    {agent.switchTo} (not found)
                                  </option>
                                )}
                                {availableAgents.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                                <option value="custom">Custom</option>
                                <option value="disabled">Disabled</option>
                              </>
                            ) : (
                              AGENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))
                            )}
                          </select>
                          {agent.switchTo === 'custom' && (
                            <input
                              type="text"
                              value={agent.customName || ''}
                              onChange={(e) => {
                                const customName = e.target.value;
                                handleAgentChange('custom', customName);
                                if (customName && availableAgents.length > 0) {
                                  if (!validateAgent(customName)) {
                                    setAgentWarning(`Agent "${customName}" not found in OpenCode. It may cause errors.`);
                                  } else {
                                    setAgentWarning(null);
                                  }
                                } else {
                                  setAgentWarning(null);
                                }
                              }}
                              placeholder="Enter agent name..."
                              className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                            />
                          )}
                          <div className="text-[10px] text-muted-foreground/70">
                            {agent.switchTo === 'custom' && agent.customName
                              ? `Switch to "${agent.customName}" agent after approval`
                              : agent.switchTo === 'disabled'
                                ? 'Stay on current agent after approval'
                                : `Switch to ${agent.switchTo} agent after approval`}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="border-t border-border" />

                    {/* Auto-close Tab */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Auto-close Tab</div>
                      <select
                        value={autoCloseDelay}
                        onChange={(e) => {
                          const next = e.target.value as AutoCloseDelay;
                          setAutoCloseDelayState(next);
                          setAutoCloseDelay(next);
                        }}
                        className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                      >
                        {AUTO_CLOSE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-muted-foreground/70">
                        {AUTO_CLOSE_OPTIONS.find(o => o.value === autoCloseDelay)?.description}
                      </div>
                    </div>
                  </>
                )}

                {/* === THEME TAB === */}
                {activeTab === 'theme' && <ThemeTab onPreview={() => { setShowDialog(false); setThemePreview(true); }} />}

                {/* === GIT TAB === */}
                {activeTab === 'git' && mode === 'review' && (
                  <GitTab />
                )}

                {/* === DISPLAY TAB === */}
                {activeTab === 'display' && mode === 'review' && (
                  <ReviewDisplayTab />
                )}

                {activeTab === 'display' && mode !== 'review' && (
                  <>
                    {/* Auto-open Sidebar */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Auto-open Sidebar</div>
                        <div className="text-xs text-muted-foreground">
                          Open sidebar with Table of Contents on load
                        </div>
                      </div>
                      <button
                        role="switch"
                        aria-checked={uiPrefs.tocEnabled}
                        onClick={() => handleUIPrefsChange({ tocEnabled: !uiPrefs.tocEnabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          uiPrefs.tocEnabled ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                            uiPrefs.tocEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="border-t border-border" />

                    {/* Sticky Actions */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Sticky Actions</div>
                        <div className="text-xs text-muted-foreground">
                          Keep action buttons visible while scrolling
                        </div>
                      </div>
                      <button
                        role="switch"
                        aria-checked={uiPrefs.stickyActionsEnabled}
                        onClick={() => handleUIPrefsChange({ stickyActionsEnabled: !uiPrefs.stickyActionsEnabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          uiPrefs.stickyActionsEnabled ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                            uiPrefs.stickyActionsEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="border-t border-border" />

                    {/* Plan Width */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">Plan Width</div>
                        <div className="text-xs text-muted-foreground">
                          Maximum width of the plan card
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                        {PLAN_WIDTH_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => configStore.getState().set('planWidth', opt.id)}
                            className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                              planWidth === opt.id
                                ? 'bg-background text-foreground shadow-sm font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Abstract layout preview — exaggerated proportions for visual clarity */}
                      {(() => {
                        const active = PLAN_WIDTH_OPTIONS.find(o => o.id === planWidth) ?? PLAN_WIDTH_OPTIONS[0];
                        // Exaggerated proportions so the width difference is visually obvious in the small preview
                        const sidebarPct = 14;
                        const panelPct = 14;
                        const cardPctMap: Record<PlanWidth, number> = { compact: 48, default: 70, wide: 94, ultrawide: 100 };
                        const cardPct = cardPctMap[active.id];
                        return (
                          <div className="space-y-2">
                            <div className="rounded-lg border border-border/40 bg-muted/20 px-2 py-3 overflow-hidden">
                              {/* Simulated header bar */}
                              <div className="flex items-center justify-between mb-2 px-1">
                                <div className="h-0.5 w-8 rounded-full bg-foreground/15" />
                                <div className="flex gap-1">
                                  <div className="h-1 w-1 rounded-full bg-foreground/15" />
                                  <div className="h-1 w-1 rounded-full bg-foreground/15" />
                                  <div className="h-1 w-1 rounded-full bg-foreground/15" />
                                </div>
                              </div>
                              <div className="border-t border-foreground/5 mb-2" />
                              {/* Three-column layout */}
                              <div className="flex gap-1 items-stretch" style={{ minHeight: 64 }}>
                                {/* Sidebar */}
                                <div className="flex-shrink-0 space-y-1 pt-0.5 opacity-30" style={{ width: `${sidebarPct}%` }}>
                                  <div className="h-0.5 w-full rounded-full bg-foreground" />
                                  <div className="h-0.5 w-3/4 rounded-full bg-foreground" />
                                  <div className="h-0.5 w-1/2 rounded-full bg-foreground" />
                                  <div className="h-0.5 w-2/3 rounded-full bg-foreground" />
                                  <div className="h-0.5 w-1/2 rounded-full bg-foreground" />
                                </div>
                                {/* Plan card — width animates */}
                                <div className="flex-1 flex justify-center min-w-0">
                                  <div
                                    className="rounded border border-border/60 bg-card/50 p-1.5 space-y-1 transition-all duration-300 ease-out"
                                    style={{ width: `${cardPct}%`, minWidth: 0 }}
                                  >
                                    {/* Heading */}
                                    <div className="h-1 w-2/5 rounded-full bg-foreground/25" />
                                    {/* Prose lines */}
                                    <div className="space-y-[2px]">
                                      <div className="h-[2px] w-full rounded-full bg-foreground/10" />
                                      <div className="h-[2px] w-11/12 rounded-full bg-foreground/10" />
                                      <div className="h-[2px] w-4/5 rounded-full bg-foreground/10" />
                                    </div>
                                    {/* Code block */}
                                    <div className="rounded bg-muted/60 p-1 space-y-[2px]">
                                      <div className="h-[2px] w-full rounded-full bg-primary/20" />
                                      <div className="h-[2px] w-3/4 rounded-full bg-primary/20" />
                                      <div className="h-[2px] w-5/6 rounded-full bg-primary/20" />
                                    </div>
                                    {/* More prose */}
                                    <div className="space-y-[2px]">
                                      <div className="h-[2px] w-full rounded-full bg-foreground/10" />
                                      <div className="h-[2px] w-3/4 rounded-full bg-foreground/10" />
                                    </div>
                                  </div>
                                </div>
                                {/* Annotation panel */}
                                <div className="flex-shrink-0 space-y-1 pt-0.5 opacity-20" style={{ width: `${panelPct}%` }}>
                                  <div className="rounded border border-foreground/20 p-0.5 space-y-[2px]">
                                    <div className="h-[2px] w-full rounded-full bg-foreground" />
                                    <div className="h-[2px] w-2/3 rounded-full bg-foreground" />
                                  </div>
                                  <div className="rounded border border-foreground/20 p-0.5 space-y-[2px]">
                                    <div className="h-[2px] w-full rounded-full bg-foreground" />
                                    <div className="h-[2px] w-1/2 rounded-full bg-foreground" />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground/70 leading-snug">
                              {active.px === null ? 'Full width' : `${active.px}px`} — {active.hint}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="border-t border-border" />

                    {/* Tater Mode */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Tater Mode</div>
                      <button
                        role="switch"
                        aria-checked={taterMode}
                        onClick={() => onTaterModeChange(!taterMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          taterMode ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                            taterMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </>
                )}

                {/* === SAVING TAB === */}
                {activeTab === 'saving' && (
                  <>
                    {/* Plan Saving */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Save Plans</div>
                          <div className="text-xs text-muted-foreground">
                            Auto-save plans to the default data directory
                          </div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={planSave.enabled}
                          onClick={() => handlePlanSaveChange({ enabled: !planSave.enabled })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            planSave.enabled ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              planSave.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {planSave.enabled && (
                        <div className="space-y-1.5 pl-0.5">
                          <label className="text-xs text-muted-foreground">Custom Path (optional)</label>
                          <input
                            type="text"
                            value={planSave.customPath || ''}
                            onChange={(e) => handlePlanSaveChange({ customPath: e.target.value || null })}
                            placeholder="Leave empty for default"
                            className="w-full px-3 py-2 bg-muted rounded-lg text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                          <div className="text-[10px] text-muted-foreground/70">
                            Leave empty to use default location
                          </div>
                        </div>
                      )}
                    </div>

                  </>
                )}

                {/* === LABELS TAB === */}
                {activeTab === 'labels' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">Quick Labels</div>
                        <div className="text-xs text-muted-foreground">
                          Preset annotations for one-click feedback
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          resetQuickLabels();
                          setQuickLabelsState(DEFAULT_QUICK_LABELS);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Reset to defaults
                      </button>
                    </div>

                    <style>{`
                      @keyframes tip-slide-open {
                        from { max-height: 0; opacity: 0; }
                        to   { max-height: 60px; opacity: 1; }
                      }
                    `}</style>
                    <div className="space-y-1.5">
                      {quickLabelsState.map((label, index) => {
                        const colors = getLabelColors(label.color);
                        const hasTip = !!label.tip;
                        const isEditingTip = editingTipIndex === index;
                        return (
                          <div key={index} className="rounded-lg overflow-hidden" style={{ backgroundColor: colors.bg }}>
                            {/* Main row */}
                            <div className="flex items-center gap-2 p-2">
                              <span className="text-sm flex-shrink-0">{label.emoji}</span>
                              <input
                                type="text"
                                value={label.text}
                                onChange={(e) => {
                                  const updated = [...quickLabelsState];
                                  updated[index] = {
                                    ...label,
                                    text: e.target.value,
                                    id: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                                  };
                                  setQuickLabelsState(updated);
                                  saveQuickLabels(updated);
                                }}
                                className="flex-1 px-2 py-1 bg-background/80 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                              />
                              {/* Tip indicator button */}
                              <button
                                onClick={() => {
                                  if (isEditingTip) {
                                    setEditingTipIndex(null);
                                  } else {
                                    setEditingTipIndex(index);
                                    setEditingTipValue(label.tip || '');
                                  }
                                }}
                                className={`relative p-1 rounded transition-all flex-shrink-0 ${
                                  hasTip
                                    ? 'bg-foreground/10 text-foreground/70 hover:text-foreground border border-foreground/15'
                                    : 'text-muted-foreground/30 hover:text-muted-foreground/60 border border-dashed border-muted-foreground/20 hover:border-muted-foreground/40'
                                }`}
                                title={hasTip ? `Tip: ${label.tip}` : 'Add AI instruction tip'}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                {hasTip && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-foreground/50" />
                                )}
                              </button>
                              <select
                                value={label.color}
                                onChange={(e) => {
                                  const updated = [...quickLabelsState];
                                  updated[index] = { ...label, color: e.target.value };
                                  setQuickLabelsState(updated);
                                  saveQuickLabels(updated);
                                }}
                                className="px-1.5 py-1 bg-background/80 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                              >
                                {Object.keys(LABEL_COLOR_MAP).map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <span className="text-[10px] text-muted-foreground/50 font-mono w-8 text-center flex-shrink-0">
                                {index < 10 ? `${altKey}${isMac ? '' : '+'}${index === 9 ? '0' : index + 1}` : ''}
                              </span>
                              <button
                                onClick={() => {
                                  const updated = quickLabelsState.filter((_, i) => i !== index);
                                  setQuickLabelsState(updated);
                                  saveQuickLabels(updated);
                                  if (editingTipIndex === index) setEditingTipIndex(null);
                                }}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                                title="Remove label"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            {/* Tip editor — slides open below the row */}
                            {isEditingTip && (
                              <div
                                className="flex items-center gap-1.5 px-2 pb-2 pt-0"
                                style={{ animation: 'tip-slide-open 0.15s ease-out' }}
                              >
                                <svg className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 ml-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                                <input
                                  type="text"
                                  value={editingTipValue}
                                  onChange={(e) => setEditingTipValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const updated = [...quickLabelsState];
                                      updated[index] = { ...label, tip: editingTipValue || undefined };
                                      setQuickLabelsState(updated);
                                      saveQuickLabels(updated);
                                      setEditingTipIndex(null);
                                    }
                                    if (e.key === 'Escape') setEditingTipIndex(null);
                                  }}
                                  placeholder="AI instruction tip..."
                                  className="flex-1 px-2 py-1 bg-background/60 rounded text-[10px] text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                  autoFocus
                                  onFocus={(e) => { e.target.setSelectionRange(0, 0); e.target.scrollLeft = 0; }}
                                />
                                <button
                                  onClick={() => {
                                    const updated = [...quickLabelsState];
                                    updated[index] = { ...label, tip: editingTipValue || undefined };
                                    setQuickLabelsState(updated);
                                    saveQuickLabels(updated);
                                    setEditingTipIndex(null);
                                  }}
                                  className="p-1 rounded text-muted-foreground/50 hover:text-green-500 hover:bg-green-500/10 transition-colors flex-shrink-0"
                                  title="Save tip"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {quickLabelsState.length < 12 && (
                      <button
                        onClick={() => {
                          const newLabel: QuickLabel = {
                            id: `custom-${Date.now()}`,
                            emoji: '📌',
                            text: 'New label',
                            color: 'blue',
                          };
                          const updated = [...quickLabelsState, newLabel];
                          setQuickLabelsState(updated);
                          saveQuickLabels(updated);
                        }}
                        className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:border-foreground/30 transition-colors"
                      >
                        + Add label
                      </button>
                    )}

                    <div className="text-[10px] text-muted-foreground/70">
                      Use {altKey}{isMac ? '' : '+'}1 through {altKey}{isMac ? '' : '+'}0 when the annotation toolbar is visible to apply a label instantly.
                    </div>
                  </>
                )}

                {/* === SHORTCUTS TAB === */}
                {activeTab === 'shortcuts' && (
                  <KeyboardShortcuts mode={mode} />
                )}

                {/* === COMMENTS TAB === */}
                {activeTab === 'comments' && (
                  <CommentsTab />
                )}

                {/* === AI TAB === */}
                {activeTab === 'ai' && (
                  <AISettingsTab
                    providers={aiProviders}
                    selectedProviderId={aiProvider}
                    origin={origin}
                    onProviderChange={setAiProvider}
                  />
                )}

                {/* === FILES TAB === */}
                {activeTab === 'files' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">File Browser</div>
                        <div className="text-xs text-muted-foreground">
                          Your project files are shown automatically. Add extra directories below.
                        </div>
                      </div>
                      <button
                        role="switch"
                        aria-checked={fileBrowserSettings.enabled}
                        onClick={() => handleFileBrowserChange({ enabled: !fileBrowserSettings.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          fileBrowserSettings.enabled ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                            fileBrowserSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {fileBrowserSettings.enabled && (
                      <>
                        <div className="border-t border-border" />

                        {/* Directory list */}
                        {fileBrowserSettings.directories.length > 0 && (
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Directories</label>
                            {fileBrowserSettings.directories.map((dir) => (
                              <div key={dir} className="flex items-center gap-2 group">
                                <div className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs font-mono truncate" title={dir}>
                                  {dir}
                                </div>
                                <button
                                  onClick={() => handleFileBrowserChange({
                                    directories: fileBrowserSettings.directories.filter((d) => d !== dir),
                                  })}
                                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Remove directory"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add directory */}
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Add Directory</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newDirPath}
                              onChange={(e) => setNewDirPath(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') addDirectory();
                              }}
                              placeholder="/path/to/directory"
                              className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                            <button
                              onClick={addDirectory}
                              disabled={!newDirPath.trim()}
                              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                          <div className="text-[10px] text-muted-foreground/70">
                            Add directories outside your project that contain markdown files.
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* === HOOKS TAB === */}
                {activeTab === 'hooks' && <HooksTab />}

              </div>
              </OverlayScrollArea>
            </div>
          </div>
        </div>,
        document.body
      )}

      {themePreview && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col pointer-events-none">
          <div className="flex-1" />
          <div
            className="pointer-events-auto w-full bg-card border-t-2 border-primary/30 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] flex flex-col max-h-[35vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
              <span className="text-xs font-medium text-muted-foreground">Theme Preview</span>
              <button
                onClick={() => { setThemePreview(false); setShowDialog(true); }}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
            <div className="p-3 overflow-y-auto flex-1 min-h-0">
              <ThemeTab compact />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
