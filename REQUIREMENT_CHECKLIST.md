# Requirement Checklist



### 1. Dashboard Page Requirements

#### ✅ Add tab progress of device
- **Location**: Dashboard → Active section → "Device Progress" tab
- **Status**: ✅ Implemented
- **Details**: 
  - Tab switching between Campaigns / Device Progress / Common Commands
  - Shows progress bar and % for each board
  - Line: `src/App.jsx:249`

#### ✅ Board ใน queue เหลือเท่าไหร่
- **Location**: Dashboard → Board Queue card
- **Status**: ✅ Implemented
- **Details**: 
  - Shows count of available boards (online & idle)
  - Line: `src/App.jsx:223-224`

#### ✅ System ไหน run อะไรอยู่ (สรุปรวม)
- **Location**: Dashboard → System Summary section
- **Status**: ✅ Implemented
- **Details**: 
  - Shows summary of running systems/jobs
  - Displays: Batch ID, Tag, Job Name, Boards, Firmware, Progress
  - Line: `src/App.jsx:189-209`

#### ✅ Board run อะไรอยู่ กี่ % ง่ายๆ
- **Location**: Dashboard → Device Progress tab
- **Status**: ✅ Implemented
- **Details**: 
  - Shows board name, current job, and progress %
  - Progress bar visualization
  - Line: `src/App.jsx:279-297`

#### ✅ Command line (normally use)
- **Location**: Dashboard → Common Commands tab
- **Status**: ✅ Implemented
- **Details**: 
  - Lists commonly used commands
  - Click to copy functionality
  - Shows category for each command
  - Line: `src/App.jsx:298-323`

#### ✅ Remove "My Jobs" filter
- **Status**: ✅ Removed
- **Details**: 
  - No "My Jobs" filter found in Active Campaigns
  - Only shows all running jobs
  - Line: `src/App.jsx:260-278` (no filter buttons)

---

### 2. Board Status (Fleet Manager) Page Requirements

#### ✅ Add board ได้เลยโดยไม่ต้อง fix backend
- **Location**: Fleet Manager → "+ Add Board" button
- **Status**: ✅ Implemented
- **Details**: 
  - Modal form to add new board
  - Stores in frontend state (Zustand)
  - Line: `src/App.jsx:1517, 2493-2591`

#### ✅ Add tag of board
- **Location**: Fleet Manager → Board Details Side Panel
- **Status**: ✅ Implemented
- **Details**: 
  - Edit tag in device details panel
  - Shows tag on board cards
  - Line: `src/App.jsx:2220-2293`

#### ✅ Show ability that can connect with other
- **Location**: Fleet Manager → Board Details Side Panel → Tag & Connections section
- **Status**: ✅ Implemented
- **Details**: 
  - Shows connections/capabilities (MQTT, SSH, etc.)
  - Editable connections field (comma-separated)
  - Displays as badges on board cards
  - Line: `src/App.jsx:2299-2315`

---

### 3. Job Management Page Requirements

#### ✅ Move up/down job (batch) ได้ด้วย
- **Location**: Job Management → Each job card → Arrow buttons
- **Status**: ✅ Implemented
- **Details**: 
  - Move batch/job up/down buttons
  - Reorders jobs in the list
  - Line: `src/App.jsx:1336-1350`
  - Store actions: `src/store/useTestStore.js:262-280`

---

### 4. Setup Page Requirements

#### ✅ For each batch can select appropriate/suitable board
- **Location**: Setup Page → Config Editor → Select Boards section
- **Status**: ✅ Implemented
- **Details**: 
  - Checkbox list of available boards (online & idle)
  - Shows board name, IP, firmware, tag
  - Required before creating batch
  - Line: `src/App.jsx:1113-1148`

#### ✅ Test code command ที่เขียนไว้แล้ว (ให้ software ช่วย run)
- **Location**: Setup Page → "Test Commands" mode
- **Status**: ✅ Implemented
- **Details**: 
  - Tab switching: File Upload / Test Commands
  - Lists pre-written test commands
  - Select command and boards
  - Resolves placeholders ({board_id}, {firmware})
  - "Run Test Command" button
  - Line: `src/App.jsx:568-577, 1200-1227`

---

## Summary

| Requirement | Status | Location |
|------------|--------|----------|
| Tab progress of device | ✅ | Dashboard → Device Progress tab |
| Add board (frontend-only) | ✅ | Fleet Manager → Add Board button |
| Board queue count | ✅ | Dashboard → Board Queue card |
| Move up/down job/batch | ✅ | Job Management → Arrow buttons |
| Board tag | ✅ | Fleet Manager → Device Details |
| Board connections/capabilities | ✅ | Fleet Manager → Device Details |
| Select boards for batch | ✅ | Setup → Config Editor |
| Remove "My Jobs" | ✅ | Removed from Dashboard |
| System summary | ✅ | Dashboard → System Summary |
| Board progress % | ✅ | Dashboard → Device Progress tab |
| Common commands | ✅ | Dashboard → Common Commands tab |
| Test commands | ✅ | Setup → Test Commands mode |




