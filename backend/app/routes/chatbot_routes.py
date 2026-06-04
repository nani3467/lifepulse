import random
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

chatbot_bp = Blueprint('chatbot', __name__)

# Curated list of health tips
HEALTH_TIPS = [
    "Stay Hydrated: Drink at least 8-10 glasses of water daily to maintain kidney function and electrolyte balance.",
    "Cardio Health: Aim for 30 minutes of moderate aerobic exercise, like brisk walking, five days a week to strengthen your heart.",
    "Blood Sugar Control: Limit refined sugars and choose high-fiber whole grains to stabilize blood glucose levels.",
    "Better Sleep: Maintain a regular sleep schedule and limit blue screen exposure 1 hour before bedtime to boost melatonin.",
    "Hypertension Care: Reduce sodium intake to under 2,000 mg per day to manage blood pressure naturally.",
    "Lungs Note: Practice deep diaphragmatic breathing exercises and avoid secondhand smoke to strengthen lung capacity.",
    "Skin Protection: Always apply SPF 30+ sunscreen when outdoors to protect against UV-induced damage.",
    "Immune Boost: Incorporate Vitamin C rich foods like citrus fruits, bell peppers, and leafy greens into your diet.",
    "Postural Care: Stand up and stretch every 45 minutes of desk work to prevent spine and joint stiffness.",
    "Mental Health: Spend 10 minutes practicing mindfulness or breathing meditation daily to reduce stress cortisol."
]

# Department suggestions routing table
DEPT_ROUTING = [
    {
        'dept': 'Cardiology',
        'keywords': ['chest pain', 'heart', 'coronary', 'cardiac', 'palpitation', 'arrhythmia', 'angina', 'bp', 'blood pressure'],
        'reply': "Your symptoms mention heart or chest parameters. Chest discomfort can be serious. I highly recommend consulting our Cardiology department for an ECG. Location: Block A, Floor 2."
    },
    {
        'dept': 'Pulmonology',
        'keywords': ['breath', 'lung', 'cough', 'oxygen', 'asthma', 'copd', 'wheezing', 'spo2', 'dyspnea'],
        'reply': "You are reporting breathing or lung symptoms. Issues like shortness of breath or low SpO2 require attention. I suggest scheduling a consultation with our Pulmonology department. Location: Block B, Floor 2."
    },
    {
        'dept': 'Endocrinology',
        'keywords': ['sugar', 'diabetes', 'insulin', 'dka', 'glucose', 'thyroid', 'hormone', 'pancreas'],
        'reply': "Your query relates to metabolic or endocrine symptoms. Fluctuating sugar levels require management. I recommend seeing our Endocrinology department. Location: Block C, Floor 2."
    },
    {
        'dept': 'Neurology',
        'keywords': ['headache', 'dizzy', 'numbness', 'stroke', 'seizure', 'paralysis', 'migraine', 'brain', 'confusion'],
        'reply': "These symptoms point to neurological conditions like headaches or dizziness. Persistent neurological signs should be checked. I suggest consulting our Neurology department. Location: Block B, Floor 3."
    },
    {
        'dept': 'Pediatrics',
        'keywords': ['child', 'kid', 'baby', 'pediatric', 'infant', 'toddler', 'vaccine child'],
        'reply': "For infant or child care queries, our specialized Pediatrics department provides complete developmental care. Location: Block C, Floor 1."
    },
    {
        'dept': 'Dermatology',
        'keywords': ['skin', 'rash', 'itch', 'hives', 'eczema', 'acne', 'allergy skin', 'psoriasis'],
        'reply': "For skin, rash, or dermatological issues, I recommend speaking with our Dermatology clinic. Location: Block D, Floor 2."
    },
    {
        'dept': 'Ophthalmology',
        'keywords': ['eye', 'vision', 'blind', 'blur', 'glaucoma', 'cataract', 'cornea'],
        'reply': "For vision issues or eye checks, please schedule an appointment with our Ophthalmology department. Location: Block D, Floor 1."
    },
    {
        'dept': 'ENT',
        'keywords': ['ear', 'nose', 'throat', 'ent', 'sinus', 'tonsil', 'hearing', 'tinnitus'],
        'reply': "Your symptoms relate to Ear, Nose, or Throat functions. I suggest consulting our ENT department. Location: Block B, Floor 1."
    },
    {
        'dept': 'Orthopedics',
        'keywords': ['fracture', 'bone', 'sprain', 'joint', 'arthritis', 'spine', 'back pain', 'knee'],
        'reply': "For bone, joint, or fracture concerns, please check in with our Orthopedics department. Location: Block A, Floor 1."
    }
]


@chatbot_bp.route('/query', methods=['POST'])
@jwt_required()
def query_chatbot():
    """
    NLP query endpoint. Evaluates text and suggests departments,
    appointment paths, or returns clinical tip answers.
    """
    data = request.get_json()
    if not data or not data.get('message'):
        return jsonify({'error': 'Message is required'}), 400

    message = data['message'].lower().strip()
    reply = ""
    action = None
    suggested_dept = None

    # Intent 1: Welcome/Greeting
    if any(greet in message for greet in ['hello', 'hi', 'hey', 'greetings', 'welcome', 'who are you']):
        reply = "Hello! I am the LifePulse Clinical AI assistant. I can suggest clinical departments based on symptoms, provide health tips, or help you book an appointment. How can I assist you today?"
        
    # Intent 2: Appointment Assistance
    elif any(appt in message for appt in ['appointment', 'book', 'schedule', 'reserve', 'doctor visit', 'consult doctor']):
        reply = "I can guide you to our Scheduling center. You can select a clinical department, choose an available doctor, and pick a time slot."
        action = {
            'type': 'route',
            'path': '/appointments',
            'label': 'Open Appointments Calendar'
        }

    # Intent 3: Health Tips
    elif any(tip in message for tip in ['tip', 'health tip', 'advice', 'healthy', 'stay fit']):
        reply = random.choice(HEALTH_TIPS)

    # Intent 4: Normal Vital Ranges
    elif 'oxygen' in message or 'spo2' in message:
        reply = "Normal Blood Oxygen (SpO2) ranges between 95% and 100%. Anything below 92% is considered mild hypoxia, and below 90% is critical, requiring oxygen therapy."
    elif 'blood pressure' in message or ' bp ' in message or message.startswith('bp'):
        reply = "Normal Blood Pressure is less than 120/80 mmHg. Elevated BP ranges from 120-129 systolic, and hypertensive stage 1 is 130-139 systolic or 80-89 diastolic."
    elif 'sugar' in message or 'glucose' in message or 'diabetes' in message:
        reply = "Normal fasting blood sugar levels for non-diabetic adults are 70 to 100 mg/dL. A fasting level of 100-125 mg/dL indicates prediabetes, and 126+ mg/dL is classified as diabetic."

    # Intent 5: Symptoms & Department Suggestions
    else:
        # Check clinical keywords
        matched_dept = None
        for route in DEPT_ROUTING:
            if any(keyword in message for keyword in route['keywords']):
                matched_dept = route
                break

        if matched_dept:
            reply = matched_dept['reply']
            suggested_dept = matched_dept['dept']
            action = {
                'type': 'route',
                'path': '/appointments',
                'label': 'Book appointment in ' + matched_dept['dept']
            }
        else:
            reply = "I'm not quite sure about that symptom or question. For general triage, please consult our General Medicine department (Block A, Floor 0) or schedule a complete physical. Let me know if you would like me to link you to the Appointments booking page."

    return jsonify({
        'reply': reply,
        'suggested_department': suggested_dept,
        'action': action
    }), 200
