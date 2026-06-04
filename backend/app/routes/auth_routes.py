import random
import string
import os
import re
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash
from werkzeug.utils import secure_filename

from app import db
from app.models.user import User

auth_bp = Blueprint('auth', __name__)


def generate_patient_code():
    return 'LP' + ''.join(random.choices(string.digits, k=8))


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['name', 'email', 'password']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 422

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        name=data['name'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        role=data.get('role', 'patient'),
        phone=data.get('phone')
    )
    db.session.add(user)
    db.session.commit()

    if user.role == 'patient':
        from app.models.patient import Patient
        name_parts = data['name'].strip().split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else 'Patient'

        # Generate a unique code
        code = generate_patient_code()
        while Patient.query.filter_by(patient_code=code).first():
            code = generate_patient_code()

        patient_profile = Patient(
            user_id=user.id,
            patient_code=code,
            first_name=first_name,
            last_name=last_name,
            date_of_birth=datetime.strptime(data.get('date_of_birth', '1990-01-01'), '%Y-%m-%d').date(),
            gender=data.get('gender', 'other'),
            phone=data.get('phone', '0000000000'),
            email=data['email'],
            status='active'
        )
        db.session.add(patient_profile)
        db.session.commit()

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'name': user.name}
    )
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    email_or_id = data.get('email', '').strip()
    password = data.get('password', '')

    user = None
    # Check if login is via Doctor ID (e.g. DOC001)
    match = re.match(r'^DOC(\d+)$', email_or_id, re.IGNORECASE)
    if match:
        doc_id = int(match.group(1))
        from app.models.appointment import DoctorProfile
        profile = DoctorProfile.query.get(doc_id)
        if profile and profile.user:
            user = profile.user
    else:
        user = User.query.filter_by(email=email_or_id).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email, doctor ID or password'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is deactivated. Contact admin.'}), 403

    user.last_login = datetime.utcnow()
    db.session.commit()

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'name': user.name}
    )
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'name': user.name}
    )
    return jsonify({'access_token': access_token}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # Client-side token removal; server-side blocklist can be added later
    return jsonify({'message': 'Logged out successfully'}), 200


@auth_bp.route('/upload-document', methods=['POST'])
def upload_document():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Validate size (5MB maximum)
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > 5 * 1024 * 1024:
        return jsonify({'error': 'File size exceeds maximum limit of 5MB'}), 400

    # Validate extension
    allowed_exts = {'pdf', 'png', 'jpg', 'jpeg'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_exts:
        return jsonify({'error': 'Invalid file type. Only PDF, PNG, JPG, and JPEG are accepted.'}), 400

    filename = secure_filename(file.filename)
    unique_name = f"doc_{int(__import__('time').time())}_{filename}"

    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'doctor_documents')
    os.makedirs(folder, exist_ok=True)
    file_path = os.path.join(folder, unique_name)
    file.save(file_path)

    return jsonify({'filename': unique_name}), 200


@auth_bp.route('/doctor-register', methods=['POST'])
def doctor_register():
    from app.models.user import DoctorRegistrationRequest
    from werkzeug.security import generate_password_hash

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['name', 'email', 'password', 'phone', 'medical_reg_number', 'specialization', 'hospital_name']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f.replace("_", " ").title()} is required'}), 422

    # Check if email is already registered in User or DoctorRegistrationRequest
    if User.query.filter_by(email=data['email']).first() or DoctorRegistrationRequest.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    # Check if mobile phone is already registered in User or DoctorRegistrationRequest
    if User.query.filter_by(phone=data['phone']).first() or DoctorRegistrationRequest.query.filter_by(phone=data['phone']).first():
        return jsonify({'error': 'Phone number already registered'}), 409

    # Save doctor registration request
    req = DoctorRegistrationRequest(
        name=data['name'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        phone=data['phone'],
        dob=data.get('dob'),
        gender=data.get('gender', 'other'),
        profile_photo=data.get('profile_photo'),
        
        medical_reg_number=data['medical_reg_number'],
        medical_council_reg_id=data.get('medical_council_reg_id'),
        qualification=data.get('qualification'),
        highest_degree=data.get('highest_degree'),
        university_name=data.get('university_name'),
        graduation_year=int(data.get('graduation_year')) if data.get('graduation_year') else None,
        experience_years=int(data.get('experience_years', 0)) if data.get('experience_years') else 0,
        specialization=data['specialization'],
        
        hospital_name=data['hospital_name'],
        hospital_address=data.get('hospital_address'),
        hospital_city=data.get('hospital_city'),
        hospital_state=data.get('hospital_state'),
        hospital_phone=data.get('hospital_phone'),
        hospital_pincode=data.get('hospital_pincode'),
        
        consultation_fee=float(data.get('consultation_fee', 0.0)) if data.get('consultation_fee') else 0.0,
        available_days=data.get('available_days', 'Mon,Tue,Wed,Thu,Fri'),
        available_slots=data.get('available_slots'),
        consultation_types=data.get('consultation_types'),
        supports_video=data.get('supports_video', False) in [True, 'yes', 'Yes', 1],
        
        license_file=data.get('license_file'),
        certificate_file=data.get('certificate_file'),
        gov_id_file=data.get('gov_id_file'),
        experience_cert_file=data.get('experience_cert_file'),
        additional_cert_file=data.get('additional_cert_file'),
        bio=data.get('bio'),
        status='pending'
    )
    db.session.add(req)
    db.session.commit()

    return jsonify({
        'message': 'Your registration request has been submitted successfully. The administrator will verify your credentials and activate your account.'
    }), 201
