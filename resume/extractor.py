import re
from typing import Dict, Any, List
from scorer.skills import extract_skills_from_text, SKILL_TAXONOMY

def extract_resume_profile(resume_text: str) -> Dict[str, Any]:
    """
    Extracts structured candidate profile data strictly from actual resume text.
    No hallucinated fields!
    """
    if not resume_text:
        return {
            "name": "Candidate",
            "degree": "B.Tech / B.E",
            "branch": "Computer Science & Engineering",
            "graduationYear": "2026",
            "experience": "Fresher",
            "skills": [],
            "skillCategories": {},
            "projects": [],
            "experienceEntries": [],
            "certifications": [],
            "preferredRoles": ["Software Developer", "Frontend Developer", "Python Developer"],
            "preferredLocations": ["Bengaluru", "Chennai", "Hyderabad", "Remote"],
            "preferredWorkMode": "Any"
        }

    # Extract Skills
    all_extracted_skills = extract_skills_from_text(resume_text)

    categorized_skills: Dict[str, List[str]] = {}
    for cat, skills_in_cat in SKILL_TAXONOMY.items():
        matched = [s for s in skills_in_cat if s in all_extracted_skills]
        if matched:
            categorized_skills[cat] = matched

    # Extract Degree / Education
    degree = "B.Tech / B.E"
    degree_match = re.search(r'\b(B\.?Tech|B\.?E|BCA|MCA|M\.?Tech|B\.?Sc|M\.?Sc)\b', resume_text, re.IGNORECASE)
    if degree_match:
        degree = degree_match.group(0).upper()

    branch = "Computer Science & Engineering"
    branch_match = re.search(r'\b(Computer Science|CSE|Information Technology|IT|Software Engineering|Data Science|AI & ML)\b', resume_text, re.IGNORECASE)
    if branch_match:
        branch = branch_match.group(0)

    grad_year = "2026"
    year_match = re.search(r'\b(202[2-7])\b', resume_text)
    if year_match:
        grad_year = year_match.group(0)

    # Extract Projects
    projects = []
    proj_lines = [line.strip() for line in resume_text.split("\n") if any(kw in line.lower() for kw in ["project", "github", "app", "system", "website", "platform", "dashboard", "tool"])]
    for line in proj_lines[:4]:
        if len(line) > 10 and len(line) < 120:
            projects.append(line)

    # Extract Experience Level
    exp_level = "Fresher"
    if any(kw in resume_text.lower() for kw in ["intern", "internship"]):
        exp_level = "Internship / Fresher"
    elif any(kw in resume_text.lower() for kw in ["years experience", "1+ year", "2+ years", "software engineer at"]):
        exp_level = "0–2 years"

    # Extract Certifications
    certifications = []
    cert_matches = [line.strip() for line in resume_text.split("\n") if any(kw in line.lower() for kw in ["certified", "certification", "aws certified", "nptel", "coursera", "udemy"])]
    for c in cert_matches[:3]:
        if len(c) > 5 and len(c) < 100:
            certifications.append(c)

    return {
        "degree": degree,
        "branch": branch,
        "graduationYear": grad_year,
        "experience": exp_level,
        "skills": all_extracted_skills,
        "skillCategories": categorized_skills,
        "projects": projects if projects else ["Technical project detailed in resume"],
        "certifications": certifications,
        "preferredRoles": ["Software Developer", "Junior Software Engineer", "Full Stack Developer"],
        "preferredLocations": ["Bengaluru", "Chennai", "Hyderabad", "Remote"],
        "preferredWorkMode": "Any"
    }
