from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.notification import Notification

notification_bp = Blueprint('notification', __name__)


def create_notification(title, message, notif_type='info', user_id=None, link=None):
    """
    Helper function to programmatically raise system-wide or user-specific alerts
    across all clinical modules.
    """
    try:
        notif = Notification(
            title=title,
            message=message,
            type=notif_type,
            user_id=user_id,
            link=link
        )
        db.session.add(notif)
        db.session.commit()
        return notif
    except Exception as e:
        db.session.rollback()
        print(f"[-] Centralized notifications failure: {e}")
        return None


@notification_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    """
    Retrieve notification feeds for the current logged-in user,
    including general broadcast notifications (where user_id is null).
    """
    user_id = int(get_jwt_identity())
    
    # Fetch notifications belonging to current user or public system-wide broadcasts
    notifs = Notification.query.filter(
        (Notification.user_id == user_id) | (Notification.user_id.is_(None))
    ).order_by(Notification.is_read.asc(), Notification.created_at.desc()).limit(50).all()
    
    return jsonify({
        'notifications': [n.to_dict() for n in notifs],
        'unread_count': Notification.query.filter(
            ((Notification.user_id == user_id) | (Notification.user_id.is_(None))),
            Notification.is_read == False
        ).count()
    }), 200


@notification_bp.route('/<int:notif_id>/read', methods=['POST'])
@jwt_required()
def mark_read(notif_id):
    """Mark a single notification as read."""
    user_id = int(get_jwt_identity())
    notif = Notification.query.filter_by(id=notif_id).first_or_404()
    
    # Ensure notifications belong to the user or is broadcast
    if notif.user_id and notif.user_id != user_id:
        return jsonify({'error': 'Unauthorized to modify this notification'}), 403
        
    notif.is_read = True
    db.session.commit()
    
    return jsonify({'message': 'Notification marked as read', 'notification': notif.to_dict()}), 200


@notification_bp.route('/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    """Mark all unread notifications as read for current user."""
    user_id = int(get_jwt_identity())
    
    unread_notifs = Notification.query.filter(
        ((Notification.user_id == user_id) | (Notification.user_id.is_(None))),
        Notification.is_read == False
    ).all()
    
    for n in unread_notifs:
        n.is_read = True
        
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'}), 200
