# Fulcrum

[![GitHub Pages](https://img.shields.io/badge/github%20pages-deployed-brightgreen?style=for-the-badge)](https://gphmf.github.io/Fulcrum)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)]()
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)]()
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)]()
[![3-Tier Ecosystem](https://img.shields.io/badge/architecture-3%20tier%20wellness%20ecosystem-teal?style=flat)]()
[![Accessibility](https://img.shields.io/badge/accessibility-WCAG%20AA-green?style=flat)]()

<br>

![Fulcrum Hero Screenshot](https://raw.githubusercontent.com/GPHMF/Fulcrum/main/src/hero_screenshot.jpg)

## Healthcare's Pivot Point: The 3-Tier Wellness Ecosystem

**Live Site:** [**https://gphmf.github.io/Fulcrum**](https://gphmf.github.io/Fulcrum)

---

### Why Fulcrum?

The name "Fulcrum" represents **healthcare providers as the pivot point** of the entire healthcare system. When they're supported and well, everyone benefits. With **63% of physicians reporting burnout** and **physician suicide rates 2x higher** than the general population, this platform provides the **evidence-based resources** providers need to maintain their own wellness while caring for others.

---

## About The Project

Fulcrum is a **comprehensive, multi-faceted wellness platform** built to support the entire spectrum of healthcare—from frontline providers to C-suite leadership. In an industry facing a systemic burnout epidemic, this site provides **targeted, evidence-based resources** for three distinct audiences:

- **Individual Providers:** Targeted mental and physical health strategies for 8 distinct healthcare roles
- **Providers in Crisis:** A fast, filterable directory of immediate, confidential crisis support services
- **Healthcare Leadership:** A strategic dashboard with system-level interventions, implementation roadmaps, and an interactive ROI calculator to make the business case for wellness

The entire application is a **fast, responsive, and accessible Single Page Application (SPA)** built with vanilla HTML, CSS, and JavaScript. All content is dynamically loaded from **three "headless" JSON files**, creating a true headless CMS that is fast, scalable, and easy to maintain.

---

## 📊 Project Scale

| Dimension | Scope |
|-----------|-------|
| **Provider Roles** | 8 (Physicians, Residents, NPs, PAs, Nurses, Pharmacists, Therapists, MAs) |
| **Organizational Strategies** | 68 across 8 leadership categories (Critical/High/Medium priority) |
| **Crisis Resources** | 40+ with multi-dimensional filtering (type, access method, cost, severity) |
| **Total Structured Data** | 423.6 KB across 3 JSON architectures |
| **Search Coverage** | 3 independent data sources with unified ranking |

---

## ✨ Key Features

### Pillar 1: Provider Wellness (For Individuals)

* **Comprehensive Content:** In-depth mental and physical health guides for **8 provider roles** (Physicians, Residents & Medical Students, Nurse Practitioners, Physician Assistants, Nurses, Pharmacists, Therapists, Medical Assistants & PCTs)
* **Dynamic SPA:** Built with **hash-based routing** for instant content loading with no page reloads
* **Context-Aware Search:** Powerful client-side search engine scoped to specific providers or platform-wide, powered by **advanced relevance scoring**

### Pillar 2: Crisis Resource Center (For Immediate Help)

* **Filterable Directory:** Interactive directory of crisis resources filtered by **provider type, access method (phone/text/chat), cost tier, and severity level**
* **Quick Access Guides:** Step-by-step modal guides for acute situations ("If You're Having Thoughts of Suicide," "Helping a Colleague," etc.)
* **Crisis Indicators:** Triage tool identifying crisis severity (Critical/High/Moderate) with immediate action recommendations
* **Provider-Specific Guidance:** Curated resource lists tailored to each healthcare role's unique challenges

### Pillar 3: Organizational Strategies (For Leadership)

* **Executive Summary Dashboard:** C-suite overview featuring **key burnout metrics, turnover costs, and ROI projections**
* **Interactive ROI Calculator:** Financial modeling tool allowing leaders to project multi-year savings from wellness investments
* **Strategy Comparison Tool:** Select and compare **up to 3 interventions** side-by-side (cost, timeline, ROI, implementation complexity)
* **Implementation Roadmap:** **3-year phased deployment** timeline with Quick Wins, Medium-term, and Culture Change phases
* **Role-Specific Strategies:** Targeted guidance addressing unique pain points of Physicians, Nurses, Trainees, and PA/NPs

### Platform-Wide Features

* **Light/Dark Mode:** Dynamic theme toggle respecting system preferences and saved to `localStorage`
* **Data-Driven Architecture:** All content loaded from three JSON files, enabling updates without touching application logic
* **Responsive & Accessible:** Clean UI with **full keyboard navigation, ARIA labels, and screen reader support** (WCAG Level AA)
* **Zero Build Steps:** Clone, open in browser with local server—no dependencies beyond Chart.js

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Structure** | HTML5 with semantic tags & ARIA attributes | Accessibility & SEO |
| **Styling** | CSS3 with custom properties & dual themes | Maintainable, themeable design system |
| **Logic** | Vanilla JavaScript (ES6+) | No frameworks—pure, performant vanilla JS |
| **Visualization** | Chart.js | ROI chart visualization |
| **Data** | 3-tier JSON architecture | Provider wellness, organizational strategies, crisis resources |
| **Deployment** | GitHub Pages | Free, fast static hosting |

**Statistics:**
- **No external dependencies** except Chart.js for visualizations
- **Lightweight:** ~145 KB JavaScript, ~95 KB CSS, ~20 KB HTML
- **Performance:** Instant navigation via SPA, lazy-loaded content on demand
- **Accessibility:** WCAG Level AA compliant with full keyboard navigation

---

## 🚀 Getting Started

This project has **no build step**, making it simple to run locally.

```bash
# Clone the repository
git clone https://github.com/GPHMF/Fulcrum.git

# Navigate to the directory
cd Fulcrum

# Open index.html in your browser
# (Requires local server for fetch API—use VS Code Live Server or python -m http.server)
```

**Note:** A local server (like the VS Code "Live Server" extension or `python -m http.server`) is required for the fetch API to correctly load the JSON files from the `/data/` directory.

---

## 📁 Project Structure

```
Fulcrum/
├── index.html                          # Main entry point
├── app.js                              # 145KB vanilla JavaScript (3-tier routing, search, charting)
├── style.css                           # 95KB CSS with dual-theme system
├── README.md                           # This file
├── data/
│   ├── provider_data.json              # 225KB: 8 provider wellness profiles
│   ├── organization.json               # 123KB: 68 org strategies + ROI models
│   └── crisis.json                     # 75KB: 40+ crisis resources + guides
├── provider_images/                    # Provider card images (8 images)
│   ├── doctor.jpg                      # Physicians
│   ├── resident.jpg                    # Residents & Medical Students
│   ├── NP.jpg                          # Nurse Practitioners
│   ├── PA.jpg                          # Physician Assistants
│   ├── nurse.jpg                       # Nurses
│   ├── pharmacist.jpg                  # Pharmacists
│   ├── therapist.jpg                   # Therapists (PT, OT, RT)
│   └── MA.jpg                          # Medical Assistants & PCTs
└── src/
    └── hero_screenshot.jpg             # Marketing image for README and Social Media Links
	└── hero.jpg             			# Hero image for the Project Homepage
	└── favicon_light.jpg             	# Favicon for Light Mode
	└── favicon_dark.jpg           	    # Favicon for Dark Mode
```

---

## 🎯 Content Breakdown

### Provider Data (225 KB)
- 8 provider types with **role-specific** mental and physical health content
- 4-6 key stressors per role with evidence-based context
- 4-6 strategies with action steps and research support
- 5-8 professional resources per role with links

### Organizational Strategies (123 KB)
- **8 categories** (Admin Burden, Work Environment, Leadership Culture, Financial Sustainability, Provider Voice, Technology, DEI, Mental Health Support)
- **68 total strategies** with:
  - Timeline & difficulty level
  - Cost & FTE requirements
  - Before/after ROI scenarios
  - Case studies with real-world data
  - Implementation pitfalls & success factors

### Crisis Resources (75 KB)
- **5-tier resource categories** (Primary Emergency, Specialized Provider, Regional, Peer Support, Workplace)
- **40+ curated resources** with filtering on:
  - Availability (24/7 vs business hours)
  - Access method (phone, text, chat, web, in-person)
  - Provider specialty
  - Cost tier
- **Quick-access crisis guides** with step-by-step actions
- **Severity indicators** (Critical/High/Moderate) with immediate next steps

---

## 🗺️ Roadmap

**V2 Delivered:**
- [x] Significantly expand Provider Roles (from 4 to 8)
- [x] Organizational leadership strategies (68 strategies, 8 categories)
- [x] Crisis resource restructuring (detailed guides by situation, multi-filtering)
- [x] Interactive ROI calculator with advanced JavaScript logic (550+ lines of code)
- [x] Implementation roadmap visualizer (3-year phased deployment)
- [x] 3-source unified search with advanced relevance scoring
- [x] Provider role-specific recommendations
- [x] Partial implementation of Mobile View (optimization for small-screen devices)

**V2.1 Update:**
- [x] Significantly reworked the ROI Calculator logic to incorporate separate Human-Impact and Financial-Impact Metrics (now it's 800+ lines of code)
- [x] Minor bug-fixes in Organizational Strategies section

**V2.2 Update:**
- [x] Improve crisis card filtering logic
- [x] Modify the crisis cards to account for the improved filtering

**Future Vision:**
- [ ] Complete Mobile View implementation to improve layout on mobile devices (priority)
- [ ] Make new additions (v2) compliant with Accessibility Guidelines
- [ ] Make the app.js modular (separate js files for each major section)
- [ ] Print-friendly versions of resources and organizational reports
- [ ] Standalone "Financial Wellness" and "Substance Use" pages with dedicated content
- [ ] Improve navigation across sections
- [ ] Replace existing provider images. Add more images/diagrams for content clarity
- [ ] Have all citations be clickable/verifiable
- [ ] Improve Organizational Strategies further by improving logic across the Provider and Roadmap sections etc.
- [ ] Multi-language support (Spanish, Chinese, etc.)
- [ ] Analytics dashboard (engagement metrics, most-used resources)
- [ ] Provider comparison tool (analyze similar roles across metrics)
- [ ] Search Engine Optimization (SEO)

---

## 📋 License

© 2025 Fulcrum. **For educational purposes only.**

This site is not intended to provide medical advice. Always consult with licensed medical professionals for diagnosis and treatment.

---

## 📞 Contact & Support

For questions or feedback about this project, please [open an issue](https://github.com/GPHMF/Fulcrum/issues) on this repository.

---

## ⚠️ Crisis Support

**If you or someone you know is in crisis, help is available 24/7:**

| Resource | Contact | Best For |
|----------|---------|----------|
| **988 Suicide & Crisis Lifeline** | Call or text **988** | Immediate crisis support, anyone |
| **Crisis Text Line** | Text **HOME** to **741741** | 24/7 crisis counseling via text |
| **FRONTLINE** | Text **FRONTLINE** to **741741** | Crisis support for healthcare providers |
| **Physician Support Line** | Call **1-888-409-0141** | Confidential support for physicians |

**You are not alone.** Crisis support is confidential, free, and will not impact your professional standing or licensure.

---

Built with ❤️ for healthcare providers everywhere.

