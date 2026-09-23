
import uvicorn
import ipaddress
import os
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from slowapi.errors import RateLimitExceeded
from app.core.config import APP_NAME, APP_VERSION
from app.core.events import start_app_handler, stop_app_handler

from app.core.logging_config import setup_logging, get_logger
from app.core.exception_logging_middleware import ExceptionLoggingMiddleware
from app.core.rate_limiter_config import limiter
from app.config import settings as global_setting



# Initialize logging system only when needed
_logging_setup_done = False

def init_app_logging():
    global _logging_setup_done
    if not _logging_setup_done:
        setup_logging()
        _logging_setup_done = True

# This is cheap to call at module level; it will use the config set by init_app_logging later
logger = get_logger("app.main")

# Build CORS allowed origins — reads production URLs from env vars
_cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5001",
    "http://localhost:5002",
    "http://127.0.0.1:3000",
    "http://starai.local:3000",
]
# Add Railway / custom frontend URL from env
_frontend_url = os.getenv("FRONTEND_URL", "").strip()
if _frontend_url:
    _cors_origins.append(_frontend_url)
# Support comma-separated list for multiple URLs
for _extra in os.getenv("EXTRA_CORS_ORIGINS", "").split(","):
    if _extra.strip():
        _cors_origins.append(_extra.strip())

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_origin_regex=r"https?://.*(\.up\.railway\.app|\.vercel\.app|\.netlify\.app|localhost|127\.0\.0\.1).*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    ),
    Middleware(GZipMiddleware, minimum_size=1000),
]

def rate_limit_exceed_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again"}
    )

from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/star_ai/login")

def get_app() -> FastAPI:
    """FastAPI app controller here ...."""
    init_app_logging()
    fast_app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        middleware=middleware,
        swagger_ui_parameters={"persistAuthorization": True}
    )
    fast_app.state.limiter = limiter
    from app.api.routes.routers import api_router
    fast_app.include_router(api_router)
    from fastapi.staticfiles import StaticFiles
    from app.config import settings
    upload_dir = Path(settings.UPLOAD_BASE_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    fast_app.mount("/static/uploads", StaticFiles(directory=str(upload_dir)), name="static_uploads")

    fast_app.add_event_handler("startup", start_app_handler(fast_app))
    fast_app.add_event_handler("shutdown", stop_app_handler())
    from app.core.exception_logging_middleware import ExceptionLoggingMiddleware
    fast_app.add_middleware(ExceptionLoggingMiddleware)
    fast_app.add_exception_handler(RateLimitExceeded, rate_limit_exceed_handler)

    # Register local routes and custom middleware/exception handlers
    @fast_app.get("/")
    async def root():
        logger.info("Root endpoint called")
        return {"message": "Star AI API is running."}

    @fast_app.get("/favicon.ico")
    async def favicon():
        return Response(status_code=204)

    @fast_app.get("/health")
    async def health():
        """Railway health check endpoint."""
        return {"status": "ok", "service": "star-ai-sales"}

    @fast_app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        detail = str(exc).strip()
        logger.error(f"Global exception caught: {detail}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred. Please try again later."}
        )

    @fast_app.middleware("http")
    async def restrict_ip(request: Request, call_next):
        # Set ENABLE_IP_RESTRICTION=true in .env to enforce LAN-only access locally
        # In production (Railway), this MUST be false/unset
        if not os.getenv("ENABLE_IP_RESTRICTION", "false").lower() == "true":
            return await call_next(request)

        if request.method == "OPTIONS":
            return await call_next(request)
        client_ip = request.headers.get("x-forwarded-for")
        if client_ip:
            client_ip = client_ip.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
            
        try:
            ip_obj = ipaddress.ip_address(client_ip)
        except ValueError:
            return await call_next(request)
            
        allowed_networks = [
            ipaddress.ip_network("192.168.1.0/24"),
            ipaddress.ip_network("192.168.0.0/24"),
            ipaddress.ip_network("127.0.0.1/32"),
        ]
        if not any(ip_obj in net for net in allowed_networks):
            logger.warning(f"Unauthorized access attempt from {client_ip} to {request.url.path}")
            return JSONResponse(status_code=403, content={"detail": f"Access forbidden from {client_ip}"})
        return await call_next(request)

    return fast_app


# Remove top-level app creation to save master process memory
# app = get_app()


if __name__ == "__main__":
    init_app_logging()
    logger.info("Starting Star AI server...")

    # Use factory pattern string to defer app creation until inside workers
    '''
    Why use a factory pattern?

        It delays app creation until the worker starts.

        This becomes useful for things like:

        Multiple workers
        Database initialization
        Environment-specific config
        Loading models
        Avoiding import side effects    
            
    '''
    uvicorn.run("app.main:get_app",
                host="0.0.0.0",
                port=8001,
                workers=1,
                factory=True,
                # reload=True,
                reload_excludes=["*.log", "app/logs/*", "logs/*"]
            )

    
'''
2 workers × main_db  (pool_size=10, max_overflow=10) = 40 max
2 workers × llama_db (pool_size=5,  max_overflow=5)  = 20 max
pg_listener raw connections                           =  2
admin/pgAdmin reserve                                 =  5
─────────────────────────────────────────────────────────
Total max                                             = 67
Postgres max_connections                              = 200
Headroom remaining                                    = 133 

'''
