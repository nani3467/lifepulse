from datetime import datetime
from app import db


class BloodDonor(db.Model):
    __tablename__ = 'blood_donors'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True, index=True)

    name = db.Column(db.String(120), nullable=False)
    blood_group = db.Column(
        db.Enum('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', name='blood_group_types'),
        nullable=False, index=True
    )
    last_donation_date = db.Column(db.Date, nullable=True)
    eligibility_status = db.Column(db.Boolean, default=True)
    eligibility_notes = db.Column(db.Text, nullable=True)
    
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(150), nullable=True)
    is_rare = db.Column(db.Boolean, default=False, index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    patient = db.relationship('Patient', foreign_keys=[patient_id])
    donations = db.relationship('DonationHistory', back_populates='donor', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'name': self.name,
            'blood_group': self.blood_group,
            'last_donation_date': self.last_donation_date.isoformat() if self.last_donation_date else None,
            'eligibility_status': self.eligibility_status,
            'eligibility_notes': self.eligibility_notes,
            'phone': self.phone,
            'email': self.email,
            'is_rare': self.is_rare,
            'created_at': self.created_at.isoformat()
        }


class BloodInventory(db.Model):
    __tablename__ = 'blood_inventory'

    id = db.Column(db.Integer, primary_key=True)
    blood_group = db.Column(
        db.Enum('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', name='blood_group_types_inv'),
        unique=True, nullable=False, index=True
    )
    units_available = db.Column(db.Integer, default=0)
    units_critical_threshold = db.Column(db.Integer, default=5)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'blood_group': self.blood_group,
            'units_available': self.units_available,
            'units_critical_threshold': self.units_critical_threshold,
            'is_low': self.units_available <= self.units_critical_threshold,
            'updated_at': self.updated_at.isoformat()
        }


class BloodRequest(db.Model):
    __tablename__ = 'blood_requests'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True, index=True)
    patient_name = db.Column(db.String(120), nullable=False)
    
    blood_group = db.Column(
        db.Enum('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', name='blood_group_types_req'),
        nullable=False, index=True
    )
    units_requested = db.Column(db.Integer, nullable=False)
    urgency = db.Column(db.Enum('normal', 'urgent', 'emergency', name='blood_urgency_types'), default='normal', index=True)
    status = db.Column(db.Enum('pending', 'approved', 'fulfilled', 'rejected', name='blood_request_status'), default='pending', index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    patient = db.relationship('Patient', foreign_keys=[patient_id])

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient_name,
            'blood_group': self.blood_group,
            'units_requested': self.units_requested,
            'urgency': self.urgency,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }


class DonationHistory(db.Model):
    __tablename__ = 'donation_history'

    id = db.Column(db.Integer, primary_key=True)
    donor_id = db.Column(db.Integer, db.ForeignKey('blood_donors.id', ondelete='CASCADE'), nullable=False, index=True)
    
    units_donated = db.Column(db.Integer, default=1)
    donation_date = db.Column(db.Date, nullable=False, index=True)
    expiry_date = db.Column(db.Date, nullable=False, index=True)
    status = db.Column(db.Enum('available', 'expired', 'used', name='donation_status_types'), default='available', index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    donor = db.relationship('BloodDonor', back_populates='donations')

    def to_dict(self):
        return {
            'id': self.id,
            'donor_id': self.donor_id,
            'donor_name': self.donor.name if self.donor else None,
            'blood_group': self.donor.blood_group if self.donor else None,
            'units_donated': self.units_donated,
            'donation_date': self.donation_date.isoformat(),
            'expiry_date': self.expiry_date.isoformat(),
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }
