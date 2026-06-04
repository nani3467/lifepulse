from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import datetime

from app.config import config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.admin_routes import admin_bp
    from app.routes.patient_routes import patient_bp
    from app.routes.upload_routes import upload_bp
    from app.routes.appointment_routes import appt_bp
    from app.routes.prediction_routes import prediction_bp
    from app.routes.emergency_routes import emergency_bp
    from app.routes.analytics_routes import analytics_bp
    from app.routes.chatbot_routes import chatbot_bp
    from app.routes.bloodbank_routes import bloodbank_bp
    from app.routes.pharmacy_routes import pharmacy_bp
    from app.routes.notification_routes import notification_bp
    from app.routes.video_routes import video_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(patient_bp, url_prefix='/api/patients')
    app.register_blueprint(upload_bp, url_prefix='/api/uploads')
    app.register_blueprint(appt_bp, url_prefix='/api/appointments')
    app.register_blueprint(prediction_bp, url_prefix='/api/predictions')
    app.register_blueprint(emergency_bp, url_prefix='/api/emergency')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
    app.register_blueprint(bloodbank_bp, url_prefix='/api/bloodbank')
    app.register_blueprint(pharmacy_bp, url_prefix='/api/pharmacy')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')
    app.register_blueprint(video_bp, url_prefix='/api/video')





    # Health check
    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'service': 'LifePulse API v1.0'}, 200

    with app.app_context():
        db.create_all()
        _seed_admin()

    return app


def _seed_admin():
    """Create a default admin user + departments + demo doctor if none exists."""
    from app.models.user import User
    from app.models.appointment import Department, DoctorProfile, Hospital
    from werkzeug.security import generate_password_hash

    if not User.query.filter_by(email='admin@lifepulse.com').first():
        admin = User(
            name='Super Admin',
            email='admin@lifepulse.com',
            password_hash=generate_password_hash('Admin@123'),
            role='admin',
            is_active=True
        )
        db.session.add(admin)
        db.session.commit()
        print('[Success] Default admin seeded: admin@lifepulse.com / Admin@123')

    # Seed departments
    DEPARTMENTS = [
        {'name': 'Cardiology', 'code': 'CARD', 'color': '#f43f5e', 'icon': '\u2764\ufe0f', 'location': 'Block A, Floor 2'},
        {'name': 'Neurology', 'code': 'NEUR', 'color': '#8b5cf6', 'icon': '\U0001f9e0', 'location': 'Block B, Floor 3'},
        {'name': 'Orthopedics', 'code': 'ORTH', 'color': '#f59e0b', 'icon': '\U0001f9b4', 'location': 'Block A, Floor 1'},
        {'name': 'Pediatrics', 'code': 'PEDI', 'color': '#10b981', 'icon': '\U0001f476', 'location': 'Block C, Floor 1'},
        {'name': 'General Medicine', 'code': 'GENM', 'color': '#3b82f6', 'icon': '\U0001fa7a', 'location': 'Block A, Floor 0'},
        {'name': 'Dermatology', 'code': 'DERM', 'color': '#ec4899', 'icon': '\U0001f9d1\u200d\u2695\ufe0f', 'location': 'Block D, Floor 2'},
        {'name': 'Ophthalmology', 'code': 'OPHT', 'color': '#06b6d4', 'icon': '\U0001f441\ufe0f', 'location': 'Block D, Floor 1'},
        {'name': 'ENT', 'code': 'ENT', 'color': '#84cc16', 'icon': '\U0001f442', 'location': 'Block B, Floor 1'},
    ]
    for dep_data in DEPARTMENTS:
        if not Department.query.filter_by(code=dep_data['code']).first():
            db.session.add(Department(**dep_data))
    db.session.commit()

    # Seed 4 hospitals
    HOSPITALS = [
        {'name': 'Apollo Hospital', 'address': 'Block A-D, Apollo Expressway', 'phone': '+1 555-0100'},
        {'name': 'Fortis Hospital', 'address': '22 Baker St, Fortis Block', 'phone': '+1 555-0200'},
        {'name': 'Care Hospital', 'address': '55 Main Ave, Care Square', 'phone': '+1 555-0300'},
        {'name': 'AIIMS Hospital', 'address': 'Health Sector 4, AIIMS Town', 'phone': '+1 555-0400'}
    ]
    db_hospitals = {}
    for h_data in HOSPITALS:
        h = Hospital.query.filter_by(name=h_data['name']).first()
        if not h:
            h = Hospital(name=h_data['name'], address=h_data['address'], phone=h_data['phone'])
            db.session.add(h)
            db.session.flush()
        db_hospitals[h_data['name']] = h
    db.session.commit()

    # Seed 12 doctors
    DOCTOR_SEEDS = [
        # Apollo Hospital
        {'email': 'doctor@lifepulse.com', 'name': 'Dr. Arjun Mehta', 'spec': 'Cardiology', 'qual': 'MD, DM Cardiology', 'exp': 12, 'fee': 500, 'hosp': 'Apollo Hospital'},
        {'email': 'doc002@apollo.com', 'name': 'Dr. Priya Nair', 'spec': 'Neurology', 'qual': 'MD, DM Neurology', 'exp': 10, 'fee': 600, 'hosp': 'Apollo Hospital'},
        {'email': 'doc003@apollo.com', 'name': 'Dr. Ravi Kumar', 'spec': 'Pulmonology', 'qual': 'MD, DTCD Pulmonology', 'exp': 8, 'fee': 600, 'hosp': 'Apollo Hospital'},
        # Fortis Hospital
        {'email': 'doc004@fortis.com', 'name': 'Dr. Sarah Connor', 'spec': 'Orthopedics', 'qual': 'MS Orthopedics', 'exp': 9, 'fee': 450, 'hosp': 'Fortis Hospital'},
        {'email': 'doc005@fortis.com', 'name': 'Dr. John Watson', 'spec': 'Dermatology', 'qual': 'MD Dermatology', 'exp': 11, 'fee': 500, 'hosp': 'Fortis Hospital'},
        {'email': 'doc006@fortis.com', 'name': 'Dr. Alan Grant', 'spec': 'Pediatrics', 'qual': 'MD Pediatrics', 'exp': 15, 'fee': 550, 'hosp': 'Fortis Hospital'},
        # Care Hospital
        {'email': 'doc007@care.com', 'name': 'Dr. Gregory House', 'spec': 'General Medicine', 'qual': 'MD Internal Medicine', 'exp': 20, 'fee': 700, 'hosp': 'Care Hospital'},
        {'email': 'doc008@care.com', 'name': 'Dr. Stephen Strange', 'spec': 'Cardiology', 'qual': 'MD, MCh Cardiology', 'exp': 14, 'fee': 650, 'hosp': 'Care Hospital'},
        {'email': 'doc009@care.com', 'name': 'Dr. Hannibal Lecter', 'spec': 'ENT', 'qual': 'MD Otolaryngology', 'exp': 18, 'fee': 500, 'hosp': 'Care Hospital'},
        # AIIMS Hospital
        {'email': 'doc010@aiims.com', 'name': 'Dr. Meredith Grey', 'spec': 'General Medicine', 'qual': 'MS General Surgery', 'exp': 7, 'fee': 400, 'hosp': 'AIIMS Hospital'},
        {'email': 'doc011@aiims.com', 'name': 'Dr. Frasier Crane', 'spec': 'Neurology', 'qual': 'MD Psychiatry & Neurology', 'exp': 16, 'fee': 600, 'hosp': 'AIIMS Hospital'},
        {'email': 'doc012@aiims.com', 'name': 'Dr. Charles Xavier', 'spec': 'Neurology', 'qual': 'MD, PhD Neurology', 'exp': 25, 'fee': 800, 'hosp': 'AIIMS Hospital'},
    ]

    for seed in DOCTOR_SEEDS:
        if not User.query.filter_by(email=seed['email']).first():
            user = User(
                name=seed['name'],
                email=seed['email'],
                password_hash=generate_password_hash('Doctor@123'),
                role='doctor',
                is_active=True
            )
            db.session.add(user)
            db.session.flush()

            hosp = db_hospitals.get(seed['hosp'])
            dep = Department.query.filter(Department.name.ilike(seed['spec'])).first()

            profile = DoctorProfile(
                user_id=user.id,
                department_id=dep.id if dep else None,
                hospital_id=hosp.id if hosp else None,
                specialization=seed['spec'],
                qualification=seed['qual'],
                experience_years=seed['exp'],
                consultation_fee=seed['fee'],
                available_days='Mon,Tue,Wed,Thu,Fri',
                slot_duration_mins=15,
                max_patients_per_day=30,
                is_available=True,
                
                # Mock verified credentials for seeded doctors
                medical_reg_number=f"REG-{123456 + seed['exp'] * 123}",
                medical_council_reg_id=f"MC-{987654 - seed['exp'] * 456}",
                highest_degree=seed['qual'].split(',')[0].strip(),
                university_name="All India Institute of Medical Sciences" if "AIIMS" in seed['hosp'] else "Harvard Medical School",
                graduation_year=(datetime.utcnow().year - seed['exp'] - 1),
                available_slots="09:00 - 10:00, 10:00 - 11:00, 11:00 - 12:00, 14:00 - 15:00, 15:00 - 16:00",
                consultation_types="in_person,video",
                license_file="license_mock.pdf",
                certificate_file="certificate_mock.pdf",
                gov_id_file="govid_mock.pdf",
                rating=4.8
            )
            db.session.add(profile)
    db.session.commit()
    print('[Success] 4 hospitals and 12 doctors seeded successfully.')

