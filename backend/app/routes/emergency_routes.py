from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app import db
from app.models.emergency import EmergencyAlert
from app.models.patient import Patient

emergency_bp = Blueprint('emergency', __name__)


def evaluate_clinical_risk(heart_rate, oxygen_level, temperature, systolic_bp, diastolic_bp):
    """
    Core clinical rule engine that calculates emergency probability and
    ICU necessity based on standard hospital triage criteria.
    """
    triggers = []
    prob = 5.0  # baseline probability

    # 1. Oxygen Level (SpO2) - highest weight in critical triage
    if oxygen_level < 85:
        triggers.append('Severe Hypoxia')
        prob += 65.0
    elif oxygen_level < 90:
        triggers.append('Hypoxia (Critical)')
        prob += 45.0
    elif oxygen_level < 93:
        triggers.append('Mild Hypoxia')
        prob += 20.0

    # 2. Heart Rate (BPM)
    if heart_rate < 40:
        triggers.append('Severe Bradycardia')
        prob += 40.0
    elif heart_rate < 50:
        triggers.append('Bradycardia')
        prob += 15.0
    elif heart_rate > 150:
        triggers.append('Extreme Tachycardia')
        prob += 45.0
    elif heart_rate > 110:
        triggers.append('Tachycardia')
        prob += 20.0

    # 3. Temperature
    if temperature < 95.0:
        triggers.append('Severe Hypothermia')
        prob += 30.0
    elif temperature > 104.5:
        triggers.append('Extreme Hyperpyrexia')
        prob += 35.0
    elif temperature > 101.5:
        triggers.append('High Fever')
        prob += 15.0

    # 4. Blood Pressure (BP)
    if systolic_bp >= 200 or diastolic_bp >= 120:
        triggers.append('Hypertensive Crisis (Stage 2)')
        prob += 55.0
    elif systolic_bp >= 180 or diastolic_bp >= 110:
        triggers.append('Hypertensive Emergency')
        prob += 35.0
    elif systolic_bp < 85 or diastolic_bp < 50:
        triggers.append('Severe Hypotension / Shock Risk')
        prob += 35.0
    elif systolic_bp < 95 or diastolic_bp < 55:
        triggers.append('Hypotension')
        prob += 15.0

    # Ensure bounds
    prob = min(prob, 99.5)
    
    # ICU requirement prediction
    # ICU is required if emergency risk is extreme (>70%) or life-threatening vitals occur
    icu_required = (
        prob >= 70.0 or 
        oxygen_level < 85 or 
        heart_rate > 150 or 
        heart_rate < 35 or 
        systolic_bp >= 200
    )

    return {
        'emergency_probability': round(prob, 1),
        'icu_required': bool(icu_required),
        'triggers': triggers
    }


@emergency_bp.route('/evaluate', methods=['POST'])
@jwt_required()
def evaluate():
    """
    Evaluates vital metrics for emergency levels.
    Saves an EmergencyAlert in database if probability >= 30% (Elevated or Critical threat).
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['heart_rate', 'oxygen_level', 'temperature', 'systolic_bp', 'diastolic_bp']
    for field in required:
        if field not in data or data[field] is None:
            return jsonify({'error': f'{field} is required'}), 422

    patient_id = data.get('patient_id')
    heart_rate = int(data['heart_rate'])
    oxygen_level = int(data['oxygen_level'])
    temperature = float(data['temperature'])
    systolic_bp = int(data['systolic_bp'])
    diastolic_bp = int(data['diastolic_bp'])

    # Triage calculations
    risk = evaluate_clinical_risk(heart_rate, oxygen_level, temperature, systolic_bp, diastolic_bp)

    alert_saved = False
    alert_id = None
    
    # Auto-log active alert if risk is elevated (>= 30% probability)
    if risk['emergency_probability'] >= 30.0:
        alert = EmergencyAlert(
            patient_id=patient_id,
            heart_rate=heart_rate,
            oxygen_level=oxygen_level,
            temperature=temperature,
            systolic_bp=systolic_bp,
            diastolic_bp=diastolic_bp,
            emergency_probability=risk['emergency_probability'],
            icu_required=risk['icu_required'],
            status='active',
            trigger_vitals=','.join(risk['triggers']) if risk['triggers'] else 'Vitals Derangement'
        )
        db.session.add(alert)
        db.session.commit()
        alert_saved = True
        alert_id = alert.id

        # Centralized notification push
        from app.routes.notification_routes import create_notification
        pat_name = alert.patient.full_name if alert.patient else f"ID {patient_id}" if patient_id else "Telemetry Unit"
        create_notification(
            title=f"🚨 Telemetry Crisis: {pat_name}",
            message=f"Critical vital flags triggered: {', '.join(risk['triggers'])} (Risk: {risk['emergency_probability']}%).",
            notif_type='emergency',
            link='/emergency'
        )

    return jsonify({
        'message': 'Risk evaluation completed',
        'evaluation': {
            'emergency_probability': risk['emergency_probability'],
            'icu_required': risk['icu_required'],
            'triggers': risk['triggers'],
            'alert_logged': alert_saved,
            'alert_id': alert_id
        }
    }), 200


@emergency_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    """Retrieve history of active and resolved emergency alerts."""
    status_filter = request.args.get('status') # active, acknowledged, resolved
    query = EmergencyAlert.query

    if status_filter:
        query = query.filter_by(status=status_filter)

    alerts = query.order_by(EmergencyAlert.created_at.desc()).all()
    return jsonify({'alerts': [a.to_dict() for a in alerts]}), 200


@emergency_bp.route('/alerts/<int:alert_id>', methods=['PUT'])
@jwt_required()
def update_alert(alert_id):
    """Acknowledge or resolve an active alert with response notes."""
    alert = EmergencyAlert.query.get_or_404(alert_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    new_status = data.get('status')
    if new_status not in ['acknowledged', 'resolved']:
        return jsonify({'error': 'Invalid status update. Choose acknowledged or resolved.'}), 422

    alert.status = new_status
    if data.get('notes'):
        alert.notes = data.get('notes')

    # If resolved, we can update patient status as well
    if new_status == 'resolved' and alert.patient:
        alert.patient.status = 'active'

    alert.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'message': f'Alert marked as {new_status}',
        'alert': alert.to_dict()
    }), 200


@emergency_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Triage center overview stats."""
    active_count = EmergencyAlert.query.filter_by(status='active').count()
    ack_count = EmergencyAlert.query.filter_by(status='acknowledged').count()
    resolved_count = EmergencyAlert.query.filter_by(status='resolved').count()
    icu_needed_count = EmergencyAlert.query.filter_by(status='active', icu_required=True).count()

    return jsonify({
        'active_alerts_count': active_count,
        'acknowledged_alerts_count': ack_count,
        'resolved_alerts_count': resolved_count,
        'critical_icu_count': icu_needed_count
    }), 200
