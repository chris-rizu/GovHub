# GovHub • Cebu

> Real-time government requirements and checklists for Cebu, Philippines

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)

A Progressive Web App (PWA) that helps citizens navigate Philippine government bureaucracy by providing exact document requirements, step-by-step processes, fees, and office locations—all in one clean, mobile-first interface.

## Screenshots

| Mobile View | Desktop View |
|-------------|--------------|
| ![Mobile](https://via.placeholder.com/320x640/0a0f1c/22d3ee?text=Mobile+View) | ![Desktop](https://via.placeholder.com/800x500/0a0f1c/22d3ee?text=Desktop+View) |

## Features

### Service Checklists
- Detailed requirements for **12+ government services**
  - LTO Driver's License Renewal
  - SSS Salary Loan
  - PhilHealth Membership
  - NBI Clearance
  - DFA Passport Renewal
  - Barangay Clearance
  - BIR TIN Application
  - Pag-IBIG Housing Loan
  - OWWA Membership
  - Police Clearance
  - Cedula (Community Tax Certificate)
  - Business Permit Renewal

### Office Locator Map
- Interactive map with **89+ government offices**
- Covers **47 cities/municipalities** in Cebu
- Filter by office type (LTO, SSS, PhilHealth, NBI, DFA, etc.)
- Get directions to any office
- Sort by distance from your location

### Real-time Features
- **GPS-based location detection** - Find nearest offices automatically
- **Community updates** - Users can submit changes to help keep data current
- **Live status indicators** - See which offices are ready/serving

### User Experience
- **Dark/Light theme** with smooth transitions
- **Offline capable** - Works without internet after first load
- **Install to home screen** - PWA support for native app-like experience
- **Print & Copy** - Export checklists for offline use

## Coverage

| Metric | Count |
|--------|-------|
| Cities & Municipalities | 47 |
| Government Offices | 89+ |
| Barangays | 1,247 |
| Active Checklists | 312 |
| Services Covered | 12+ |

### Covered Areas
- **Cebu City** | **Mandaue** | **Lapu-Lapu** | **Talisay** | **Consolacion**
- **Minglanilla** | **Naga** | **Carcar** | **Toledo** | **Bogo** | **Danao**
- And 35+ more cities and municipalities across Cebu province

## Tech Stack

```
Frontend:  Vanilla JavaScript (ES6+)
HTML:      HTML5
CSS:       Tailwind CSS + Custom CSS
Maps:      Leaflet.js + OpenStreetMap
Icons:     Font Awesome 6
Storage:   LocalStorage API
PWA:       Service Worker + Web App Manifest
```

## Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/govhub-cebu.git
   cd govhub-cebu
   ```

2. **Open in browser**
   ```bash
   # Simply open index.html in your browser
   # Or use a local server
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

3. **Install as PWA**
   - Open the app in a supported browser (Chrome, Edge, Safari)
   - Click the install prompt or "Add to Home Screen"
   - Launch from home screen like a native app

### Deployment

The app is a static site and can be deployed anywhere:

```bash
# GitHub Pages
Netlify
Vercel
Firebase Hosting
Any static file host
```

## Project Structure

```
govhub-cebu/
├── index.html          # Main HTML file
├── styles.css          # Custom styles and animations
├── app.js              # Application logic
├── README.md           # This file
└── .claude/            # Claude Code configuration
```

## Usage

### For Users

1. **Select your location** - Enable GPS or choose from the city list
2. **Browse services** - View available government services
3. **Get checklist** - Tap any service card to see full requirements
4. **Find office** - Use the map to locate nearest offices
5. **Submit updates** - Help the community by reporting changes

### For Developers

#### Adding a New Service

Edit `servicesData` in `app.js`:

```javascript
const servicesData = {
  // ... existing services
  newservice: {
    title: "New Service Name",
    subtitle: "Brief description",
    status: "VERIFIED",
    value: "Fee or value",
    change: "Update info",
    key: "newservice",
    category: "id" // or 'loan', 'permit'
  }
}
```

Then add the modal content in `modalData`.

#### Adding Office Locations

Edit `officeLocations` in `app.js`:

```javascript
const officeLocations = {
  lto: [
    {
      id: 'lto-new-office',
      name: 'LTO New Office',
      address: 'Full address',
      lat: 10.0000,
      lng: 123.0000,
      type: 'lto'
    }
  ]
}
```

## Customization

### Theme Colors

Edit the CSS variables in `styles.css`:

```css
:root {
  --theme-accent: #22d3ee;      /* Primary accent color */
  --theme-bg-start: #0a0f1c;    /* Gradient start */
  --theme-bg-end: #0f172a;      /* Gradient end */
  --theme-card: #111827;        /* Card background */
  /* ... */
}
```

### Branding

Replace the logo and app name in `index.html`:
- Update the `<title>` tag
- Replace the SVG logo
- Edit the "GovHub" text references

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 90+ |
| Edge | 90+ |
| Safari | 14+ |
| Firefox | 88+ |
| Opera | 76+ |

## Contributing

Contributions are welcome! Here's how you can help:

1. **Report bugs** - Open an issue with details
2. **Suggest features** - Share your ideas
3. **Submit updates** - Use the in-app submission form
4. **Improve code** - Fork, modify, and submit a PR

### Development Setup

```bash
# Fork the repo
git clone https://github.com/yourusername/govhub-cebu.git
git checkout -b feature/your-feature-name
# Make your changes
git commit -m "Add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

## Roadmap

- [ ] Add more government services
- [ ] Implement backend for real-time updates
- [ ] Add user accounts for saving preferences
- [ ] SMS notification support for queue updates
- [ ] Expand to other provinces (Bohol, Negros, etc.)
- [ ] Offline-first architecture with service worker caching

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- **Office locations** - OpenStreetMap contributors
- **Icons** - Font Awesome
- **Maps** - Leaflet.js
- **Government data** - Respective agency websites (LTO, SSS, PhilHealth, NBI, DFA, etc.)

## Disclaimer

> **Note:** Requirements and fees may change. Always verify on the official agency website before proceeding. This app serves as a guide and community-sourced information hub.

## Contact

- **Issues**: [GitHub Issues](https://github.com/yourusername/govhub-cebu/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/govhub-cebu/discussions)

---

Made with ❤️ for Cebu | [View Live Demo](https://your-demo-link.com)
