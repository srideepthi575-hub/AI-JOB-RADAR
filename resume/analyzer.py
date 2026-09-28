from typing import Dict, Any, List

def analyze_resume_profile(profile: Dict[str, Any], target_jobs: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Analyzes candidate profile grounded in actual extracted skills and resume data.
    Provides strengths, skill gaps, and resume improvement suggestions.
    """
    skills = profile.get("skills", [])
    projects = profile.get("projects", [])
    experience = profile.get("experience", "Fresher")

    strengths = []
    if skills:
        strengths.append(f"Strong foundation in core technical skills: {', '.join(skills[:5])}.")
    if len(skills) >= 6:
        strengths.append(f"Diverse technical stack across {len(profile.get('skillCategories', {}))} domain areas.")
    if projects:
        strengths.append(f"Demonstrated practical implementation with {len(projects)} listed project(s).")
    if "Internship" in experience or "0–2" in experience:
        strengths.append("Relevant practical exposure listed on profile.")

    if not strengths:
        strengths.append("Baseline entry-level academic computer science foundation.")

    improvements = []
    if "Python" in skills and not any("python" in p.lower() for p in projects):
        improvements.append("Your resume mentions Python but could highlight a specific Python project with GitHub link.")
    if "SQL" in skills and not any("sql" in p.lower() or "database" in p.lower() for p in projects):
        improvements.append("Consider detailing database design or SQL query optimization in your project descriptions.")
    if len(skills) < 5:
        improvements.append("Expand technical skill list by adding specific libraries, tools (Git, Docker, Postman), or databases you have used.")
    
    improvements.append("Use quantifiable impact metrics in project descriptions (e.g., 'Improved API query speed by 25%' or 'Served 100+ active requests').")
    improvements.append("Ensure your GitHub repository links and LinkedIn profile URL are prominently placed at the top of your resume.")

    return {
        "strengths": strengths,
        "suggestedImprovements": improvements,
        "extractedSkillsCount": len(skills),
        "projectsCount": len(projects)
    }
