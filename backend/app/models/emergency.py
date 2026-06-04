from datetime import datetime
from app import db


class EmergencyAlert(db.Model):
    __tablename__ = 'emergency_alerts'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True, index=True)

    # Vitals recorded during emergency trigger
    heart_rate = db.Column(db.Integer, nullable=False)
    oxygen_level = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    systolic_bp = db.Column(db.Integer, nullable=False)
    diastolic_bp = db.Column(db.Integer, nullable=False)

    # Risk Metrics
    emergency_probability = db.Column(db.Float, nullable=False)  # e.g. 92.5 %
    icu_required = db.Column(db.Boolean, default=False)
    status = db.Column(db.Enum('active', 'acknowledged', 'resolved', name='alert_status_types'), default='active', index=True)

    # Trigger triggers details & action notes
    trigger_vitals = db.Column(db.Text, nullable=True)  # e.g. "Severe Hypoxia, Bradycardia"
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    patient = db.relationship('Patient', foreign_keys=[patient_id])

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.full_name if self.patient else 'Walk-in / Telemetry',
            'patient_code': self.patient.patient_code if self.patient else 'N/A',
            'heart_rate': self.heart_rate,
            'oxygen_level': self.oxygen_level,
            'temperature': self.temperature,
            'systolic_bp': self.systolic_bp,
            'diastolic_bp': self.diastolic_bp,
            'emergency_probability': self.emergency_probability,
            'icu_required': self.icu_required,
            'status': self.status,
            'trigger_vitals': self.trigger_vitals.split(',') if self.trigger_vitals else [],
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
