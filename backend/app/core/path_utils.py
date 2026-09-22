import os
import re
from pathlib import Path
import shutil
from uuid import UUID
from typing import Union
from app.config import settings as global_setting


def get_db_storage_paths(user_id: Union[str, UUID], db_display_name: str):
    """
    Returns a dictionary of Path objects.
    Structure:
      BASE_DIR / <user_id> / user_db_schema / <prefix>_schema.sql
      BASE_DIR / <user_id> / user_db_chunks / <prefix>_chunks (Directory)
      BASE_DIR / <user_id> / user_db_vector / <prefix>_faiss_index (Directory)
    """
    try:
      # 1. Sanitize name
      safe_name = re.sub(r'[^a-zA-Z0-9]', '_', db_display_name).lower()
      
      # 2. Define the Unique Prefix (user_id + safe_name)
      unique_prefix = f"{user_id}_{safe_name}"

      # 3. Base Directory for this User
      # Use the computed_field property which returns a Path object (cross-platform compatible)
      user_db_dir = global_setting.base_storage_dir_path / str(user_id)
      # OLD CODE (commented):
      # user_db_dir = Path(global_setting.BASE_STORAGE_DIR) / str(user_id)
      
      # 4. Define the 3 Main Sub-Folders
      # Use the '/' operator. It handles OS separators correctly.
      chunks_base_dir = user_db_dir / "user_db_chunks"
      schema_base_dir = user_db_dir / "user_db_schema"
      vector_base_dir = user_db_dir / "user_db_vector" # Fixed spelling: vecotre -> vector
      
      # 5. Create the Category Directories
      # These hold all schemas/chunks for this user
      # Using Path.mkdir() for cross-platform compatibility
      chunks_base_dir.mkdir(parents=True, exist_ok=True)
      schema_base_dir.mkdir(parents=True, exist_ok=True)
      vector_base_dir.mkdir(parents=True, exist_ok=True)
      # OLD CODE (commented):
      # os.makedirs(chunks_base_dir, exist_ok=True)
      # os.makedirs(schema_base_dir, exist_ok=True)
      # os.makedirs(vector_base_dir, exist_ok=True)

      # 6. Define the SPECIFIC leaf paths for this specific database connection
      target_schema_file = schema_base_dir / f"{unique_prefix}_schema.sql"
      target_chunks_folder = chunks_base_dir / f"{unique_prefix}_chunks"
      target_vector_folder = vector_base_dir / f"{unique_prefix}_faiss_index"
      target_value_vector_folder = vector_base_dir / f"{unique_prefix}_value_faiss_index"

      # 7. Create the specific folders for Chunks and Vectors
      # (Schema is a file, so we don't make a dir for it, just the parent)
      # Using Path.mkdir() for cross-platform compatibility
      target_chunks_folder.mkdir(parents=True, exist_ok=True)
      target_vector_folder.mkdir(parents=True, exist_ok=True)
      target_value_vector_folder.mkdir(parents=True, exist_ok=True)
      # OLD CODE (commented):
      # os.makedirs(target_chunks_folder, exist_ok=True)
      # os.makedirs(target_vector_folder, exist_ok=True)

      # 8. Return Path objects (Cleaner for cleanup logic)
      return {
          "schema_file": target_schema_file,
          "chunks_dir": target_chunks_folder,
          "vector_store": target_vector_folder,
          "value_vector_store": target_value_vector_folder
      }
    except Exception as e:
       print(f"An exception occured at get_db_storage_paths and error is {e}")


def delete_db_storage(user_id: Union[str, UUID], db_display_name: str):
    """
    Checks if schema file, chunks directory, and vector index exist for 
     a specific database connection and deletes them.
    """
    try:
        # 1. Get the paths using the existing logic
        paths = get_db_storage_paths(user_id, db_display_name)
        
        if not paths:
            print("Could not determine storage paths.")
            return False

        schema_file = paths["schema_file"]
        chunks_dir = paths["chunks_dir"]
        vector_dir = paths["vector_store"]

        # 2. Delete Schema File
        if schema_file.exists():
            schema_file.unlink() # Deletes the file
            print(f"Deleted schema file: {schema_file}")

        # 3. Delete Chunks Directory (and all its contents)
        if chunks_dir.exists() and chunks_dir.is_dir():
            shutil.rmtree(chunks_dir)
            print(f"Deleted chunks directory: {chunks_dir}")

        # 4. Delete Vector Store Directory (and all its contents)
        if vector_dir.exists() and vector_dir.is_dir():
            shutil.rmtree(vector_dir)
            print(f"Deleted vector directory: {vector_dir}")

        return True

    except Exception as e:
        print(f"An error occurred while deleting storage for {db_display_name}: {e}")
        return False