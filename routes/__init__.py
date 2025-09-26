from .lobby import bp as lobby_bp
from .room import bp as room_bp

def register_blueprints(app):
    app.register_blueprint(lobby_bp)
    app.register_blueprint(room_bp)
