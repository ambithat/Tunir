from app.db.base import get_db

# from app.services.tracker_service import TrackerService,TrackerHistoryService
from app.repositories.tracking.tracker_repository import TrackerRepository,TrackerHistoryRepository

from app.services.tracking.tracker_service import TrackerService,TrackerHistoryService



# from app.services.auth_service import AuthService
# from app.dependency.auth_dependency import get_user_auth
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

async def get_tracker_repo(db:AsyncSession = Depends(get_db)):
    return TrackerRepository(db)



async def get_tracker_service(repo:TrackerRepository = Depends(get_tracker_repo)):
                        #    auth_service:AuthService = Depends(get_user_auth)):
    # return UserService(repo=repo,auth_service=auth_service)
    return TrackerService(tracker_repository=repo)




async def get_tracker_history_repo(db:AsyncSession = Depends(get_db)):
    return TrackerHistoryRepository(db)



async def get_tracker_history_service(repo:TrackerHistoryRepository = Depends(get_tracker_history_repo)):
                        #    auth_service:AuthService = Depends(get_user_auth)):
    # return UserService(repo=repo,auth_service=auth_service)
    return TrackerHistoryService(tracker_history_repository=repo)






    

