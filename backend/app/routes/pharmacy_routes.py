import random
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.pharmacy import Medicine, Prescription, PrescriptionItem, Supplier, MedicineAlert, DoctorVerification, PharmacyOrder
from app.models.patient import Patient
from app.models.user import User

pharmacy_bp = Blueprint('pharmacy', __name__)

# Known drug-drug interaction database
DRUG_INTERACTIONS = {
    ('aspirin', 'warfarin'): {
        'severity': 'critical',
        'score': 9.5,
        'warning': 'Concomitant use increases risk of severe bleeding.',
        'alternative': 'Use low-dose Aspirin only, or consider Heparin under strict monitoring.'
    },
    ('lisinopril', 'spironolactone'): {
        'severity': 'medium',
        'score': 6.2,
        'warning': 'Concomitant use increases risk of Hyperkalemia (high blood potassium levels).',
        'alternative': 'Substitute Spironolactone with Furosemide, or monitor electrolytes closely.'
    },
    ('ibuprofen', 'aspirin'): {
        'severity': 'low',
        'score': 3.5,
        'warning': 'Overlapping NSAIDs can increase GI toxicity and impair renal function.',
        'alternative': 'Substitute Ibuprofen with Paracetamol.'
    }
}

# Contraindication database
CONTRAINDICATIONS = {
    'lisinopril': {
        'pregnancy': {
            'severity': 'high',
            'warning': 'Lisinopril is contraindicated during pregnancy due to fetal toxicity.',
            'alternative': 'Methyldopa or Labetalol'
        }
    },
    'atorvastatin': {
        'pregnancy': {
            'severity': 'high',
            'warning': 'Atorvastatin is contraindicated during pregnancy. Statins can affect fetal development.',
            'alternative': 'Manage lipids via dietary overrides until postpartum'
        }
    }
}


@pharmacy_bp.route('/inventory', methods=['GET'])
@jwt_required()
def get_inventory():
    """Retrieve current pharmacy inventory, low-stock alerts, and expiring items."""
    meds = Medicine.query.all()
    # Auto-seed if empty
    if not meds:
        _seed_default_pharmacy()
        meds = Medicine.query.all()
        
    alerts = MedicineAlert.query.filter_by(is_resolved=False).all()
    return jsonify({
        'medicines': [m.to_dict() for m in meds],
        'alerts': [a.to_dict() for a in alerts]
    }), 200


@pharmacy_bp.route('/prescriptions', methods=['POST'])
@jwt_required()
def evaluate_prescription():
    """
    Submits a patient prescription. Triggers AI checking rules:
    - Drug-Drug interactions
    - Allergy contraindications (matched against composition)
    - Pregnancy conflicts
    - Duplicate medicine warnings
    Saves prescription as 'pending' status awaiting verified doctor approval.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['patient_id', 'items']
    for field in required:
        if field not in data or data[field] is None:
            return jsonify({'error': f'{field} is required'}), 422

    patient_id = int(data['patient_id'])
    items = data['items']  # list of dicts: {medicine_id, dosage, frequency, duration_days}
    doctor_user_id = int(get_jwt_identity())

    patient = Patient.query.get_or_404(patient_id)
    doctor = User.query.get(doctor_user_id)

    # 1. Fetch medicine objects from DB
    med_ids = [int(item['medicine_id']) for item in items]
    med_objects = {m.id: m for m in Medicine.query.filter(Medicine.id.in_(med_ids)).all()}

    # 2. Run clinical checks
    is_safe = True
    warnings = []
    interactions_found = []
    allergy_warnings = []
    pregnancy_warnings = []
    duplicate_warnings = []

    # Check drug interactions
    names = [med_objects[mid].name.lower() for mid in med_ids if mid in med_objects]
    for i in range(len(names)):
        for j in range(i+1, len(names)):
            pair = (names[i], names[j])
            rev_pair = (names[j], names[i])
            match = DRUG_INTERACTIONS.get(pair) or DRUG_INTERACTIONS.get(rev_pair)
            
            if match:
                is_safe = False
                interactions_found.append({
                    'drugs': [names[i].capitalize(), names[j].capitalize()],
                    'severity': match['severity'],
                    'score': match['score'],
                    'warning': match['warning'],
                    'alternative': match['alternative']
                })
                warnings.append(f"Critical Interaction: {names[i].capitalize()} + {names[j].capitalize()}")

    # Check allergies (Compare compositions with patient allergies notes)
    pat_allergies = (patient.allergies or '').lower()
    for mid, med in med_objects.items():
        comp_compounds = [c.strip().lower() for c in med.composition.split(',')]
        # Also check medicine name
        comp_compounds.append(med.name.lower())
        
        for compound in comp_compounds:
            if compound and compound in pat_allergies:
                is_safe = False
                allergy_warnings.append({
                    'medicine': med.name,
                    'allergen_detected': compound,
                    'warning': f"Patient has documented allergy matching composition compound '{compound.capitalize()}'"
                })
                warnings.append(f"Allergy Alert: {med.name} contains {compound.capitalize()}")

    # Check pregnancy contraindications
    is_pregnant = 'pregnant' in (patient.notes or '').lower() or 'pregnancy' in (patient.chronic_conditions or '').lower()
    if is_pregnant:
        for mid, med in med_objects.items():
            conflict = CONTRAINDICATIONS.get(med.name.lower())
            if conflict and 'pregnancy' in conflict:
                is_safe = False
                match = conflict['pregnancy']
                pregnancy_warnings.append({
                    'medicine': med.name,
                    'severity': match['severity'],
                    'warning': match['warning'],
                    'alternative': match['alternative']
                })
                warnings.append(f"Pregnancy Conflict: {med.name} contraindicated")

    # Check duplicate compounds
    seen_compounds = set()
    for mid, med in med_objects.items():
        comp_compounds = [c.strip().lower() for c in med.composition.split(',')]
        for compound in comp_compounds:
            if compound in seen_compounds:
                duplicate_warnings.append({
                    'medicine': med.name,
                    'duplicate_compound': compound.capitalize(),
                    'warning': f"Multiple medicines in prescription contain active compound '{compound.capitalize()}'"
                })
                warnings.append(f"Duplicate Compound: {med.name} contains {compound.capitalize()}")
            seen_compounds.add(compound)

    user_id = get_jwt_identity()
    creator_user = User.query.get(user_id)
    is_doc = creator_user.role == 'doctor' if creator_user else False

    # 3. Create prescription in database
    presc = Prescription(
        patient_id=patient_id,
        doctor_id=doctor.id if doctor else None,
        appointment_id=data.get('appointment_id'),
        is_verified=is_doc,
        status='approved' if is_doc else 'pending',
        notes='; '.join(warnings) if warnings else 'Clinical screening completed: Safe combination.',
        instructions=data.get('instructions', data.get('notes'))
    )
    db.session.add(presc)
    db.session.flush()

    for item in items:
        p_item = PrescriptionItem(
            prescription_id=presc.id,
            medicine_id=int(item['medicine_id']),
            dosage=item['dosage'],
            frequency=item['frequency'],
            duration_days=int(item.get('duration_days', 7))
        )
        db.session.add(p_item)
    
    db.session.commit()

    # Centralized notification push
    from app.routes.notification_routes import create_notification
    create_notification(
        title=f"📋 Prescription Awaiting Verification",
        message=f"Prescription for {patient.full_name} submitted. safety screen status: {'Safe' if is_safe else 'High Risk (Warnings details logged)'}.",
        notif_type='appointment',
        link='/pharmacy'
    )

    return jsonify({
        'message': 'Prescription submitted. Awaiting doctor approval verification.',
        'is_safe': is_safe,
        'prescription': presc.to_dict(),
        'checks': {
            'interactions': interactions_found,
            'allergies': allergy_warnings,
            'pregnancy': pregnancy_warnings,
            'duplicates': duplicate_warnings
        }
    }), 201


@pharmacy_bp.route('/prescriptions', methods=['GET'])
@jwt_required()
def get_prescriptions():
    """Retrieve prescriptions list. Can filter by status."""
    status = request.args.get('status')
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    query = Prescription.query
    if user.role == 'patient':
        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient:
            return jsonify({'prescriptions': []}), 200
        query = query.filter_by(patient_id=patient.id)
    elif user.role == 'doctor':
        from app.models.appointment import DoctorProfile, Appointment
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({'prescriptions': []}), 200
        subquery = db.session.query(Appointment.patient_id).filter(
            Appointment.doctor_profile_id == doctor_profile.id
        ).subquery()
        query = query.filter(Prescription.patient_id.in_(subquery))

    if status:
        query = query.filter_by(status=status)
    prescs = query.order_by(Prescription.created_at.desc()).all()
    return jsonify({'prescriptions': [p.to_dict() for p in prescs]}), 200


@pharmacy_bp.route('/orders', methods=['POST'])
@jwt_required()
def place_order():
    """Place an order for a prescription."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['delivery_address', 'contact_number']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field.replace("_", " ").capitalize()} is required'}), 422

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    patient = Patient.query.filter_by(user_id=user.id).first()
    if not patient:
        return jsonify({'error': 'Patient profile not found. Orders can only be placed by patients.'}), 403

    presc_id = data.get('prescription_id')
    if presc_id:
        presc = Prescription.query.get(presc_id)
        if not presc:
            return jsonify({'error': 'Prescription not found'}), 404

    order = PharmacyOrder(
        patient_id=patient.id,
        prescription_id=presc_id,
        delivery_address=data['delivery_address'],
        contact_number=data['contact_number'],
        payment_method=data.get('payment_method', 'Cash on Delivery'),
        status='Placed'
    )
    db.session.add(order)
    db.session.commit()

    return jsonify({
        'message': 'Your order is placed successfully!',
        'order': order.to_dict()
    }), 201


@pharmacy_bp.route('/orders', methods=['GET'])
@jwt_required()
def get_orders():
    """Retrieve pharmacy orders list."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    query = PharmacyOrder.query
    if user.role == 'patient':
        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient:
            return jsonify({'orders': []}), 200
        query = query.filter_by(patient_id=patient.id)

    orders = query.order_by(PharmacyOrder.created_at.desc()).all()
    orders_data = []
    for o in orders:
        d = o.to_dict()
        if o.prescription:
            d['prescription'] = o.prescription.to_dict()
        orders_data.append(d)

    return jsonify({'orders': orders_data}), 200


@pharmacy_bp.route('/prescriptions/<int:presc_id>/verify', methods=['POST'])
@jwt_required()
def verify_prescription(presc_id):
    """
    Doctor approval action endpoint.
    Verifies prescription and adjusts medicine stock.
    """
    presc = Prescription.query.get_or_404(presc_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user.role == 'doctor':
        from app.models.appointment import DoctorProfile, Appointment
        doctor_profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not doctor_profile:
            return jsonify({'error': 'Doctor profile not found'}), 404
        exists = Appointment.query.filter_by(
            doctor_profile_id=doctor_profile.id,
            patient_id=presc.patient_id
        ).first()
        if not exists:
            return jsonify({'error': 'Access forbidden: this patient is not assigned to you'}), 403
    data = request.get_json() or {}
    
    action = data.get('action') # approve, reject
    rejection_notes = data.get('notes')

    if action not in ['approve', 'reject']:
        return jsonify({'error': 'Invalid action. Choose approve or reject.'}), 422

    if action == 'approve':
        # Check stock counts
        for item in presc.items:
            med = item.medicine
            if med.stock_count < 1:
                return jsonify({'error': f'Stock out on {med.name}. Cannot approve.'}), 400
            
            # Deduct stock
            med.stock_count -= 1
            
            # Log low stock alerts if threshold breached
            if med.stock_count <= med.min_stock_level:
                alert = MedicineAlert(
                    medicine_id=med.id,
                    alert_type='low_stock',
                    message=f"Stock for {med.name} is low ({med.stock_count} units left)."
                )
                db.session.add(alert)

                # Centralized notification push
                from app.routes.notification_routes import create_notification
                create_notification(
                    title=f"💊 Low Stock Warning: {med.name}",
                    message=f"Smart Pharmacy alert: {med.name} stock has reached minimum thresholds ({med.stock_count} units left).",
                    notif_type='stock_warning',
                    link='/pharmacy'
                )

        presc.status = 'approved'
        presc.is_verified = True
        presc.notes = f"Verified & approved by medical officer."
    else:
        presc.status = 'rejected'
        presc.notes = f"Rejected: {rejection_notes}"

    db.session.commit()
    return jsonify({'message': f'Prescription {action}d successfully', 'prescription': presc.to_dict()}), 200


@pharmacy_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """Retrieve top medicines and expiry predictions."""
    most_used = [
        {'medicine': 'Aspirin', 'dispensed': 240},
        {'medicine': 'Paracetamol', 'dispensed': 185},
        {'medicine': 'Amoxicillin', 'dispensed': 110},
        {'medicine': 'Lisinopril', 'dispensed': 95},
        {'medicine': 'Metformin', 'dispensed': 80}
    ]

    # Expiry forecasts
    expiry_forecasts = [
        {'range': '< 30 days', 'count': 2},
        {'range': '30-90 days', 'count': 5},
        {'range': '90-180 days', 'count': 12},
        {'range': '180+ days', 'count': 45}
    ]

    return jsonify({
        'most_used': most_used,
        'expiry_forecasts': expiry_forecasts,
        'active_alerts_count': MedicineAlert.query.filter_by(is_resolved=False).count(),
        'pending_verifications': Prescription.query.filter_by(status='pending').count()
    }), 200


@pharmacy_bp.route('/seed', methods=['POST'])
@jwt_required()
def seed_pharmacy():
    """Seeds pharmacy baseline stock."""
    # Wipe tables to seed clean
    MedicineAlert.query.delete()
    PrescriptionItem.query.delete()
    Prescription.query.delete()
    Medicine.query.delete()
    Supplier.query.delete()
    db.session.commit()

    _seed_default_pharmacy()
    return jsonify({'message': 'Pharmacy seeded successfully'}), 201


def _seed_default_pharmacy():
    """Initializes default medicines with compositions and dates."""
    now_date = datetime.utcnow().date()
    
    sample_meds = [
        {'name': 'Aspirin', 'composition': 'Aspirin', 'category': 'Analgesic', 'stock': 120, 'price': 8.50, 'risk': False, 'exp': now_date + timedelta(days=22)},
        {'name': 'Warfarin', 'composition': 'Warfarin Sodium', 'category': 'Anticoagulant', 'stock': 45, 'price': 32.00, 'risk': True, 'exp': now_date + timedelta(days=400)},
        {'name': 'Lisinopril', 'composition': 'Lisinopril Dihydrate', 'category': 'ACE Inhibitor', 'stock': 8, 'price': 18.00, 'risk': False, 'exp': now_date + timedelta(days=90)},
        {'name': 'Spironolactone', 'composition': 'Spironolactone', 'category': 'Diuretic', 'stock': 65, 'price': 22.50, 'risk': False, 'exp': now_date + timedelta(days=320)},
        {'name': 'Ibuprofen', 'composition': 'Ibuprofen', 'category': 'NSAID', 'stock': 15, 'price': 6.00, 'risk': False, 'exp': now_date + timedelta(days=50)},
        {'name': 'Amoxicillin', 'composition': 'Amoxicillin, Penicillin', 'category': 'Antibiotic', 'stock': 85, 'price': 14.50, 'risk': False, 'exp': now_date + timedelta(days=120)},
        {'name': 'Paracetamol', 'composition': 'Acetaminophen', 'category': 'Antipyretic', 'stock': 200, 'price': 4.00, 'risk': False, 'exp': now_date + timedelta(days=250)},
        {'name': 'Atorvastatin', 'composition': 'Atorvastatin Calcium', 'category': 'Statin', 'stock': 90, 'price': 28.00, 'risk': False, 'exp': now_date + timedelta(days=380)},
        {'name': 'Metformin', 'composition': 'Metformin Hydrochloride', 'category': 'Antidiabetic', 'stock': 150, 'price': 12.00, 'risk': False, 'exp': now_date + timedelta(days=500)}
    ]

    for m in sample_meds:
        med = Medicine(
            name=m['name'],
            composition=m['composition'],
            category=m['category'],
            stock_count=m['stock'],
            min_stock_level=10,
            expiry_date=m['exp'],
            is_high_risk=m['risk'],
            price=m['price']
        )
        db.session.add(med)
        db.session.flush()

        # Add initial alert triggers
        if med.stock_count <= med.min_stock_level:
            db.session.add(MedicineAlert(
                medicine_id=med.id,
                alert_type='low_stock',
                message=f"Stock for {med.name} is low ({med.stock_count} units left)."
            ))
        if med.expiry_date <= now_date + timedelta(days=30):
            db.session.add(MedicineAlert(
                medicine_id=med.id,
                alert_type='expiry',
                message=f"Medicine {med.name} is expiring soon (Exp: {med.expiry_date.isoformat()})."
            ))

    # Add Supplier
    db.session.add(Supplier(
        name='PharmaCorp Wholesale',
        contact_name='Gavin Belson',
        phone='+1 555-0300',
        email='orders@pharmacorp.com'
    ))

    db.session.commit()
