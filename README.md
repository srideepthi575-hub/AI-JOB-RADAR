# Job Radar — AI-Powered Job Discovery Platform for CSE/IT Freshers in India

![Daily Job Refresh Pipeline](https://github.com/your-username/job-radar/actions/workflows/daily-jobs.yml/badge.svg)

**Job Radar** is a production-ready, AI-powered real-time job discovery and match-analysis platform built specifically for Computer Science & IT students, final-year undergraduates, recent graduates, freshers, internship seekers, and candidates with 0–2 years of experience in India.

---

## 🎯 Problem Statement
Fresh CSE and IT graduates in India face several challenges when entering the job market:
1. **Data Noise & Fake Listings**: Many job boards present stale, duplicate, or fictional postings.
2. **Skill Misalignment**: Candidates struggle to know whether their current technical skills align with employer expectations.
3. **Opaque Match Criteria**: Traditional job portals do not explain *why* a candidate fits a role or what specific technical skills they are missing.

---

## 💡 Solution & Core Value
Job Radar solves this through a non-negotiable **Real Data Architecture**:
```text
Real Job Sources (JobSpy, Adzuna, Jooble, Company Feeds)
       ↓
Source Adapters & Registry Reporting
       ↓
Schema Validation & Cleaning
       ↓
Canonical Normalization
       ↓
Primary & Fallback Deduplication
       ↓
JSON Storage (data/jobs.json) & Timestamping
       ↓
Deterministic Weighted Match Scoring (40% Req, 15% Pref, 15% Role, etc.)
       ↓
Layer 2 Grounded AI Explanations & Resume Feedback
       ↓
Dynamic Skill Gap Analysis & Career Insights
       ↓
Modern Glassmorphism Web Interface
       ↓
Original Application Link (Direct to Employer / Job Board)
```

---

## 🚀 Key Features

* **100% Real Job Data Pipeline**: Transparent source reporting across JobSpy (LinkedIn, Indeed, Google Jobs), Adzuna API, Jooble API, and Company Career Feeds. Zero fake listings or hardcoded mock data.
* **Deterministic Match Engine**: Configurable 7-factor weighted algorithm (Required Skills 40%, Preferred Skills 15%, Role Similarity 15%, Experience 10%, Location/Mode 10%, Education 5%, Projects 5%).
* **Resume Parser & AI Feedback**: Upload PDF/DOCX resumes to extract technical skill sets, degree, branch, projects, and receive grounded resume strength analysis and improvement suggestions.
* **Job Description Matcher**: Paste any target Job Description to compare against your candidate profile in real-time, receiving a score breakdown, missing skills, and interview preparation topics.
* **Dynamic Skill Gap & Market Learning**: Calculates skill frequency percentages strictly from the currently collected real job dataset and sample size.
* **CSE & IT Career Insights**: Live statistics on top demanded skills, top fresher roles, top tech hubs in India (Bengaluru, Chennai, Hyderabad, Pune, Remote), work mode distribution, and top posting companies.
* **Date-Wise Grouping**: Automatic categorization into `TODAY`, `THIS WEEK`, `THIS MONTH`, and `ALL JOBS`.
* **Bookmarking & Tracking**: Save jobs to `Saved`, `Applied`, `Interested`, or `Rejected` lists preserved in browser `localStorage`.
* **Automated Daily Refresh**: GitHub Actions workflow automatically crawls, validates, deduplicates, and commits fresh job data every 24 hours.

---

## ⚙️ Architecture & Source Adapters

| Adapter | Status | Fetch Mechanism | Description |
| :--- | :--- | :--- | :--- |
| **JobSpy Source** | Active | `python-jobspy` | Aggregates real entry-level tech roles from LinkedIn, Indeed, and Google Jobs. |
| **Company Feeds** | Active | Public Tech Feeds | Queries legitimate developer career endpoints (e.g. RemoteOK RSS/API). |
| **Adzuna Source** | Configurable | REST API | Official Adzuna API for India (`ADZUNA_APP_ID` & `ADZUNA_APP_KEY`). |
| **Jooble Source** | Configurable | REST API | Official Jooble API (`JOOBLE_API_KEY`). |

---

## 🧮 Deterministic Match Formula

Job Radar uses a strict 2-layer matching architecture:
1. **Layer 1 — Structured Match Score**:
   $$\text{Score} = 0.40 \cdot S_{\text{req}} + 0.15 \cdot S_{\text{pref}} + 0.15 \cdot R_{\text{role}} + 0.10 \cdot E_{\text{exp}} + 0.10 \cdot L_{\text{loc}} + 0.05 \cdot E_{\text{edu}} + 0.05 \cdot P_{\text{proj}}$$
2. **Layer 2 — AI Explanation**:
   Grounded natural-language explanation detailing why the role matches, primary missing skills, and recommended preparation steps.

---

## 💻 Local Setup & Installation

### Prerequisites
* Python 3.10+
* Node.js v18+ / npm

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/your-username/job-radar.git
cd job-radar

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Copy environment variables
cp .env.example .env

# 4. Run Crawler to fetch real live jobs
python crawler/run.py

# 5. Run Automated Unit Test Suite
python -m unittest discover tests

# 6. Start Web Server & API
python server.py
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🔑 Environment Variables (`.env.example`)

```env
PORT=5000
HOST=0.0.0.0

# Optional API Keys (Fallbacks are used if omitted)
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JOOBLE_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

JOBSPY_ENABLED=true
ADZUNA_ENABLED=true
JOOBLE_ENABLED=true
COMPANY_ENABLED=true
```

---

## 🤖 GitHub Actions Automation (`.github/workflows/daily-jobs.yml`)

The repository includes a daily GitHub Actions scheduled workflow:
```yaml
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:
```
The pipeline automatically runs `python crawler/run.py`, executes unit tests, and commits updated `data/jobs.json` dataset if changes are detected.

---

## 🛡️ Security & Privacy
* No secret API keys exposed in frontend code.
* PDF/DOCX files processed safely in-memory without shell execution risks.
* Safe input validation and URL sanitization.

---

## 📄 License
Distributed under the MIT License.
