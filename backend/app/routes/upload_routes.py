import os
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app import db
from app.models.patient import Patient, PatientReport
from app.utils.auth_middleware import staff_required

upload_bp = Blueprint('uploads', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@upload_bp.route('/patients/<int:patient_id>/reports', methods=['POST'])
@jwt_required()
@staff_required
def upload_report(patient_id):
    Patient.query.get_or_404(patient_id)

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed. Accepted: {", ".join(ALLOWED_EXTENSIONS)}'}), 422

    user_id = get_jwt_identity()
    filename = secure_filename(file.filename)
    unique_name = f"patient_{patient_id}_{int(__import__('time').time())}_{filename}"

    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'reports')
    os.makedirs(folder, exist_ok=True)
    file_path = os.path.join(folder, unique_name)
    file.save(file_path)

    report = PatientReport(
        patient_id=patient_id,
        uploaded_by=int(user_id),
        report_name=request.form.get('report_name', filename),
        report_type=request.form.get('report_type', 'other'),
        file_path=file_path,
        file_name=unique_name,
        file_size=os.path.getsize(file_path),
        mime_type=file.content_type,
        description=request.form.get('description'),
        report_date=request.form.get('report_date')
    )
    db.session.add(report)
    db.session.commit()

    return jsonify({'message': 'Report uploaded', 'report': report.to_dict()}), 201


@upload_bp.route('/<int:report_id>/download', methods=['GET'])
def download_report(report_id):
    report = PatientReport.query.get_or_404(report_id)
    if not os.path.exists(report.file_path):
        return jsonify({'error': 'File not found on server'}), 404
    return send_file(report.file_path)


@upload_bp.route('/<int:report_id>', methods=['DELETE'])
@jwt_required()
@staff_required
def delete_report(report_id):
    report = PatientReport.query.get_or_404(report_id)
    if os.path.exists(report.file_path):
        os.remove(report.file_path)
    db.session.delete(report)
    db.session.commit()
    return jsonify({'message': 'Report deleted'}), 200


@upload_bp.route('/reports', methods=['GET'])
@jwt_required()
@staff_required
def list_all_reports():
    report_type = request.args.get('report_type')
    user_id = get_jwt_identity()
    from app.models.user import User
    user = User.query.get(user_id)
    
    query = PatientReport.query
    if user.role == 'doctor':
        from app.models.appointment import DoctorProfile, Appointment
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({'reports': []}), 200
        subquery = db.session.query(Appointment.patient_id).filter(
            Appointment.doctor_profile_id == doctor_profile.id
        ).subquery()
        query = query.filter(
            (PatientReport.patient_id.in_(subquery)) | (PatientReport.uploaded_by == user.id)
        )
        
    if report_type:
        query = query.filter_by(report_type=report_type)
        
    reports = query.order_by(PatientReport.uploaded_at.desc()).all()
    res = []
    for r in reports:
        d = r.to_dict()
        d['patient_name'] = r.patient.full_name if r.patient else 'Unknown'
        d['patient_code'] = r.patient.patient_code if r.patient else 'Unknown'
        res.append(d)
    return jsonify({'reports': res}), 200
