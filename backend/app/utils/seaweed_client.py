import asyncio
from datetime import datetime
import os
from typing import Optional
import requests
from fastapi import UploadFile, HTTPException, status
from app.core.config import SEAWEEDFS_FILER_URL


def generate_seaweed_path(
    filename: str,
    bucket_name: str = "startai",
    folder_name: str = "proposal_sent",
    sub_folder: Optional[str] = None
) -> str:
    """
    Generates a structured SeaweedFS storage path:
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
    Uploads an UploadFile directly to SeaweedFS Filer under specified bucket, folder, sub-folder and time path structure.
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
        upload_url = f"{SEAWEEDFS_FILER_URL.rstrip('/')}/buckets/{relative_path}"

        def _perform_upload():
            response = requests.post(
                upload_url,
                files={"file": (filename, file_bytes, file.content_type or "application/octet-stream")},
                timeout=15.0
            )
            return response

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _perform_upload)

        if response.status_code not in (200, 201):
            raise RuntimeError(f"SeaweedFS upload failed with status {response.status_code}: {response.text}")

        return {
            "message": "File uploaded to SeaweedFS successfully",
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
            detail=f"Error uploading file to SeaweedFS: {str(e)}"
        )


async def upload_bytes_to_seaweed(
    file_bytes: bytes,
    filename: str,
    bucket_name: str = "startai",
    folder_name: str = "weekly_reports",
    sub_folder: Optional[str] = None
) -> dict:
    """
    Uploads raw file bytes directly to SeaweedFS Filer under specified bucket, folder, and time structure.
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
        upload_url = f"{SEAWEEDFS_FILER_URL.rstrip('/')}/buckets/{relative_path}"

        def _perform_upload():
            response = requests.post(
                upload_url,
                files={"file": (clean_filename, file_bytes, "application/pdf")},
                timeout=15.0
            )
            return response

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _perform_upload)

        if response.status_code not in (200, 201):
            raise RuntimeError(f"SeaweedFS upload failed with status {response.status_code}: {response.text}")

        return {
            "message": "File uploaded to SeaweedFS successfully",
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
            detail=f"Error uploading bytes to SeaweedFS: {str(e)}"
        )


async def download_file_from_seaweed(relative_path: str) -> bytes:
    """
    Downloads file bytes from SeaweedFS using the relative path.
    """
    try:
        if not relative_path:
            raise ValueError("relative_path cannot be empty")
            
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
        raise RuntimeError(f"Error downloading from SeaweedFS: {str(e)}")
