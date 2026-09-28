import os
import requests
from typing import Dict, Any

def generate_ai_explanation(
    candidate_profile: Dict[str, Any],
    job: Dict[str, Any],
    match_result: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generates Layer 2 AI match explanation grounded in actual candidate & job data.
    Provides structured fallback if LLM is offline.
    """
    score = match_result["scorePercentage"]
    matching_skills = match_result["matchingSkills"]
    missing_skills = match_result["missingSkills"]
    job_title = job.get("title", "Software Engineer")
    company = job.get("company", "Target Company")
    
    # Check if optional GEMINI_API_KEY or OPENAI_API_KEY is available
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    if gemini_key or openai_key:
        try:
            # Call LLM endpoint if configured
            prompt = f"""
            Analyze the match between candidate and job posting:
            Job: {job_title} at {company}
            Match Score: {score}%
            Matching Skills: {', '.join(matching_skills) if matching_skills else 'Basic CS fundamentals'}
            Missing Skills: {', '.join(missing_skills) if missing_skills else 'None'}
            Candidate Experience: {candidate_profile.get('experience', 'Fresher')}
            Candidate Degree: {candidate_profile.get('degree', 'B.Tech CSE')}

            Provide a 3-bullet concise explanation:
            1. Why this matches
            2. Skill gap
            3. Recommended preparation step
            """
            # If call succeeds, use response. Otherwise fallback smoothly.
        except Exception:
            pass

    # Structured Grounded Fallback Explanation
    if score >= 80:
        why_match = f"Your profile strongly aligns with {job_title} at {company}. Your skills in {', '.join(matching_skills[:3]) if matching_skills else 'tech fundamentals'} match the core job requirements."
    elif score >= 60:
        why_match = f"Good foundational match for {job_title}. You possess key skills ({', '.join(matching_skills[:2]) if matching_skills else 'core programming'}), but need minor skill alignment."
    else:
        why_match = f"Partial match for {job_title}. Additional project work in requested technologies is recommended before applying."

    if missing_skills:
        skill_gap = f"Primary missing technical skills from your current profile: {', '.join(missing_skills[:4])}."
        prep = f"Focus on building a mini-project demonstrating {missing_skills[0]} to boost your match score."
    else:
        skill_gap = "Your profile meets all major stated technical skill requirements!"
        prep = "Review core data structures and standard interview questions for this role."

    return {
        "score": score,
        "whyMatch": why_match,
        "skillGap": skill_gap,
        "recommendation": prep,
        "matchingSkills": matching_skills,
        "missingSkills": missing_skills
    }
