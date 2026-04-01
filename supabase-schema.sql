-- ===========================================
-- GovHub Cebu - Supabase Database Schema
-- ===========================================
-- Run this in Supabase SQL Editor
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- TABLES
-- ===========================================

-- 1. Government Offices Table
CREATE TABLE IF NOT EXISTS offices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lto', 'sss', 'philhealth', 'nbi', 'dfa', 'bir', 'pagibig', 'owwa', 'police', 'barangay', 'cityhall')),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  contact_number TEXT,
  operating_hours JSONB, -- Store hours as {"monday": "8AM-5PM", ...}
  requirements JSONB, -- Store specific requirements for this office
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Service Checklists Table
CREATE TABLE IF NOT EXISTS service_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_key TEXT NOT NULL UNIQUE, -- e.g., 'lto', 'sss', 'nbi'
  title TEXT NOT NULL,
  subtitle TEXT,
  category TEXT CHECK (category IN ('id', 'loan', 'permit', 'other')),
  documents JSONB, -- List of required documents
  steps JSONB, -- Step-by-step process
  fees JSONB, -- Fee structure
  tips JSONB, -- Helpful tips
  processing_time TEXT,
  status TEXT DEFAULT 'verified' CHECK (status IN ('verified', 'pending', 'draft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Community Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  update_type TEXT CHECK (update_type IN ('fee', 'requirement', 'process', 'schedule', 'tip', 'other')),
  details TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 4. Office Suggestions Table
CREATE TABLE IF NOT EXISTS office_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_name TEXT NOT NULL,
  contact TEXT,
  office_name TEXT NOT NULL,
  office_type TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  admin_notes TEXT,
  votes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE office_suggestions
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 5. Office Reviews Table (optional, for future)
CREATE TABLE IF NOT EXISTS office_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  wait_time TEXT, -- e.g., "30 mins", "2 hours"
  visit_date DATE,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEXES for better performance
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_offices_type ON offices(type);
CREATE INDEX IF NOT EXISTS idx_offices_city ON offices(city);
CREATE INDEX IF NOT EXISTS idx_offices_location ON offices USING GIST(
  point(longitude, latitude)
);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_office_suggestions_status ON office_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_office_suggestions_votes ON office_suggestions(votes DESC);

-- ===========================================
-- TRIGGERS for updated_at
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON offices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_checklists_updated_at BEFORE UPDATE ON service_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_reviews ENABLE ROW LEVEL SECURITY;

-- Public read access for offices and checklists
CREATE POLICY "Public can view offices" ON offices
  FOR SELECT USING (true);

CREATE POLICY "Public can view service checklists" ON service_checklists
  FOR SELECT USING (true);

-- Public can insert submissions and suggestions
CREATE POLICY "Public can insert submissions" ON submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can insert office suggestions" ON office_suggestions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can insert reviews" ON office_reviews
  FOR INSERT WITH CHECK (true);

-- Public can view reviews
CREATE POLICY "Public can view reviews" ON office_reviews
  FOR SELECT USING (true);

-- ===========================================
-- ANALYTICS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT,
  page_path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  metadata JSONB, -- Store additional info like device type, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert page views" ON page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can aggregate page views" ON page_views
  FOR SELECT USING (true);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON page_views(page_path);

-- View for daily stats
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  DATE(created_at) as visit_date,
  COUNT(DISTINCT session_id) as unique_visitors,
  COUNT(*) as total_page_views,
  COUNT(DISTINCT country) as countries
FROM page_views
GROUP BY DATE(created_at)
ORDER BY visit_date DESC;

-- ===========================================
-- INSERT INITIAL DATA (Service Checklists)
-- ===========================================

INSERT INTO service_checklists (service_key, title, subtitle, category, documents, steps, fees, tips, processing_time) VALUES
  ('lto', 'LTO Driver''s License Renewal', 'Non-Professional or Professional • 10-year validity', 'id',
   '["Original Driver''s License", "CDE Certificate", "Medical Certificate from accredited clinic", "Proof of payment"]'::jsonb,
   '["Complete CDE online course at portal.lto.gov.ph", "Visit LTO-accredited medical clinic", "Proceed to LTO branch with documents", "Pay fees via LTMS or eGovPH", "Have photo and signature taken", "Receive claim stub"]'::jsonb,
   '[{"fee": "Non-Professional", "amount": "₱585"}, {"fee": "Professional", "amount": "₱680"}, {"fee": "CDE Online Course", "amount": "₱300"}, {"fee": "Medical Exam", "amount": "₱300-500"}]'::jsonb,
   '["Best done early morning for shortest queue", "Mandaue typically has shorter lines than Cebu City", "Wear a shirt with collar for ID photo"]'::jsonb,
   'Same day (2-4 hours)'),

  ('sss', 'SSS Salary Loan', '1-Month or 2-Month Term • Up to ₱40,000', 'loan',
   '["36 posted contributions for 1-month loan (6 within last 12 months)", "72 posted contributions for 2-month loan", "Valid government-issued ID", "Employer updated with contributions"]'::jsonb,
   '["Log in to my.sss.gov.ph", "Navigate to Loan Application > Salary Loan", "Verify eligibility and amount", "Fill out and submit application", "Wait for approval via SMS/email (1-3 days)"]'::jsonb,
   '[{"fee": "1-Month Loan", "amount": "Up to ₱15,000"}, {"fee": "2-Month Loan", "amount": "Up to ₱40,000"}, {"fee": "Interest Rate", "amount": "8% per annum"}]'::jsonb,
   '["Apply online via My.SSS app or portal", "Ensure disbursement account is enrolled before applying"]'::jsonb,
   '1-3 business days'),

  ('philhealth', 'PhilHealth New Member Registration', 'ID + Membership', 'id',
   '["2 copies of PMRF (PhilHealth Member Registration Form)", "Valid proof of identity", "Birth certificate (for first-time registrants)", "Proof of income (for self-employed)"]'::jsonb,
   '["Download PMRF form from philhealth.gov.ph", "Register account at eregister.philhealth.gov.ph", "Upload scanned documents", "Wait for email notification (5-10 working days)"]'::jsonb,
   '[{"fee": "Annual Premium (starts at)", "amount": "₱2,400/year"}, {"fee": "ID Card Issuance", "amount": "FREE"}]'::jsonb,
   '["Online application reduces wait time significantly", "You can now register and upload documents online"]'::jsonb,
   '5-10 working days'),

  ('nbi', 'NBI Clearance', 'For Employment • Travel • License Application', 'id',
   '["Two valid government-issued IDs", "Online reference number", "Payment of ₱155"]'::jsonb,
   '["Visit clearance.nbi.gov.ph and create account", "Fill out online application form", "Select appointment schedule and branch", "Pay clearance fee online", "Visit branch for biometrics and photo"]'::jsonb,
   '[{"fee": "NBI Clearance Fee", "amount": "₱155"}, {"fee": "Free for", "amount": "First-time job seekers"}]'::jsonb,
   '["Mandaue and SM Cebu have shorter queues", "Book morning appointments for faster processing"]'::jsonb,
   'Same day'),

  ('passport', 'DFA Passport Renewal', 'ePassport 5 or 10 years validity', 'id',
   '["Old/Current Passport (original)", "Confirmed online appointment", "eReceipt from DFA payment", "Valid backup government ID (recommended)"]'::jsonb,
   '["Visit passport.gov.ph and schedule appointment", "Select DFA Cebu and preferred date/time", "Pay appointment fee online", "Print application form", "Go to DFA Cebu on scheduled date"]'::jsonb,
   '[{"fee": "Regular Processing (30 days)", "amount": "₱950"}, {"fee": "Expedited Processing (14 days)", "amount": "₱1,200"}]'::jsonb,
   '["Appointment slots released at 12:00 MN and 12:00 NN", "Wear a collared shirt (white or light color)"]'::jsonb,
   'Same day for processing'),

  ('barangay', 'Barangay Clearance', 'Employment • Business', 'id',
   '["Any valid government-issued ID", "Proof of residency (sometimes required)", "Barangay clearance form"]'::jsonb,
   '["Go to your specific barangay hall", "Request and fill out clearance form", "Present valid ID and proof of residency", "Pay fee", "Wait for processing (15-30 minutes)"]'::jsonb,
   '[{"fee": "Barangay Clearance", "amount": "₱50 - ₱150"}, {"fee": "Indigency Certificate", "amount": "₱20 - ₱50"}]'::jsonb,
   '["Best to visit during mid-morning (9-11 AM)", "Go directly to your specific barangay hall"]'::jsonb,
   '15-30 minutes')

ON CONFLICT (service_key) DO NOTHING;

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Function to find nearest offices
CREATE OR REPLACE FUNCTION find_nearest_offices(
  lat DECIMAL,
  lng DECIMAL,
  office_type_param TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  address TEXT,
  city TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.type,
    o.address,
    o.city,
    o.latitude,
    o.longitude,
    ROUND(
      6371 * acos(
        cos(radians(lat)) * cos(radians(o.latitude)) *
        cos(radians(o.longitude) - radians(lng)) +
        sin(radians(lat)) * sin(radians(o.latitude))
      ), 2
    ) AS distance_km
  FROM offices o
  WHERE (office_type_param IS NULL OR o.type = office_type_param)
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VIEWS for common queries
-- ===========================================

-- View for office statistics
CREATE OR REPLACE VIEW office_stats AS
SELECT
  type,
  city,
  COUNT(*) as office_count
FROM offices
GROUP BY type, city
ORDER BY type, city;

-- View for recent submissions
CREATE OR REPLACE VIEW recent_submissions AS
SELECT
  s.id,
  s.submitter_name,
  s.service_type,
  s.branch_name,
  s.update_type,
  s.status,
  s.created_at
FROM submissions s
WHERE s.status = 'pending'
ORDER BY s.created_at DESC
LIMIT 50;
