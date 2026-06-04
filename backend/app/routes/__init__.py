from app.routes.auth_routes import auth_bp
from app.routes.admin_routes import admin_bp
from app.routes.patient_routes import patient_bp
from app.routes.upload_routes import upload_bp

__all__ = ['auth_bp', 'admin_bp', 'patient_bp', 'upload_bp']
