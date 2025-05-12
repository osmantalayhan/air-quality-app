from fastapi import APIRouter
from app.api.v1.endpoints import measurements, anomalies, websocket

api_router = APIRouter()

api_router.include_router(measurements.router, prefix="/measurements", tags=["measurements"])
api_router.include_router(anomalies.router, prefix="/anomalies", tags=["anomalies"])
api_router.include_router(websocket.router, prefix="/ws", tags=["websocket"]) 