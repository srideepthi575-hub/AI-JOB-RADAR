import datetime
from typing import List, Dict, Any

def update_dataset_freshness(jobs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Tags job records with availability status and generates dataset freshness metadata.
    """
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    
    active_count = 0
    for job in jobs:
        # Check basic link presence or explicit expiration status
        if job.get("sourceUrl") and job.get("sourceUrl") != "#":
            job["availabilityStatus"] = "active"
            active_count += 1
        else:
            job["availabilityStatus"] = "unknown"

    return {
        "lastSuccessfulUpdate": now_iso,
        "totalJobs": len(jobs),
        "activeJobs": active_count,
        "unknownStatusJobs": len(jobs) - active_count
    }
