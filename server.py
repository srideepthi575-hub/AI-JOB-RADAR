import os
import sys
import json
import time
import datetime
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from crawler.run import run_crawler, DATA_FILE_PATH
from crawler.sources.registry import SourceRegistry
from scorer.score import calculate_match_score
from scorer.explanations import generate_ai_explanation
from scorer.skills import extract_skills_from_text, ALL_SKILLS
from resume.parser import parse_resume_file
from resume.extractor import extract_resume_profile
from resume.analyzer import analyze_resume_profile

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")
CORS(app)

LAST_CRAWL_TIMESTAMP = 0
CRAWL_COOLDOWN_SECONDS = 180  # 3 minutes rate limit for manual crawl

def load_jobs_data() -> dict:
    if os.path.exists(DATA_FILE_PATH):
        try:
            with open(DATA_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading {DATA_FILE_PATH}: {e}")
    
    return {
        "metadata": {
            "lastSuccessfulUpdate": "Never",
            "totalValidJobs": 0,
            "duplicatesRemoved": 0,
            "invalidRecords": 0,
            "validationStatus": "NO_JOBS_AVAILABLE",
            "sources": []
        },
        "jobs": []
    }

# -------------------------------------------------------------------
# STATIC FRONTEND ROUTES
# -------------------------------------------------------------------

@app.route("/")
def serve_index():
    return send_from_directory(PUBLIC_DIR, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    if os.path.exists(os.path.join(PUBLIC_DIR, path)):
        return send_from_directory(PUBLIC_DIR, path)
    return send_from_directory(PUBLIC_DIR, "index.html")

# -------------------------------------------------------------------
# API ENDPOINTS
# -------------------------------------------------------------------

LOCATION_ALIASES = {
    "bengaluru": ["bengaluru", "bangalore", "ka", "karnataka", "india"],
    "hyderabad": ["hyderabad", "ts", "telangana", "ap", "andhra", "india"],
    "pune": ["pune", "mh", "maharashtra", "india"],
    "mumbai": ["mumbai", "mh", "maharashtra", "india"],
    "noida": ["noida", "gurugram", "gurgaon", "delhi", "ncr", "up", "hr", "dl", "india"],
    "remote": ["remote", "work from home"]
}

@app.route("/api/jobs", methods=["GET"])
def get_jobs():
    data = load_jobs_data()
    jobs = data.get("jobs", [])
    
    # Filtering parameters
    query = request.args.get("query", "").strip().lower()
    role = request.args.get("role", "").strip().lower()
    location = request.args.get("location", "").strip().lower()
    work_mode = request.args.get("workMode", "").strip().lower()
    job_type = request.args.get("jobType", "").strip().lower()
    experience = request.args.get("experience", "").strip().lower()
    source = request.args.get("source", "").strip().lower()
    min_score = int(request.args.get("minScore", 0))

    filtered = []
    now = datetime.datetime.utcnow()

    for j in jobs:
        # Text Query Search
        if query:
            searchable = f"{j.get('title')} {j.get('company')} {j.get('location')} {j.get('description')} {' '.join(j.get('requiredSkills', []))}".lower()
            if query not in searchable:
                continue

        # Role Filter
        if role and role != "all":
            if role not in j.get("title", "").lower():
                continue

        # Location Filter with State & City Aliases
        if location and location != "all":
            job_loc = j.get("location", "").lower()
            aliases = LOCATION_ALIASES.get(location, [location])
            if not any(a in job_loc for a in aliases):
                continue

        # Work Mode Filter
        if work_mode and work_mode != "all":
            if work_mode not in j.get("workMode", "").lower():
                continue

        # Job Type Filter
        if job_type and job_type != "all":
            if job_type not in j.get("jobType", "").lower():
                continue

        # Experience Filter
        if experience and experience != "all":
            if experience not in j.get("experienceRequirement", "").lower():
                continue

        # Source Filter
        if source and source != "all":
            if source not in j.get("source", "").lower():
                continue

        filtered.append(j)

    # Date-wise Grouping logic
    today_jobs = []
    this_week_jobs = []
    this_month_jobs = []
    unspecified_date_jobs = []

    for j in filtered:
        posted = j.get("postedAt", "Not specified")
        if not posted or posted == "Not specified":
            unspecified_date_jobs.append(j)
        else:
            try:
                clean_date_str = str(posted).split("T")[0].split(" ")[0]
                pdate = datetime.datetime.strptime(clean_date_str, "%Y-%m-%d")
                delta_days = (now.date() - pdate.date()).days
                if delta_days <= 1:
                    today_jobs.append(j)
                    this_week_jobs.append(j)
                    this_month_jobs.append(j)
                elif delta_days <= 7:
                    this_week_jobs.append(j)
                    this_month_jobs.append(j)
                elif delta_days <= 30:
                    this_month_jobs.append(j)
                else:
                    unspecified_date_jobs.append(j)
            except Exception:
                unspecified_date_jobs.append(j)

    return jsonify({
        "metadata": data.get("metadata", {}),
        "total": len(filtered),
        "jobs": filtered,
        "grouped": {
            "today": today_jobs,
            "thisWeek": this_week_jobs,
            "thisMonth": this_month_jobs,
            "unspecified": unspecified_date_jobs
        }
    })

@app.route("/api/crawl", methods=["POST"])
def trigger_crawl():
    global LAST_CRAWL_TIMESTAMP
    now = time.time()
    if now - LAST_CRAWL_TIMESTAMP < CRAWL_COOLDOWN_SECONDS:
        remaining = int(CRAWL_COOLDOWN_SECONDS - (now - LAST_CRAWL_TIMESTAMP))
        return jsonify({
            "status": "error",
            "message": f"Rate limit active. Manual refresh is available in {remaining} seconds."
        }), 429

    LAST_CRAWL_TIMESTAMP = now
    try:
        summary = run_crawler()
        return jsonify({
            "status": "success",
            "message": "Job crawler executed successfully.",
            "summary": summary.get("metadata", {})
        })
    except Exception as e:
        logger.error(f"Crawler execution error: {e}")
        return jsonify({
            "status": "error",
            "message": f"Crawler failed: {str(e)}"
        }), 500

@app.route("/api/crawler/status", methods=["GET"])
def get_crawler_status():
    registry = SourceRegistry()
    return jsonify({
        "sources": registry.get_source_status()
    })

@app.route("/api/resume/parse", methods=["POST"])
def parse_resume():
    try:
        resume_text = ""
        if "file" in request.files:
            file = request.files["file"]
            resume_text = parse_resume_file(file_bytes=file.read(), filename=file.filename)
        elif request.json and "text" in request.json:
            resume_text = request.json.get("text", "")

        profile = extract_resume_profile(resume_text)
        return jsonify({
            "status": "success",
            "profile": profile,
            "rawTextLength": len(resume_text)
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/resume/analyze", methods=["POST"])
def analyze_resume():
    data = request.json or {}
    profile = data.get("profile", {})
    analysis = analyze_resume_profile(profile)
    return jsonify(analysis)

@app.route("/api/match", methods=["POST"])
def match_job():
    data = request.json or {}
    profile = data.get("profile", {})
    job = data.get("job", {})

    match_result = calculate_match_score(profile, job)
    ai_explanation = generate_ai_explanation(profile, job, match_result)

    return jsonify({
        "match": match_result,
        "explanation": ai_explanation
    })

@app.route("/api/jd/analyze", methods=["POST"])
def analyze_jd():
    data = request.json or {}
    jd_text = data.get("jdText", "")
    profile = data.get("profile", {})

    if not jd_text:
        return jsonify({"status": "error", "message": "Job description text is required."}), 400

    extracted_skills = extract_skills_from_text(jd_text)
    req_skills = extracted_skills[:6]
    pref_skills = extracted_skills[6:10]

    synthetic_job = {
        "title": "Analyzed Job Position",
        "company": "Job Description Input",
        "location": "India",
        "workMode": "Any",
        "experienceRequirement": "0–2 years",
        "description": jd_text,
        "requiredSkills": req_skills,
        "preferredSkills": pref_skills
    }

    match_result = calculate_match_score(profile, synthetic_job)
    ai_explanation = generate_ai_explanation(profile, synthetic_job, match_result)
    resume_analysis = analyze_resume_profile(profile)

    return jsonify({
        "status": "success",
        "jdSkills": extracted_skills,
        "requiredSkills": req_skills,
        "preferredSkills": pref_skills,
        "matchScore": match_result["scorePercentage"],
        "matchingSkills": match_result["matchingSkills"],
        "missingSkills": match_result["missingSkills"],
        "breakdown": match_result["breakdown"],
        "explanation": ai_explanation,
        "resumeImprovements": resume_analysis["suggestedImprovements"],
        "interviewPrepTopics": [
            f"Core conceptual deep-dive into {s}" for s in match_result["matchingSkills"][:3]
        ] + [
            f"Fundamentals and practical use-cases of {s}" for s in match_result["missingSkills"][:3]
        ]
    })

@app.route("/api/skills/gap", methods=["GET"])
def get_skill_gap():
    data = load_jobs_data()
    jobs = data.get("jobs", [])
    
    cand_skills = request.args.get("skills", "").split(",")
    cand_skills = [s.strip().lower() for s in cand_skills if s.strip()]

    total_jobs = len(jobs)
    if total_jobs == 0:
        return jsonify({
            "status": "insufficient_data",
            "message": "Not enough current job data to calculate skill gap accurately.",
            "sampleSize": 0,
            "skillFrequencies": []
        })

    freq_dict = {}
    for j in jobs:
        req = j.get("requiredSkills", [])
        pref = j.get("preferredSkills", [])
        all_j_skills = set([s.strip() for s in req + pref])
        for s in all_j_skills:
            freq_dict[s] = freq_dict.get(s, 0) + 1

    sorted_skills = sorted(freq_dict.items(), key=lambda x: x[1], reverse=True)
    
    skill_stats = []
    missing_recommendations = []

    for skill_name, count in sorted_skills[:20]:
        percentage = round((count / total_jobs) * 100)
        is_missing = skill_name.lower() not in cand_skills and not any(cs in skill_name.lower() for cs in cand_skills)
        
        stat_item = {
            "skill": skill_name,
            "count": count,
            "percentage": percentage,
            "isMissing": is_missing
        }
        skill_stats.append(stat_item)

        if is_missing and len(missing_recommendations) < 6:
            missing_recommendations.append({
                "skill": skill_name,
                "percentage": percentage,
                "sampleSize": total_jobs,
                "learningTopics": [
                    f"{skill_name} core fundamentals and syntax",
                    f"Building a mini-project utilizing {skill_name}",
                    f"Integration of {skill_name} into RESTful services or web apps",
                    f"Common interview questions on {skill_name}"
                ]
            })

    return jsonify({
        "status": "success",
        "sampleSize": total_jobs,
        "skillFrequencies": skill_stats,
        "missingRecommendations": missing_recommendations
    })

@app.route("/api/insights", methods=["GET"])
def get_insights():
    data = load_jobs_data()
    jobs = data.get("jobs", [])
    total_jobs = len(jobs)

    if total_jobs == 0:
        return jsonify({
            "status": "insufficient_data",
            "message": "Insufficient current data for reliable statistics."
        })

    # Calculate Market Metrics dynamically
    skill_counts = {}
    role_counts = {}
    location_counts = {}
    work_mode_counts = {"Remote (Work from Home)": 0, "Hybrid (Flexible)": 0, "On-site / In-Office": 0}
    company_counts = {}
    exp_counts = {
        "Fresher / Entry-Level (0–2 YOE)": 0,
        "Internships & Trainees": 0,
        "Mid / Senior Roles (2+ YOE)": 0
    }

    for j in jobs:
        # Skills
        for s in (j.get("requiredSkills", []) or []) + (j.get("preferredSkills", []) or []):
            if s and str(s).strip():
                skill = str(s).strip()
                skill_counts[skill] = skill_counts.get(skill, 0) + 1
        
        # Roles normalization
        title = (j.get("title") or "").lower()
        if any(w in title for w in ["frontend", "react", "angular", "vue", "ui developer"]):
            role = "Frontend Developer"
        elif any(w in title for w in ["backend", "node", "django", "spring", "fastapi"]):
            role = "Backend Developer"
        elif "full stack" in title or "fullstack" in title:
            role = "Full Stack Engineer"
        elif "python" in title:
            role = "Python Developer"
        elif any(w in title for w in ["data", "analytics", "analyst", "bi "]):
            role = "Data Analyst / Engineer"
        elif any(w in title for w in ["qa", "test", "quality", "automation"]):
            role = "QA / Automation Engineer"
        elif any(w in title for w in ["devops", "cloud", "aws", "infra"]):
            role = "DevOps & Cloud Engineer"
        elif "intern" in title:
            role = "Software Intern / Trainee"
        elif "java" in title:
            role = "Java Developer"
        elif any(w in title for w in ["ai", "ml", "machine learning"]):
            role = "AI / ML Engineer"
        else:
            role = j.get("title", "Software Engineer")
        role_counts[role] = role_counts.get(role, 0) + 1

        # Location normalization
        loc_raw = (j.get("location") or "India").upper()
        if "BENGALURU" in loc_raw or "BANGALORE" in loc_raw or "KA," in loc_raw:
            loc = "Bengaluru (KA)"
        elif "HYDERABAD" in loc_raw or "TS," in loc_raw or "TELANGANA" in loc_raw or "AP," in loc_raw:
            loc = "Hyderabad (TS)"
        elif "PUNE" in loc_raw:
            loc = "Pune (MH)"
        elif "MUMBAI" in loc_raw or "MH," in loc_raw:
            loc = "Mumbai (MH)"
        elif "CHENNAI" in loc_raw or "TN," in loc_raw:
            loc = "Chennai (TN)"
        elif any(w in loc_raw for w in ["NOIDA", "GURUGRAM", "GURGAON", "DELHI", "NCR", "UP,"]):
            loc = "Delhi NCR / Noida"
        elif "REMOTE" in loc_raw:
            loc = "Remote (Pan-India)"
        else:
            loc = j.get("location", "Other Indian Cities").replace(", IN", "").replace(", India", "")
        location_counts[loc] = location_counts.get(loc, 0) + 1

        # Work Mode
        mode = (j.get("workMode") or "").lower()
        if "remote" in mode:
            work_mode_counts["Remote (Work from Home)"] += 1
        elif "hybrid" in mode:
            work_mode_counts["Hybrid (Flexible)"] += 1
        else:
            work_mode_counts["On-site / In-Office"] += 1

        # Company
        comp = j.get("company", "Verified Tech Employer")
        if "|" in comp:
            comp = comp.split("|")[0].strip()
        company_counts[comp] = company_counts.get(comp, 0) + 1

        # Experience
        exp = (j.get("experienceRequirement") or "").lower()
        jtype = (j.get("jobType") or "").lower()
        if "intern" in jtype or "intern" in exp:
            exp_counts["Internships & Trainees"] += 1
        elif any(w in exp for w in ["0-2", "0–2", "fresher", "0 year", "1 year", "entry"]):
            exp_counts["Fresher / Entry-Level (0–2 YOE)"] += 1
        else:
            exp_counts["Mid / Senior Roles (2+ YOE)"] += 1

    top_skills = [{"name": k, "count": v, "percentage": round((v/total_jobs)*100)} for k, v in sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]]
    top_roles = [{"name": k, "count": v, "percentage": round((v/total_jobs)*100)} for k, v in sorted(role_counts.items(), key=lambda x: x[1], reverse=True)[:8]]
    top_locations = [{"name": k, "count": v, "percentage": round((v/total_jobs)*100)} for k, v in sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:8]]
    top_companies = [{"name": k, "count": v, "percentage": round((v/total_jobs)*100)} for k, v in sorted(company_counts.items(), key=lambda x: x[1], reverse=True)[:8]]
    fresher_trends = [{"name": k, "count": v, "percentage": round((v/total_jobs)*100)} for k, v in exp_counts.items()]
    work_modes = [{"name": k, "count": v, "percentage": round((v/total_jobs)*100)} for k, v in work_mode_counts.items()]

    return jsonify({
        "status": "success",
        "sampleSize": total_jobs,
        "lastUpdated": data.get("metadata", {}).get("lastSuccessfulUpdate", "Not specified"),
        "topSkills": top_skills,
        "topRoles": top_roles,
        "topLocations": top_locations,
        "workModes": work_modes,
        "topCompanies": top_companies,
        "fresherTrends": fresher_trends
    })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")
    logger.info(f"Starting Job Radar server on http://{host}:{port}")
    app.run(host=host, port=port, debug=True)
