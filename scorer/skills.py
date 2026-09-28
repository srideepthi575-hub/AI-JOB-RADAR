import re
from typing import List, Set, Dict

# Comprehensive CSE / IT Skill Taxonomy
SKILL_TAXONOMY: Dict[str, List[str]] = {
    "Languages": ["Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin"],
    "Frontend": ["HTML", "CSS", "React", "Angular", "Vue.js", "Next.js", "Redux", "Tailwind CSS", "Bootstrap", "jQuery", "Sass"],
    "Backend": ["Node.js", "Express", "Django", "Flask", "FastAPI", "Spring Boot", "ASP.NET", "Laravel"],
    "Databases": ["SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Oracle", "SQLite", "DynamoDB"],
    "Cloud & DevOps": ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux", "Git", "GitHub", "CI/CD", "Terraform", "Nginx"],
    "Core CS & AI": ["Data Structures", "Algorithms", "OOP", "System Design", "REST API", "GraphQL", "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Pandas", "NumPy", "Scikit-Learn"],
    "Testing & Tools": ["QA Testing", "Selenium", "Postman", "JUnit", "Jest", "Playwright", "Jira"]
}

ALL_SKILLS: List[str] = [skill for cat in SKILL_TAXONOMY.values() for skill in cat]

def extract_skills_from_text(text: str) -> List[str]:
    """
    Extracts canonical tech skills from any resume or job description text.
    """
    if not text:
        return []
    
    found: Set[str] = set()
    text_lower = text.lower()
    
    for skill in ALL_SKILLS:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            found.add(skill)
            
    return sorted(list(found))
