import os
from flask import Blueprint, render_template, request, redirect, url_for, session
from lib.rooms import create_room, verify_room, room_exists

bp = Blueprint("lobby", __name__)

@bp.route("/", methods=["GET"])
def lobby():
    return render_template("lobby.html")

@bp.route("/create", methods=["POST"])
def create():
    pw = request.form.get("password", "").strip()
    if not pw:
        return redirect(url_for("lobby.lobby"))
    room = create_room(pw)
    rooms = set(session.get("rooms", []))
    rooms.add(room)
    session["rooms"] = list(rooms)
    return redirect(url_for("room.room_view", room=room))

@bp.route("/r/<room>/join", methods=["GET", "POST"])
def join_room_view(room):
    if request.method == "POST":
        pw = request.form.get("password", "")
        if verify_room(room, pw):
            rooms = set(session.get("rooms", []))
            rooms.add(room)
            session["rooms"] = list(rooms)
            return redirect(url_for("room.room_view", room=room))
        return render_template("error.html", msg="Wrong password!")
    return render_template("join.html", room=room)
