class TrackingSkeletonRepository:
    """Skeleton Repository for Tracking"""
    def __init__(self, session):
        self.session = session

    async def create(self, obj):
        pass

    async def get_by_id(self, obj_id: str):
        pass

    async def get_all(self, limit: int = 10, cursor: str = None):
        pass
