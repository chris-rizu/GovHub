// Server handler for approving/rejecting suggestions (move this file to /api/update-suggestion.js on your deployment)
// Requires environment variables:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id, status, adminNotes } = req.body || {}
  if (!id || !status) return res.status(400).json({ error: 'id and status required' })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: 'Missing Supabase server credentials' })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  try {
    const payload = { status }
    if (adminNotes) payload.admin_notes = adminNotes

    const { data, error } = await supabase
      .from('office_suggestions')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true, suggestion: data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
