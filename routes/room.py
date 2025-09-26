import os, time
from flask import Blueprint, render_template, request, redirect, url_for, send_from_directory, Response, current_app, jsonify
from werkzeug.utils import secure_filename
from lib.rooms import requires_room_auth, get_guest_enabled, set_guest_enabled
from lib.state import get_state

bp = Blueprint("room", __name__)

def _allowed(filename: str) -> bool:
    exts = current_app.config["ALLOWED_EXTENSIONS"]
    return bool(filename) and "." in filename and filename.rsplit(".", 1)[1].lower() in exts

@bp.route("/r/<room>", methods=["GET"])
@requires_room_auth
def room_view(room):
    root = current_app.config["UPLOAD_ROOT"]
    room_dir = os.path.join(root, room)
    pdf_url = None
    if os.path.isdir(room_dir):
        cands = [os.path.join(room_dir, f) for f in os.listdir(room_dir) if f.lower().endswith(".pdf")]
        if cands:
            pdf_path = max(cands, key=os.path.getmtime)
            mtime = int(os.path.getmtime(pdf_path))
            pdf_url = url_for("room.uploaded_file", room=room, filename=os.path.basename(pdf_path)) + f"?v={mtime}"
    return render_template("viewer.html", room=room, pdf_url=pdf_url, guest_enabled=get_guest_enabled(room))

@bp.route("/r/<room>/presenter", methods=["GET"])
@requires_room_auth
def presenter(room):
    root = current_app.config["UPLOAD_ROOT"]
    room_dir = os.path.join(root, room)
    pdf_url = None
    if os.path.isdir(room_dir):
        cands = [os.path.join(room_dir, f) for f in os.listdir(room_dir) if f.lower().endswith(".pdf")]
        if cands:
            pdf_path = max(cands, key=os.path.getmtime)
            mtime = int(os.path.getmtime(pdf_path))
            pdf_url = url_for("room.uploaded_file", room=room, filename=os.path.basename(pdf_path)) + f"?v={mtime}"
    return render_template("presenter.html", room=room, pdf_url=pdf_url)

@bp.route("/r/<room>/upload", methods=["POST"])
@requires_room_auth
def upload(room):
    st = get_state(room)
    if st.get("locked_by") is not None:
        return Response("Uploads are locked while the presentation is locked.", status=423)

    f = request.files.get("file")
    if f is None or not f.filename or not _allowed(f.filename):
        return redirect(url_for("room.room_view", room=room))

    root = current_app.config["UPLOAD_ROOT"]
    room_dir = os.path.join(root, room)
    os.makedirs(room_dir, exist_ok=True)

    filename = secure_filename(f.filename)
    save_path = os.path.join(room_dir, filename)
    f.save(save_path)

    st["current_page"] = 1
    st["num_pages"] = None

    version = int(time.time())
    new_url = url_for("room.uploaded_file", room=room, filename=filename) + f"?v={version}"

    socketio = current_app.extensions["socketio"]
    socketio.emit("pdf_changed", {"url": new_url}, to=room)
    socketio.emit("reset", {"current_page": st["current_page"]}, to=room)

    return redirect(url_for("room.room_view", room=room))

@bp.route("/r/<room>/uploads/<path:filename>")
@requires_room_auth
def uploaded_file(room, filename):
    root = current_app.config["UPLOAD_ROOT"]
    room_dir = os.path.join(root, room)
    return send_from_directory(room_dir, filename, as_attachment=False)

@bp.route("/g/<room>", methods=["GET"])
def guest_view(room):
    # Only serve if enabled
    if not get_guest_enabled(room):
        return render_template("error.html", msg="Guest access is disabled."), 403
    root = current_app.config["UPLOAD_ROOT"]
    room_dir = os.path.join(root, room)
    pdf_url = None
    if os.path.isdir(room_dir):
        cands = [os.path.join(room_dir, f) for f in os.listdir(room_dir) if f.lower().endswith(".pdf")]
        if cands:
            pdf_path = max(cands, key=os.path.getmtime)
            mtime = int(os.path.getmtime(pdf_path))
            pdf_url = url_for("room.uploaded_file", room=room, filename=os.path.basename(pdf_path)) + f"?v={mtime}"
    return render_template("viewer_guest.html", room=room, pdf_url=pdf_url)

@bp.route("/r/<room>/settings/guest", methods=["POST"])
@requires_room_auth
def guest_toggle(room):
    data = request.get_json(silent=True) or {}
    enabled = bool(data.get("enabled"))
    set_guest_enabled(room, enabled)
    regular = url_for("room.room_view", room=room, _external=True)
    guest   = url_for("room.guest_view", room=room, _external=True)
    return jsonify({"enabled": enabled, "regular_url": regular, "guest_url": guest})