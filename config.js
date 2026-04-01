// ===========================================
// SUPABASE CONFIGURATION
// ===========================================

const SUPABASE_CONFIG = {
  url: 'https://exdmyrzjdrfnqrodkyvm.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4ZG15cnpqZHJmbnFyb2RreXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTYwODMsImV4cCI6MjA5MDU5MjA4M30.o3HjL7ZBVEQVu4sWhOx5ZnA1pdn8N1-7GRFjuLNPprM'
};

// ===========================================
// SUPABASE CLIENT INITIALIZATION
// ===========================================

const { createClient } = supabase;

const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// ===========================================
// DATABASE API
// ===========================================

const DB_API = {
  // Offices
  async getOffices(filters = {}) {
    let query = supabase.from('offices').select('*');

    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }

    const { data, error } = await query;
    return error ? [] : data;
  },

  async getOfficeById(id) {
    const { data, error } = await supabase
      .from('offices')
      .select('*')
      .eq('id', id)
      .single();
    return error ? null : data;
  },

  // Service Checklists
  async getServiceChecklists() {
    const { data, error } = await supabase
      .from('service_checklists')
      .select('*')
      .eq('status', 'verified');
    return error ? [] : data;
  },

  async getServiceChecklist(serviceKey) {
    const { data, error } = await supabase
      .from('service_checklists')
      .select('*')
      .eq('service_key', serviceKey)
      .single();
    return error ? null : data;
  },

  // Submissions
  async submitUpdate(submissionData) {
    const { data, error } = await supabase
      .from('submissions')
      .insert([{
        submitter_name: submissionData.name,
        service_type: submissionData.service,
        branch_name: submissionData.branch,
        update_type: submissionData.type,
        details: submissionData.details
      }])
      .select();
    return { success: !error, data, error };
  },

  // Office Suggestions
  async suggestOffice(suggestionData) {
    const { data, error } = await supabase
      .from('office_suggestions')
      .insert([{
        submitter_name: suggestionData.name,
        contact: suggestionData.contact,
        office_name: suggestionData.officeName,
        office_type: suggestionData.officeType,
        city: suggestionData.city,
        address: suggestionData.address,
        notes: suggestionData.notes
      }])
      .select();
    return { success: !error, data, error };
  },

  // Analytics
  async trackPageView(pagePath, metadata = {}) {
    // Generate a simple session ID
    let sessionId = sessionStorage.getItem('govhub_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('govhub_session_id', sessionId);
    }

    const { error } = await supabase
      .from('page_views')
      .insert([{
        session_id: sessionId,
        page_path: pagePath,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        metadata: metadata
      }]);

    return { success: !error };
  },

  // Office Reviews (for future use)
  async submitReview(officeId, reviewData) {
    const { data, error } = await supabase
      .from('office_reviews')
      .insert([{
        office_id: officeId,
        reviewer_name: reviewData.name,
        rating: reviewData.rating,
        review: reviewData.review,
        wait_time: reviewData.waitTime,
        visit_date: reviewData.visitDate
      }])
      .select();
    return { success: !error, data, error };
  },

  async getOfficeReviews(officeId) {
    const { data, error } = await supabase
      .from('office_reviews')
      .select('*')
      .eq('office_id', officeId)
      .order('created_at', { ascending: false });
    return error ? [] : data;
  }
};

// ===========================================
// ANALYTICS TRACKING
// ===========================================

// Track page view on load
function trackPageView(pagePath) {
  DB_API.trackPageView(pagePath, {
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    is_mobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }).catch(err => console.error('Analytics error:', err));
}

// Track initial page load
document.addEventListener('DOMContentLoaded', () => {
  trackPageView(window.location.pathname);
});

// Track navigation (for SPA navigation)
function trackNavigation(toPath) {
  trackPageView(toPath);
}
