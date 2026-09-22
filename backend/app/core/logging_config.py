import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
import structlog
from rich.logging import RichHandler
from rich.console import Console
from app.config import settings as global_settings

def setup_logging():
    """Configure structlog and standard logging with Rich console output and Rotating File handlers."""
    # Ensure log directories exist
    error_path = Path(global_settings.LOG_ERROR_FILE_PATH)
    api_path = Path(global_settings.LOG_API_FILE_PATH)

    error_path.parent.mkdir(parents=True, exist_ok=True)
    api_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Define Common Processors
    common_processors = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    # 2. Console Handler with Rich - Use ProcessorFormatter for colors
    console_formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.dev.ConsoleRenderer(colors=True),
        foreign_pre_chain=common_processors,
    )
    
    console_handler = RichHandler(
        rich_tracebacks=True,
        console=Console(force_terminal=True, width=150),
        show_time=False, # structlog provides timestamp
        show_path=False,
        markup=True
    )
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(logging.INFO)

    # 3. File Handler - Use ProcessorFormatter for plain text
    file_formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.LogfmtRenderer(),
        foreign_pre_chain=common_processors,
    )

    api_handler = RotatingFileHandler(
        str(api_path),
        maxBytes=10 * 1024 * 1024,
        backupCount=2,
        encoding="utf-8"
    )
    api_handler.setFormatter(file_formatter)
    api_handler.setLevel(logging.INFO)

    error_handler = RotatingFileHandler(
        str(error_path),
        maxBytes=10 * 1024 * 1024,
        backupCount=2,
        encoding="utf-8"
    )
    error_handler.setFormatter(file_formatter)
    error_handler.setLevel(logging.ERROR)

    # 4. Configure Root Logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Remove existing handlers
    for h in list(root_logger.handlers):
        root_logger.removeHandler(h)
        
    root_logger.addHandler(console_handler)
    root_logger.addHandler(api_handler)
    root_logger.addHandler(error_handler)

    # 5. Route Uvicorn logs through Root Logger + add filter for noisy endpoints
    class SkipNoisyEndpointsFilter(logging.Filter):
        """Filter out noisy SSE/polling endpoint logs from uvicorn.access."""
        SKIP_PATTERNS = ("/api/v1/notifications/stream",)
        
        def filter(self, record):
            msg = record.getMessage() if hasattr(record, 'getMessage') else str(getattr(record, 'msg', ''))
            return not any(pattern in msg for pattern in self.SKIP_PATTERNS)
    
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        uv_logger = logging.getLogger(name)
        uv_logger.handlers = []
        uv_logger.propagate = True
    
    # Apply the filter specifically to uvicorn.access
    logging.getLogger("uvicorn.access").addFilter(SkipNoisyEndpointsFilter())

    # 6. Structlog Global Configuration
    structlog.configure(
        processors=common_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.getLogger("app.core.logging_config").info("[bold green]Logging system initialized with rich colors![/bold green]")

def get_logger(name: str = "app"):
    """Helper to get a logger compatible with structlog stdlib wrapper."""
    return structlog.get_logger(name)