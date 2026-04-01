// export-suggestions-csv-server.js
// Server endpoint to export suggestions as CSV
// Move this file to /api/export-suggestions-csv.js on deployment
// Environment variables required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: 'Missing Supabase server credentials' })

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Optional filters via query: status, city
    const { status = 'pending', city } = req.method === 'GET' ? req.query : req.body || {}

    let query = supabase.from('office_suggestions').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (city) query = query.ilike('city', `%${city}%`)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    const rows = (data || []).map(r => ({
      id: r.id,
      submitter_name: r.submitter_name,
      contact: r.contact || '',
      office_name: r.office_name,
      office_type: r.office_type,
      city: r.city,
      address: r.address,
      votes: r.votes || 0,
      status: r.status,
      notes: r.notes || '',
      created_at: r.created_at
    }))

    // Try to use csv-stringify; if not available, fallback to manual CSV
    let csv = ''
    try {
      csv = stringify(rows, { header: true })
    } catch (e) {
      const headers = Object.keys(rows[0] || {})
      const lines = [headers.join(',')]
      rows.forEach(r => lines.push(headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',')))
      csv = lines.join('\n')
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="suggestions-${new Date().toISOString().slice(0,10)}.csv"`)
    res.status(200).send(csv)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
