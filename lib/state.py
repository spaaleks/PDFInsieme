# simple in-memory per-room state; replace with DB if you need persistence
_room_state = {}  # room -> dict

def get_state(room: str):
    s = _room_state.get(room)
    if not s:
        s = {"current_page": 1, "num_pages": None, "locked_by": None}
        _room_state[room] = s
    return s

def all_rooms():
    return list(_room_state.keys())
