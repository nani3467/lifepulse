from datetime import datetime
from app import db


class PredictionRecord(db.Model):
    __tablename__ = 'prediction_records'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True, index=True)

    # Input features
    fever = db.Column(db.Float, nullable=False)  # temperature in °F
    cough = db.Column(db.Boolean, nullable=False)
    oxygen_level = db.Column(db.Integer, nullable=False)  # SpO2 %
    systolic_bp = db.Column(db.Integer, nullable=False)
    diastolic_bp = db.Column(db.Integer, nullable=False)
    sugar_level = db.Column(db.Integer, nullable=False)  # fasting mg/dL
    symptoms = db.Column(db.Text, nullable=True)  # Comma-separated list of symptoms

    # ML Output
    model_used = db.Column(db.String(50), nullable=False)  # Random Forest, Decision Tree, XGBoost
    predicted_disease = db.Column(db.String(200), nullable=False)
    confidence = db.Column(db.Float, nullable=False)  # Percentage (e.g. 85.5)
    risk_level = db.Column(db.Enum('low', 'medium', 'high', name='risk_level_types'), nullable=False, default='low')
    recommended_dept = db.Column(db.String(100), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Relationship
    patient = db.relationship('Patient', foreign_keys=[patient_id])

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.full_name if self.patient else 'Anonymous',
            'fever': self.fever,
            'cough': self.cough,
            'oxygen_level': self.oxygen_level,
            'systolic_bp': self.systolic_bp,
            'diastolic_bp': self.diastolic_bp,
            'sugar_level': self.sugar_level,
            'symptoms': self.symptoms.split(',') if self.symptoms else [],
            'model_used': self.model_used,
            'predicted_disease': self.predicted_disease,
            'confidence': self.confidence,
            'risk_level': self.risk_level,
            'recommended_dept': self.recommended_dept,
            'created_at': self.created_at.isoformat()
        }
