from typing import List, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from app.core.websocket import manager
from app.api import deps
from app.core import security
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                self.disconnect(connection)

    async def send_personal_message(self, message: Dict, websocket: WebSocket):
        await websocket.send_json(message)

manager = ConnectionManager()

@router.websocket("/")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None),  # Token zorunlu değil
    severity: str = Query(None),
    status: str = Query(None)
):
    """
    WebSocket bağlantısı için endpoint
    Token ile yetkilendirme gerektirmez
    İsteğe bağlı olarak severity ve status filtreleri alabilir
    """
    try:
        # Token kontrolü kaldırıldı
        await manager.connect(websocket)

        # Hoş geldin mesajı
        await manager.send_personal_message({
            "type": "welcome",
            "message": f"Hoş geldiniz! Bağlantı başarıyla kuruldu.",
            "filters": {
                "severity": severity,
                "status": status
            }
        }, websocket)

        try:
            while True:
                try:
                    # İstemciden gelen mesajları metin olarak al
                    text = await websocket.receive_text()
                    try:
                        data = json.loads(text)
                    except Exception:
                        # Geçersiz JSON ise atla
                        continue
                    # İstemciden gelen mesajları işle
                    if data.get("type") == "ping":
                        await manager.send_personal_message({
                            "type": "pong",
                            "timestamp": data.get("timestamp")
                        }, websocket)
                    # Diğer mesaj tipleri buraya eklenebilir...
                except WebSocketDisconnect:
                    manager.disconnect(websocket)
                    break
        except WebSocketDisconnect:
            manager.disconnect(websocket)
            
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close(code=4000, reason="Internal server error")
        except:
            pass 