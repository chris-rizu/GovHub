// Server handler for marking submissions (move this file to /api/mark-submission.js on your deployment)
// Requires environment variables:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id, status } = req.body || {}
  if (!id || !status) return res.status(400).json({ error: 'id and status required' })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: 'Missing Supabase server credentials' })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  try {
    const { data, error } = await supabase
      .from('submissions')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true, submission: data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
