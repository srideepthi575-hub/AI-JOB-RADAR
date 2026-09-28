import unittest
from crawler.deduplicate import deduplicateJobs

class TestDeduplication(unittest.TestCase):
    def test_deduplicate_by_source_id(self):
        jobs = [
            {
                "id": "jobspy_101",
                "source": "JobSpy",
                "sourceJobId": "101",
                "sourceUrl": "https://example.com/j1",
                "title": "Software Developer",
                "company": "Company A",
                "location": "Bengaluru, India"
            },
            {
                "id": "jobspy_101",
                "source": "JobSpy",
                "sourceJobId": "101",
                "sourceUrl": "https://example.com/j1",
                "title": "Software Developer",
                "company": "Company A",
                "location": "Bengaluru, India"
            }
        ]
        unique_jobs, dupes = deduplicateJobs(jobs)
        self.assertEqual(len(unique_jobs), 1)
        self.assertEqual(dupes, 1)

    def test_deduplicate_fallback_key(self):
        jobs = [
            {
                "id": "s1_a",
                "source": "LinkedIn",
                "sourceJobId": "Not specified",
                "sourceUrl": "https://example.com/j1",
                "title": "React Developer",
                "company": "Tech Corp",
                "location": "Remote, India"
            },
            {
                "id": "s2_b",
                "source": "Indeed",
                "sourceJobId": "Not specified",
                "sourceUrl": "https://example.com/j1",
                "title": "React Developer",
                "company": "Tech Corp",
                "location": "Remote, India"
            }
        ]
        unique_jobs, dupes = deduplicateJobs(jobs)
        self.assertEqual(len(unique_jobs), 1)
        self.assertEqual(dupes, 1)
        self.assertIn("LinkedIn", unique_jobs[0]["foundOn"])
        self.assertIn("Indeed", unique_jobs[0]["foundOn"])

if __name__ == "__main__":
    unittest.main()
