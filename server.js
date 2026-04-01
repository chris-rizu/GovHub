import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const PORT = Number(process.env.PORT || 3000)
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

const hasSupabaseConfig = Boolean(SUPABASE_URL && SERVICE_ROLE)
const supabase = hasSupabaseConfig ? createClient(SUPABASE_URL, SERVICE_ROLE) : null

if (!hasSupabaseConfig) {
  console.warn('Supabase admin features are disabled until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
}

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(process.cwd()))

function requireSupabase(req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      error: 'Server is missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    })
  }
  next()
}

async function verifyAdmin(req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      error: 'Server is missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    })
  }

  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization token' })
    }

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const email = (data.user.email || '').toLowerCase()
    if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    req.admin = data.user
    next()
  } catch (error) {
    console.error('verifyAdmin failed', error)
    return res.status(500).json({ error: 'Server error' })
  }
}

function normalizeLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function buildCountMap(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || 'unknown'
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

async function fetchCount(table, status) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (status) {
    query = query.eq('status', status)
  }
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'govhub-admin-api',
    supabaseConfigured: hasSupabaseConfig,
    timestamp: new Date().toISOString()
  })
})

app.post('/api/track-visit', requireSupabase, async (req, res) => {
  try {
    const body = req.body || {}
    const payload = {
      session_id: body.session_id || null,
      page_path: body.page_path || req.headers['x-path'] || '/',
      referrer: body.referrer || req.get('Referrer') || null,
      user_agent: body.user_agent || req.get('User-Agent') || null,
      metadata: body.metadata || null
    }

    const { error } = await supabase.from('page_views').insert(payload)
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.json({ success: true })
  } catch (error) {
    console.error('track-visit failed', error)
    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/admin/overview', verifyAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      recentVisitsResult,
      pendingSuggestions,
      approvedSuggestions,
      pendingSubmissions,
      approvedSubmissions
    ] = await Promise.all([
      supabase
        .from('page_views')
        .select('id, session_id, page_path, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
      fetchCount('office_suggestions', 'pending'),
      fetchCount('office_suggestions', 'approved'),
      fetchCount('submissions', 'pending'),
      fetchCount('submissions', 'approved')
    ])

    if (recentVisitsResult.error) {
      return res.status(500).json({ error: recentVisitsResult.error.message })
    }

    const recentVisits = recentVisitsResult.data || []
    const topPages = Object.entries(buildCountMap(recentVisits, 'page_path'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, views]) => ({ path, views }))

    return res.json({
      metrics: {
        visitsLast24h: recentVisits.length,
        uniqueVisitorsLast24h: new Set(recentVisits.map((visit) => visit.session_id || visit.id)).size,
        pageviewsLast24h: recentVisits.length,
        pendingSuggestions,
        approvedSuggestions,
        pendingSubmissions,
        approvedSubmissions
      },
      recentVisits: recentVisits.slice(0, 10),
      topPages
    })
  } catch (error) {
    console.error('admin overview failed', error)
    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/admin/suggestions', verifyAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    const limit = normalizeLimit(req.query.limit, 100)
    const page = normalizeLimit(req.query.page, 1, 1000)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('office_suggestions')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({
      suggestions: data || [],
      total: count || 0,
      page,
      limit
    })
  } catch (error) {
    console.error('fetch suggestions failed', error)
    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/admin/submissions', verifyAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    const limit = normalizeLimit(req.query.limit, 100)
    const page = normalizeLimit(req.query.page, 1, 1000)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('submissions')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({
      submissions: data || [],
      total: count || 0,
      page,
      limit
    })
  } catch (error) {
    console.error('fetch submissions failed', error)
    return res.status(500).json({ error: error.message })
  }
})

app.post('/api/admin/suggestions/:id/moderate', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { status, adminNotes = null } = req.body || {}

    if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'A valid suggestion id and status are required.' })
    }

    const { data, error } = await supabase
      .from('office_suggestions')
      .update({
        status,
        admin_notes: adminNotes
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, suggestion: data })
  } catch (error) {
    console.error('moderate suggestion failed', error)
    return res.status(500).json({ error: error.message })
  }
})

app.post('/api/admin/submissions/:id/moderate', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { status, adminNotes = null } = req.body || {}

    if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'A valid submission id and status are required.' })
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_at: status === 'pending' ? null : new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, submission: data })
  } catch (error) {
    console.error('moderate submission failed', error)
    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/metrics', verifyAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('page_views')
      .select('id, session_id')
      .gte('created_at', since)
      .limit(500)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const visits = data || []
    return res.json({
      metrics: {
        visitsLast24h: visits.length,
        uniqueVisitorsLast24h: new Set(visits.map((visit) => visit.session_id || visit.id)).size,
        pageviewsLast24h: visits.length
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/fetch-suggestions', verifyAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    const limit = normalizeLimit(req.query.perPage || req.query.limit, 50)
    const page = normalizeLimit(req.query.page, 1, 1000)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('office_suggestions')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ suggestions: data || [], total: count || 0 })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

app.post('/api/update-suggestion', verifyAdmin, async (req, res) => {
  try {
    const { id, status, adminNotes = null } = req.body || {}
    if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'A valid suggestion id and status are required.' })
    }

    const { data, error } = await supabase
      .from('office_suggestions')
      .update({ status, admin_notes: adminNotes })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, suggestion: data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

app.post('/api/mark-submission', verifyAdmin, async (req, res) => {
  try {
    const { id, status, adminNotes = null } = req.body || {}
    if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'A valid submission id and status are required.' })
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_at: status === 'pending' ? null : new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, submission: data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
