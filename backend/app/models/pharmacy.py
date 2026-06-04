from datetime import datetime
from app import db


class Medicine(db.Model):
    __tablename__ = 'medicines'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, unique=True, index=True)
    composition = db.Column(db.String(500), nullable=False)  # Comma-separated chemical compounds, e.g. "Aspirin, Caffeine"
    category = db.Column(db.String(100), index=True)
    
    stock_count = db.Column(db.Integer, default=0)
    min_stock_level = db.Column(db.Integer, default=10)
    expiry_date = db.Column(db.Date, nullable=False, index=True)
    is_high_risk = db.Column(db.Boolean, default=False, index=True)
    price = db.Column(db.Numeric(8, 2), default=0.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    alerts = db.relationship('MedicineAlert', back_populates='medicine', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'composition': [c.strip() for c in self.composition.split(',') if c.strip()],
            'category': self.category,
            'stock_count': self.stock_count,
            'min_stock_level': self.min_stock_level,
            'expiry_date': self.expiry_date.isoformat(),
            'is_high_risk': self.is_high_risk,
            'is_low_stock': self.stock_count <= self.min_stock_level,
            'price': float(self.price) if self.price else 0.0
        }


class Prescription(db.Model):
    __tablename__ = 'prescriptions'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='SET NULL'), nullable=True, index=True)
    
    is_verified = db.Column(db.Boolean, default=False, index=True)
    status = db.Column(db.Enum('pending', 'approved', 'rejected', name='prescription_status_types'), default='pending', index=True)
    notes = db.Column(db.Text, nullable=True)
    instructions = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Relationships
    patient = db.relationship('Patient', foreign_keys=[patient_id])
    doctor = db.relationship('User', foreign_keys=[doctor_id])
    appointment = db.relationship('Appointment', foreign_keys=[appointment_id])
    items = db.relationship('PrescriptionItem', back_populates='prescription', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.full_name if self.patient else 'Unknown',
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.name if self.doctor else 'Unknown',
            'appointment_id': self.appointment_id,
            'is_verified': self.is_verified,
            'status': self.status,
            'notes': self.notes,
            'instructions': self.instructions,
            'items': [item.to_dict() for item in self.items],
            'created_at': self.created_at.isoformat()
        }


class PrescriptionItem(db.Model):
    __tablename__ = 'prescription_items'

    id = db.Column(db.Integer, primary_key=True)
    prescription_id = db.Column(db.Integer, db.ForeignKey('prescriptions.id', ondelete='CASCADE'), nullable=False, index=True)
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id', ondelete='CASCADE'), nullable=False, index=True)
    
    dosage = db.Column(db.String(100), nullable=False)  # e.g. "500 mg" or "1 tablet"
    frequency = db.Column(db.String(100), nullable=False)  # e.g. "Twice daily" or "TID"
    duration_days = db.Column(db.Integer, default=7)

    prescription = db.relationship('Prescription', back_populates='items')
    medicine = db.relationship('Medicine', foreign_keys=[medicine_id])

    def to_dict(self):
        return {
            'id': self.id,
            'prescription_id': self.prescription_id,
            'medicine_id': self.medicine_id,
            'medicine_name': self.medicine.name if self.medicine else None,
            'is_high_risk': self.medicine.is_high_risk if self.medicine else False,
            'dosage': self.dosage,
            'frequency': self.frequency,
            'duration_days': self.duration_days
        }


class Supplier(db.Model):
    __tablename__ = 'suppliers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, unique=True)
    contact_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(150))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'contact_name': self.contact_name,
            'phone': self.phone,
            'email': self.email
        }


class MedicineAlert(db.Model):
    __tablename__ = 'medicine_alerts'

    id = db.Column(db.Integer, primary_key=True)
    medicine_id = db.Column(db.Integer, db.ForeignKey('medicines.id', ondelete='CASCADE'), nullable=False, index=True)
    
    alert_type = db.Column(db.Enum('expiry', 'low_stock', 'interaction', name='medicine_alert_types'), nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    is_resolved = db.Column(db.Boolean, default=False, index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    medicine = db.relationship('Medicine', back_populates='alerts')

    def to_dict(self):
        return {
            'id': self.id,
            'medicine_id': self.medicine_id,
            'medicine_name': self.medicine.name if self.medicine else None,
            'alert_type': self.alert_type,
            'message': self.message,
            'is_resolved': self.is_resolved,
            'created_at': self.created_at.isoformat()
        }


class DoctorVerification(db.Model):
    __tablename__ = 'doctor_verifications'

    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    
    license_number = db.Column(db.String(100), unique=True, nullable=False)
    is_verified = db.Column(db.Boolean, default=False, index=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    doctor = db.relationship('User', foreign_keys=[doctor_id])

    def to_dict(self):
        return {
            'id': self.id,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.name if self.doctor else None,
            'license_number': self.license_number,
            'is_verified': self.is_verified,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None
        }


class PharmacyOrder(db.Model):
    __tablename__ = 'pharmacy_orders'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    prescription_id = db.Column(db.Integer, db.ForeignKey('prescriptions.id', ondelete='SET NULL'), nullable=True, index=True)
    
    delivery_address = db.Column(db.String(500), nullable=False)
    contact_number = db.Column(db.String(20), nullable=False)
    payment_method = db.Column(db.String(50), default='Cash on Delivery')
    status = db.Column(db.String(50), default='Placed')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Relationships
    patient = db.relationship('Patient', foreign_keys=[patient_id])
    prescription = db.relationship('Prescription', foreign_keys=[prescription_id])

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'prescription_id': self.prescription_id,
            'delivery_address': self.delivery_address,
            'contact_number': self.contact_number,
            'payment_method': self.payment_method,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }
