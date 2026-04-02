// ===========================================
// SHARED BROWSER CONFIGURATION
// ===========================================

const SUPABASE_CONFIG = {
  url: 'https://exdmyrzjdrfnqrodkyvm.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4ZG15cnpqZHJmbnFyb2RreXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTYwODMsImV4cCI6MjA5MDU5MjA4M30.o3HjL7ZBVEQVu4sWhOx5ZnA1pdn8N1-7GRFjuLNPprM'
}

function getMetaApiBaseUrl() {
  const meta = document.querySelector('meta[name="govhub-api-base-url"]')
  return meta?.content?.trim() || ''
}

function getStoredApiBaseUrl() {
  try {
    return localStorage.getItem('govhub_api_base_url')?.trim() || ''
  } catch {
    return ''
  }
}

const APP_CONFIG = {
  // Leave blank when the frontend and Node server share the same origin.
  // If the site is hosted separately from the backend, set this to your Render URL.
  apiBaseUrl: window.GOVHUB_API_BASE_URL || getMetaApiBaseUrl() || getStoredApiBaseUrl() || 'https://govhub.onrender.com'
}

const supabaseLib = window.supabase
const supabaseClient = supabaseLib?.createClient
  ? supabaseLib.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null

if (!supabaseClient) {
  console.warn('Supabase client library is unavailable in the browser.')
}

function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = (APP_CONFIG.apiBaseUrl || '').trim().replace(/\/$/, '')
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath
}

function safeTrim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getVisitorId() {
  try {
    const storageKey = 'govhub_visitor_id'
    const existing = localStorage.getItem(storageKey)
    if (existing) return existing

    const generated = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    localStorage.setItem(storageKey, generated)
    return generated
  } catch {
    return null
  }
}

async function parseJson(response) {
  return response.json().catch(() => ({}))
}

async function apiRequest(path, options = {}) {
  const url = buildApiUrl(path)
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  const json = await parseJson(response)
  if (!response.ok) {
    if (response.status === 404) {
      const baseMessage = APP_CONFIG.apiBaseUrl
        ? `API endpoint not found at ${url}. Check that your backend deployment is running the latest server routes.`
        : 'API endpoint not found on this site. Set `apiBaseUrl` in config.js to your backend URL if the frontend is hosted separately.'
      throw new Error(baseMessage)
    }
    throw new Error(json.error || `Request failed with status ${response.status}`)
  }

  return json
}

async function insertWithSupabase(table, payload) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not available.')
  }

  const { data, error } = await supabaseClient
    .from(table)
    .insert([payload])
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

async function insertWithoutSelect(table, payload) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not available.')
  }

  const { error } = await supabaseClient.from(table).insert([payload])
  if (error) {
    throw error
  }
}

const DB_API = {
  api: {
    buildUrl: buildApiUrl,
    getVisitorId
  },

  // Offices
  async getOffices(filters = {}) {
    if (!supabaseClient) return []

    let query = supabaseClient.from('offices').select('*')

    if (filters.type) {
      query = query.eq('type', filters.type)
    }
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`)
    }

    const { data, error } = await query
    return error ? [] : data
  },

  async getOfficeById(id) {
    if (!supabaseClient) return null

    const { data, error } = await supabaseClient
      .from('offices')
      .select('*')
      .eq('id', id)
      .single()

    return error ? null : data
  },

  // Service Checklists
  async getServiceChecklists() {
    if (!supabaseClient) return []

    const { data, error } = await supabaseClient
      .from('service_checklists')
      .select('*')
      .eq('status', 'verified')

    return error ? [] : data
  },

  async getServiceChecklist(serviceKey) {
    if (!supabaseClient) return null

    const { data, error } = await supabaseClient
      .from('service_checklists')
      .select('*')
      .eq('service_key', serviceKey)
      .single()

    return error ? null : data
  },

  // Submissions
  async submitUpdate(submissionData) {
    const payload = {
      submitter_name: safeTrim(submissionData.name || submissionData.submitter_name) || 'Anonymous',
      service_type: safeTrim(submissionData.service || submissionData.service_type),
      branch_name: safeTrim(submissionData.branch || submissionData.branch_name),
      update_type: safeTrim(submissionData.type || submissionData.update_type) || 'other',
      details: safeTrim(submissionData.details)
    }

    try {
      const json = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      return { success: true, submission: json.submission || null, source: 'api' }
    } catch (apiError) {
      return {
        success: false,
        error: apiError.message || 'Unable to reach the submission service.'
      }
    }
  },

  // Office Suggestions
  async submitOfficeSuggestion(suggestionData) {
    const payload = {
      submitter_name: safeTrim(suggestionData.submitterName || suggestionData.submitter_name || suggestionData.name) || 'Anonymous',
      contact: safeTrim(suggestionData.contact) || null,
      office_name: safeTrim(suggestionData.officeName || suggestionData.office_name || suggestionData.office),
      office_type: safeTrim(suggestionData.officeType || suggestionData.office_type || suggestionData.type),
      city: safeTrim(suggestionData.city),
      address: safeTrim(suggestionData.address),
      notes: safeTrim(suggestionData.notes || suggestionData.details) || null
    }

    try {
      const json = await apiRequest('/api/office-suggestions', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      return { success: true, suggestion: json.suggestion || null, source: 'api' }
    } catch (apiError) {
      return {
        success: false,
        error: apiError.message || 'Unable to reach the submission service.'
      }
    }
  },

  async suggestOffice(suggestionData) {
    return this.submitOfficeSuggestion(suggestionData)
  },

  // Analytics
  async trackPageView(pagePath, metadata = {}) {
    const payload = {
      session_id: getVisitorId(),
      page_path: pagePath,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
      metadata
    }

    try {
      await apiRequest('/api/track-visit', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      return { success: true, source: 'api' }
    } catch (apiError) {
      try {
        await insertWithoutSelect('page_views', payload)
        return { success: true, source: 'supabase-fallback' }
      } catch (supabaseError) {
        console.error('Analytics error:', supabaseError.message || apiError.message)
        return {
          success: false,
          error: supabaseError.message || apiError.message,
          details: apiError.message
        }
      }
    }
  },

  // Office Reviews (for future use)
  async submitReview(officeId, reviewData) {
    if (!supabaseClient) {
      return { success: false, error: 'Supabase client is not available.' }
    }

    const { data, error } = await supabaseClient
      .from('office_reviews')
      .insert([{
        office_id: officeId,
        reviewer_name: reviewData.name,
        rating: reviewData.rating,
        review: reviewData.review,
        wait_time: reviewData.waitTime,
        visit_date: reviewData.visitDate
      }])
      .select()

    return { success: !error, data, error }
  },

  async getOfficeReviews(officeId) {
    if (!supabaseClient) return []

    const { data, error } = await supabaseClient
      .from('office_reviews')
      .select('*')
      .eq('office_id', officeId)
      .order('created_at', { ascending: false })

    return error ? [] : data
  }
}

window.GOVHUB_CONFIG = APP_CONFIG
window.DB_API = DB_API
