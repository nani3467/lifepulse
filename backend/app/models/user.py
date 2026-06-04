from datetime import datetime
from app import db
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum('admin', 'doctor', 'patient', 'receptionist'), nullable=False, default='patient')
    phone = db.Column(db.String(20))
    avatar = db.Column(db.String(300))
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient_profile = db.relationship('Patient', back_populates='user', uselist=False, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'phone': self.phone,
            'avatar': self.avatar,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat()
        }


class DoctorRegistrationRequest(db.Model):
    __tablename__ = 'doctor_registration_requests'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    phone = db.Column(db.String(20))
    dob = db.Column(db.String(50))
    gender = db.Column(db.String(20))
    profile_photo = db.Column(db.String(300))
    
    medical_reg_number = db.Column(db.String(100))
    medical_council_reg_id = db.Column(db.String(100))
    qualification = db.Column(db.String(200))
    highest_degree = db.Column(db.String(100))
    university_name = db.Column(db.String(150))
    graduation_year = db.Column(db.Integer)
    experience_years = db.Column(db.Integer)
    specialization = db.Column(db.String(150)) # department name or details
    
    hospital_name = db.Column(db.String(150))
    hospital_address = db.Column(db.String(250))
    hospital_city = db.Column(db.String(100))
    hospital_state = db.Column(db.String(100))
    hospital_phone = db.Column(db.String(20))
    hospital_pincode = db.Column(db.String(20))
    
    consultation_fee = db.Column(db.Numeric(8, 2))
    available_days = db.Column(db.String(100))
    available_slots = db.Column(db.String(300))
    consultation_types = db.Column(db.String(150))
    supports_video = db.Column(db.Boolean, default=False)
    
    license_file = db.Column(db.String(300))
    certificate_file = db.Column(db.String(300))
    gov_id_file = db.Column(db.String(300))
    experience_cert_file = db.Column(db.String(300))
    additional_cert_file = db.Column(db.String(300))
    bio = db.Column(db.Text)
    
    status = db.Column(db.Enum('pending', 'approved', 'rejected', name='registration_statuses'), default='pending')
    rejection_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'dob': self.dob,
            'gender': self.gender,
            'profile_photo': self.profile_photo,
            'medical_reg_number': self.medical_reg_number,
            'medical_council_reg_id': self.medical_council_reg_id,
            'qualification': self.qualification,
            'highest_degree': self.highest_degree,
            'university_name': self.university_name,
            'graduation_year': self.graduation_year,
            'experience_years': self.experience_years,
            'specialization': self.specialization,
            'hospital_name': self.hospital_name,
            'hospital_address': self.hospital_address,
            'hospital_city': self.hospital_city,
            'hospital_state': self.hospital_state,
            'hospital_phone': self.hospital_phone,
            'hospital_pincode': self.hospital_pincode,
            'consultation_fee': float(self.consultation_fee) if self.consultation_fee else 0.0,
            'available_days': self.available_days,
            'available_slots': self.available_slots,
            'consultation_types': self.consultation_types,
            'supports_video': self.supports_video,
            'license_file': self.license_file,
            'certificate_file': self.certificate_file,
            'gov_id_file': self.gov_id_file,
            'experience_cert_file': self.experience_cert_file,
            'additional_cert_file': self.additional_cert_file,
            'bio': self.bio,
            'status': self.status,
            'rejection_reason': self.rejection_reason,
            'created_at': self.created_at.isoformat()
        }
