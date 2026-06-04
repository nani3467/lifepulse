import os
import pickle
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report, confusion_matrix
from xgboost import XGBClassifier

# Constants
SYMPTOMS_LIST = [
    'shortness_of_breath', 'fatigue', 'chest_pain', 'headache',
    'body_ache', 'sore_throat', 'runny_nose', 'nausea',
    'vomiting', 'dizziness', 'confusion', 'wheezing'
]

DISEASE_METADATA = {
    'COVID-19 / Flu': {'dept': 'General Medicine', 'risk': 'medium'},
    'Pneumonia': {'dept': 'Pulmonology', 'risk': 'high'},
    'Diabetic Ketoacidosis': {'dept': 'Endocrinology', 'risk': 'high'},
    'Hypertension Crisis': {'dept': 'Cardiology', 'risk': 'high'},
    'COPD / Asthma Flare-up': {'dept': 'Pulmonology', 'risk': 'high'},
    'Migraine': {'dept': 'Neurology', 'risk': 'low'},
    'Common Cold': {'dept': 'General Medicine', 'risk': 'low'},
    'Healthy / Normal': {'dept': 'General Medicine', 'risk': 'low'}
}

DISEASE_CLASSES = list(DISEASE_METADATA.keys())
DISEASE_TO_IDX = {disease: i for i, disease in enumerate(DISEASE_CLASSES)}
IDX_TO_DISEASE = {i: disease for i, disease in enumerate(DISEASE_CLASSES)}

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'saved_models')
os.makedirs(MODEL_DIR, exist_ok=True)


def generate_synthetic_data(num_samples=3000):
    """
    Generates a synthetic medical dataset with clinical correlations between
    vitals (fever, cough, oxygen, BP, sugar), symptoms, and target diseases.
    """
    np.random.seed(42)
    data = []

    samples_per_class = num_samples // len(DISEASE_CLASSES)

    for disease in DISEASE_CLASSES:
        for _ in range(samples_per_class):
            row = {}
            # Initialize default normal/random values
            fever = np.random.uniform(97.5, 98.9)
            cough = np.random.choice([0, 1], p=[0.85, 0.15])
            oxygen = np.random.randint(96, 101)
            sys_bp = np.random.randint(110, 130)
            dia_bp = np.random.randint(70, 85)
            sugar = np.random.randint(70, 115)
            
            # Reset symptoms to 0
            symptoms = {symptom: 0 for symptom in SYMPTOMS_LIST}

            if disease == 'COVID-19 / Flu':
                fever = np.random.uniform(100.5, 104.5)
                cough = 1
                oxygen = np.random.randint(93, 98)
                # symptoms
                symptoms['fatigue'] = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms['body_ache'] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms['headache'] = np.random.choice([0, 2, 1], p=[0.2, 0.2, 0.6]) # multi-hot representation
                symptoms['sore_throat'] = np.random.choice([0, 1], p=[0.3, 0.7])
                symptoms['runny_nose'] = np.random.choice([0, 1], p=[0.25, 0.75])

            elif disease == 'Pneumonia':
                fever = np.random.uniform(101.0, 104.5)
                cough = 1
                oxygen = np.random.randint(84, 93) # low oxygen
                sys_bp = np.random.randint(95, 120)
                dia_bp = np.random.randint(60, 78)
                # symptoms
                symptoms['shortness_of_breath'] = np.random.choice([0, 1], p=[0.05, 0.95])
                symptoms['chest_pain'] = np.random.choice([0, 1], p=[0.2, 0.8])
                symptoms['fatigue'] = np.random.choice([0, 1], p=[0.2, 0.8])

            elif disease == 'Diabetic Ketoacidosis':
                fever = np.random.uniform(97.8, 100.5)
                cough = np.random.choice([0, 1], p=[0.9, 0.1])
                sugar = np.random.randint(240, 480) # very high sugar
                sys_bp = np.random.randint(90, 115) # dehydrated, lower BP
                dia_bp = np.random.randint(55, 75)
                # symptoms
                symptoms['nausea'] = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms['vomiting'] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms['confusion'] = np.random.choice([0, 1], p=[0.3, 0.7])
                symptoms['fatigue'] = np.random.choice([0, 1], p=[0.1, 0.9])

            elif disease == 'Hypertension Crisis':
                fever = np.random.uniform(97.2, 99.0)
                sys_bp = np.random.randint(180, 230) # extremely high BP
                dia_bp = np.random.randint(105, 130)
                # symptoms
                symptoms['headache'] = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms['dizziness'] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms['chest_pain'] = np.random.choice([0, 1], p=[0.4, 0.6])
                symptoms['confusion'] = np.random.choice([0, 1], p=[0.6, 0.4])

            elif disease == 'COPD / Asthma Flare-up':
                fever = np.random.uniform(97.5, 100.2)
                cough = np.random.choice([0, 1], p=[0.3, 0.7])
                oxygen = np.random.randint(87, 94) # low oxygen
                sys_bp = np.random.randint(120, 145)
                dia_bp = np.random.randint(80, 95)
                # symptoms
                symptoms['shortness_of_breath'] = np.random.choice([0, 1], p=[0.02, 0.98])
                symptoms['whezing'] = np.random.choice([0, 1], p=[0.1, 0.9])  # note: mapped to wheezing below
                symptoms['fatigue'] = np.random.choice([0, 1], p=[0.3, 0.7])
                # Fix typo mapping whezing -> wheezing
                symptoms['wheezing'] = symptoms.pop('whezing')

            elif disease == 'Migraine':
                symptoms['headache'] = 1 # always has headache
                symptoms['nausea'] = np.random.choice([0, 1], p=[0.25, 0.75])
                symptoms['dizziness'] = np.random.choice([0, 1], p=[0.4, 0.6])
                symptoms['fatigue'] = np.random.choice([0, 1], p=[0.5, 0.5])

            elif disease == 'Common Cold':
                fever = np.random.uniform(98.2, 100.2)
                cough = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms['sore_throat'] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms['runny_nose'] = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms['headache'] = np.random.choice([0, 1], p=[0.6, 0.4])
                symptoms['fatigue'] = np.random.choice([0, 1], p=[0.4, 0.6])

            # Populate vitals
            row['fever'] = round(fever, 1)
            row['cough'] = int(cough)
            row['oxygen_level'] = int(oxygen)
            row['systolic_bp'] = int(sys_bp)
            row['diastolic_bp'] = int(dia_bp)
            row['sugar_level'] = int(sugar)
            
            # Populate symptoms
            for s in SYMPTOMS_LIST:
                row[s] = int(symptoms.get(s, 0))

            row['disease'] = DISEASE_TO_IDX[disease]
            data.append(row)

    df = pd.DataFrame(data)
    # Shuffle dataset
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


def train_models():
    """
    Generate dataset, train Decision Tree, Random Forest, and XGBoost models,
    calculate performance metrics, and serialize all models and scalers.
    """
    df = generate_synthetic_data()

    # Preprocessing
    numerical_cols = ['fever', 'oxygen_level', 'systolic_bp', 'diastolic_bp', 'sugar_level']
    symptom_cols = SYMPTOMS_LIST
    feature_cols = numerical_cols + ['cough'] + symptom_cols

    X = df[feature_cols]
    y = df['disease']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Scale numerical features
    scaler = MinMaxScaler()
    # Fit scaler only on numerical cols
    scaler.fit(X_train[numerical_cols])

    # Save Scaler
    with open(os.path.join(MODEL_DIR, 'scaler.pkl'), 'wb') as f:
        pickle.dump(scaler, f)

    def preprocess_df(data_df):
        df_copy = data_df.copy()
        df_copy[numerical_cols] = scaler.transform(df_copy[numerical_cols])
        return df_copy

    X_train_scaled = preprocess_df(X_train)
    X_test_scaled = preprocess_df(X_test)

    # Models definition
    models = {
        'Decision Tree': DecisionTreeClassifier(max_depth=8, random_state=42),
        'Random Forest': RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42),
        'XGBoost': XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, eval_metric='mlogloss')
    }

    metrics = {}

    for name, model in models.items():
        # Train model
        model.fit(X_train_scaled, y_train)

        # Predict
        y_pred = model.predict(X_test_scaled)
        y_prob = model.predict_proba(X_test_scaled)

        # Evaluation metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')

        # Feature importances
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_.tolist()
        else:
            importances = [0.0] * len(feature_cols)

        feature_imp_dict = {feat: round(imp, 4) for feat, imp in zip(feature_cols, importances)}
        # Sort feature importances
        feature_imp_sorted = sorted(feature_imp_dict.items(), key=lambda x: x[1], reverse=True)

        conf_mat = confusion_matrix(y_test, y_pred).tolist()

        metrics[name] = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'feature_importances': feature_imp_sorted,
            'confusion_matrix': conf_mat
        }

        # Save model file
        file_name = name.lower().replace(' ', '_') + '_model.pkl'
        with open(os.path.join(MODEL_DIR, file_name), 'wb') as f:
            pickle.dump(model, f)

    # Save metrics JSON
    with open(os.path.join(MODEL_DIR, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=4)

    print("ML Models trained and serialized successfully!")
    return metrics


# Cached instances of loaded objects
_scaler = None
_models = {}


def load_assets():
    """Load scaler and models into memory, caching them for performance."""
    global _scaler, _models
    if _scaler is not None and len(_models) == 3:
        return _scaler, _models

    # Load Scaler
    scaler_path = os.path.join(MODEL_DIR, 'scaler.pkl')
    if not os.path.exists(scaler_path):
        print("Saved models not found. Triggering training pipeline...")
        train_models()

    with open(scaler_path, 'rb') as f:
        _scaler = pickle.load(f)

    for name in ['Decision Tree', 'Random Forest', 'XGBoost']:
        file_name = name.lower().replace(' ', '_') + '_model.pkl'
        model_path = os.path.join(MODEL_DIR, file_name)
        with open(model_path, 'rb') as f:
            _models[name] = pickle.load(f)

    return _scaler, _models


def get_metrics_report():
    """Retrieve saved accuracy/precision/recall metrics."""
    metrics_path = os.path.join(MODEL_DIR, 'metrics.json')
    if not os.path.exists(metrics_path):
        return train_models()
    with open(metrics_path, 'r') as f:
        return json.load(f)


def predict_disease(fever, cough, oxygen_level, systolic_bp, diastolic_bp, sugar_level, symptoms_list, model_type='Random Forest'):
    """
    Perform preprocessing and inference on input features.
    
    Inputs:
    - fever (float)
    - cough (bool)
    - oxygen_level (int)
    - systolic_bp (int)
    - diastolic_bp (int)
    - sugar_level (int)
    - symptoms_list (list of strings matching SYMPTOMS_LIST)
    - model_type (string)
    
    Returns a dict with prediction details: disease, confidence %, risk level, recommended department.
    """
    scaler, models = load_assets()
    
    if model_type not in models:
        model_type = 'Random Forest'
        
    model = models[model_type]
    
    # 1. Scale numerical vitals
    numerical_features = np.array([[fever, oxygen_level, systolic_bp, diastolic_bp, sugar_level]])
    scaled_numerical = scaler.transform(numerical_features)[0]
    
    # 2. Build complete feature vector
    # Structure: [scaled_fever, scaled_oxygen_level, scaled_systolic_bp, scaled_diastolic_bp, scaled_sugar_level, cough, symptom_1, symptom_2, ...]
    feature_vector = list(scaled_numerical)
    feature_vector.append(1 if cough else 0)
    
    # Encode symptoms
    for symptom in SYMPTOMS_LIST:
        feature_vector.append(1 if symptom in symptoms_list else 0)
        
    # Reshape for sklearn/xgboost
    X_input = np.array([feature_vector])
    
    # 3. Model Prediction
    prediction_idx = int(model.predict(X_input)[0])
    probabilities = model.predict_proba(X_input)[0]
    confidence = float(probabilities[prediction_idx]) * 100
    
    predicted_disease = IDX_TO_DISEASE[prediction_idx]
    meta = DISEASE_METADATA[predicted_disease]
    
    # 4. Clinical clinical overrides to make system safer and smarter:
    # If SpO2 is critical (<90) or BP is extremely high (>180 systolic), elevate risk
    risk = meta['risk']
    if oxygen_level < 90 or systolic_bp >= 180:
        risk = 'high'
    if oxygen_level < 85 or systolic_bp >= 200:
        # Extreme emergency
        risk = 'high'
        
    # Return formatted results
    return {
        'predicted_disease': predicted_disease,
        'confidence': round(confidence, 1),
        'risk_level': risk,
        'recommended_dept': meta['dept'],
        'model_used': model_type
    }


if __name__ == '__main__':
    # Train if run as a script
    print("Running standalone ML training script...")
    train_models()
