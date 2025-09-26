import time
from .db import db

def _get_timer_row(room):
    with db() as con:
        row = con.execute("SELECT running, start_ts, elapsed_ms FROM timers WHERE room=?", (room,)).fetchone()
        if not row:
            con.execute("INSERT INTO timers(room,running,start_ts,elapsed_ms) VALUES(?,0,NULL,0)", (room,))
            return (0, None, 0)
        return (row["running"], row["start_ts"], row["elapsed_ms"])

def timer_state(room):
    running, start_ts, elapsed_ms = _get_timer_row(room)
    return {
        "running": bool(running),
        "start_ts": float(start_ts) if start_ts is not None else None,
        "elapsed_ms": int(elapsed_ms),
        "server_now": time.time(),
    }

def timer_start(room):
    running, start_ts, elapsed_ms = _get_timer_row(room)
    if running:
        return timer_state(room)
    now = time.time()
    with db() as con:
        con.execute("UPDATE timers SET running=1, start_ts=?, elapsed_ms=? WHERE room=?",
                    (now, elapsed_ms, room))
    return timer_state(room)

def timer_stop(room):
    running, start_ts, elapsed_ms = _get_timer_row(room)
    if not running:
        return timer_state(room)
    now = time.time()
    add_ms = int((now - (start_ts or now)) * 1000)
    with db() as con:
        con.execute("UPDATE timers SET running=0, start_ts=NULL, elapsed_ms=? WHERE room=?",
                    (elapsed_ms + add_ms, room))
    return timer_state(room)

def timer_reset(room):
    with db() as con:
        con.execute("UPDATE timers SET running=0, start_ts=NULL, elapsed_ms=0 WHERE room=?", (room,))
    return timer_state(room)
