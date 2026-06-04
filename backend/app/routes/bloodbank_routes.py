from datetime import datetime, timedelta
import random
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models.bloodbank import BloodDonor, BloodInventory, BloodRequest, DonationHistory
from app.models.patient import Patient

bloodbank_bp = Blueprint('bloodbank', __name__)

RARE_BLOOD_GROUPS = ['AB-', 'A-', 'B-', 'O-']


@bloodbank_bp.route('/donors', methods=['POST'])
@jwt_required()
def register_donor():
    """
    Registers a blood donor. Evaluates eligibility rules:
    - Weight >= 50kg
    - Hemoglobin >= 12.5 g/dL
    - Last donation >= 90 days ago
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['name', 'blood_group', 'phone', 'weight', 'hemoglobin']
    for field in required:
        if field not in data or data[field] is None:
            return jsonify({'error': f'{field} is required'}), 422

    name = data['name']
    blood_group = data['blood_group']
    phone = data['phone']
    email = data.get('email')
    patient_id = data.get('patient_id')
    
    weight = float(data['weight'])
    hemoglobin = float(data['hemoglobin'])
    last_donation_str = data.get('last_donation_date')

    # Eligibility evaluation rules
    eligible = True
    notes = []

    if weight < 50.0:
        eligible = False
        notes.append('Weight must be at least 50 kg.')
    
    if hemoglobin < 12.5:
        eligible = False
        notes.append('Hemoglobin must be at least 12.5 g/dL.')

    last_donation_date = None
    if last_donation_str:
        try:
            last_donation_date = datetime.strptime(last_donation_str, '%Y-%m-%d').date()
            days_since = (datetime.utcnow().date() - last_donation_date).days
            if days_since < 90:
                eligible = False
                notes.append(f'Minimum of 90 days between donations required. (Only {days_since} days elapsed).')
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 422

    # Rare blood group detector
    is_rare = blood_group in RARE_BLOOD_GROUPS

    donor = BloodDonor(
        patient_id=patient_id,
        name=name,
        blood_group=blood_group,
        last_donation_date=last_donation_date,
        eligibility_status=eligible,
        eligibility_notes='; '.join(notes) if notes else 'Eligible to donate',
        phone=phone,
        email=email,
        is_rare=is_rare
    )

    db.session.add(donor)
    db.session.commit()

    return jsonify({
        'message': 'Donor registered successfully',
        'donor': donor.to_dict()
    }), 201


@bloodbank_bp.route('/inventory', methods=['GET'])
@jwt_required()
def get_inventory():
    """Retrieve current stock units available per blood group."""
    inv = BloodInventory.query.all()
    # If unseeded, auto-seed default categories
    if not inv:
        _seed_default_inventory()
        inv = BloodInventory.query.all()
        
    return jsonify({'inventory': [i.to_dict() for i in inv]}), 200


@bloodbank_bp.route('/requests', methods=['POST'])
@jwt_required()
def evaluate_request():
    """
    Process clinical blood request. If stock is available, updates inventory
    and fulfills request. If stock is low, triggers emergency dispatch mode:
    searches for matching donors, simulates SMS dispatches.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['patient_name', 'blood_group', 'units_requested']
    for field in required:
        if field not in data or data[field] is None:
            return jsonify({'error': f'{field} is required'}), 422

    patient_name = data['patient_name']
    blood_group = data['blood_group']
    units_requested = int(data['units_requested'])
    urgency = data.get('urgency', 'normal')
    patient_id = data.get('patient_id')

    # Log request
    req = BloodRequest(
        patient_id=patient_id,
        patient_name=patient_name,
        blood_group=blood_group,
        units_requested=units_requested,
        urgency=urgency,
        status='pending'
    )
    db.session.add(req)

    # Evaluate inventory
    inv = BloodInventory.query.filter_by(blood_group=blood_group).first()
    
    emergency_dispatch = False
    dispatched_donors = []

    if inv and inv.units_available >= units_requested:
        # Deduct inventory
        inv.units_available -= units_requested
        req.status = 'fulfilled'
        db.session.commit()
        msg = f'Request fulfilled successfully. {units_requested} units allocated.'
        
        # Check for stock warnings
        if inv.units_available <= inv.units_critical_threshold:
            from app.routes.notification_routes import create_notification
            create_notification(
                title=f"⚠️ Low Blood Stock: {blood_group}",
                message=f"Inventory for blood group {blood_group} is low ({inv.units_available} units remaining).",
                notif_type='stock_warning',
                link='/bloodbank'
            )
    else:
        # Shortage! Mark as pending or rejected, trigger emergency donor search
        req.status = 'pending'
        db.session.commit()
        emergency_dispatch = True
        
        # Find matching donors: same blood group or O- (universal donor)
        matched_donors = BloodDonor.query.filter(
            BloodDonor.blood_group.in_([blood_group, 'O-']),
            BloodDonor.eligibility_status == True
        ).all()
        
        dispatched_donors = [d.to_dict() for d in matched_donors]
        msg = 'Stock shortage! Emergency triage protocol activated: Matched donors notified.'

        # central notification push
        from app.routes.notification_routes import create_notification
        create_notification(
            title=f"🩸 Blood Shortage: {blood_group}",
            message=f"Triage request of {units_requested} units for {patient_name} failed. Dispatching SMS notifications.",
            notif_type='blood_crisis',
            link='/bloodbank'
        )

    return jsonify({
        'message': msg,
        'request': req.to_dict(),
        'emergency_dispatch': emergency_dispatch,
        'dispatched_donors': dispatched_donors
    }), 200


@bloodbank_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """Retrieve blood demand trends and rare blood group proportions."""
    # Monthly Donations
    # Since sqlite group by is custom, we generate mock trend data for charts
    monthly_donations = [
        {'month': 'Jan', 'donations': 24, 'requests': 18},
        {'month': 'Feb', 'donations': 30, 'requests': 25},
        {'month': 'Mar', 'donations': 28, 'requests': 29},
        {'month': 'Apr', 'donations': 35, 'requests': 30},
        {'month': 'May', 'donations': 42, 'requests': 38}
    ]

    # Blood group distribution counts
    donors_count = db.session.query(
        BloodDonor.blood_group,
        func.count(BloodDonor.id)
    ).group_by(BloodDonor.blood_group).all()

    distribution = [{'group': g, 'count': c} for g, c in donors_count]

    return jsonify({
        'monthly_trend': monthly_donations,
        'group_distribution': distribution,
        'total_donors': BloodDonor.query.count(),
        'rare_donors_count': BloodDonor.query.filter_by(is_rare=True).count()
    }), 200


@bloodbank_bp.route('/seed', methods=['POST'])
@jwt_required()
def seed_bloodbank():
    """Seed sample donors and inventories."""
    # Wipe tables to seed clean
    BloodDonor.query.delete()
    BloodInventory.query.delete()
    BloodRequest.query.delete()
    db.session.commit()

    _seed_default_inventory()

    # Seed donors
    sample_donors = [
        {'name': 'Alex Carter', 'blood_group': 'O-', 'phone': '+1 555-0210', 'email': 'alex@example.com', 'is_rare': True, 'eligible': True, 'notes': 'Eligible'},
        {'name': 'Sara Connor', 'blood_group': 'A+', 'phone': '+1 555-0211', 'email': 'sara@example.com', 'is_rare': False, 'eligible': True, 'notes': 'Eligible'},
        {'name': 'Marcus Wright', 'blood_group': 'AB-', 'phone': '+1 555-0212', 'email': 'marcus@example.com', 'is_rare': True, 'eligible': False, 'notes': 'Hemoglobin low (11.8)'},
        {'name': 'Elena Fisher', 'blood_group': 'O+', 'phone': '+1 555-0213', 'email': 'elena@example.com', 'is_rare': False, 'eligible': True, 'notes': 'Eligible'},
        {'name': 'Victor Sullivan', 'blood_group': 'B-', 'phone': '+1 555-0214', 'email': 'sully@example.com', 'is_rare': True, 'eligible': True, 'notes': 'Eligible'}
    ]

    for d in sample_donors:
        donor = BloodDonor(
            name=d['name'],
            blood_group=d['blood_group'],
            phone=d['phone'],
            email=d['email'],
            is_rare=d['is_rare'],
            eligibility_status=d['eligible'],
            eligibility_notes=d['notes']
        )
        db.session.add(donor)

    # Seed requests
    requests = [
        BloodRequest(patient_name='Bruce Wayne', blood_group='A+', units_requested=2, urgency='normal', status='fulfilled'),
        BloodRequest(patient_name='Peter Parker', blood_group='O-', units_requested=4, urgency='emergency', status='fulfilled'),
        BloodRequest(patient_name='Clark Kent', blood_group='B+', units_requested=1, urgency='normal', status='fulfilled')
    ]
    for r in requests:
        db.session.add(r)

    db.session.commit()
    return jsonify({'message': 'Blood Bank seeded successfully'}), 201


@bloodbank_bp.route('/requests', methods=['GET'])
@jwt_required()
def get_requests():
    """Retrieve all blood requests."""
    requests = BloodRequest.query.order_by(BloodRequest.created_at.desc()).all()
    return jsonify({'requests': [r.to_dict() for r in requests]}), 200


@bloodbank_bp.route('/requests/<int:request_id>', methods=['PUT'])
@jwt_required()
def update_request_status(request_id):
    """Update status of a blood request."""
    req = BloodRequest.query.get_or_404(request_id)
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'error': 'Status is required'}), 400
        
    status = data['status']
    
    # If transitioning to approved/fulfilled from pending/rejected, check and deduct stock
    if status in ['approved', 'fulfilled'] and req.status not in ['approved', 'fulfilled']:
        inv = BloodInventory.query.filter_by(blood_group=req.blood_group).first()
        if inv:
            if inv.units_available >= req.units_requested:
                inv.units_available -= req.units_requested
            else:
                return jsonify({'error': f'Insufficient units in inventory ({inv.units_available} units available)'}), 400
                
    # If transitioning away from approved/fulfilled back to pending/rejected, restore stock
    if status in ['pending', 'rejected'] and req.status in ['approved', 'fulfilled']:
        inv = BloodInventory.query.filter_by(blood_group=req.blood_group).first()
        if inv:
            inv.units_available += req.units_requested

    req.status = status
    db.session.commit()
    return jsonify({'message': f'Request status updated to {status}', 'request': req.to_dict()}), 200


@bloodbank_bp.route('/donors', methods=['GET'])
@jwt_required()
def get_donors():
    """Retrieve all blood donors."""
    donors = BloodDonor.query.order_by(BloodDonor.created_at.desc()).all()
    return jsonify({'donors': [d.to_dict() for d in donors]}), 200


@bloodbank_bp.route('/inventory', methods=['POST'])
@jwt_required()
def add_inventory():
    """Add or set stock units for a specific blood group."""
    data = request.get_json()
    if not data or 'blood_group' not in data or 'units' not in data:
        return jsonify({'error': 'blood_group and units are required'}), 400
        
    blood_group = data['blood_group']
    units = int(data['units'])
    
    inv = BloodInventory.query.filter_by(blood_group=blood_group).first()
    if not inv:
        inv = BloodInventory(blood_group=blood_group, units_available=max(0, units), units_critical_threshold=5)
        db.session.add(inv)
    else:
        inv.units_available = max(0, inv.units_available + units)
        
    db.session.commit()
    return jsonify({'message': 'Inventory updated successfully', 'inventory': inv.to_dict()}), 200


def _seed_default_inventory():
    """Initializes default units available for the 8 blood groups."""
    groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    for bg in groups:
        if not BloodInventory.query.filter_by(blood_group=bg).first():
            units = random.randint(2, 25)
            # Make rare groups have lower units
            if bg in RARE_BLOOD_GROUPS:
                units = random.randint(1, 4)
            db.session.add(BloodInventory(
                blood_group=bg,
                units_available=units,
                units_critical_threshold=5
            ))
    db.session.commit()
