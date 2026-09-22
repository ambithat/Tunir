import asyncio
from datetime import datetime
import os
import logging
from typing import Optional
import requests
from fastapi import UploadFile, HTTPException, status
from app.core.config import SEAWEEDFS_FILER_URL

logger = logging.getLogger("uvicorn.error")

UPLOAD_BASE_DIR = os.getenv("UPLOAD_BASE_DIR", "/data/uploads")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")


def is_local_storage_mode() -> bool:
    url = (SEAWEEDFS_FILER_URL or "").lower().strip()
    return (
        url in ("local", "none", "", "disabled", "false")
        or os.getenv("USE_LOCAL_STORAGE", "false").lower() == "true"
        or not url.startswith("http")
    )


def save_file_locally(file_bytes: bytes, relative_path: str) -> str:
    full_path = os.path.join(UPLOAD_BASE_DIR, relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(file_bytes)
    url_path = f"/static/uploads/{relative_path}"
    return f"{PUBLIC_BASE_URL}{url_path}" if PUBLIC_BASE_URL else url_path


def read_file_locally(relative_path: str) -> Optional[bytes]:
    # Clean relative_path if it contains prefixes
    clean_path = relative_path
    for prefix in ["/static/uploads/", "static/uploads/", "/buckets/", "buckets/"]:
        if clean_path.startswith(prefix):
            clean_path = clean_path[len(prefix):]
    
    full_path = os.path.join(UPLOAD_BASE_DIR, clean_path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        with open(full_path, "rb") as f:
            return f.read()
    return None


def generate_seaweed_path(
    filename: str,
    bucket_name: str = "startai",
    folder_name: str = "proposal_sent",
    sub_folder: Optional[str] = None
) -> str:
    """
    Generates a structured storage path:
    startai/proposal_sent/proposal_type/year/month/day/week/hour/min/second/filename

    Example:
    startai/proposal_sent/Technical_Proposal_Sent/2026/08/19/week_34/12/42/22/doc.pdf
    """
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    week = f"week_{now.strftime('%V')}"  # ISO week number
    hour = now.strftime("%H")
    minute = now.strftime("%M")
    second = now.strftime("%S")

    # Sanitize inputs
    clean_bucket = bucket_name.strip("/").replace(" ", "_")
    if clean_bucket.startswith("buckets/"):
        clean_bucket = clean_bucket[len("buckets/"):]

    clean_folder = folder_name.strip("/").replace(" ", "_") if folder_name else ""
    clean_subfolder = sub_folder.strip("/").replace(" ", "_") if sub_folder else ""
    clean_filename = os.path.basename(filename).replace(" ", "_")

    path_parts = [clean_bucket]
    if clean_folder:
        path_parts.append(clean_folder)
    if clean_subfolder:
        path_parts.append(clean_subfolder)

    path_parts.extend([year, month, day, week, hour, minute, second, clean_filename])
    return "/".join(path_parts)


ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

async def upload_file_to_seaweed(
    file: UploadFile,
    bucket_name: str = "startai",
    folder_name: str = "proposal_sent",
    sub_folder: Optional[str] = None
) -> dict:
    """
    Uploads an UploadFile directly to SeaweedFS Filer or local disk volume under specified bucket structure.
    Returns file_url and db_path starting from bucket name.
    """
    try:
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"File type '{file.content_type}' is not allowed."
            )
            
        file_bytes = await file.read()
        
        if not file_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
            
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, 
                detail="File size exceeds the 20MB limit."
            )

        filename = file.filename or "uploaded_file"
        relative_path = generate_seaweed_path(
            filename=filename,
            bucket_name=bucket_name,
            folder_name=folder_name,
            sub_folder=sub_folder
        )

        if is_local_storage_mode():
            file_url = save_file_locally(file_bytes, relative_path)
            logger.info(f"Saved file to local storage volume: {file_url}")
            return {
                "message": "File saved to local storage volume successfully",
                "file_url": file_url,
                "relative_path": relative_path,
                "db_path": relative_path,
                "bucket_path": f"static/uploads/{relative_path}",
                "bucket_name": bucket_name,
                "filename": filename,
                "content_type": file.content_type,
                "size_bytes": len(file_bytes)
            }

        upload_url = f"{SEAWEEDFS_FILER_URL.rstrip('/')}/buckets/{relative_path}"

        def _perform_upload():
            response = requests.post(
                upload_url,
                files={"file": (filename, file_bytes, file.content_type or "application/octet-stream")},
                timeout=15.0
            )
            return response

        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(None, _perform_upload)
            if response.status_code not in (200, 201):
                raise RuntimeError(f"SeaweedFS upload failed with status {response.status_code}: {response.text}")
        except Exception as http_err:
            logger.warning(f"SeaweedFS HTTP upload failed ({http_err}). Falling back to local storage volume.")
            file_url = save_file_locally(file_bytes, relative_path)
            upload_url = file_url

        return {
            "message": "File uploaded successfully",
            "file_url": upload_url,
            "relative_path": relative_path,
            "db_path": relative_path,
            "bucket_path": f"buckets/{relative_path}",
            "bucket_name": bucket_name,
            "filename": filename,
            "content_type": file.content_type,
            "size_bytes": len(file_bytes)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {str(e)}"
        )


async def upload_bytes_to_seaweed(
    file_bytes: bytes,
    filename: str,
    bucket_name: str = "startai",
    folder_name: str = "weekly_reports",
    sub_folder: Optional[str] = None
) -> dict:
    """
    Uploads raw file bytes directly to SeaweedFS Filer or local volume.
    Returns file_url and upload metadata dict.
    """
    try:
        if not file_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File bytes are empty")

        clean_filename = filename or "weekly_report.pdf"
        relative_path = generate_seaweed_path(
            filename=clean_filename,
            bucket_name=bucket_name,
            folder_name=folder_name,
            sub_folder=sub_folder
        )

        if is_local_storage_mode():
            file_url = save_file_locally(file_bytes, relative_path)
            logger.info(f"Saved bytes to local storage volume: {file_url}")
            return {
                "message": "File saved to local storage volume successfully",
                "file_url": file_url,
                "relative_path": relative_path,
                "db_path": relative_path,
                "bucket_path": f"static/uploads/{relative_path}",
                "bucket_name": bucket_name,
                "filename": clean_filename,
                "content_type": "application/pdf",
                "size_bytes": len(file_bytes)
            }

        upload_url = f"{SEAWEEDFS_FILER_URL.rstrip('/')}/buckets/{relative_path}"

        def _perform_upload():
            response = requests.post(
                upload_url,
                files={"file": (clean_filename, file_bytes, "application/pdf")},
                timeout=15.0
            )
            return response

        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(None, _perform_upload)
            if response.status_code not in (200, 201):
                raise RuntimeError(f"SeaweedFS upload failed with status {response.status_code}: {response.text}")
        except Exception as http_err:
            logger.warning(f"SeaweedFS HTTP upload failed ({http_err}). Falling back to local storage volume.")
            file_url = save_file_locally(file_bytes, relative_path)
            upload_url = file_url

        return {
            "message": "File uploaded successfully",
            "file_url": upload_url,
            "relative_path": relative_path,
            "db_path": relative_path,
            "bucket_path": f"buckets/{relative_path}",
            "bucket_name": bucket_name,
            "filename": clean_filename,
            "content_type": "application/pdf",
            "size_bytes": len(file_bytes)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading bytes: {str(e)}"
        )


async def download_file_from_seaweed(relative_path: str) -> bytes:
    """
    Downloads file bytes from local volume storage or SeaweedFS.
    """
    try:
        if not relative_path:
            raise ValueError("relative_path cannot be empty")

        # Check local disk first
        local_bytes = read_file_locally(relative_path)
        if local_bytes is not None:
            return local_bytes

        if is_local_storage_mode():
            raise FileNotFoundError(f"Local file not found at relative path: {relative_path}")
            
        download_url = f"{SEAWEEDFS_FILER_URL.rstrip('/')}/buckets/{relative_path}"

        def _perform_download():
            response = requests.get(download_url, timeout=15.0)
            return response

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _perform_download)

        if response.status_code not in (200, 201):
            raise RuntimeError(f"SeaweedFS download failed with status {response.status_code}: {response.text}")

        return response.content
        
    except Exception as e:
        raise RuntimeError(f"Error downloading file: {str(e)}")

