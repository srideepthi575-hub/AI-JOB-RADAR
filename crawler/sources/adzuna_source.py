import os
import requests
import logging
import datetime
from typing import List, Dict, Any
from crawler.sources.base import BaseJobSource

logger = logging.getLogger(__name__)

class AdzunaSource(BaseJobSource):
    """
    Adzuna Job API Adapter.
    Uses official Adzuna REST API for India postings when ADZUNA_APP_ID & ADZUNA_APP_KEY are set.
    """
    def __init__(self, enabled: bool = True):
        super().__init__(name="Adzuna", enabled=enabled)
        self.app_id = os.getenv("ADZUNA_APP_ID", "").strip()
        self.app_key = os.getenv("ADZUNA_APP_KEY", "").strip()

    def fetch_jobs(self, search_terms: List[str], location: str = "India", limit: int = 25) -> List[Dict[str, Any]]:
        self.reset_stats()
        if not self.enabled:
            return []

        if not self.app_id or not self.app_key:
            self.last_error = "Adzuna API credentials (ADZUNA_APP_ID/ADZUNA_APP_KEY) not configured."
            return []

        raw_jobs = []
        base_url = "https://api.adzuna.com/v1/api/jobs/in/search/1"

        for term in search_terms[:2]:
            params = {
                "app_id": self.app_id,
                "app_key": self.app_key,
                "what": term,
                "where": location,
                "results_per_page": min(limit, 20),
                "content-type": "application/json"
            }
            try:
                resp = requests.get(base_url, params=params, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    for item in results:
                        company_obj = item.get("company", {})
                        company_name = company_obj.get("display_name") if isinstance(company_obj, dict) else str(company_obj)
                        location_obj = item.get("location", {})
                        loc_display = ", ".join(location_obj.get("display_name", [])) if isinstance(location_obj, dict) else str(location_obj)

                        raw_job = {
                            "source": "Adzuna",
                            "sourceJobId": str(item.get("id", "")),
                            "sourceUrl": str(item.get("redirect_url", "")),
                            "title": str(item.get("title", "")),
                            "company": company_name or "Not specified",
                            "location": loc_display or location,
                            "workMode": "Not specified",
                            "description": str(item.get("description", "")),
                            "postedAt": str(item.get("created", "")),
                            "salary": f"₹{item.get('salary_min', '')} - ₹{item.get('salary_max', '')}" if item.get('salary_min') else "Not specified",
                            "jobType": str(item.get("contract_type", "Full-time"))
                        }
                        if raw_job["title"]:
                            raw_jobs.append(raw_job)
                else:
                    self.last_error = f"Adzuna API returned status {resp.status_code}: {resp.text[:100]}"
            except Exception as e:
                logger.warning(f"Adzuna fetch failed for term '{term}': {e}")
                self.last_error = str(e)

        self.stats["fetched"] = len(raw_jobs)
        self.last_fetch_time = datetime.datetime.utcnow().isoformat() + "Z"
        return raw_jobs
