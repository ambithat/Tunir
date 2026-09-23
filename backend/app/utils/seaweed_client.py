import asyncio
from datetime import datetime
import os
from pathlib import Path
from typing import Optional
import requests
from fastapi import UploadFile, HTTPException, status
from app.core.config import SEAWEEDFS_FILER_URL
from app.config import settings


def _get_local_volume_path(relative_path: str) -> Path:
    base_dir = Path(settings.UPLOAD_BASE_DIR)
    clean_path = relative_path.lstrip("/\\")
    full_path = base_dir / clean_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    return full_path


def generate_seaweed_path(
    filename: str,
    bucket_name: str = "startai",
    folder_name: str = "proposal_sent",
    sub_folder: Optional[str] = None
) -> str:
    """
    Generates a structured storage path:
    startai/proposal_sent/proposal_type/year/month/day/week/hour/min/second/filename
    """
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    week = f"week_{now.strftime('%V')}"
    hour = now.strftime("%H")
    minute = now.strftime("%M")
    second = now.strftime("%S")

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


async def upload_file_to_seaweed(
    file: UploadFile,
    bucket_name: str = "startai",
    folder_name: str = "proposal_sent",
    sub_folder: Optional[str] = None
) -> dict:
    """
    Uploads an UploadFile to persistent volume storage and/or SeaweedFS.
    Guarantees persistence to Railway volume at UPLOAD_BASE_DIR.
    """
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

        filename = file.filename or "uploaded_file"
        relative_path = generate_seaweed_path(
            filename=filename,
            bucket_name=bucket_name,
            folder_name=folder_name,
            sub_folder=sub_folder
        )

        # 1. Always save to local volume (/data/uploads)
        local_path = _get_local_volume_path(relative_path)
        with open(local_path, "wb") as f:
            f.write(file_bytes)

        file_url = f"/static/uploads/{relative_path}"

        # 2. If valid remote SeaweedFS URL is provided, also push to SeaweedFS
        filer_url = (SEAWEEDFS_FILER_URL or "").strip()
        if filer_url.startswith(("http://", "https://")) and "starai.local" not in filer_url:
            try:
                upload_url = f"{filer_url.rstrip('/')}/buckets/{relative_path}"

                def _perform_upload():
                    return requests.post(
                        upload_url,
                        files={"file": (filename, file_bytes, file.content_type or "application/octet-stream")},
                        timeout=5.0
                    )

                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, _perform_upload)
                if response.status_code in (200, 201):
                    file_url = upload_url
            except Exception as e:
                print(f"[SeaweedFS Warning] Remote sync skipped, saved to volume: {e}")

        return {
            "message": "File uploaded successfully",
            "file_url": file_url,
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
    Uploads raw file bytes to volume storage and/or SeaweedFS.
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

        # Save to local volume
        local_path = _get_local_volume_path(relative_path)
        with open(local_path, "wb") as f:
            f.write(file_bytes)

        file_url = f"/static/uploads/{relative_path}"

        filer_url = (SEAWEEDFS_FILER_URL or "").strip()
        if filer_url.startswith(("http://", "https://")) and "starai.local" not in filer_url:
            try:
                upload_url = f"{filer_url.rstrip('/')}/buckets/{relative_path}"

                def _perform_upload():
                    return requests.post(
                        upload_url,
                        files={"file": (clean_filename, file_bytes, "application/pdf")},
                        timeout=5.0
                    )

                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, _perform_upload)
                if response.status_code in (200, 201):
                    file_url = upload_url
            except Exception as e:
                print(f"[SeaweedFS Warning] Remote sync skipped: {e}")

        return {
            "message": "File uploaded successfully",
            "file_url": file_url,
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

        # 1. Check local persistent volume first
        local_path = _get_local_volume_path(relative_path)
        if local_path.exists() and local_path.is_file():
            return local_path.read_bytes()

        # 2. Check SeaweedFS if configured
        filer_url = (SEAWEEDFS_FILER_URL or "").strip()
        if filer_url.startswith(("http://", "https://")):
            download_url = f"{filer_url.rstrip('/')}/buckets/{relative_path}"

            def _perform_download():
                return requests.get(download_url, timeout=10.0)

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, _perform_download)
            if response.status_code in (200, 201):
                return response.content

        raise FileNotFoundError(f"File not found at path: {relative_path}")

    except Exception as e:
        raise RuntimeError(f"Error downloading file: {str(e)}")

