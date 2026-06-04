import random
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models.appointment import Appointment, VideoSession

video_bp = Blueprint('video', __name__)


@video_bp.route('/create', methods=['POST'])
@jwt_required()
def create_meeting():
    data = request.get_json() or {}
    appt_id = data.get('appointment_id')
    if not appt_id:
        return jsonify({'error': 'appointment_id is required'}), 422

    appt = Appointment.query.get_or_404(appt_id)
    
    # Generate meeting specifications
    meeting_id = f"MEDI-{random.randint(100000, 999999)}"
    meeting_token = f"TOK-{random.randint(100000, 999999)}"
    meeting_link = f"https://meet.jit.si/{meeting_id}"

    appt.meeting_id = meeting_id
    appt.meeting_link = meeting_link
    appt.status = 'confirmed' # ensure it is confirmed if starting
    
    session = VideoSession(
        appointment_id=appt.id,
        meeting_id=meeting_id,
        status='active'
    )
    db.session.add(session)
    db.session.commit()

    return jsonify({
        'meetingId': meeting_id,
        'meetingToken': meeting_token,
        'meetingLink': meeting_link,
        'appointment': appt.to_dict()
    }), 201


@video_bp.route('/join/<string:meeting_id>', methods=['GET'])
@jwt_required()
def join_meeting(meeting_id):
    appt = Appointment.query.filter_by(meeting_id=meeting_id).first()
    if not appt:
        return jsonify({'error': 'Meeting room not found'}), 404

    return jsonify({
        'meetingId': appt.meeting_id,
        'meetingLink': appt.meeting_link,
        'appointment': appt.to_dict()
    }), 200


@video_bp.route('/end', methods=['POST'])
@jwt_required()
def end_meeting():
    data = request.get_json() or {}
    appt_id = data.get('appointment_id')
    meeting_id = data.get('meetingId')

    appt = None
    if appt_id:
        appt = Appointment.query.get(appt_id)
    elif meeting_id:
        appt = Appointment.query.filter_by(meeting_id=meeting_id).first()

    if not appt:
        return jsonify({'error': 'Appointment not found'}), 404

    appt.status = 'completed'
    appt.completed_at = datetime.datetime.utcnow()
    
    if data.get('notes'):
        appt.notes = data.get('notes')

    # Find and update VideoSession
    session = VideoSession.query.filter_by(appointment_id=appt.id, status='active').first()
    if session:
        session.status = 'completed'
        session.end_time = datetime.datetime.utcnow()

    db.session.commit()

    return jsonify({
        'message': 'Video call consultation successfully ended.',
        'appointment': appt.to_dict()
    }), 200
