from flask import Blueprint, jsonify, request, send_file, current_app
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from datetime import datetime
from werkzeug.security import generate_password_hash
import os

from app import db
from app.models.user import User
from app.models.patient import Patient, Admission, DiseaseRecord, MedicalHistory
from app.models.appointment import Department, DoctorProfile, Hospital
from app.utils.auth_middleware import admin_required, staff_required
from app.models.emergency import EmergencyAlert
from app.models.bloodbank import BloodInventory
from app.models.pharmacy import Prescription

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
@staff_required
def dashboard_stats():
    total_patients = Patient.query.count()
    admitted = Patient.query.filter_by(status='admitted').count()
    total_users = User.query.count()
    total_admissions = Admission.query.count()

    # Shared clinical ecosystem counts
    active_emergencies = EmergencyAlert.query.filter_by(status='active').count()
    
    # Blood shortages (count of categories below critical threshold)
    blood_shortages = 0
    if BloodInventory.query.count() > 0:
        blood_shortages = BloodInventory.query.filter(
            BloodInventory.units_available <= BloodInventory.units_critical_threshold
        ).count()
        
    pending_prescriptions = Prescription.query.filter_by(status='pending').count()

    recent_patients = (
        Patient.query.order_by(Patient.created_at.desc()).limit(5).all()
    )

    disease_counts = (
        db.session.query(DiseaseRecord.disease_name, func.count(DiseaseRecord.id).label('count'))
        .group_by(DiseaseRecord.disease_name)
        .order_by(func.count(DiseaseRecord.id).desc())
        .limit(10)
        .all()
    )

    return jsonify({
        'stats': {
            'total_patients': total_patients,
            'admitted_patients': admitted,
            'total_users': total_users,
            'total_admissions': total_admissions,
            'active_emergencies': active_emergencies,
            'blood_shortages': blood_shortages,
            'pending_prescriptions': pending_prescriptions
        },
        'recent_patients': [p.to_dict() for p in recent_patients],
        'top_diseases': [{'disease': d[0], 'count': d[1]} for d in disease_counts]
    }), 200


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@admin_required
def list_users():
    users = User.query.all()
    return jsonify({'users': [u.to_dict() for u in users]}), 200


# ─── DOCTOR MANAGEMENT ────────────────────────────────────────────────────────

@admin_bp.route('/doctors', methods=['GET'])
@jwt_required()
@staff_required
def admin_list_doctors():
    doctors = DoctorProfile.query.all()
    return jsonify({'doctors': [d.to_dict() for d in doctors]}), 200


@admin_bp.route('/doctors', methods=['POST'])
@jwt_required()
@admin_required
def admin_create_doctor():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('name') or not data.get('password'):
        return jsonify({'error': 'Name, email, and password are required'}), 400
        
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
        
    user = User(
        name=data['name'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        role='doctor',
        phone=data.get('phone'),
        is_active=True
    )
    db.session.add(user)
    db.session.flush() # flush to get user.id
    
    profile = DoctorProfile(
        user_id=user.id,
        department_id=data.get('department_id'),
        hospital_id=data.get('hospital_id'),
        specialization=data.get('specialization'),
        qualification=data.get('qualification'),
        experience_years=data.get('experience_years', 0),
        consultation_fee=data.get('consultation_fee', 0),
        bio=data.get('bio'),
        available_days=data.get('available_days', 'Mon,Tue,Wed,Thu,Fri'),
        slot_duration_mins=data.get('slot_duration_mins', 15),
        max_patients_per_day=data.get('max_patients_per_day', 30),
        is_available=True
    )
    db.session.add(profile)
    db.session.commit()
    
    return jsonify({'doctor': profile.to_dict()}), 201


@admin_bp.route('/doctors/<int:doctor_id>', methods=['PUT'])
@jwt_required()
@admin_required
def admin_update_doctor(doctor_id):
    profile = DoctorProfile.query.get_or_404(doctor_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    if 'department_id' in data:
        profile.department_id = data['department_id']
    if 'hospital_id' in data:
        profile.hospital_id = data['hospital_id']
    if 'specialization' in data:
        profile.specialization = data['specialization']
    if 'qualification' in data:
        profile.qualification = data['qualification']
    if 'experience_years' in data:
        profile.experience_years = data['experience_years']
    if 'consultation_fee' in data:
        profile.consultation_fee = data['consultation_fee']
    if 'bio' in data:
        profile.bio = data['bio']
    if 'available_days' in data:
        profile.available_days = data['available_days']
    if 'slot_duration_mins' in data:
        profile.slot_duration_mins = data['slot_duration_mins']
    if 'max_patients_per_day' in data:
        profile.max_patients_per_day = data['max_patients_per_day']
    if 'is_available' in data:
        profile.is_available = data['is_available']
        
    if profile.user:
        if 'name' in data:
            profile.user.name = data['name']
        if 'phone' in data:
            profile.user.phone = data['phone']
        if 'is_active' in data:
            profile.user.is_active = data['is_active']
            
    db.session.commit()
    return jsonify({'doctor': profile.to_dict()}), 200


@admin_bp.route('/doctors/<int:doctor_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def admin_delete_doctor(doctor_id):
    profile = DoctorProfile.query.get_or_404(doctor_id)
    profile.is_available = False
    if profile.user:
        profile.user.is_active = False
    db.session.commit()
    return jsonify({'message': 'Doctor suspended successfully'}), 200


# ─── PATIENT MANAGEMENT ───────────────────────────────────────────────────────

@admin_bp.route('/patients', methods=['GET'])
@jwt_required()
@staff_required
def admin_list_patients():
    patients = Patient.query.all()
    return jsonify({'patients': [p.to_dict() for p in patients]}), 200


@admin_bp.route('/patients/<int:patient_id>/status', methods=['PUT'])
@jwt_required()
@admin_required
def admin_toggle_patient_status(patient_id):
    pat = Patient.query.get_or_404(patient_id)
    data = request.get_json()
    if not data or 'is_active' not in data:
        return jsonify({'error': 'is_active parameter is required'}), 400
        
    is_active = data['is_active']
    pat.status = 'active' if is_active else 'suspended'
    if pat.user:
        pat.user.is_active = is_active
        
    db.session.commit()
    return jsonify({'patient': pat.to_dict()}), 200


# ─── HOSPITAL MANAGEMENT ──────────────────────────────────────────────────────

@admin_bp.route('/hospitals', methods=['GET'])
@jwt_required()
def admin_list_hospitals():
    hospitals = Hospital.query.all()
    if not hospitals:
        h1 = Hospital(name='LifePulse General Hospital', address='123 Clinical Way, Metro City', phone='+1 555-0100')
        h2 = Hospital(name='LifePulse Heart & Vascular Center', address='456 Cardiology Drive, Metro City', phone='+1 555-0200')
        db.session.add(h1)
        db.session.add(h2)
        db.session.commit()
        hospitals = [h1, h2]
    return jsonify({'hospitals': [h.to_dict() for h in hospitals]}), 200


@admin_bp.route('/hospitals', methods=['POST'])
@jwt_required()
@admin_required
def admin_create_hospital():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Hospital name is required'}), 400
    hosp = Hospital(
        name=data['name'],
        address=data.get('address'),
        phone=data.get('phone')
    )
    db.session.add(hosp)
    db.session.commit()
    return jsonify({'hospital': hosp.to_dict()}), 201


@admin_bp.route('/hospitals/<int:hospital_id>', methods=['PUT'])
@jwt_required()
@admin_required
def admin_update_hospital(hospital_id):
    hosp = Hospital.query.get_or_404(hospital_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    if 'name' in data:
        hosp.name = data['name']
    if 'address' in data:
        hosp.address = data['address']
    if 'phone' in data:
        hosp.phone = data['phone']
    db.session.commit()
    return jsonify({'hospital': hosp.to_dict()}), 200


@admin_bp.route('/hospitals/<int:hospital_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def admin_delete_hospital(hospital_id):
    hosp = Hospital.query.get_or_404(hospital_id)
    db.session.delete(hosp)
    db.session.commit()
    return jsonify({'message': 'Hospital deleted successfully'}), 200


@admin_bp.route('/doctor-requests', methods=['GET'])
@jwt_required()
@staff_required
def list_doctor_requests():
    from app.models.user import DoctorRegistrationRequest
    reqs = DoctorRegistrationRequest.query.order_by(DoctorRegistrationRequest.created_at.desc()).all()
    return jsonify({'requests': [r.to_dict() for r in reqs]}), 200


@admin_bp.route('/doctor-requests/<int:req_id>/approve', methods=['POST'])
@jwt_required()
@admin_required
def approve_doctor_request(req_id):
    from app.models.user import DoctorRegistrationRequest
    from app.models.appointment import Hospital, Department, DoctorProfile
    from app.models.notification import Notification
    
    req = DoctorRegistrationRequest.query.get_or_404(req_id)
    if req.status != 'pending':
        return jsonify({'error': f'Request already {req.status}'}), 400

    # 1. Create user account
    user = User(
        name=req.name,
        email=req.email,
        password_hash=req.password_hash,
        role='doctor',
        phone=req.phone,
        avatar=req.profile_photo,
        is_active=True
    )
    db.session.add(user)
    db.session.flush()

    # 2. Get or create hospital
    hospital = Hospital.query.filter(Hospital.name.ilike(req.hospital_name)).first()
    if not hospital:
        hospital = Hospital(
            name=req.hospital_name,
            address=req.hospital_address or 'City Center',
            phone=req.hospital_phone or '0000000000'
        )
        db.session.add(hospital)
        db.session.flush()

    # 3. Find department
    # Specialization can be comma-separated, take the first one to find/match a department code if possible
    spec_first = req.specialization.split(',')[0].strip() if req.specialization else 'General Medicine'
    department = Department.query.filter(Department.name.ilike(spec_first)).first()
    if not department:
        department = Department.query.filter_by(code='GENM').first()

    # 4. Create doctor profile with all credentials and slots
    profile = DoctorProfile(
        user_id=user.id,
        department_id=department.id if department else None,
        hospital_id=hospital.id,
        specialization=req.specialization,
        qualification=req.qualification or 'MD',
        experience_years=req.experience_years or 0,
        consultation_fee=req.consultation_fee or 0.0,
        available_days=req.available_days or 'Mon,Tue,Wed,Thu,Fri',
        slot_duration_mins=15,
        max_patients_per_day=30,
        is_available=True,
        
        # New credentials fields
        medical_reg_number=req.medical_reg_number,
        medical_council_reg_id=req.medical_council_reg_id,
        highest_degree=req.highest_degree,
        university_name=req.university_name,
        graduation_year=req.graduation_year,
        available_slots=req.available_slots,
        consultation_types=req.consultation_types,
        license_file=req.license_file,
        certificate_file=req.certificate_file,
        gov_id_file=req.gov_id_file,
        experience_cert_file=req.experience_cert_file,
        additional_cert_file=req.additional_cert_file,
        rating=4.8
    )
    db.session.add(profile)
    
    # 5. Create welcoming in-app notification
    welcome_notif = Notification(
        user_id=user.id,
        title="Welcome to LifePulse!",
        message=f"Dear Dr. {user.name}, your registration request has been approved. Your Doctor ID is {profile.doctor_code}. You can now access your clinical workstation.",
        type="info"
    )
    db.session.add(welcome_notif)
    
    req.status = 'approved'
    db.session.commit()

    return jsonify({
        'message': 'Doctor registration approved successfully.',
        'doctor': profile.to_dict()
    }), 200


@admin_bp.route('/doctor-requests/<int:req_id>/reject', methods=['POST'])
@jwt_required()
@admin_required
def reject_doctor_request(req_id):
    from app.models.user import DoctorRegistrationRequest
    data = request.get_json() or {}
    reason = data.get('reason', 'Credentials could not be verified')

    req = DoctorRegistrationRequest.query.get_or_404(req_id)
    if req.status != 'pending':
        return jsonify({'error': f'Request already {req.status}'}), 400

    req.status = 'rejected'
    req.rejection_reason = reason
    db.session.commit()

    return jsonify({'message': 'Doctor registration request rejected.', 'request': req.to_dict()}), 200


@admin_bp.route('/doctor-requests/documents/<filename>', methods=['GET'])
def download_doctor_document(filename):
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'doctor_documents')
    file_path = os.path.join(folder, filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    return send_file(file_path)
