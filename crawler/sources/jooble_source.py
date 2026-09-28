import os
import requests
import logging
import datetime
from typing import List, Dict, Any
from crawler.sources.base import BaseJobSource

logger = logging.getLogger(__name__)

class JoobleSource(BaseJobSource):
    """
    Jooble Job API Adapter.
    Uses official Jooble REST API when JOOBLE_API_KEY environment variable is configured.
    """
    def __init__(self, enabled: bool = True):
        super().__init__(name="Jooble", enabled=enabled)
        self.api_key = os.getenv("JOOBLE_API_KEY", "").strip()

    def fetch_jobs(self, search_terms: List[str], location: str = "India", limit: int = 25) -> List[Dict[str, Any]]:
        self.reset_stats()
        if not self.enabled:
            return []

        if not self.api_key:
            self.last_error = "Jooble API key (JOOBLE_API_KEY) not configured."
            return []

        raw_jobs = []
        url = f"https://jooble.org/api/{self.api_key}"

        for term in search_terms[:2]:
            payload = {
                "keywords": term,
                "location": location,
                "page": "1"
            }
            try:
                resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    jobs = data.get("jobs", [])
                    for item in jobs:
                        raw_job = {
                            "source": "Jooble",
                            "sourceJobId": str(item.get("id", "")),
                            "sourceUrl": str(item.get("link", "")),
                            "title": str(item.get("title", "")),
                            "company": str(item.get("company", "") or "Not specified"),
                            "location": str(item.get("location", "") or location),
                            "workMode": "Remote" if "remote" in str(item.get("title", "")).lower() else "Not specified",
                            "description": str(item.get("snippet", "")),
                            "postedAt": str(item.get("updated", "")),
                            "salary": str(item.get("salary", "") or "Not specified"),
                            "jobType": str(item.get("type", "Full-time"))
                        }
                        if raw_job["title"]:
                            raw_jobs.append(raw_job)
                else:
                    self.last_error = f"Jooble API returned status {resp.status_code}"
            except Exception as e:
                logger.warning(f"Jooble fetch failed for term '{term}': {e}")
                self.last_error = str(e)

        self.stats["fetched"] = len(raw_jobs)
        self.last_fetch_time = datetime.datetime.utcnow().isoformat() + "Z"
        return raw_jobs
