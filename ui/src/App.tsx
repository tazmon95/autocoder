import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProjects, useFeatures, useAgentStatus, useSettings } from './hooks/useProjects'
import { useProjectWebSocket } from './hooks/useWebSocket'
import { useFeatureSound } from './hooks/useFeatureSound'
import { useCelebration } from './hooks/useCelebration'
import { ProjectSelector } from './components/ProjectSelector'
import { KanbanBoard } from './components/KanbanBoard'
import { AgentControl } from './components/AgentControl'
import { SetupWizard } from './components/SetupWizard'
import { AddFeatureForm } from './components/AddFeatureForm'
import { FeatureModal } from './components/FeatureModal'
import { DebugLogViewer, type TabType } from './components/DebugLogViewer'
import { AgentThought } from './components/AgentThought'
import { AssistantFAB } from './components/AssistantFAB'
import { AssistantPanel } from './components/AssistantPanel'
import { ExpandProjectModal } from './components/ExpandProjectModal'
import { SettingsModal } from './components/SettingsModal'
import { DevServerControl } from './components/DevServerControl'
import { Loader2, Settings, Moon, Sun, Filter, ChevronUp, ChevronDown } from 'lucide-react'
import type { Feature } from './lib/types'

const STORAGE_KEY = 'autocoder-selected-project'
const DARK_MODE_KEY = 'autocoder-dark-mode'

// Apply dark mode on initial load (before React renders)
function initDarkMode() {
  if (typeof window === 'undefined') return
  try {
    const saved = window.localStorage.getItem(DARK_MODE_KEY)
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
    const isDark = saved !== null ? saved === 'true' : prefersDark
    document.documentElement.classList.toggle('dark', isDark)
  } catch {
    // Ignore localStorage/matchMedia failures (keep default theme)
  }
}
initDarkMode()

function App() {
  // Initialize selected project from localStorage
  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [showExpandProject, setShowExpandProject] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [setupComplete, setSetupComplete] = useState(true) // Start optimistic
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugPanelHeight, setDebugPanelHeight] = useState(288) // Default height
  const [debugActiveTab, setDebugActiveTab] = useState<TabType>('agent')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isSpecCreating, setIsSpecCreating] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [progressCollapsed, setProgressCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem(DARK_MODE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const queryClient = useQueryClient()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: features } = useFeatures(selectedProject)
  const { data: settings } = useSettings()
  useAgentStatus(selectedProject) // Keep polling for status updates
  const wsState = useProjectWebSocket(selectedProject)

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem(DARK_MODE_KEY, String(darkMode))
    } catch {
      // localStorage not available
    }
  }, [darkMode])

  // Play sounds when features move between columns
  useFeatureSound(features)

  // Celebrate when all features are complete
  useCelebration(features, selectedProject)

  // Persist selected project to localStorage
  const handleSelectProject = useCallback((project: string | null) => {
    // Invalidate old project's cached data to prevent stale data showing
    if (selectedProject && selectedProject !== project) {
      queryClient.removeQueries({ queryKey: ['features', selectedProject] })
      queryClient.removeQueries({ queryKey: ['agent-status', selectedProject] })
    }

    setSelectedProject(project)
    try {
      if (project) {
        localStorage.setItem(STORAGE_KEY, project)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // localStorage not available
    }
  }, [selectedProject, queryClient])

  // Validate stored project exists (clear if project was deleted)
  useEffect(() => {
    if (selectedProject && projects && !projects.some(p => p.name === selectedProject)) {
      handleSelectProject(null)
    }
  }, [selectedProject, projects, handleSelectProject])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // D : Toggle debug window
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        setDebugOpen(prev => !prev)
      }

      // T : Toggle terminal tab in debug panel
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        if (!debugOpen) {
          // If panel is closed, open it and switch to terminal tab
          setDebugOpen(true)
          setDebugActiveTab('terminal')
        } else if (debugActiveTab === 'terminal') {
          // If already on terminal tab, close the panel
          setDebugOpen(false)
        } else {
          // If open but on different tab, switch to terminal
          setDebugActiveTab('terminal')
        }
      }

      // N : Add new feature (when project selected)
      if ((e.key === 'n' || e.key === 'N') && selectedProject) {
        e.preventDefault()
        setShowAddFeature(true)
      }

      // E : Expand project with AI (when project selected and has features)
      if ((e.key === 'e' || e.key === 'E') && selectedProject && features &&
          (features.pending.length + features.in_progress.length + features.done.length) > 0) {
        e.preventDefault()
        setShowExpandProject(true)
      }

      // A : Toggle assistant panel (when project selected and not in spec creation)
      if ((e.key === 'a' || e.key === 'A') && selectedProject && !isSpecCreating) {
        e.preventDefault()
        setAssistantOpen(prev => !prev)
      }

      // , : Open settings
      if (e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      }

      // F : Toggle filter panel (when project selected)
      if ((e.key === 'f' || e.key === 'F') && selectedProject) {
        e.preventDefault()
        setShowFilter(prev => !prev)
      }

      // P : Toggle progress panel collapse (when project selected)
      if ((e.key === 'p' || e.key === 'P') && selectedProject) {
        e.preventDefault()
        setProgressCollapsed(prev => !prev)
      }

      // Escape : Close modals
      if (e.key === 'Escape') {
        if (showExpandProject) {
          setShowExpandProject(false)
        } else if (showSettings) {
          setShowSettings(false)
        } else if (assistantOpen) {
          setAssistantOpen(false)
        } else if (showAddFeature) {
          setShowAddFeature(false)
        } else if (selectedFeature) {
          setSelectedFeature(null)
        } else if (debugOpen) {
          setDebugOpen(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedProject, showAddFeature, showExpandProject, selectedFeature, debugOpen, debugActiveTab, assistantOpen, features, showSettings, isSpecCreating, showFilter, progressCollapsed])

  // Combine WebSocket progress with feature data
  const progress = wsState.progress.total > 0 ? wsState.progress : {
    passing: features?.done.length ?? 0,
    total: (features?.pending.length ?? 0) + (features?.in_progress.length ?? 0) + (features?.done.length ?? 0),
    percentage: 0,
  }

  if (progress.total > 0 && progress.percentage === 0) {
    progress.percentage = Math.round((progress.passing / progress.total) * 100 * 10) / 10
  }

  if (!setupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />
  }

  return (
    <div className="min-h-screen bg-neo-bg">
      {/* Header */}
      <header className="bg-neo-card text-neo-text border-b-4 border-neo-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <h1 className="font-display text-2xl font-bold tracking-tight uppercase">
              AutoCoder
            </h1>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <ProjectSelector
                projects={projects ?? []}
                selectedProject={selectedProject}
                onSelectProject={handleSelectProject}
                isLoading={projectsLoading}
                onSpecCreatingChange={setIsSpecCreating}
              />

              {selectedProject && (
                <>
                  <AgentControl
                    projectName={selectedProject}
                    status={wsState.agentStatus}
                  />

                  <DevServerControl
                    projectName={selectedProject}
                    status={wsState.devServerStatus}
                    url={wsState.devServerUrl}
                  />

                  <button
                    onClick={() => setShowFilter(!showFilter)}
                    className={`neo-btn text-sm py-2 px-3 ${showFilter ? 'bg-[var(--color-neo-accent)] text-[var(--color-neo-text-on-bright)]' : ''}`}
                    title="Toggle filter (F)"
                    aria-label="Toggle feature filter"
                  >
                    <Filter size={18} />
                  </button>

                  <button
                    onClick={() => setShowSettings(true)}
                    className="neo-btn text-sm py-2 px-3"
                    title="Settings (,)"
                    aria-label="Open Settings"
                  >
                    <Settings size={18} />
                  </button>

                  {/* GLM Mode Badge */}
                  {settings?.glm_mode && (
                    <span
                      className="px-2 py-1 text-xs font-bold bg-[var(--color-neo-glm)] text-white rounded border-2 border-neo-border shadow-neo-sm"
                      title="Using GLM API (configured via .env)"
                    >
                      GLM
                    </span>
                  )}
                </>
              )}

              {/* Dark mode toggle - always visible */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="neo-btn text-sm py-2 px-3"
                title="Toggle dark mode"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className="max-w-7xl mx-auto px-4 py-8"
        style={{ paddingBottom: debugOpen ? debugPanelHeight + 32 : undefined }}
      >
        {!selectedProject ? (
          <div className="neo-empty-state mt-12">
            <h2 className="font-display text-2xl font-bold mb-2">
              Welcome to AutoCoder
            </h2>
            <p className="text-neo-text-secondary mb-4">
              Select a project from the dropdown above or create a new one to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Progress Dashboard - Collapsible */}
            <div className="neo-card overflow-hidden">
              <button
                onClick={() => setProgressCollapsed(!progressCollapsed)}
                className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-neo-hover-subtle)] transition-colors"
                title="Toggle progress panel (P)"
              >
                <div className="flex items-center gap-4">
                  <h2 className="font-display text-xl font-bold uppercase">Progress</h2>
                  {progressCollapsed && (
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl font-bold text-[var(--color-neo-accent)]">
                        {progress.percentage.toFixed(1)}%
                      </span>
                      <span className="text-sm text-[var(--color-neo-text-secondary)]">
                        <span className="text-[var(--color-neo-done)] font-bold">{progress.passing}</span>
                        {' / '}
                        <span className="font-bold">{progress.total}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {wsState.isConnected ? (
                    <span className="text-sm text-[var(--color-neo-done)]">Live</span>
                  ) : (
                    <span className="text-sm text-[var(--color-neo-danger)]">Offline</span>
                  )}
                  {progressCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </div>
              </button>
              {!progressCollapsed && (
                <div className="px-6 pb-6">
                  {/* Large Percentage */}
                  <div className="text-center mb-6">
                    <span className="inline-flex items-baseline">
                      <span className="font-display text-6xl font-bold">
                        {progress.percentage.toFixed(1)}
                      </span>
                      <span className="font-display text-3xl font-bold text-[var(--color-neo-text-secondary)]">
                        %
                      </span>
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="neo-progress mb-4">
                    <div
                      className="neo-progress-fill"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="flex justify-center gap-8 text-center">
                    <div>
                      <span className="font-mono text-3xl font-bold text-[var(--color-neo-done)]">
                        {progress.passing}
                      </span>
                      <span className="block text-sm text-[var(--color-neo-text-secondary)] uppercase">
                        Passing
                      </span>
                    </div>
                    <div className="text-4xl text-[var(--color-neo-text-secondary)]">/</div>
                    <div>
                      <span className="font-mono text-3xl font-bold">
                        {progress.total}
                      </span>
                      <span className="block text-sm text-[var(--color-neo-text-secondary)] uppercase">
                        Total
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Agent Thought - shows latest agent narrative */}
            <AgentThought
              logs={wsState.logs}
              agentStatus={wsState.agentStatus}
            />

            {/* Initializing Features State - show when agent is running but no features yet */}
            {features &&
             features.pending.length === 0 &&
             features.in_progress.length === 0 &&
             features.done.length === 0 &&
             wsState.agentStatus === 'running' && (
              <div className="neo-card p-8 text-center">
                <Loader2 size={32} className="animate-spin mx-auto mb-4 text-neo-progress" />
                <h3 className="font-display font-bold text-xl mb-2">
                  Initializing Features...
                </h3>
                <p className="text-neo-text-secondary">
                  The agent is reading your spec and creating features. This may take a moment.
                </p>
              </div>
            )}

            {/* Kanban Board */}
            <KanbanBoard
              features={features}
              onFeatureClick={setSelectedFeature}
              onAddFeature={() => setShowAddFeature(true)}
              onExpandProject={() => setShowExpandProject(true)}
              showFilter={showFilter}
            />
          </div>
        )}
      </main>

      {/* Add Feature Modal */}
      {showAddFeature && selectedProject && (
        <AddFeatureForm
          projectName={selectedProject}
          onClose={() => setShowAddFeature(false)}
        />
      )}

      {/* Feature Detail Modal */}
      {selectedFeature && selectedProject && (
        <FeatureModal
          feature={selectedFeature}
          projectName={selectedProject}
          onClose={() => setSelectedFeature(null)}
        />
      )}

      {/* Expand Project Modal - AI-powered bulk feature creation */}
      {showExpandProject && selectedProject && (
        <ExpandProjectModal
          isOpen={showExpandProject}
          projectName={selectedProject}
          onClose={() => setShowExpandProject(false)}
          onFeaturesAdded={() => {
            // Invalidate features query to refresh the kanban board
            queryClient.invalidateQueries({ queryKey: ['features', selectedProject] })
          }}
        />
      )}

      {/* Debug Log Viewer - fixed to bottom */}
      {selectedProject && (
        <DebugLogViewer
          logs={wsState.logs}
          devLogs={wsState.devLogs}
          isOpen={debugOpen}
          onToggle={() => setDebugOpen(!debugOpen)}
          onClear={wsState.clearLogs}
          onClearDevLogs={wsState.clearDevLogs}
          onHeightChange={setDebugPanelHeight}
          projectName={selectedProject}
          activeTab={debugActiveTab}
          onTabChange={setDebugActiveTab}
        />
      )}

      {/* Assistant FAB and Panel - hide when expand modal or spec creation is open */}
      {selectedProject && !showExpandProject && !isSpecCreating && (
        <>
          <AssistantFAB
            onClick={() => setAssistantOpen(!assistantOpen)}
            isOpen={assistantOpen}
          />
          <AssistantPanel
            projectName={selectedProject}
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
          />
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default App
