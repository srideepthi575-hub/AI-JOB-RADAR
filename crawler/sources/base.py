from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseJobSource(ABC):
    """
    Abstract Base Class for all Job Radar Source Adapters.
    Each adapter is independent and must report transparent metrics.
    """
    def __init__(self, name: str, enabled: bool = True):
        self.name = name
        self.enabled = enabled
        self.last_fetch_time: Optional[str] = None
        self.last_error: Optional[str] = None
        
        # Operational Stats
        self.stats = {
            "fetched": 0,
            "valid": 0,
            "duplicates": 0,
            "invalid": 0
        }

    def reset_stats(self):
        self.stats = {
            "fetched": 0,
            "valid": 0,
            "duplicates": 0,
            "invalid": 0
        }
        self.last_error = None

    @abstractmethod
    def fetch_jobs(self, search_terms: List[str], location: str = "India", limit: int = 30) -> List[Dict[str, Any]]:
        """
        Fetch raw job postings from the underlying source.
        Returns a list of raw job dictionaries.
        """
        pass
