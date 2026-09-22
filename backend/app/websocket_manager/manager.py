
from fastapi import WebSocket, WebSocketDisconnect, status, HTTPException
from typing import Dict
from app.core.logging_config import get_logger

logger = get_logger()

class ConnectionManager:
    def __init__(self):
        self.active_users: Dict[str, WebSocket] = {}

    async def websocket_connect(self, employee_id: str, websocket: WebSocket):
        try:
            await websocket.accept()
            self.active_users[employee_id] = websocket
            logger.info("WebSocket connected", employee_id=employee_id)
        except Exception as e:
            logger.exception("WebSocket connection failed", employee_id=employee_id)
            await self.close(websocket, employee_id, code=1011, reason="Connection failed")

    async def websocket_disconnect(self, employee_id: str):
        websocket = self.active_users.pop(employee_id, None)
        if websocket:
            await self.close(websocket, employee_id, code=1000, reason="Client disconnected")

    async def send_message(self, employee_id: str, msg: dict):
        websocket = self.active_users.get(employee_id)
        if websocket:
            try:
                await websocket.send_json(msg)
                logger.info("Message sent to user", employee_id=employee_id)
            except Exception as e:
                logger.exception("Error sending message", employee_id=employee_id)
                await self.close(websocket, employee_id, code=1011, reason="Message send error")
        else:
            logger.warning("No active WebSocket found", employee_id=employee_id)

    async def close(self, websocket: WebSocket, employee_id: str, code: int = 1011, reason: str = "Server error"):
        """Safely close WebSocket connection and clean up."""
        try:
            await websocket.close(code=code)
            logger.info("WebSocket closed", employee_id=employee_id, code=code, reason=reason)
        except Exception as e:
            logger.exception("Failed to close WebSocket", employee_id=employee_id)
        finally:
            self.active_users.pop(employee_id, None)



