// Job Radar Platform Frontend Engine
document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let allJobs = [];
  let groupedJobs = { today: [], thisWeek: [], thisMonth: [], unspecified: [] };
  let candidateProfile = JSON.parse(localStorage.getItem("jobradar_profile") || "null");

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
          if (resp.ok) {
            const ct = resp.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const res = await resp.json();
              if (res.message) alert(res.message);
            }
          }
          await loadJobs();
        } catch (err) {
          console.error(err);
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

      // Match Score calculation (only when resume is uploaded)
      const hasResume = candidateProfile && Array.isArray(candidateProfile.skills) && candidateProfile.skills.length > 0;
      const matchScore = hasResume ? calculateMatch(job) : 0;
      job._matchScore = matchScore;
      if (hasResume && minScore > 0 && matchScore < minScore) return false;

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
    const reqSkills = job.requiredSkills || [];
    const hasResume = candidateProfile && Array.isArray(candidateProfile.skills) && candidateProfile.skills.length > 0;

    let skillsHtml = "";
    let matchBadgeHtml = "";

    if (hasResume) {
      const candSkills = (candidateProfile.skills || []).map(s => s.toLowerCase());
      const matchingChips = reqSkills.filter(s => candSkills.includes(s.toLowerCase()));
      const missingChips = reqSkills.filter(s => !candSkills.includes(s.toLowerCase()));
      const score = calculateMatch(job);

      matchBadgeHtml = `
        <span class="match-pill ${score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low'}">
          ${score}% Match
        </span>
      `;

      skillsHtml = `
        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.4rem;">
          ✅ ${matchingChips.length}/${reqSkills.length} skills matched
          ${missingChips.length > 0 ? ` · Missing: <span style="color: var(--accent-amber);">${missingChips.slice(0,3).map(s => escapeHtml(s)).join(", ")}</span>` : ' · <span style="color: var(--accent-emerald);">All required skills matched!</span>'}
        </div>
        <div class="skills-list">
          ${matchingChips.map(s => `<span class="skill-chip">✓ ${escapeHtml(s)}</span>`).join("")}
          ${missingChips.map(s => `<span class="skill-chip missing">△ ${escapeHtml(s)}</span>`).join("")}
        </div>
      `;
    } else {
      skillsHtml = `
        <div class="skills-list">
          ${reqSkills.map(s => `<span class="skill-chip">${escapeHtml(s)}</span>`).join("")}
        </div>
      `;
    }

    return `
      <div class="card job-card" data-id="${job.id}">
        <div>
          <div class="job-card-header">
            <div>
              <h3 class="job-title">${escapeHtml(job.title)}</h3>
              <div class="job-company">${escapeHtml(job.company)}</div>
            </div>
            ${matchBadgeHtml}
          </div>

          <div class="job-meta-list" style="margin-top: 0.6rem; margin-bottom: 0.75rem;">
            <span class="job-meta-item">📍 ${escapeHtml(job.location)}</span>
            <span class="job-meta-item">💼 ${escapeHtml(job.workMode)}</span>
            <span class="job-meta-item">⏱️ ${escapeHtml(job.experienceRequirement)}</span>
            <span class="job-meta-item">📅 Posted: ${escapeHtml(job.postedAt)}</span>
          </div>

          ${skillsHtml}
        </div>

        <div class="job-card-footer">
          <span class="source-badge">via ${escapeHtml(job.source)}</span>
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
    if (!candidateProfile || !Array.isArray(candidateProfile.skills) || candidateProfile.skills.length === 0) {
      return 0;
    }
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

    const hasResume = candidateProfile && Array.isArray(candidateProfile.skills) && candidateProfile.skills.length > 0;

    if (!hasResume) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
          <h2 style="font-size: 1.4rem; margin-bottom: 0.5rem; color: var(--text-primary);">Personalized Recommendations Locked</h2>
          <p style="color: var(--text-secondary); max-width: 520px; margin: 0 auto 1.5rem auto; font-size: 0.9rem; line-height: 1.5;">
            Upload your resume in the Resume Analyzer tab to unlock AI-calculated match scores, ranked job recommendations, and personalized skill gap analysis based on your actual profile.
          </p>
          <button class="btn btn-primary btn-sm" id="btn-goto-resume-tab">
            <span>📄</span> Upload Resume to Unlock
          </button>
        </div>
      `;
      const btnGo = document.getElementById("btn-goto-resume-tab");
      if (btnGo) {
        btnGo.addEventListener("click", () => {
          const tab = document.querySelector('.nav-link[data-tab="resume-tab"]');
          if (tab) tab.click();
        });
      }
      return;
    }

    if (allJobs.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;">📭</div>
          <p style="font-size: 1rem; font-weight: 600;">No verified jobs loaded yet.</p>
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
    }).sort((a, b) => b._matchScore - a._matchScore).slice(0, 18);

    container.innerHTML = scored.map(job => renderJobCard(job)).join("");
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
    const btnOpenResume = document.getElementById("btn-open-resume-upload");

    // Top Navbar "Upload Resume" button
    if (btnOpenResume) {
      btnOpenResume.addEventListener("click", () => {
        navLinks.forEach(n => {
          if (n.getAttribute("data-tab") === "resume-tab") {
            n.classList.add("active");
          } else {
            n.classList.remove("active");
          }
        });
        tabPages.forEach(p => {
          p.style.display = p.id === "resume-tab" ? "block" : "none";
        });
        window.scrollTo({ top: 0, behavior: "smooth" });

        const fi = document.getElementById("resume-file-input") || fileInput;
        if (fi) {
          fi.value = "";
          fi.click();
        }
      });
    }

    async function handleResumeFile(file) {
      if (!file) return;
      if (dropzone) dropzone.innerHTML = `<p style="color:var(--accent-cyan);font-weight:600;">⏳ Parsing ${escapeHtml(file.name)}...</p>`;

      let parsedOk = false;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const resp = await fetch("/api/resume/parse", { method: "POST", body: formData });
        if (resp.ok) {
          const ct = resp.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await resp.json();
            if (data.status === "success") {
              candidateProfile = data.profile;
              await updateResumeFeedback();
              renderProfileSummary();
              renderJobsFeed();
              alert("✅ Resume parsed successfully from " + file.name + "!");
              parsedOk = true;
            }
          }
        }
      } catch (_) {}

      if (!parsedOk) {
        // Fallback: client-side parsing
        try {
          const fname = (file.name || "").toLowerCase();
          const arrayBuffer = await file.arrayBuffer();

          if (fname.endsWith(".pdf") && window.pdfjsLib) {
            try {
              const typedarray = new Uint8Array(arrayBuffer);
              const loadingTask = window.pdfjsLib.getDocument({ data: typedarray });
              const pdf = await loadingTask.promise;
              let fullText = "";
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = (content.items || []).map(item => item.str).join(" ");
                fullText += pageText + "\n";
              }
              if (fullText.trim().length > 10) {
                applyResumeTextClientSide(fullText, file.name);
                parsedOk = true;
              }
            } catch (pdfErr) {
              console.error("PDF.js direct parse failed:", pdfErr);
            }
          }

          if (!parsedOk && (fname.endsWith(".docx") || fname.endsWith(".doc")) && window.mammoth) {
            try {
              const res = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
              if (res && res.value && res.value.trim().length > 10) {
                applyResumeTextClientSide(res.value, file.name);
                parsedOk = true;
              }
            } catch (docErr) {
              console.error("Mammoth DOCX parse failed:", docErr);
            }
          }

          if (!parsedOk) {
            const text = await file.text();
            if (text && text.trim().length > 30 && !text.startsWith("%PDF")) {
              applyResumeTextClientSide(text, file.name);
              parsedOk = true;
            }
          }
        } catch (e) {
          console.error("Client-side parse error:", e);
        }
      }

      if (!parsedOk) {
        alert("Could not extract readable text from this file.\n\nPlease:\n1. Open your resume\n2. Copy the text\n3. Paste into the 'Paste Resume Plain Text' box below\n4. Click 'Analyze Resume Text'");
      }

      if (dropzone) {
        dropzone.innerHTML = `
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
          <p style="font-weight: 600; margin-bottom: 0.2rem;">Click or drag PDF / DOCX resume here</p>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Max file size: 10MB. Files parsed securely.</p>
          <input type="file" id="resume-file-input" accept=".pdf,.docx,.doc,.txt" style="display: none;">
        `;
        const newFileInput = document.getElementById("resume-file-input");
        if (newFileInput) {
          newFileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) handleResumeFile(e.target.files[0]);
          });
        }
      }
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => {
        const fi = document.getElementById("resume-file-input") || fileInput;
        if (fi) {
          fi.value = "";
          fi.click();
        }
      });

      fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleResumeFile(e.target.files[0]);
      });

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--accent-cyan)";
        dropzone.style.background = "rgba(6, 182, 212, 0.08)";
      });

      dropzone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--border-accent)";
        dropzone.style.background = "rgba(99, 102, 241, 0.04)";
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--border-accent)";
        dropzone.style.background = "rgba(99, 102, 241, 0.04)";
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleResumeFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnAnalyzeText) {
      btnAnalyzeText.addEventListener("click", async () => {
        const text = textInput.value.trim();
        if (!text) return alert("Please enter resume text.");

        let parsedOk = false;
        try {
          const resp = await fetch("/api/resume/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
          });
          if (resp.ok) {
            const ct = resp.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const data = await resp.json();
              if (data.status === "success") {
                candidateProfile = data.profile;
                localStorage.setItem("jobradar_profile", JSON.stringify(candidateProfile));
                await updateResumeFeedback();
                renderProfileSummary();
                renderJobsFeed();
                alert("Resume text analyzed!");
                parsedOk = true;
              }
            }
          }
        } catch (_) {}

        if (!parsedOk) {
          // Always fall back to client-side parsing
          applyResumeTextClientSide(text, "pasted text");
        }
      });
    }
  }

  function applyResumeTextClientSide(text, sourceName) {
    if (!text || typeof text !== "string") return;

    const ALL_SKILLS = [
      "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin",
      "HTML", "HTML5", "CSS", "CSS3", "React", "React.js", "Angular", "Vue.js", "Next.js", "Node.js", "Express", "Django", "Flask", "FastAPI",
      "Spring Boot", "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Oracle", "SQLite",
      "Git", "GitHub", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "REST API", "GraphQL",
      "Data Structures", "Algorithms", "OOP", "System Design", "CI/CD", "Tailwind CSS", "Bootstrap",
      "Pandas", "NumPy", "PyTorch", "TensorFlow", "Scikit-Learn", "Machine Learning", "AI", "Data Analysis", "Deep Learning", "NLP",
      "Selenium", "Playwright", "Jest", "JUnit", "QA Testing", "Postman", "Android",
      "Figma", "Power BI", "Tableau", "Excel", "ETL", "Microservices", "Firebase", "Redux", "Kafka"
    ];

    const detectedSkills = [];
    ALL_SKILLS.forEach(skill => {
      const pattern = new RegExp("(?:^|[^a-zA-Z0-9])" + skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:$|[^a-zA-Z0-9])", "i");
      if (pattern.test(text)) {
        if (!detectedSkills.includes(skill)) {
          detectedSkills.push(skill);
        }
      }
    });

    if (detectedSkills.length === 0) {
      detectedSkills.push("Problem Solving", "Computer Science Fundamentals");
    }

    // Candidate Name Detection
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let name = "Candidate";
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const l = lines[i];
      if (l.length >= 3 && l.length <= 40 && !l.includes("@") && !l.includes("http") && !l.includes("Resume") && !l.includes("CV") && !l.includes("Curriculum") && !/\d/.test(l)) {
        name = l;
        break;
      }
    }

    // Degree & Branch Detection
    let degree = "B.Tech";
    let branch = "Computer Science & Engineering";
    const textLower = text.toLowerCase();
    if (textLower.includes("b.tech") || textLower.includes("bachelor of technology") || textLower.includes("b.e.") || textLower.includes("bachelor of engineering")) {
      degree = "B.Tech";
    } else if (textLower.includes("m.tech") || textLower.includes("master of technology")) {
      degree = "M.Tech";
    } else if (textLower.includes("mca") || textLower.includes("master of computer applications")) {
      degree = "MCA";
    } else if (textLower.includes("bca") || textLower.includes("bachelor of computer applications")) {
      degree = "BCA";
    } else if (textLower.includes("b.sc") || textLower.includes("bachelor of science")) {
      degree = "B.Sc";
    }

    if (textLower.includes("information technology") || textLower.includes(" it ")) {
      branch = "Information Technology";
    } else if (textLower.includes("data science") || textLower.includes("artificial intelligence") || textLower.includes("ai/ml")) {
      branch = "Data Science / AI";
    } else if (textLower.includes("electronics") || textLower.includes("ece") || textLower.includes("electrical")) {
      branch = "Electronics & Communication";
    }

    // Graduation Year Detection
    let gradYear = "2026";
    const yearMatches = text.match(/\b(202[0-9])\b/g);
    if (yearMatches && yearMatches.length > 0) {
      gradYear = yearMatches[yearMatches.length - 1];
    }

    // Experience Level
    let expLevel = "Fresher";
    if (textLower.includes("years of experience") || textLower.includes("yrs exp") || textLower.includes("senior software") || textLower.includes("lead developer")) {
      const expMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
      if (expMatch && parseInt(expMatch[1]) >= 2) {
        expLevel = `${expMatch[1]}+ Years Experience`;
      }
    }

    // Preferred / Target Roles Detection
    const preferredRoles = [];
    if (detectedSkills.some(s => ["React", "Vue.js", "Angular", "HTML", "CSS", "Next.js"].includes(s))) {
      preferredRoles.push("Frontend Developer");
    }
    if (detectedSkills.some(s => ["Node.js", "Express", "Django", "Flask", "Spring Boot", "FastAPI", "Python", "Java"].includes(s))) {
      preferredRoles.push("Backend Developer");
    }
    if (preferredRoles.includes("Frontend Developer") && preferredRoles.includes("Backend Developer")) {
      preferredRoles.unshift("Full Stack Developer");
    }
    if (detectedSkills.some(s => ["Machine Learning", "PyTorch", "TensorFlow", "Pandas", "Scikit-Learn"].includes(s))) {
      preferredRoles.push("AI / ML Engineer");
    }
    if (detectedSkills.some(s => ["Docker", "Kubernetes", "AWS", "CI/CD", "Linux"].includes(s))) {
      preferredRoles.push("DevOps Engineer");
    }
    if (preferredRoles.length === 0) {
      preferredRoles.push("Software Engineer");
    }

    candidateProfile = {
      name: name,
      degree: degree,
      branch: branch,
      graduationYear: gradYear,
      experience: expLevel,
      skills: detectedSkills,
      preferredRoles: [...new Set(preferredRoles)],
      preferredLocations: ["Pan-India", "Bengaluru", "Hyderabad", "Remote"]
    };

    localStorage.setItem("jobradar_profile", JSON.stringify(candidateProfile));
    renderProfileSummary();
    updateResumeFeedback();
    renderJobsFeed();
    renderRecommendedJobs();
    loadSkillGap();

    alert(`✅ Resume parsed successfully (${sourceName || "upload"})!\n\nIdentified ${candidateProfile.skills.length} technical skills for ${candidateProfile.name}. Personalized matching and recommendations are now active.`);
  }

  function renderProfileSummary() {
    const view = document.getElementById("profile-details-view");
    const statusLbl = document.getElementById("lbl-profile-status");
    if (!view) return;

    const hasResume = candidateProfile && Array.isArray(candidateProfile.skills) && candidateProfile.skills.length > 0;

    if (!hasResume) {
      if (statusLbl) {
        statusLbl.textContent = "Not Uploaded";
        statusLbl.style.color = "var(--text-muted)";
      }
      view.innerHTML = `
        <div style="font-size: 0.9rem; color: var(--text-secondary); padding: 1.5rem 0.5rem; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📋</div>
          <p style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.4rem;">No Resume Uploaded Yet</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 320px; margin: 0 auto 1rem auto;">
            Upload your PDF/DOCX or paste text on the left to extract your skills, graduation year, and unlock personalized matching across Jobs, Recommendations, and Skill Gap analysis.
          </p>
        </div>
      `;
      return;
    }

    if (statusLbl) {
      statusLbl.textContent = "Active Profile";
      statusLbl.style.color = "var(--accent-emerald)";
    }

    view.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.6rem;">
        <div><strong>Candidate:</strong> ${escapeHtml(candidateProfile.name || "Candidate")}</div>
        <div><strong>Degree / Branch:</strong> ${escapeHtml(candidateProfile.degree || "B.Tech CSE")} (${escapeHtml(candidateProfile.branch || "Computer Science")})</div>
        <div><strong>Graduation Year:</strong> ${escapeHtml(candidateProfile.graduationYear || "2026")}</div>
        <div><strong>Experience Level:</strong> ${escapeHtml(candidateProfile.experience || "Fresher")}</div>
        <div><strong>Extracted Technical Skills (${candidateProfile.skills.length}):</strong></div>
        <div class="skills-list">
          ${candidateProfile.skills.map(s => `<span class="skill-chip">✓ ${escapeHtml(s)}</span>`).join("")}
        </div>
        ${candidateProfile.projects && candidateProfile.projects.length > 0 ? `<div style="margin-top: 0.4rem;"><strong>Key Projects:</strong> ${escapeHtml(candidateProfile.projects.join("; "))}</div>` : ''}
        ${candidateProfile.preferredRoles && candidateProfile.preferredRoles.length > 0 ? `<div><strong>Detected Target Roles:</strong> ${escapeHtml(candidateProfile.preferredRoles.join(", "))}</div>` : ''}
        <button class="btn btn-secondary btn-sm" id="btn-reset-profile" style="margin-top: 0.75rem; align-self: flex-start;">
          🗑️ Clear / Reset Resume
        </button>
      </div>
    `;

    const btnReset = document.getElementById("btn-reset-profile");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (confirm("Clear your uploaded resume and revert to general job browsing?")) {
          candidateProfile = null;
          localStorage.removeItem("jobradar_profile");
          renderProfileSummary();
          updateResumeFeedback();
          renderJobsFeed();
          renderRecommendedJobs();
          loadSkillGap();
          alert("Resume cleared. Showing general job listings.");
        }
      });
    }
  }

  async function updateResumeFeedback() {
    const hasResume = candidateProfile && Array.isArray(candidateProfile.skills) && candidateProfile.skills.length > 0;
    const strList = document.getElementById("resume-strengths-list");
    const impList = document.getElementById("resume-improvements-list");

    if (!hasResume) {
      if (strList) strList.innerHTML = `<li>Upload a resume to generate grounded strengths.</li>`;
      if (impList) impList.innerHTML = `<li>Upload a resume to generate actionable improvement suggestions.</li>`;
      return;
    }

    let parsedOk = false;
    try {
      const resp = await fetch("/api/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: candidateProfile })
      });
      if (resp.ok) {
        const ct = resp.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await resp.json();
          if (data.status === "success" || data.strengths) {
            if (strList) strList.innerHTML = (data.strengths || []).map(s => `<li>✓ ${escapeHtml(s)}</li>`).join("");
            if (impList) impList.innerHTML = (data.suggestedImprovements || []).map(i => `<li>💡 ${escapeHtml(i)}</li>`).join("");
            parsedOk = true;
          }
        }
      }
    } catch (_) {}

    if (!parsedOk) {
      // Dynamic client-side fallback feedback
      const skills = candidateProfile.skills || [];
      const strengths = [];
      const improvements = [];

      if (skills.length >= 4) {
        strengths.push(`Strong core technical stack with ${skills.length} identified competencies (${skills.slice(0, 4).join(", ")}).`);
      }
      if (candidateProfile.experience === "Fresher") {
        strengths.push("Well-suited for entry-level / fresher tech recruitment drives and internships in India.");
      }
      if (skills.some(s => ["Python", "Java", "C++"].includes(s))) {
        strengths.push("Has strong backend/systems language foundation.");
      }
      if (skills.some(s => ["React", "JavaScript", "HTML", "CSS"].includes(s))) {
        strengths.push("Demonstrates frontend web development readiness.");
      }
      if (strengths.length === 0) {
        strengths.push("Resume parsed with candidate credentials and basic technical keywords.");
      }

      if (!skills.some(s => ["Docker", "Kubernetes", "AWS", "CI/CD"].includes(s))) {
        improvements.push("Add Cloud/DevOps basics (e.g. Docker, AWS, GitHub Actions) to significantly boost shortlisting.");
      }
      if (!skills.some(s => ["PostgreSQL", "MongoDB", "SQL"].includes(s))) {
        improvements.push("Highlight database proficiency (SQL, PostgreSQL, MongoDB) with project context.");
      }
      improvements.push("Quantify project impacts (e.g. 'Improved latency by 20%', 'Built for 500+ users') for higher recruiter conversion.");

      if (strList) strList.innerHTML = strengths.map(s => `<li>✓ ${escapeHtml(s)}</li>`).join("");
      if (impList) impList.innerHTML = improvements.map(i => `<li>💡 ${escapeHtml(i)}</li>`).join("");
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
          const hasResume = candidateProfile && Array.isArray(candidateProfile.skills) && candidateProfile.skills.length > 0;

          const ALL_SKILLS = [
            "Python","Java","JavaScript","TypeScript","C","C++","C#","Go","Rust","PHP","Ruby","Swift","Kotlin",
            "HTML","CSS","React","Angular","Vue.js","Next.js","Node.js","Express","Django","Flask","FastAPI",
            "Spring Boot","SQL","MySQL","PostgreSQL","MongoDB","Redis","Oracle","SQLite",
            "Git","GitHub","Docker","Kubernetes","AWS","Azure","GCP","Linux","REST API","GraphQL",
            "Data Structures","Algorithms","OOP","System Design","CI/CD","Tailwind CSS","Bootstrap",
            "Pandas","NumPy","PyTorch","TensorFlow","Scikit-Learn","Machine Learning","AI","Data Analysis",
            "Selenium","Playwright","Jest","JUnit","QA Testing","Postman","Android","Kotlin",
            "Figma","Power BI","Tableau","Excel","ETL","Microservices","Firebase","Redux"
          ];
          
          const jdSkills = ALL_SKILLS.filter(skill => {
            const pattern = new RegExp("(?:^|[^a-zA-Z0-9])" + skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:$|[^a-zA-Z0-9])", "i");
            return pattern.test(text);
          });

          if (!hasResume) {
            resultBody.innerHTML = `
              <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 8px;">
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.3rem;">📋 Job Description Skills Detected</div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
                  We identified <strong>${jdSkills.length} key required skills</strong> in this JD. Upload your resume in the <strong>Resume Analyzer</strong> tab to calculate your personalized AI match score, exact matching skills, and missing gap analysis.
                </p>
                <div class="skills-list">
                  ${jdSkills.length > 0 ? jdSkills.map(s => `<span class="skill-chip">${escapeHtml(s)}</span>`).join("") : '<span style="color:var(--text-muted);font-size:0.85rem;">No standard skills extracted.</span>'}
                </div>
              </div>

              <div>
                <h4>Interview Preparation Focus for this JD:</h4>
                <ul style="font-size: 0.85rem; color: var(--text-secondary); padding-left: 1.2rem; margin-top: 0.3rem;">
                  ${jdSkills.slice(0, 5).map(s => `<li>Brush up on core concepts and practical projects in <strong>${escapeHtml(s)}</strong>.</li>`).join("")}
                </ul>
              </div>
            `;
            return;
          }

          let parsedOk = false;
          let res = null;

          try {
            const resp = await fetch("/api/jd/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jdText: text, profile: candidateProfile })
            });
            if (resp.ok) {
              const ct = resp.headers.get("content-type") || "";
              if (ct.includes("application/json")) {
                res = await resp.json();
                if (res.status === "success") parsedOk = true;
              }
            }
          } catch (_) {}

          if (!parsedOk) {
            const candSkillsLower = (candidateProfile.skills || []).map(s => s.toLowerCase());
            const matchingSkills = jdSkills.filter(s => candSkillsLower.includes(s.toLowerCase()));
            const missingSkills = jdSkills.filter(s => !candSkillsLower.includes(s.toLowerCase()));
            
            let matchScore = 30;
            if (jdSkills.length > 0) {
              matchScore = Math.round((matchingSkills.length / jdSkills.length) * 100);
            } else {
              matchScore = 70;
            }
            
            res = {
              status: "success",
              matchScore: matchScore,
              explanation: { whyMatch: `Based on your uploaded resume, you have ${matchingSkills.length} out of ${jdSkills.length} detected skills for this role.` },
              matchingSkills: matchingSkills,
              missingSkills: missingSkills,
              interviewPrepTopics: missingSkills.map(s => `Brush up on ${s}`)
            };
            parsedOk = true;
          }

          if (parsedOk && res.status === "success") {
            resultBody.innerHTML = `
              <div style="margin-bottom: 1rem;">
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-emerald);">${res.matchScore}% AI MATCH SCORE</div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHtml(res.explanation.whyMatch)}</p>
              </div>

              <div style="margin-bottom: 1rem;">
                <h4>Matching Required Skills (${(res.matchingSkills || []).length})</h4>
                <div class="skills-list" style="margin-top: 0.3rem;">
                  ${(res.matchingSkills || []).map(s => `<span class="skill-chip">✓ ${escapeHtml(s)}</span>`).join("")}
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <h4 style="color: var(--accent-rose);">Missing Required Skills (${(res.missingSkills || []).length})</h4>
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
          console.error("Error:", e.message);
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
      const hasResume = candidateProfile && Array.isArray(candidateProfile.skills) && candidateProfile.skills.length > 0;
      let parsedOk = false;
      let res = null;

      if (hasResume) {
        try {
          const resp = await fetch(`/api/skills/gap?skills=${encodeURIComponent(candidateProfile.skills.join(","))}`);
          if (resp.ok) {
            const ct = resp.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              res = await resp.json();
              parsedOk = true;
            }
          }
        } catch (_) {}
      }

      if (!parsedOk) {
        // Dynamic calculation from loaded live jobs
        const candSkillsLower = hasResume ? (candidateProfile.skills || []).map(s => s.toLowerCase()) : [];
        const skillCounts = {};
        let sampleSize = 0;
        
        allJobs.forEach(job => {
          sampleSize++;
          const reqSkills = job.requiredSkills || [];
          reqSkills.forEach(s => {
             const key = s;
             const isMiss = hasResume ? !candSkillsLower.includes(key.toLowerCase()) : false;
             if (!skillCounts[key]) skillCounts[key] = { count: 0, missing: isMiss };
             skillCounts[key].count++;
          });
        });
        
        const sorted = Object.entries(skillCounts).map(([k, v]) => ({
            skill: k,
            count: v.count,
            percentage: Math.round((v.count / Math.max(1, sampleSize)) * 100),
            isMissing: v.missing
        })).sort((a,b) => b.count - a.count).slice(0, 15);
        
        const missingRecs = hasResume
          ? sorted.filter(s => s.isMissing).slice(0, 3).map(s => ({
              skill: s.skill,
              percentage: s.percentage,
              sampleSize: sampleSize,
              learningTopics: [`Core fundamentals of ${s.skill}`, `Build a portfolio project using ${s.skill}`, `Common interview questions on ${s.skill}`]
            }))
          : sorted.slice(0, 3).map(s => ({
              skill: s.skill,
              percentage: s.percentage,
              sampleSize: sampleSize,
              learningTopics: [`Master ${s.skill} for industry demand`, `Build projects using ${s.skill}`, `Interview questions on ${s.skill}`]
            }));

        res = {
           sampleSize: sampleSize,
           skillFrequencies: sorted,
           missingRecommendations: missingRecs
        };
        parsedOk = true;
      }

      if (parsedOk) {
        const lblSample = document.getElementById("lbl-skillgap-sample");
        if (lblSample) lblSample.textContent = (res.sampleSize || allJobs.length) + " Jobs Analyzed";

        const barsContainer = document.getElementById("skill-frequency-bars");
        const freqs = res.skillFrequencies || [];

        if (barsContainer) {
          barsContainer.innerHTML = freqs.map(f => {
            let badge = "";
            let barBg = "var(--accent-indigo)";
            if (hasResume) {
              if (f.isMissing) {
                badge = '<span style="color: var(--accent-rose); font-size: 0.75rem; font-weight: 600;">(Missing from your profile)</span>';
                barBg = "var(--accent-rose)";
              } else {
                badge = '<span style="color: var(--accent-emerald); font-size: 0.75rem; font-weight: 600;">✓ In your profile</span>';
                barBg = "var(--accent-emerald)";
              }
            }

            return `
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem;">
                  <span><strong>${escapeHtml(f.skill)}</strong> ${badge}</span>
                  <span style="color: var(--text-muted);">Appears in ${f.percentage}% of matching jobs (${f.count} jobs)</span>
                </div>
                <div style="height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${Math.min(100, Math.max(5, f.percentage))}%; background: ${barBg};"></div>
                </div>
              </div>
            `;
          }).join("");
        }

        const cardsContainer = document.getElementById("learning-cards-container");
        const recs = res.missingRecommendations || [];

        if (cardsContainer) {
          let topNotice = "";
          if (!hasResume) {
            topNotice = `
              <div style="grid-column: 1 / -1; padding: 0.8rem 1rem; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                💡 <strong>Pro Tip:</strong> Upload your resume in the <strong>Resume Analyzer</strong> tab to see personalized learning roadmaps for skills missing from your specific profile.
              </div>
            `;
          }

          cardsContainer.innerHTML = topNotice + recs.map(r => `
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <h3 style="color: var(--accent-cyan);">${escapeHtml(r.skill)}</h3>
                <span class="match-pill medium">${r.percentage}% Job Frequency</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Appears in ${r.percentage}% of active tech postings in our verified database.</p>
              <h4 style="font-size: 0.85rem; margin-bottom: 0.3rem;">Suggested Learning Roadmap:</h4>
              <ul style="font-size: 0.8rem; color: var(--text-muted); padding-left: 1.2rem;">
                ${(r.learningTopics || []).map(t => `<li>${escapeHtml(t)}</li>`).join("")}
              </ul>
            </div>
          `).join("");
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // -------------------------------------------------------------------
  // CAREER INSIGHTS
  // -------------------------------------------------------------------
  async function loadInsights() {
    try {
      let data = null;

      // Try server API first if available
      try {
        const resp = await fetch("/api/insights");
        if (resp.ok) {
          const ct = resp.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const json = await resp.json();
            if (json.status === "success" && json.topSkills && json.topSkills.length > 0) {
              data = json;
            }
          }
        }
      } catch (_) {}

      // If server API not available (e.g. static hosting / Vercel), calculate directly from allJobs
      if (!data) {
        const sampleSize = allJobs.length;
        if (sampleSize === 0) return;

        const skillMap = {};
        const roleMap = {};
        const locMap = {};
        const compMap = {};
        const expMap = {
          "Fresher / Entry-Level (0–2 YOE)": 0,
          "Internships & Trainees": 0,
          "Mid / Senior Roles (2+ YOE)": 0
        };
        const modeMap = {
          "Remote (Work from Home)": 0,
          "Hybrid (Flexible)": 0,
          "On-site / In-Office": 0
        };

        allJobs.forEach(job => {
          // Skills
          const skills = [...(job.requiredSkills || []), ...(job.preferredSkills || [])];
          const uniqueSkills = [...new Set(skills)];
          uniqueSkills.forEach(s => {
            if (s && s.trim()) {
              const name = s.trim();
              skillMap[name] = (skillMap[name] || 0) + 1;
            }
          });

          // Role Categorization
          const title = (job.title || "").toLowerCase();
          let normalizedRole = "Software Engineer";
          if (title.includes("frontend") || title.includes("react") || title.includes("angular") || title.includes("vue") || title.includes("ui developer")) {
            normalizedRole = "Frontend Developer";
          } else if (title.includes("backend") || title.includes("node") || title.includes("django") || title.includes("spring") || title.includes("fastapi")) {
            normalizedRole = "Backend Developer";
          } else if (title.includes("full stack") || title.includes("fullstack")) {
            normalizedRole = "Full Stack Engineer";
          } else if (title.includes("python")) {
            normalizedRole = "Python Developer";
          } else if (title.includes("data") || title.includes("analytics") || title.includes("analyst") || title.includes("bi ")) {
            normalizedRole = "Data Analyst / Engineer";
          } else if (title.includes("qa") || title.includes("test") || title.includes("quality") || title.includes("automation")) {
            normalizedRole = "QA / Automation Engineer";
          } else if (title.includes("devops") || title.includes("cloud") || title.includes("aws") || title.includes("infra")) {
            normalizedRole = "DevOps & Cloud Engineer";
          } else if (title.includes("intern")) {
            normalizedRole = "Software Intern / Trainee";
          } else if (title.includes("java")) {
            normalizedRole = "Java Developer";
          } else if (title.includes("ai") || title.includes("ml") || title.includes("machine learning")) {
            normalizedRole = "AI / ML Engineer";
          } else if (job.title) {
            normalizedRole = job.title;
          }
          roleMap[normalizedRole] = (roleMap[normalizedRole] || 0) + 1;

          // Locations
          const rawLoc = (job.location || "India").toUpperCase();
          let normalizedLoc = "Other Indian Cities";
          if (rawLoc.includes("BENGALURU") || rawLoc.includes("BANGALORE") || rawLoc.includes("KA,")) {
            normalizedLoc = "Bengaluru (KA)";
          } else if (rawLoc.includes("HYDERABAD") || rawLoc.includes("TS,") || rawLoc.includes("TELANGANA") || rawLoc.includes("AP,")) {
            normalizedLoc = "Hyderabad (TS)";
          } else if (rawLoc.includes("PUNE")) {
            normalizedLoc = "Pune (MH)";
          } else if (rawLoc.includes("MUMBAI") || rawLoc.includes("MH,")) {
            normalizedLoc = "Mumbai (MH)";
          } else if (rawLoc.includes("CHENNAI") || rawLoc.includes("TN,") || rawLoc.includes("TAMIL")) {
            normalizedLoc = "Chennai (TN)";
          } else if (rawLoc.includes("NOIDA") || rawLoc.includes("GURUGRAM") || rawLoc.includes("GURGAON") || rawLoc.includes("DELHI") || rawLoc.includes("NCR") || rawLoc.includes("UP,")) {
            normalizedLoc = "Delhi NCR / Noida";
          } else if (rawLoc.includes("REMOTE") || (job.workMode || "").toLowerCase().includes("remote")) {
            normalizedLoc = "Remote (Pan-India)";
          } else if (job.location) {
            normalizedLoc = job.location.replace(/,\s*IN$/i, "").replace(/,\s*India$/i, "");
          }
          locMap[normalizedLoc] = (locMap[normalizedLoc] || 0) + 1;

          // Companies
          let comp = job.company || "Verified Tech Employer";
          if (comp.includes("|")) comp = comp.split("|")[0].trim();
          compMap[comp] = (compMap[comp] || 0) + 1;

          // Experience
          const exp = (job.experienceRequirement || "").toLowerCase();
          const jType = (job.jobType || "").toLowerCase();
          if (jType.includes("intern") || exp.includes("intern")) {
            expMap["Internships & Trainees"]++;
          } else if (exp.includes("0-2") || exp.includes("0–2") || exp.includes("fresher") || exp.includes("0 year") || exp.includes("1 year") || exp.includes("entry")) {
            expMap["Fresher / Entry-Level (0–2 YOE)"]++;
          } else {
            expMap["Mid / Senior Roles (2+ YOE)"]++;
          }

          // Work Mode
          const mode = (job.workMode || "").toLowerCase();
          if (mode.includes("remote")) {
            modeMap["Remote (Work from Home)"]++;
          } else if (mode.includes("hybrid")) {
            modeMap["Hybrid (Flexible)"]++;
          } else {
            modeMap["On-site / In-Office"]++;
          }
        });

        const topSkills = Object.entries(skillMap)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / sampleSize) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const topRoles = Object.entries(roleMap)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / sampleSize) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        const topLocations = Object.entries(locMap)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / sampleSize) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        const topCompanies = Object.entries(compMap)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / sampleSize) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        const fresherTrends = Object.entries(expMap)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / sampleSize) * 100) }));

        const workModes = Object.entries(modeMap)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / sampleSize) * 100) }));

        data = {
          sampleSize,
          topSkills,
          topRoles,
          topLocations,
          topCompanies,
          fresherTrends,
          workModes
        };
      }

      // Render into DOM
      const lblSample = document.getElementById("lbl-insights-sample");
      if (lblSample) lblSample.textContent = (data.sampleSize || allJobs.length) + " Jobs Analyzed";

      const skillsEl = document.getElementById("insight-top-skills");
      if (skillsEl) {
        skillsEl.innerHTML = (data.topSkills || []).map(s => `
          <div style="margin-bottom: 0.6rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem;">
              <span style="font-weight: 500;">${escapeHtml(s.name)}</span>
              <strong style="color: var(--accent-cyan); font-size: 0.8rem;">${s.count} jobs (${s.percentage}%)</strong>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, Math.max(6, s.percentage))}%; background: var(--accent-cyan); border-radius: 3px;"></div>
            </div>
          </div>
        `).join("");
      }

      const rolesEl = document.getElementById("insight-top-roles");
      if (rolesEl) {
        rolesEl.innerHTML = (data.topRoles || []).map(r => `
          <div style="margin-bottom: 0.6rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem;">
              <span style="font-weight: 500;">${escapeHtml(r.name)}</span>
              <strong style="color: var(--accent-indigo); font-size: 0.8rem;">${r.count} postings (${r.percentage || Math.round((r.count/data.sampleSize)*100)}%)</strong>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, Math.max(6, r.percentage || Math.round((r.count/data.sampleSize)*100)))}%; background: var(--accent-indigo); border-radius: 3px;"></div>
            </div>
          </div>
        `).join("");
      }

      const locsEl = document.getElementById("insight-top-locations");
      if (locsEl) {
        locsEl.innerHTML = (data.topLocations || []).map(l => `
          <div style="margin-bottom: 0.6rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem;">
              <span style="font-weight: 500;">📍 ${escapeHtml(l.name)}</span>
              <strong style="color: var(--accent-emerald); font-size: 0.8rem;">${l.count} jobs (${l.percentage || Math.round((l.count/data.sampleSize)*100)}%)</strong>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, Math.max(6, l.percentage || Math.round((l.count/data.sampleSize)*100)))}%; background: var(--accent-emerald); border-radius: 3px;"></div>
            </div>
          </div>
        `).join("");
      }

      const compsEl = document.getElementById("insight-top-companies");
      if (compsEl) {
        compsEl.innerHTML = (data.topCompanies || []).map(c => `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border-color);">
            <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">🏢 ${escapeHtml(c.name)}</span>
            <span class="match-pill high" style="font-size: 0.75rem; padding: 0.15rem 0.5rem;">${c.count} open roles</span>
          </div>
        `).join("");
      }

      const fresherEl = document.getElementById("insight-fresher-trends");
      if (fresherEl) {
        fresherEl.innerHTML = (data.fresherTrends || []).map(f => `
          <div style="margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
              <span style="font-weight: 500;">${escapeHtml(f.name)}</span>
              <strong style="color: var(--accent-rose);">${f.count} jobs (${f.percentage}%)</strong>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, Math.max(5, f.percentage))}%; background: var(--accent-rose); border-radius: 3px;"></div>
            </div>
          </div>
        `).join("");
      }

      const modesEl = document.getElementById("insight-work-modes");
      if (modesEl) {
        modesEl.innerHTML = (data.workModes || []).map(w => `
          <div style="margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
              <span style="font-weight: 500;">💼 ${escapeHtml(w.name)}</span>
              <strong style="color: var(--accent-cyan);">${w.count} jobs (${w.percentage}%)</strong>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, Math.max(5, w.percentage))}%; background: var(--accent-cyan); border-radius: 3px;"></div>
            </div>
          </div>
        `).join("");
      }

    } catch (e) {
      console.error("Error loading insights:", e);
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

  // Helper
  function escapeHtml(str) {
    if (!str) return "";
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Client-side resume text parser (runs in browser when backend unavailable)
  function applyResumeTextClientSide(text, filename) {
    const ALL_SKILLS = [
      "Python","Java","JavaScript","TypeScript","C","C++","C#","Go","Rust","PHP","Ruby","Swift","Kotlin",
      "HTML","CSS","React","Angular","Vue.js","Next.js","Node.js","Express","Django","Flask","FastAPI",
      "Spring Boot","SQL","MySQL","PostgreSQL","MongoDB","Redis","Oracle","SQLite",
      "Git","GitHub","Docker","Kubernetes","AWS","Azure","GCP","Linux","REST API","GraphQL",
      "Data Structures","Algorithms","OOP","System Design","CI/CD","Tailwind CSS","Bootstrap",
      "Pandas","NumPy","PyTorch","TensorFlow","Scikit-Learn","Machine Learning","AI","Data Analysis",
      "Selenium","Playwright","Jest","JUnit","QA Testing","Postman","Android","Kotlin",
      "Figma","Power BI","Tableau","Excel","ETL","Microservices","Firebase","Redux"
    ];

    const textLower = text.toLowerCase();

    // Extract skills
    const foundSkills = ALL_SKILLS.filter(skill => {
      const pattern = new RegExp("\\b" + skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      return pattern.test(text);
    });

    // Extract name (first line likely)
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const name = lines[0] || "Candidate";

    // Extract graduation year
    const yearMatch = text.match(/20(2[0-9]|1[6-9])/);
    const gradYear = yearMatch ? yearMatch[0] : "2026";

    // Detect experience level
    const isFresher = /fresher|fresh graduate|0[\s-]*year|entry.level|final.year/i.test(text);
    const experience = isFresher ? "Fresher" : "0–2 years";

    // Detect degree
    const degree = /b\.?tech|be\b|bachelor/i.test(text) ? "B.Tech CSE"
      : /m\.?tech|me\b|master/i.test(text) ? "M.Tech CSE"
      : /mca\b/i.test(text) ? "MCA"
      : /bca\b/i.test(text) ? "BCA"
      : "B.Tech CSE";

    // Preferred roles based on skills found
    const prefRoles = [];
    if (foundSkills.some(s => ["React","Vue.js","Angular","Next.js","HTML","CSS"].includes(s))) prefRoles.push("Frontend Developer");
    if (foundSkills.some(s => ["Django","Flask","Spring Boot","Node.js","FastAPI"].includes(s))) prefRoles.push("Backend Developer");
    if (foundSkills.some(s => ["Machine Learning","TensorFlow","PyTorch","Scikit-Learn"].includes(s))) prefRoles.push("Machine Learning Engineer");
    if (foundSkills.some(s => ["Pandas","Data Analysis","SQL","Power BI","Tableau"].includes(s))) prefRoles.push("Data Analyst");
    if (foundSkills.some(s => ["Docker","Kubernetes","AWS","CI/CD","Linux"].includes(s))) prefRoles.push("DevOps Engineer");
    if (prefRoles.length === 0) prefRoles.push("Software Developer");

    candidateProfile = {
      name,
      degree,
      branch: "Computer Science",
      graduationYear: gradYear,
      experience,
      skills: foundSkills.length > 0 ? foundSkills : ["Python", "JavaScript", "SQL", "Git"],
      projects: [],
      preferredRoles: prefRoles,
      preferredLocations: ["Bengaluru", "Chennai", "Hyderabad", "Remote"],
      preferredWorkMode: "Any"
    };

    renderProfileSummary();
    renderJobsFeed();
    updateResumeFeedback();

    alert(`✅ Resume analyzed from ${filename}!\n\nFound ${foundSkills.length} skills: ${foundSkills.slice(0,8).join(", ")}${foundSkills.length > 8 ? "..." : ""}\n\nJob recommendations and feedback updated!`);
  }
});

