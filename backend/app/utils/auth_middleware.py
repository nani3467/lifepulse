from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def roles_required(*roles):
    """Decorator to protect routes by role."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get('role') not in roles:
                return jsonify({'error': 'Access forbidden: insufficient permissions'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def admin_required(fn):
    return roles_required('admin')(fn)


def doctor_required(fn):
    return roles_required('admin', 'doctor')(fn)


def staff_required(fn):
    return roles_required('admin', 'doctor', 'receptionist')(fn)
