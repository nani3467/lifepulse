from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models.prediction import PredictionRecord
from app.models.patient import Patient
from app.services.ml_service import predict_disease, train_models, get_metrics_report

prediction_bp = Blueprint('predictions', __name__)


@prediction_bp.route('/predict', methods=['POST'])
@jwt_required()
def predict():
    """
    Predict disease based on patient vitals and symptoms.
    Saves the prediction details in the database history.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required_fields = ['fever', 'cough', 'oxygen_level', 'systolic_bp', 'diastolic_bp', 'sugar_level']
    for field in required_fields:
        if field not in data or data[field] is None:
            return jsonify({'error': f'{field} is required'}), 422

    patient_id = data.get('patient_id')
    fever = float(data['fever'])
    cough = bool(data['cough'])
    oxygen_level = int(data['oxygen_level'])
    systolic_bp = int(data['systolic_bp'])
    diastolic_bp = int(data['diastolic_bp'])
    sugar_level = int(data['sugar_level'])
    symptoms = data.get('symptoms', [])  # expected to be list of strings
    model_used = data.get('model_used', 'Random Forest')

    # Convert symptoms list to a comma-separated string for DB storage
    symptoms_str = ','.join(symptoms) if symptoms else ''

    # Get ML Prediction
    try:
        pred_res = predict_disease(
            fever=fever,
            cough=cough,
            oxygen_level=oxygen_level,
            systolic_bp=systolic_bp,
            diastolic_bp=diastolic_bp,
            sugar_level=sugar_level,
            symptoms_list=symptoms,
            model_type=model_used
        )
    except Exception as e:
        return jsonify({'error': f'Prediction execution failed: {str(e)}'}), 500

    # Save to Database
    record = PredictionRecord(
        patient_id=patient_id,
        fever=fever,
        cough=cough,
        oxygen_level=oxygen_level,
        systolic_bp=systolic_bp,
        diastolic_bp=diastolic_bp,
        sugar_level=sugar_level,
        symptoms=symptoms_str,
        model_used=pred_res['model_used'],
        predicted_disease=pred_res['predicted_disease'],
        confidence=pred_res['confidence'],
        risk_level=pred_res['risk_level'],
        recommended_dept=pred_res['recommended_dept']
    )

    db.session.add(record)
    db.session.commit()

    return jsonify({
        'message': 'Prediction completed successfully',
        'prediction': record.to_dict()
    }), 201


@prediction_bp.route('/train', methods=['POST'])
@jwt_required()
def train():
    """Trigger the ML training pipeline to retrain models on synthetic clinical data."""
    try:
        metrics = train_models()
        return jsonify({
            'message': 'ML Models retrained successfully',
            'metrics': metrics
        }), 200
    except Exception as e:
        return jsonify({'error': f'Model retraining failed: {str(e)}'}), 500


@prediction_bp.route('/metrics', methods=['GET'])
@jwt_required()
def metrics():
    """Fetch current metrics (accuracy, precision, recall, confusion matrix, feature importances)."""
    try:
        report = get_metrics_report()
        return jsonify({'metrics': report}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve metrics: {str(e)}'}), 500


@prediction_bp.route('/history', methods=['GET'])
@jwt_required()
def history():
    """Retrieve prediction logs. Optional filtering by patient_id."""
    from flask_jwt_extended import get_jwt_identity
    from app.models.user import User
    
    patient_id = request.args.get('patient_id')
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    query = PredictionRecord.query

    if user.role == 'patient':
        patient = Patient.query.filter_by(user_id=user.id).first()
        if not patient:
            return jsonify({'history': []}), 200
        query = query.filter_by(patient_id=patient.id)
    elif patient_id:
        query = query.filter_by(patient_id=patient_id)

    records = query.order_by(PredictionRecord.created_at.desc()).all()
    return jsonify({'history': [r.to_dict() for r in records]}), 200


@prediction_bp.route('/stats', methods=['GET'])
@jwt_required()
def stats():
    """Retrieve prediction statistics aggregated for the UI dashboard."""
    # 1. Disease breakdown
    disease_counts = db.session.query(
        PredictionRecord.predicted_disease,
        func.count(PredictionRecord.id)
    ).group_by(PredictionRecord.predicted_disease).all()

    # 2. Risk level breakdown
    risk_counts = db.session.query(
        PredictionRecord.risk_level,
        func.count(PredictionRecord.id)
    ).group_by(PredictionRecord.risk_level).all()

    # 3. Model preference counts
    model_counts = db.session.query(
        PredictionRecord.model_used,
        func.count(PredictionRecord.id)
    ).group_by(PredictionRecord.model_used).all()

    # 4. Total and Avg Confidence
    summary = db.session.query(
        func.count(PredictionRecord.id),
        func.avg(PredictionRecord.confidence)
    ).first()

    total_predictions = summary[0] or 0
    avg_confidence = float(summary[1]) if summary[1] else 0.0

    # 5. Last 7 days trend
    today = datetime.utcnow().date()
    start_date = today - timedelta(days=6)
    
    trend_query = db.session.query(
        func.date(PredictionRecord.created_at),
        func.count(PredictionRecord.id)
    ).filter(
        func.date(PredictionRecord.created_at) >= start_date
    ).group_by(
        func.date(PredictionRecord.created_at)
    ).order_by(
        func.date(PredictionRecord.created_at)
    ).all()

    # Map database dates to format
    trend_dict = {str(date): count for date, count in trend_query}
    trend_data = []
    for i in range(7):
        d = start_date + timedelta(days=i)
        d_str = str(d)
        trend_data.append({
            'date': d.strftime('%b %d'),
            'count': trend_dict.get(d_str, 0)
        })

    return jsonify({
        'total_predictions': total_predictions,
        'avg_confidence': round(avg_confidence, 1),
        'disease_distribution': [{'disease': d, 'count': c} for d, c in disease_counts],
        'risk_distribution': [{'risk': r, 'count': c} for r, c in risk_counts],
        'model_distribution': [{'model': m, 'count': c} for m, c in model_counts],
        'trend': trend_data
    }), 200
