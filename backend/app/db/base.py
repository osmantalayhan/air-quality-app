# Import all the models, so that Base has them before being imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.anomaly import Anomaly  # noqa
from app.models.measurement import Measurement  # noqa 