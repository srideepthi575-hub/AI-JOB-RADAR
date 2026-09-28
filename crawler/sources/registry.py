import logging
from typing import List, Dict, Any
from crawler.sources.base import BaseJobSource
from crawler.sources.jobspy_source import JobSpySource
from crawler.sources.adzuna_source import AdzunaSource
from crawler.sources.jooble_source import JoobleSource
from crawler.sources.company_source import CompanySource

logger = logging.getLogger(__name__)

class SourceRegistry:
    """
    Registry for job source adapters.
    Executes active source adapters safely and compiles full reporting metrics.
    """
    def __init__(self):
        self.sources: Dict[str, BaseJobSource] = {}
        self.register_default_sources()

    def register_default_sources(self):
        self.register_source(JobSpySource(enabled=True))
        self.register_source(AdzunaSource(enabled=True))
        self.register_source(JoobleSource(enabled=True))
        self.register_source(CompanySource(enabled=True))

    def register_source(self, source: BaseJobSource):
        self.sources[source.name] = source

    def get_source_status(self) -> List[Dict[str, Any]]:
        status_list = []
        for name, source in self.sources.items():
            status_list.append({
                "source": source.name,
                "enabled": source.enabled,
                "fetched": source.stats["fetched"],
                "valid": source.stats["valid"],
                "duplicates": source.stats["duplicates"],
                "invalid": source.stats["invalid"],
                "lastFetch": source.last_fetch_time,
                "error": source.last_error
            })
        return status_list

    def fetch_all(self, search_terms: List[str], location: str = "India", limit: int = 30) -> List[Dict[str, Any]]:
        all_raw_jobs = []
        for name, source in self.sources.items():
            if not source.enabled:
                continue
            try:
                logger.info(f"Fetching from source: {name}")
                jobs = source.fetch_jobs(search_terms=search_terms, location=location, limit=limit)
                all_raw_jobs.extend(jobs)
                logger.info(f"Source {name} returned {len(jobs)} jobs.")
            except Exception as e:
                logger.error(f"Source {name} failed: {e}")
                source.last_error = str(e)
        return all_raw_jobs
