import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

function AuthScreen() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || undefined } },
        })
        if (signUpError) throw signUpError
        // Create the profile row for the new user (RLS: users can only
        // create their own profile, id = their auth user id).
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: displayName.trim() || null,
          })
        }
        if (data.session) {
          setInfo('Account created — welcome!')
        } else {
          setInfo(
            'Account created. Check your email to confirm it, then log in.'
          )
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">✓</div>
        <h1>Task App Test</h1>
        <p className="tagline">
          Sign up, make projects, and add tasks to each project.
        </p>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              setError('')
              setInfo('')
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup')
              setError('')
              setInfo('')
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>
              Display name
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>
          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : 'Log in'}
          </button>
        </form>
        <p className="fine-print">
          Your projects and tasks are private — only you can see them.
        </p>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [tasks, setTasks] = useState([])
  const [newProjectName, setNewProjectName] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState('all') // all | active | completed
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Track the signed-in user and keep it in sync on sign-in / sign-out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProjects = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('projects')
      .select('id, name, created_at')
      .order('created_at', { ascending: true })
    if (fetchError) {
      setError(fetchError.message)
      return []
    }
    setProjects(data ?? [])
    return data ?? []
  }, [])

  const loadTasks = useCallback(async (projectId) => {
    if (!projectId) {
      setTasks([])
      return
    }
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, completed, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setTasks(data ?? [])
  }, [])

  // Load projects once signed in; load tasks whenever the selection changes.
  useEffect(() => {
    if (!user) {
      setProjects([])
      setTasks([])
      setSelectedProjectId(null)
      return
    }
    setLoading(true)
    loadProjects()
      .then((list) => {
        if (list.length > 0) setSelectedProjectId(list[0].id)
      })
      .finally(() => setLoading(false))
  }, [user, loadProjects])

  useEffect(() => {
    if (user && selectedProjectId) loadTasks(selectedProjectId)
    else setTasks([])
  }, [user, selectedProjectId, loadTasks])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )

  const visibleTasks = useMemo(() => {
    if (filter === 'active') return tasks.filter((t) => !t.completed)
    if (filter === 'completed') return tasks.filter((t) => t.completed)
    return tasks
  }, [tasks, filter])

  const doneCount = tasks.filter((t) => t.completed).length

  async function handleCreateProject(e) {
    e.preventDefault()
    const name = newProjectName.trim()
    if (!name || !user) return
    setError('')
    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({ name, owner_id: user.id })
      .select('id, name, created_at')
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setProjects((prev) => [...prev, data])
    setSelectedProjectId(data.id)
    setNewProjectName('')
  }

  async function handleDeleteProject(projectId) {
    if (!window.confirm('Delete this project and all of its tasks?')) return
    setError('')
    // Tasks reference the project, so remove them first, then the project.
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('project_id', projectId)
    if (tasksError) {
      setError(tasksError.message)
      return
    }
    const { error: projectError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
    if (projectError) {
      setError(projectError.message)
      return
    }
    const remaining = projects.filter((p) => p.id !== projectId)
    setProjects(remaining)
    setSelectedProjectId(remaining.length > 0 ? remaining[0].id : null)
  }

  async function handleCreateTask(e) {
    e.preventDefault()
    const title = newTaskTitle.trim()
    if (!title || !user || !selectedProjectId) return
    setError('')
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({ title, project_id: selectedProjectId, owner_id: user.id })
      .select('id, title, completed, created_at')
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTasks((prev) => [...prev, data])
    setNewTaskTitle('')
  }

  async function handleToggleTask(task) {
    setError('')
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: !t.completed } : t
      )
    )
  }

  async function handleDeleteTask(taskId) {
    setError('')
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="logo">✓</div>
        <p>Loading Task App Test…</p>
      </div>
    )
  }

  if (!user) return <AuthScreen />

  const displayName =
    user.user_metadata?.display_name || user.email?.split('@')[0] || 'there'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo small">✓</span>
          <span className="brand-name">Task App Test</span>
        </div>
        <div className="user-box">
          <span className="user-email" title={user.email}>
            {displayName} · {user.email}
          </span>
          <button type="button" className="ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {error && (
        <p className="error banner" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </p>
      )}

      <main className="layout">
        <aside className="sidebar">
          <h2>Your projects</h2>
          <form onSubmit={handleCreateProject} className="inline-form">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="New project name"
              aria-label="New project name"
              maxLength={100}
            />
            <button type="submit" className="primary" disabled={!newProjectName.trim()}>
              Add
            </button>
          </form>

          {loading && <p className="muted">Loading projects…</p>}
          {!loading && projects.length === 0 && (
            <p className="muted">
              No projects yet — create your first one above.
            </p>
          )}
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className={
                    project.id === selectedProjectId
                      ? 'project-item active'
                      : 'project-item'
                  }
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <span className="project-name">{project.name}</span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title={`Delete ${project.name}`}
                  aria-label={`Delete ${project.name}`}
                  onClick={() => handleDeleteProject(project.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="tasks-pane">
          {selectedProject ? (
            <>
              <div className="project-header">
                <div>
                  <h2>{selectedProject.name}</h2>
                  <p className="muted">
                    {doneCount} of {tasks.length} task
                    {tasks.length === 1 ? '' : 's'} done
                  </p>
                </div>
                <div className="filters" role="group" aria-label="Filter tasks">
                  {['all', 'active', 'completed'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={filter === f ? 'active' : ''}
                      onClick={() => setFilter(f)}
                    >
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {tasks.length > 0 && (
                <div className="progress">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              )}

              <form onSubmit={handleCreateTask} className="inline-form task-form">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a task to this project…"
                  aria-label="New task title"
                  maxLength={200}
                />
                <button type="submit" className="primary" disabled={!newTaskTitle.trim()}>
                  Add task
                </button>
              </form>

              {visibleTasks.length === 0 && (
                <p className="muted empty">
                  {tasks.length === 0
                    ? 'No tasks in this project yet — add your first one above.'
                    : `No ${filter} tasks in this project.`}
                </p>
              )}
              <ul className="task-list">
                {visibleTasks.map((task) => (
                  <li key={task.id} className={task.completed ? 'done' : ''}>
                    <label className="task-row">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task)}
                      />
                      <span className="task-title">{task.title}</span>
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      title={`Delete ${task.title}`}
                      aria-label={`Delete ${task.title}`}
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="empty-state">
              <h2>No project selected</h2>
              <p className="muted">
                Create a project on the left, then add tasks to it.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
