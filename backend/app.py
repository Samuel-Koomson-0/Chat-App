from flask import Flask
from config import Config
from extensions import db, socketio

from routes.auth import auth_bp
from routes.conversations import conversations_bp

# import socket events (important: registers handlers)
from sockets.chat_events import register_socket_events


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    socketio.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(conversations_bp)

    with app.app_context():
        db.create_all()

    # register socket handlers AFTER init
    register_socket_events(socketio)

    return app


app = create_app()

if __name__ == "__main__":
    socketio.run(app, debug=True)
