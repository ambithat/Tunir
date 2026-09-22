import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

def user_key_func(request):
    """Rate limit by authenticated user ID if available, otherwise by IP address."""
    try:
        if hasattr(request.state, "employee_id"):
            return str(request.state.employee_id)
        return get_remote_address(request)
    except Exception as e:
        logger.debug(f"Rate limiter key_func fallback to IP: {e}")
        return get_remote_address(request)

# Use "memory://" to store counters in RAM.
# No need for Postgres or Redis.
# Default limit is generous for normal usage — stricter limits are
# applied per-endpoint with @limiter.limit("N/minute") decorators.
limiter = Limiter(
    key_func=user_key_func,
    storage_uri="memory://",
    default_limits=["100/minute"]
)