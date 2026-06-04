import random
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models.patient import Patient, Admission, DiseaseRecord
from app.models.user import User

analytics_bp = Blueprint('analytics_adv', __name__)

WARD_CAPACITIES = {
    'ICU': 15,
    'General Ward': 60,
    'Pediatrics': 25,
    'Cardiology': 20,
    'Neurology': 20
}


@analytics_bp.route('/advanced', methods=['GET'])
@jwt_required()
def get_advanced_analytics():
    """
    Computes Power BI-style advanced clinical, financial, and operational analytics.
    Allows filtering by ward, severity, and date range.
    """
    ward_filter = request.args.get('ward')
    severity_filter = request.args.get('severity')
    days_filter = request.args.get('days', type=int)  # 30, 180, 365

    # Base date range filter
    now = datetime.utcnow()
    start_date = None
    if days_filter:
        start_date = now - timedelta(days=days_filter)

    # ----------------------------------------------------
    # 1. KPI Cards Calculations
    # ----------------------------------------------------
    # Total Patients
    total_patients_query = Patient.query
    if start_date:
        total_patients_query = total_patients_query.filter(Patient.created_at >= start_date)
    total_patients = total_patients_query.count()

    # Active Bed Occupancy
    active_admissions = Admission.query.filter_by(status='admitted').all()
    occupied_beds_count = len(active_admissions)
    total_capacity = sum(WARD_CAPACITIES.values())
    occupancy_rate = (occupied_beds_count / total_capacity * 100) if total_capacity else 0

    # Total Revenue
    revenue_query = db.session.query(func.sum(Admission.total_cost))
    if start_date:
        revenue_query = revenue_query.filter(Admission.admit_date >= start_date)
    if ward_filter:
        revenue_query = revenue_query.filter(Admission.ward == ward_filter)
    total_revenue = revenue_query.scalar() or 0.0

    # Average Length of Stay (ALOS) in days
    alos_query = db.session.query(
        func.avg(func.julianday(Admission.discharge_date) - func.julianday(Admission.admit_date))
    ).filter(Admission.status == 'discharged')
    
    if start_date:
        alos_query = alos_query.filter(Admission.admit_date >= start_date)
    if ward_filter:
        alos_query = alos_query.filter(Admission.ward == ward_filter)
    avg_stay_days = alos_query.scalar() or 0.0

    # Recovery Rate (% of resolved diseases)
    disease_query = DiseaseRecord.query
    if severity_filter:
        disease_query = disease_query.filter(DiseaseRecord.severity == severity_filter)
    if start_date:
        disease_query = disease_query.filter(DiseaseRecord.diagnosed_date >= start_date)
        
    total_diseases = disease_query.count()
    resolved_diseases = disease_query.filter_by(status='resolved').count()
    recovery_rate = (resolved_diseases / total_diseases * 100) if total_diseases else 0.0

    # ----------------------------------------------------
    # 2. Revenue Analytics
    # ----------------------------------------------------
    # Monthly Revenue (Last 6 Months)
    monthly_rev = []
    for i in range(5, -1, -1):
        target_date = now - timedelta(days=i * 30)
        start_m = datetime(target_date.year, target_date.month, 1)
        if target_date.month == 12:
            end_m = datetime(target_date.year + 1, 1, 1)
        else:
            end_m = datetime(target_date.year, target_date.month + 1, 1)

        m_rev_query = db.session.query(func.sum(Admission.total_cost)).filter(
            Admission.admit_date >= start_m,
            Admission.admit_date < end_m
        )
        if ward_filter:
            m_rev_query = m_rev_query.filter(Admission.ward == ward_filter)

        m_rev = m_rev_query.scalar() or 0.0
        monthly_rev.append({
            'month': start_m.strftime('%b %Y'),
            'revenue': float(m_rev)
        })

    # Revenue by Ward
    ward_rev_query = db.session.query(
        Admission.ward,
        func.sum(Admission.total_cost)
    )
    if start_date:
        ward_rev_query = ward_rev_query.filter(Admission.admit_date >= start_date)
    ward_rev_data = ward_rev_query.group_by(Admission.ward).all()
    ward_revenue = [{'ward': w, 'revenue': float(c or 0)} for w, c in ward_rev_data if w]

    # ----------------------------------------------------
    # 3. Operational: Bed Occupancy by Ward
    # ----------------------------------------------------
    ward_occupancy_query = db.session.query(
        Admission.ward,
        func.count(Admission.id)
    ).filter(Admission.status == 'admitted')
    ward_occupancy_data = dict(ward_occupancy_query.group_by(Admission.ward).all())

    bed_occupancy = []
    for ward, capacity in WARD_CAPACITIES.items():
        occupied = ward_occupancy_data.get(ward, 0)
        bed_occupancy.append({
            'ward': ward,
            'occupied': occupied,
            'available': max(0, capacity - occupied),
            'capacity': capacity
        })

    # ----------------------------------------------------
    # 4. Clinical: Disease Trends
    # ----------------------------------------------------
    disease_counts_query = db.session.query(
        DiseaseRecord.disease_name,
        func.count(DiseaseRecord.id)
    )
    if severity_filter:
        disease_counts_query = disease_counts_query.filter(DiseaseRecord.severity == severity_filter)
    if start_date:
        disease_counts_query = disease_counts_query.filter(DiseaseRecord.diagnosed_date >= start_date)

    disease_counts = disease_counts_query.group_by(DiseaseRecord.disease_name).order_by(func.count(DiseaseRecord.id).desc()).limit(8).all()
    disease_trends = [{'disease': name, 'count': count} for name, count in disease_counts]

    # ----------------------------------------------------
    # 5. Weekly Admission Heatmap Matrix (7 days x 3 time blocks)
    # ----------------------------------------------------
    # Time blocks: Morning (06:00-11:59), Afternoon (12:00-17:59), Night (18:00-05:59)
    # Using python processing to map admission timestamps
    heatmap_matrix = {day: [0, 0, 0] for day in range(7)}  # day of week: [morning, afternoon, night]
    
    heatmap_query = Admission.query
    if start_date:
        heatmap_query = heatmap_query.filter(Admission.admit_date >= start_date)
    if ward_filter:
        heatmap_query = heatmap_query.filter(Admission.ward == ward_filter)
        
    admissions_list = heatmap_query.all()
    for adm in admissions_list:
        dt = adm.admit_date
        day_of_week = dt.weekday()  # Monday = 0, Sunday = 6
        hour = dt.hour
        if 6 <= hour < 12:
            block = 0  # Morning
        elif 12 <= hour < 18:
            block = 1  # Afternoon
        else:
            block = 2  # Night
        heatmap_matrix[day_of_week][block] += 1

    formatted_heatmap = []
    days_labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    blocks_labels = ['Morning', 'Afternoon', 'Night']
    
    for day_idx, counts in heatmap_matrix.items():
        for block_idx, count in enumerate(counts):
            formatted_heatmap.append({
                'day': days_labels[day_idx],
                'time_block': blocks_labels[block_idx],
                'count': count
            })

    # ----------------------------------------------------
    # 6. Recovery Analytics
    # ----------------------------------------------------
    # Avg recovery time by severity
    rec_sev_query = db.session.query(
        DiseaseRecord.severity,
        func.avg(func.julianday(DiseaseRecord.resolved_date) - func.julianday(DiseaseRecord.diagnosed_date))
    ).filter(DiseaseRecord.status == 'resolved')
    
    if start_date:
        rec_sev_query = rec_sev_query.filter(DiseaseRecord.diagnosed_date >= start_date)
    
    rec_sev_data = rec_sev_query.group_by(DiseaseRecord.severity).all()
    recovery_by_severity = [{'severity': s, 'avg_days': round(d or 0, 1)} for s, d in rec_sev_data]

    # Recovery duration breakdown groups
    durations = {'<7 days': 0, '7-14 days': 0, '15-30 days': 0, '30+ days': 0}
    resolved_cases = DiseaseRecord.query.filter(
        DiseaseRecord.status == 'resolved',
        DiseaseRecord.resolved_date.isnot(None)
    )
    if severity_filter:
        resolved_cases = resolved_cases.filter_by(severity=severity_filter)
    if start_date:
        resolved_cases = resolved_cases.filter(DiseaseRecord.diagnosed_date >= start_date)

    for case in resolved_cases.all():
        diff = (case.resolved_date - case.diagnosed_date).days
        if diff < 7:
            durations['<7 days'] += 1
        elif diff <= 14:
            durations['7-14 days'] += 1
        elif diff <= 30:
            durations['15-30 days'] += 1
        else:
            durations['30+ days'] += 1

    recovery_duration_breakdown = [{'range': k, 'count': v} for k, v in durations.items()]

    return jsonify({
        'kpis': {
            'total_patients': total_patients,
            'occupancy_rate': round(occupancy_rate, 1),
            'total_revenue': round(total_revenue, 2),
            'avg_length_of_stay': round(avg_stay_days, 1),
            'recovery_rate': round(recovery_rate, 1)
        },
        'revenue': {
            'monthly': monthly_rev,
            'by_ward': ward_revenue
        },
        'bed_occupancy': bed_occupancy,
        'disease_trends': disease_trends,
        'heatmap': formatted_heatmap,
        'recovery': {
            'by_severity': recovery_by_severity,
            'duration_breakdown': recovery_duration_breakdown
        }
    }), 200


@analytics_bp.route('/backfill', methods=['POST'])
@jwt_required()
def backfill_demo_data():
    """
    Backfills database with ~100 historical admissions and clinical reports 
    to showcase rich multi-month healthcare dashboards.
    """
    # Verify patients exist. If not, generate some
    patients_count = Patient.query.count()
    if patients_count < 10:
        _seed_demo_patients()

    patients = Patient.query.all()
    if not patients:
        return jsonify({'error': 'No patients available for seeding.'}), 400

    wards = list(WARD_CAPACITIES.keys())
    diseases_pool = [
        ('Pneumonia', 'severe', 'Pulmonology'),
        ('COVID-19', 'moderate', 'General Medicine'),
        ('Diabetes Mellitus', 'chronic', 'Endocrinology'),
        ('Hypertension', 'chronic', 'Cardiology'),
        ('Stroke / TIA', 'critical', 'Neurology'),
        ('Asthma Flare-up', 'moderate', 'Pulmonology'),
        ('Common Flu', 'mild', 'General Medicine'),
        ('Migraine', 'mild', 'Neurology')
    ]

    now = datetime.utcnow()
    admissions_created = 0
    diseases_created = 0

    # Clean existing demo records to make clean seed
    # Remove older Admissions and DiseaseRecords to avoid duplicate seeding bloat
    Admission.query.delete()
    DiseaseRecord.query.delete()
    db.session.commit()

    # Generate 100 historical Admissions over the last 180 days
    for i in range(100):
        patient = random.choice(patients)
        ward = random.choice(wards)
        
        # Decide dates
        days_ago = random.randint(1, 180)
        admit_date = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        
        # 10% stays active (still admitted), others discharged
        is_active = (i < 10)
        
        discharge_date = None
        status = 'admitted'
        cost = 0.0
        
        if not is_active:
            stay_length = random.randint(2, 20)
            discharge_date = admit_date + timedelta(days=stay_length)
            status = 'discharged'
            
            # Ward rates: ICU is expensive, general is cheap
            rate = 1200.0 if ward == 'ICU' else (650.0 if ward == 'Cardiology' or ward == 'Neurology' else 350.0)
            cost = stay_length * rate + random.randint(100, 1500)  # base + ancillary charges

        # Insert Admission
        adm = Admission(
            patient_id=patient.id,
            ward=ward,
            room_number=f"Room {random.randint(101, 399)}",
            bed_number=f"Bed {random.choice(['A', 'B', 'C'])}",
            admit_date=admit_date,
            discharge_date=discharge_date,
            reason=f"Clinical treatment for acute conditions in {ward}",
            status=status,
            total_cost=cost if not is_active else None
        )
        db.session.add(adm)
        admissions_created += 1

        # Generates accompanying disease records
        dis_info = random.choice(diseases_pool)
        dis_name, severity, dept = dis_info
        
        # Decide disease status
        dis_status = 'active'
        resolved_date = None
        if not is_active and random.random() > 0.3:
            dis_status = 'resolved'
            resolved_date = (discharge_date or admit_date).date()

        dis_rec = DiseaseRecord(
            patient_id=patient.id,
            disease_name=dis_name,
            severity=severity if severity != 'chronic' else 'moderate',
            diagnosed_date=admit_date.date(),
            resolved_date=resolved_date,
            is_chronic=(severity == 'chronic'),
            status=dis_status,
            notes=f"Tracked admission referral to {dept}"
        )
        db.session.add(dis_rec)
        diseases_created += 1

    db.session.commit()

    return jsonify({
        'message': 'Demo database backfilled successfully',
        'admissions_created': admissions_created,
        'diseases_created': diseases_created
    }), 201


def _seed_demo_patients():
    """Helper to generate 15 patient profiles for backfill seeding."""
    first_names = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez']
    genders = ['male', 'female']

    for i in range(15):
        fn = first_names[i]
        ln = last_names[i]
        gender = random.choice(genders)
        dob = datetime.utcnow().date() - timedelta(days=random.randint(18 * 365, 75 * 365))
        
        pat = Patient(
            patient_code=f"LP{random.randint(10000000, 99999999)}",
            first_name=fn,
            last_name=ln,
            date_of_birth=dob,
            gender=gender,
            phone=f"+1 555-01{random.randint(10, 99)}",
            email=f"{fn.lower()}.{ln.lower()}@example.com",
            address="100 Hospital Way",
            city="Metro City",
            state="NY",
            status='active'
        )
        db.session.add(pat)
    db.session.commit()
