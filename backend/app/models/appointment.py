from datetime import datetime, time
from app import db


class Department(db.Model):
    __tablename__ = 'departments'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    description = db.Column(db.Text)
    color = db.Column(db.String(7), default='#3b82f6')  # hex color for calendar
    icon = db.Column(db.String(50))
    location = db.Column(db.String(120))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    doctors = db.relationship('DoctorProfile', back_populates='department', cascade='all, delete-orphan')
    appointments = db.relationship('Appointment', back_populates='department')
    time_slots = db.relationship('TimeSlot', back_populates='department', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'color': self.color,
            'icon': self.icon,
            'location': self.location,
            'is_active': self.is_active,
            'doctor_count': len(self.doctors),
        }


class Hospital(db.Model):
    __tablename__ = 'hospitals'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.String(250))
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'phone': self.phone,
            'created_at': self.created_at.isoformat()
        }


class DoctorProfile(db.Model):
    __tablename__ = 'doctor_profiles'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id', ondelete='SET NULL'), nullable=True)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id', ondelete='SET NULL'), nullable=True)

    specialization = db.Column(db.String(150))
    qualification = db.Column(db.String(200))
    experience_years = db.Column(db.Integer, default=0)
    consultation_fee = db.Column(db.Numeric(8, 2), default=0)
    bio = db.Column(db.Text)
    available_days = db.Column(db.String(50), default='Mon,Tue,Wed,Thu,Fri')  # comma-separated
    slot_duration_mins = db.Column(db.Integer, default=15)  # minutes per appointment
    max_patients_per_day = db.Column(db.Integer, default=30)
    is_available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Verified credentials columns
    medical_reg_number = db.Column(db.String(100))
    medical_council_reg_id = db.Column(db.String(100))
    highest_degree = db.Column(db.String(100))
    university_name = db.Column(db.String(150))
    graduation_year = db.Column(db.Integer)
    available_slots = db.Column(db.String(300))
    consultation_types = db.Column(db.String(150))
    license_file = db.Column(db.String(300))
    certificate_file = db.Column(db.String(300))
    gov_id_file = db.Column(db.String(300))
    experience_cert_file = db.Column(db.String(300))
    additional_cert_file = db.Column(db.String(300))
    rating = db.Column(db.Float, default=4.8)

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])
    department = db.relationship('Department', back_populates='doctors')
    hospital = db.relationship('Hospital', foreign_keys=[hospital_id])
    appointments = db.relationship('Appointment', back_populates='doctor_profile', cascade='all, delete-orphan')
    time_slots = db.relationship('TimeSlot', back_populates='doctor_profile', cascade='all, delete-orphan')

    @property
    def doctor_code(self):
        return f"DOC{str(self.id).zfill(3)}"

    def to_dict(self):
        # Prevent circular imports
        from app.models.appointment import Appointment
        
        # Calculate performance metrics
        appt_count = Appointment.query.filter_by(doctor_profile_id=self.id).count()
        revenue = db.session.query(db.func.sum(Appointment.consultation_fee)).filter_by(
            doctor_profile_id=self.id, status='completed'
        ).scalar() or 0.0

        return {
            'id': self.id,
            'doctor_code': self.doctor_code,
            'user_id': self.user_id,
            'doctor_name': self.user.name if self.user else None,
            'email': self.user.email if self.user else None,
            'phone': self.user.phone if self.user else None,
            'avatar': self.user.avatar if self.user else None,
            'is_active': self.user.is_active if self.user else False,
            'department_id': self.department_id,
            'department_name': self.department.name if self.department else None,
            'department_color': self.department.color if self.department else '#3b82f6',
            'hospital_id': self.hospital_id,
            'hospital_name': self.hospital.name if self.hospital else None,
            'specialization': self.specialization,
            'qualification': self.qualification,
            'experience_years': self.experience_years,
            'consultation_fee': float(self.consultation_fee) if self.consultation_fee else 0,
            'bio': self.bio,
            'available_days': self.available_days,
            'slot_duration_mins': self.slot_duration_mins,
            'max_patients_per_day': self.max_patients_per_day,
            'is_available': self.is_available,
            
            # Credentials
            'medical_reg_number': self.medical_reg_number,
            'medical_council_reg_id': self.medical_council_reg_id,
            'highest_degree': self.highest_degree,
            'university_name': self.university_name,
            'graduation_year': self.graduation_year,
            'available_slots': self.available_slots,
            'consultation_types': self.consultation_types,
            'license_file': self.license_file,
            'certificate_file': self.certificate_file,
            'gov_id_file': self.gov_id_file,
            'experience_cert_file': self.experience_cert_file,
            'additional_cert_file': self.additional_cert_file,
            
            # Performance metrics
            'rating': float(self.rating) if self.rating else 4.8,
            'appointment_count': appt_count,
            'total_revenue': float(revenue)
        }


class TimeSlot(db.Model):
    """Represents a single bookable time block for a doctor on a specific date."""
    __tablename__ = 'time_slots'

    id = db.Column(db.Integer, primary_key=True)
    doctor_profile_id = db.Column(db.Integer, db.ForeignKey('doctor_profiles.id', ondelete='CASCADE'), nullable=False, index=True)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id', ondelete='CASCADE'), nullable=True)

    date = db.Column(db.Date, nullable=False, index=True)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_booked = db.Column(db.Boolean, default=False)
    is_blocked = db.Column(db.Boolean, default=False)  # doctor manually blocked
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    doctor_profile = db.relationship('DoctorProfile', back_populates='time_slots')
    department = db.relationship('Department', back_populates='time_slots')
    appointment = db.relationship('Appointment', back_populates='time_slot', uselist=False)

    __table_args__ = (
        db.UniqueConstraint('doctor_profile_id', 'date', 'start_time', name='uq_doctor_slot'),
        db.Index('idx_timeslot_lookup', 'doctor_profile_id', 'date', 'is_booked'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'doctor_profile_id': self.doctor_profile_id,
            'doctor_name': self.doctor_profile.user.name if self.doctor_profile and self.doctor_profile.user else None,
            'department_id': self.department_id,
            'date': self.date.isoformat() if self.date else None,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'is_booked': self.is_booked,
            'is_blocked': self.is_blocked,
        }


class Appointment(db.Model):
    __tablename__ = 'appointments'

    __table_args__ = (
        db.Index('idx_appt_doctor_date', 'doctor_profile_id', 'appointment_date'),
    )

    id = db.Column(db.Integer, primary_key=True)
    appointment_code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    doctor_profile_id = db.Column(db.Integer, db.ForeignKey('doctor_profiles.id', ondelete='SET NULL'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id', ondelete='SET NULL'), nullable=True)
    time_slot_id = db.Column(db.Integer, db.ForeignKey('time_slots.id', ondelete='SET NULL'), nullable=True)
    booked_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    appointment_date = db.Column(db.Date, nullable=False, index=True)
    appointment_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time)
    
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id', ondelete='SET NULL'), nullable=True)
    consultation_type = db.Column(db.String(50), default='in_person')
    payment_status = db.Column(db.String(50), default='pending')
    reschedule_date = db.Column(db.Date, nullable=True)
    reschedule_time = db.Column(db.Time, nullable=True)

    appointment_type = db.Column(
        db.Enum('consultation', 'follow_up', 'emergency', 'lab_test', 'procedure', 'vaccination'),
        default='consultation'
    )
    reason = db.Column(db.Text)
    symptoms = db.Column(db.Text)
    notes = db.Column(db.Text)

    status = db.Column(
        db.Enum('pending', 'confirmed', 'rejected', 'completed', 'cancelled', 'no_show'),
        default='pending', index=True
    )
    priority = db.Column(db.Enum('normal', 'urgent', 'emergency'), default='normal')

    # Rejection / cancellation
    rejection_reason = db.Column(db.Text)
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Timing tracking
    checked_in_at = db.Column(db.DateTime)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    actual_wait_mins = db.Column(db.Integer)

    consultation_fee = db.Column(db.Numeric(8, 2))
    is_online = db.Column(db.Boolean, default=False)  # Online booking flag
    meeting_link = db.Column(db.String(300))
    meeting_id = db.Column(db.String(100))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient = db.relationship('Patient', foreign_keys=[patient_id])
    doctor_profile = db.relationship('DoctorProfile', back_populates='appointments')
    department = db.relationship('Department', back_populates='appointments')
    time_slot = db.relationship('TimeSlot', back_populates='appointment')
    booker = db.relationship('User', foreign_keys=[booked_by])
    hospital = db.relationship('Hospital', foreign_keys=[hospital_id])
    queue_entry = db.relationship('QueueEntry', back_populates='appointment', uselist=False, cascade='all, delete-orphan')
    notifications = db.relationship('AppointmentNotification', back_populates='appointment', cascade='all, delete-orphan')

    def to_dict(self, include_queue=False):
        data = {
            'id': self.id,
            'appointment_code': self.appointment_code,
            'patient_id': self.patient_id,
            'patient_name': self.patient.full_name if self.patient else None,
            'patient_code': self.patient.patient_code if self.patient else None,
            'doctor_profile_id': self.doctor_profile_id,
            'doctor_name': self.doctor_profile.user.name if self.doctor_profile and self.doctor_profile.user else None,
            'department_id': self.department_id,
            'department_name': self.department.name if self.department else None,
            'department_color': self.department.color if self.department else '#3b82f6',
            'appointment_date': self.appointment_date.isoformat() if self.appointment_date else None,
            'appointment_time': self.appointment_time.strftime('%H:%M') if self.appointment_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'appointment_type': self.appointment_type,
            'reason': self.reason,
            'symptoms': self.symptoms,
            'status': self.status,
            'priority': self.priority,
            'rejection_reason': self.rejection_reason,
            'is_online': self.is_online,
            'meeting_link': self.meeting_link,
            'meeting_id': self.meeting_id,
            'hospital_id': self.hospital_id,
            'hospital_name': self.hospital.name if self.hospital else None,
            'consultation_type': self.consultation_type,
            'payment_status': self.payment_status,
            'reschedule_date': self.reschedule_date.isoformat() if self.reschedule_date else None,
            'reschedule_time': self.reschedule_time.strftime('%H:%M') if self.reschedule_time else None,
            'consultation_fee': float(self.consultation_fee) if self.consultation_fee else None,
            'checked_in_at': self.checked_in_at.isoformat() if self.checked_in_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'actual_wait_mins': self.actual_wait_mins,
            'created_at': self.created_at.isoformat(),
        }
        if include_queue and self.queue_entry:
            data['queue'] = self.queue_entry.to_dict()
        return data


class QueueEntry(db.Model):
    """Tracks a patient's position and status in a doctor's daily queue."""
    __tablename__ = 'queue_entries'

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='CASCADE'), unique=True, nullable=False)
    doctor_profile_id = db.Column(db.Integer, db.ForeignKey('doctor_profiles.id', ondelete='CASCADE'), nullable=False, index=True)
    queue_date = db.Column(db.Date, nullable=False, index=True)

    token_number = db.Column(db.Integer, nullable=False)
    position = db.Column(db.Integer)  # current position in live queue
    estimated_wait_mins = db.Column(db.Integer, default=0)
    status = db.Column(
        db.Enum('waiting', 'called', 'in_progress', 'done', 'skipped'),
        default='waiting'
    )
    called_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    appointment = db.relationship('Appointment', back_populates='queue_entry')
    doctor_profile = db.relationship('DoctorProfile', foreign_keys=[doctor_profile_id])

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'doctor_profile_id': self.doctor_profile_id,
            'queue_date': self.queue_date.isoformat() if self.queue_date else None,
            'token_number': self.token_number,
            'position': self.position,
            'estimated_wait_mins': self.estimated_wait_mins,
            'status': self.status,
            'called_at': self.called_at.isoformat() if self.called_at else None,
        }


class AppointmentNotification(db.Model):
    __tablename__ = 'appointment_notifications'

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    type = db.Column(
        db.Enum('booked', 'confirmed', 'rejected', 'reminder', 'cancelled', 'queue_called', 'rescheduled'),
        nullable=False
    )
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    appointment = db.relationship('Appointment', back_populates='notifications')
    user = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'appointment_code': self.appointment.appointment_code if self.appointment else None,
            'created_at': self.created_at.isoformat(),
        }


class VideoSession(db.Model):
    __tablename__ = 'video_sessions'

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='CASCADE'), nullable=False)
    meeting_id = db.Column(db.String(100), nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), default='active')

    appointment = db.relationship('Appointment', foreign_keys=[appointment_id])

    def to_dict(self):
        return {
            'session_id': self.id,
            'appointment_id': self.appointment_id,
            'meeting_id': self.meeting_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'status': self.status
        }


