import unittest
import datetime
from crawler.normalize import normalizeDate

class TestDateGrouping(unittest.TestCase):
    def test_normalize_relative_date(self):
        date_str = "2 days ago"
        normalized = normalizeDate(date_str)
        self.assertRegex(normalized, r'^\d{4}-\d{2}-\d{2}$')

    def test_normalize_iso_date(self):
        date_str = "2026-09-28T12:00:00Z"
        normalized = normalizeDate(date_str)
        self.assertEqual(normalized, "2026-09-28")

    def test_missing_date(self):
        self.assertEqual(normalizeDate(None), "Not specified")
        self.assertEqual(normalizeDate(""), "Not specified")

if __name__ == "__main__":
    unittest.main()
