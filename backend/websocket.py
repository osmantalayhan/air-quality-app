from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import json
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Tüm bağlı istemcilere mesaj gönderir"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                self.disconnect(connection)

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Belirli bir istemciye mesaj gönderir"""
        try:
            await websocket.send_json(message)
        except WebSocketDisconnect:
            self.disconnect(websocket)

# WebSocket manager instance
ws_manager = WebSocketManager()

async def websocket_endpoint(websocket: WebSocket):
    """WebSocket bağlantılarını yönetir"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # İstemciden gelen mesajları dinle
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # İstemci mesajlarını işle (gerekirse)
                if message.get('type') == 'subscribe':
                    # Belirli bir bölgeye abone olma
                    pass
                elif message.get('type') == 'unsubscribe':
                    # Abonelikten çıkma
                    pass
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket) 