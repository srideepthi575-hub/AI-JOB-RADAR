import urllib.parse
from typing import Dict, Any, Tuple

def validateJob(job: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validates normalized job record against core constraints.
    Returns (is_valid, error_reason).
    """
    if not isinstance(job, dict):
        return False, "Job is not a valid dictionary."

    title = str(job.get("title", "")).strip()
    if not title or title.lower() in ["not specified", "unknown", "none", "null"]:
        return False, "Job title is missing or invalid."

    company = str(job.get("company", "")).strip()
    if not company or company.lower() in ["unknown", "none", "null"]:
        return False, "Company name is missing or invalid."

    source = str(job.get("source", "")).strip()
    if not source:
        return False, "Job source is missing."

    source_url = str(job.get("sourceUrl", "")).strip()
    if not source_url or source_url == "#":
        return False, "Source URL is missing or empty."

    try:
        parsed = urllib.parse.urlparse(source_url)
        if parsed.scheme not in ["http", "https"]:
            return False, f"Invalid URL scheme: {parsed.scheme}"
        if not parsed.netloc:
            return False, "URL netloc is missing."
    except Exception as e:
        return False, f"Malformed URL: {e}"

    return True, "Valid"
