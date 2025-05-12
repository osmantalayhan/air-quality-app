from typing import List, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                disconnected.append(connection)
            except Exception as e:
                print(f"Error sending message: {e}")
                disconnected.append(connection)
        
        # Bağlantısı kopanları listeden çıkar
        for connection in disconnected:
            self.disconnect(connection)

    async def broadcast_anomaly(self, anomaly: Dict[str, Any], event_type: str = "created"):
        """
        Anomali ile ilgili olayları yayınla
        event_type: created, updated, resolved, closed
        """
        message = {
            "type": "anomaly",
            "event": event_type,
            "data": {
                "id": anomaly.get("id"),
                "title": anomaly.get("title"),
                "description": anomaly.get("description"),
                "severity": str(anomaly.get("severity")),
                "status": str(anomaly.get("status")),
                "source": anomaly.get("source"),
                "timestamp": anomaly.get("timestamp").isoformat() if anomaly.get("timestamp") else None,
                "updated_at": datetime.utcnow().isoformat()
            }
        }
        await self.broadcast(message)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """
        Belirli bir bağlantıya özel mesaj gönder
        """
        try:
            await websocket.send_json(message)
        except WebSocketDisconnect:
            self.disconnect(websocket)
        except Exception as e:
            print(f"Error sending personal message: {e}")
            self.disconnect(websocket)

manager = ConnectionManager() 