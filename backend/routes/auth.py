from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import jwt

from models.user import User
from config import db, Config

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

# -------------------------
# REGISTER
# -------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 409

    user = User(
        username=username,
        password_hash=generate_password_hash(password)
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "User registered successfully",
        "user_id": user.id
    }), 201


# -------------------------
# LOGIN
# -------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    payload = {
        "user_id": user.id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }

    token = jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user_id": user.id
    }), 200
