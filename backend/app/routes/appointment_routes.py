import random
import string
from datetime import datetime, date, time, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, or_, extract

from app import db
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import (
    Department, DoctorProfile, TimeSlot, Appointment,
    QueueEntry, AppointmentNotification
)
from app.utils.auth_middleware import staff_required, doctor_required, admin_required

appt_bp = Blueprint('appointments', __name__)


def _doctor_has_access(appointment, user):
    if user.role == 'doctor':
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile or appointment.doctor_profile_id != doctor_profile.id:
            return False
    return True


def _gen_appt_code():
    while True:
        code = 'APT-2026-' + ''.join(random.choices(string.digits, k=4))
        if not Appointment.query.filter_by(appointment_code=code).first():
            return code


def _notify(appointment, notif_type, title, message, user_id=None):
    """Create an in-app notification for an appointment."""
    targets = []
    if user_id:
        targets.append(user_id)
    else:
        # Notify doctor (if linked to a user)
        if appointment.doctor_profile and appointment.doctor_profile.user_id:
            targets.append(appointment.doctor_profile.user_id)
    for uid in targets:
        n = AppointmentNotification(
            appointment_id=appointment.id,
            user_id=uid,
            type=notif_type,
            title=title,
            message=message
        )
        db.session.add(n)

        # Centralized notification push
        from app.routes.notification_routes import create_notification
        create_notification(
            title=title,
            message=message,
            notif_type='appointment',
            user_id=uid,
            link='/appointments'
        )


def _recalc_queue(doctor_profile_id, queue_date):
    """Recalculate positions & estimated wait times for a doctor's queue."""
    entries = QueueEntry.query.filter_by(
        doctor_profile_id=doctor_profile_id,
        queue_date=queue_date,
        status='waiting'
    ).order_by(QueueEntry.token_number).all()

    doc = DoctorProfile.query.get(doctor_profile_id)
    slot_mins = doc.slot_duration_mins if doc else 15

    for i, entry in enumerate(entries):
        entry.position = i + 1
        entry.estimated_wait_mins = i * slot_mins
    db.session.commit()


# ─── DEPARTMENTS ──────────────────────────────────────────────────────────────

@appt_bp.route('/departments', methods=['GET'])
@jwt_required()
def list_departments():
    deps = Department.query.filter_by(is_active=True).all()
    return jsonify({'departments': [d.to_dict() for d in deps]}), 200


@appt_bp.route('/departments', methods=['POST'])
@jwt_required()
@admin_required
def create_department():
    data = request.get_json()
    dep = Department(
        name=data['name'],
        code=data.get('code', data['name'][:5].upper()),
        description=data.get('description'),
        color=data.get('color', '#3b82f6'),
        icon=data.get('icon'),
        location=data.get('location'),
    )
    db.session.add(dep)
    db.session.commit()
    return jsonify({'message': 'Department created', 'department': dep.to_dict()}), 201


@appt_bp.route('/departments/<int:dep_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_department(dep_id):
    dep = Department.query.get_or_404(dep_id)
    data = request.get_json()
    for f in ['name', 'description', 'color', 'icon', 'location', 'is_active']:
        if f in data:
            setattr(dep, f, data[f])
    db.session.commit()
    return jsonify({'department': dep.to_dict()}), 200


# ─── DOCTOR PROFILES ──────────────────────────────────────────────────────────

@appt_bp.route('/doctors', methods=['GET'])
@jwt_required()
def list_doctors():
    dep_id = request.args.get('department_id', type=int)
    hosp_id = request.args.get('hospital_id', type=int)
    q = DoctorProfile.query.filter_by(is_available=True)
    if dep_id:
        q = q.filter_by(department_id=dep_id)
    if hosp_id:
        q = q.filter_by(hospital_id=hosp_id)
    doctors = q.all()
    return jsonify({'doctors': [d.to_dict() for d in doctors]}), 200


@appt_bp.route('/doctors', methods=['POST'])
@jwt_required()
@admin_required
def create_doctor_profile():
    data = request.get_json()
    profile = DoctorProfile(
        user_id=data['user_id'],
        department_id=data.get('department_id'),
        specialization=data.get('specialization'),
        qualification=data.get('qualification'),
        experience_years=data.get('experience_years', 0),
        consultation_fee=data.get('consultation_fee', 0),
        bio=data.get('bio'),
        available_days=data.get('available_days', 'Mon,Tue,Wed,Thu,Fri'),
        slot_duration_mins=data.get('slot_duration_mins', 15),
        max_patients_per_day=data.get('max_patients_per_day', 30),
    )
    db.session.add(profile)
    db.session.commit()
    return jsonify({'doctor': profile.to_dict()}), 201


# ─── TIME SLOTS ───────────────────────────────────────────────────────────────

@appt_bp.route('/slots', methods=['GET'])
@jwt_required()
def get_slots():
    """Get available slots for a doctor on a date. Generates dynamically if none exist."""
    doctor_id = request.args.get('doctor_id', type=int)
    slot_date = request.args.get('date')

    if not doctor_id or not slot_date:
        return jsonify({'error': 'doctor_id and date are required'}), 422

    parsed_date = date.fromisoformat(slot_date)

    slots = TimeSlot.query.filter_by(
        doctor_profile_id=doctor_id,
        date=parsed_date,
        is_blocked=False
    ).order_by(TimeSlot.start_time).all()

    if not slots:
        # Generate slots dynamically for this date based on doctor profile availability
        doctor = DoctorProfile.query.get(doctor_id)
        if doctor and doctor.is_available:
            day_name = parsed_date.strftime('%a')  # e.g. 'Mon', 'Thu'
            working_days = [d.strip() for d in (doctor.available_days or 'Mon,Tue,Wed,Thu,Fri').split(',')]
            if day_name in working_days:
                slot_duration = doctor.slot_duration_mins or 15
                slots_str = doctor.available_slots
                if not slots_str:
                    # Default work slots if doctor has no custom slots
                    slots_str = "09:00 - 13:00, 14:00 - 17:00"
                
                slot_ranges = [s.strip() for s in slots_str.split(',') if s.strip()]
                for range_str in slot_ranges:
                    parts = range_str.split('-')
                    if len(parts) == 2:
                        try:
                            start_str = parts[0].strip()
                            end_str = parts[1].strip()
                            
                            start_dt = datetime.combine(parsed_date, datetime.strptime(start_str, '%H:%M').time())
                            end_dt = datetime.combine(parsed_date, datetime.strptime(end_str, '%H:%M').time())
                            
                            cursor = start_dt
                            while cursor + timedelta(minutes=slot_duration) <= end_dt:
                                existing_slot = TimeSlot.query.filter_by(
                                    doctor_profile_id=doctor_id,
                                    date=parsed_date,
                                    start_time=cursor.time()
                                ).first()
                                
                                if not existing_slot:
                                    slot = TimeSlot(
                                        doctor_profile_id=doctor_id,
                                        department_id=doctor.department_id,
                                        date=parsed_date,
                                        start_time=cursor.time(),
                                        end_time=(cursor + timedelta(minutes=slot_duration)).time(),
                                        is_booked=False
                                    )
                                    db.session.add(slot)
                                cursor += timedelta(minutes=slot_duration)
                        except Exception:
                            pass
                db.session.commit()
                
                # Fetch newly generated slots
                slots = TimeSlot.query.filter_by(
                    doctor_profile_id=doctor_id,
                    date=parsed_date,
                    is_blocked=False
                ).order_by(TimeSlot.start_time).all()

    return jsonify({'slots': [s.to_dict() for s in slots]}), 200


@appt_bp.route('/slots/generate', methods=['POST'])
@jwt_required()
@staff_required
def generate_slots():
    """Generate time slots for a doctor for a given date range."""
    data = request.get_json()
    doctor_id = data['doctor_id']
    start_date = date.fromisoformat(data['start_date'])
    end_date = date.fromisoformat(data.get('end_date', data['start_date']))
    work_start = data.get('work_start', '09:00')
    work_end = data.get('work_end', '17:00')
    break_start = data.get('break_start', '13:00')
    break_end = data.get('break_end', '14:00')

    doctor = DoctorProfile.query.get_or_404(doctor_id)
    slot_mins = doctor.slot_duration_mins
    created = 0

    current_date = start_date
    while current_date <= end_date:
        # Skip dates already having slots
        existing = TimeSlot.query.filter_by(doctor_profile_id=doctor_id, date=current_date).count()
        if existing:
            current_date += timedelta(days=1)
            continue

        ws = datetime.combine(current_date, datetime.strptime(work_start, '%H:%M').time())
        we = datetime.combine(current_date, datetime.strptime(work_end, '%H:%M').time())
        bs = datetime.combine(current_date, datetime.strptime(break_start, '%H:%M').time())
        be = datetime.combine(current_date, datetime.strptime(break_end, '%H:%M').time())

        cursor = ws
        while cursor + timedelta(minutes=slot_mins) <= we:
            # Skip break
            if cursor >= bs and cursor < be:
                cursor = be
                continue
            slot = TimeSlot(
                doctor_profile_id=doctor_id,
                department_id=doctor.department_id,
                date=current_date,
                start_time=cursor.time(),
                end_time=(cursor + timedelta(minutes=slot_mins)).time(),
            )
            db.session.add(slot)
            created += 1
            cursor += timedelta(minutes=slot_mins)

        current_date += timedelta(days=1)

    db.session.commit()
    return jsonify({'message': f'{created} slots generated'}), 201


# ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

@appt_bp.route('', methods=['GET'])
@jwt_required()
def list_appointments():
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    q = Appointment.query

    if user.role == 'patient':
        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient:
            return jsonify({
                'appointments': [],
                'total': 0,
                'pages': 0,
                'page': 1,
                'per_page': 15,
            }), 200
        q = q.filter(Appointment.patient_id == patient.id)
    elif user.role == 'doctor':
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({
                'appointments': [],
                'total': 0,
                'pages': 0,
                'page': 1,
                'per_page': 15,
            }), 200
        q = q.filter(Appointment.doctor_profile_id == doctor_profile.id)
    else:
        claims = get_jwt()
        if claims.get('role') not in ('admin', 'receptionist'):
            return jsonify({'error': 'Access forbidden: insufficient permissions'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 15, type=int)
    status = request.args.get('status', '')
    doctor_id = request.args.get('doctor_id', type=int)
    dep_id = request.args.get('department_id', type=int)
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    search = request.args.get('search', '')
    appt_type = request.args.get('appointment_type', '')
    if status:
        q = q.filter(Appointment.status == status)
    if doctor_id:
        q = q.filter(Appointment.doctor_profile_id == doctor_id)
    if dep_id:
        q = q.filter(Appointment.department_id == dep_id)
    if date_from:
        q = q.filter(Appointment.appointment_date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(Appointment.appointment_date <= date.fromisoformat(date_to))
    if appt_type:
        q = q.filter(Appointment.appointment_type == appt_type)
    if search:
        q = q.join(Patient, Appointment.patient_id == Patient.id).filter(
            or_(
                Patient.first_name.ilike(f'%{search}%'),
                Patient.last_name.ilike(f'%{search}%'),
                Appointment.appointment_code.ilike(f'%{search}%'),
            )
        )

    q = q.order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'appointments': [a.to_dict(include_queue=True) for a in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page,
    }), 200


@appt_bp.route('/calendar', methods=['GET'])
@jwt_required()
@staff_required
def calendar_appointments():
    """Return appointments formatted for calendar view (month range)."""
    year = request.args.get('year', datetime.utcnow().year, type=int)
    month = request.args.get('month', datetime.utcnow().month, type=int)
    doctor_id = request.args.get('doctor_id', type=int)
    dep_id = request.args.get('department_id', type=int)

    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)

    q = Appointment.query.filter(
        Appointment.appointment_date.between(start, end)
    )
    user_identity = get_jwt_identity()
    user = User.query.get(user_identity)
    if user.role == 'doctor':
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({'appointments': []}), 200
        q = q.filter(Appointment.doctor_profile_id == doctor_profile.id)
    else:
        if doctor_id:
            q = q.filter(Appointment.doctor_profile_id == doctor_id)
    if dep_id:
        q = q.filter(Appointment.department_id == dep_id)

    appointments = q.all()
    return jsonify({'appointments': [a.to_dict() for a in appointments]}), 200


@appt_bp.route('/<int:appt_id>', methods=['GET'])
@jwt_required()
@staff_required
def get_appointment(appt_id):
    a = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(a, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    return jsonify({'appointment': a.to_dict(include_queue=True)}), 200


@appt_bp.route('', methods=['POST'])
@jwt_required()
def create_appointment():
    from flask_jwt_extended import get_jwt
    data = request.get_json()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Check permissions
    if user.role == 'patient':
        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient:
            return jsonify({'error': 'Patient profile not found'}), 404
        patient_id = patient.id
    else:
        claims = get_jwt()
        if claims.get('role') not in ('admin', 'doctor', 'receptionist'):
            return jsonify({'error': 'Access forbidden: insufficient permissions'}), 403
        if not data.get('patient_id'):
            return jsonify({'error': 'patient_id is required'}), 422
        patient_id = int(data['patient_id'])

    required = ['appointment_date', 'appointment_time']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 422

    appt_date = date.fromisoformat(data['appointment_date'])
    appt_time = datetime.strptime(data['appointment_time'], '%H:%M').time()

    # Check slot if provided
    slot_id = data.get('time_slot_id')
    slot = None
    if slot_id:
        slot = TimeSlot.query.get(slot_id)
        if not slot:
            return jsonify({'error': 'Time slot not found'}), 404
        if slot.is_booked:
            return jsonify({'error': 'Time slot is already booked'}), 409

    # Get doctor for fee
    doctor = DoctorProfile.query.get(data.get('doctor_profile_id')) if data.get('doctor_profile_id') else None

    consult_type = data.get('consultation_type', 'in_person')
    is_online_consult = (consult_type == 'video')

    appt = Appointment(
        appointment_code=_gen_appt_code(),
        patient_id=patient_id,
        doctor_profile_id=data.get('doctor_profile_id'),
        department_id=data.get('department_id'),
        hospital_id=data.get('hospital_id'),
        time_slot_id=slot_id,
        booked_by=int(user_id),
        appointment_date=appt_date,
        appointment_time=appt_time,
        appointment_type=data.get('appointment_type', 'consultation'),
        consultation_type=consult_type,
        payment_status=data.get('payment_status', 'pending'),
        reason=data.get('reason'),
        symptoms=data.get('symptoms'),
        notes=data.get('notes'),
        priority=data.get('priority', 'normal'),
        is_online=is_online_consult,
        meeting_link=data.get('meeting_link'),
        meeting_id=data.get('meeting_id'),
        consultation_fee=doctor.consultation_fee if doctor else data.get('consultation_fee'),
        status='pending',
    )
    db.session.add(appt)

    if slot:
        slot.is_booked = True

    db.session.flush()  # Get appt.id

    # Create queue entry for today's appointments
    if appt_date == date.today() and doctor:
        last_token = db.session.query(func.max(QueueEntry.token_number)).filter_by(
            doctor_profile_id=doctor.id,
            queue_date=appt_date
        ).scalar() or 0
        queue_entry = QueueEntry(
            appointment_id=appt.id,
            doctor_profile_id=doctor.id,
            queue_date=appt_date,
            token_number=last_token + 1,
            position=last_token + 1,
            estimated_wait_mins=(last_token) * (doctor.slot_duration_mins or 15),
        )
        db.session.add(queue_entry)

    # Notification
    if doctor:
        _notify(
            appt, 'booked',
            'New Appointment Booked',
            f'Patient {appt.patient.full_name} has booked an appointment on {appt_date} at {data["appointment_time"]}.',
            doctor.user_id
        )

    db.session.commit()
    return jsonify({'message': 'Appointment created', 'appointment': appt.to_dict(include_queue=True)}), 201


@appt_bp.route('/<int:appt_id>', methods=['PUT'])
@appt_bp.route('/appointments/<int:appt_id>', methods=['PUT'])
@jwt_required()
@staff_required
def update_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(appt, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    data = request.get_json()
    
    old_status = appt.status
    new_status = data.get('status')
    
    for f in ['reason', 'symptoms', 'notes', 'priority', 'appointment_type', 'is_online', 'meeting_link', 'meeting_id']:
        if f in data:
            setattr(appt, f, data[f])
    if 'appointment_date' in data:
        appt.appointment_date = date.fromisoformat(data['appointment_date'])
    if 'appointment_time' in data:
        appt.appointment_time = datetime.strptime(data['appointment_time'], '%H:%M').time()
        
    if new_status and new_status != old_status:
        if new_status == 'confirmed':
            appt.status = 'confirmed'
            _notify(appt, 'confirmed', '✅ Appointment Confirmed', f'Your appointment (#{appt.appointment_code}) on {appt.appointment_date} at {appt.appointment_time.strftime("%H:%M")} has been confirmed.')
        elif new_status == 'rejected':
            appt.status = 'rejected'
            if appt.time_slot:
                appt.time_slot.is_booked = False
            if appt.queue_entry:
                db.session.delete(appt.queue_entry)
            _notify(appt, 'rejected', '❌ Appointment Rejected', f'Your appointment (#{appt.appointment_code}) was not approved.')
        elif new_status == 'cancelled':
            appt.status = 'cancelled'
            if appt.time_slot:
                appt.time_slot.is_booked = False
            if appt.queue_entry:
                db.session.delete(appt.queue_entry)
            _notify(appt, 'cancelled', '🚫 Appointment Cancelled', f'Appointment #{appt.appointment_code} has been cancelled.')
        elif new_status == 'completed':
            appt.status = 'completed'
            appt.completed_at = datetime.utcnow()
            if appt.queue_entry:
                appt.queue_entry.status = 'done'
        else:
            appt.status = new_status
            
    db.session.commit()
    return jsonify({'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/approve', methods=['POST'])
@jwt_required()
@staff_required
def approve_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(appt, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    if appt.status not in ('pending',):
        return jsonify({'error': f'Cannot approve a {appt.status} appointment'}), 409

    appt.status = 'confirmed'
    _notify(
        appt, 'confirmed',
        '✅ Appointment Confirmed',
        f'Your appointment (#{appt.appointment_code}) on {appt.appointment_date} at '
        f'{appt.appointment_time.strftime("%H:%M")} has been confirmed.',
    )
    db.session.commit()
    return jsonify({'message': 'Appointment confirmed', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/reject', methods=['POST'])
@jwt_required()
@staff_required
def reject_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(appt, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    if appt.status not in ('pending', 'confirmed'):
        return jsonify({'error': f'Cannot reject a {appt.status} appointment'}), 409

    data = request.get_json() or {}
    appt.status = 'rejected'
    appt.rejection_reason = data.get('reason', 'No reason provided')

    # Free the slot
    if appt.time_slot:
        appt.time_slot.is_booked = False

    # Remove from queue
    if appt.queue_entry:
        db.session.delete(appt.queue_entry)

    _notify(
        appt, 'rejected',
        '❌ Appointment Rejected',
        f'Your appointment (#{appt.appointment_code}) was not approved. Reason: {appt.rejection_reason}',
    )
    db.session.commit()
    return jsonify({'message': 'Appointment rejected', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/cancel', methods=['POST'])
@jwt_required()
@staff_required
def cancel_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(appt, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    if appt.status in ('completed', 'cancelled'):
        return jsonify({'error': f'Cannot cancel a {appt.status} appointment'}), 409

    user_id = get_jwt_identity()
    data = request.get_json() or {}
    appt.status = 'cancelled'
    appt.cancelled_by = int(user_id)
    appt.rejection_reason = data.get('reason')

    if appt.time_slot:
        appt.time_slot.is_booked = False
    if appt.queue_entry:
        db.session.delete(appt.queue_entry)

    _notify(appt, 'cancelled', '🚫 Appointment Cancelled', f'Appointment #{appt.appointment_code} has been cancelled.')
    db.session.commit()
    return jsonify({'message': 'Appointment cancelled', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/complete', methods=['POST'])
@jwt_required()
@doctor_required
def complete_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(appt, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    appt.status = 'completed'
    appt.completed_at = datetime.utcnow()

    if appt.queue_entry:
        appt.queue_entry.status = 'done'

    db.session.commit()
    return jsonify({'message': 'Appointment completed', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/reschedule', methods=['POST'])
@jwt_required()
@doctor_required
def propose_reschedule(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(appt, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    data = request.get_json() or {}
    
    new_date_str = data.get('reschedule_date')
    new_time_str = data.get('reschedule_time')
    
    if not new_date_str or not new_time_str:
        return jsonify({'error': 'reschedule_date and reschedule_time are required'}), 422
        
    appt.status = 'rescheduled'
    appt.reschedule_date = date.fromisoformat(new_date_str)
    appt.reschedule_time = datetime.strptime(new_time_str, '%H:%M').time()
    
    # Notify patient
    if appt.patient and appt.patient.user_id:
        _notify(
            appt, 'rescheduled',
            '📅 Reschedule Requested',
            f'Dr. {appt.doctor_profile.user.name if appt.doctor_profile else "Specialist"} requested to reschedule your appointment to {new_date_str} at {new_time_str}. Please accept or reject.',
            appt.patient.user_id
        )
        
    db.session.commit()
    return jsonify({'message': 'Reschedule proposed to patient', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/accept-reschedule', methods=['POST'])
@jwt_required()
def accept_reschedule(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user.role == 'patient':
        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient or appt.patient_id != patient.id:
            return jsonify({'error': 'Access forbidden: this is not your appointment'}), 403
    elif user.role == 'doctor':
        if not _doctor_has_access(appt, user):
            return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    if appt.status != 'rescheduled' or not appt.reschedule_date or not appt.reschedule_time:
        return jsonify({'error': 'No active reschedule proposal found'}), 400
        
    # Promote proposed slot
    appt.appointment_date = appt.reschedule_date
    appt.appointment_time = appt.reschedule_time
    appt.reschedule_date = None
    appt.reschedule_time = None
    appt.status = 'confirmed'
    
    # Notify doctor
    if appt.doctor_profile and appt.doctor_profile.user_id:
        _notify(
            appt, 'confirmed',
            '✅ Reschedule Accepted',
            f'Patient {appt.patient.full_name} accepted the rescheduled slot for {appt.appointment_date} at {appt.appointment_time.strftime("%H:%M")}.',
            appt.doctor_profile.user_id
        )
        
    db.session.commit()
    return jsonify({'message': 'Reschedule proposal accepted', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/reject-reschedule', methods=['POST'])
@jwt_required()
def reject_reschedule(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user.role == 'patient':
        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient or appt.patient_id != patient.id:
            return jsonify({'error': 'Access forbidden: this is not your appointment'}), 403
    elif user.role == 'doctor':
        if not _doctor_has_access(appt, user):
            return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    if appt.status != 'rescheduled':
        return jsonify({'error': 'No active reschedule proposal found'}), 400
        
    appt.reschedule_date = None
    appt.reschedule_time = None
    appt.status = 'cancelled'
    
    # Free the time slot if applicable
    if appt.time_slot:
        appt.time_slot.is_booked = False
        
    # Notify doctor
    if appt.doctor_profile and appt.doctor_profile.user_id:
        _notify(
            appt, 'cancelled',
            '🚫 Reschedule Rejected',
            f'Patient {appt.patient.full_name} rejected the proposed reschedule. Appointment has been cancelled.',
            appt.doctor_profile.user_id
        )
        
    db.session.commit()
    return jsonify({'message': 'Reschedule proposal rejected and appointment cancelled', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>/checkin', methods=['POST'])
@jwt_required()
@staff_required
def checkin_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _doctor_has_access(appt, user):
        return jsonify({'error': 'Access forbidden: you are not assigned to this appointment'}), 403
    if appt.status != 'confirmed':
        return jsonify({'error': 'Only confirmed appointments can check in'}), 409

    appt.checked_in_at = datetime.utcnow()
    if appt.queue_entry:
        appt.queue_entry.status = 'waiting'

    db.session.commit()
    return jsonify({'message': 'Patient checked in', 'appointment': appt.to_dict()}), 200


@appt_bp.route('/<int:appt_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    if appt.time_slot:
        appt.time_slot.is_booked = False
    db.session.delete(appt)
    db.session.commit()
    return jsonify({'message': 'Appointment deleted'}), 200


# ─── QUEUE ────────────────────────────────────────────────────────────────────

@appt_bp.route('/queue', methods=['GET'])
@jwt_required()
@staff_required
def get_queue():
    doctor_id = request.args.get('doctor_id', type=int)
    queue_date_str = request.args.get('date', str(date.today()))
    queue_date = date.fromisoformat(queue_date_str)

    user_identity = get_jwt_identity()
    user = User.query.get(user_identity)
    if user.role == 'doctor':
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({'queue': [], 'total': 0}), 200
        doctor_id = doctor_profile.id

    q = QueueEntry.query.filter_by(queue_date=queue_date)
    if doctor_id:
        q = q.filter_by(doctor_profile_id=doctor_id)
    entries = q.order_by(QueueEntry.token_number).all()

    # Enrich with appointment info
    result = []
    for e in entries:
        d = e.to_dict()
        if e.appointment:
            d['appointment'] = e.appointment.to_dict()
        result.append(d)

    return jsonify({'queue': result, 'total': len(result)}), 200


@appt_bp.route('/queue/<int:entry_id>/call', methods=['POST'])
@jwt_required()
@staff_required
def call_patient(entry_id):
    entry = QueueEntry.query.get_or_404(entry_id)
    user_identity = get_jwt_identity()
    user = User.query.get(user_identity)
    if user.role == 'doctor':
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile or entry.doctor_profile_id != doctor_profile.id:
            return jsonify({'error': 'Access forbidden: you do not manage this queue'}), 403
    entry.status = 'called'
    entry.called_at = datetime.utcnow()

    if entry.appointment:
        entry.appointment.started_at = datetime.utcnow()
        _notify(
            entry.appointment, 'queue_called',
            '📢 You Are Being Called',
            f'Token #{entry.token_number} — Please proceed to the consultation room.',
            entry.appointment.doctor_profile.user_id if entry.appointment.doctor_profile else None
        )

    _recalc_queue(entry.doctor_profile_id, entry.queue_date)
    db.session.commit()
    return jsonify({'message': 'Patient called', 'entry': entry.to_dict()}), 200


@appt_bp.route('/queue/<int:entry_id>/skip', methods=['POST'])
@jwt_required()
@staff_required
def skip_patient(entry_id):
    entry = QueueEntry.query.get_or_404(entry_id)
    user_identity = get_jwt_identity()
    user = User.query.get(user_identity)
    if user.role == 'doctor':
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile or entry.doctor_profile_id != doctor_profile.id:
            return jsonify({'error': 'Access forbidden: you do not manage this queue'}), 403
    entry.status = 'skipped'
    _recalc_queue(entry.doctor_profile_id, entry.queue_date)
    db.session.commit()
    return jsonify({'message': 'Patient skipped', 'entry': entry.to_dict()}), 200


# ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────

@appt_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = int(get_jwt_identity())
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    limit = request.args.get('limit', 20, type=int)

    q = AppointmentNotification.query.filter_by(user_id=user_id)
    if unread_only:
        q = q.filter_by(is_read=False)
    notifications = q.order_by(AppointmentNotification.created_at.desc()).limit(limit).all()
    unread_count = AppointmentNotification.query.filter_by(user_id=user_id, is_read=False).count()

    return jsonify({
        'notifications': [n.to_dict() for n in notifications],
        'unread_count': unread_count
    }), 200


@appt_bp.route('/notifications/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    user_id = int(get_jwt_identity())
    AppointmentNotification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'}), 200


@appt_bp.route('/notifications/<int:notif_id>/read', methods=['POST'])
@jwt_required()
def mark_read(notif_id):
    n = AppointmentNotification.query.get_or_404(notif_id)
    n.is_read = True
    db.session.commit()
    return jsonify({'message': 'Marked as read'}), 200


# ─── ANALYTICS ────────────────────────────────────────────────────────────────

@appt_bp.route('/analytics', methods=['GET'])
@jwt_required()
@staff_required
def analytics():
    today = date.today()

    # Total counts by status
    by_status = db.session.query(Appointment.status, func.count(Appointment.id))\
        .group_by(Appointment.status).all()

    # Today's appointments
    today_total = Appointment.query.filter_by(appointment_date=today).count()
    today_pending = Appointment.query.filter_by(appointment_date=today, status='pending').count()
    today_confirmed = Appointment.query.filter_by(appointment_date=today, status='confirmed').count()
    today_completed = Appointment.query.filter_by(appointment_date=today, status='completed').count()

    # Peak booking hours (by appointment_time hour)
    peak_hours = db.session.query(
        func.strftime('%H', func.datetime(
            func.date(Appointment.appointment_date),
            func.printf('%s:%s', Appointment.appointment_time, '00')
        )).label('hour'),
        func.count(Appointment.id).label('count')
    ).group_by('hour').order_by('hour').all()

    # Safer approach for peak hours using SQLite
    all_appts = Appointment.query.all()
    hour_buckets = {}
    for a in all_appts:
        h = a.appointment_time.hour if a.appointment_time else 0
        hour_buckets[h] = hour_buckets.get(h, 0) + 1
    peak_hours_data = [
        {'hour': f'{h:02d}:00', 'count': hour_buckets.get(h, 0)} for h in range(8, 20)
    ]

    # Department traffic
    dep_traffic = db.session.query(
        Department.name, Department.color, func.count(Appointment.id).label('count')
    ).join(Appointment, Appointment.department_id == Department.id, isouter=True)\
     .group_by(Department.id)\
     .order_by(func.count(Appointment.id).desc()).all()

    # Daily appointments trend (last 30 days)
    from_date = today - timedelta(days=29)
    daily = db.session.query(
        Appointment.appointment_date,
        func.count(Appointment.id).label('count')
    ).filter(Appointment.appointment_date >= from_date)\
     .group_by(Appointment.appointment_date)\
     .order_by(Appointment.appointment_date).all()

    # Avg wait times
    completed_with_wait = Appointment.query.filter(
        Appointment.actual_wait_mins.isnot(None)
    ).all()
    avg_wait = (
        sum(a.actual_wait_mins for a in completed_with_wait) / len(completed_with_wait)
        if completed_with_wait else 0
    )

    # Appointment type distribution
    by_type = db.session.query(Appointment.appointment_type, func.count(Appointment.id))\
        .group_by(Appointment.appointment_type).all()

    # Monthly trend (last 6 months)
    monthly = db.session.query(
        func.strftime('%Y-%m', Appointment.appointment_date).label('month'),
        func.count(Appointment.id).label('count')
    ).filter(Appointment.appointment_date >= today - timedelta(days=180))\
     .group_by('month').order_by('month').all()

    return jsonify({
        'today': {
            'total': today_total,
            'pending': today_pending,
            'confirmed': today_confirmed,
            'completed': today_completed,
        },
        'by_status': {s: c for s, c in by_status},
        'peak_hours': peak_hours_data,
        'department_traffic': [
            {'department': name, 'color': color, 'count': c}
            for name, color, c in dep_traffic
        ],
        'daily_trend': [
            {'date': str(d), 'count': c} for d, c in daily
        ],
        'avg_wait_mins': round(avg_wait, 1),
        'by_type': {t: c for t, c in by_type},
        'monthly_trend': [
            {'month': m, 'count': c} for m, c in monthly
        ],
    }), 200
