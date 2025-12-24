# speedmeter.py
import time, csv, os
from typing import Optional, List, Dict

class TrainSpeedMeter:
    def __init__(self, train_size:int, target_mae:Optional[float]=None, csv_path:str="train_speed_log.csv"):
        self.train_size = int(train_size)
        self.target_mae = target_mae
        self.csv_path = csv_path
        self.t0 = None
        self.epochs = 0
        self.epoch_times: List[float] = []
        self.val_mae_log: List[float] = []
        self.tta_sec: Optional[float] = None
        self._last_epoch_start = None
        self._result: Dict[str, float] = {}

    def start(self):
        self.t0 = time.perf_counter()

    def tick_epoch_start(self):
        self._last_epoch_start = time.perf_counter()

    def tick_epoch_end(self, val_mae: Optional[float]=None):
        assert self._last_epoch_start is not None, "tick_epoch_start()를 먼저 호출하세요."
        e_sec = time.perf_counter() - self._last_epoch_start
        self.epoch_times.append(e_sec)
        self.epochs += 1
        if val_mae is not None:
            self.val_mae_log.append(float(val_mae))
            if self.target_mae is not None and self.tta_sec is None and val_mae <= self.target_mae:
                self.tta_sec = time.perf_counter() - self.t0

    def finish(self) -> Dict[str, float]:
        total_sec = time.perf_counter() - self.t0
        sec_per_epoch_avg = (sum(self.epoch_times)/len(self.epoch_times)) if self.epoch_times else float('nan')
        samples_per_sec = (self.train_size * max(self.epochs,1)) / total_sec
        sec_per_1000 = (total_sec * 1000.0) / (self.train_size * max(self.epochs,1))
        self._result = {
            "total_sec": total_sec,
            "sec_per_epoch_avg": sec_per_epoch_avg,
            "samples_per_sec": samples_per_sec,
            "sec_per_1000_samples": sec_per_1000,
            "epochs": self.epochs,
            "tta_sec": (self.tta_sec if self.tta_sec is not None else float('nan')),
            "target_mae": (self.target_mae if self.target_mae is not None else float('nan')),
            "train_size": self.train_size,
        }
        return self._result

    def write_csv(self):
        write_header = not os.path.exists(self.csv_path)
        with open(self.csv_path, "a", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            if write_header:
                w.writerow(["total_sec","sec_per_epoch_avg","samples_per_sec","sec_per_1000_samples","epochs","tta_sec","target_mae","train_size"])
            r = self._result
            w.writerow([r["total_sec"], r["sec_per_epoch_avg"], r["samples_per_sec"], r["sec_per_1000_samples"], r["epochs"], r["tta_sec"], r["target_mae"], r["train_size"]])
