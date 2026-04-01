// ===========================================
// KAILANGANKO.PH v7.0 - Simplified (No Auth)
// Main Application JavaScript
// ===========================================

// ===========================================
// LOCALSTORAGE DATABASE API
// ===========================================
const DB = {
  get: (key) => {
    try {
      return JSON.parse(localStorage.getItem(`govhub_${key}`)) || null
    } catch { return null }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(`govhub_${key}`, JSON.stringify(value))
      return true
    } catch { return false }
  },
  remove: (key) => {
    localStorage.removeItem(`govhub_${key}`)
  },
  clear: () => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('govhub_')) localStorage.removeItem(k)
    })
  }
}

// ===========================================
// SUBMISSIONS SYSTEM (No login required)
// ===========================================
const Submissions = {
  add: (data) => {
    const submissions = DB.get('submissions') || []
    const newSubmission = {
      id: Date.now().toString(),
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    submissions.push(newSubmission)
    DB.set('submissions', submissions)
    return { success: true, submission: newSubmission }
  },
  getAll: () => DB.get('submissions') || []
}

// ===========================================
// OFFICE SUGGESTIONS SYSTEM (Community-powered)
// ===========================================
const OfficeSuggestions = {
  add: (data) => {
    const suggestions = DB.get('officeSuggestions') || []
    const newSuggestion = {
      id: Date.now().toString(),
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      votes: 0
    }
    suggestions.push(newSuggestion)
    DB.set('officeSuggestions', suggestions)
    return { success: true, suggestion: newSuggestion }
  },
  getAll: () => DB.get('officeSuggestions') || [],
  getById: (id) => {
    const suggestions = DB.get('officeSuggestions') || []
    return suggestions.find(s => s.id === id)
  },
  upvote: (id) => {
    const suggestions = DB.get('officeSuggestions') || []
    const index = suggestions.findIndex(s => s.id === id)
    if (index !== -1) {
      suggestions[index].votes = (suggestions[index].votes || 0) + 1
      DB.set('officeSuggestions', suggestions)
      return { success: true, votes: suggestions[index].votes }
    }
    return { success: false }
  }
}

// ===========================================
// GEOLOCATION SERVICE
// ===========================================
const GeoLocation = {
  getCurrentPosition: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      )
    })
  },
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  },
  cityCoordinates: {
    'Cebu City': { lat: 10.3157, lng: 123.8854 },
    'Mandaue': { lat: 10.3169, lng: 123.9288 },
    'Lapu-Lapu': { lat: 10.3129, lng: 123.9688 },
    'Consolacion': { lat: 10.3833, lng: 123.9500 },
    'Talisay': { lat: 10.2583, lng: 123.8333 },
    'Minglanilla': { lat: 10.2333, lng: 123.8000 },
    'Naga': { lat: 10.2090, lng: 123.7500 },
    'Carcar': { lat: 10.1083, lng: 123.6500 },
    'Toledo': { lat: 10.2000, lng: 123.6333 },
    'Bogo': { lat: 11.0500, lng: 124.0000 },
    'Danao': { lat: 10.5000, lng: 124.0167 }
  },
  getNearestCity: (lat, lng) => {
    let nearest = 'Cebu City'
    let minDist = Infinity
    for (const [city, coords] of Object.entries(GeoLocation.cityCoordinates)) {
      const dist = GeoLocation.calculateDistance(lat, lng, coords.lat, coords.lng)
      if (dist < minDist) {
        minDist = dist
        nearest = city
      }
    }
    return { city: nearest, distance: minDist }
  }
}

// ===========================================
// APP STATE
// ===========================================
let currentTheme = DB.get('theme') || 'dark'

// Track page visit (lightweight). Records to Supabase via server endpoint /api/track-visit
;(function trackVisit(){
  try {
    const payload = {
      session_id: localStorage.getItem('govhub_session') || null,
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
      metadata: { hostname: location.hostname }
    }
    // send but don't block
    fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(()=>{})
  } catch (e) { console.error('trackVisit failed', e) }
})()

let currentLocation = DB.get('location') || 'Locations'
let currentFilter = 'all'
let searchQuery = ''
let currentModalKey = null
let currentTab = 0
let userLocation = null
let deferredPrompt = null

// ===========================================
// SERVICES DATA
// ===========================================
const servicesData = {
  lto: { title: "LTO Driver's License Renewal", subtitle: "Non-Professional & Professional", status: "UPDATED TODAY", value: "Same-day", change: "2 branches added", key: "lto", category: "permit" },
  sss: { title: "SSS Salary Loan", subtitle: "1-month or 2-month", status: "UPDATED TODAY", value: "Up to ₱40,000", change: "Online live", key: "sss", category: "loan" },
  philhealth: { title: "PhilHealth New Member", subtitle: "ID + Membership", status: "UPDATED TODAY", value: "₱2,400/year", change: "Upload enabled", key: "philhealth", category: "id" },
  nbi: { title: "NBI Clearance", subtitle: "Job • Travel • License", status: "UPDATED TODAY", value: "₱155", change: "Mandaue fastest", key: "nbi", category: "id" },
  passport: { title: "DFA Passport Renewal", subtitle: "ePassport 5 or 10 years", status: "UPDATED TODAY", value: "₱950", change: "Slots open", key: "passport", category: "id" },
  barangay: { title: "Barangay Clearance", subtitle: "Employment • Business", status: "UPDATED TODAY", value: "₱50–150", change: "15-minute process", key: "barangay", category: "id" },
  bir: { title: "BIR TIN Application", subtitle: "New Tax ID", status: "VERIFIED", value: "Free", change: "eReg available", key: "bir", category: "id" },
  pagibig: { title: "Pag-IBIG Housing Loan", subtitle: "Acquisition • Construction", status: "UPDATED TODAY", value: "Up to ₱6M", change: "Lower rates", key: "pagibig", category: "loan" },
  owwa: { title: "OWWA Membership", subtitle: "OFW Document Processing", status: "VERIFIED", value: "₱100", change: "New portal", key: "owwa", category: "id" },
  police: { title: "Police Clearance", subtitle: "Local Employment", status: "UPDATED TODAY", value: "₱160", change: "Online payment", key: "police", category: "id" },
  cedula: { title: "Community Tax Certificate", subtitle: "Cedula • Basic Requirement", status: "VERIFIED", value: "₱50–500", change: "City hall", key: "cedula", category: "id" },
  business: { title: "Business Permit Renewal", subtitle: "Mayor's Permit", status: "UPDATED TODAY", value: "Varies", change: "Online booking", key: "business", category: "permit" }
}

const cities = ["Locations", "Cebu City", "Mandaue", "Lapu-Lapu", "Consolacion", "Talisay", "Minglanilla", "Naga", "Carcar", "Toledo", "Bogo", "Danao"]

// ===========================================
// OFFICE LOCATIONS DATA
// ===========================================
const officeLocations = {
  // LTO Offices
  lto: [
    { id: 'lto-consolacion', name: 'LTO Consolacion Extension Office', address: '2nd Floor (near Cinema 1 & 2), SM City Consolacion, Consolacion, Cebu', lat: 10.3769, lng: 123.9569, type: 'lto' },
    { id: 'lto-mandaue', name: 'LTO Mandaue District Office', address: '3rd Floor, City Time Square 2, Tipolo, Mandaue City', lat: 10.3236, lng: 123.9222, type: 'lto' },
    { id: 'lto-cebu-mega', name: 'LTO Cebu City Mega Licensing Center', address: 'SM Seaside City, Seaview Wing, Ground Floor, Cebu South Coastal Road (SRP), Barangay Mambaling, Cebu City', lat: 10.2800, lng: 123.8800, type: 'lto' },
    { id: 'lto-cebu-district', name: 'LTO Cebu City District Office', address: '4th Floor, Robinsons Galleria Cebu, General Maxilom Avenue cor. Sergio Osmeña Blvd., Cebu City', lat: 10.3150, lng: 123.8850, type: 'lto' },
    { id: 'lto-lapulapu', name: 'LTO Lapu-Lapu District Office', address: 'City Hall Drive, Pajo, Lapu-Lapu City', lat: 10.3175, lng: 123.9631, type: 'lto' },
    { id: 'lto-talisay', name: 'LTO Talisay Extension', address: 'Natalio B. Bacalso Highway (near Tabunok), Talisay City', lat: 10.2658, lng: 123.8420, type: 'lto' }
  ],
  // SSS Offices
  sss: [
    { id: 'sss-cebu-main', name: 'SSS Cebu Main Branch', address: 'SSS Building, Brgy. Kalubihan, Osmeña Boulevard, Cebu City', lat: 10.298513, lng: 123.896675, type: 'sss' },
    { id: 'sss-cebu-nra', name: 'SSS Cebu NRA', address: 'Level 3, Robinsons Galleria Cebu, General Maxilom Avenue cor. Osmeña Blvd., North Reclamation Area, Cebu City', lat: 10.298556, lng: 123.896606, type: 'sss' },
    { id: 'sss-mandaue', name: 'SSS Mandaue Branch', address: '2nd Floor, Parkmall, Ouano Avenue, Mandaue Reclamation Area, Mandaue City', lat: 10.325227, lng: 123.933853, type: 'sss' },
    { id: 'sss-lapulapu', name: 'SSS Lapu-Lapu Branch', address: 'Ground Floor Annex Bldg., Gaisano Mactan Island Mall, Pajo, Lapu-Lapu City', lat: 10.317515, lng: 123.963119, type: 'sss' },
    { id: 'sss-talisay', name: 'SSS Talisay Branch', address: 'Rosalie Bldg., Gaisano Grand Fiesta Mall, Highway, Tabunok, Talisay City', lat: 10.265762, lng: 123.841986, type: 'sss' },
    { id: 'sss-danao', name: 'SSS Danao Branch', address: 'City Mall Danao, Oliver Sr. Extension cor. F. Ralota St., Poblacion, Danao City', lat: 10.518662, lng: 124.026480, type: 'sss' },
    { id: 'sss-toledo', name: 'SSS Toledo Branch', address: '2nd Floor, TE Bldg., Diosdado Macapagal Highway, Sangi, Toledo City', lat: 10.386159, lng: 123.649634, type: 'sss' },
    { id: 'sss-bogo', name: 'SSS Bogo Branch', address: 'G/F and 2/F, Osing Bldg., Sim Bogo Business Park, P. Rodriguez St., Bogo City', lat: 11.049168, lng: 124.004107, type: 'sss' }
  ],
  // PhilHealth Offices
  philhealth: [
    { id: 'philhealth-ro7', name: 'PhilHealth Regional Office 7', address: '7th & 8th Floor, Skytower, N. Escario Street cor. Acacia Street, Cebu City', lat: 10.3185, lng: 123.8920, type: 'philhealth' },
    { id: 'philhealth-mandaue', name: 'PhilHealth Mandaue LHIO', address: '2nd Floor, Parkmall, Ouano Avenue, Mandaue Reclamation Area, Mandaue City', lat: 10.3252, lng: 123.9339, type: 'philhealth' },
    { id: 'philhealth-lapulapu', name: 'PhilHealth Express / LHIO Lapu-Lapu', address: 'Gaisano Mactan Island Mall, Pajo, Lapu-Lapu City', lat: 10.317515, lng: 123.963119, type: 'philhealth' }
  ],
  // NBI Offices
  nbi: [
    { id: 'nbi-ceviro', name: 'NBI Central Visayas Regional Office (CEVRO)', address: 'Capitol Site, 5 N. Escario Street, Cebu City', lat: 10.3100, lng: 123.8900, type: 'nbi' },
    { id: 'nbi-mandaue', name: 'NBI Mandaue Satellite', address: '3rd Floor, J Center Mall, A.S. Fortuna Street, Bakilid, Mandaue City', lat: 10.3230, lng: 123.9300, type: 'nbi' },
    { id: 'nbi-ayala', name: 'NBI Ayala Cebu Satellite', address: 'Ayala Center Cebu, Cardinal Rosales Avenue, Cebu City', lat: 10.3180, lng: 123.9020, type: 'nbi' }
  ],
  // DFA Offices
  dfa: [
    { id: 'dfa-cebu', name: 'DFA Cebu Consular Office', address: '3rd Floor, Robinsons Galleria Cebu, General Maxilom Avenue Extension, Cebu City', lat: 10.3150, lng: 123.8850, type: 'dfa' }
  ],
  // City/Municipal Halls
  barangay: [
    // Cities - Metro Cebu
    { id: 'ch-cebu-city', name: 'Cebu City Hall', address: 'Dr. Jose P. Rizal St. cor. M.C. Briones St., Brgy. Santo Niño, Cebu City', lat: 10.2947, lng: 123.9023, type: 'barangay' },
    { id: 'ch-mandaue', name: 'Mandaue City Hall', address: 'Mandaue City proper (central area)', lat: 10.3230, lng: 123.9220, type: 'barangay' },
    { id: 'ch-lapulapu', name: 'Lapu-Lapu City Hall', address: 'City Hall Drive, Pajo, Lapu-Lapu City', lat: 10.3175, lng: 123.9631, type: 'barangay' },
    { id: 'ch-talisay', name: 'Talisay City Hall', address: 'Tabunok, Talisay City', lat: 10.2650, lng: 123.8400, type: 'barangay' },
    { id: 'ch-consolacion', name: 'Consolacion Municipal Hall', address: 'Cebu North Road, Poblacion, Consolacion', lat: 10.3758, lng: 123.9572, type: 'barangay' },
    // Cities - Component Cities
    { id: 'ch-bogo', name: 'Bogo City Hall', address: 'Poblacion, Bogo City', lat: 11.0492, lng: 124.0041, type: 'barangay' },
    { id: 'ch-carcar', name: 'Carcar City Hall', address: 'Poblacion, Carcar City', lat: 10.1067, lng: 123.6092, type: 'barangay' },
    { id: 'ch-danao', name: 'Danao City Hall', address: 'Poblacion, Danao City', lat: 10.5208, lng: 124.0272, type: 'barangay' },
    { id: 'ch-naga', name: 'Naga City Hall', address: 'Poblacion, Naga City', lat: 10.2089, lng: 123.7569, type: 'barangay' },
    { id: 'ch-toledo', name: 'Toledo City Hall', address: 'Poblacion, Toledo City', lat: 10.3778, lng: 123.6381, type: 'barangay' },
    // Municipal Halls - North Cebu
    { id: 'mh-liloan', name: 'Liloan Municipal Hall', address: 'Poblacion, Liloan', lat: 10.3992, lng: 123.9992, type: 'barangay' },
    { id: 'mh-tuburan', name: 'Tuburan Municipal Hall', address: 'Poblacion, Tuburan', lat: 10.7306, lng: 123.8228, type: 'barangay' },
    { id: 'mh-borbon', name: 'Borbon Municipal Hall', address: 'Poblacion, Borbon', lat: 10.8333, lng: 124.0000, type: 'barangay' },
    { id: 'mh-catmon', name: 'Catmon Municipal Hall', address: 'Poblacion, Catmon', lat: 10.6667, lng: 123.9500, type: 'barangay' },
    { id: 'mh-sogod', name: 'Sogod Municipal Hall', address: 'Poblacion, Sogod', lat: 10.7500, lng: 123.9833, type: 'barangay' },
    { id: 'mh-carmen', name: 'Carmen Municipal Hall', address: 'Poblacion, Carmen', lat: 10.5833, lng: 124.0167, type: 'barangay' },
    { id: 'mh-compostela', name: 'Compostela Municipal Hall', address: 'Poblacion, Compostela', lat: 10.4500, lng: 123.9833, type: 'barangay' },
    { id: 'mh-asturias', name: 'Asturias Municipal Hall', address: 'Poblacion, Asturias', lat: 10.5717, lng: 123.7175, type: 'barangay' },
    { id: 'mh-balamban', name: 'Balamban Municipal Hall', address: 'Poblacion, Balamban', lat: 10.5039, lng: 123.7153, type: 'barangay' },
    // Municipal Halls - West & South Cebu
    { id: 'mh-minglanilla', name: 'Minglanilla Municipal Hall', address: 'Poblacion, Minglanilla', lat: 10.2450, lng: 123.7967, type: 'barangay' },
    { id: 'mh-cordova', name: 'Cordova Municipal Hall', address: 'Poblacion, Cordova', lat: 10.2531, lng: 123.9514, type: 'barangay' },
    { id: 'mh-san-fernando', name: 'San Fernando Municipal Hall', address: 'Poblacion, San Fernando', lat: 10.1833, lng: 123.7075, type: 'barangay' },
    { id: 'mh-barili', name: 'Barili Municipal Hall', address: 'Poblacion, Barili', lat: 10.1167, lng: 123.5333, type: 'barangay' },
    { id: 'mh-dumanjug', name: 'Dumanjug Municipal Hall', address: 'Poblacion, Dumanjug', lat: 10.0667, lng: 123.4833, type: 'barangay' },
    { id: 'mh-pinamungajan', name: 'Pinamungajan Municipal Hall', address: 'Poblacion, Pinamungajan', lat: 10.2667, lng: 123.5833, type: 'barangay' },
    { id: 'mh-moalboal', name: 'Moalboal Municipal Hall', address: 'Poblacion, Moalboal', lat: 9.9500, lng: 123.4000, type: 'barangay' },
    { id: 'mh-alegria', name: 'Alegria Municipal Hall', address: 'Poblacion, Alegria', lat: 9.7333, lng: 123.4000, type: 'barangay' },
    { id: 'mh-malabuyoc', name: 'Malabuyoc Municipal Hall', address: 'Poblacion, Malabuyoc', lat: 9.6500, lng: 123.3167, type: 'barangay' },
    { id: 'mh-badian', name: 'Badian Municipal Hall', address: 'Poblacion, Badian', lat: 9.8667, lng: 123.4000, type: 'barangay' },
    { id: 'mh-ginatilan', name: 'Ginatilan Municipal Hall', address: 'Poblacion, Ginatilan', lat: 9.6000, lng: 123.3000, type: 'barangay' },
    { id: 'mh-samboan', name: 'Samboan Municipal Hall', address: 'Poblacion, Samboan', lat: 9.5333, lng: 123.3000, type: 'barangay' },
    { id: 'mh-santander', name: 'Santander Municipal Hall', address: 'Poblacion, Santander', lat: 9.4667, lng: 123.3333, type: 'barangay' },
    { id: 'mh-oslob', name: 'Oslob Municipal Hall', address: 'Poblacion, Oslob', lat: 9.5333, lng: 123.4000, type: 'barangay' },
    { id: 'mh-boljoon', name: 'Boljoon Municipal Hall', address: 'Poblacion, Boljoon', lat: 9.6333, lng: 123.4833, type: 'barangay' },
    { id: 'mh-alcoy', name: 'Alcoy Municipal Hall', address: 'Poblacion, Alcoy', lat: 9.7000, lng: 123.5000, type: 'barangay' },
    { id: 'mh-ronda', name: 'Ronda Municipal Hall', address: 'Poblacion, Ronda', lat: 9.9833, lng: 123.4167, type: 'barangay' },
    { id: 'mh-alcantara', name: 'Alcantara Municipal Hall', address: 'Poblacion, Alcantara', lat: 9.9667, lng: 123.4000, type: 'barangay' },
    { id: 'mh-dalaguete', name: 'Dalaguete Municipal Hall', address: 'Poblacion, Dalaguete', lat: 9.7667, lng: 123.5333, type: 'barangay' },
    { id: 'mh-sibonga', name: 'Sibonga Municipal Hall', address: 'Poblacion, Sibonga', lat: 9.9833, lng: 123.5667, type: 'barangay' },
    { id: 'mh-argao', name: 'Argao Municipal Hall', address: 'Poblacion, Argao', lat: 9.8833, lng: 123.6000, type: 'barangay' }
  ]
}

// Office type icons and colors
const officeTypeConfig = {
  lto: { name: 'LTO', color: '#3B82F6', icon: 'fa-car', iconText: 'LTO', logo: 'assets/Land_Transportation_Office.svg' },
  sss: { name: 'SSS', color: '#10B981', icon: 'fa-hand-holding-dollar', iconText: 'SSS', logo: 'assets/Social_Security_System_(SSS).svg.png' },
  philhealth: { name: 'PhilHealth', color: '#EF4444', icon: 'fa-heart-pulse', iconText: 'PH', logo: 'assets/ph_logo.png' },
  nbi: { name: 'NBI', color: '#F59E0B', icon: 'fa-fingerprint', iconText: 'NBI', logo: 'assets/National_Bureau_of_Investigation_(NBI).svg.png' },
  dfa: { name: 'DFA', color: '#8B5CF6', icon: 'fa-passport', iconText: 'DFA', logo: 'assets/Seal_of_the_Department_of_Foreign_Affairs_of_the_Philippines.svg.png' },
  barangay: { name: 'City/Municipal Hall', color: '#F97316', icon: 'fa-building-columns', iconText: 'CH', logo: 'assets/253-2533880_city-hall-icon.png' }
}

const allTableRows = [
  ["LTO Mandaue", "Mandaue City", "✅ Ready", "3/30/2026 2:14 PM", "lto", 10.3169, 123.9288],
  ["LTO Cebu City", "Cebu City", "✅ Ready", "3/30/2026 2:10 PM", "lto", 10.3157, 123.8854],
  ["SSS Cebu Branch", "Cebu City", "✅ Ready", "3/30/2026 1:55 PM", "sss", 10.3157, 123.8854],
  ["SSS Mandaue", "Mandaue City", "✅ Ready", "3/30/2026 1:45 PM", "sss", 10.3169, 123.9288],
  ["PhilHealth RO 7", "Cebu City", "✅ Ready", "3/30/2026 1:40 PM", "philhealth", 10.3157, 123.8854],
  ["NBI Cebu", "Cebu City", "✅ Ready", "3/30/2026 1:22 PM", "nbi", 10.3157, 123.8854],
  ["NBI Mandaue", "Mandaue City", "✅ Ready", "3/30/2026 1:15 PM", "nbi", 10.3169, 123.9288],
  ["DFA Cebu", "Cebu City", "✅ Ready", "3/30/2026 12:58 PM", "passport", 10.3157, 123.8854],
  ["BIR Cebu City", "Cebu City", "✅ Ready", "3/30/2026 12:30 PM", "bir", 10.3157, 123.8854],
  ["Barangay Poblacion", "Consolacion", "✅ Ready", "Moments ago", "barangay", 10.3833, 123.9500],
  ["Barangay Tipolo", "Mandaue", "✅ Ready", "2 hours ago", "barangay", 10.3169, 123.9288],
  ["Pag-IBIG Cebu", "Cebu City", "✅ Ready", "3/30/2026 11:20 AM", "pagibig", 10.3157, 123.8854],
  ["OWWA Region 7", "Cebu City", "✅ Ready", "3/30/2026 10:45 AM", "owwa", 10.3157, 123.8854],
  ["CPPO Clearance", "Cebu City", "✅ Ready", "3/30/2026 10:30 AM", "police", 10.3157, 123.8854],
  ["Business Permit - Cebu", "Cebu City", "✅ Ready", "3/29/2026 4:00 PM", "business", 10.3157, 123.8854],
  ["Business Permit - Mandaue", "Mandaue City", "✅ Ready", "3/29/2026 3:30 PM", "business", 10.3169, 123.9288]
]

// ===========================================
// MODAL DATA
// ===========================================
const modalData = {
  lto: {
    title: "LTO Driver's License Renewal",
    subtitle: "Non-Professional or Professional • 10-year validity",
    source: "https://lto.gov.ph/drivers-license/",
    sourcePortal: "https://portal.lto.gov.ph/",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Original Driver's License (even if expired)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Comprehensive Driver's Education (CDE) Certificate (completed online via LTMS)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Medical Certificate from any LTO-accredited clinic (electronically transmitted)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Proof of payment (via LTMS or eGovPH)</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Complete the CDE online course at <strong class="text-[var(--accent)]">portal.lto.gov.ph</strong></li><li class="pb-2">Visit any LTO-accredited medical clinic for exam</li><li class="pb-2">Proceed to LTO branch with all documents</li><li class="pb-2">Pay fees via LTMS, eGovPH, or at the branch</li><li class="pb-2">Have photo and signature taken</li><li class="pb-2">Receive claim stub - 10-year validity for clean records</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Non-Professional</span><span class="font-semibold">₱585</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Professional</span><span class="font-semibold">₱680</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>CDE Online Course</span><span class="font-semibold">₱300</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Medical Exam</span><span class="font-semibold">₱300-500</span></div><div class="mt-3 text-emerald-600 dark:text-emerald-400 font-semibold">Same day release (2-4 hours)</div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Best done early morning for shortest queue</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Mandaue typically has shorter lines than Cebu City</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Wear a shirt with collar for ID photo</span></li><li class="flex gap-2"><i class="fas fa-info-circle text-[var(--accent)] mt-1"></i><span>10-year validity is now standard for clean records</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">LTO Mandaue</div><div class="opacity-70 text-sm">AC Cortes Ave, Mandaue City</div><div class="mt-2"><span class="px-2 py-1 bg-emerald-500 text-white dark:bg-emerald-400 dark:text-[#0a0f1c] text-xs rounded-full">Fastest</span></div></div><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">LTO Cebu City</div><div class="opacity-70 text-sm">SM City Cebu, North Reclamation</div></div></div>`
  },
  sss: {
    title: "SSS Salary Loan",
    subtitle: "1-Month or 2-Month Term • Up to ₱40,000",
    source: "https://www.sss.gov.ph/salary-loan/",
    sourcePortal: "https://my.sss.gov.ph/",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> <strong>1-Month Loan:</strong> 36 posted contributions, 6 within last 12 months</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> <strong>2-Month Loan:</strong> 72 posted contributions, 6 within last 12 months</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Valid government-issued ID</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Employer must be updated with contributions (employed members)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Additional 6 contributions under current membership type (SE/VM/OFW/NWS)</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Log in to <strong class="text-[var(--accent)]">my.sss.gov.ph</strong></li><li class="pb-2">Navigate to "Loan Application" > "Salary Loan"</li><li class="pb-2">Verify eligibility and desired loan amount</li><li class="pb-2">Fill out and submit the application</li><li class="pb-2">Wait for approval via SMS and email (1-3 days)</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>1-Month Loan</span><span class="font-semibold">Up to ₱15,000</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>2-Month Loan</span><span class="font-semibold">Up to ₱40,000</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Interest Rate</span><span class="font-semibold">8% per annum</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Processing Time</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">1-3 business days</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Apply online via My.SSS app or portal for fastest processing</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Ensure disbursement account is enrolled before applying</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">SSS Cebu Branch</div><div class="opacity-70 text-sm">Osmeña Blvd, Cebu City</div></div><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">SSS Mandaue</div><div class="opacity-70 text-sm">Mandaue City Hall Complex</div></div></div>`
  },
  philhealth: {
    title: "PhilHealth New Member Registration / ID",
    subtitle: "Online & Walk-in Application",
    source: "https://www.philhealth.gov.ph/members/informal/registration.php",
    sourcePortal: "https://eregister.philhealth.gov.ph/",
    sourceForm: "https://www.philhealth.gov.ph/downloads/membership/pmrf_012020.pdf",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> 2 copies of accomplished PhilHealth Member Registration Form (PMRF)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Valid proof of identity (UMID, Passport, Driver's License, Voter's ID, etc.)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Birth Certificate (for first-time registrants)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Proof of income (for self-earning individuals)</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Download PMRF form from <strong class="text-[var(--accent)]">philhealth.gov.ph</strong></li><li class="pb-2">Register for an account at <strong class="text-[var(--accent)]">eregister.philhealth.gov.ph</strong></li><li class="pb-2">Upload scanned documents through the portal</li><li class="pb-2">Wait for email notification (5-10 working days)</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Annual Premium (starts at)</span><span class="font-semibold">₱2,400/year</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>ID Card Issuance</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">FREE</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Processing Time</span><span class="font-semibold">5-10 working days</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Online application reduces wait time significantly</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>You can now register and upload documents online</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">PhilHealth RO7</div><div class="opacity-70 text-sm">Ayala Center Cebu, Cebu Business Park</div></div></div>`
  },
  nbi: {
    title: "NBI Clearance",
    subtitle: "For Employment • Travel • License Application",
    source: "https://nbi.gov.ph/citizens-charter/nbi-clearance/",
    sourcePortal: "https://clearance.nbi.gov.ph/",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Two (2) valid government-issued IDs</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Online reference number / application form</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Payment of ₱155</li><li class="flex gap-3 opacity-70"><span class="text-emerald-400">ℹ</span> <em>Free for first-time job seekers with Barangay certificate in some cases</em></li><li class="flex gap-3 mt-2 pt-2 border-t border-[var(--border)]"><span class="text-emerald-400">✓</span> <strong>Accepted IDs:</strong> UMID, Passport, PhilHealth ID, Driver's License, Voter's ID, PRC License</li><li class="flex gap-3 text-red-400"><span>✗</span> <strong>NOT accepted:</strong> Company IDs and Barangay Clearance</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Visit <strong class="text-[var(--accent)]">clearance.nbi.gov.ph</strong> and create an account</li><li class="pb-2">Fill out the online application form</li><li class="pb-2">Select appointment schedule and branch</li><li class="pb-2">Pay the clearance fee online</li><li class="pb-2">Visit the selected branch for biometrics and photo</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>NBI Clearance Fee</span><span class="font-semibold">₱155</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Free for</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">First-time job seekers</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Processing Time</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">Same day</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Mandaue and SM Cebu have shorter queues</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Book morning appointments for faster processing</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Free for first-time job seekers (with Barangay certificate)</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">NBI Cebu</div><div class="opacity-70 text-sm">Capitol Site, Cebu City</div></div><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">NBI Mandaue</div><div class="opacity-70 text-sm">Mandaue City Hall Complex</div></div></div>`
  },
  passport: {
    title: "DFA Passport Renewal (ePassport)",
    subtitle: "5 or 10-year validity • Personal appearance required",
    source: "https://passport.gov.ph/",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Old/Current Passport (original)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Confirmed online appointment</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> eReceipt from DFA payment</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> One valid backup government ID (recommended)</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Visit <strong class="text-[var(--accent)]">passport.gov.ph</strong> and schedule appointment</li><li class="pb-2">Select DFA Cebu and preferred date/time</li><li class="pb-2">Pay the appointment fee online</li><li class="pb-2">Print the application form</li><li class="pb-2">Go to DFA Cebu on scheduled date with all requirements</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Regular Processing (30 days)</span><span class="font-semibold">₱950</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Expedited Processing (14 days)</span><span class="font-semibold">₱1,200</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>5-year validity</span><span class="font-semibold">₱950</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>10-year validity</span><span class="font-semibold">₱950</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Appointment slots released at 12:00 MN and 12:00 NN</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Wear a collared shirt (white or light color) for photo</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Book appointment early - slots fill up quickly</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">DFA Cebu</div><div class="opacity-70 text-sm">3rd Floor, ASEAN Building, Gorordo Ave</div></div></div>`
  },
  barangay: {
    title: "Barangay Clearance",
    subtitle: "Employment • Business • e.g., Consolacion, Cebu",
    source: null,
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Any valid government-issued ID (PhilID, Driver's License, Passport, etc.)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Proof of residency (sometimes required)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Barangay clearance form (filled at the hall)</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Go to your specific barangay hall during office hours</li><li class="pb-2">Request and fill out Barangay Clearance Application Form</li><li class="pb-2">Present valid ID and proof of residency (if required)</li><li class="pb-2">Pay fee</li><li class="pb-2">Wait for processing (usually 15 minutes)</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Barangay Clearance</span><span class="font-semibold">₱50 - ₱150</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Indigency Certificate</span><span class="font-semibold">₱20 - ₱50</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Processing Time</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">15-30 minutes</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Best to visit during mid-morning (9-11 AM)</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Go directly to your specific barangay hall</span></li><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Requirements are very simple compared to national agencies</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">Your Local Barangay Hall</div><div class="opacity-70 text-sm">Go directly to your specific barangay hall in your area (e.g., Consolacion, Cebu)</div></div></div>`
  },
  bir: {
    title: "BIR TIN Application",
    subtitle: "New Tax Identification Number • Online eReg",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> BIR Form 1901</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Birth certificate (PSA copy)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Two valid government IDs</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Visit <strong>bir.gov.ph</strong> and use eReg portal</li><li class="pb-2">Fill out the online TIN application form</li><li class="pb-2">Upload required documents</li><li class="pb-2">Wait for confirmation email with your TIN</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>TIN Application</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">FREE</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Annual Registration Fee</span><span class="font-semibold">₱500</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Online eReg is faster than walk-in</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">BIR Cebu City</div><div class="opacity-70 text-sm">V. Rama Ave, Cebu City</div></div></div>`
  },
  pagibig: {
    title: "Pag-IBIG Housing Loan",
    subtitle: "Acquisition • Construction • Renovation",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Housing Loan Application Form</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Proof of income (payslips, ITR, COE)</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Valid government IDs</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> 24 months Pag-IBIG contribution</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Log in to <strong>pagibigfund.gov.ph</strong> Virtual Pag-IBIG</li><li class="pb-2">Check loan eligibility</li><li class="pb-2">Prepare all documentary requirements</li><li class="pb-2">Submit application online or visit branch</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Loanable Amount</span><span class="font-semibold">Up to ₱6,000,000</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Interest Rate</span><span class="font-semibold">6.125% - 9.125%</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Ensure 24 continuous contributions before applying</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">Pag-IBIG Cebu</div><div class="opacity-70 text-sm">J. Llorente St, Cebu City</div></div></div>`
  },
  owwa: {
    title: "OWWA Membership",
    subtitle: "OFW Document Processing • Welfare Services",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Valid passport or POE-verified contract</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Proof of OWWA contribution payment</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Two valid IDs</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Visit OWWA Regional Office VII or satellite office</li><li class="pb-2">Present employment documents and passport</li><li class="pb-2">Fill out membership form and pay fee</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Membership Fee</span><span class="font-semibold">₱100 (per contract)</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Validity</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">Duration of contract (2 years)</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Online registration is now available</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">OWWA RO7</div><div class="opacity-70 text-sm">J. Llorente St, Cebu City</div></div></div>`
  },
  police: {
    title: "Police Clearance",
    subtitle: "Local Employment • NBI Alternative",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Barangay clearance</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Cedula</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Two valid IDs</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> 2x2 ID picture</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Secure barangay clearance first</li><li class="pb-2">Proceed to CPPO or city police station</li><li class="pb-2">Fill out application form and pay fee</li><li class="pb-2">Undergo biometrics and photo capture</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Police Clearance</span><span class="font-semibold">₱160</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Processing Time</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">Same day (1-2 hours)</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Some offices now accept GCash payments</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">CPPO Clearance Section</div><div class="opacity-70 text-sm">Cebu Provincial Police Office</div></div></div>`
  },
  cedula: {
    title: "Community Tax Certificate (Cedula)",
    subtitle: "Basic Government Document Requirement",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> Valid ID</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Proof of income (for higher amounts)</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Go to City Hall or Municipal Hall</li><li class="pb-2">Proceed to the Treasurer's Office</li><li class="pb-2">Fill out the cedula form and pay</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Basic/Minimum</span><span class="font-semibold">₱50</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>With Income</span><span class="font-semibold">₱100 - ₱500+</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Bring exact change</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">Cebu City Hall - Treasurer's Office</div></div></div>`
  },
  business: {
    title: "Business Permit Renewal",
    subtitle: "Mayor's Permit • DTI/SEC Registration",
    documents: `<ul class="space-y-3"><li class="flex gap-3"><span class="text-emerald-400">✓</span> DTI Registration or SEC Registration</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Barangay Business Clearance</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Lease contract or proof of ownership</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Sanitary permit</li><li class="flex gap-3"><span class="text-emerald-400">✓</span> Fire Safety Inspection Certificate</li></ul>`,
    steps: `<ol class="list-decimal pl-6 space-y-3"><li class="pb-2">Secure barangay business clearance</li><li class="pb-2">Complete tax assessment at City Treasurer's Office</li><li class="pb-2">Pay business taxes and fees</li><li class="pb-2">Submit requirements to BPLO</li></ol>`,
    fees: `<div class="space-y-3"><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Mayors Permit Fee</span><span class="font-semibold">₱500 - ₱5,000+</span></div><div class="flex justify-between py-2 border-b border-[var(--border)]"><span>Processing Time</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">3-7 days</span></div></div>`,
    tips: `<ul class="space-y-3"><li class="flex gap-2"><i class="fas fa-lightbulb text-yellow-400 mt-1"></i><span>Renew by January 20 to avoid penalties</span></li></ul>`,
    branches: `<div class="space-y-3"><div class="bg-[var(--bg)] p-4 rounded-xl"><div class="font-semibold">Cebu City BPLO</div><div class="opacity-70 text-sm">Cebu City Hall</div></div></div>`
  }
}

// ===========================================
// UI FUNCTIONS
// ===========================================
function populateCities() {
  const container = document.getElementById('cities-ribbon')

  // Create carousel container
  const carousel = document.createElement('div')
  carousel.className = 'carousel-container'

  // Duplicate cities twice for seamless looping
  const citiesToDisplay = [...cities, ...cities]

  citiesToDisplay.forEach(city => {
    const pill = document.createElement('div')
    pill.className = `carousel-item pill text-xs sm:text-sm px-3 sm:px-5 h-8 sm:h-9 flex items-center rounded-full cursor-pointer ${city === currentLocation ? 'active' : ''} mx-1`
    pill.textContent = city
    pill.onclick = () => {
      currentLocation = city
      DB.set('location', city)
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'))
      pill.classList.add('active')
      updateLocationDisplay()
      populateTable()
    }
    carousel.appendChild(pill)
  })

  // Clear and set new carousel
  container.innerHTML = ''
  container.classList.add('auto-scroll-carousel')
  container.appendChild(carousel)
}

function populateServiceTabs() {
  const container = document.getElementById('service-tabs')
  container.innerHTML = `
    <button onclick="filterByType('all')" class="tab-button active bg-[var(--accent)] text-[#0a0f1c] px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-medium transition-all">All</button>
    <button onclick="filterByType('id')" class="tab-button px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-medium hover:bg-[var(--card)] transition-all">IDs & Clearances</button>
    <button onclick="filterByType('loan')" class="tab-button px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-medium hover:bg-[var(--card)] transition-all">Loans & Benefits</button>
    <button onclick="filterByType('permit')" class="tab-button px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-medium hover:bg-[var(--card)] transition-all">Permits & Renewals</button>
  `
}

function populateServiceCards() {
  const container = document.getElementById('service-cards-container')
  let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">`

  Object.keys(servicesData).forEach((key, index) => {
    const s = servicesData[key]
    if (currentFilter !== 'all' && s.category !== currentFilter) return

    html += `
      <div onclick="showModal('${key}')" class="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 card-hover cursor-pointer">
        <span class="text-[10px] sm:text-xs font-medium px-3 h-6 bg-emerald-300 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full flex items-center w-fit">${s.status}</span>
        <h4 class="font-semibold text-lg sm:text-2xl mt-4 sm:mt-6">${s.title}</h4>
        <p class="opacity-70 text-xs sm:text-sm">${s.subtitle}</p>
        <div class="mt-4 sm:mt-8 flex justify-between items-end">
          <div>
            <div class="text-xl sm:text-3xl font-bold">${s.value}</div>
            <div class="text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs">${s.change}</div>
          </div>
          <div class="text-[10px] sm:text-xs opacity-60">${currentLocation === 'Locations' ? 'Cebu' : currentLocation}</div>
        </div>
      </div>`
  })
  html += `</div>`
  container.innerHTML = html
}

function populateTable() {
  const tbody = document.getElementById('table-body')
  let filteredRows = [...allTableRows]

  // Sort by distance if user location is available
  if (userLocation && currentLocation === 'Locations') {
    filteredRows.sort((a, b) => {
      const distA = GeoLocation.calculateDistance(userLocation.lat, userLocation.lng, a[5], a[6])
      const distB = GeoLocation.calculateDistance(userLocation.lat, userLocation.lng, b[5], b[6])
      return distA - distB
    })
  }

  // Filter by location
  if (currentLocation !== 'Locations') {
    filteredRows = filteredRows.filter(row =>
      row[1].toLowerCase().includes(currentLocation.toLowerCase()) ||
      row[0].toLowerCase().includes(currentLocation.toLowerCase())
    )
  }

  // Filter by search query
  if (searchQuery) {
    filteredRows = filteredRows.filter(row =>
      row[0].toLowerCase().includes(searchQuery.toLowerCase()) ||
      row[1].toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  if (filteredRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-12 text-center opacity-60">
          <i class="fas fa-search text-4xl mb-4 block opacity-40"></i>
          No offices found
        </td>
      </tr>`
    updateResultsCount(0)
    return
  }

  // Add distance if available
  tbody.innerHTML = filteredRows.map(row => {
    let distanceText = ''
    if (userLocation) {
      const dist = GeoLocation.calculateDistance(userLocation.lat, userLocation.lng, row[5], row[6])
      distanceText = dist < 1 ? `${(dist * 1000).toFixed(0)}m away` : `${dist.toFixed(1)}km away`
    }

    return `
      <tr class="hover:bg-[var(--card)] cursor-pointer" onclick="showModal('${row[4]}')">
        <td class="py-3 sm:py-5 font-medium">${row[0]}</td>
        <td class="py-3 sm:py-5">${row[1]}</td>
        <td class="py-3 sm:py-5">
          <span class="px-3 py-1 bg-emerald-500 text-white dark:bg-emerald-400 dark:text-[#0a0f1c] text-[10px] sm:text-xs rounded-full">${row[2]}</span>
          ${distanceText ? `<span class="ml-2 text-[10px] opacity-60">${distanceText}</span>` : ''}
        </td>
        <td class="py-3 sm:py-5 text-[10px] sm:text-xs opacity-60">${row[3]}</td>
      </tr>`
  }).join('')

  updateResultsCount(filteredRows.length)
}

function updateResultsCount(count) {
  document.getElementById('results-count').textContent =
    searchQuery ? `Found ${count} result${count !== 1 ? 's' : ''}` : `Showing ${count} government offices`
}

function updateLocationDisplay() {
  const display = currentLocation === 'Locations' ? 'All Cebu Locations' : currentLocation
  const desktopEl = document.getElementById('current-location')
  const mobileEl = document.getElementById('mobile-location')
  if (desktopEl) desktopEl.textContent = display
  if (mobileEl) mobileEl.textContent = display
}

// ===========================================
// GEOLOCATION FUNCTIONS
// ===========================================
async function requestGeolocation() {
  // Get both desktop and mobile buttons
  const desktopBtn = document.getElementById('location-btn')
  const mobileBtnIcon = document.querySelector('#mobile-location-btn i')

  // Show loading state
  if (desktopBtn) {
    desktopBtn.innerHTML = '<div class="spinner w-5 h-5"></div>'
  }
  if (mobileBtnIcon) {
    mobileBtnIcon.className = 'fas fa-spinner fa-spin text-[#22d3ee] text-lg'
  }

  try {
    const position = await GeoLocation.getCurrentPosition()
    userLocation = { lat: position.lat, lng: position.lng }
    const nearest = GeoLocation.getNearestCity(position.lat, position.lng)

    currentLocation = nearest.city
    DB.set('location', nearest.city)
    DB.set('userLocation', userLocation)

    updateLocationDisplay()
    populateCities()
    populateTable()

    showToast(`Located: ${nearest.city} (${nearest.distance < 1 ? Math.round(nearest.distance * 1000) + 'm' : nearest.distance.toFixed(1) + 'km'} away)`)
  } catch (err) {
    showToast('Unable to get location. Please enable permissions.', 'error')
    console.error(err)
  } finally {
    // Restore desktop button
    if (desktopBtn) {
      desktopBtn.innerHTML = `<i class="fas fa-location-crosshairs text-[var(--accent)]"></i><span class="text-sm font-medium">${currentLocation === 'Locations' ? 'All Cebu' : currentLocation}</span>`
    }
    // Restore mobile button
    if (mobileBtnIcon) {
      mobileBtnIcon.className = 'fas fa-location-crosshairs text-[#22d3ee] text-lg'
    }
  }
}

function toggleGeolocation() {
  const enabled = document.getElementById('geoloc-toggle').checked
  if (enabled) {
    requestGeolocation()
  } else {
    userLocation = null
    DB.remove('userLocation')
    populateTable()
  }
}

// ===========================================
// MODAL FUNCTIONS
// ===========================================
function showModal(key) {
  currentModalKey = key
  const data = modalData[key]
  if (!data) return

  document.getElementById('modal-title').textContent = data.title
  document.getElementById('modal-subtitle').textContent = data.subtitle
  currentTab = 0
  updateModalTabs()
  renderCurrentTab()

  document.getElementById('modal-backdrop').classList.remove('hidden')
}

function hideModal() {
  document.getElementById('modal-backdrop').classList.add('hidden')
}

function renderCurrentTab() {
  const data = modalData[currentModalKey]
  const content = document.getElementById('modal-content')

  // Build source links HTML
  let sourceHtml = ''
  if (data.source || data.sourcePortal || data.sourceForm) {
    sourceHtml = `
      <div class="mt-6 pt-4 border-t border-[var(--border)]">
        <div class="text-xs opacity-60 mb-2">Official Sources:</div>
        <div class="flex flex-wrap gap-2">
          ${data.source ? `<a href="${data.source}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"><i class="fas fa-external-link-alt"></i> Agency Website</a>` : ''}
          ${data.sourcePortal ? `<a href="${data.sourcePortal}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"><i class="fas fa-external-link-alt"></i> Online Portal</a>` : ''}
          ${data.sourceForm ? `<a href="${data.sourceForm}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"><i class="fas fa-file-pdf"></i> Download Form</a>` : ''}
        </div>
      </div>
    `
  }

  // Disclaimer
  const disclaimer = `
    <div class="mt-4 pt-3 border-t border-[var(--border)] text-xs opacity-50 italic">
      <i class="fas fa-info-circle mr-1"></i>
      Requirements may change. Always verify on the official agency website before going.
    </div>
  `

  const tabContents = [
    `<h5 class="font-semibold mb-4 text-base sm:text-lg">Required Documents</h5>${data.documents}${sourceHtml}${disclaimer}`,
    `<h5 class="font-semibold mb-4 text-base sm:text-lg">Step-by-Step Process</h5>${data.steps}${sourceHtml}${disclaimer}`,
    `<h5 class="font-semibold mb-4 text-base sm:text-lg">Fees & Processing Time</h5>${data.fees}${sourceHtml}${disclaimer}`,
    `<h5 class="font-semibold mb-4 text-base sm:text-lg">Important Tips</h5>${data.tips}${sourceHtml}${disclaimer}`,
    `<h5 class="font-semibold mb-4 text-base sm:text-lg">Branches Near You</h5>${data.branches}${sourceHtml}${disclaimer}`
  ]
  content.innerHTML = tabContents[currentTab]
}

function switchTab(n) {
  currentTab = n
  updateModalTabs()
  renderCurrentTab()
}

function updateModalTabs() {
  document.querySelectorAll('#modal-backdrop button[id^="tab-"]').forEach((el, i) => {
    if (i === currentTab) {
      el.classList.add('tab-active', 'text-[var(--accent)]')
      el.classList.remove('opacity-60')
    } else {
      el.classList.remove('tab-active', 'text-[var(--accent)]')
      el.classList.add('opacity-60')
    }
  })
}

// ===========================================
// COPY & PRINT
// ===========================================
function printChecklist() {
  const data = modalData[currentModalKey]
  if (!data) return

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${data.title} - GovHub</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #0a0f1c; }
        h1 { color: #0a0f1c; border-bottom: 2px solid #22d3ee; padding-bottom: 10px; }
        h2 { color: #22d3ee; margin-top: 30px; }
        ul, ol { line-height: 1.8; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .generated { font-size: 12px; color: #666; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${data.title}</h1>
      <p style="color: #666; margin-bottom: 30px;">${data.subtitle}</p>
      <div class="section">
        <h2>Required Documents</h2>
        ${data.documents}
      </div>
      <div class="section">
        <h2>Step-by-Step Process</h2>
        ${data.steps}
      </div>
      <div class="section">
        <h2>Fees & Processing Time</h2>
        ${data.fees}
      </div>
      <div class="section">
        <h2>Important Tips</h2>
        ${data.tips}
      </div>
      <div class="section">
        <h2>Branches</h2>
        ${data.branches}
      </div>
      <p class="generated">Generated by GovHub • ${new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • ${new Date().toLocaleTimeString('en-PH')}</p>
    </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  printWindow.document.write(printContent)
  printWindow.document.close()
  printWindow.print()
}

function copyChecklist() {
  const data = modalData[currentModalKey]
  if (!data) return

  const cleanText = (html) => html.replace(/<[^>]*>/g, '').replace(/✓/g, '•').trim()

  const textToCopy = `
${data.title}
${data.subtitle}

REQUIRED DOCUMENTS:
${cleanText(data.documents)}

STEP-BY-STEP PROCESS:
${cleanText(data.steps)}

FEES & PROCESSING TIME:
${cleanText(data.fees)}

IMPORTANT TIPS:
${cleanText(data.tips)}

BRANCHES:
${cleanText(data.branches)}

---
Generated by GovHub • ${new Date().toLocaleDateString('en-PH')}
  `.trim()

  navigator.clipboard.writeText(textToCopy).then(() => {
    showToast('Checklist copied to clipboard!')
  }).catch(() => {
    const textArea = document.createElement('textarea')
    textArea.value = textToCopy
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    showToast('Checklist copied to clipboard!')
  })
}

// ===========================================
// SUBMISSION FUNCTIONS
// ===========================================
function showSubmissionModal() {
  document.getElementById('submission-modal').classList.remove('hidden')
}

function hideSubmissionModal() {
  document.getElementById('submission-modal').classList.add('hidden')
  document.getElementById('submit-name').value = ''
  document.getElementById('submit-service').value = ''
  document.getElementById('submit-branch').value = ''
  document.getElementById('submit-type').value = ''
  document.getElementById('submit-details').value = ''
}

async function handleSubmitUpdate(e) {
  e.preventDefault()

  const data = {
    name: document.getElementById('submit-name').value,
    service: document.getElementById('submit-service').value,
    branch: document.getElementById('submit-branch').value,
    type: document.getElementById('submit-type').value,
    details: document.getElementById('submit-details').value
  }

  // Use Supabase if available, fallback to localStorage
  if (typeof DB_API !== 'undefined') {
    const result = await DB_API.submitUpdate(data)
    if (result.success) {
      hideSubmissionModal()
      showToast('Update submitted! Thank you for helping the community.')
    } else {
      showToast('Failed to submit. Please try again.', 'error')
    }
  } else {
    // Fallback to localStorage
    const result = Submissions.add(data)
    if (result.success) {
      hideSubmissionModal()
      showToast('Update submitted! Thank you for helping the community.')
    } else {
      showToast(result.error, 'error')
    }
  }
}

// ===========================================
// SETTINGS
// ===========================================
function showSettings() {
  document.getElementById('settings-modal').classList.remove('hidden')
  document.getElementById('darkmode-toggle').checked = currentTheme === 'dark'
}

function hideSettings() {
  document.getElementById('settings-modal').classList.add('hidden')
}

// ===========================================
// MAP FUNCTIONS
// ===========================================
let map = null
let mapMarkers = []
let userLocationMarker = null
let currentMapFilter = 'all'

function showMapModal() {
  document.getElementById('map-modal').classList.remove('hidden')
  // Initialize map after a short delay to ensure the modal is rendered
  setTimeout(() => {
    if (!map) {
      initMap()
    }
    map.invalidateSize()
  }, 100)
}

function hideMapModal() {
  document.getElementById('map-modal').classList.add('hidden')
  closeOfficeInfoPanel()
}

// ===========================================
// SUGGEST OFFICE MODAL FUNCTIONS
// ===========================================
function showSuggestOfficeModal() {
  document.getElementById('suggest-office-modal').classList.remove('hidden')
}

function hideSuggestOfficeModal() {
  document.getElementById('suggest-office-modal').classList.add('hidden')
  // Clear form
  document.getElementById('suggest-name').value = ''
  document.getElementById('suggest-type').value = ''
  document.getElementById('suggest-city').value = ''
  document.getElementById('suggest-address').value = ''
  document.getElementById('suggest-submitter').value = ''
  document.getElementById('suggest-contact').value = ''
  document.getElementById('suggest-notes').value = ''
}

function handleSuggestOffice(e) {
  e.preventDefault()

  const data = {
    officeName: document.getElementById('suggest-name').value,
    officeType: document.getElementById('suggest-type').value,
    city: document.getElementById('suggest-city').value,
    address: document.getElementById('suggest-address').value,
    submitterName: document.getElementById('suggest-submitter').value,
    contact: document.getElementById('suggest-contact').value,
    notes: document.getElementById('suggest-notes').value
  }

  const result = OfficeSuggestions.add(data)
  if (result.success) {
    hideSuggestOfficeModal()
    showToast('Office suggestion submitted! Thank you for helping the community.')
  } else {
    showToast('Failed to submit suggestion. Please try again.', 'error')
  }
}

function initMap() {
  // Initialize map centered on Cebu
  map = L.map('office-map').setView([10.3157, 123.8854], 11)

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map)

  // Add all markers
  addAllMarkers()
}

function createCustomIcon(type) {
  const config = officeTypeConfig[type] || { color: '#9CA3AF', iconText: 'OFF' }
  // If a logo exists for this office type, use it as the marker (better visibility on the map).
  if (config.logo) {
    const html = `
      <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <img src="${config.logo}" alt="${config.name}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)" />
      </div>
    `
    return L.divIcon({ className: 'custom-map-marker', html, iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40] })
  }

  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: ${config.color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">
        <span>${config.iconText}</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  })
}

function addAllMarkers() {
  // Clear existing markers
  mapMarkers.forEach(marker => map.removeLayer(marker))
  mapMarkers = []

  // Add markers for all offices
  Object.keys(officeLocations).forEach(type => {
    officeLocations[type].forEach(office => {
      const marker = L.marker([office.lat, office.lng], {
        icon: createCustomIcon(type)
      }).addTo(map)

      marker.on('click', () => showOfficeInfo(office))
      marker.officeData = office
      marker.officeType = type
      mapMarkers.push(marker)
    })
  })
}

function filterMapMarkers(type) {
  currentMapFilter = type

  // Update filter button styles
  document.querySelectorAll('.map-filter-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-[var(--accent)]', 'text-[#0a0f1c]')
    btn.classList.add('bg-[var(--card)]', 'text-[var(--text)]')
  })
  event.target.classList.add('active', 'bg-[var(--accent)]', 'text-[#0a0f1c]')
  event.target.classList.remove('bg-[var(--card)]', 'text-[var(--text)]')

  // Filter markers
  mapMarkers.forEach(marker => {
    if (type === 'all' || marker.officeType === type) {
      marker.addTo(map)
    } else {
      map.removeLayer(marker)
    }
  })

  closeOfficeInfoPanel()
}

function showOfficeInfo(office) {
  const config = officeTypeConfig[office.type]
  const panel = document.getElementById('office-info-panel')
  const content = document.getElementById('office-info-content')
  const officeBadge = config.logo
    ? `<img src="${config.logo}" alt="${config.name}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;border:1px solid rgba(0,0,0,0.05)" onerror="this.outerHTML='<div style=&quot;width:48px;height:48px;border-radius:8px;background:${config.color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700&quot;>${config.iconText}</div>'" />`
    : `<div style="width:48px;height:48px;border-radius:8px;background:${config.color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${config.iconText}</div>`

  content.innerHTML = `
    <div class="flex items-start gap-3 mb-3">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold" style="background: transparent">
        ${officeBadge}
      </div>
      <div class="flex-1">
        <h4 class="font-semibold text-base">${office.name}</h4>

      </div>
    </div>
    <div class="space-y-2 text-sm">
      <div class="flex items-start gap-2">
        <i class="fas fa-map-marker-alt text-[var(--accent)] mt-1"></i>
        <span>${office.address}</span>
      </div>
      <div class="flex items-start gap-2">
        <i class="fas fa-crosshairs text-[var(--accent)] mt-1"></i>
        <span>${office.lat.toFixed(4)}, ${office.lng.toFixed(4)}</span>
      </div>
    </div>
    <div class="mt-3 flex gap-2">
      <button onclick="getDirections(${office.lat}, ${office.lng})" class="flex-1 bg-[var(--accent)] hover:bg-cyan-300 text-[#0a0f1c] py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
        <i class="fas fa-directions"></i> Directions
      </button>
      <button onclick="showModal('${office.type}'); hideMapModal();" class="flex-1 border border-[var(--border)] hover:bg-[var(--bg)] py-2 rounded-lg text-sm font-medium">
        View Checklist
      </button>
    </div>
  `
  panel.classList.remove('hidden')
}

function closeOfficeInfoPanel() {
  document.getElementById('office-info-panel').classList.add('hidden')
}

function getDirections(lat, lng) {
  // Open in Google Maps or OpenStreetMap routing
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  window.open(url, '_blank')
}

async function findNearestOffice() {
  const btn = document.getElementById('find-nearest-btn')

  if (!userLocation) {
    btn.innerHTML = '<div class="spinner w-5 h-5"></div><span>Getting location...</span>'

    try {
      const position = await GeoLocation.getCurrentPosition()
      userLocation = { lat: position.lat, lng: position.lng }
      DB.set('userLocation', userLocation)

      // Add user location marker
      if (userLocationMarker) {
        map.removeLayer(userLocationMarker)
      }

      userLocationMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: `
            <div style="
              width: 20px;
              height: 20px;
              background: #3B82F6;
              border-radius: 50%;
              border: 4px solid rgba(59, 130, 246, 0.3);
              animation: pulse 2s infinite;
            "></div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map)

      map.setView([userLocation.lat, userLocation.lng], 13)
    } catch (err) {
      showToast('Unable to get your location. Please enable permissions.', 'error')
      btn.innerHTML = '<i class="fas fa-location-crosshairs"></i><span>Find Nearest</span>'
      return
    }
  }

  // Find nearest office
  let nearestOffice = null
  let nearestDistance = Infinity

  Object.keys(officeLocations).forEach(type => {
    if (currentMapFilter !== 'all' && currentMapFilter !== type) return

    officeLocations[type].forEach(office => {
      const distance = GeoLocation.calculateDistance(
        userLocation.lat, userLocation.lng,
        office.lat, office.lng
      )

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestOffice = office
      }
    })
  })

  if (nearestOffice) {
    // Pan to nearest office
    map.setView([nearestOffice.lat, nearestOffice.lng], 15)

    // Show office info
    showOfficeInfo(nearestOffice)

    // Show toast with distance
    const distanceText = nearestDistance < 1
      ? `${Math.round(nearestDistance * 1000)}m away`
      : `${nearestDistance.toFixed(1)}km away`

    showToast(`Nearest: ${nearestOffice.name} (${distanceText})`)

    btn.innerHTML = '<i class="fas fa-location-crosshairs"></i><span>Find Nearest</span>'
  }
}

function clearAllData() {
  if (confirm('This will clear all saved data. Continue?')) {
    DB.clear()
    currentTheme = 'dark'
    currentLocation = 'Locations'
    userLocation = null
    applyTheme()
    hideSettings()
    showToast('All data cleared')
    setTimeout(() => location.reload(), 1000)
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================
function filterByType(type) {
  currentFilter = type
  document.querySelectorAll('#service-tabs button').forEach(btn => {
    btn.classList.remove('active', 'bg-[var(--accent)]', 'text-[#0a0f1c]')
    btn.classList.add('hover:bg-[var(--card)]')
  })
  event.target.classList.add('bg-[var(--accent)]', 'text-[#0a0f1c]')
  event.target.classList.remove('hover:bg-[var(--card)]')
  populateServiceCards()
}

function handleSearch(e) {
  searchQuery = e.target.value
  populateTable()
}

function generateChecklist() {
  document.getElementById('service-cards-container').scrollIntoView({ behavior: 'smooth', block: 'start' })
  showToast(`Checklist ready for ${currentLocation === 'Locations' ? 'Cebu' : currentLocation}! Tap any service card.`)

  const cards = document.querySelectorAll('#service-cards > div > div')
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2', 'ring-offset-[var(--bg)]')
      setTimeout(() => {
        card.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2', 'ring-offset-[var(--bg)]')
      }, 1000)
    }, index * 80)
  })
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
  DB.set('theme', currentTheme)
  applyTheme()
}

function applyTheme() {
  const html = document.documentElement
  const icon = document.getElementById('theme-icon')
  const mobileIcon = document.getElementById('mobile-theme-icon')
  const darkmodeToggle = document.getElementById('darkmode-toggle')

  if (currentTheme === 'dark') {
    html.classList.remove('light')
    html.classList.add('dark')
    if (icon) icon.className = 'fas fa-sun text-xl text-yellow-400'
    if (mobileIcon) mobileIcon.className = 'fas fa-sun w-5 text-yellow-400'
    if (darkmodeToggle) darkmodeToggle.checked = true
  } else {
    html.classList.remove('dark')
    html.classList.add('light')
    if (icon) icon.className = 'fas fa-moon text-xl text-indigo-400'
    if (mobileIcon) mobileIcon.className = 'fas fa-moon w-5 text-indigo-400'
    if (darkmodeToggle) darkmodeToggle.checked = false
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container')
  const toast = document.createElement('div')
  const bgColor = type === 'error' ? 'bg-red-400' : type === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
  const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle'
  const textColor = 'text-[#0a0f1c]'

  toast.className = `toast-notification ${bgColor} ${textColor} px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3`
  toast.innerHTML = `<i class="fas ${icon}"></i><span class="flex-1">${message}</span>`
  container.appendChild(toast)

  setTimeout(() => toast.remove(), 3000)
}

function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden')
}

// ===========================================
// MOBILE BOTTOM NAVIGATION
// ===========================================
function navigateToSection(section) {
  // Update active state
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.section === section) {
      btn.classList.add('active')
    }
  })

  // Navigate to section
  switch(section) {
    case 'home':
      window.scrollTo({ top: 0, behavior: 'smooth' })
      break
    case 'map':
      showMapModal()
      break
    case 'checklist':
      document.getElementById('service-cards-container').scrollIntoView({ behavior: 'smooth', block: 'start' })
      showToast('Tap any service card to view checklist')
      break
    case 'submit':
      showSubmissionModal()
      break
  }
}

// Hide/show bottom nav when modals open/close
const modalIds = ['modal-backdrop', 'submission-modal', 'settings-modal', 'map-modal', 'suggest-office-modal']

function updateBottomNavVisibility() {
  const bottomNav = document.getElementById('mobile-bottom-nav')
  const anyModalOpen = modalIds.some(id => {
    const el = document.getElementById(id)
    return el && !el.classList.contains('hidden')
  })

  if (anyModalOpen) {
    bottomNav?.classList.add('hidden')
  } else {
    bottomNav?.classList.remove('hidden')
  }
}

// Watch for modal changes
const observer = new MutationObserver(updateBottomNavVisibility)

// Start observing when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  modalIds.forEach(id => {
    const el = document.getElementById(id)
    if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] })
  })
})

// Update active nav based on scroll position
function updateActiveNavOnScroll() {
  const scrollY = window.scrollY
  const checklistSection = document.getElementById('service-cards-container')

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('active')
  })

  if (scrollY < 200) {
    document.querySelector('.mobile-nav-btn[data-section="home"]')?.classList.add('active')
  } else if (checklistSection && scrollY >= checklistSection.offsetTop - 300) {
    document.querySelector('.mobile-nav-btn[data-section="checklist"]')?.classList.add('active')
  } else {
    document.querySelector('.mobile-nav-btn[data-section="home"]')?.classList.add('active')
  }
}

// ===========================================
// PWA INSTALLATION
// ===========================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  setTimeout(() => {
    if (!DB.get('pwaDismissed')) {
      document.getElementById('pwa-install-prompt').classList.remove('hidden')
    }
  }, 3000)
})

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then((result) => {
      if (result.outcome === 'accepted') {
        showToast('App installed successfully!')
      }
      deferredPrompt = null
    })
  }
  document.getElementById('pwa-install-prompt').classList.add('hidden')
}

function dismissPWA() {
  document.getElementById('pwa-install-prompt').classList.add('hidden')
  DB.set('pwaDismissed', true)
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('data:application/javascript,' + encodeURIComponent(`
    const CACHE_NAME = 'govhub-v1';
    self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['./']))));
    self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  `)).catch(() => {})
}

// Re-observe elements (for dynamic content)
function refreshScrollAnimations() {
  // Disabled - no scroll animations
}

// Parallax effect on scroll (disabled)
function initParallax() {
  // Disabled - static content
}

// ===========================================
// INITIALIZATION
// ===========================================
async function init() {
  // Remove loading screen
  document.getElementById('app-loading').classList.add('hidden')

  // Apply saved theme
  applyTheme()

  // Load saved location
  updateLocationDisplay()

  // Load saved user location
  const savedUserLoc = DB.get('userLocation')
  if (savedUserLoc) {
    userLocation = savedUserLoc
  }

  // Update UI
  populateCities()
  populateServiceTabs()
  populateServiceCards()
  populateTable()

  // Update signal date
  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
  document.getElementById('signal-date').textContent = `GOVHUB SIGNAL BOARD • ${today.toUpperCase()}`

  // Try to get location silently
  if (DB.get('autoGeolocation')) {
    try {
      const position = await GeoLocation.getCurrentPosition()
      userLocation = { lat: position.lat, lng: position.lng }
      DB.set('userLocation', userLocation)
    } catch {}
  }

  console.log('%c✅ GovHub v1.0 loaded – Simplified without authentication', 'color:#22d3ee;font-weight:600')

  // Add scroll listener for mobile nav
  window.addEventListener('scroll', () => {
    requestAnimationFrame(updateActiveNavOnScroll)
  })
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', init)
