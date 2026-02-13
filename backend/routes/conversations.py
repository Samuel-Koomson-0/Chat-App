from flask import Blueprint, request, jsonify
from extensions import db
from routes.auth import token_required
from models.user import User
from models.conversation import Conversation
from models.message import Message

conversations_bp = Blueprint("conversations", __name__, url_prefix="/conversations")


def find_existing_conversation(a_id: int, b_id: int):
    return Conversation.query.filter(
        ((Conversation.user1_id == a_id) & (Conversation.user2_id == b_id)) |
        ((Conversation.user1_id == b_id) & (Conversation.user2_id == a_id))
    ).first()


@conversations_bp.route("", methods=["POST"])
@token_required
def create_conversation(current_user):
    data = request.get_json() or {}

    # ✅ match what you are sending from Thunder Client
    other_user_id = data.get("other_user_id")

    if not other_user_id:
        return jsonify({"error": "other_user_id required"}), 400

    other_user_id = int(other_user_id)

    if other_user_id == current_user.id:
        return jsonify({"error": "Cannot chat with yourself"}), 400

    other_user = User.query.get(other_user_id)
    if not other_user:
        return jsonify({"error": "User not found"}), 404

    existing = find_existing_conversation(current_user.id, other_user_id)
    if existing:
        return jsonify({"conversation_id": existing.id}), 200

    convo = Conversation(user1_id=current_user.id, user2_id=other_user_id)
    db.session.add(convo)
    db.session.commit()

    return jsonify({"conversation_id": convo.id}), 201


@conversations_bp.route("", methods=["GET"])
@token_required
def get_conversations(current_user):
    conversations = Conversation.query.filter(
        (Conversation.user1_id == current_user.id) |
        (Conversation.user2_id == current_user.id)
    ).all()

    results = []
    for c in conversations:
        other_id = c.user2_id if c.user1_id == current_user.id else c.user1_id
        other_user = User.query.get(other_id)

        results.append({
            "conversation_id": c.id,
            "with_user": {
                "id": other_user.id if other_user else other_id,
                "username": other_user.username if other_user else None
            }
        })

    return jsonify(results), 200


@conversations_bp.route("/<int:conversation_id>/messages", methods=["GET"])
@token_required
def get_messages(current_user, conversation_id):
    convo = Conversation.query.get_or_404(conversation_id)

    if current_user.id not in [convo.user1_id, convo.user2_id]:
        return jsonify({"error": "Forbidden"}), 403

    messages = Message.query.filter_by(conversation_id=conversation_id) \
        .order_by(Message.timestamp.asc()).all()

    return jsonify([
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "sender_id": m.sender_id,
            "content": m.content,
            "timestamp": m.timestamp.isoformat()
        }
        for m in messages
    ]), 200


@conversations_bp.route("/<int:conversation_id>/messages", methods=["POST"])
@token_required
def send_message(current_user, conversation_id):
    data = request.get_json() or {}
    content = data.get("content")

    if not content:
        return jsonify({"error": "content is required"}), 400

    convo = Conversation.query.get_or_404(conversation_id)

    # user must be part of this conversation
    if current_user.id not in [convo.user1_id, convo.user2_id]:
        return jsonify({"error": "Forbidden"}), 403

    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=content
    )

    db.session.add(msg)
    db.session.commit()

    return jsonify({
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat()
    }), 201
