import random
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

chatbot_bp = Blueprint('chatbot', __name__)

# Curated clinical health tips
HEALTH_TIPS = [
    "Stay Hydrated: Drink at least 8-10 glasses of water daily to maintain kidney filtration and fluid balance.",
    "Cardio Health: Aim for 30 minutes of moderate aerobic exercise, like brisk walking, five days a week to strengthen your heart.",
    "Blood Sugar Control: Limit refined sugars and choose high-fiber whole grains to stabilize blood glucose levels.",
    "Better Sleep: Maintain a regular sleep schedule and limit blue screen exposure 1 hour before bedtime to boost melatonin.",
    "Hypertension Care: Reduce sodium intake to under 2,000 mg per day to manage blood pressure naturally.",
    "Lungs Note: Practice deep diaphragmatic breathing exercises and avoid secondhand smoke to strengthen lung capacity.",
    "Skin Protection: Always apply SPF 30+ sunscreen when outdoors to protect against UV-induced skin damage.",
    "Immune Boost: Incorporate Vitamin C rich foods like citrus fruits, bell peppers, and leafy greens into your diet.",
    "Postural Care: Stand up and stretch every 45 minutes of desk work to prevent spine and joint stiffness.",
    "Mental Health: Spend 10 minutes practicing mindfulness or breathing meditation daily to reduce stress cortisol."
]

# Detailed Clinical Specialization Mapping
SYMPTOM_DIRECTIONS = {
    'Emergency': {
        'keywords': [
            'emergency', 'chest pain', 'heart attack', 'cant breathe', 'can\'t breathe', 
            'difficulty breathing', 'shortness of breath', 'suffocating', 'severe bleeding', 
            'unconscious', 'stroke', 'paralysis', 'choking', 'anaphylaxis', 'poisoned', 
            'heavy bleeding', 'severe burns', 'chest tightness', 'left arm pain'
        ],
        'reply': "⚠️ EMERGENCY WARNING: Your symptoms indicate a potentially life-threatening situation. Please immediately sit down, avoid physical exertion, and call emergency services (e.g., 911 / 112 / local ambulance) or visit the nearest Emergency Room. Our hospital's Emergency Triage center is located at Block A, Ground Floor and is open 24/7.",
        'action': {'type': 'route', 'path': '/emergency', 'label': 'View Emergency Dashboard'}
    },
    'Cardiology': {
        'keywords': [
            'heart', 'palpitation', 'arrhythmia', 'angina', 'bp', 'blood pressure', 
            'murmur', 'hypertension', 'cardiac', 'pulse rate', 'high bp', 'low bp', 
            'cholesterol', 'tachycardia', 'bradycardia'
        ],
        'reply': "Based on your symptoms, there could be cardiac parameters involved. We suggest booking a consultation with our Cardiology Department for a physical exam, blood pressure monitoring, or an ECG (Electrocardiogram). Location: Block A, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Cardiology Consultation'}
    },
    'Pulmonology': {
        'keywords': [
            'breath', 'lung', 'cough', 'oxygen', 'asthma', 'copd', 'wheezing', 
            'spo2', 'dyspnea', 'sputum', 'bronchitis', 'respiratory', 'pneumonia', 
            'shortness of breath'
        ],
        'reply': "These respiratory symptoms suggest pulmonary involvement. We recommend a check-up at our Pulmonology Clinic for spirometry, lung capacity evaluations, or chest X-rays. Location: Block B, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Pulmonology Appointment'}
    },
    'Neurology': {
        'keywords': [
            'headache', 'dizzy', 'numbness', 'stroke', 'seizure', 'paralysis', 
            'migraine', 'brain', 'confusion', 'tingling', 'palsy', 'memory loss', 
            'vertigo', 'fainting', 'tremor', 'neurological'
        ],
        'reply': "Your symptoms indicate potential neurological involvement. We recommend scheduling an evaluation at our Neurology Department for migraine management, nerve checks, or brain scans. Location: Block B, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Neurology Appointment'}
    },
    'Endocrinology': {
        'keywords': [
            'sugar', 'diabetes', 'insulin', 'dka', 'glucose', 'thyroid', 'hormone', 
            'pancreas', 'hyperthyroidism', 'hypothyroidism', 'gland', 'excessive thirst', 
            'metabolism', 'diabetes range'
        ],
        'reply': "These metabolic symptoms are related to endocrine function. We recommend a consultation with our Endocrinology Clinic for a fasting glucose, HbA1c, or thyroid hormone panel. Location: Block C, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Endocrinology Appointment'}
    },
    'Gastroenterology': {
        'keywords': [
            'stomach', 'abdomen', 'abdominal', 'belly', 'acid reflux', 'heartburn', 
            'bloating', 'diarrhea', 'nausea', 'vomiting', 'indigestion', 'gastric', 
            'constipation', 'cramp', 'ulcer', 'gastritis', 'digestion'
        ],
        'reply': "Your abdominal symptoms suggest gastrointestinal involvement. We recommend booking a consult with our Gastroenterology Department for dietary adjustments, endoscopy, or diagnostic checks. Location: Block C, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Gastroenterology Visit'}
    },
    'Orthopedics': {
        'keywords': [
            'fracture', 'bone', 'sprain', 'joint', 'arthritis', 'spine', 'back pain', 
            'knee', 'muscle tear', 'ligament', 'backache', 'dislocation', 'rheumatism', 
            'fractured', 'neck pain'
        ],
        'reply': "For bone, joint, or spinal concerns, please schedule a visit with our Orthopedics Department for X-rays, bone density scans, or physical evaluation. Location: Block A, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Orthopedics Appointment'}
    },
    'Dermatology': {
        'keywords': [
            'skin', 'rash', 'itch', 'hives', 'eczema', 'acne', 'allergy skin', 
            'psoriasis', 'mole', 'lesion', 'dermatitis', 'wart', 'blister', 'dry skin'
        ],
        'reply': "For skin conditions or allergies, we recommend speaking with our Dermatology Clinic for targeted treatment, allergy testing, or a skin biopsy. Location: Block D, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Dermatology Consult'}
    },
    'Ophthalmology': {
        'keywords': [
            'eye', 'vision', 'blind', 'blur', 'glaucoma', 'cataract', 'cornea', 
            'dry eyes', 'astigmatism', 'redness eye', 'blurry vision'
        ],
        'reply': "For vision issues or regular eye checkups, please schedule an appointment at our Ophthalmology Clinic. Location: Block D, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Eye Examination'}
    },
    'ENT': {
        'keywords': [
            'ear', 'nose', 'throat', 'ent', 'sinus', 'tonsil', 'hearing', 
            'tinnitus', 'earache', 'nasal', 'nosebleed', 'congestion', 'laryngitis'
        ],
        'reply': "Your symptoms relate to Ear, Nose, or Throat functions. We suggest scheduling an evaluation with our ENT Department for nasal checks, hearing tests, or throat cultures. Location: Block B, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book ENT Appointment'}
    },
    'Pediatrics': {
        'keywords': [
            'child', 'kid', 'baby', 'pediatric', 'infant', 'toddler', 
            'vaccine child', 'pediatrician', 'neonatal', 'vaccination child'
        ],
        'reply': "For infant or child care queries, our specialized Pediatrics department provides complete developmental care, vaccinations, and pediatric consultations. Location: Block C, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Pediatrician Appointment'}
    },
    'Urology': {
        'keywords': [
            'urine', 'urinary', 'kidney stone', 'bladder', 'blood in urine', 
            'prostate', 'hematuria', 'dysuria', 'frequent urination', 'burn urine'
        ],
        'reply': "These symptoms indicate urinary tract or kidney involvement. We recommend a consultation with our Urology Department for urinalysis, prostate checks, or renal ultrasound. Location: Block B, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Urology Consultation'}
    },
    'Gynecology': {
        'keywords': [
            'pregnancy', 'pregnant', 'period pain', 'menstrual', 'pelvic', 
            'uterus', 'ovary', 'obstetrics', 'gynecology', 'pcos', 'menstruation'
        ],
        'reply': "For prenatal care, menstrual health, or general women's health wellness checkups, we suggest scheduling a consultation with our Gynecology and Obstetrics Clinic. Location: Block A, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Gynecology Appointment'}
    },
    'Psychiatry': {
        'keywords': [
            'depression', 'anxiety', 'panic', 'stress', 'insomnia', 'mental', 
            'counseling', 'psychiatrist', 'psychology', 'sleep disorder', 
            'hallucination', 'mood swing'
        ],
        'reply': "For mental health support, anxiety, depression, or stress management, our compassionate Psychiatry and Counseling clinic is here to help with therapy and clinical guidance. Location: Block D, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Psychiatry / Counseling Session'}
    }
}

@chatbot_bp.route('/query', methods=['POST'])
@jwt_required()
def query_chatbot():
    """
    Realistic Clinical AI responder. Triages patient input, suggests target hospital
    departments, handles biometric tracker instruction, and processes general hospital service paths.
    """
    data = request.get_json()
    if not data or not data.get('message'):
        return jsonify({'error': 'Message is required'}), 400

    message = data['message'].lower().strip()
    reply = ""
    action = None
    suggested_dept = None

    # 1. Greetings / Help Intents
    if any(greet in message for greet in ['hello', 'hi', 'hey', 'greetings', 'welcome', 'who are you', 'how are you', 'help']):
        reply = "Hello! I am PulseAI, the LifePulse Clinical AI assistant. I can triage symptoms, suggest medical departments, guide you through camera-based vitals scans, or help you schedule a doctor consultation. How can I help you today?"

    # 2. PPG Scan instructions
    elif any(k in message for k in ['scan', 'ppg', 'flash', 'camera scan', 'finger on flash', 'measure heart', 'measure bp', 'measure oxygen', 'measure spo2', 'vitals scan', 'take scan']):
        reply = ("To scan your Heart Rate, Blood Pressure (BP), or Oxygen Saturation (SpO2) using your smartphone or laptop:\n\n"
                 "1. Go to the 'Track Health' workspace.\n"
                 "2. Select the scan type (Heart Rate, Blood Pressure, or Oxygen Saturation).\n"
                 "3. Allow camera permissions. The app will initiate the video feed and automatically activate the flashlight/torch.\n"
                 "4. Place your index finger firmly over the camera lens and flash so that the scanner registers a pulse.\n"
                 "5. Hold still for 10-15 seconds while the PPG sensor calibrates and evaluates your physiological values.")
        action = {
            'type': 'route',
            'path': '/patient/track-health',
            'label': 'Go to Track Health / Vitals Scan'
        }

    # 3. Hospital Services
    elif any(k in message for k in ['pharmacy', 'medicine', 'prescription', 'refill', 'pill', 'drugstore', 'buy medicine']):
        reply = "LifePulse operates a 24/7 fully-stocked Pharmacy. You can view your active prescriptions, check medicine details, and place orders directly from the Patient Pharmacy page. Orders can be picked up or shipped to your address. Location: Block D, Ground Floor."
        action = {
            'type': 'route',
            'path': '/patient/pharmacy',
            'label': 'Browse Pharmacy & Orders'
        }
    elif any(k in message for k in ['blood bank', 'blood donor', 'plasma', 'donate blood', 'transfusion', 'blood type']):
        reply = "Our Central Blood Bank acts as an active inventory. You can request compatible blood bags for surgeries, check available reserves (A+, B+, O-, etc.), or register as a voluntary blood donor. Location: Block C, Floor 1."
        action = {
            'type': 'route',
            'path': '/patient/bloodbank',
            'label': 'Open Blood Bank Portal'
        }
    elif any(k in message for k in ['report', 'lab result', 'medical record', 'medical file', 'download report', 'discharge summary', 'records']):
        reply = "All your medical files, prescription sheets, blood bank history, and laboratory test reports are securely stored in your patient account. You can view them in the dashboard under Prescriptions and medical archives."
        action = {
            'type': 'route',
            'path': '/patient/prescriptions',
            'label': 'View My Prescriptions'
        }
    elif any(k in message for k in ['appointment', 'book', 'schedule', 'doctor visit', 'consult doctor']):
        reply = "I can guide you to our scheduling system. You can choose a department, select an available doctor, and pick a time slot."
        action = {
            'type': 'route',
            'path': '/appointments',
            'label': 'Open Appointments Calendar'
        }

    # 4. Vital Norm Ranges
    elif any(k in message for k in ['oxygen level', 'spo2 range', 'hypoxia', 'oxygen percentage']):
        reply = "Normal blood oxygen saturation (SpO2) ranges from 95% to 100%. Levels between 90% and 94% indicate mild hypoxia (oxygen deprivation), while levels below 90% are a clinical emergency requiring immediate oxygen support."
    elif any(k in message for k in ['blood pressure level', 'bp range', 'hypertension level', 'normal bp', 'pressure range']):
        reply = "A normal blood pressure reading is less than 120/80 mmHg. Elevated BP is 120-129/80. Stage 1 Hypertension is 130-139 systolic or 80-89 diastolic. Stage 2 is 140/90 or higher, and hypertensive crisis is 180+/120+."
    elif any(k in message for k in ['heart rate range', 'pulse range', 'tachycardia', 'bradycardia', 'normal pulse', 'normal heart rate']):
        reply = "For healthy adults, a normal resting heart rate (pulse) ranges from 60 to 100 beats per minute (bpm). A rate lower than 60 bpm is bradycardia (normal for athletes), and a rate above 100 bpm is tachycardia."
    elif any(k in message for k in ['sugar level', 'glucose level', 'diabetes range', 'hba1c', 'normal sugar']):
        reply = "Normal fasting blood glucose (sugar) is 70 to 100 mg/dL. Prediabetes is 100 to 125 mg/dL. A reading of 126 mg/dL or higher on two separate tests indicates diabetes. Normal HbA1c is below 5.7%."

    # 5. General health tips
    elif any(k in message for k in ['tip', 'health tip', 'advice', 'healthy', 'stay fit', 'diet']):
        reply = random.choice(HEALTH_TIPS)

    # 6. Symptom Triage Routing (Scoring Matcher)
    else:
        # Check emergency priority first
        is_emergency = False
        emergency_keywords = SYMPTOM_DIRECTIONS['Emergency']['keywords']
        if any(kw in message for kw in emergency_keywords):
            is_emergency = True
            reply = SYMPTOM_DIRECTIONS['Emergency']['reply']
            action = SYMPTOM_DIRECTIONS['Emergency']['action']
            suggested_dept = 'Emergency'

        if not is_emergency:
            # Score matching categories
            matched_scores = {}
            for dept, info in SYMPTOM_DIRECTIONS.items():
                if dept == 'Emergency':
                    continue
                # count matches of keywords
                score = sum(1 for kw in info['keywords'] if kw in message)
                if score > 0:
                    matched_scores[dept] = score

            if matched_scores:
                # Get the department with the highest matching keywords
                best_dept = max(matched_scores, key=matched_scores.get)
                reply = SYMPTOM_DIRECTIONS[best_dept]['reply']
                action = SYMPTOM_DIRECTIONS[best_dept]['action']
                suggested_dept = best_dept
            else:
                # Smart clinical fallback response
                reply = ("I understand you are asking about your symptoms or medical parameters. "
                         "While I can detect common issues and recommend specialties (such as Cardiology, Pulmonology, "
                         "or Endocrinology), your request didn't match our diagnostic keyword index.\n\n"
                         "We recommend booking a consultation with our General Medicine department for an overall evaluation. "
                         "If you are experiencing severe pain, shortness of breath, or a sudden crisis, please visit our "
                         "Emergency Triage desk at Block A immediately.")
                action = {
                    'type': 'route',
                    'path': '/appointments',
                    'label': 'Book General Physical Exam'
                }

    # Disclaimer addition for realism and clinical safety
    if suggested_dept != 'Emergency' and not any(k in message for k in ['hello', 'hi', 'hey', 'greetings', 'welcome', 'who are you', 'how are you', 'help']):
        reply += "\n\n*Disclaimer: PulseAI provides clinical routing suggestions and educational facts. This is not a substitute for professional medical diagnosis. If you feel very unwell, please visit a doctor.*"

    return jsonify({
        'reply': reply,
        'suggested_department': suggested_dept,
        'action': action
    }), 200
