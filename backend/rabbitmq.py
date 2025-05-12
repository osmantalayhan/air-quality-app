import aio_pika
import json
from typing import Dict, Any
import asyncio
from datetime import datetime

class RabbitMQManager:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.connection = None
        self.channel = None
        self.queues = {}

    async def connect(self):
        """RabbitMQ bağlantısını kurar"""
        self.connection = await aio_pika.connect_robust(self.connection_string)
        self.channel = await self.connection.channel()
        
        # Kuyrukları tanımla
        self.queues = {
            'air_quality_data': await self.channel.declare_queue('air_quality_data', durable=True),
            'anomalies': await self.channel.declare_queue('anomalies', durable=True),
            'notifications': await self.channel.declare_queue('notifications', durable=True)
        }

    async def publish_air_quality_data(self, data: Dict[str, Any]):
        """Hava kalitesi verilerini kuyruğa gönderir"""
        message = aio_pika.Message(
            body=json.dumps(data).encode(),
            content_type='application/json',
            timestamp=datetime.utcnow()
        )
        await self.channel.default_exchange.publish(
            message,
            routing_key='air_quality_data'
        )

    async def publish_anomaly(self, anomaly: Dict[str, Any]):
        """Anomali verilerini kuyruğa gönderir"""
        message = aio_pika.Message(
            body=json.dumps(anomaly).encode(),
            content_type='application/json',
            timestamp=datetime.utcnow()
        )
        await self.channel.default_exchange.publish(
            message,
            routing_key='anomalies'
        )

    async def publish_notification(self, notification: Dict[str, Any]):
        """Bildirimleri kuyruğa gönderir"""
        message = aio_pika.Message(
            body=json.dumps(notification).encode(),
            content_type='application/json',
            timestamp=datetime.utcnow()
        )
        await self.channel.default_exchange.publish(
            message,
            routing_key='notifications'
        )

    async def consume_air_quality_data(self, callback):
        """Hava kalitesi verilerini dinler"""
        await self.queues['air_quality_data'].consume(callback)

    async def consume_anomalies(self, callback):
        """Anomali verilerini dinler"""
        await self.queues['anomalies'].consume(callback)

    async def consume_notifications(self, callback):
        """Bildirimleri dinler"""
        await self.queues['notifications'].consume(callback)

    async def close(self):
        """Bağlantıyı kapatır"""
        if self.connection:
            await self.connection.close() 