class TrackerNotFound(Exception):
    """Base exception for tracker-related errors."""
    pass
class TrackerHistoryNotFound(Exception):
    """Exception raised when tracker history is not found."""
    pass