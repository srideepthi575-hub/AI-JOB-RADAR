import os
import sys
import json
import logging
import datetime
from typing import Dict, Any

# Ensure project root is in Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from crawler.sources.registry import SourceRegistry
from crawler.normalize import normalizeJob
from crawler.validate import validateJob
from crawler.deduplicate import deduplicateJobs
from crawler.freshness import update_dataset_freshness

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

TARGET_TERMS = [
    "Software Engineer",
    "Software Developer",
    "Junior Software Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "Python Developer",
    "Java Developer",
    "React Developer",
    "Data Analyst",
    "QA Test Engineer",
    "Software Intern"
]

DATA_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "jobs.json")

def run_crawler() -> Dict[str, Any]:
    print("=" * 60)
    print("Starting Job Radar Crawler Pipeline for CSE/IT Freshers in India...")
    print("=" * 60)

    registry = SourceRegistry()
    raw_jobs = registry.fetch_all(search_terms=TARGET_TERMS, location="India", limit=25)

    valid_normalized_jobs = []
    invalid_count = 0

    for raw in raw_jobs:
        normalized = normalizeJob(raw)
        is_valid, reason = validateJob(normalized)
        
        # Track per-source validation metrics
        source_name = raw.get("source")
        source_obj = registry.sources.get(source_name)
        
        if is_valid:
            valid_normalized_jobs.append(normalized)
            if source_obj:
                source_obj.stats["valid"] += 1
        else:
            invalid_count += 1
            if source_obj:
                source_obj.stats["invalid"] += 1

    # Deduplication
    unique_jobs, duplicate_count = deduplicateJobs(valid_normalized_jobs)

    # Dataset Freshness
    freshness_meta = update_dataset_freshness(unique_jobs)

    # Build Final Storage Payload
    source_statuses = registry.get_source_status()

    output_payload = {
        "metadata": {
            "lastSuccessfulUpdate": freshness_meta["lastSuccessfulUpdate"],
            "totalValidJobs": len(unique_jobs),
            "duplicatesRemoved": duplicate_count,
            "invalidRecords": invalid_count,
            "validationStatus": "PASSED" if len(unique_jobs) > 0 else "NO_JOBS_AVAILABLE",
            "sources": source_statuses
        },
        "jobs": unique_jobs
    }

    # Save to data/jobs.json
    os.makedirs(os.path.dirname(DATA_FILE_PATH), exist_ok=True)
    with open(DATA_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print("CRAWLER EXECUTION SUMMARY")
    print("=" * 60)

    for status in source_statuses:
        status_icon = "[OK]" if status["enabled"] and not status["error"] else "[FAIL]"
        print(f"{status['source']:<22} {status_icon:<6} Fetched: {status['fetched']:<4} Valid: {status['valid']:<4} Error: {status['error'] or 'None'}")

    print("-" * 60)
    print(f"Total Valid Jobs      : {len(unique_jobs)}")
    print(f"Duplicates Removed    : {duplicate_count}")
    print(f"Invalid Records       : {invalid_count}")
    print(f"Data Validation       : {output_payload['metadata']['validationStatus']}")
    print(f"Last Successful Update: {freshness_meta['lastSuccessfulUpdate']}")
    print("=" * 60)

    return output_payload

if __name__ == "__main__":
    run_crawler()
