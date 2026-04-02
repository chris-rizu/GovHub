const state = {
  currentView: 'submissions',
  statusFilter: 'pending',
  session: null,
  overview: null
}

const els = {}

function captureElements() {
  els.signInButton = document.getElementById('btn-signin')
  els.refreshButton = document.getElementById('btn-refresh')
  els.emailInput = document.getElementById('admin-email')
  els.passwordInput = document.getElementById('admin-pass')
  els.loginCard = document.getElementById('login-card')
  els.loginError = document.getElementById('login-error')
  els.authControls = document.getElementById('auth-controls')
  els.authBadge = document.getElementById('auth-badge')
  els.metrics = document.getElementById('metrics')
  els.results = document.getElementById('results')
  els.resultsSummary = document.getElementById('results-summary')
  els.dashboardShell = document.getElementById('dashboard-shell')
  els.dashboardEmpty = document.getElementById('dashboard-empty')
  els.statusFilter = document.getElementById('status-filter')
  els.topPages = document.getElementById('top-pages')
  els.recentVisits = document.getElementById('recent-visits')
  els.tabButtons = Array.from(document.querySelectorAll('.admin-tab-btn'))
}

function showLoginError(message = '') {
  if (!message) {
    els.loginError.classList.add('hidden')
    els.loginError.textContent = ''
    return
  }
  els.loginError.textContent = message
  els.loginError.classList.remove('hidden')
}

function setLoading(isLoading) {
  els.refreshButton.disabled = isLoading || !state.session
  els.signInButton.disabled = isLoading
  els.refreshButton.innerHTML = isLoading
    ? '<i class="fas fa-spinner fa-spin mr-2"></i>Loading'
    : '<i class="fas fa-rotate mr-2"></i>Refresh'
}

function formatDate(value) {
  if (!value) return 'Unknown time'
  return new Date(value).toLocaleString()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function getAccessToken() {
  const { data, error } = await DB_API.auth.getSession()
  if (error) throw error
  return data?.session?.access_token || null
}

async function adminFetch(path, options = {}) {
  const token = await getAccessToken()
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })

  const json = await response.json().catch(() => ({ error: 'Invalid JSON response from server.' }))
  if (!response.ok) {
    throw new Error(json.error || `Request failed with status ${response.status}`)
  }
  return json
}

function renderAuth() {
  const user = state.session?.user
  const isSignedIn = Boolean(user)

  els.loginCard.classList.toggle('hidden', isSignedIn)
  els.dashboardShell.classList.toggle('hidden', !isSignedIn)
  els.dashboardEmpty.classList.toggle('hidden', isSignedIn)
  els.authBadge.textContent = isSignedIn ? 'Signed In' : 'Signed Out'
  els.authBadge.className = isSignedIn
    ? 'rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200'
    : 'rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] opacity-80'

  if (isSignedIn) {
    els.authControls.innerHTML = `
      <div class="space-y-3">
        <div class="text-sm">
          <div class="font-semibold">${escapeHtml(user.email || 'Authenticated admin')}</div>
          <div class="opacity-65">Authenticated through Supabase Auth</div>
        </div>
        <button id="btn-signout" class="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20 transition">
          Sign Out
        </button>
      </div>
    `
    document.getElementById('btn-signout').addEventListener('click', handleSignOut)
  } else {
    els.authControls.textContent = 'Not signed in.'
  }
}

function renderMetrics(metrics = {}) {
  const cards = [
    { label: 'Unique Visitors (24h)', value: metrics.uniqueVisitorsLast24h || 0, icon: 'fa-user-check' },
    { label: 'Page Views (24h)', value: metrics.pageviewsLast24h || metrics.visitsLast24h || 0, icon: 'fa-users' },
    { label: 'Pending Suggestions', value: metrics.pendingSuggestions || 0, icon: 'fa-location-dot' },
    { label: 'Pending Submissions', value: metrics.pendingSubmissions || 0, icon: 'fa-inbox' }
  ]

  els.metrics.innerHTML = cards.map((card) => `
    <article class="rounded-3xl border border-[var(--border)] bg-[var(--card)]/90 p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm opacity-70">${card.label}</p>
          <div class="mt-3 text-3xl font-semibold">${card.value}</div>
        </div>
        <div class="h-11 w-11 rounded-2xl bg-cyan-400/10 text-cyan-300 flex items-center justify-center">
          <i class="fas ${card.icon}"></i>
        </div>
      </div>
    </article>
  `).join('')
}

function renderTopPages(topPages = []) {
  if (!topPages.length) {
    els.topPages.innerHTML = '<p class="opacity-60">No visitor data yet.</p>'
    return
  }

  els.topPages.innerHTML = topPages.map((page) => `
    <div class="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/70 px-4 py-3 flex items-center justify-between gap-3">
      <span class="truncate">${escapeHtml(page.path)}</span>
      <span class="text-cyan-300 font-semibold">${page.views}</span>
    </div>
  `).join('')
}

function renderRecentVisits(visits = []) {
  if (!visits.length) {
    els.recentVisits.innerHTML = '<p class="opacity-60">No recent visits to display.</p>'
    return
  }

  els.recentVisits.innerHTML = visits.map((visit) => `
    <div class="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/70 px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <span class="font-medium truncate">${escapeHtml(visit.page_path || '/')}</span>
        <span class="text-xs opacity-60">${formatDate(visit.created_at)}</span>
      </div>
      <div class="mt-1 text-xs opacity-60">Session: ${escapeHtml(visit.session_id || 'anonymous')}</div>
    </div>
  `).join('')
}

function renderTable(rows, type) {
  if (!rows.length) {
    els.results.innerHTML = '<div class="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)]/60 px-5 py-8 text-center opacity-70">No records found for this filter.</div>'
    return
  }

  if (type === 'suggestions') {
    els.results.innerHTML = rows.map((row) => `
      <article class="rounded-3xl border border-[var(--border)] bg-[var(--bg)]/70 p-5 mb-4">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-semibold">${escapeHtml(row.office_name)}</h3>
              <span class="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">${escapeHtml(row.office_type)}</span>
              <span class="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] opacity-70">${escapeHtml(row.status)}</span>
            </div>
            <p class="mt-2 text-sm opacity-80">${escapeHtml(row.address)}, ${escapeHtml(row.city)}</p>
            <p class="mt-3 text-sm opacity-75">Submitted by ${escapeHtml(row.submitter_name)}${row.contact ? ` • ${escapeHtml(row.contact)}` : ''}</p>
            <p class="mt-2 text-sm opacity-70">${escapeHtml(row.notes || 'No notes provided.')}</p>
            <div class="mt-3 flex flex-wrap gap-4 text-xs opacity-60">
              <span>Votes: ${row.votes || 0}</span>
              <span>Created: ${formatDate(row.created_at)}</span>
              <span>Admin note: ${escapeHtml(row.admin_notes || 'None')}</span>
            </div>
          </div>
          <div class="flex flex-col gap-2 lg:w-56">
            <button class="moderate-btn rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#0a0f1c] hover:bg-emerald-300 transition" data-kind="suggestions" data-id="${row.id}" data-status="approved">Approve</button>
            <button class="moderate-btn rounded-2xl bg-red-400/90 px-4 py-3 text-sm font-semibold text-[#0a0f1c] hover:bg-red-300 transition" data-kind="suggestions" data-id="${row.id}" data-status="rejected">Reject</button>
          </div>
        </div>
      </article>
    `).join('')
    return
  }

  els.results.innerHTML = rows.map((row) => `
    <article class="rounded-3xl border border-[var(--border)] bg-[var(--bg)]/70 p-5 mb-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-lg font-semibold">${escapeHtml(row.service_type)}</h3>
            <span class="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">${escapeHtml(row.update_type || 'other')}</span>
            <span class="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] opacity-70">${escapeHtml(row.status)}</span>
          </div>
          <p class="mt-2 text-sm opacity-80">${escapeHtml(row.branch_name)}</p>
          <p class="mt-3 text-sm opacity-75">Submitted by ${escapeHtml(row.submitter_name)}</p>
          <p class="mt-2 text-sm opacity-70">${escapeHtml(row.details)}</p>
          <div class="mt-3 flex flex-wrap gap-4 text-xs opacity-60">
            <span>Created: ${formatDate(row.created_at)}</span>
            <span>Reviewed: ${row.reviewed_at ? formatDate(row.reviewed_at) : 'Not reviewed'}</span>
            <span>Admin note: ${escapeHtml(row.admin_notes || 'None')}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2 lg:w-56">
          <button class="moderate-btn rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#0a0f1c] hover:bg-emerald-300 transition" data-kind="submissions" data-id="${row.id}" data-status="approved">Approve</button>
          <button class="moderate-btn rounded-2xl bg-red-400/90 px-4 py-3 text-sm font-semibold text-[#0a0f1c] hover:bg-red-300 transition" data-kind="submissions" data-id="${row.id}" data-status="rejected">Reject</button>
        </div>
      </div>
    </article>
  `).join('')
}

function setActiveTab() {
  els.tabButtons.forEach((button) => {
    const isActive = button.dataset.view === state.currentView
    button.classList.toggle('bg-[var(--accent)]', isActive)
    button.classList.toggle('text-[#0a0f1c]', isActive)
    button.classList.toggle('border-transparent', isActive)
  })
}

async function loadOverview() {
  const json = await adminFetch('/api/admin/overview')
  state.overview = json
  renderMetrics(json.metrics || {})
  renderTopPages(json.topPages || [])
  renderRecentVisits(json.recentVisits || [])
}

async function loadModerationView() {
  const endpoint = state.currentView === 'suggestions'
    ? `/api/admin/suggestions?status=${encodeURIComponent(state.statusFilter)}&limit=100`
    : `/api/admin/submissions?status=${encodeURIComponent(state.statusFilter)}&limit=100`

  const json = await adminFetch(endpoint)
  const rows = state.currentView === 'suggestions' ? (json.suggestions || []) : (json.submissions || [])
  renderTable(rows, state.currentView)
  els.resultsSummary.textContent = state.currentView === 'suggestions'
    ? `${rows.length} office suggestions shown`
    : `${rows.length} community reports shown`
  setActiveTab()
}

async function refreshDashboard() {
  if (!state.session) return
  setLoading(true)
  showLoginError('')
  try {
    await Promise.all([loadOverview(), loadModerationView()])
  } catch (error) {
    showLoginError(error.message)
  } finally {
    setLoading(false)
  }
}

async function handleSignIn() {
  const email = els.emailInput.value.trim()
  const password = els.passwordInput.value
  if (!email || !password) {
    showLoginError('Enter both email and password.')
    return
  }

  setLoading(true)
  showLoginError('')
  try {
    const { data, error } = await DB_API.auth.signIn({ email, password })
    if (error) throw error
    state.session = data.session
    renderAuth()
    await refreshDashboard()
  } catch (error) {
    showLoginError(error.message || 'Sign in failed.')
  } finally {
    setLoading(false)
  }
}

async function handleSignOut() {
  await DB_API.auth.signOut()
  state.session = null
  state.overview = null
  els.results.innerHTML = ''
  els.metrics.innerHTML = ''
  els.topPages.innerHTML = ''
  els.recentVisits.innerHTML = ''
  els.resultsSummary.textContent = ''
  renderAuth()
}

async function handleModerationClick(event) {
  const button = event.target.closest('.moderate-btn')
  if (!button) return

  const adminNotes = window.prompt('Optional admin note for this action:', '') ?? ''
  const endpoint = button.dataset.kind === 'suggestions'
    ? `/api/admin/suggestions/${button.dataset.id}/moderate`
    : `/api/admin/submissions/${button.dataset.id}/moderate`

  button.disabled = true
  try {
    await adminFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        status: button.dataset.status,
        adminNotes
      })
    })
    await refreshDashboard()
  } catch (error) {
    showLoginError(error.message)
  } finally {
    button.disabled = false
  }
}

async function bootstrapAuth() {
  const { data } = await DB_API.auth.getSession()
  state.session = data?.session || null
  renderAuth()
  if (state.session) {
    await refreshDashboard()
  }

  DB_API.auth.onAuthStateChange((_event, session) => {
    state.session = session
    renderAuth()
    if (session) {
      refreshDashboard()
    }
  })
}

function bindEvents() {
  els.signInButton.addEventListener('click', handleSignIn)
  els.refreshButton.addEventListener('click', refreshDashboard)
  els.statusFilter.addEventListener('change', async (event) => {
    state.statusFilter = event.target.value
    await loadModerationView()
  })
  els.tabButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      state.currentView = button.dataset.view
      await loadModerationView()
    })
  })
  els.results.addEventListener('click', handleModerationClick)
}

async function init() {
  captureElements()
  bindEvents()
  renderAuth()
  setActiveTab()
  await bootstrapAuth()
}

init()
