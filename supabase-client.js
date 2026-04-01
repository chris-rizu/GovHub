// supabase-client.js
// Browser-side Supabase client and DB_API wrapper.
// IMPORTANT: Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project's values.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://exdmyrzjdrfnqrodkyvm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4ZG15cnpqZHJmbnFyb2RreXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTYwODMsImV4cCI6MjA5MDU5MjA4M30.o3HjL7ZBVEQVu4sWhOx5ZnA1pdn8N1-7GRFjuLNPprM'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('supabase-client.js: Replace SUPABASE_URL and SUPABASE_ANON_KEY with your Supabase project values')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Expose a simple DB_API used by the app.js fallback logic
window.DB_API = {
  async submitUpdate(data) {
    try {
      const payload = {
        submitter_name: data.name || data.submitter_name || 'Anonymous',
        service_type: data.service || data.service_type || null,
        branch_name: data.branch || data.branch_name || null,
        update_type: data.type || data.update_type || 'other',
        details: data.details || data.details || null
      }
      const { data: res, error } = await supabase.from('submissions').insert([payload]).select().single()
      if (error) return { success: false, error: error.message }
      return { success: true, submission: res }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async submitOfficeSuggestion(data) {
    try {
      const payload = {
        submitter_name: data.submitterName || data.submitter_name || 'Anonymous',
        contact: data.contact || null,
        office_name: data.officeName || data.office_name || data.office || null,
        office_type: data.officeType || data.office_type || data.type || null,
        city: data.city || null,
        address: data.address || null,
        notes: data.notes || data.details || null
      }
      const { data: res, error } = await supabase.from('office_suggestions').insert([payload]).select().single()
      if (error) return { success: false, error: error.message }
      return { success: true, suggestion: res }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async getSuggestions({ status = 'pending', limit = 200 } = {}) {
    try {
      const { data: res, error } = await supabase
        .from('office_suggestions')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, suggestions: res }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async upvoteSuggestion(id) {
    try {
      const { data: row, error: fetchErr } = await supabase.from('office_suggestions').select('votes').eq('id', id).single()
      if (fetchErr) return { success: false, error: fetchErr.message }
      const newVotes = (row.votes || 0) + 1
      const { data: updated, error } = await supabase.from('office_suggestions').update({ votes: newVotes }).eq('id', id).select().single()
      if (error) return { success: false, error: error.message }
      return { success: true, suggestion: updated }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async markSuggestion(id, status, adminNotes = null) {
    try {
      const { data: updated, error } = await supabase
        .from('office_suggestions')
        .update({ status: status, notes: adminNotes })
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, suggestion: updated }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async fetchPendingSubmissions(limit = 100) {
    try {
      const { data: res, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return { success: false, error: error.message }
      return { success: true, submissions: res }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // Admin helpers using Supabase Auth (client-side). For sensitive operations, consider using Edge Functions + service_role key.
  auth: {
    async signIn({ email, password }) {
      return supabase.auth.signInWithPassword({ email, password })
    },
    async getSession() {
      return supabase.auth.getSession()
    },
    async signOut() {
      return supabase.auth.signOut()
    },
    onAuthStateChange(callback) {
      return supabase.auth.onAuthStateChange(callback)
    },
    user() {
      return supabase.auth.getUser()
    }
  }
}
