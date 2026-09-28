// Job Radar Platform Frontend Engine
document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let allJobs = [];
  let groupedJobs = { today: [], thisWeek: [], thisMonth: [], unspecified: [] };
  let candidateProfile = {
    degree: "B.Tech CSE",
    branch: "Computer Science",
    graduationYear: "2026",
    experience: "Fresher",
    skills: ["Python", "Java", "JavaScript", "SQL", "Git", "HTML", "CSS"],
    projects: ["E-commerce Web App", "Data Analysis Dashboard"],
    preferredRoles: ["Software Developer", "Frontend Developer", "Python Developer"],
    preferredLocations: ["Bengaluru", "Chennai", "Hyderabad", "Remote"],
    preferredWorkMode: "Any"
  };

  let activeDateGroup = "all";
  let savedJobIds = JSON.parse(localStorage.getItem("jobradar_saved_ids") || "[]");

  // DOM Elements
  const navLinks = document.querySelectorAll(".nav-link");
  const tabPages = document.querySelectorAll(".tab-page");
  
  const jobsGridContainer = document.getElementById("jobs-grid-container");
  const jobsEmptyState = document.getElementById("jobs-empty-state");
  const lblLastUpdated = document.getElementById("lbl-last-updated");
  const lblDatasetStats = document.getElementById("lbl-dataset-stats");
  const lblSavedCount = document.getElementById("saved-count");

  // Filter Elements
  const searchInput = document.getElementById("search-input");
  const filterRole = document.getElementById("filter-role");
  const filterLocation = document.getElementById("filter-location");
  const filterWorkMode = document.getElementById("filter-workmode");
  const filterJobType = document.getElementById("filter-jobtype");
  const filterSource = document.getElementById("filter-source");
  const filterMinScore = document.getElementById("filter-minscore");
  const btnResetFilters = document.getElementById("btn-reset-filters");
  const btnManualRefresh = document.getElementById("btn-manual-refresh");

  // Initial Setup
  initNavigation();
  initFilters();
  initResumeDropzone();
  initJdMatcher();
  loadJobs();
  loadSourceHealth();

  // -------------------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------------------
  function initNavigation() {
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        const targetTab = link.getAttribute("data-tab");
        
        navLinks.forEach(n => n.classList.remove("active"));
        tabPages.forEach(p => p.style.display = "none");

        link.classList.add("active");
        const activePage = document.getElementById(targetTab);
        if (activePage) activePage.style.display = "block";

        if (targetTab === "recommended-tab") renderRecommendedJobs();
        if (targetTab === "skillgap-tab") loadSkillGap();
        if (targetTab === "insights-tab") loadInsights();
        if (targetTab === "saved-tab") renderSavedJobs();
        if (targetTab === "health-tab") loadSourceHealth();
      });
    });

    document.querySelectorAll(".date-tabs .tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".date-tabs .tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeDateGroup = btn.getAttribute("data-dategroup");
        renderJobsFeed();
      });
    });

    if (btnResetFilters) {
      btnResetFilters.addEventListener("click", () => {
        searchInput.value = "";
        filterRole.value = "all";
        filterLocation.value = "all";
        filterWorkMode.value = "all";
        filterJobType.value = "all";
        filterSource.value = "all";
        filterMinScore.value = "0";
        renderJobsFeed();
      });
    }

    if (btnManualRefresh) {
      btnManualRefresh.addEventListener("click", async () => {
        btnManualRefresh.disabled = true;
        btnManualRefresh.innerHTML = "<span>🔄</span> Refreshing...";
        try {
          const resp = await fetch("/api/crawl", { method: "POST" });
          const res = await resp.json();
          alert(res.message);
          await loadJobs();
          await loadSourceHealth();
        } catch (err) {
          alert("Refresh trigger error: " + err.message);
        } finally {
          btnManualRefresh.disabled = false;
          btnManualRefresh.innerHTML = "<span>🔄</span> Refresh Jobs";
        }
      });
    }
  }

  // -------------------------------------------------------------------
  // JOBS LOADING & RENDERING
  // -------------------------------------------------------------------

  function computeDateGroups(jobs) {
    const today = [];
    const thisWeek = [];
    const thisMonth = [];
    const unspecified = [];
    const now = new Date();

    jobs.forEach(j => {
      const posted = j.postedAt;
      if (!posted || posted === "Not specified") {
        unspecified.push(j);
        return;
      }
      try {
        const cleanDate = String(posted).split("T")[0].split(" ")[0];
        const pdate = new Date(cleanDate + "T00:00:00Z");
        const diffDays = Math.floor((now - pdate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) { today.push(j); thisWeek.push(j); thisMonth.push(j); }
        else if (diffDays <= 7) { thisWeek.push(j); thisMonth.push(j); }
        else if (diffDays <= 30) { thisMonth.push(j); }
        else { unspecified.push(j); }
      } catch (_) {
        unspecified.push(j);
      }
    });
    return { today, thisWeek, thisMonth, unspecified };
  }

  function applyJobsData(data) {
    allJobs = data.jobs || [];
    groupedJobs = computeDateGroups(allJobs);

    const meta = data.metadata || {};
    if (lblLastUpdated) lblLastUpdated.textContent = meta.lastSuccessfulUpdate || "Not specified";
    if (lblDatasetStats) lblDatasetStats.textContent = `${allJobs.length} Verified Jobs`;

    const countAll = document.getElementById("count-all");
    const countToday = document.getElementById("count-today");
    const countWeek = document.getElementById("count-week");
    const countMonth = document.getElementById("count-month");
    if (countAll) countAll.textContent = allJobs.length;
    if (countToday) countToday.textContent = groupedJobs.today.length;
    if (countWeek) countWeek.textContent = groupedJobs.thisWeek.length;
    if (countMonth) countMonth.textContent = groupedJobs.thisMonth.length;

    renderJobsFeed();
    renderProfileSummary();
  }

  async function loadJobs() {
    // Show loading state
    if (jobsGridContainer) {
      jobsGridContainer.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-secondary);">
          <div style="font-size:2rem;margin-bottom:0.75rem;">🔄</div>
          <p style="font-size:1rem;font-weight:600;">Loading verified tech jobs...</p>
        </div>`;
    }

    // Try 1: Fetch from /data/jobs.json (static file — works on Vercel & GitHub Pages)
    try {
      const resp = await fetch("/data/jobs.json");
      if (resp.ok) {
        const data = await resp.json();
        applyJobsData(data);
        return;
      }
    } catch (_) {}

    // Try 2: Fetch from Flask API backend (works on Render, Railway, Docker, local dev)
    try {
      const resp = await fetch("/api/jobs");
      if (resp.ok) {
        const data = await resp.json();
        applyJobsData(data);
        return;
      }
    } catch (_) {}

    // All sources failed
    console.error("Could not load jobs from any source.");
    if (jobsGridContainer) {
      jobsGridContainer.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;">
          <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>
          <p style="font-size:1rem;font-weight:600;color:var(--text-primary);margin-bottom:0.5rem;">Could not load jobs dataset</p>
          <p style="color:var(--text-secondary);font-size:0.9rem;">Please refresh the page or check your connection.</p>
          <button onclick="loadJobs()" style="margin-top:1rem;padding:0.6rem 1.5rem;background:var(--accent-gradient);border:none;border-radius:var(--radius-md);color:#fff;font-weight:600;cursor:pointer;">
            🔄 Retry
          </button>
        </div>`;
    }
  }

  const LOCATION_ALIASES = {
    bengaluru: ["bengaluru", "bangalore", "ka", "karnataka", "india"],
    hyderabad: ["hyderabad", "ts", "telangana", "ap", "andhra", "india"],
    pune: ["pune", "mh", "maharashtra", "india"],
    mumbai: ["mumbai", "mh", "maharashtra", "india"],
    noida: ["noida", "gurugram", "gurgaon", "delhi", "ncr", "up", "hr", "dl", "india"],
    remote: ["remote", "work from home"]
  };

  function renderJobsFeed() {
    let dataset = allJobs;
    if (activeDateGroup === "today") {
      dataset = (groupedJobs.today && groupedJobs.today.length > 0) ? groupedJobs.today : allJobs;
    } else if (activeDateGroup === "thisWeek") {
      dataset = (groupedJobs.thisWeek && groupedJobs.thisWeek.length > 0) ? groupedJobs.thisWeek : allJobs;
    } else if (activeDateGroup === "thisMonth") {
      dataset = (groupedJobs.thisMonth && groupedJobs.thisMonth.length > 0) ? groupedJobs.thisMonth : allJobs;
    }

    const query = searchInput.value.trim().toLowerCase();
    const role = filterRole.value.toLowerCase();
    const location = filterLocation.value.toLowerCase();
    const workMode = filterWorkMode.value.toLowerCase();
    const jobType = filterJobType.value.toLowerCase();
    const source = filterSource.value.toLowerCase();
    const minScore = parseInt(filterMinScore.value) || 0;

    let filtered = dataset.filter(job => {
      if (query) {
        const text = `${job.title} ${job.company} ${job.location} ${job.description} ${(job.requiredSkills || []).join(" ")}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      if (role !== "all" && !(job.title || "").toLowerCase().includes(role)) return false;

      // Location matching with State & City Aliases
      if (location !== "all") {
        const jobLoc = (job.location || "").toLowerCase();
        const aliases = LOCATION_ALIASES[location] || [location];
        if (!aliases.some(a => jobLoc.includes(a))) return false;
      }

      if (workMode !== "all" && !(job.workMode || "").toLowerCase().includes(workMode)) return false;
      if (jobType !== "all" && !(job.jobType || "").toLowerCase().includes(jobType)) return false;
      if (source !== "all" && !(job.source || "").toLowerCase().includes(source)) return false;

      // Match Score calculation
      const matchScore = calculateMatch(job);
      job._matchScore = matchScore;
      if (minScore > 0 && matchScore < minScore) return false;

      return true;
    });

    if (filtered.length === 0) {
      jobsGridContainer.style.display = "none";
      jobsEmptyState.style.display = "block";
    } else {
      jobsEmptyState.style.display = "none";
      jobsGridContainer.style.display = "grid";
      jobsGridContainer.innerHTML = filtered.map(job => renderJobCard(job)).join("");
      attachCardListeners();
    }
  }

  function renderJobCard(job) {
    const isSaved = savedJobIds.includes(job.id);
    const score = job._matchScore || calculateMatch(job);
    const reqSkills = job.requiredSkills || [];
    
    const candSkills = (candidateProfile.skills || []).map(s => s.toLowerCase());
    const matchingChips = reqSkills.filter(s => candSkills.includes(s.toLowerCase()));
    const missingChips = reqSkills.filter(s => !candSkills.includes(s.toLowerCase()));

    return `
      <div class="card job-card" data-id="${job.id}">
        <div>
          <div class="job-card-header">
            <div>
              <h3 class="job-title">${escapeHtml(job.title)}</h3>
              <div class="job-company">${escapeHtml(job.company)}</div>
            </div>
            <div class="match-pill ${score < 75 ? 'medium' : ''}">
              ${score}% AI MATCH
            </div>
          </div>

          <div class="job-meta-list" style="margin-top: 0.6rem; margin-bottom: 0.75rem;">
            <span class="job-meta-item">📍 ${escapeHtml(job.location)}</span>
            <span class="job-meta-item">💼 ${escapeHtml(job.workMode)}</span>
            <span class="job-meta-item">⏱️ ${escapeHtml(job.experienceRequirement)}</span>
            <span class="job-meta-item">📅 Posted: ${escapeHtml(job.postedAt)}</span>
          </div>

          <div class="skills-list">
            ${matchingChips.map(s => `<span class="skill-chip">✓ ${escapeHtml(s)}</span>`).join("")}
            ${missingChips.map(s => `<span class="skill-chip missing">△ ${escapeHtml(s)}</span>`).join("")}
          </div>
        </div>

        <div class="job-card-footer">
          <span class="source-badge">Source: ${escapeHtml(job.source)}</span>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-secondary btn-sm btn-bookmark" data-id="${job.id}">
              ${isSaved ? '★ Saved' : '☆ Save'}
            </button>
            <a href="${escapeHtml(job.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
              Apply Now ↗
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function calculateMatch(job) {
    const candSkills = new Set((candidateProfile.skills || []).map(s => s.toLowerCase()));
    const reqSkills = job.requiredSkills || [];
    if (reqSkills.length === 0) return 75;

    let matched = 0;
    reqSkills.forEach(s => {
      if (candSkills.has(s.toLowerCase())) matched++;
    });

    const skillFrac = matched / reqSkills.length;
    const baseScore = Math.round(skillFrac * 40 + 45); // Deterministic base
    return Math.min(98, Math.max(30, baseScore));
  }

  function attachCardListeners() {
    document.querySelectorAll(".btn-bookmark").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (savedJobIds.includes(id)) {
          savedJobIds = savedJobIds.filter(i => i !== id);
        } else {
          savedJobIds.push(id);
        }
        localStorage.setItem("jobradar_saved_ids", JSON.stringify(savedJobIds));
        lblSavedCount.textContent = savedJobIds.length;
        renderJobsFeed();
      });
    });
  }

  function initFilters() {
    [searchInput, filterRole, filterLocation, filterWorkMode, filterJobType, filterSource, filterMinScore].forEach(el => {
      if (el) el.addEventListener("input", renderJobsFeed);
    });
  }


  // -------------------------------------------------------------------
  // RECOMMENDED JOBS
  // -------------------------------------------------------------------
  function renderRecommendedJobs() {
    const container = document.getElementById("recommended-grid-container");
    if (!container) return;

    if (allJobs.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-secondary);">
          <div style="font-size:2.5rem;margin-bottom:1rem;">📭</div>
          <p style="font-size:1rem;font-weight:600;">No jobs loaded yet. Go to Explore Jobs first.</p>
        </div>`;
      return;
    }

    const candSkillsSet = new Set((candidateProfile.skills || []).map(s => s.toLowerCase()));
    const prefRoles = (candidateProfile.preferredRoles || []).map(r => r.toLowerCase());
    const prefLocs = (candidateProfile.preferredLocations || []).map(l => l.toLowerCase());

    const scored = allJobs.map(j => {
      const reqSkills = j.requiredSkills || [];
      const prefSkills = j.preferredSkills || [];

      // Skill match (50 pts)
      const reqMatched = reqSkills.filter(s => candSkillsSet.has(s.toLowerCase())).length;
      const prefMatched = prefSkills.filter(s => candSkillsSet.has(s.toLowerCase())).length;
      const skillScore = reqSkills.length > 0
        ? Math.round((reqMatched / reqSkills.length) * 40 + (prefSkills.length > 0 ? (prefMatched / prefSkills.length) * 10 : 5))
        : 30;

      // Role match (20 pts)
      const titleLower = (j.title || "").toLowerCase();
      const roleScore = prefRoles.some(r => titleLower.includes(r) || r.includes(titleLower.split(" ")[0])) ? 20 : 0;

      // Location match (15 pts)
      const locLower = (j.location || "").toLowerCase();
      const locScore = prefLocs.some(l => locLower.includes(l)) ? 15 : (locLower.includes("india") ? 5 : 0);

      // Recency bonus (15 pts)
      let recencyScore = 0;
      try {
        const cleanDate = String(j.postedAt || "").split("T")[0];
        const diffDays = Math.floor((new Date() - new Date(cleanDate + "T00:00:00Z")) / (1000*60*60*24));
        if (diffDays <= 1) recencyScore = 15;
        else if (diffDays <= 7) recencyScore = 10;
        else if (diffDays <= 30) recencyScore = 5;
      } catch (_) {}

      const totalScore = Math.min(98, Math.max(30, skillScore + roleScore + locScore + recencyScore));
      return { ...j, _matchScore: totalScore, _reqMatched: reqMatched, _reqTotal: reqSkills.length };
    }).sort((a, b) => b._matchScore - a._matchScore).slice(0, 12);

    container.innerHTML = scored.map(job => {
      const isSaved = savedJobIds.includes(job.id);
      const reqSkills = job.requiredSkills || [];
      const candSkills = (candidateProfile.skills || []).map(s => s.toLowerCase());
      const matchingChips = reqSkills.filter(s => candSkills.includes(s.toLowerCase()));
      const missingChips = reqSkills.filter(s => !candSkills.includes(s.toLowerCase()));
      const score = job._matchScore;
      const scoreColor = score >= 80 ? "var(--accent-cyan)" : score >= 60 ? "#f59e0b" : "#ef4444";

      return `
        <div class="card job-card" data-id="${job.id}">
          <div>
            <div class="job-card-header">
              <div>
                <h3 class="job-title">${escapeHtml(job.title)}</h3>
                <div class="job-company">${escapeHtml(job.company)}</div>
              </div>
              <div class="match-pill ${score < 75 ? 'medium' : ''}" style="background:${scoreColor}15;border:1px solid ${scoreColor};color:${scoreColor};">
                ${score}% MATCH
              </div>
            </div>

            <div class="job-meta-list" style="margin-top:0.6rem;margin-bottom:0.6rem;">
              <span class="job-meta-item">📍 ${escapeHtml(job.location)}</span>
              <span class="job-meta-item">💼 ${escapeHtml(job.workMode)}</span>
              <span class="job-meta-item">⏱️ ${escapeHtml(job.experienceRequirement)}</span>
              <span class="job-meta-item">📅 ${escapeHtml(job.postedAt)}</span>
            </div>

            <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.5rem;">
              ✅ ${matchingChips.length}/${reqSkills.length} skills matched
              ${missingChips.length > 0 ? ` · Missing: <span style="color:#f59e0b">${missingChips.slice(0,3).map(s => escapeHtml(s)).join(", ")}</span>` : ' · <span style="color:var(--accent-cyan)">All required skills matched!</span>'}
            </div>

            <div class="skills-list">
              ${matchingChips.map(s => `<span class="skill-chip">✓ ${escapeHtml(s)}</span>`).join("")}
              ${missingChips.slice(0,3).map(s => `<span class="skill-chip missing">△ ${escapeHtml(s)}</span>`).join("")}
            </div>
          </div>

          <div class="job-card-footer">
            <span class="source-badge">via ${escapeHtml(job.source)}</span>
            <div style="display:flex;gap:0.5rem;align-items:center;">
              <button class="btn btn-secondary btn-sm btn-bookmark" data-id="${job.id}">
                ${isSaved ? '★ Saved' : '☆ Save'}
              </button>
              <a href="${escapeHtml(job.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                Apply Now ↗
              </a>
            </div>
          </div>
        </div>`;
    }).join("");

    attachCardListeners();
  }


  // -------------------------------------------------------------------
  // RESUME PARSER & ANALYZER
  // -------------------------------------------------------------------
  function initResumeDropzone() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("resume-file-input");
    const btnAnalyzeText = document.getElementById("btn-analyze-pasted");
    const textInput = document.getElementById("resume-text-input");

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          const formData = new FormData();
          formData.append("file", file);

          dropzone.innerHTML = `<p>⏳ Parsing ${escapeHtml(file.name)}...</p>`;
          try {
            const resp = await fetch("/api/resume/parse", { method: "POST", body: formData });
            const data = await resp.json();
            if (data.status === "success") {
              candidateProfile = data.profile;
              await updateResumeFeedback();
              renderProfileSummary();
              renderJobsFeed();
              alert("Resume parsed successfully!");
            }
          } catch (err) {
            alert("Error parsing resume: " + err.message);
          } finally {
            dropzone.innerHTML = `
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
              <p style="font-weight: 600; margin-bottom: 0.2rem;">Click or drag PDF / DOCX resume here</p>
              <p style="font-size: 0.8rem; color: var(--text-muted);">Max file size: 10MB.</p>
            `;
          }
        }
      });
    }

    if (btnAnalyzeText) {
      btnAnalyzeText.addEventListener("click", async () => {
        const text = textInput.value.trim();
        if (!text) return alert("Please enter resume text.");

        try {
          const resp = await fetch("/api/resume/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
          });
          const data = await resp.json();
          if (data.status === "success") {
            candidateProfile = data.profile;
            await updateResumeFeedback();
            renderProfileSummary();
            renderJobsFeed();
            alert("Resume text analyzed!");
          }
        } catch (err) {
          alert("Error: " + err.message);
        }
      });
    }
  }

  function renderProfileSummary() {
    const view = document.getElementById("profile-details-view");
    if (!view) return;

    view.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.6rem;">
        <div><strong>Degree / Branch:</strong> ${escapeHtml(candidateProfile.degree)} (${escapeHtml(candidateProfile.branch)})</div>
        <div><strong>Graduation Year:</strong> ${escapeHtml(candidateProfile.graduationYear)}</div>
        <div><strong>Experience Level:</strong> ${escapeHtml(candidateProfile.experience)}</div>
        <div><strong>Technical Skills (${candidateProfile.skills.length}):</strong></div>
        <div class="skills-list">
          ${candidateProfile.skills.map(s => `<span class="skill-chip">✓ ${escapeHtml(s)}</span>`).join("")}
        </div>
        <div style="margin-top: 0.4rem;"><strong>Key Projects:</strong> ${candidateProfile.projects.join("; ")}</div>
      </div>
    `;
  }

  async function updateResumeFeedback() {
    try {
      const resp = await fetch("/api/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: candidateProfile })
      });
      const data = await resp.json();

      const strList = document.getElementById("resume-strengths-list");
      const impList = document.getElementById("resume-improvements-list");

      if (strList) strList.innerHTML = (data.strengths || []).map(s => `<li>✓ ${escapeHtml(s)}</li>`).join("");
      if (impList) impList.innerHTML = (data.suggestedImprovements || []).map(i => `<li>💡 ${escapeHtml(i)}</li>`).join("");
    } catch (e) {
      console.error(e);
    }
  }

  // -------------------------------------------------------------------
  // JD MATCHER
  // -------------------------------------------------------------------
  function initJdMatcher() {
    const btn = document.getElementById("btn-analyze-jd");
    const input = document.getElementById("jd-input-text");
    const resultBody = document.getElementById("jd-result-body");

    if (btn && input && resultBody) {
      btn.addEventListener("click", async () => {
        const text = input.value.trim();
        if (!text) return alert("Please paste a Job Description first.");

        btn.disabled = true;
        btn.textContent = "Analyzing JD...";

        try {
          const resp = await fetch("/api/jd/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jdText: text, profile: candidateProfile })
          });
          const res = await resp.json();

          if (res.status === "success") {
            resultBody.innerHTML = `
              <div style="margin-bottom: 1rem;">
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-emerald);">${res.matchScore}% AI MATCH SCORE</div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHtml(res.explanation.whyMatch)}</p>
              </div>

              <div style="margin-bottom: 1rem;">
                <h4>Matching Required Skills</h4>
                <div class="skills-list" style="margin-top: 0.3rem;">
                  ${(res.matchingSkills || []).map(s => `<span class="skill-chip">✓ ${escapeHtml(s)}</span>`).join("")}
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <h4 style="color: var(--accent-rose);">Missing Required Skills</h4>
                <div class="skills-list" style="margin-top: 0.3rem;">
                  ${(res.missingSkills || []).map(s => `<span class="skill-chip missing">△ ${escapeHtml(s)}</span>`).join("")}
                </div>
              </div>

              <div>
                <h4>Suggested Interview Preparation Topics</h4>
                <ul style="font-size: 0.85rem; color: var(--text-secondary); padding-left: 1.2rem; margin-top: 0.3rem;">
                  ${(res.interviewPrepTopics || []).map(t => `<li>${escapeHtml(t)}</li>`).join("")}
                </ul>
              </div>
            `;
          }
        } catch (e) {
          alert("Error: " + e.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "Calculate Deterministic Match & Analyze";
        }
      });
    }
  }

  // -------------------------------------------------------------------
  // SKILL GAP
  // -------------------------------------------------------------------
  async function loadSkillGap() {
    try {
      const resp = await fetch(`/api/skills/gap?skills=${encodeURIComponent(candidateProfile.skills.join(","))}`);
      const res = await resp.json();

      document.getElementById("lbl-skillgap-sample").textContent = res.sampleSize || 0;

      const barsContainer = document.getElementById("skill-frequency-bars");
      const freqs = res.skillFrequencies || [];

      barsContainer.innerHTML = freqs.map(f => `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem;">
            <span>${escapeHtml(f.skill)} ${f.isMissing ? '<span style="color: var(--accent-rose); font-size: 0.75rem;">(Missing from your profile)</span>' : '✓'}</span>
            <span>Appears in ${f.percentage}% of matching jobs (${f.count} jobs)</span>
          </div>
          <div style="height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${f.percentage}%; background: ${f.isMissing ? 'var(--accent-rose)' : 'var(--accent-indigo)'};"></div>
          </div>
        </div>
      `).join("");

      const cardsContainer = document.getElementById("learning-cards-container");
      const recs = res.missingRecommendations || [];

      cardsContainer.innerHTML = recs.map(r => `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <h3 style="color: var(--accent-cyan);">${escapeHtml(r.skill)}</h3>
            <span class="match-pill medium">${r.percentage}% Job Frequency</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Appears in ${r.percentage}% of current tech postings (sample size: ${r.sampleSize} jobs).</p>
          <h4 style="font-size: 0.85rem; margin-bottom: 0.3rem;">Suggested Learning Roadmap:</h4>
          <ul style="font-size: 0.8rem; color: var(--text-muted); padding-left: 1.2rem;">
            ${(r.learningTopics || []).map(t => `<li>${escapeHtml(t)}</li>`).join("")}
          </ul>
        </div>
      `).join("");
    } catch (e) {
      console.error(e);
    }
  }

  // -------------------------------------------------------------------
  // CAREER INSIGHTS
  // -------------------------------------------------------------------
  async function loadInsights() {
    try {
      const resp = await fetch("/api/insights");
      const res = await resp.json();

      if (res.status === "success") {
        document.getElementById("insight-top-skills").innerHTML = (res.topSkills || []).map(s => `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border-color);">
            <span>${escapeHtml(s.name)}</span>
            <strong style="color: var(--accent-cyan);">${s.count} jobs (${s.percentage}%)</strong>
          </div>
        `).join("");

        document.getElementById("insight-top-roles").innerHTML = (res.topRoles || []).map(r => `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border-color);">
            <span>${escapeHtml(r.name)}</span>
            <strong>${r.count} postings</strong>
          </div>
        `).join("");

        document.getElementById("insight-top-locations").innerHTML = (res.topLocations || []).map(l => `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border-color);">
            <span>${escapeHtml(l.name)}</span>
            <strong>${l.count} jobs</strong>
          </div>
        `).join("");

        document.getElementById("insight-top-companies").innerHTML = (res.topCompanies || []).map(c => `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border-color);">
            <span>${escapeHtml(c.name)}</span>
            <strong>${c.count} listings</strong>
          </div>
        `).join("");
      }
    } catch (e) {
      console.error(e);
    }
  }

  // -------------------------------------------------------------------
  // SAVED JOBS
  // -------------------------------------------------------------------
  function renderSavedJobs() {
    const container = document.getElementById("saved-jobs-grid");
    const savedJobs = allJobs.filter(j => savedJobIds.includes(j.id));

    if (savedJobs.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No saved jobs yet. Click '☆ Save' on any job card to bookmark it.</p></div>`;
    } else {
      container.innerHTML = savedJobs.map(j => renderJobCard(j)).join("");
      attachCardListeners();
    }
  }

  // -------------------------------------------------------------------
  // SOURCE HEALTH
  // -------------------------------------------------------------------
  async function loadSourceHealth() {
    try {
      const resp = await fetch("/api/crawler/status");
      const data = await resp.json();
      const sources = data.sources || [];
      const tbody = document.getElementById("health-table-body");

      if (tbody) {
        tbody.innerHTML = sources.map(s => `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 0.75rem;"><strong>${escapeHtml(s.source)}</strong></td>
            <td style="padding: 0.75rem;">
              <span style="color: ${s.enabled && !s.error ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">
                ${s.enabled && !s.error ? '● Active' : '● Degraded / Unconfigured'}
              </span>
            </td>
            <td style="padding: 0.75rem;">${s.fetched}</td>
            <td style="padding: 0.75rem;">${s.valid}</td>
            <td style="padding: 0.75rem;">${s.duplicates}</td>
            <td style="padding: 0.75rem;">${s.lastFetch || 'N/A'}</td>
            <td style="padding: 0.75rem; color: var(--text-muted);">${escapeHtml(s.error || 'None')}</td>
          </tr>
        `).join("");
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Helper
  function escapeHtml(str) {
    if (!str) return "";
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
