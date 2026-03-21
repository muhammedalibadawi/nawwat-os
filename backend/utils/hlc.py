import time
import threading
from dataclasses import dataclass

@dataclass
class HLCTimestamp:
    physical_ms: int
    logical: int

    def to_string(self) -> str:
        return f"{self.physical_ms}:{self.logical}"

    @classmethod
    def from_string(cls, ts: str) -> "HLCTimestamp":
        try:
            parts = ts.split(':')
            return cls(physical_ms=int(parts[0]), logical=int(parts[1]))
        except:
            return cls(physical_ms=int(time.time() * 1000), logical=0)

class HLC:
    def __init__(self):
        self.last_physical = 0
        self.logical = 0
        self.lock = threading.Lock()

    def generate(self) -> str:
        with self.lock:
            now = int(time.time() * 1000)
            if now > self.last_physical:
                self.last_physical = now
                self.logical = 0
            else:
                self.logical += 1
            return f"{self.last_physical}:{self.logical}"

    def receive(self, remote_ts_str: str) -> str:
        with self.lock:
            remote = HLCTimestamp.from_string(remote_ts_str)
            now = int(time.time() * 1000)
            self.last_physical = max(self.last_physical, now, remote.physical_ms)
            if self.last_physical == now == remote.physical_ms:
                self.logical = max(self.logical, remote.logical) + 1
            elif self.last_physical == remote.physical_ms:
                self.logical = remote.logical + 1
            elif self.last_physical == now:
                self.logical += 1
            else:
                self.logical = 0
            return f"{self.last_physical}:{self.logical}"
