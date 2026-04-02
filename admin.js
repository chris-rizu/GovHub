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
  els.loginError = document.getElementById('login-error')
  els.loginView = document.getElementById('login-view')
  els.dashboardView = document.getElementById('dashboard-view')
  els.userEmail = document.getElementById('user-email')
  els.metrics = document.getElementById('metrics')
  els.results = document.getElementById('results')
  els.resultsSummary = document.getElementById('results-summary')
  els.statusFilter = document.getElementById('status-filter')
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
  if (isLoading) {
    els.refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'
    els.signInButton.textContent = 'Signing in...'
  } else {
    els.refreshButton.innerHTML = '<i class="fas fa-rotate"></i>'
    els.signInButton.textContent = 'Sign In'
  }
}

function formatDate(value) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  const url = path.startsWith('http') ? path : `http://localhost:3001${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })

  const json = await response.json().catch(() => ({ error: 'Invalid response from server' }))
  if (!response.ok) {
    throw new Error(json.error || `Request failed with status ${response.status}`)
  }
  return json
}

function renderAuth() {
  const user = state.session?.user
  const isSignedIn = Boolean(user)

  els.loginView.classList.toggle('hidden', isSignedIn)
  els.dashboardView.classList.toggle('hidden', !isSignedIn)

  if (isSignedIn) {
    els.userEmail.textContent = user.email || 'Admin'
  }
}

function renderMetrics(metrics = {}) {
  const cards = [
    { label: 'Visitors (24h)', value: metrics.uniqueVisitorsLast24h || 0, icon: 'fa-users', color: 'cyan' },
    { label: 'Page Views (24h)', value: metrics.pageviewsLast24h || 0, icon: 'fa-eye', color: 'blue' },
    { label: 'Pending Suggestions', value: metrics.pendingSuggestions || 0, icon: 'fa-lightbulb', color: 'yellow' },
    { label: 'Pending Reports', value: metrics.pendingSubmissions || 0, icon: 'fa-inbox', color: 'emerald' }
  ]

  els.metrics.innerHTML = cards.map((card) => `
    <div class="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs opacity-60">${card.label}</p>
          <p class="text-2xl font-bold mt-1">${card.value}</p>
        </div>
        <div class="h-10 w-10 rounded-lg bg-${card.color}-400/10 text-${card.color}-400 flex items-center justify-center">
          <i class="fas ${card.icon}"></i>
        </div>
      </div>
    </div>
  `).join('')
}

function renderTable(rows, type) {
  if (!rows.length) {
    els.results.innerHTML = '<p class="text-center py-12 opacity-60">No records found</p>'
    return
  }

  els.results.innerHTML = rows.map((row) => `
    <div class="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-4 mb-3 last:mb-0">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="flex-1 min-w-0">
          ${type === 'suggestions' ? renderSuggestionContent(row) : renderSubmissionContent(row)}
          <div class="mt-3 flex flex-wrap gap-3 text-xs opacity-50">
            <span><i class="far fa-clock mr-1"></i>${formatDate(row.created_at)}</span>
            ${row.reviewed_at ? `<span><i class="fas fa-check mr-1"></i>Reviewed: ${formatDate(row.reviewed_at)}</span>` : ''}
          </div>
        </div>
        <div class="flex sm:flex-col gap-2">
          <button class="moderate-btn px-4 py-2 rounded-lg bg-emerald-400 text-[#0a0f1c] text-sm font-medium hover:bg-emerald-300 transition" data-kind="${type}" data-id="${row.id}" data-status="approved">
            Approve
          </button>
          <button class="moderate-btn px-4 py-2 rounded-lg bg-red-400/20 text-red-300 text-sm font-medium hover:bg-red-400/30 transition" data-kind="${type}" data-id="${row.id}" data-status="rejected">
            Reject
          </button>
        </div>
      </div>
    </div>
  `).join('')
}

function renderSuggestionContent(row) {
  return `
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <h3 class="font-semibold">${escapeHtml(row.office_name)}</h3>
      <span class="px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 text-xs">${escapeHtml(row.office_type)}</span>
      <span class="px-2 py-0.5 rounded-full border border-[var(--border)] text-xs uppercase">${escapeHtml(row.status)}</span>
    </div>
    <p class="text-sm opacity-80">${escapeHtml(row.address)}, ${escapeHtml(row.city)}</p>
    <p class="text-sm opacity-70 mt-1">From: ${escapeHtml(row.submitter_name)}</p>
    ${row.notes ? `<p class="text-sm opacity-60 mt-2 italic">"${escapeHtml(row.notes)}"</p>` : ''}
  `
}

function renderSubmissionContent(row) {
  const updateType = row.update_type || 'other'
  const displayType = updateType.charAt(0).toUpperCase() + updateType.slice(1)
  const serviceType = row.service_type === 'other' ? 'Not on list' : row.service_type

  return `
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <h3 class="font-semibold">${escapeHtml(serviceType)}</h3>
      <span class="px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 text-xs">${escapeHtml(displayType)}</span>
      <span class="px-2 py-0.5 rounded-full border border-[var(--border)] text-xs uppercase">${escapeHtml(row.status)}</span>
    </div>
    <p class="text-sm opacity-80">${escapeHtml(row.branch_name)}</p>
    <p class="text-sm opacity-70 mt-1">From: ${escapeHtml(row.submitter_name)}</p>
    ${updateType === 'suggestion' ? `<p class="text-sm text-cyan-300 mt-2"><i class="fas fa-lightbulb mr-1"></i>Suggestion for new service to add</p>` : ''}
    <p class="text-sm opacity-60 mt-2">${escapeHtml(row.details)}</p>
  `
}

function setActiveTab() {
  els.tabButtons.forEach((button) => {
    const isActive = button.dataset.view === state.currentView
    button.classList.toggle('bg-[var(--accent)]', isActive)
    button.classList.toggle('text-[#0a0f1c]', isActive)
    button.classList.toggle('border-transparent', isActive)
    button.classList.toggle('bg-[var(--bg)]', !isActive)
  })
}

async function loadOverview() {
  const json = await adminFetch('/api/admin/overview')
  state.overview = json
  renderMetrics(json.metrics || {})
}

async function loadModerationView() {
  const endpoint = state.currentView === 'suggestions'
    ? `/api/admin/suggestions?status=${encodeURIComponent(state.statusFilter)}&limit=100`
    : `/api/admin/submissions?status=${encodeURIComponent(state.statusFilter)}&limit=100`

  const json = await adminFetch(endpoint)
  const rows = state.currentView === 'suggestions' ? (json.suggestions || []) : (json.submissions || [])
  renderTable(rows, state.currentView)
  els.resultsSummary.textContent = `${rows.length} ${state.currentView === 'suggestions' ? 'suggestions' : 'reports'}`
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
  els.resultsSummary.textContent = ''
  renderAuth()
}

async function handleModerationClick(event) {
  const button = event.target.closest('.moderate-btn')
  if (!button) return

  const endpoint = button.dataset.kind === 'suggestions'
    ? `/api/admin/suggestions/${button.dataset.id}/moderate`
    : `/api/admin/submissions/${button.dataset.id}/moderate`

  button.disabled = true
  try {
    await adminFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ status: button.dataset.status })
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
  document.getElementById('btn-signout')?.addEventListener('click', handleSignOut)
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
