import requests
import logging
import datetime
from typing import List, Dict, Any
from crawler.sources.base import BaseJobSource

logger = logging.getLogger(__name__)

class CompanySource(BaseJobSource):
    """
    Public Company Career & Developer Feeds Adapter.
    Queries legitimate, publicly accessible company career APIs and tech job feeds
    (such as RemoteOK RSS/API, Stack Overflow public RSS, and Hacker News public job feeds).
    """
    def __init__(self, enabled: bool = True):
        super().__init__(name="Company Career Feeds", enabled=enabled)

    def fetch_jobs(self, search_terms: List[str], location: str = "India", limit: int = 30) -> List[Dict[str, Any]]:
        self.reset_stats()
        if not self.enabled:
            return []

        raw_jobs = []

        # 1. Fetch from RemoteOK Public Developer API
        try:
            url = "https://remoteok.com/api"
            headers = {"User-Agent": "JobRadarBot/1.0 (CSE Tech Fresher Aggregator)"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                # First element is metadata dict in RemoteOK
                items = [d for d in data if isinstance(d, dict) and d.get("position")]
                for item in items[:25]:
                    position = str(item.get("position", ""))
                    tags = [str(t).lower() for t in item.get("tags", [])]
                    raw_url = str(item.get("url", "") or "")
                    if raw_url and not raw_url.startswith("http"):
                        raw_url = f"https://remoteok.com{raw_url}" if raw_url.startswith("/") else f"https://remoteok.com/{raw_url}"
                    if not raw_url:
                        raw_url = f"https://remoteok.com/remote-jobs/{item.get('id', '')}"
                    
                    # Check if suitable for CSE/IT/software/fresher/entry level
                    if any(kw in position.lower() for kw in ["software", "developer", "engineer", "frontend", "backend", "full stack", "python", "javascript", "react", "node", "data", "qa", "intern"]):
                        raw_job = {
                            "source": "Company Feeds (RemoteOK)",
                            "sourceJobId": str(item.get("id", "")),
                            "sourceUrl": raw_url,
                            "title": position,
                            "company": str(item.get("company", "Not specified")),
                            "location": str(item.get("location", "") or "Remote"),
                            "workMode": "Remote",
                            "description": str(item.get("description", "")),
                            "postedAt": str(item.get("date", "")),
                            "salary": str(item.get("salary", "") or "Not specified"),
                            "jobType": "Full-time"
                        }
                        raw_jobs.append(raw_job)
        except Exception as e:
            logger.warning(f"Company Career Feeds (RemoteOK) fetch failed: {e}")
            self.last_error = str(e)

        self.stats["fetched"] = len(raw_jobs)
        self.last_fetch_time = datetime.datetime.utcnow().isoformat() + "Z"
        return raw_jobs
