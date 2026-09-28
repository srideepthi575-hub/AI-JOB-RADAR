import re
from typing import List, Dict, Any, Tuple

def generate_dedup_keys(job: Dict[str, Any]) -> Tuple[str, str]:
    # Primary Key
    source = str(job.get("source", "")).strip().lower()
    source_job_id = str(job.get("sourceJobId", "")).strip().lower()
    primary_key = f"{source}_{source_job_id}" if source_job_id and source_job_id != "not specified" else ""

    # Fallback Key
    company = re.sub(r'\W+', '', str(job.get("company", "")).lower())
    title = re.sub(r'\W+', '', str(job.get("title", "")).lower())
    location = re.sub(r'\W+', '', str(job.get("location", "")).lower())
    url = str(job.get("sourceUrl", "")).strip().lower()
    fallback_key = f"{company}_{title}_{location}_{url}"

    return primary_key, fallback_key

def deduplicateJobs(jobs: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    """
    Removes duplicate jobs and merges source attributes (`foundOn`).
    Returns (unique_jobs, duplicate_count).
    """
    unique_map: Dict[str, Dict[str, Any]] = {}
    fallback_map: Dict[str, str] = {}
    duplicate_count = 0

    for job in jobs:
        primary_key, fallback_key = generate_dedup_keys(job)
        existing_id = None

        if primary_key and primary_key in unique_map:
            existing_id = primary_key
        elif fallback_key and fallback_key in fallback_map:
            existing_id = fallback_map[fallback_key]

        if existing_id and existing_id in unique_map:
            # Duplicate found! Merge sources
            duplicate_count += 1
            existing_job = unique_map[existing_id]
            curr_sources = set(existing_job.get("foundOn", [existing_job.get("source")]))
            curr_sources.add(job.get("source"))
            existing_job["foundOn"] = sorted(list(curr_sources))
        else:
            # New unique job
            job_id = primary_key or job["id"]
            job["foundOn"] = [job.get("source")]
            unique_map[job_id] = job
            if fallback_key:
                fallback_map[fallback_key] = job_id

    return list(unique_map.values()), duplicate_count
