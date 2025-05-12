import pika
import json
import logging
import os
from typing import Dict, Any, Optional, Callable
import asyncio
from functools import partial

logger = logging.getLogger(__name__)

class RabbitMQClient:
    """RabbitMQ istemcisi - API'den getirilen hava kalitesi verilerini kuyruğa alan ve işleyen bir sınıf."""
    
    def __init__(self, rabbitmq_url: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")):
        """RabbitMQ bağlantısını ve kanallarını başlatır"""
        self.connection = None
        self.channel = None
        self.rabbitmq_url = rabbitmq_url
        self.connected = False
        self.exchange_name = "air_quality"
        
        # Kuyruk adları
        self.queues = {
            "sensor_data": "air_quality_sensor_data",
            "alerts": "air_quality_alerts",
            "processing": "air_quality_processing"
        }
    
    async def connect(self):
        """RabbitMQ'ya asenkron bağlantı kurma"""
        if self.connected:
            return
        
        try:
            # ConnectionParameters nesnesi oluştur
            # Not: RabbitMQ bağlantısı aslında bloke edici bir işlemdir, bu yüzden loop.run_in_executor kullanılır
            connection_params = pika.URLParameters(self.rabbitmq_url)
            
            # Bağlantıyı başka bir thread'de oluştur (bloke etmemesi için)
            loop = asyncio.get_event_loop()
            self.connection = await loop.run_in_executor(
                None, lambda: pika.BlockingConnection(connection_params)
            )
            
            self.channel = await loop.run_in_executor(
                None, lambda: self.connection.channel()
            )
            
            # Exchange oluştur - 'topic' türünde olacak şekilde
            await loop.run_in_executor(
                None, lambda: self.channel.exchange_declare(
                    exchange=self.exchange_name,
                    exchange_type='topic',
                    durable=True
                )
            )
            
            # Kuyrukları oluştur
            for queue_name in self.queues.values():
                await loop.run_in_executor(
                    None, lambda qn=queue_name: self.channel.queue_declare(
                        queue=qn,
                        durable=True
                    )
                )
            
            # Kuyruk bağlantılarını yap
            routing_keys = {
                self.queues["sensor_data"]: "sensor.data.#",
                self.queues["alerts"]: "alert.#",
                self.queues["processing"]: "processing.#"
            }
            
            for queue_name, routing_key in routing_keys.items():
                await loop.run_in_executor(
                    None, lambda qn=queue_name, rk=routing_key: self.channel.queue_bind(
                        exchange=self.exchange_name,
                        queue=qn,
                        routing_key=rk
                    )
                )
            
            self.connected = True
            logger.info("RabbitMQ'ya başarıyla bağlanıldı")
        
        except Exception as e:
            logger.error(f"RabbitMQ bağlantı hatası: {str(e)}")
            self.connected = False
            # Bir süre bekleyip yeniden bağlanma mantığı eklenebilir
            await asyncio.sleep(5)
            await self.connect()
    
    async def publish_message(self, routing_key: str, message: Dict[str, Any]):
        """Mesajı belirtilen routing key ile RabbitMQ'ya gönderir"""
        if not self.connected:
            await self.connect()
        
        try:
            # JSON'a dönüştür
            message_json = json.dumps(message)
            
            # Başka bir thread'de publish işlemini gerçekleştir
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, lambda: self.channel.basic_publish(
                    exchange=self.exchange_name,
                    routing_key=routing_key,
                    body=message_json,
                    properties=pika.BasicProperties(
                        delivery_mode=2,  # Kalıcı mesaj yapma
                        content_type='application/json'
                    )
                )
            )
            
            logger.debug(f"Mesaj başarıyla yayınlandı: {routing_key}")
            return True
        
        except Exception as e:
            logger.error(f"Mesaj yayınlama hatası: {str(e)}")
            self.connected = False
            return False
    
    async def publish_sensor_data(self, sensor_data: Dict[str, Any]):
        """Sensör verilerini sensor.data.{şehir_adı} routing key'i ile yayınlar"""
        location = sensor_data.get("location", "unknown").lower().replace(" ", "_")
        routing_key = f"sensor.data.{location}"
        return await self.publish_message(routing_key, sensor_data)
    
    async def publish_alert(self, alert_data: Dict[str, Any]):
        """Uyarı mesajını alert.{şehir_adı} routing key'i ile yayınlar"""
        location = alert_data.get("location", "unknown").lower().replace(" ", "_")
        alert_type = alert_data.get("type", "general")
        routing_key = f"alert.{location}.{alert_type}"
        return await self.publish_message(routing_key, alert_data)
    
    async def consume_messages(self, queue_name: str, callback: Callable):
        """Belirtilen kuyruktan mesajları dinler ve işler"""
        if not self.connected:
            await self.connect()
        
        if queue_name not in self.queues.values():
            raise ValueError(f"Geçersiz kuyruk adı: {queue_name}")
        
        try:
            # Callback fonksiyonunu sarmala
            def wrapped_callback(ch, method, properties, body):
                try:
                    message = json.loads(body)
                    # Mesajı işlemek için bir yardımcı fonksiyon
                    def process_message():
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        try:
                            loop.run_until_complete(callback(message))
                        except Exception as e:
                            logger.error(f"Mesaj işleme hatası: {str(e)}")
                        finally:
                            loop.close()
                    
                    # Yeni bir thread oluştur ve mesajı işle
                    import threading
                    thread = threading.Thread(target=process_message)
                    thread.daemon = True
                    thread.start()
                except Exception as e:
                    logger.error(f"Mesaj işleme hatası: {str(e)}")
                finally:
                    ch.basic_ack(delivery_tag=method.delivery_tag)
            
            # Başka bir thread'de tüketme işlemini başlat
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, lambda: self.channel.basic_consume(
                    queue=queue_name,
                    on_message_callback=wrapped_callback
                )
            )
            
            logger.info(f"{queue_name} kuyruğundan mesajlar dinleniyor")
            
        except Exception as e:
            logger.error(f"Mesaj tüketme hatası: {str(e)}")
            self.connected = False
    
    async def start_consuming(self):
        """Mesaj tüketimini başlatır"""
        if not self.connected:
            await self.connect()
        
        loop = asyncio.get_event_loop()
        try:
            # Bu metod bloke eder, başka bir thread'de çalıştırılmalı
            await loop.run_in_executor(
                None, lambda: self.channel.start_consuming()
            )
        except Exception as e:
            logger.error(f"Mesaj tüketimi başlatma hatası: {str(e)}")
            self.connected = False
    
    async def close(self):
        """RabbitMQ bağlantısını kapatır"""
        if self.connected and self.connection:
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, lambda: self.connection.close())
                self.connected = False
                logger.info("RabbitMQ bağlantısı kapatıldı")
            except Exception as e:
                logger.error(f"Bağlantı kapatma hatası: {str(e)}") 