# API Usage Summary (Backend vs Frontend)

สรุปจากการตรวจ `backend/routers/*.py` และฝั่ง frontend (`frontend/src/utils/apiEndpoints.js`, `frontend/src/services/api.js`, `frontend/src/store/useTestStore.js`, `frontend/src/App.jsx`)

## Backend APIs

- System
  - `GET /api/system/health`
  - `GET /api/system/storage`
  - `GET /api/system/board-api/status`
  - `GET /api/health`
- Boards
  - `GET /api/boards`
  - `POST /api/boards`
  - `GET /api/boards/{id}`
  - `PATCH /api/boards/{id}`
  - `GET /api/boards/{id}/status`
  - `GET /api/boards/{id}/telemetry`
  - `POST /api/boards/{id}/reboot`
  - `POST /api/boards/{id}/firmware`
- Jobs
  - `GET /api/jobs`
  - `POST /api/jobs`
  - `GET /api/jobs/{id}`
  - `POST /api/jobs/{id}/start`
  - `POST /api/jobs/{id}/stop`
  - `POST /api/jobs/stop-all`
  - `GET /api/jobs/{id}/export`
  - `PATCH /api/jobs/{id}`
  - `GET /api/jobs/{id}/files`
  - `GET /api/jobs/{id}/pairs`
  - `POST /api/jobs/{id}/files/{file_id}/stop`
  - `POST /api/jobs/{id}/files/{file_id}/move`
  - `POST /api/jobs/upload`
  - `DELETE /api/jobs/{id}`
  - `POST /api/jobs/{id}/reorder`
  - `POST /api/jobs/run-command`
  - `POST /api/jobs/start`
  - `POST /api/jobs/stop`
  - `GET /api/jobs/status/summary`
- Results
  - `GET /api/results`
  - `GET /api/results/{id}`
  - `GET /api/results/{id}/waveform`
  - `GET /api/results/{id}/log`
  - `DELETE /api/results/{id}`
- Files
  - `POST /api/files/upload`
  - `GET /api/files`
  - `GET /api/files/{id}`
  - `DELETE /api/files/{id}`
- Notifications
  - `GET /api/notifications`
  - `POST /api/notifications/{id}/read`
  - `POST /api/notifications/read-all`
- WebSocket
  - `/ws/system`
  - `/ws/boards`
  - `/ws/jobs`

## Frontend APIs

- System
  - `/system/health`
  - `/system/storage`
  - `/system/board-api/status`
- Boards
  - `/boards`
  - `/boards/{id}`
  - `/boards/{id}/telemetry`
  - `/boards/{id}/reboot`
  - `/boards/{id}/firmware`
  - `/boards/{id}/self-test`
  - `/boards/batch`
  - `/boards/{id}/ssh/connect`
- Jobs
  - `/jobs`
  - `/jobs/{id}`
  - `/jobs/{id}/start`
  - `/jobs/{id}/stop`
  - `/jobs/stop-all`
  - `/jobs/{id}/export`
  - `/jobs/{id}/reorder`
  - `/jobs/run-command`
  - `/jobs/{id}/files`
  - `/jobs/{id}/pairs`
  - `/jobs/{id}/files/{file_id}/stop`
  - `/jobs/{id}/files/{file_id}/move`
- Files
  - `/files/upload`
  - `/files`
  - `/files/{id}`
  - `/files/{id}` (delete)
- Notifications
  - `/notifications`
  - `/notifications/{id}/read`
  - `/notifications/read-all`
- WebSocket
  - `/ws/system`
  - `/ws/boards`
  - `/ws/jobs`

## Frontend ใช้งานจริง

- System health: ใช้งานจริง (refresh/silent refresh)
- Boards: list/create/update/delete + batch actions (selfTest/reboot/delete)
- Jobs: list/create/run-command/start (บางกรณี)/stop-all/reorder/stop file/move file/update tag/export และ get pairs
- Files: upload/list/delete
- Notifications: list/mark read/all

## ช่องว่าง/ไม่ครบถ้วน

- Frontend เรียก แต่ backend ไม่มี (คาดว่าจะ 404)
  - `DELETE /api/boards/{id}`
  - `POST /api/boards/batch`
  - `POST /api/boards/{id}/self-test`
  - `/api/boards/{id}/ssh/connect`
- Backend มี แต่ frontend ยังไม่รองรับ
  - `/api/results/*`
  - `/api/jobs/upload`
  - `DELETE /api/jobs/{id}`
  - `/api/jobs/start`, `/api/jobs/stop`, `/api/jobs/status/summary`
  - `/api/boards/{id}/status`
  - `/api/health`
- ฟังก์ชันใน FE ที่ประกาศไว้ แต่ยังไม่มีจุดเรียกใช้งานชัดเจน
  - `getStorageStatus`, `getBoardApiStatus`, `getBoardById`, `getBoardTelemetry`, `rebootBoard` (รายตัว),
    `updateBoardFirmware` (รายตัว), `runBoardSelfTest` (รายตัว), `getBoardSSHConnection`, `getJobById`,
    `getJobFiles`, `getFileById`, `createWebSocket`

## ข้อเสนอแนะสั้นๆ

1) ตัดสินใจว่าจะเพิ่ม endpoint ฝั่ง backend ให้ตรงกับ FE (เช่น `/boards/batch`, `/boards/{id}/self-test`, `DELETE /boards/{id}`) หรือปรับ FE ให้ตรง backend
2) เลือกว่าจะใช้ results/WebSocket จริงไหม แล้วเติมการเรียกใช้งานให้ครบตามที่ต้องการ

## ตารางสรุป

### FE <--> BE

| Endpoint | BE | FE | คำอธิบาย |
| --- | --- | --- | --- |
| `GET /api/system/health` | [x] | [x] | สุขภาพระบบรวม (boards/storage/REST API) |
| `GET /api/system/storage` | [x] | [x] | สถานะพื้นที่จัดเก็บ |
| `GET /api/system/board-api/status` | [x] | [x] | สถานะ Board REST API |
| `GET /api/health` | [x] | [ ] | health check แบบย่อ  |
| `GET /api/boards` | [x] | [x] | รายการบอร์ด/ตัวกรอง |
| `POST /api/boards` | [x] | [x] | สร้างบอร์ดใหม่ |
| `GET /api/boards/{id}` | [x] | [x] | รายละเอียดบอร์ด |
| `PATCH /api/boards/{id}` | [x] | [x] | แก้ไขข้อมูลบอร์ด |
| `DELETE /api/boards/{id}` | [ ] | [x] | FE คาดหวังการลบ แต่ BE ไม่มี endpoint |
| `GET /api/boards/{id}/status` | [x] | [ ] | สถานะบอร์ดแบบละเอียด  |
| `GET /api/boards/{id}/telemetry` | [x] | [x] | Telemetry บอร์ด (voltage/temp/signal) |
| `POST /api/boards/{id}/reboot` | [x] | [x] | รีบูตบอร์ด |
| `POST /api/boards/{id}/firmware` | [x] | [x] | อัปเดตเฟิร์มแวร์ |
| `POST /api/boards/{id}/self-test` | [ ] | [x] | FE คาดหวัง self-test แต่ BE ไม่มี endpoint |
| `POST /api/boards/batch` | [ ] | [x] | FE คาดหวัง batch action แต่ BE ไม่มี endpoint |
| `GET /api/boards/{id}/ssh/connect` | [ ] | [x] | FE คาดหวัง SSH connect แต่ BE ไม่มี endpoint |
| `GET /api/jobs` | [x] | [x] | รายการงานในคิว |
| `POST /api/jobs` | [x] | [x] | สร้างงานจาก payload |
| `GET /api/jobs/{id}` | [x] | [x] | รายละเอียดงาน |
| `POST /api/jobs/{id}/start` | [x] | [x] | เริ่มงาน |
| `POST /api/jobs/{id}/stop` | [x] | [x] | หยุดงาน |
| `POST /api/jobs/stop-all` | [x] | [x] | หยุดงานทั้งหมด |
| `GET /api/jobs/{id}/export` | [x] | [x] | ส่งออกงานเป็น JSON |
| `PATCH /api/jobs/{id}` | [x] | [x] | อัปเดต tag/metadata งาน |
| `GET /api/jobs/{id}/files` | [x] | [x] | รายการไฟล์ในงาน |
| `GET /api/jobs/{id}/pairs` | [x] | [x] | pairs data สำหรับแก้ไข batch |
| `POST /api/jobs/{id}/files/{file_id}/stop` | [x] | [x] | หยุดไฟล์เฉพาะในงาน |
| `POST /api/jobs/{id}/files/{file_id}/move` | [x] | [x] | ย้ายลำดับไฟล์ในงาน |
| `POST /api/jobs/upload` | [x] | [ ] | อัปโหลดไฟล์แล้วสร้างงาน  |
| `DELETE /api/jobs/{id}` | [x] | [ ] | ลบงาน  |
| `POST /api/jobs/{id}/reorder` | [x] | [x] | ย้ายตำแหน่งงานในคิว |
| `POST /api/jobs/run-command` | [x] | [x] | สร้างงานจากคำสั่ง |
| `POST /api/jobs/start` | [x] | [ ] | เริ่มประมวลผลคิว  |
| `POST /api/jobs/stop` | [x] | [ ] | หยุดประมวลผลคิว  |
| `GET /api/jobs/status/summary` | [x] | [ ] | สรุปสถานะคิว  |
| `GET /api/results` | [x] | [ ] | รายการผลทดสอบ  |
| `GET /api/results/{id}` | [x] | [ ] | รายละเอียดผลทดสอบ  |
| `GET /api/results/{id}/waveform` | [x] | [ ] | waveform data  |
| `GET /api/results/{id}/log` | [x] | [ ] | console log  |
| `DELETE /api/results/{id}` | [x] | [ ] | ลบผลทดสอบ  |
| `POST /api/files/upload` | [x] | [x] | อัปโหลดไฟล์ทั่วไป |
| `GET /api/files` | [x] | [x] | รายการไฟล์ที่อัปโหลด |
| `GET /api/files/{id}` | [x] | [x] | รายละเอียดไฟล์ |
| `DELETE /api/files/{id}` | [x] | [x] | ลบไฟล์ |
| `GET /api/notifications` | [x] | [x] | รายการแจ้งเตือน |
| `POST /api/notifications/{id}/read` | [x] | [x] | ทำเครื่องหมายอ่านแล้ว |
| `POST /api/notifications/read-all` | [x] | [x] | ทำเครื่องหมายอ่านทั้งหมด |
| `/ws/system` | [x] | [x] | สตรีมสถานะระบบแบบเรียลไทม์ |
| `/ws/boards` | [x] | [x] | สตรีมสถานะบอร์ดแบบเรียลไทม์ |
| `/ws/jobs` | [x] | [x] | สตรีมความคืบหน้างานแบบเรียลไทม์ |

### BE --> ARM

| Endpoint (บน ARM board) | วัตถุประสงค์ | หมายเหตุ |
| --- | --- | --- |
| `POST /api/v1/files/upload` | อัปโหลดไฟล์เข้า board | รองรับ `vcd`, `job.json`, `firmware` + `sha256` |
| `POST /api/v1/jobs` | สร้าง job บน board | ใช้ `job_id`, `vcd_file_id`, `meta_file_id`, `fw_file_id` |
| `POST /api/v1/runs` | เริ่มรันงาน | ส่ง `zybo_job_id` → ได้ `run_id` |
| `GET /api/v1/runs/{run_id}` | อ่านสถานะรัน (polling) | `state`, `progress`, `frame_idx`, `error_code` |
| `POST /api/v1/runs/{run_id}/stop` | หยุด/ยกเลิกรัน | แนะนำให้รองรับ |
| `GET /api/v1/runs/{run_id}/measurements` | รายการ measurement | ได้ `meas_id`, `size`, `sha256` |
| `GET /api/v1/measurements/{meas_id}/download` | ดาวน์โหลดผล | binary stream |
| `GET /api/v1/health` | Health snapshot แบบ pull | ควรรวม CPU/RAM/DISK |
| `GET /api/v1/sync/events?after_seq=&limit=` | ดึง outbox events | สำหรับ offline→online sync |
| `GET /api/v1/measurements?since=` | ดึงรายการผลที่ยังไม่ sync | ใช้ timestamp ล่าสุด |
| `POST /api/v1/identify` | สั่งบอร์ด blink เพื่อ identify | optional |

### ARM --> BE

| Endpoint (บน BE) | วัตถุประสงค์ | หมายเหตุ |
| --- | --- | --- |
| `POST /api/boards/hello` | แจ้งตัวเมื่อออนไลน์ | payload: `board_id, ip, port, sw_ver, pl_ver, caps` |
| `POST /api/boards/heartbeat` | ส่ง heartbeat | ส่ง CPU/RAM/DISK + state/current_run |
| `POST /api/boards/{id}/runs/{run_id}/status` | ส่งสถานะรัน (push) | optional ถ้าไม่อยากให้ BE polling |
| `POST /api/boards/{id}/measurements` | แจ้งผลเสร็จแล้ว | optional สำหรับ push result metadata |
| `NTP (UDP/123)` | ซิงค์เวลา | ใช้ NTP ไม่ใช่ REST API |

## API ที่ควรเพิ่ม (ข้อเสนอแนะ)

| Endpoint | วัตถุประสงค์ | หมายเหตุ |
| --- | --- | --- |
| `POST /api/jobs/{id}/cancel` | ยกเลิกงาน | แยกจาก stop ที่เป็นชั่วคราว |
| `POST /api/jobs/{id}/pause` | พักงาน | ควบคุมคิวแบบละเอียด |
| `POST /api/jobs/{id}/resume` | กลับมารันต่อ | ใช้คู่กับ pause |
| `GET /api/results/summary` | สรุปผลรวม (pass/fail) | แสดง dashboard/เทรนด์ |
| `GET /api/results/stats` | สถิติรายช่วงเวลา | ใช้สำหรับกราฟ |
| `GET /api/files/{id}/download` | ดาวน์โหลดไฟล์ | แยกจาก metadata |
| `GET /api/results/{id}/log/download` | ดาวน์โหลด log | สำหรับ debug |
| `GET /api/metrics` | metrics สำหรับ monitoring | ใช้กับ Prometheus |

## สรุป API ของ ARM board (ให้ BE เรียก)

| Endpoint | วัตถุประสงค์ | หมายเหตุ |
| --- | --- | --- |
| `POST /api/v1/files/upload` | อัปโหลดไฟล์เข้า board | รองรับ `vcd`, `job.json`, `firmware` + `sha256` |
| `POST /api/v1/jobs` | สร้าง job บน board | ใช้ `job_id`, `vcd_file_id`, `meta_file_id`, `fw_file_id` |
| `POST /api/v1/runs` | เริ่มรันงาน | ส่ง `zybo_job_id` → ได้ `run_id` |
| `GET /api/v1/runs/{run_id}` | อ่านสถานะรัน (polling) | `state`, `progress`, `frame_idx`, `error_code` |
| `POST /api/v1/runs/{run_id}/stop` | หยุด/ยกเลิกรัน | แนะนำให้รองรับ |
| `GET /api/v1/runs/{run_id}/measurements` | รายการ measurement | ได้ `meas_id`, `size`, `sha256` |
| `GET /api/v1/measurements/{meas_id}/download` | ดาวน์โหลดผล | binary stream |
| `GET /api/v1/health` | Health snapshot แบบ pull | ใส่ CPU/RAM/DISK; ถ้ามีแล้วให้ขยาย payload ไม่ต้องเพิ่ม endpoint ใหม่ |
| `GET /api/v1/sync/events?after_seq=&limit=` | ดึง outbox events | สำหรับ offline→online sync |
| `GET /api/v1/measurements?since=` | ดึงรายการผลที่ยังไม่ sync | ใช้ timestamp ล่าสุด |
| `POST /api/v1/identify` | สั่งบอร์ด blink เพื่อ identify | optional |

### GET `/api/v1/health`
ดึง health แบบ pull (เช่น ทุก 30-60 วินาที)

Response (ตัวอย่าง):
```json
{
  "board_id": "zybo-01",
  "uptime_seconds": 12345,
  "state": "online",
  "cpu": { "load": 0.42, "temp": 58.3 },
  "ram": { "used": 512, "total": 1024, "percent": 50 },
  "disk": { "used": 2048, "total": 8192, "percent": 25 },
  "errors": [],
  "last_heartbeat": "2026-01-13T10:30:05Z"
}
```

## รายละเอียด API ของ BE ที่ ARM board เรียกใช้

หมายเหตุ: ซิงค์เวลาให้ใช้ NTP (ไม่ใช่ REST API)

| Endpoint | วัตถุประสงค์ | หมายเหตุ |
| --- | --- | --- |
| `POST /api/boards/hello` | แจ้งตัวเมื่อออนไลน์ | upsert board + set status ONLINE |
| `POST /api/boards/heartbeat` | ส่ง heartbeat | ส่ง CPU/RAM/DISK + state/current_run |
| `POST /api/boards/{id}/runs/{run_id}/status` | ส่งสถานะรัน (push) | optional ถ้าไม่อยากให้ BE polling |
| `POST /api/boards/{id}/measurements` | แจ้งผลเสร็จแล้ว | optional สำหรับ push result metadata |

### POST `/api/boards/hello`
ใช้สำหรับบอร์ดแจ้งตัวเมื่อออนไลน์

Request (ตัวอย่าง):
```json
{
  "board_id": "zybo-01",
  "ip": "192.168.1.10",
  "port": 8001,
  "sw_ver": "v1.2.3",
  "pl_ver": "pl-0.9",
  "caps": ["REST API", "SSH"]
}
```

Response (ตัวอย่าง):
```json
{
  "success": true,
  "status": "online",
  "server_time": "2026-01-13T10:30:00Z"
}
```

### POST `/api/boards/heartbeat`
heartbeat ทุก 5-10 วินาที พร้อมข้อมูล CPU/RAM/DISK

Request (ตัวอย่าง):
```json
{
  "board_id": "zybo-01",
  "state": "online",
  "current_run": "run-123",
  "cpu": { "load": 0.42, "temp": 58.3 },
  "ram": { "used": 512, "total": 1024, "percent": 50 },
  "disk": { "used": 2048, "total": 8192, "percent": 25 }
}
```

Response (ตัวอย่าง):
```json
{
  "success": true,
  "server_time": "2026-01-13T10:30:05Z"
}
```

