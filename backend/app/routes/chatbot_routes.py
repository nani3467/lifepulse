import os
import random
import json
import urllib.request
import urllib.error
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

chatbot_bp = Blueprint('chatbot', __name__)

SYSTEM_PROMPT = (
    "You are LifePulse AI, an advanced intelligent assistant integrated into the LifePulse healthcare platform.\n"
    "Your role is to help users with healthcare information, wellness guidance, medical awareness, appointment-related questions, platform navigation, and general knowledge queries.\n\n"
    "Core Responsibilities:\n"
    "1. Answer any user question clearly, accurately, and professionally.\n"
    "2. Provide detailed explanations when needed and concise answers for simple questions.\n"
    "3. Support conversations on Health & Wellness, Nutrition, Fitness, Mental Wellbeing, Medical Awareness, Disease Information, First Aid, Healthcare Technology, Education, Science, Programming, Mathematics, Current Affairs, General Knowledge, Career Guidance, and Productivity.\n"
    "4. Maintain context throughout the conversation.\n"
    "5. Ask follow-up questions when user requests are unclear.\n"
    "6. Format responses using headings, bullet points, tables, and code blocks when helpful.\n"
    "7. For programming questions, provide complete working examples whenever possible.\n"
    "8. For mathematical problems, show step-by-step solutions.\n"
    "9. For healthcare topics:\n"
    "   - Provide educational information only.\n"
    "   - Never claim to diagnose diseases.\n"
    "   - Encourage consultation with licensed healthcare professionals for medical emergencies.\n"
    "   - Clearly mention when information is general guidance and not medical advice.\n\n"
    "Response Style:\n"
    "- Friendly, Professional, Helpful, Human-like, Accurate, Conversational.\n\n"
    "Special Rules:\n"
    "- Never say \"I don't know\" without attempting to help.\n"
    "- If uncertain, explain limitations and provide the best available guidance.\n"
    "- Always try to give actionable next steps.\n"
    "- Remember previous messages in the conversation and use them when relevant.\n"
    "- Support multilingual conversations including English, Telugu, and Hindi.\n\n"
    "Emergency Handling:\n"
    "If a user reports severe symptoms such as chest pain, breathing difficulty, stroke symptoms, unconsciousness, severe bleeding, or suicidal thoughts, immediately advise contacting emergency medical services or a healthcare professional.\n\n"
    "Platform Features:\n"
    "If users ask about LifePulse features such as appointments, doctors, reports, health records, AI diagnostics, reminders, or dashboards, provide guidance based on the platform functionality."
)

# Curated clinical health tips
HEALTH_TIPS = [
    "💧 **Hydration**: Drink 8-10 glasses of water daily. Hydration keeps joint lubrication optimal and helps flush out toxins.",
    "🧘 **Mindfulness**: Try 5-10 minutes of silent deep breathing. Focus on the air entering and leaving your body to reduce stress.",
    "🥗 **Balanced Nutrition**: Include colorful vegetables and leafy greens in your diet. They provide vitamins and antioxidants that strengthen immunity.",
    "🛌 **Sleep Quality**: Aim for 7-8 hours of sleep. Establish a screen-free routine 1 hour before sleeping to stimulate natural melatonin production.",
    "🚶 **Movement**: A 30-minute daily walk can lower blood pressure, improve heart health, and lift your mood."
]

# Clinical Specialization Mapping
CLINICAL_MAP = {
    'Emergency': {
        'keywords': [
            'emergency', 'chest pain', 'heart attack', 'cant breathe', 'can\'t breathe', 
            'difficulty breathing', 'shortness of breath', 'suffocating', 'severe bleeding', 
            'unconscious', 'stroke', 'paralysis', 'choking', 'anaphylaxis', 'poisoned', 
            'heavy bleeding', 'severe burns', 'chest tightness', 'left arm pain', 
            'suicidal', 'kill myself', 'end my life'
        ],
        'info_reply': "⚠️ CRITICAL WARNING: Chest tightness, pain radiating to the arm/jaw, severe shortness of breath, and sudden weakness are classic signs of cardiovascular or pulmonary crisis (like a heart attack or stroke). This requires immediate clinical intervention.",
        'recommendation_reply': "For acute emergency symptoms, please proceed immediately to the Emergency Room or call your local emergency services (e.g., 911 / 112). Our on-site Emergency Triage desk is located at Block A, Ground Floor and is open 24/7.",
        'action': {'type': 'route', 'path': '/emergency', 'label': 'View Emergency Dashboard'}
    },
    'Cardiology': {
        'keywords': [
            'heart', 'palpitation', 'arrhythmia', 'angina', 'bp', 'blood pressure', 
            'murmur', 'hypertension', 'cardiac', 'pulse rate', 'high bp', 'low bp', 
            'cholesterol', 'tachycardia', 'bradycardia'
        ],
        'info_reply': "Fluctuations in blood pressure, palpitations, or an irregular pulse can be caused by stress, anxiety, caffeine, dehydration, or cardiovascular conditions such as hypertension, coronary artery disease, or arrhythmia.",
        'recommendation_reply': "Based on your cardiovascular parameters, we suggest scheduling an evaluation with our Cardiology department. Recommended Specialist: Dr. Arjun Mehta (MD, DM Cardiology, Apollo Hospital). Location: Block A, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Cardiology Consultation'}
    },
    'Pulmonology': {
        'keywords': [
            'breath', 'lung', 'cough', 'oxygen', 'asthma', 'copd', 'wheezing', 
            'spo2', 'dyspnea', 'sputum', 'bronchitis', 'respiratory', 'pneumonia', 
            'shortness of breath'
        ],
        'info_reply': "Respiratory signs like persistent coughing, wheezing, low oxygen saturation, or mild dyspnea are frequently linked to bronchial inflammation, asthma, COPD, or lung congestion.",
        'recommendation_reply': "For lung and airway symptoms, we recommend scheduling an appointment at our Pulmonology clinic. Recommended Specialist: Dr. Ravi Kumar (MD, DTCD Pulmonology, Apollo Hospital). Location: Block B, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Pulmonology Appointment'}
    },
    'Neurology': {
        'keywords': [
            'headache', 'dizzy', 'numbness', 'stroke', 'seizure', 'paralysis', 
            'migraine', 'brain', 'confusion', 'tingling', 'palsy', 'memory loss', 
            'vertigo', 'fainting', 'tremor', 'neurological', 'headach'
        ],
        'info_reply': "Headaches or mild dizziness are commonly caused by muscle tension, neck strain, screen glare, or dehydration. I suggest resting in a dimly lit, quiet room, closed eyes, and drinking water. Practicing neck-stretching yoga or Child's Pose (Balasana) works wonderfully to release stress. Breathe slowly, be patient, and let your body find peace.",
        'recommendation_reply': "For brain and nervous system evaluations, we recommend booking a consult with our Neurology clinic. Recommended Specialists: Dr. Priya Nair (MD, DM Neurology, Apollo Hospital) or Dr. Charles Xavier (MD, PhD Neurology, AIIMS Hospital). Location: Block B, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Neurology Appointment'}
    },
    'Endocrinology': {
        'keywords': [
            'sugar', 'diabetes', 'insulin', 'dka', 'glucose', 'thyroid', 'hormone', 
            'pancreas', 'hyperthyroidism', 'hypothyroidism', 'gland', 'excessive thirst', 
            'metabolism', 'diabetes range'
        ],
        'info_reply': "Metabolic indicators like extreme thirst, fluctuating glucose levels, fatigue, or sudden weight shifts are often caused by endocrine imbalances, such as prediabetes, diabetes, or thyroid hormone fluctuations.",
        'recommendation_reply': "For endocrine or metabolic disorders, we suggest booking an appointment with our Endocrinology department. Recommended Specialist: Dr. David Vance (MD Endocrinology). Location: Block C, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Endocrinology Appointment'}
    },
    'Gastroenterology': {
        'keywords': [
            'stomach', 'abdomen', 'abdominal', 'belly', 'acid reflux', 'heartburn', 
            'bloating', 'diarrhea', 'nausea', 'vomiting', 'indigestion', 'gastric', 
            'constipation', 'cramp', 'ulcer', 'gastritis', 'digestion'
        ],
        'info_reply': "Abdominal cramps, heartburn, indigestion, nausea, or bloating are common signs of stomach acid reflux, food intolerances, IBS, gastritis, or digestive system infections.",
        'recommendation_reply': "For stomach and digestive issues, we suggest booking a visit with our Gastroenterology clinic. Recommended Specialist: Dr. Sanjay Gupta (MD Gastroenterology). Location: Block C, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Gastroenterology Visit'}
    },
    'Orthopedics': {
        'keywords': [
            'fracture', 'bone', 'sprain', 'joint', 'arthritis', 'spine', 'back pain', 
            'knee', 'muscle tear', 'ligament', 'backache', 'dislocation', 'rheumatism', 
            'fractured', 'neck pain'
        ],
        'info_reply': "Joint stiffness, localized bone pain, backaches, sprains, or muscle pulls are typically related to mechanical wear-and-tear, bone density issues, ligament sprains, or arthritic conditions.",
        'recommendation_reply': "For musculoskeletal or bone-and-joint issues, we recommend booking an appointment with our Orthopedics clinic. Recommended Specialist: Dr. Sarah Connor (MS Orthopedics, Fortis Hospital). Location: Block A, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Orthopedics Appointment'}
    },
    'Dermatology': {
        'keywords': [
            'skin', 'rash', 'itch', 'hives', 'eczema', 'acne', 'allergy skin', 
            'psoriasis', 'mole', 'lesion', 'dermatitis', 'wart', 'blister', 'dry skin'
        ],
        'info_reply': "Dermal signs such as rashes, localized itching, hives, acne breakouts, or dry scaly patches can result from contact allergies, eczema, fungal infections, or environmental triggers.",
        'recommendation_reply': "For skin, hair, or nail conditions, we recommend booking a consultation with our Dermatology clinic. Recommended Specialist: Dr. John Watson (MD Dermatology, Fortis Hospital). Location: Block D, Floor 2.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Dermatology Consult'}
    },
    'Ophthalmology': {
        'keywords': [
            'eye', 'vision', 'blind', 'blur', 'glaucoma', 'cataract', 'cornea', 
            'dry eyes', 'astigmatism', 'redness eye', 'blurry vision'
        ],
        'info_reply': "Vision fluctuations, dry eyes, eye fatigue, blurriness, or light sensitivity can be caused by refractive errors, high intraocular pressure, cataracts, or screen-induced eye strain.",
        'recommendation_reply': "For comprehensive vision checks or optical conditions, we recommend booking a consult at our Ophthalmology clinic. Recommended Specialist: Dr. Clara Dupont (MD Ophthalmology). Location: Block D, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Eye Examination'}
    },
    'ENT': {
        'keywords': [
            'ear', 'nose', 'throat', 'ent', 'sinus', 'tonsil', 'hearing', 
            'tinnitus', 'earache', 'nasal', 'nosebleed', 'congestion', 'laryngitis'
        ],
        'info_reply': "Tonsillitis, earaches, persistent sinus congestion, hearing drops, or nasal blockages usually indicate viral/bacterial infections in the upper respiratory pathways or middle ear.",
        'recommendation_reply': "For ear, nose, or throat evaluations, we suggest scheduling a consultation with our ENT clinic. Recommended Specialist: Dr. Hannibal Lecter (MD Otolaryngology, Care Hospital). Location: Block B, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book ENT Appointment'}
    },
    'Pediatrics': {
        'keywords': [
            'child', 'kid', 'baby', 'pediatric', 'infant', 'toddler', 
            'vaccine child', 'pediatrician', 'neonatal', 'vaccination child'
        ],
        'info_reply': "Infants, toddlers, and children require specialized diagnostic checks, routine immunization tracking, growth milestones monitoring, and age-appropriate pediatric physicals.",
        'recommendation_reply': "For child wellness and medical issues, please schedule a consultation with our Pediatrics department. Recommended Specialist: Dr. Alan Grant (MD Pediatrics, Fortis Hospital). Location: Block C, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Pediatrician Appointment'}
    },
    'Urology': {
        'keywords': [
            'urine', 'urinary', 'kidney stone', 'bladder', 'blood in urine', 
            'prostate', 'hematuria', 'dysuria', 'frequent urination', 'burn urine'
        ],
        'info_reply': "Urinary burning, flank pain, increased frequency, or trace blood in urine can point to kidney stones, urinary tract infections (UTIs), or prostate gland issues.",
        'recommendation_reply': "For renal or urinary tract issues, we recommend scheduling an appointment at our Urology clinic. Recommended Specialist: Dr. Richard Vance (MD Urology). Location: Block B, Floor 1.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Urology Consultation'}
    },
    'Gynecology': {
        'keywords': [
            'pregnancy', 'pregnant', 'period pain', 'menstrual', 'pelvic', 
            'uterus', 'ovary', 'obstetrics', 'gynecology', 'pcos', 'menstruation'
        ],
        'info_reply': "Pelvic discomfort, irregular menstrual cycles, pregnancy checks, or hormonal shifts are standard areas of obstetric and gynecological care.",
        'recommendation_reply': "For prenatal care, menstrual cycles, or women's health wellness, we recommend booking a consult at our Gynecology and Obstetrics department. Recommended Specialist: Dr. Elena Rostova (MD Gynecology). Location: Block A, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Gynecology Appointment'}
    },
    'Psychiatry': {
        'keywords': [
            'depression', 'anxiety', 'panic', 'stress', 'insomnia', 'mental', 
            'counseling', 'psychiatrist', 'psychology', 'sleep disorder', 
            'hallucination', 'mood swing'
        ],
        'info_reply': "Sleep disorders, constant worry, panic signs, mood shifts, or depressive feelings are frequently related to high cortisol levels, chemical imbalances, or extreme psychological stress.",
        'recommendation_reply': "For therapeutic support, psychiatric evaluations, or counseling sessions, we recommend booking a session at our Psychiatry clinic. Recommended Specialist: Dr. Frasier Crane (MD Psychiatry, AIIMS Hospital). Location: Block D, Floor 3.",
        'action': {'type': 'route', 'path': '/appointments', 'label': 'Book Psychiatry / Counseling Session'}
    }
}

def call_generative_api(user_message, chat_history):
    """
    Sends request payload to configured Gemini or OpenAI endpoints using standard python urllib.
    """
    gemini_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GEMINI_API')
    openai_key = os.environ.get('OPENAI_API_KEY')

    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            contents = []
            for msg in chat_history:
                role = "model" if msg.get("role") == "assistant" else "user"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg.get("content", "")}]
                })
            
            contents.append({
                "role": "user",
                "parts": [{"text": user_message}]
            })

            payload = {
                "systemInstruction": {
                    "parts": [{"text": SYSTEM_PROMPT}]
                },
                "contents": contents
            }

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                text = res_data['candidates'][0]['content']['parts'][0]['text']
                return text
        except Exception as e:
            print("[Warning] Gemini API failed or timed out:", e)

    if openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            for msg in chat_history:
                role = "assistant" if msg.get("role") == "assistant" else "user"
                messages.append({"role": role, "content": msg.get("content", "")})
            messages.append({"role": "user", "content": user_message})

            payload = {
                "model": "gpt-4o-mini",
                "messages": messages
            }

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {openai_key}'
                }
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                text = res_data['choices'][0]['message']['content']
                return text
        except Exception as e:
            print("[Warning] OpenAI API failed or timed out:", e)

    return None

@chatbot_bp.route('/query', methods=['POST'])
@jwt_required()
def query_chatbot():
    """
    LifePulse AI Assistant.
    Maintains chat history, delegates queries to external LLMs (Gemini/OpenAI) if keys exist.
    Gracefully falls back to advanced, natural lifestyle-oriented clinical matching engine.
    """
    data = request.get_json()
    if not data or not data.get('message'):
        return jsonify({'error': 'Message is required'}), 400

    raw_message = data['message']
    message = raw_message.lower().strip()
    chat_history = data.get('history', [])

    reply = ""
    action = None
    recommendation = None
    suggested_dept = None

    # Detect if user explicitly wants doctor recommendation details
    wants_doctor = any(k in message for k in [
        'book', 'schedule', 'doctor', 'appointment', 'consult', 'physician', 
        'specialist', 'booking', 'suggest doctor', 'recommend doctor', 'recomended doctor'
    ])

    # ----------------- EMERGENCY TRIAGE FLAGS (Immediate Red Alert) -----------------
    emergency_keywords = CLINICAL_MAP['Emergency']['keywords']
    if any(k in message for k in emergency_keywords):
        reply = (
            "⚠️ **CRITICAL EMERGENCY ALERT**\n\n"
            "If you or someone near you is experiencing severe symptoms like sudden chest pain, "
            "difficulty breathing, stroke symptoms (facial drooping, arm weakness, speech difficulty), "
            "unconsciousness, heavy bleeding, or thoughts of self-harm, please act immediately:\n\n"
            "*   **Call your local emergency services** (911 / 112 / ambulance) right away.\n"
            "*   Sit in a comfortable position, rest, and do not attempt to exert yourself.\n"
            "*   If you are on-site, proceed directly to our **Emergency Room** located at **Block A, Ground Floor (open 24/7)**.\n\n"
            "*Disclaimer: I am an AI companion. This emergency alert is for immediate safety. Please seek professional clinical emergency care.*"
        )
        action = {
            'type': 'route',
            'path': '/emergency',
            'label': 'Open Emergency Dashboard'
        }
        return jsonify({
            'reply': reply,
            'suggested_department': 'Emergency',
            'action': action,
            'recommendation': None
        }), 200

    # ----------------- TRY REAL LLM FIRST -----------------
    llm_reply = call_generative_api(raw_message, chat_history)

    if llm_reply:
        reply = llm_reply
    else:
        # ----------------- FALLBACK TO NATURAL LOCAL SIMULATOR -----------------
        # Multilingual Hindi/Telugu checks
        if any(k in message for k in ['नमस्ते', 'नमस्कार', 'हैلو', 'तुम कौन हो', 'मदद', 'कैसे हो']):
            reply = (
                "नमस्ते! मैं **LifePulse AI** हूँ। मैं आपका डिजिटल स्वास्थ्य और कल्याण सहायक हूँ।\n\n"
                "मैं आपके स्वास्थ्य संबंधी प्रश्नों के उत्तर दे सकता हूँ, वेलनेस टिप्स (जैसे योग, सांस लेना) दे सकता हूँ, "
                "या आपको हमारे डॉक्टरों के साथ अपॉइंटमेंट बुक करने में मदद कर सकता हूँ। आज मैं आपकी क्या मदद करूँ?"
            )
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        if any(k in message for k in ['నమస్కారం', 'హలో', 'ఎలా ఉన్నావు', 'నువ్వు ఎవరు', 'సహాయం']):
            reply = (
                "నమస్కారం! నేను **LifePulse AI**ని. నేను మీ వర్చువల్ హెల్త్ అండ్ వెల్నెస్ అసిస్టెంట్.\n\n"
                "నేను మీకు ఆరోగ్య సమాచారం, వ్యాయామ చిట్కాలు అందించగలను లేదా డాక్టర్ అపాయింట్‌మెంట్‌లను బుక్ చేయడంలో సహాయపడగలను. "
                "ఈరోజు మీకు నేను ఏ విధంగా సహాయం చేయగలను?"
            )
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        # Greetings fallback
        if any(greet in message for greet in ['hello', 'hi', 'hey', 'greetings', 'welcome', 'who are you', 'how are you', 'help']):
            reply = (
                "Hello there! I'm PulseAI, your virtual wellness and clinical assistant here at LifePulse. "
                "I can answer health queries, provide natural wellness tips (like breathing, yoga, and lifestyle choices), "
                "explain symptoms, or connect you with our specialist doctors when you need them. What's on your mind today?"
            )
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        # PPG Scan instructions
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
            return jsonify({'reply': reply, 'suggested_department': None, 'action': action, 'recommendation': None}), 200

        # Hospital Navigation services
        elif any(k in message for k in ['pharmacy', 'medicine', 'prescription', 'refill', 'pill', 'drugstore', 'buy medicine']):
            reply = "LifePulse operates a 24/7 fully-stocked Pharmacy. You can view your active prescriptions, check medicine details, and place orders directly from the Patient Pharmacy page. Location: Block D, Ground Floor."
            action = {
                'type': 'route',
                'path': '/patient/pharmacy',
                'label': 'Browse Pharmacy & Orders'
            }
            return jsonify({'reply': reply, 'suggested_department': None, 'action': action, 'recommendation': None}), 200

        elif any(k in message for k in ['blood bank', 'blood donor', 'plasma', 'donate blood', 'transfusion', 'blood type']):
            reply = "Our Central Blood Bank acts as an active inventory. You can request compatible blood bags for surgeries, check available reserves (A+, B+, O-, etc.), or register as a voluntary blood donor. Location: Block C, Floor 1."
            action = {
                'type': 'route',
                'path': '/patient/bloodbank',
                'label': 'Open Blood Bank Portal'
            }
            return jsonify({'reply': reply, 'suggested_department': None, 'action': action, 'recommendation': None}), 200

        elif any(k in message for k in ['report', 'lab result', 'medical record', 'medical file', 'download report', 'discharge summary', 'records']):
            reply = "All your medical files, prescription sheets, blood bank history, and laboratory test reports are securely stored in your patient account. You can view them in the dashboard under Prescriptions and medical archives."
            action = {
                'type': 'route',
                'path': '/patient/prescriptions',
                'label': 'View My Prescriptions'
            }
            return jsonify({'reply': reply, 'suggested_department': None, 'action': action, 'recommendation': None}), 200

        # General Vital Norm Ranges
        elif any(k in message for k in ['oxygen level', 'spo2 range', 'hypoxia', 'oxygen percentage']):
            reply = "Normal blood oxygen saturation (SpO2) ranges from 95% to 100%. Levels between 90% and 94% indicate mild hypoxia (oxygen deprivation), while levels below 90% are a clinical emergency requiring immediate oxygen support."
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        elif any(k in message for k in ['blood pressure level', 'bp range', 'hypertension level', 'normal bp', 'pressure range']):
            reply = "A normal blood pressure reading is less than 120/80 mmHg. Elevated BP is 120-129/80. Stage 1 Hypertension is 130-139 systolic or 80-89 diastolic. Stage 2 is 140/90 or higher, and hypertensive crisis is 180+/120+."
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        elif any(k in message for k in ['heart rate range', 'pulse range', 'tachycardia', 'bradycardia', 'normal pulse', 'normal heart rate']):
            reply = "For healthy adults, a normal resting heart rate (pulse) ranges from 60 to 100 beats per minute (bpm). A rate lower than 60 bpm is bradycardia (normal for athletes), and a rate above 100 bpm is tachycardia."
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        elif any(k in message for k in ['sugar level', 'glucose level', 'diabetes range', 'hba1c', 'normal sugar']):
            reply = "Normal fasting blood glucose (sugar) is 70 to 100 mg/dL. Prediabetes is 100 to 125 mg/dL. A reading of 126 mg/dL or higher on two separate tests indicates diabetes. Normal HbA1c is below 5.7%."
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        # General wellness tips
        elif any(k in message for k in ['tip', 'health tip', 'advice', 'healthy', 'stay fit', 'diet']):
            reply = random.choice(HEALTH_TIPS)
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        # Coding / Math local fallback solver
        elif any(k in message for k in ['code', 'program', 'function', 'javascript', 'python', 'react']):
            reply = "Here is a complete, working example of a diagnostic fetch script:\n```javascript\nfetch('/api/chatbot/query', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ message: 'headache' })\n}).then(res => res.json()).then(console.log);\n```"
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        elif any(k in message for k in ['math', 'calculate', 'solve', 'equation']):
            reply = "Let's calculate MAP (Mean Arterial Pressure):\n$$\\text{MAP} = \\text{Diastolic BP} + \\frac{1}{3}(\\text{Systolic BP} - \\text{Diastolic BP})$$\nFor 120/80 BP: $80 + \\frac{1}{3}(40) \\approx 93.33\\text{ mmHg}$."
            return jsonify({'reply': reply, 'suggested_department': None, 'action': None, 'recommendation': None}), 200

        # Local Triage Symptom checks
        matched_scores = {}
        for dept, data_map in CLINICAL_MAP.items():
            if dept == 'Emergency':
                continue
            score = sum(1 for kw in data_map['keywords'] if kw in message)
            if score > 0:
                matched_scores[dept] = score

        if matched_scores:
            best_dept = max(matched_scores, key=matched_scores.get)
            suggested_dept = best_dept
            if wants_doctor:
                reply = CLINICAL_MAP[best_dept]['recommendation_reply']
                action = CLINICAL_MAP[best_dept]['action']
            else:
                reply = CLINICAL_MAP[best_dept]['info_reply']
                recommendation = {
                    'reply': CLINICAL_MAP[best_dept]['recommendation_reply'],
                    'action': CLINICAL_MAP[best_dept]['action']
                }
        else:
            reply = (
                "I understand you're asking about your wellness or health symptoms. "
                "For minor issues: stay hydrated, take slow deep breaths, "
                "try gentle stretches or yoga to release tension, and be patient with your recovery. "
                "Let yourself rest in a quiet, peaceful environment.\n\n"
                "While I can analyze common signs and direct you to clinical departments "
                "(such as Cardiology, Pulmonology, or Neurology), I don't have a direct "
                "diagnostic match for your specific description."
            )
            recommendation = {
                'reply': "If you require a clinical physical exam, we recommend booking a consult with our General Medicine department. Recommended Specialist: Dr. Gregory House (MD Internal Medicine). Location: Block A, Floor 0.",
                'action': {'type': 'route', 'path': '/appointments', 'label': 'Book General Medicine Consultation'}
            }

    # ----------------- ATTACH DOCTOR RECOMMENDATION TO LLM RESPONSES -----------------
    # Even if LLM replied, check if the query contains symptoms that warrant a doctor recommend option
    if not wants_doctor and recommendation is None:
        matched_scores = {}
        for dept, data_map in CLINICAL_MAP.items():
            if dept == 'Emergency':
                continue
            score = sum(1 for kw in data_map['keywords'] if kw in message)
            if score > 0:
                matched_scores[dept] = score
        
        if matched_scores:
            best_dept = max(matched_scores, key=matched_scores.get)
            suggested_dept = best_dept
            recommendation = {
                'reply': CLINICAL_MAP[best_dept]['recommendation_reply'],
                'action': CLINICAL_MAP[best_dept]['action']
            }

    # Add general educational warning disclaimer for non-greeting inputs
    if not any(k in message for k in ['hello', 'hi', 'hey', 'greetings', 'welcome', 'who are you', 'how are you', 'help']):
        if not reply.endswith("*"):
            reply += "\n\n*Disclaimer: LifePulse AI provides educational facts and wellness suggestions. This is not medical advice. For severe symptoms or medical emergencies, consult a healthcare professional immediately.*"

    return jsonify({
        'reply': reply,
        'suggested_department': suggested_dept,
        'action': action,
        'recommendation': recommendation
    }), 200
