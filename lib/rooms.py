from functools import wraps
from flask import render_template, session, redirect, url_for, Response
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
from .db import db

def gen_room_name(length: int = 16) -> str:
    return secrets.token_hex(length // 2)

def room_exists(room: str) -> bool:
    with db() as con:
        return con.execute("SELECT 1 FROM rooms WHERE room=?", (room,)).fetchone() is not None

def create_room(password: str) -> str:
    while True:
        room = gen_room_name(16)
        with db() as con:
            exists = con.execute("SELECT 1 FROM rooms WHERE room=?", (room,)).fetchone()
        if not exists:
            with db() as con:
                con.execute(
                    "INSERT INTO rooms(room, password_hash) VALUES(?, ?)",
                    (room, generate_password_hash(password))
                )
            return room

def verify_room(room: str, password: str) -> bool:
    with db() as con:
        row = con.execute("SELECT password_hash FROM rooms WHERE room=?", (room,)).fetchone()
        return bool(row and check_password_hash(row["password_hash"], password))

def requires_room_auth(f):
    @wraps(f)
    def w(room, *args, **kwargs):
        if not room_exists(room):
            return render_template("error.html", msg="Room not found."), 404
        allowed = set(session.get("rooms", []))
        if room not in allowed:
            return redirect(url_for("lobby.join_room_view", room=room))
        return f(room, *args, **kwargs)
    return w

def get_guest_enabled(room:str)->bool:
    with db() as con:
        row = con.execute("SELECT guest_enabled FROM rooms WHERE room=?", (room,)).fetchone()
    return bool(row and row["guest_enabled"])

def set_guest_enabled(room:str, enabled:bool)->None:
    with db() as con:
        con.execute("UPDATE rooms SET guest_enabled=? WHERE room=?", (1 if enabled else 0, room))
