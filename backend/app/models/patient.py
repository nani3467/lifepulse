from datetime import datetime
from app import db


class Patient(db.Model):
    __tablename__ = 'patients'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    patient_code = db.Column(db.String(20), unique=True, nullable=False, index=True)

    # Demographics
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    gender = db.Column(db.Enum('male', 'female', 'other'), nullable=False)
    blood_group = db.Column(db.String(5))
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(150), index=True)
    address = db.Column(db.Text)
    city = db.Column(db.String(80))
    state = db.Column(db.String(80))
    pincode = db.Column(db.String(10))

    # Emergency Contact
    emergency_name = db.Column(db.String(120))
    emergency_phone = db.Column(db.String(20))
    emergency_relation = db.Column(db.String(50))

    # Medical
    allergies = db.Column(db.Text)
    chronic_conditions = db.Column(db.Text)
    current_medications = db.Column(db.Text)
    insurance_provider = db.Column(db.String(120))
    insurance_id = db.Column(db.String(80))

    status = db.Column(db.Enum('active', 'admitted', 'discharged', 'critical', 'deceased'), default='active')
    notes = db.Column(db.Text)
    avatar = db.Column(db.String(300))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', back_populates='patient_profile')
    medical_history = db.relationship('MedicalHistory', back_populates='patient', cascade='all, delete-orphan', order_by='MedicalHistory.date.desc()')
    admissions = db.relationship('Admission', back_populates='patient', cascade='all, delete-orphan', order_by='Admission.admit_date.desc()')
    diseases = db.relationship('DiseaseRecord', back_populates='patient', cascade='all, delete-orphan')
    reports = db.relationship('PatientReport', back_populates='patient', cascade='all, delete-orphan', order_by='PatientReport.uploaded_at.desc()')

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def age(self):
        today = datetime.today().date()
        dob = self.date_of_birth
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    def to_dict(self, include_details=False):
        data = {
            'id': self.id,
            'patient_code': self.patient_code,
            'full_name': self.full_name,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'age': self.age,
            'gender': self.gender,
            'blood_group': self.blood_group,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'city': self.city,
            'state': self.state,
            'status': self.status,
            'insurance_provider': self.insurance_provider,
            'insurance_id': self.insurance_id,
            'avatar': self.avatar,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_details:
            data.update({
                'allergies': self.allergies,
                'chronic_conditions': self.chronic_conditions,
                'current_medications': self.current_medications,
                'emergency_name': self.emergency_name,
                'emergency_phone': self.emergency_phone,
                'emergency_relation': self.emergency_relation,
                'notes': self.notes,
                'pincode': self.pincode,
                'medical_history': [h.to_dict() for h in self.medical_history],
                'admissions': [a.to_dict() for a in self.admissions],
                'diseases': [d.to_dict() for d in self.diseases],
                'reports': [r.to_dict() for r in self.reports]
            })
        return data


class MedicalHistory(db.Model):
    __tablename__ = 'medical_history'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    visit_type = db.Column(db.Enum('consultation', 'emergency', 'follow_up', 'surgery', 'lab_test', 'vaccination'), default='consultation')
    chief_complaint = db.Column(db.Text)
    diagnosis = db.Column(db.Text, nullable=False)
    treatment = db.Column(db.Text)
    prescription = db.Column(db.Text)
    notes = db.Column(db.Text)
    follow_up_date = db.Column(db.Date)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship('Patient', back_populates='medical_history')
    doctor = db.relationship('User', foreign_keys=[doctor_id])

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.name if self.doctor else None,
            'date': self.date.isoformat() if self.date else None,
            'visit_type': self.visit_type,
            'chief_complaint': self.chief_complaint,
            'diagnosis': self.diagnosis,
            'treatment': self.treatment,
            'prescription': self.prescription,
            'notes': self.notes,
            'follow_up_date': self.follow_up_date.isoformat() if self.follow_up_date else None,
            'created_at': self.created_at.isoformat()
        }


class Admission(db.Model):
    __tablename__ = 'admissions'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    ward = db.Column(db.String(80), index=True)
    room_number = db.Column(db.String(20))
    bed_number = db.Column(db.String(20))
    admit_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    discharge_date = db.Column(db.DateTime)
    reason = db.Column(db.Text, nullable=False)
    diagnosis_at_admission = db.Column(db.Text)
    diagnosis_at_discharge = db.Column(db.Text)
    discharge_notes = db.Column(db.Text)
    status = db.Column(db.Enum('admitted', 'discharged', 'transferred'), default='admitted', index=True)
    total_cost = db.Column(db.Numeric(10, 2))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship('Patient', back_populates='admissions')
    doctor = db.relationship('User', foreign_keys=[doctor_id])

    @property
    def duration_days(self):
        end = self.discharge_date or datetime.utcnow()
        return (end - self.admit_date).days

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.name if self.doctor else None,
            'ward': self.ward,
            'room_number': self.room_number,
            'bed_number': self.bed_number,
            'admit_date': self.admit_date.isoformat(),
            'discharge_date': self.discharge_date.isoformat() if self.discharge_date else None,
            'reason': self.reason,
            'diagnosis_at_admission': self.diagnosis_at_admission,
            'diagnosis_at_discharge': self.diagnosis_at_discharge,
            'discharge_notes': self.discharge_notes,
            'status': self.status,
            'duration_days': self.duration_days,
            'total_cost': float(self.total_cost) if self.total_cost else None,
            'created_at': self.created_at.isoformat()
        }


class DiseaseRecord(db.Model):
    __tablename__ = 'disease_records'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    disease_name = db.Column(db.String(200), nullable=False, index=True)
    icd_code = db.Column(db.String(20))
    category = db.Column(db.String(100))
    severity = db.Column(db.Enum('mild', 'moderate', 'severe', 'critical'), default='mild', index=True)
    diagnosed_date = db.Column(db.Date, nullable=False)
    resolved_date = db.Column(db.Date)
    is_chronic = db.Column(db.Boolean, default=False)
    status = db.Column(db.Enum('active', 'resolved', 'managed', 'recurrent'), default='active', index=True)
    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship('Patient', back_populates='diseases')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'disease_name': self.disease_name,
            'icd_code': self.icd_code,
            'category': self.category,
            'severity': self.severity,
            'diagnosed_date': self.diagnosed_date.isoformat() if self.diagnosed_date else None,
            'resolved_date': self.resolved_date.isoformat() if self.resolved_date else None,
            'is_chronic': self.is_chronic,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat()
        }


class PatientReport(db.Model):
    __tablename__ = 'patient_reports'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    report_name = db.Column(db.String(200), nullable=False)
    report_type = db.Column(db.Enum('lab_result', 'imaging', 'prescription', 'discharge_summary', 'other'), default='other', index=True)
    file_path = db.Column(db.String(500), nullable=False)
    file_name = db.Column(db.String(200), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    description = db.Column(db.Text)
    report_date = db.Column(db.Date)

    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship('Patient', back_populates='reports')
    uploader = db.relationship('User', foreign_keys=[uploaded_by])

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'uploaded_by': self.uploaded_by,
            'uploader_name': self.uploader.name if self.uploader else None,
            'report_name': self.report_name,
            'report_type': self.report_type,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'description': self.description,
            'report_date': self.report_date.isoformat() if self.report_date else None,
            'download_url': f"/api/uploads/{self.id}/download",
            'uploaded_at': self.uploaded_at.isoformat()
        }


class PatientVitalsLog(db.Model):
    __tablename__ = 'patient_vitals_logs'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    heart_rate = db.Column(db.Integer)
    systolic_bp = db.Column(db.Integer)
    diastolic_bp = db.Column(db.Integer)
    oxygen_level = db.Column(db.Integer)
    blood_sugar = db.Column(db.Integer)
    stress_level = db.Column(db.String(50))
    respiratory_rate = db.Column(db.Integer)
    asthma_indicator = db.Column(db.String(50))
    pneumonia_risk = db.Column(db.String(50))
    bronchitis_symptoms = db.Column(db.String(50))
    mood_score = db.Column(db.String(50))
    sleep_quality = db.Column(db.Integer)
    skin_condition = db.Column(db.String(150))
    eye_redness = db.Column(db.String(50))
    diabetes_risk = db.Column(db.String(50))
    wellness_score = db.Column(db.Integer)
    daily_health_insights = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship('Patient', foreign_keys=[patient_id])

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'heart_rate': self.heart_rate,
            'systolic_bp': self.systolic_bp,
            'diastolic_bp': self.diastolic_bp,
            'oxygen_level': self.oxygen_level,
            'blood_sugar': self.blood_sugar,
            'stress_level': self.stress_level,
            'respiratory_rate': self.respiratory_rate,
            'asthma_indicator': self.asthma_indicator,
            'pneumonia_risk': self.pneumonia_risk,
            'bronchitis_symptoms': self.bronchitis_symptoms,
            'mood_score': self.mood_score,
            'sleep_quality': self.sleep_quality,
            'skin_condition': self.skin_condition,
            'eye_redness': self.eye_redness,
            'diabetes_risk': self.diabetes_risk,
            'wellness_score': self.wellness_score,
            'daily_health_insights': self.daily_health_insights,
            'created_at': self.created_at.isoformat()
        }


class HealthScan(db.Model):
    __tablename__ = 'health_scans'

    scan_id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    heart_rate = db.Column(db.Integer)
    hrv = db.Column(db.Integer)
    spo2 = db.Column(db.Integer)
    respiratory_rate = db.Column(db.Integer)
    stress_score = db.Column(db.Integer)
    stress_level = db.Column(db.String(50))
    recovery_score = db.Column(db.Integer)
    health_score = db.Column(db.Integer)
    recommendations = db.Column(db.Text)
    
    systolic_bp = db.Column(db.Integer)
    diastolic_bp = db.Column(db.Integer)
    bp_category = db.Column(db.String(50))
    
    fatigue_level = db.Column(db.String(50))
    alertness_score = db.Column(db.Integer)
    
    height = db.Column(db.Float)
    weight = db.Column(db.Float)
    bmi = db.Column(db.Float)
    weight_category = db.Column(db.String(50))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship('Patient', foreign_keys=[patient_id])

    def to_dict(self):
        return {
            'scan_id': self.scan_id,
            'patient_id': self.patient_id,
            'heart_rate': self.heart_rate,
            'hrv': self.hrv,
            'spo2': self.spo2,
            'respiratory_rate': self.respiratory_rate,
            'stress_score': self.stress_score,
            'stress_level': self.stress_level,
            'recovery_score': self.recovery_score,
            'health_score': self.health_score,
            'recommendations': self.recommendations,
            'systolic_bp': self.systolic_bp,
            'diastolic_bp': self.diastolic_bp,
            'bp_category': self.bp_category,
            'fatigue_level': self.fatigue_level,
            'alertness_score': self.alertness_score,
            'height': self.height,
            'weight': self.weight,
            'bmi': self.bmi,
            'weight_category': self.weight_category,
            'created_at': self.created_at.isoformat()
        }

