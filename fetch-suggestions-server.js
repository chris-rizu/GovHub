// fetch-suggestions-server.js
// Server endpoint to fetch suggestions with pagination and filters
// Move this file to /api/fetch-suggestions.js on deployment
// Environment variables required:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: 'Missing Supabase server credentials' })

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    // GET params: page, perPage, status, city
    const { page = 1, perPage = 50, status = 'pending', city } = req.method === 'GET' ? req.query : req.body || {}
    const limit = Math.min(parseInt(perPage, 10) || 50, 1000)
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit

    let query = supabase.from('office_suggestions').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (city) query = query.ilike('city', `%${city}%`)

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) return res.status(500).json({ error: error.message })

    return res.json({ success: true, suggestions: data || [], total: count || 0, page: parseInt(page, 10) || 1, perPage: limit })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
