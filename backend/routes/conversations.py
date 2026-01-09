from flask import Blueprint, jsonify
from flask import Blueprint, request, jsonify
from models import db
from models.conversation import Conversation
from models.message import Message
from models.user import User
from utils.auth import token_required

conversations_bp = Blueprint("conversations", __name__, url_prefix="/conversations")


convo_bp = Blueprint("conversations", __name__)

@convo_bp.route("/<int:conversation_id>", methods=["GET"])
def get_conversation(conversation_id):
    return jsonify({"conversation_id": conversation_id})


#One DM for a  pair of users.

@conversations_bp.route("", methods=["POST"])
@token_required
def create_conversation(current_user):
    data = request.get_json()
    other_user_id = data.get("user_id")

    if not other_user_id:
        return jsonify({"error": "user_id required"}), 400

    if other_user_id == current_user.id:
        return jsonify({"error": "Cannot chat with yourself"}), 400

    existing = Conversation.query.filter(
        ((Conversation.user1_id == current_user.id) &
         (Conversation.user2_id == other_user_id)) |
        ((Conversation.user1_id == other_user_id) &
         (Conversation.user2_id == current_user.id))
    ).first()

    if existing:
        return jsonify({"conversation_id": existing.id})

    convo = Conversation(
        user1_id=current_user.id,
        user2_id=other_user_id
    )

    db.session.add(convo)
    db.session.commit()

    return jsonify({"conversation_id": convo.id}), 201


#get all conversations for a user after logged in
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
                "id": other_user.id,
                "username": other_user.username
            }
        })

    return jsonify(results)


#Getting messages in a conversation
@conversations_bp.route("/<int:conversation_id>/messages", methods=["GET"])
@token_required
def get_messages(current_user, conversation_id):
    convo = Conversation.query.get_or_404(conversation_id)

    if current_user.id not in [convo.user1_id, convo.user2_id]:
        return jsonify({"error": "Unauthorized"}), 403

    messages = Message.query.filter_by(
        conversation_id=conversation_id
    ).order_by(Message.timestamp.asc()).all()

    return jsonify([
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "content": m.content,
            "timestamp": m.timestamp.isoformat()
        }
        for m in messages
    ])
