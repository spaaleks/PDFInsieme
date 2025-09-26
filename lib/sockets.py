from flask import request
from flask_socketio import emit, join_room
from .state import get_state, all_rooms
from .timer import timer_state, timer_start, timer_stop, timer_reset

def register_socketio_handlers(socketio):

    @socketio.on("join")
    def on_join(data):
        room = data.get("room")
        if not room:
            return
        join_room(room)
        st = get_state(room)
        emit("sync", {"current_page": st["current_page"], "num_pages": st["num_pages"], "locked_by": st["locked_by"]})
        # Timerzustand an neu Beigetretene senden
        emit("timer_update", timer_state(room))

    @socketio.on("report_num_pages")
    def on_report_num_pages(data):
        room = data.get("room"); num = data.get("num_pages")
        if not room or not isinstance(num, int) or num <= 0:
            return
        st = get_state(room)
        st["num_pages"] = num
        socketio.emit("sync", {"current_page": st["current_page"], "num_pages": st["num_pages"], "locked_by": st["locked_by"]}, to=room)

    @socketio.on("goto")
    def on_goto(data):
        room = data.get("room"); page = data.get("page")
        if not room or not isinstance(page, int):
            return
        st = get_state(room)
        sid = request.sid
        if st["locked_by"] is not None and st["locked_by"] != sid:
            emit("lock_denied", {"locked_by": st["locked_by"]})
            return
        if st["num_pages"] is not None:
            page = max(1, min(st["num_pages"], page))
        else:
            page = max(1, page)
        st["current_page"] = page
        socketio.emit("sync", {"current_page": st["current_page"], "num_pages": st["num_pages"], "locked_by": st["locked_by"]}, to=room)

    @socketio.on("step")
    def on_step(data):
        room = data.get("room"); delta = int(data.get("delta", 0))
        if not room or delta == 0:
            return
        st = get_state(room)
        target = st["current_page"] + delta
        on_goto({"room": room, "page": target})

    @socketio.on("lock")
    def on_lock(data):
        room = data.get("room")
        if not room:
            return
        st = get_state(room)
        st["locked_by"] = request.sid
        socketio.emit("sync", {"current_page": st["current_page"], "num_pages": st["num_pages"], "locked_by": st["locked_by"]}, to=room)

    @socketio.on("unlock")
    def on_unlock(data):
        room = data.get("room")
        if not room:
            return
        st = get_state(room)
        if st["locked_by"] == request.sid:
            st["locked_by"] = None
            socketio.emit("sync", {"current_page": st["current_page"], "num_pages": st["num_pages"], "locked_by": st["locked_by"]}, to=room)

    @socketio.on("force_unlock")
    def on_force_unlock(data):
        room = data.get("room")
        if not room:
            return
        st = get_state(room)
        st["locked_by"] = None
        socketio.emit("sync", {"current_page": st["current_page"], "num_pages": st["num_pages"], "locked_by": st["locked_by"]}, to=room)

    @socketio.on("disconnect")
    def on_disconnect():
        # release any room locked by this sid
        for room in all_rooms():
            st = get_state(room)
            if st.get("locked_by") == request.sid:
                st["locked_by"] = None
                socketio.emit("sync", {"current_page": st["current_page"], "num_pages": st["num_pages"], "locked_by": st["locked_by"]}, to=room)

    @socketio.on("timer_start")
    def on_timer_start(data):
        room = data.get("room")
        if not room: return
        state = timer_start(room)
        socketio.emit("timer_update", state, to=room)

    @socketio.on("timer_stop")
    def on_timer_stop(data):
        room = data.get("room")
        if not room: return
        state = timer_stop(room)
        socketio.emit("timer_update", state, to=room)

    @socketio.on("timer_reset")
    def on_timer_reset(data):
        room = data.get("room")
        if not room: return
        state = timer_reset(room)
        socketio.emit("timer_update", state, to=room)

    @socketio.on("pointer_move")
    def on_pointer_move(data):
        room = data.get("room")
        if not room:
            return
        st = get_state(room)
        # only the locker may broadcast pointer when locked
        if st.get("locked_by") and st["locked_by"] != request.sid:
            return
        # expect normalized coords in [0,1], plus page number
        x = data.get("x"); y = data.get("y"); page = data.get("page")
        if not (isinstance(x, (int, float)) and isinstance(y, (int, float)) and isinstance(page, int)):
            return
        # clamp
        x = max(0.0, min(1.0, float(x)))
        y = max(0.0, min(1.0, float(y)))
        socketio.emit("pointer_update", {"x": x, "y": y, "page": page}, to=room)

    @socketio.on("pointer_hide")
    def on_pointer_hide(data):
        room = data.get("room")
        if not room:
            return
        st = get_state(room)
        if st.get("locked_by") and st["locked_by"] != request.sid:
            return
        socketio.emit("pointer_hide", {}, to=room)
