import os
import io
import logging

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

def parse_resume_file(file_path: str = None, file_bytes: bytes = None, filename: str = "") -> str:
    """
    Parses plain text from uploaded PDF or DOCX file safely.
    """
    if file_bytes is None and file_path and os.path.exists(file_path):
        if os.path.getsize(file_path) > MAX_FILE_SIZE_BYTES:
            raise ValueError("File size exceeds 10MB limit.")
        with open(file_path, "rb") as f:
            file_bytes = f.read()

    if not file_bytes:
        raise ValueError("No file content provided.")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError("File size exceeds 10MB limit.")

    ext = os.path.splitext(filename)[1].lower() if filename else ""
    if not ext and file_path:
        ext = os.path.splitext(file_path)[1].lower()

    extracted_text = ""

    # 1. Try PDF parsing
    if ext == ".pdf" or file_bytes.startswith(b"%PDF"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        except Exception as e:
            logger.warning(f"pypdf extraction failed, trying pdfplumber: {e}")
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            extracted_text += text + "\n"
            except Exception as e2:
                logger.error(f"pdfplumber extraction failed: {e2}")

    # 2. Try DOCX parsing
    elif ext in [".docx", ".doc"]:
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text]
            extracted_text = "\n".join(paragraphs)
        except Exception as e:
            logger.error(f"python-docx extraction failed: {e}")

    # Fallback UTF-8 text decoding
    if not extracted_text.strip():
        try:
            extracted_text = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            extracted_text = ""

    return extracted_text.strip()
