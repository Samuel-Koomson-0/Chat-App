import jwt
from flask import request
from config import Config
from extensions import db
from models.conversation import Conversation
from models.message import Message
from flask_socketio import join_room


def _get_user_id_from_token():
    """
    We will authenticate sockets by passing token as a querystring:
      io("http://127.0.0.1:5000", { query: { token: "<JWT>" } })
    """
    token = request.args.get("token")
    if not token:
        return None

    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id")
    except Exception:
        return None


def register_socket_events(socketio):

    @socketio.on("connect")
    def handle_connect():
        user_id = _get_user_id_from_token()
        if not user_id:
            # Reject connection if token is missing/invalid
            return False

        print(f"Client connected: user_id={user_id}, sid={request.sid}")
        socketio.emit("connected", {"user_id": user_id}, to=request.sid)

    @socketio.on("disconnect")
    def handle_disconnect():
        print(f"Client disconnected: sid={request.sid}")

    @socketio.on("join_conversation")
    def handle_join_conversation(data):
        """
        data: { "conversation_id": 1 }
        Joins room: conversation:<id>
        """
        user_id = _get_user_id_from_token()
        if not user_id:
            return socketio.emit("error", {"error": "unauthorized"}, to=request.sid)

        conversation_id = data.get("conversation_id")
        if not conversation_id:
            return socketio.emit("error", {"error": "conversation_id required"}, to=request.sid)

        convo = Conversation.query.get(conversation_id)
        if not convo:
            return socketio.emit("error", {"error": "conversation not found"}, to=request.sid)

        if user_id not in [convo.user1_id, convo.user2_id]:
            return socketio.emit("error", {"error": "forbidden"}, to=request.sid)

        room = f"conversation:{conversation_id}"
        join_room(room)
        socketio.emit("joined_conversation", {"conversation_id": conversation_id}, to=request.sid)

    @socketio.on("send_message")
    def handle_send_message(data):
        """
        data: { "conversation_id": 1, "content": "hi" }
        - verify user belongs
        - save message
        - emit to room
        """
        user_id = _get_user_id_from_token()
        if not user_id:
            return socketio.emit("error", {"error": "unauthorized"}, to=request.sid)

        conversation_id = data.get("conversation_id")
        content = (data.get("content") or "").strip()

        if not conversation_id or not content:
            return socketio.emit("error", {"error": "conversation_id and content required"}, to=request.sid)

        convo = Conversation.query.get(conversation_id)
        if not convo:
            return socketio.emit("error", {"error": "conversation not found"}, to=request.sid)

        if user_id not in [convo.user1_id, convo.user2_id]:
            return socketio.emit("error", {"error": "forbidden"}, to=request.sid)

        msg = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            content=content
        )

        db.session.add(msg)
        db.session.commit()

        payload = {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat()
        }

        room = f"conversation:{conversation_id}"
        socketio.emit("new_message", payload, to=room)
