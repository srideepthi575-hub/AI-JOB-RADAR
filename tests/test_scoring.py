import unittest
from scorer.score import calculate_match_score

class TestScoring(unittest.TestCase):
    def setUp(self):
        self.profile = {
            "degree": "B.Tech CSE",
            "experience": "Fresher",
            "skills": ["Python", "SQL", "Git", "HTML", "CSS", "JavaScript"],
            "preferredRoles": ["Python Developer", "Software Engineer"],
            "preferredLocations": ["Bengaluru", "Remote"],
            "projects": ["Web Scraper", "API Service"]
        }

    def test_high_match_job(self):
        job = {
            "title": "Python Developer (Fresher)",
            "company": "DataTech",
            "location": "Bengaluru, India",
            "workMode": "Remote",
            "experienceRequirement": "0–1 years",
            "requiredSkills": ["Python", "SQL", "Git"],
            "preferredSkills": ["JavaScript"]
        }
        res = calculate_match_score(self.profile, job)
        self.assertGreaterEqual(res["scorePercentage"], 80)
        self.assertIn("Python", res["matchingSkills"])

    def test_low_match_job(self):
        job = {
            "title": "Senior Rust Systems Architect",
            "company": "DeepTech",
            "location": "Berlin, Germany",
            "workMode": "On-site",
            "experienceRequirement": "8+ years",
            "requiredSkills": ["Rust", "C++", "Assembly", "Kernel"],
            "preferredSkills": ["Embedded"]
        }
        res = calculate_match_score(self.profile, job)
        self.assertLess(res["scorePercentage"], 60)
        self.assertIn("Rust", res["missingSkills"])

if __name__ == "__main__":
    unittest.main()
