import time
from app.core.logging_config import get_logger

logger = get_logger("request_logger")

SKIP_LOG_PATHS = {
    "/api/v1/notifications/stream",
}

class ExceptionLoggingMiddleware:
    """Pure ASGI Middleware for request logging that avoids Starlette BaseHTTPMiddleware
    stream cancellation issues with StreamingResponse (SSE)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in SKIP_LOG_PATHS:
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        method = scope.get("method", "")
        
        # Extract client IP
        headers = dict(scope.get("headers", []))
        client_ip = headers.get(b"x-forwarded-for", b"").decode("utf-8").split(",")[0].strip()
        if not client_ip:
            client = scope.get("client")
            client_ip = client[0] if client else "unknown"

        query_string = scope.get("query_string", b"").decode("utf-8")

        logger.info(
            "Incoming request",
            method=method,
            path=path,
            client=client_ip,
            query_params=query_string
        )

        status_code = 200

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
            process_time = (time.time() - start_time) * 1000
            logger.info(
                "Request completed",
                method=method,
                path=path,
                client=client_ip,
                status_code=status_code,
                duration_ms=f"{process_time:.2f}ms"
            )
        except Exception as exc:
            process_time = (time.time() - start_time) * 1000
            logger.error(
                "Request failed with exception",
                method=method,
                path=path,
                client=client_ip,
                error=str(exc),
                duration_ms=f"{process_time:.2f}ms",
                exc_info=True
            )
            raise exc
