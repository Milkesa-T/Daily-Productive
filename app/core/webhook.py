import httpx
import logging 
from typing import Any, Dict
from app.core.config import settings

logger = logging.getLogger(__name__)
def trigger_n8n_webhook(payload: Dict[str, Any]) -> None:
    """
    Sends an event payload to n8n.
    Designed to run as a FastAPI BackgroundTask.
    """
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.post(settings.n8n_webhook_url, json=payload)
            if response.status_code >= 400:
                logger.warning(f"n8n webhook returned status code {response.status_code}: {response.text}")
            else:
                logger.info(f"Successfully triggered n8n webhook: {response.status_code}")
    except httpx.RequestError as exc:
        logger.error(f"Failed to connect to n8n webhook at {settings.n8n_webhook_url}: {exc}")