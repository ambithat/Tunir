class TrackingSkeletonService:
    """Skeleton Service for Tracking"""
    def __init__(self, repo):
        self.repo = repo

    async def create_item(self, payload):
        pass

    async def get_item_by_id(self, item_id: str):
        pass

    async def get_all_items(self, limit: int = 10, cursor: str = None):
        pass
