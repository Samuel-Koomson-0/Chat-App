from flask import Flask
from config import Config
from extensions import db, jwt, socketio
from routes.auth import auth_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app)

    app.register_blueprint(auth_bp)

    return app

app = create_app()

if __name__ == "__main__":
    socketio.run(app, debug=True)
