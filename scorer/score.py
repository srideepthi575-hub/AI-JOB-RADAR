import re
from typing import Dict, Any, List
from scorer.skills import extract_skills_from_text

DEFAULT_WEIGHTS = {
    "required_skills": 0.40,
    "preferred_skills": 0.15,
    "role_similarity": 0.15,
    "experience_eligibility": 0.10,
    "location_workmode": 0.10,
    "education_relevance": 0.05,
    "projects_certifications": 0.05
}

def calculate_match_score(
    candidate_profile: Dict[str, Any],
    job: Dict[str, Any],
    weights: Dict[str, float] = None
) -> Dict[str, Any]:
    """
    Calculates a deterministic 0-100% match score between a candidate profile/resume
    and a job posting based on weighted criteria.
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    cand_skills = set([s.lower() for s in candidate_profile.get("skills", [])])
    job_req_skills = [s.strip() for s in job.get("requiredSkills", [])]
    job_pref_skills = [s.strip() for s in job.get("preferredSkills", [])]

    # Extract additional skills from description if lists are small
    if not job_req_skills:
        job_req_skills = extract_skills_from_text(job.get("description", ""))

    # 1. Required Skills Score (40%)
    req_matches = []
    req_missing = []
    if job_req_skills:
        for s in job_req_skills:
            if s.lower() in cand_skills or any(cs in s.lower() or s.lower() in cs for cs in cand_skills):
                req_matches.append(s)
            else:
                req_missing.append(s)
        req_score = len(req_matches) / len(job_req_skills)
    else:
        req_score = 0.8  # Default baseline if job has no explicit required skills listed

    # 2. Preferred Skills Score (15%)
    pref_matches = []
    pref_missing = []
    if job_pref_skills:
        for s in job_pref_skills:
            if s.lower() in cand_skills:
                pref_matches.append(s)
            else:
                pref_missing.append(s)
        pref_score = len(pref_matches) / len(job_pref_skills)
    else:
        pref_score = 0.7

    # 3. Role Similarity Score (15%)
    cand_roles = [r.lower() for r in candidate_profile.get("preferredRoles", [])]
    job_title = job.get("title", "").lower()
    role_score = 0.5
    if any(r in job_title for r in cand_roles) or any(job_title in r for r in cand_roles):
        role_score = 1.0
    elif any(kw in job_title for kw in ["software", "developer", "engineer", "code", "tech"]):
        role_score = 0.8

    # 4. Experience Eligibility (10%)
    job_exp = job.get("experienceRequirement", "").lower()
    cand_exp = candidate_profile.get("experience", "Fresher").lower()
    exp_score = 1.0 if any(k in job_exp for k in ["fresher", "0-1", "0-2", "0–1", "0–2", "entry", "intern"]) else 0.6

    # 5. Location / Work Mode (10%)
    cand_locs = [l.lower() for l in candidate_profile.get("preferredLocations", ["India"])]
    job_loc = job.get("location", "").lower()
    job_mode = job.get("workMode", "").lower()
    loc_score = 0.6
    if "remote" in job_mode or "remote" in job_loc:
        loc_score = 1.0
    elif any(cl in job_loc for cl in cand_locs):
        loc_score = 1.0

    # 6. Education Relevance (5%)
    cand_degree = candidate_profile.get("degree", "B.Tech").lower()
    edu_score = 1.0 if any(d in cand_degree for d in ["b.tech", "b.e", "bca", "mca", "m.tech", "cse", "it"]) else 0.7

    # 7. Projects / Certifications (5%)
    projects_count = len(candidate_profile.get("projects", []))
    proj_score = min(1.0, projects_count * 0.4) if projects_count > 0 else 0.5

    # Composite Score Calculation
    total_score_fraction = (
        (req_score * weights["required_skills"]) +
        (pref_score * weights["preferred_skills"]) +
        (role_score * weights["role_similarity"]) +
        (exp_score * weights["experience_eligibility"]) +
        (loc_score * weights["location_workmode"]) +
        (edu_score * weights["education_relevance"]) +
        (proj_score * weights["projects_certifications"])
    )

    final_match_percentage = min(99, max(15, round(total_score_fraction * 100)))

    return {
        "scorePercentage": final_match_percentage,
        "matchingSkills": sorted(list(set(req_matches + pref_matches))),
        "missingSkills": sorted(list(set(req_missing + pref_missing))),
        "breakdown": {
            "requiredSkillsScore": round(req_score * 100),
            "preferredSkillsScore": round(pref_score * 100),
            "roleSimilarityScore": round(role_score * 100),
            "experienceEligibilityScore": round(exp_score * 100),
            "locationWorkModeScore": round(loc_score * 100),
            "educationRelevanceScore": round(edu_score * 100),
            "projectsScore": round(proj_score * 100)
        }
    }
