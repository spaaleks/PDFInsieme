import os, time
from dotenv import load_dotenv
from flask import Flask
from flask_socketio import SocketIO
from lib.db import init_db
from lib.sockets import register_socketio_handlers
from routes import register_blueprints

load_dotenv()

UPLOAD_ROOT = 'data'
ALLOWED_EXTENSIONS = {'pdf'}
max_mb = int(os.environ.get("MAX_CONTENT_MB", "64"))

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "dev")
    app.config['UPLOAD_ROOT'] = UPLOAD_ROOT
    app.config['ALLOWED_EXTENSIONS'] = ALLOWED_EXTENSIONS
    app.config['MAX_CONTENT_LENGTH'] = max_mb * 1024 * 1024

    os.makedirs(UPLOAD_ROOT, exist_ok=True)
    init_db()

    # Socket.IO
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
    # make available inside views
    app.extensions['socketio'] = socketio

    # Routes
    register_blueprints(app)

    # Socket handlers
    register_socketio_handlers(socketio)

    return app, socketio

if __name__ == "__main__":
    app, socketio = create_app()
    socketio.run(app, host="0.0.0.0", port=14341, allow_unsafe_werkzeug=True)
