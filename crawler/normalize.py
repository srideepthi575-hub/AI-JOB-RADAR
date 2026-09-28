import re
import urllib.parse
import datetime
from typing import Dict, Any, List

# Standard Technical Skill Dictionary for CSE / IT
COMMON_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin",
    "HTML", "CSS", "React", "Angular", "Vue.js", "Next.js", "Node.js", "Express", "Django", "Flask", "FastAPI",
    "Spring Boot", "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Oracle", "SQLite",
    "Git", "GitHub", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "REST API", "GraphQL",
    "Data Structures", "Algorithms", "OOP", "System Design", "CI/CD", "Tailwind CSS", "Bootstrap",
    "Pandas", "NumPy", "PyTorch", "TensorFlow", "Scikit-Learn", "Machine Learning", "AI", "Data Analysis",
    "Selenium", "Playwright", "Jest", "JUnit", "QA Testing", "Postman"
]

def canonicalizeUrl(url: str) -> str:
    if not url or url.lower() in ["none", "null", "not specified"]:
        return ""
    url = url.strip()
    try:
        parsed = urllib.parse.urlparse(url)
        # Strip tracking parameters like utm_source, ref, etc.
        qs = urllib.parse.parse_qs(parsed.query)
        clean_qs = {k: v for k, v in qs.items() if not k.startswith("utm_") and k not in ["ref", "fbclid", "gclid"]}
        clean_query = urllib.parse.urlencode(clean_qs, doseq=True)
        return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, clean_query, ""))
    except Exception:
        return url

def normalizeTitle(title: str) -> str:
    if not title:
        return "Not specified"
    title = title.strip()
    # Clean up HTML entities or weird punctuation
    title = re.sub(r'[\r\n\t]+', ' ', title)
    title = re.sub(r'\s+', ' ', title)
    return title

def normalizeCompany(company: str) -> str:
    if not company or company.lower() in ["none", "null", "not specified", "unknown"]:
        return "Not specified"
    company = re.sub(r'[\r\n\t]+', ' ', company.strip())
    company = re.sub(r'\s+', ' ', company)
    return company

def normalizeLocation(location: str) -> str:
    if not location or location.lower() in ["none", "null", "not specified", "unknown"]:
        return "India (Not specified)"
    loc = location.strip()
    loc_lower = loc.lower()
    
    if "remote" in loc_lower or "work from home" in loc_lower:
        return "Remote, India"
    
    # Standardize major Indian tech hubs
    cities = ["Bengaluru", "Bangalore", "Chennai", "Hyderabad", "Pune", "Mumbai", "Noida", "Gurugram", "Gurgaon", "Delhi", "Kolkata", "Ahmedabad", "Kochi", "Coimbatore"]
    for city in cities:
        if city.lower() in loc_lower:
            standard_city = "Bengaluru" if city.lower() in ["bangalore", "bengaluru"] else city
            standard_city = "Gurugram" if city.lower() in ["gurgaon", "gurugram"] else standard_city
            return f"{standard_city}, India"

    return loc

def normalizeWorkMode(work_mode: str, text: str) -> str:
    combined = f"{work_mode} {text}".lower()
    if "remote" in combined or "work from home" in combined or "wfh" in combined:
        return "Remote"
    elif "hybrid" in combined:
        return "Hybrid"
    elif "on-site" in combined or "onsite" in combined or "in office" in combined:
        return "On-site"
    return "Not specified"

def normalizeExperience(exp_str: str, text: str) -> str:
    combined = f"{exp_str} {text}".lower()
    if any(k in combined for k in ["fresher", "freshers", "recent graduate", "0-1 year", "0-1 years", "0 to 1 year", "0-2 years", "0 to 2 years", "entry level", "entry-level", "intern", "internship"]):
        if "intern" in combined:
            return "Internship (0 years)"
        if "0-1" in combined or "0 to 1" in combined:
            return "0–1 years"
        return "0–2 years (Fresher Eligible)"
    
    # Try regex matching for years
    match = re.search(r'(\d+)\s*[-to–]\s*(\d+)\s*year', combined)
    if match:
        min_yrs, max_yrs = int(match.group(1)), int(match.group(2))
        return f"{min_yrs}–{max_yrs} years"
    
    match_single = re.search(r'(\d+)\+?\s*year', combined)
    if match_single:
        yrs = int(match_single.group(1))
        return f"{yrs}+ years"
        
    return "0–2 years (Fresher Eligible)"

def normalizeSkills(text: str, title: str) -> List[str]:
    combined = f"{title} {text}"
    extracted = set()
    for skill in COMMON_SKILLS:
        # Match as whole word
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, combined, re.IGNORECASE):
            extracted.add(skill)
    return sorted(list(extracted))

def normalizeDate(date_str: str) -> str:
    if not date_str or str(date_str).lower() in ["none", "null", "not specified", "nat"]:
        return "Not specified"
    date_str = str(date_str).strip()
    try:
        # If relative date like "2 days ago", convert
        if "ago" in date_str.lower():
            now = datetime.datetime.now(datetime.timezone.utc)
            match = re.search(r'(\d+)\s*(hour|day|week|month)', date_str.lower())
            if match:
                num = int(match.group(1))
                unit = match.group(2)
                if "hour" in unit:
                    dt = now - datetime.timedelta(hours=num)
                elif "day" in unit:
                    dt = now - datetime.timedelta(days=num)
                elif "week" in unit:
                    dt = now - datetime.timedelta(weeks=num)
                elif "month" in unit:
                    dt = now - datetime.timedelta(days=num*30)
                return dt.strftime("%Y-%m-%d")
        
        # Try ISO parsing or common formats
        dt = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except Exception:
        # Fallback date regex
        match = re.search(r'\d{4}-\d{2}-\d{2}', date_str)
        if match:
            return match.group(0)
        return "Not specified"

def normalizeJob(raw_job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes raw job dictionary into standard Real Job Data Schema.
    """
    source = raw_job.get("source", "Unknown")
    source_job_id = str(raw_job.get("sourceJobId", "") or "")
    source_url = canonicalizeUrl(str(raw_job.get("sourceUrl", "") or ""))
    title = normalizeTitle(str(raw_job.get("title", "")))
    company = normalizeCompany(str(raw_job.get("company", "")))
    location = normalizeLocation(str(raw_job.get("location", "")))
    description = str(raw_job.get("description", "") or "Not specified")
    
    work_mode = normalizeWorkMode(str(raw_job.get("workMode", "")), f"{title} {description}")
    exp_req = normalizeExperience(str(raw_job.get("experienceRequirement", "")), f"{title} {description}")
    skills = normalizeSkills(description, title)
    posted_at = normalizeDate(str(raw_job.get("postedAt", "")))
    fetched_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # Determine jobType (Full-time, Internship, Contract)
    combined_text = f"{title} {description}".lower()
    if "intern" in combined_text:
        job_type = "Internship"
    elif "contract" in combined_text or "freelance" in combined_text:
        job_type = "Contract"
    else:
        job_type = "Full-time"

    # Unique synthetic ID if sourceJobId is absent
    job_id = f"{source.lower()}_{source_job_id}" if source_job_id else f"{source.lower()}_{abs(hash(title + company + location))}"

    return {
        "id": job_id,
        "source": source,
        "sourceJobId": source_job_id or "Not specified",
        "sourceUrl": source_url or "#",
        "title": title,
        "company": company,
        "location": location,
        "workMode": work_mode,
        "experienceRequirement": exp_req,
        "jobType": job_type,
        "postedAt": posted_at,
        "fetchedAt": fetched_at,
        "description": description if len(description) > 10 else "Not specified",
        "requiredSkills": skills[:6] if skills else ["Software Development", "Problem Solving"],
        "preferredSkills": skills[6:10] if len(skills) > 6 else [],
        "salary": str(raw_job.get("salary", "") or "Not specified"),
        "employmentType": job_type,
        "isVerified": True if source_url and source_url != "#" else False,
        "availabilityStatus": "active",
        "foundOn": [source]
    }
