import unittest
from crawler.normalize import (
    normalizeTitle, normalizeCompany, normalizeLocation,
    normalizeSkills, normalizeDate, canonicalizeUrl, normalizeJob
)

class TestNormalization(unittest.TestCase):
    def test_normalize_title(self):
        self.assertEqual(normalizeTitle("  Software  Engineer  \n"), "Software Engineer")
        self.assertEqual(normalizeTitle(""), "Not specified")

    def test_normalize_company(self):
        self.assertEqual(normalizeCompany(" Google  Inc "), "Google Inc")
        self.assertEqual(normalizeCompany("unknown"), "Not specified")

    def test_normalize_location(self):
        self.assertEqual(normalizeLocation("Bangalore"), "Bengaluru, India")
        self.assertEqual(normalizeLocation("Work From Home"), "Remote, India")

    def test_normalize_skills(self):
        skills = normalizeSkills("Looking for a developer with Python, SQL, and Docker experience", "Python Engineer")
        self.assertIn("Python", skills)
        self.assertIn("SQL", skills)
        self.assertIn("Docker", skills)

    def test_canonicalize_url(self):
        url = "https://example.com/job/123?utm_source=linkedin&ref=abc"
        self.assertEqual(canonicalizeUrl(url), "https://example.com/job/123")

    def test_normalize_job(self):
        raw = {
            "source": "JobSpy",
            "sourceJobId": "101",
            "sourceUrl": "https://linkedin.com/jobs/view/101?utm_source=feed",
            "title": "Junior Python Developer",
            "company": "Acme Corp",
            "location": "Bangalore",
            "description": "Python, SQL, Git required."
        }
        normalized = normalizeJob(raw)
        self.assertEqual(normalized["title"], "Junior Python Developer")
        self.assertEqual(normalized["company"], "Acme Corp")
        self.assertEqual(normalized["location"], "Bengaluru, India")
        self.assertEqual(normalized["sourceUrl"], "https://linkedin.com/jobs/view/101")

if __name__ == "__main__":
    unittest.main()
