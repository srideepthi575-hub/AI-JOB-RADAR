import logging
import datetime
from typing import List, Dict, Any
from crawler.sources.base import BaseJobSource

logger = logging.getLogger(__name__)

class JobSpySource(BaseJobSource):
    """
    JobSpy Source Adapter. Uses python-jobspy to query legitimate aggregators
    (LinkedIn, Indeed, Glassdoor, Google Jobs, etc.) where accessible.
    """
    def __init__(self, enabled: bool = True):
        super().__init__(name="JobSpy", enabled=enabled)

    def fetch_jobs(self, search_terms: List[str], location: str = "India", limit: int = 25) -> List[Dict[str, Any]]:
        self.reset_stats()
        if not self.enabled:
            return []

        try:
            from jobspy import scrape_jobs
        except ImportError:
            self.last_error = "python-jobspy library is not installed."
            return []

        raw_jobs = []
        # Target India entry-level / fresher queries on reliable sites
        site_names = ["linkedin", "indeed", "google"]
        
        for term in search_terms[:3]: # Limit queries to avoid rate limits
            try:
                # Scrape real job postings via JobSpy
                df = scrape_jobs(
                    site_name=site_names,
                    search_term=term,
                    location=location,
                    results_wanted=min(limit, 15),
                    hours_old=720, # last 30 days
                    country_indeed='India'
                )
                
                if df is not None and not df.empty:
                    # Convert dataframe rows to raw dicts
                    records = df.to_dict(orient="records")
                    for rec in records:
                        raw_job = {
                            "source": "JobSpy",
                            "sourceSite": str(rec.get("site", "JobSpy")),
                            "sourceJobId": str(rec.get("id", "") or rec.get("job_id", "")),
                            "sourceUrl": str(rec.get("job_url", "") or rec.get("site_url", "")),
                            "title": str(rec.get("title", "")),
                            "company": str(rec.get("company", "")),
                            "location": str(rec.get("location", "")),
                            "workMode": "Remote" if rec.get("is_remote") else "Not specified",
                            "description": str(rec.get("description", "")),
                            "postedAt": str(rec.get("date_posted", "")),
                            "salary": str(rec.get("min_amount", "") or rec.get("salary", "Not specified")),
                            "jobType": str(rec.get("job_type", "Full-time"))
                        }
                        if raw_job["title"] and raw_job["company"]:
                            raw_jobs.append(raw_job)
            except Exception as e:
                logger.warning(f"JobSpy query for term '{term}' encountered an issue: {e}")
                self.last_error = str(e)

        self.stats["fetched"] = len(raw_jobs)
        self.last_fetch_time = datetime.datetime.utcnow().isoformat() + "Z"
        return raw_jobs
