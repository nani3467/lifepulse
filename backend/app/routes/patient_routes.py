import random, string
from datetime import datetime, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import func, or_

from app import db
from app.models.user import User
from app.models.patient import Patient, MedicalHistory, Admission, DiseaseRecord, PatientReport, PatientVitalsLog, HealthScan
from app.utils.auth_middleware import staff_required, doctor_required

patient_bp = Blueprint('patients', __name__)


def _check_patient_access(patient_id):
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get('role')
    
    if role == 'patient':
        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient or patient.id != patient_id:
            return False, 'Access forbidden: this is not your profile'
    elif role == 'doctor':
        from app.models.appointment import DoctorProfile, Appointment
        doctor_profile = DoctorProfile.query.filter_by(user_id=user_id).first()
        if not doctor_profile:
            return False, 'Doctor profile not found'
        exists = Appointment.query.filter_by(
            doctor_profile_id=doctor_profile.id,
            patient_id=patient_id
        ).first()
        if not exists:
            return False, 'Access forbidden: this patient is not assigned to you'
    elif role not in ['admin', 'receptionist']:
        return False, 'Access forbidden: insufficient permissions'
        
    return True, None


def _generate_patient_code():
    while True:
        code = 'LP' + ''.join(random.choices(string.digits, k=8))
        if not Patient.query.filter_by(patient_code=code).first():
            return code


# ─── PATIENTS CRUD ──────────────────────────────────────────────────────────

@patient_bp.route('', methods=['GET'])
@jwt_required()
def list_patients():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get('role', 'patient')

    if role == 'patient':
        # Return only the logged-in patient's profile
        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            return jsonify({'patients': [], 'total': 0, 'pages': 0, 'current_page': 1}), 200
        return jsonify({
            'patients': [patient.to_dict()],
            'total': 1,
            'pages': 1,
            'current_page': 1
        }), 200

    # For staff, check credentials and filter normally
    if role not in ['admin', 'doctor', 'receptionist']:
        return jsonify({'error': 'Staff access required'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    gender = request.args.get('gender', '')
    blood_group = request.args.get('blood_group', '')
    sort_by = request.args.get('sort_by', 'created_at')
    sort_dir = request.args.get('sort_dir', 'desc')

    query = Patient.query
    if role == 'doctor':
        from app.models.appointment import DoctorProfile, Appointment
        doctor_profile = DoctorProfile.query.filter_by(user_id=user_id).first()
        if not doctor_profile:
            return jsonify({'patients': [], 'total': 0, 'pages': 0, 'page': 1, 'per_page': 10}), 200
        query = query.join(Appointment, Appointment.patient_id == Patient.id).filter(
            Appointment.doctor_profile_id == doctor_profile.id
        ).distinct()

    if search:
        like = f'%{search}%'
        query = query.filter(
            or_(
                Patient.first_name.ilike(like),
                Patient.last_name.ilike(like),
                Patient.patient_code.ilike(like),
                Patient.phone.ilike(like),
                Patient.email.ilike(like)
            )
        )
    if status:
        query = query.filter(Patient.status == status)
    if gender:
        query = query.filter(Patient.gender == gender)
    if blood_group:
        query = query.filter(Patient.blood_group == blood_group)

    sort_col = getattr(Patient, sort_by, Patient.created_at)
    query = query.order_by(sort_col.desc() if sort_dir == 'desc' else sort_col.asc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'patients': [p.to_dict() for p in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page
    }), 200


@patient_bp.route('/<int:patient_id>', methods=['GET'])
@jwt_required()
@staff_required
def get_patient(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    patient = Patient.query.get_or_404(patient_id, description='Patient not found')
    return jsonify({'patient': patient.to_dict(include_details=True)}), 200


@patient_bp.route('', methods=['POST'])
@jwt_required()
@staff_required
def create_patient():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 422

    patient = Patient(
        patient_code=_generate_patient_code(),
        first_name=data['first_name'],
        last_name=data['last_name'],
        date_of_birth=date.fromisoformat(data['date_of_birth']),
        gender=data['gender'],
        blood_group=data.get('blood_group'),
        phone=data['phone'],
        email=data.get('email'),
        address=data.get('address'),
        city=data.get('city'),
        state=data.get('state'),
        pincode=data.get('pincode'),
        emergency_name=data.get('emergency_name'),
        emergency_phone=data.get('emergency_phone'),
        emergency_relation=data.get('emergency_relation'),
        allergies=data.get('allergies'),
        chronic_conditions=data.get('chronic_conditions'),
        current_medications=data.get('current_medications'),
        insurance_provider=data.get('insurance_provider'),
        insurance_id=data.get('insurance_id'),
        notes=data.get('notes'),
        status='active'
    )
    db.session.add(patient)
    db.session.commit()

    return jsonify({'message': 'Patient created', 'patient': patient.to_dict()}), 201


@patient_bp.route('/<int:patient_id>', methods=['PUT'])
@jwt_required()
@staff_required
def update_patient(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    patient = Patient.query.get_or_404(patient_id, description='Patient not found')
    data = request.get_json()

    for field in ['first_name', 'last_name', 'gender', 'blood_group', 'phone',
                  'email', 'address', 'city', 'state', 'pincode',
                  'emergency_name', 'emergency_phone', 'emergency_relation',
                  'allergies', 'chronic_conditions', 'current_medications',
                  'insurance_provider', 'insurance_id', 'notes', 'status']:
        if field in data:
            setattr(patient, field, data[field])

    if 'date_of_birth' in data:
        patient.date_of_birth = date.fromisoformat(data['date_of_birth'])

    db.session.commit()
    return jsonify({'message': 'Patient updated', 'patient': patient.to_dict()}), 200


@patient_bp.route('/<int:patient_id>', methods=['DELETE'])
@jwt_required()
@doctor_required
def delete_patient(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    patient = Patient.query.get_or_404(patient_id, description='Patient not found')
    db.session.delete(patient)
    db.session.commit()
    return jsonify({'message': 'Patient deleted'}), 200


# ─── MEDICAL HISTORY ────────────────────────────────────────────────────────

@patient_bp.route('/<int:patient_id>/history', methods=['GET'])
@jwt_required()
@staff_required
def get_history(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    Patient.query.get_or_404(patient_id)
    records = MedicalHistory.query.filter_by(patient_id=patient_id)\
        .order_by(MedicalHistory.date.desc()).all()
    return jsonify({'history': [r.to_dict() for r in records]}), 200


@patient_bp.route('/<int:patient_id>/history', methods=['POST'])
@jwt_required()
@doctor_required
def add_history(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    Patient.query.get_or_404(patient_id)
    data = request.get_json()
    user_id = get_jwt_identity()

    record = MedicalHistory(
        patient_id=patient_id,
        doctor_id=int(user_id),
        date=date.fromisoformat(data.get('date', str(date.today()))),
        visit_type=data.get('visit_type', 'consultation'),
        chief_complaint=data.get('chief_complaint'),
        diagnosis=data.get('diagnosis', ''),
        treatment=data.get('treatment'),
        prescription=data.get('prescription'),
        notes=data.get('notes'),
        follow_up_date=date.fromisoformat(data['follow_up_date']) if data.get('follow_up_date') else None
    )
    db.session.add(record)
    db.session.commit()
    return jsonify({'message': 'History added', 'record': record.to_dict()}), 201


@patient_bp.route('/history/<int:record_id>', methods=['PUT'])
@jwt_required()
@doctor_required
def update_history(record_id):
    record = MedicalHistory.query.get_or_404(record_id)
    allowed, msg = _check_patient_access(record.patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    data = request.get_json()
    for field in ['diagnosis', 'treatment', 'prescription', 'notes', 'chief_complaint', 'visit_type']:
        if field in data:
            setattr(record, field, data[field])
    if 'follow_up_date' in data:
        record.follow_up_date = date.fromisoformat(data['follow_up_date']) if data['follow_up_date'] else None
    db.session.commit()
    return jsonify({'message': 'History updated', 'record': record.to_dict()}), 200


@patient_bp.route('/history/<int:record_id>', methods=['DELETE'])
@jwt_required()
@doctor_required
def delete_history(record_id):
    record = MedicalHistory.query.get_or_404(record_id)
    allowed, msg = _check_patient_access(record.patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    db.session.delete(record)
    db.session.commit()
    return jsonify({'message': 'Record deleted'}), 200


# ─── ADMISSIONS ─────────────────────────────────────────────────────────────

@patient_bp.route('/<int:patient_id>/admissions', methods=['GET'])
@jwt_required()
@staff_required
def get_admissions(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    Patient.query.get_or_404(patient_id)
    admissions = Admission.query.filter_by(patient_id=patient_id)\
        .order_by(Admission.admit_date.desc()).all()
    return jsonify({'admissions': [a.to_dict() for a in admissions]}), 200


@patient_bp.route('/<int:patient_id>/admit', methods=['POST'])
@jwt_required()
@staff_required
def admit_patient(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    patient = Patient.query.get_or_404(patient_id)
    data = request.get_json()
    user_id = get_jwt_identity()

    # Check if already admitted
    active = Admission.query.filter_by(patient_id=patient_id, status='admitted').first()
    if active:
        return jsonify({'error': 'Patient is already admitted'}), 409

    admission = Admission(
        patient_id=patient_id,
        doctor_id=int(user_id),
        ward=data.get('ward'),
        room_number=data.get('room_number'),
        bed_number=data.get('bed_number'),
        admit_date=datetime.utcnow(),
        reason=data.get('reason', ''),
        diagnosis_at_admission=data.get('diagnosis_at_admission'),
        status='admitted'
    )
    patient.status = 'admitted'
    db.session.add(admission)
    db.session.commit()
    return jsonify({'message': 'Patient admitted', 'admission': admission.to_dict()}), 201


@patient_bp.route('/admissions/<int:admission_id>/discharge', methods=['POST'])
@jwt_required()
@staff_required
def discharge_patient(admission_id):
    admission = Admission.query.get_or_404(admission_id)
    allowed, msg = _check_patient_access(admission.patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    data = request.get_json()

    admission.discharge_date = datetime.utcnow()
    admission.status = 'discharged'
    admission.diagnosis_at_discharge = data.get('diagnosis_at_discharge')
    admission.discharge_notes = data.get('discharge_notes')
    admission.total_cost = data.get('total_cost')

    patient = Patient.query.get(admission.patient_id)
    if patient:
        patient.status = 'discharged'

    db.session.commit()
    return jsonify({'message': 'Patient discharged', 'admission': admission.to_dict()}), 200


# ─── DISEASE RECORDS ─────────────────────────────────────────────────────────

@patient_bp.route('/<int:patient_id>/diseases', methods=['GET'])
@jwt_required()
@staff_required
def get_diseases(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    Patient.query.get_or_404(patient_id)
    diseases = DiseaseRecord.query.filter_by(patient_id=patient_id).all()
    return jsonify({'diseases': [d.to_dict() for d in diseases]}), 200


@patient_bp.route('/<int:patient_id>/diseases', methods=['POST'])
@jwt_required()
@doctor_required
def add_disease(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    Patient.query.get_or_404(patient_id)
    data = request.get_json()

    record = DiseaseRecord(
        patient_id=patient_id,
        disease_name=data.get('disease_name', ''),
        icd_code=data.get('icd_code'),
        category=data.get('category'),
        severity=data.get('severity', 'mild'),
        diagnosed_date=date.fromisoformat(data.get('diagnosed_date', str(date.today()))),
        is_chronic=data.get('is_chronic', False),
        status=data.get('status', 'active'),
        notes=data.get('notes')
    )
    db.session.add(record)
    db.session.commit()
    return jsonify({'message': 'Disease record added', 'disease': record.to_dict()}), 201


@patient_bp.route('/diseases/<int:record_id>', methods=['PUT'])
@jwt_required()
@doctor_required
def update_disease(record_id):
    record = DiseaseRecord.query.get_or_404(record_id)
    allowed, msg = _check_patient_access(record.patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    data = request.get_json()
    for field in ['disease_name', 'icd_code', 'category', 'severity', 'is_chronic', 'status', 'notes']:
        if field in data:
            setattr(record, field, data[field])
    if 'resolved_date' in data:
        record.resolved_date = date.fromisoformat(data['resolved_date']) if data['resolved_date'] else None
    db.session.commit()
    return jsonify({'message': 'Disease updated', 'disease': record.to_dict()}), 200


@patient_bp.route('/diseases/<int:record_id>', methods=['DELETE'])
@jwt_required()
@doctor_required
def delete_disease(record_id):
    record = DiseaseRecord.query.get_or_404(record_id)
    allowed, msg = _check_patient_access(record.patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    db.session.delete(record)
    db.session.commit()
    return jsonify({'message': 'Disease record deleted'}), 200


# ─── ANALYTICS ───────────────────────────────────────────────────────────────

@patient_bp.route('/analytics/overview', methods=['GET'])
@jwt_required()
@staff_required
def analytics_overview():
    total = Patient.query.count()
    by_status = db.session.query(Patient.status, func.count(Patient.id))\
        .group_by(Patient.status).all()
    by_gender = db.session.query(Patient.gender, func.count(Patient.id))\
        .group_by(Patient.gender).all()
    by_blood = db.session.query(Patient.blood_group, func.count(Patient.id))\
        .filter(Patient.blood_group != None)\
        .group_by(Patient.blood_group).all()

    # Disease trend (top 10)
    disease_trend = db.session.query(
        DiseaseRecord.disease_name,
        DiseaseRecord.category,
        func.count(DiseaseRecord.id).label('count')
    ).group_by(DiseaseRecord.disease_name, DiseaseRecord.category)\
     .order_by(func.count(DiseaseRecord.id).desc()).limit(10).all()

    # Monthly admissions (last 12 months)
    monthly_admissions = db.session.query(
        func.strftime('%Y-%m', Admission.admit_date).label('month'),
        func.count(Admission.id).label('count')
    ).group_by('month').order_by('month').limit(12).all()

    # Severity breakdown
    severity_dist = db.session.query(
        DiseaseRecord.severity, func.count(DiseaseRecord.id)
    ).group_by(DiseaseRecord.severity).all()

    return jsonify({
        'total_patients': total,
        'by_status': {s: c for s, c in by_status},
        'by_gender': {g: c for g, c in by_gender},
        'by_blood_group': {b: c for b, c in by_blood},
        'disease_trend': [
            {'disease': d, 'category': cat, 'count': c}
            for d, cat, c in disease_trend
        ],
        'monthly_admissions': [
            {'month': m, 'count': c} for m, c in monthly_admissions
        ],
        'severity_distribution': {s: c for s, c in severity_dist}
    }), 200


@patient_bp.route('/<int:patient_id>/vitals', methods=['POST'])
@jwt_required()
def add_patient_vitals(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    patient = Patient.query.get_or_404(patient_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Calculate Wellness Score
    hr = int(data.get('heart_rate', 72))
    sys_bp = int(data.get('systolic_bp', 120))
    dia_bp = int(data.get('diastolic_bp', 80))
    spo2 = int(data.get('oxygen_level', 98))
    sugar = int(data.get('blood_sugar', 95))
    sleep = int(data.get('sleep_quality', 8))
    stress = data.get('stress_level', 'normal')

    wellness_score = 100
    if hr < 60 or hr > 100:
        wellness_score -= 10
    if hr < 50 or hr > 120:
        wellness_score -= 10

    if sys_bp > 140 or dia_bp > 90:
        wellness_score -= 15
    if sys_bp < 90 or dia_bp < 60:
        wellness_score -= 10

    if spo2 < 95:
        wellness_score -= 15
    if spo2 < 90:
        wellness_score -= 20

    if sugar > 140 or sugar < 70:
        wellness_score -= 15

    if sleep < 6:
        wellness_score -= 10

    if stress == 'high':
        wellness_score -= 15
    elif stress == 'medium':
        wellness_score -= 5

    wellness_score = max(20, min(100, wellness_score))

    # Generate Daily AI Recommendations
    rec = []
    if spo2 < 95:
        rec.append("Estimated low oxygen levels. Possible respiratory congestion. Seek physician consult.")
    if sys_bp > 140 or dia_bp > 90:
        rec.append("Estimated elevated blood pressure. Limit sodium intake and schedule a clinical checkup.")
    if hr > 100:
        rec.append("Tachycardia indicator detected. Rest and monitor; avoid stimulants.")
    if sugar > 140:
        rec.append("Elevated estimated blood sugar. Avoid high glycemic foods; track activity levels.")
    if sleep < 6:
        rec.append("Inadequate sleep logged. Prioritize 7-8 hours of sleep for cellular recovery.")
    
    if not rec:
        rec.append("All estimated metrics fall within stable ranges. Continue active lifestyle & hydration.")
    
    daily_health_insights = " | ".join(rec)

    log = PatientVitalsLog(
        patient_id=patient_id,
        heart_rate=hr,
        systolic_bp=sys_bp,
        diastolic_bp=dia_bp,
        oxygen_level=spo2,
        blood_sugar=sugar,
        stress_level=stress,
        respiratory_rate=int(data.get('respiratory_rate', 16)),
        asthma_indicator=data.get('asthma_indicator', 'normal'),
        pneumonia_risk=data.get('pneumonia_risk', 'low'),
        bronchitis_symptoms=data.get('bronchitis_symptoms', 'none'),
        mood_score=data.get('mood_score', 'good'),
        sleep_quality=sleep,
        skin_condition=data.get('skin_condition', 'normal'),
        eye_redness=data.get('eye_redness', 'normal'),
        diabetes_risk=data.get('diabetes_risk', 'Low Risk'),
        wellness_score=wellness_score,
        daily_health_insights=daily_health_insights
    )

    db.session.add(log)
    db.session.commit()

    return jsonify({'message': 'Vitals log saved successfully', 'log': log.to_dict()}), 201


@patient_bp.route('/<int:patient_id>/vitals', methods=['GET'])
@jwt_required()
def get_patient_vitals(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    logs = PatientVitalsLog.query.filter_by(patient_id=patient_id).order_by(PatientVitalsLog.created_at.desc()).all()
    return jsonify({'logs': [l.to_dict() for l in logs]}), 200


@patient_bp.route('/<int:patient_id>/health-scans', methods=['POST'])
@jwt_required()
def add_health_scan(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    patient = Patient.query.get_or_404(patient_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    heart_rate = data.get('heart_rate')
    hrv = data.get('hrv')
    spo2 = data.get('spo2')
    respiratory_rate = data.get('respiratory_rate')
    stress_score = data.get('stress_score')
    stress_level = data.get('stress_level')
    recovery_score = data.get('recovery_score')
    health_score = data.get('health_score')

    systolic_bp = data.get('systolic_bp')
    diastolic_bp = data.get('diastolic_bp')
    bp_category = data.get('bp_category')

    fatigue_level = data.get('fatigue_level')
    alertness_score = data.get('alertness_score')

    height = data.get('height')
    weight = data.get('weight')
    bmi = data.get('bmi')
    weight_category = data.get('weight_category')

    # Generate Recommendations
    rec = []
    if spo2 and spo2 < 95:
        rec.append("Oxygen saturation appears low. Consider consulting a healthcare professional.")
    if stress_score and stress_score >= 50:
        rec.append("Stress levels appear elevated. Consider breathing exercises and adequate rest.")
    if not rec:
        rec.append("Your health indicators are stable. Continue regular exercise and hydration.")
    
    recommendation_text = " | ".join(rec)

    scan = HealthScan(
        patient_id=patient_id,
        heart_rate=heart_rate,
        hrv=hrv,
        spo2=spo2,
        respiratory_rate=respiratory_rate,
        stress_score=stress_score,
        stress_level=stress_level,
        recovery_score=recovery_score,
        health_score=health_score,
        recommendations=recommendation_text,
        systolic_bp=systolic_bp,
        diastolic_bp=diastolic_bp,
        bp_category=bp_category,
        fatigue_level=fatigue_level,
        alertness_score=alertness_score,
        height=height,
        weight=weight,
        bmi=bmi,
        weight_category=weight_category
    )

    db.session.add(scan)
    db.session.commit()

    return jsonify({'message': 'Health scan saved successfully', 'scan': scan.to_dict()}), 201


@patient_bp.route('/<int:patient_id>/health-scans', methods=['GET'])
@jwt_required()
def get_health_scans(patient_id):
    allowed, msg = _check_patient_access(patient_id)
    if not allowed:
        return jsonify({'error': msg}), 403
    scans = HealthScan.query.filter_by(patient_id=patient_id).order_by(HealthScan.created_at.desc()).all()
    return jsonify({'scans': [s.to_dict() for s in scans]}), 200


@patient_bp.route('/admissions', methods=['GET'])
@jwt_required()
@staff_required
def list_all_admissions():
    status = request.args.get('status')
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    query = Admission.query
    if user.role == 'doctor':
        from app.models.appointment import DoctorProfile, Appointment
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({'admissions': []}), 200
        subquery = db.session.query(Appointment.patient_id).filter(
            Appointment.doctor_profile_id == doctor_profile.id
        ).subquery()
        query = query.filter(
            (Admission.patient_id.in_(subquery)) | (Admission.doctor_id == user.id)
        )
        
    if status:
        query = query.filter_by(status=status)
        
    admissions = query.order_by(Admission.admit_date.desc()).all()
    res = []
    for a in admissions:
        d = a.to_dict()
        d['patient_name'] = a.patient.full_name if a.patient else 'Unknown'
        d['patient_code'] = a.patient.patient_code if a.patient else 'Unknown'
        res.append(d)
    return jsonify({'admissions': res}), 200


@patient_bp.route('/medical-records', methods=['GET'])
@jwt_required()
@staff_required
def list_all_medical_records():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    query = MedicalHistory.query
    if user.role == 'doctor':
        from app.models.appointment import DoctorProfile, Appointment
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({'history': []}), 200
        subquery = db.session.query(Appointment.patient_id).filter(
            Appointment.doctor_profile_id == doctor_profile.id
        ).subquery()
        query = query.filter(
            (MedicalHistory.patient_id.in_(subquery)) | (MedicalHistory.doctor_id == user.id)
        )
        
    records = query.order_by(MedicalHistory.date.desc()).all()
    res = []
    for r in records:
        d = r.to_dict()
        d['patient_name'] = r.patient.full_name if r.patient else 'Unknown'
        d['patient_code'] = r.patient.patient_code if r.patient else 'Unknown'
        res.append(d)
    return jsonify({'history': res}), 200
