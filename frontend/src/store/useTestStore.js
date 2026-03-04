// import { create } from 'zustand';

// export const useTestStore = create((set) => ({
//   vcdFiles: [],
//   firmwareFiles: [],
//   jobQueue: [],
  
//   // Actions
//   addVcdFile: (file) => set((state) => ({ vcdFiles: [...state.vcdFiles, file] })),
//   addFirmwareFile: (file) => set((state) => ({ firmwareFiles: [...state.firmwareFiles, file] })),
  
//   addJob: (newJob) => set((state) => ({ jobQueue: [...state.jobQueue, newJob] })),
//   updateJobStatus: (id, status) => set((state) => ({
//     jobQueue: state.jobQueue.map(j => j.id === id ? { ...j, status } : j)
//   })),
//   removeJob: (id) => set((state) => ({
//     jobQueue: state.jobQueue.filter(j => j.id !== id)
//   })),
//   reorderJobs: (newOrder) => set({ jobQueue: newOrder }),
// }));




import { create } from 'zustand';
import { getClientId } from '../utils/sessionStorage';
import api from '../services/api';

// Load test commands from localStorage
const loadTestCommands = () => {
  try {
    const saved = localStorage.getItem('userTestCommands');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load test commands from localStorage', e);
  }
  return null;
};

// Save test commands to localStorage
const saveTestCommands = (commands) => {
  try {
    localStorage.setItem('userTestCommands', JSON.stringify(commands));
  } catch (e) {
    console.error('Failed to save test commands to localStorage', e);
  }
};

// ============================================
// PROFILE SYSTEM (no login/logout)
// ============================================
const PROFILES_LIST_KEY = 'app_profiles_list';
const ACTIVE_PROFILE_ID_KEY = 'app_active_profile_id';
const PROFILE_DATA_PREFIX = 'app_profile_';
const SHARED_PROFILES_KEY = 'app_shared_profiles';

// True if profile id is a backend UUID (can sync / share)
const isBackendProfileId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));

// Load profiles list
const loadProfilesList = () => {
  try {
    const saved = localStorage.getItem(PROFILES_LIST_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Failed to load profiles list', e);
  }
  return [];
};

// Save profiles list
const saveProfilesList = (list) => {
  try {
    localStorage.setItem(PROFILES_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save profiles list', e);
  }
};

// Load shared profiles list [{ id, name? }]
const loadSharedProfilesList = () => {
  try {
    const saved = localStorage.getItem(SHARED_PROFILES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Failed to load shared profiles list', e);
  }
  return [];
};

const saveSharedProfilesList = (list) => {
  try {
    localStorage.setItem(SHARED_PROFILES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save shared profiles list', e);
  }
};

// Load a profile by id
const loadProfile = (profileId) => {
  try {
    const saved = localStorage.getItem(`${PROFILE_DATA_PREFIX}${profileId}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error(`Failed to load profile ${profileId}`, e);
  }
  return null;
};

// Save a profile
const saveProfile = (profileId, profileData) => {
  try {
    const updated = { ...profileData, updatedAt: new Date().toISOString() };
    localStorage.setItem(`${PROFILE_DATA_PREFIX}${profileId}`, JSON.stringify(updated));
  } catch (e) {
    console.error(`Failed to save profile ${profileId}`, e);
  }
};

// Get active profile id (or create default)
const getActiveProfileId = () => {
  try {
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    if (saved) return saved;
  } catch (e) {
    console.error('Failed to get active profile id', e);
  }
  // No active profile - check if we have old savedTestCases to migrate
  const oldData = localStorage.getItem('appSavedTestCases');
  if (oldData) {
    try {
      const oldCases = JSON.parse(oldData);
      if (Array.isArray(oldCases) && oldCases.length > 0) {
        // Migrate to default profile
        const defaultId = 'default';
        const defaultProfile = {
          id: defaultId,
          name: 'Default',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          savedTestCases: oldCases,
          savedTestCaseSets: [],
          preferences: {},
        };
        saveProfile(defaultId, defaultProfile);
        saveProfilesList([{ id: defaultId, name: 'Default' }]);
        localStorage.setItem(ACTIVE_PROFILE_ID_KEY, defaultId);
        localStorage.removeItem('appSavedTestCases'); // Clean up old data
        return defaultId;
      }
    } catch (e) {
      console.error('Failed to migrate old test cases', e);
    }
  }
  // Create default profile
  const defaultId = 'default';
  const defaultProfile = {
    id: defaultId,
    name: 'Default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    savedTestCases: [],
    savedTestCaseSets: [],
    preferences: {},
  };
  saveProfile(defaultId, defaultProfile);
  saveProfilesList([{ id: defaultId, name: 'Default' }]);
  localStorage.setItem(ACTIVE_PROFILE_ID_KEY, defaultId);
  return defaultId;
};

// Load saved test cases from active profile
const loadSavedTestCases = () => {
  const activeId = getActiveProfileId();
  const profile = loadProfile(activeId);
  return profile?.savedTestCases || [];
  
};

// Save saved test cases to active profile (and sync to backend if profile is backend UUID)
const saveSavedTestCases = (list) => {
  const activeId = getActiveProfileId();
  const profile = loadProfile(activeId);
  if (profile) {
    saveProfile(activeId, { ...profile, savedTestCases: list });
  } else {
    const newProfile = {
      id: activeId,
      name: 'Default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedTestCases: list,
      savedTestCaseSets: [],
      preferences: {},
    };
    saveProfile(activeId, newProfile);
  }
  if (isBackendProfileId(activeId)) {
    const p = loadProfile(activeId);
    void api.putProfileData(activeId, { savedTestCases: list, savedTestCaseSets: p?.savedTestCaseSets ?? [] }).catch(() => {});
  }
};

// Load saved test case sets (collections) from active profile
const loadSavedTestCaseSets = () => {
  const activeId = getActiveProfileId();
  const profile = loadProfile(activeId);
  return profile?.savedTestCaseSets || [];
};

// Save saved test case sets to active profile (and sync to backend if profile is backend UUID)
const saveSavedTestCaseSets = (sets) => {
  const activeId = getActiveProfileId();
  const profile = loadProfile(activeId);
  if (profile) {
    saveProfile(activeId, { ...profile, savedTestCaseSets: sets });
  } else {
    const newProfile = {
      id: activeId,
      name: 'Default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedTestCases: [],
      savedTestCaseSets: sets,
      preferences: {},
    };
    saveProfile(activeId, newProfile);
  }
  if (isBackendProfileId(activeId)) {
    const p = loadProfile(activeId);
    void api.putProfileData(activeId, { savedTestCases: p?.savedTestCases ?? [], savedTestCaseSets: sets }).catch(() => {});
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const inferFileType = (name, typeHint) => {
  if (typeHint) {
    const lowered = String(typeHint).toLowerCase();
    if (lowered.includes('vcd')) return 'vcd';
  }
  const ext = String(name || '').split('.').pop()?.toLowerCase();
  if (ext === 'vcd') return 'vcd';
  return 'firmware';
};

export const useTestStore = create((set, get) => ({
  // System Health
  systemHealth: {
    totalBoards: 0,
    onlineBoards: 0,
    busyBoards: 0,
    errorBoards: 0,
    storageUsage: 0, // percentage
    storageTotal: '0B',
    storageUsed: '0B',
    boardApiStatus: 'offline' // 'online' | 'offline'
  },
  
  // Boards/Devices
  boards: [],
  
  // Jobs/Batches
  jobs: [],
  
  // Notifications (from API)
  notifications: [],
  // Local notifications (e.g. job completed - frontend only)
  localNotifications: [],

  // Common Commands (normally use)
  commonCommands: [],
  
  // Test Code Commands (pre-written test commands)
  // Load from localStorage or use default
  testCommands: (() => {
    const saved = loadTestCommands();
    if (saved && saved.length > 0) {
      return saved;
    }
    return [];
  })(),
  
  uploadedFiles: [],
  vcdFiles: [],
  firmwareFiles: [],

  // Saved Test Cases (library) — persisted; only shown in Library after "Save to library"
  savedTestCases: (() => loadSavedTestCases())(),

  // Working Test Cases (draft) — table content; NOT in Library until user clicks "Save to library"
  workingTestCases: [],

  // Saved Test Case Sets — snapshot ของชุด test cases ทั้งตาราง (ไม่ต้องใช้ JSON เอง)
  savedTestCaseSets: (() => loadSavedTestCaseSets())(),

  // Profile System (no login/logout)
  profiles: (() => loadProfilesList())(),
  activeProfileId: (() => getActiveProfileId())(),
  sharedProfiles: (() => loadSharedProfilesList())(),
  viewingSharedProfileId: null,
  sharedProfileDataCache: {}, // { [profileId]: { savedTestCases, savedTestCaseSets } }

  // When editing a set (Load): table shows only set items; library (savedTestCases) is never touched
  loadedSetId: null,
  loadedSetTable: [], // test cases in table when editing a set (only set's items)

  // When Library triggers "edit this test case" → Test Cases page loads this set and focuses row
  libraryEditContext: null, // { loadSetId: string, focusTcIndex?: number } | null
  setLibraryEditContext: (ctx) => set({ libraryEditContext: ctx }),
  clearLibraryEditContext: () => set({ libraryEditContext: null }),

  // UI State
  theme: (() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const KEY = 'appThemeV2';
      const saved = localStorage.getItem(KEY);
      return saved === 'dark' || saved === 'light' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  })(),
  fleetViewMode: 'grid', // 'grid' | 'list'
  fleetFilters: {
    status: null,
    model: null,
    firmware: null
  },
  selectedBoards: [],
  selectedJobFilter: 'all', // 'all' | 'my'
  loading: {
    systemHealth: false,
    boards: false,
    jobs: false,
    notifications: false,
    files: false,
  },
  errors: {
    systemHealth: null,
    boards: null,
    jobs: null,
    notifications: null,
    files: null,
  },
  toasts: [],
  addToast: (toast) => {
    const id = toast?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry = {
      id,
      type: 'info',
      message: '',
      duration: 4000,
      ...toast,
    };
    set((state) => ({ toasts: [...state.toasts, entry] }));
    if (entry.duration !== 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, entry.duration);
    }
    return id;
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  setTheme: (theme) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    set({ theme: next });
    try {
      localStorage.setItem('appThemeV2', next);
    } catch (e) {
      console.error('Failed to persist theme', e);
    }
  },
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('appThemeV2', next);
      } catch (e) {
        console.error('Failed to persist theme', e);
      }
      return { theme: next };
    });
  },
  
  // Actions
  addVcd: (file) => set((state) => ({ vcdFiles: [...state.vcdFiles, file] })),
  addVcdFile: (file) => set((state) => ({ vcdFiles: [...state.vcdFiles, file] })),
  addFirmwareFile: (file) => set((state) => ({ firmwareFiles: [...state.firmwareFiles, file] })),
  addBoard: async (boardInput) => {
    try {
      const payload = {
        name: boardInput.name,
        status: boardInput.status,
        ip: boardInput.ip,
        mac: boardInput.mac,
        firmware: boardInput.firmware,
        model: boardInput.model,
        tag: boardInput.tag,
        connections: boardInput.connections,
      };
      const created = await api.createBoard(payload);
      await get().refreshBoards();
      return created;
    } catch (error) {
      console.error('Failed to add board', error);
      return null;
    }
  },
  deleteBoard: async (boardId) => {
    set((state) => ({
      boards: state.boards.filter(b => b.id !== boardId),
      selectedBoards: state.selectedBoards.filter(id => id !== boardId),
    }));
    try {
      await api.deleteBoard(boardId);
      await get().refreshBoards();
      return true;
    } catch (error) {
      console.error('Failed to delete board', error);
      await get().refreshBoards();
      return false;
    }
  },
  deleteBoards: async (boardIds) => {
    set((state) => ({
      boards: state.boards.filter(b => !boardIds.includes(b.id)),
      selectedBoards: state.selectedBoards.filter(id => !boardIds.includes(id)),
    }));
    try {
      await api.batchBoardActions(boardIds, 'delete');
      await get().refreshBoards();
      return true;
    } catch (error) {
      console.error('Failed to delete boards', error);
      await get().refreshBoards();
      return false;
    }
  },
  updateBoard: async (boardId, updates) => {
    set((state) => ({
      boards: state.boards.map(b => b.id === boardId ? { ...b, ...updates } : b)
    }));
    try {
      const updated = await api.updateBoard(boardId, updates);
      if (updated) {
        set((state) => ({
          boards: state.boards.map(b => b.id === boardId ? updated : b)
        }));
      }
      return updated;
    } catch (error) {
      console.error('Failed to update board', error);
      await get().refreshBoards();
      return null;
    }
  },
  updateBoardTag: (boardId, tag) => {
    void get().updateBoard(boardId, { tag });
  },
  updateBoardConnections: (boardId, connections) => {
    void get().updateBoard(boardId, { connections });
  },
  addUploadedFile: async (file) => {
    const state = get();
    const existingNames = state.uploadedFiles.map(f => f.name);
    let finalName = file.name;
    let counter = 1;
    const extension = file.name.split('.').pop();
    const baseName = file.name.replace(`.${extension}`, '');
    
    while (existingNames.includes(finalName)) {
      finalName = `${baseName}_${counter}.${extension}`;
      counter++;
    }

    let uploadTarget = file;
    if (finalName !== file.name) {
      uploadTarget = new File([file], finalName, { type: file.type });
    }

    try {
      const uploaded = await api.uploadFile(uploadTarget);
      if (uploaded.duplicateByContent) {
        get().addToast({ type: 'info', message: `"${uploaded.name}" has the same content as an existing file — reusing existing file` });
      }
      if (uploaded.duplicateByName && !uploaded.duplicateByContent) {
        get().addToast({ type: 'info', message: `Another file named "${uploaded.name}" already exists in the library` });
      }
      const mapped = {
        id: uploaded.id,
        name: uploaded.name,
        originalName: file.name,
        size: uploaded.size ?? file.size,
        sizeFormatted: formatFileSize(uploaded.size ?? file.size),
        date: uploaded.uploadDate || 'Just now',
        type: inferFileType(uploaded.name, uploaded.type),
        file: null,
        uploadDate: uploaded.uploadDate,
      };
      set((prev) => {
        const alreadyInList = prev.uploadedFiles.some((f) => f.id === uploaded.id);
        const nextFiles = alreadyInList ? prev.uploadedFiles : [...prev.uploadedFiles, mapped];
        const isVcd = inferFileType(mapped.name, mapped.type) === 'vcd';
        const nextVcd = !alreadyInList && isVcd ? [...prev.vcdFiles, mapped] : prev.vcdFiles;
        const nextFw = !alreadyInList && !isVcd ? [...prev.firmwareFiles, mapped] : prev.firmwareFiles;
        return {
          uploadedFiles: nextFiles,
          vcdFiles: nextVcd,
          firmwareFiles: nextFw,
        };
      });
      return uploaded;
    } catch (error) {
      console.error('Failed to upload file', error);
      return null;
    }
  },
  removeUploadedFile: async (id) => {
    try {
      await api.deleteFile(id);
      set((state) => ({
        uploadedFiles: state.uploadedFiles.filter(f => f.id !== id),
        vcdFiles: state.vcdFiles.filter(f => f.id !== id),
        firmwareFiles: state.firmwareFiles.filter(f => f.id !== id),
      }));
      return true;
    } catch (error) {
      if (error?.status === 409) {
        get().addToast({
          type: 'warning',
          message: error?.detail || 'File is in use by a running or pending set. Wait for the set to finish or remove the set first.',
        });
      } else {
        console.error('Failed to delete file', error);
        get().addToast({ type: 'error', message: 'Failed to delete file.' });
      }
      return false;
    }
  },

  // Saved Test Cases (library)
  addSavedTestCase: (tc) => {
    const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const entry = { ...tc, id, createdAt: tc.createdAt || new Date().toISOString() };
    set((state) => {
      if (state.loadedSetId) {
        return { loadedSetTable: [...(state.loadedSetTable || []), entry] };
      }
      const next = [...state.savedTestCases, entry];
      saveSavedTestCases(next);
      return { savedTestCases: next };
    });
    return id;
  },
  updateSavedTestCase: (id, updates) => set((state) => {
    if (state.loadedSetId) {
      const next = (state.loadedSetTable || []).map((t) => (t.id === id ? { ...t, ...updates } : t));
      return { loadedSetTable: next };
    }
    const next = state.savedTestCases.map((t) => (t.id === id ? { ...t, ...updates } : t));
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),
  removeSavedTestCase: (id) => set((state) => {
    if (state.loadedSetId) {
      const next = (state.loadedSetTable || []).filter((t) => t.id !== id);
      return { loadedSetTable: next };
    }
    const next = state.savedTestCases.filter((t) => t.id !== id);
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),
  moveSavedTestCaseUp: (id) => set((state) => {
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const i = list.findIndex((t) => t.id === id);
    if (i <= 0) return state;
    const next = [...list];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),
  moveSavedTestCaseDown: (id) => set((state) => {
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const i = list.findIndex((t) => t.id === id);
    if (i < 0 || i >= list.length - 1) return state;
    const next = [...list];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),
  reorderSavedTestCases: (fromIndex, toIndex) => set((state) => {
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const arr = [...list];
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= arr.length || toIndex >= arr.length) return state;
    const [item] = arr.splice(fromIndex, 1);
    const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    arr.splice(insertAt, 0, item);
    if (state.loadedSetId) return { loadedSetTable: arr };
    saveSavedTestCases(arr);
    return { savedTestCases: arr };
  }),
  duplicateSavedTestCase: (id, overrides = {}) => set((state) => {
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const tc = list.find((t) => t.id === id);
    if (!tc) return state;
    const newId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const commands = (Array.isArray(tc.commands) ? tc.commands : []).map((c, i) => ({
      ...c,
      id: `cmd-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
    }));
    const newTc = { ...tc, id: newId, commands, createdAt: new Date().toISOString(), ...overrides };
    const i = list.findIndex((t) => t.id === id);
    const next = [...list];
    next.splice(i + 1, 0, newTc);
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),
  setSavedTestCases: (list) => set((state) => {
    const next = Array.isArray(list) ? list : [];
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),

  // Working Test Cases (draft) — table only; save to library explicitly
  addWorkingTestCase: (tc) => {
    const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const entry = { ...tc, id, createdAt: tc.createdAt || new Date().toISOString() };
    set((state) => ({ workingTestCases: [...state.workingTestCases, entry] }));
    return id;
  },
  updateWorkingTestCase: (id, updates) => set((state) => ({
    workingTestCases: state.workingTestCases.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  })),
  removeWorkingTestCase: (id) => set((state) => ({
    workingTestCases: state.workingTestCases.filter((t) => t.id !== id),
  })),
  setWorkingTestCases: (list) => set({ workingTestCases: Array.isArray(list) ? list : [] }),
  moveWorkingTestCaseUp: (id) => set((state) => {
    const list = state.workingTestCases;
    const i = list.findIndex((t) => t.id === id);
    if (i <= 0) return state;
    const next = [...list];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    return { workingTestCases: next };
  }),
  moveWorkingTestCaseDown: (id) => set((state) => {
    const list = state.workingTestCases;
    const i = list.findIndex((t) => t.id === id);
    if (i < 0 || i >= list.length - 1) return state;
    const next = [...list];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    return { workingTestCases: next };
  }),
  reorderWorkingTestCases: (fromIndex, toIndex) => set((state) => {
    const list = [...state.workingTestCases];
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return state;
    const [item] = list.splice(fromIndex, 1);
    const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    list.splice(insertAt, 0, item);
    return { workingTestCases: list };
  }),
  duplicateWorkingTestCase: (id, overrides = {}) => set((state) => {
    const tc = state.workingTestCases.find((t) => t.id === id);
    if (!tc) return state;
    const newId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const commands = (Array.isArray(tc.commands) ? tc.commands : []).map((c, i) => ({
      ...c,
      id: `cmd-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
    }));
    const newTc = { ...tc, id: newId, commands, createdAt: new Date().toISOString(), ...overrides };
    const i = state.workingTestCases.findIndex((t) => t.id === id);
    const next = [...state.workingTestCases];
    next.splice(i + 1, 0, newTc);
    return { workingTestCases: next };
  }),
  bulkUpdateWorkingTryCount: (ids, tryCount) => set((state) => {
    const num = Math.max(1, Math.min(100, parseInt(tryCount, 10) || 1));
    return {
      workingTestCases: state.workingTestCases.map((t) => (ids.includes(t.id) ? { ...t, tryCount: num } : t)),
    };
  }),
  addWorkingTestCaseCommand: (tcId, { type, file = '' }) => set((state) => {
    const tc = state.workingTestCases.find((t) => t.id === tcId);
    if (!tc) return state;
    const commands = Array.isArray(tc.commands) ? tc.commands : [];
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return {
      workingTestCases: state.workingTestCases.map((t) =>
        t.id === tcId ? { ...t, commands: [...commands, { id, type, file }] } : t
      ),
    };
  }),
  updateWorkingTestCaseCommand: (tcId, cmdId, updates) => set((state) => ({
    workingTestCases: state.workingTestCases.map((t) => {
      if (t.id !== tcId || !Array.isArray(t.commands)) return t;
      return {
        ...t,
        commands: t.commands.map((c) => (c.id === cmdId ? { ...c, ...updates } : c)),
      };
    }),
  })),
  removeWorkingTestCaseCommand: (tcId, cmdId) => set((state) => ({
    workingTestCases: state.workingTestCases.map((t) => {
      if (t.id !== tcId || !Array.isArray(t.commands)) return t;
      return { ...t, commands: t.commands.filter((c) => c.id !== cmdId) };
    }),
  })),
  saveWorkingToLibrary: () => {
    const state = get();
    const list = state.workingTestCases || [];
    saveSavedTestCases(list);
    set({ savedTestCases: list });
    if (isBackendProfileId(getActiveProfileId())) {
      const p = loadProfile(getActiveProfileId());
      void api.putProfileData(getActiveProfileId(), { savedTestCases: list, savedTestCaseSets: p?.savedTestCaseSets ?? [] }).catch(() => {});
    }
  },

  bulkUpdateTryCount: (ids, tryCount) => set((state) => {
    const num = Math.max(1, Math.min(100, parseInt(tryCount, 10) || 1));
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const next = list.map((t) => (ids.includes(t.id) ? { ...t, tryCount: num } : t));
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),

  // Commands/sequences per test case: [{ id, type: 'mdi'|'vcd'|'erom'|'ulp', file: string }]
  addTestCaseCommand: (tcId, { type, file = '' }) => set((state) => {
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const tc = list.find((t) => t.id === tcId);
    if (!tc) return state;
    const commands = Array.isArray(tc.commands) ? tc.commands : [];
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const next = list.map((t) =>
      t.id === tcId ? { ...t, commands: [...commands, { id, type, file }] } : t
    );
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),
  updateTestCaseCommand: (tcId, cmdId, updates) => set((state) => {
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const next = list.map((t) => {
      if (t.id !== tcId || !Array.isArray(t.commands)) return t;
      return {
        ...t,
        commands: t.commands.map((c) => (c.id === cmdId ? { ...c, ...updates } : c)),
      };
    });
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),
  removeTestCaseCommand: (tcId, cmdId) => set((state) => {
    const list = state.loadedSetId ? (state.loadedSetTable || []) : state.savedTestCases;
    const next = list.map((t) => {
      if (t.id !== tcId || !Array.isArray(t.commands)) return t;
      return { ...t, commands: t.commands.filter((c) => c.id !== cmdId) };
    });
    if (state.loadedSetId) return { loadedSetTable: next };
    saveSavedTestCases(next);
    return { savedTestCases: next };
  }),

  // Saved Test Case Sets (collections) — เก็บ items + fileLibrarySnapshot (รายชื่อไฟล์ที่ Set ใช้)
  addSavedTestCaseSet: (name, items, options = {}) => set((state) => {
    const id = `tcs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const normalizedItems = (items || []).map((t, idx) => ({
      name: t.name || `Test case ${idx + 1}`,
      vcdName: t.vcdName || '',
      binName: t.binName || '',
      linName: t.linName || '',
      boardId: t.boardId || '',
      tryCount: typeof t.tryCount === 'number' && t.tryCount > 0 ? t.tryCount : 1,
      extraColumns: t.extraColumns && typeof t.extraColumns === 'object' ? { ...t.extraColumns } : {},
      createdAt: t.createdAt || now,
    }));
    const fileLibrarySnapshot = options.fileLibrarySnapshot || [];
    const entry = { id, name: name || 'Unnamed Set', createdAt: now, updatedAt: now, items: normalizedItems, fileLibrarySnapshot };
    const next = [...state.savedTestCaseSets, entry];
    saveSavedTestCaseSets(next);
    return { savedTestCaseSets: next };
  }),
  updateSavedTestCaseSet: (id, updates) => set((state) => {
    const next = state.savedTestCaseSets.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
    saveSavedTestCaseSets(next);
    return { savedTestCaseSets: next };
  }),
  removeSavedTestCaseSet: (id) => set((state) => {
    const next = state.savedTestCaseSets.filter((s) => s.id !== id);
    saveSavedTestCaseSets(next);
    return { savedTestCaseSets: next };
  }),
  reorderSavedTestCaseSets: (fromIndex, toIndex) => set((state) => {
    const list = [...state.savedTestCaseSets];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return state;
    const [removed] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, removed);
    saveSavedTestCaseSets(list);
    return { savedTestCaseSets: list };
  }),
  moveSavedTestCaseSetUp: (id) => set((state) => {
    const list = [...state.savedTestCaseSets];
    const idx = list.findIndex((s) => s.id === id);
    if (idx <= 0) return state;
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    saveSavedTestCaseSets(list);
    return { savedTestCaseSets: list };
  }),
  moveSavedTestCaseSetDown: (id) => set((state) => {
    const list = [...state.savedTestCaseSets];
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0 || idx >= list.length - 1) return state;
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    saveSavedTestCaseSets(list);
    return { savedTestCaseSets: list };
  }),
  duplicateSavedTestCaseSet: (id) => set((state) => {
    const original = state.savedTestCaseSets.find((s) => s.id === id);
    if (!original) return state;
    const now = new Date().toISOString();
    const newId = `tcs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const baseName = original.name || 'Set';
    const newName = `${baseName} (copy)`;
    const copy = {
      ...original,
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...state.savedTestCaseSets, copy];
    saveSavedTestCaseSets(next);
    return { savedTestCaseSets: next };
  }),
  applySavedTestCaseSet: (id) => set((state) => {
    const setEntry = state.savedTestCaseSets.find((s) => s.id === id);
    if (!setEntry) return state;
    const existingNames = new Set();
    const ensureUnique = (baseName) => {
      const base = (baseName || 'Test case').trim() || 'Test case';
      if (!existingNames.has(base)) return base;
      let n = 2;
      while (existingNames.has(`${base} (${n})`)) n++;
      return `${base} (${n})`;
    };
    const list = (setEntry.items || []).map((t) => {
      const name = ensureUnique((t.name || '').trim() || 'Test case');
      existingNames.add(name);
      const extra = t.extraColumns && typeof t.extraColumns === 'object' ? { ...t.extraColumns } : {};
      const commands = [];
      ['VCD2', 'VCD3', 'VCD4', 'ERoM2', 'ERoM3', 'ULP2', 'ULP3'].forEach((col) => {
        const v = (extra[col] ?? '').toString().trim();
        if (v) {
          const type = col.startsWith('VCD') ? 'vcd' : col.startsWith('ERoM') ? 'erom' : 'ulp';
          commands.push({ id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, type, file: v });
          delete extra[col];
        }
      });
      return {
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        vcdName: t.vcdName || '',
        binName: t.binName || '',
        linName: t.linName || '',
        boardId: t.boardId || '',
        tryCount: typeof t.tryCount === 'number' && t.tryCount > 0 ? t.tryCount : 1,
        extraColumns: extra,
        commands,
        createdAt: t.createdAt || new Date().toISOString(),
      };
    });
    saveSavedTestCases(list);
    return { savedTestCases: list, workingTestCases: [] };
  }),
  /** Load set items into table for editing. Uses loadedSetTable only — savedTestCases (library) is NOT touched. */
  loadSetForEditing: (id) => set((state) => {
    const setEntry = state.savedTestCaseSets.find((s) => s.id === id);
    if (!setEntry) return state;
    const existingNames = new Set();
    const ensureUnique = (baseName) => {
      const base = (baseName || 'Test case').trim() || 'Test case';
      if (!existingNames.has(base)) return base;
      let n = 2;
      while (existingNames.has(`${base} (${n})`)) n++;
      return `${base} (${n})`;
    };
    const list = (setEntry.items || []).map((t) => {
      const name = ensureUnique((t.name || '').trim() || 'Test case');
      existingNames.add(name);
      const extra = t.extraColumns && typeof t.extraColumns === 'object' ? { ...t.extraColumns } : {};
      const commands = [];
      ['VCD2', 'VCD3', 'VCD4', 'ERoM2', 'ERoM3', 'ULP2', 'ULP3'].forEach((col) => {
        const v = (extra[col] ?? '').toString().trim();
        if (v) {
          const type = col.startsWith('VCD') ? 'vcd' : col.startsWith('ERoM') ? 'erom' : 'ulp';
          commands.push({ id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, type, file: v });
          delete extra[col];
        }
      });
      return {
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        vcdName: t.vcdName || '',
        binName: t.binName || '',
        linName: t.linName || '',
        boardId: t.boardId || '',
        tryCount: typeof t.tryCount === 'number' && t.tryCount > 0 ? t.tryCount : 1,
        extraColumns: extra,
        commands,
        createdAt: t.createdAt || new Date().toISOString(),
      };
    });
    return { loadedSetId: id, loadedSetTable: list };
  }),
  restoreSavedTestCasesFromProfile: () => set(() => {
    const list = loadSavedTestCases();
    return { savedTestCases: list, loadedSetId: null, loadedSetTable: [] };
  }),
  setLoadedSetId: (id) => set((state) => ({ loadedSetId: id ?? null, loadedSetTable: id ? state.loadedSetTable : [] })),

  /** Merge full library view (savedTestCases + unique items from sets) into savedTestCases and persist. Use before navigating to Test Cases so the table shows all library rows. */
  syncFullLibraryToSavedTestCases: () => set((state) => {
    const contentKey = (tc) => [tc.name ?? '', tc.vcdName ?? '', tc.binName ?? '', tc.linName ?? ''].join('\0');
    const fromCurrent = state.savedTestCases || [];
    const seen = new Set(fromCurrent.map(contentKey));
    const fromSets = (state.savedTestCaseSets || []).flatMap((set) =>
      (Array.isArray(set.items) ? set.items : []).map((t) => ({
        ...t,
        id: t.id || `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      }))
    );
    const toAdd = fromSets.filter((tc) => {
      const key = contentKey(tc);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (toAdd.length === 0) return {};
    const next = [...fromCurrent, ...toAdd];
    saveSavedTestCases(next);
    const activeId = getActiveProfileId();
    if (isBackendProfileId(activeId)) {
      const p = loadProfile(activeId);
      void api.putProfileData(activeId, { savedTestCases: next, savedTestCaseSets: p?.savedTestCaseSets ?? [] }).catch(() => {});
    }
    return { savedTestCases: next };
  }),

  appendSavedTestCaseSet: (id) => set((state) => {
    const setEntry = state.savedTestCaseSets.find((s) => s.id === id);
    if (!setEntry) return state;
    const existingNames = new Set(state.workingTestCases.map((t) => (t.name || '').trim()).filter(Boolean));
    const ensureUnique = (baseName) => {
      const base = (baseName || 'Test case').trim() || 'Test case';
      if (!existingNames.has(base)) return base;
      let n = 2;
      while (existingNames.has(`${base} (${n})`)) n++;
      return `${base} (${n})`;
    };
    const appended = (setEntry.items || []).map((t) => {
      const name = ensureUnique((t.name || '').trim() || 'Test case');
      existingNames.add(name);
      return {
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        vcdName: t.vcdName || '',
        binName: t.binName || '',
        linName: t.linName || '',
        boardId: t.boardId || '',
        tryCount: typeof t.tryCount === 'number' && t.tryCount > 0 ? t.tryCount : 1,
        extraColumns: t.extraColumns && typeof t.extraColumns === 'object' ? { ...t.extraColumns } : {},
        createdAt: t.createdAt || new Date().toISOString(),
      };
    });
    return { workingTestCases: [...state.workingTestCases, ...appended] };
  }),

  // Profile Management (no login/logout)
  createProfile: async (name) => {
    const displayName = (name || 'New Profile').trim();
    let id;
    try {
      const res = await api.createProfileApi(displayName);
      id = res.id;
      name = res.name || displayName;
    } catch (e) {
      id = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      name = displayName;
    }
    const newProfile = {
      id,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedTestCases: [],
      savedTestCaseSets: [],
      preferences: {},
    };
    saveProfile(id, newProfile);
    const profiles = loadProfilesList();
    profiles.push({ id, name });
    saveProfilesList(profiles);
    set({ profiles, activeProfileId: id, savedTestCases: [], savedTestCaseSets: [], workingTestCases: [] });
    return id;
  },
  switchProfile: (profileId) => {
    const profile = loadProfile(profileId);
    if (!profile) {
      console.error(`Profile ${profileId} not found`);
      return false;
    }
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, profileId);
    const testCases = profile.savedTestCases || [];
    const sets = profile.savedTestCaseSets || [];
    set({
      activeProfileId: profileId,
      savedTestCases: testCases,
      savedTestCaseSets: sets,
      workingTestCases: [],
      viewingSharedProfileId: null,
    });
    if (isBackendProfileId(profileId)) {
      void api.getProfileData(profileId).then((data) => {
        const merged = { savedTestCases: data.savedTestCases ?? testCases, savedTestCaseSets: data.savedTestCaseSets ?? sets };
        saveProfile(profileId, { ...profile, ...merged });
        set({ savedTestCases: merged.savedTestCases, savedTestCaseSets: merged.savedTestCaseSets });
      }).catch(() => {});
    }
    return true;
  },
  deleteProfile: (profileId) => {
    if (profileId === 'default') {
      console.error('Cannot delete default profile');
      return false;
    }
    const profiles = loadProfilesList();
    const filtered = profiles.filter((p) => p.id !== profileId);
    saveProfilesList(filtered);
    localStorage.removeItem(`${PROFILE_DATA_PREFIX}${profileId}`);
    const currentActive = get().activeProfileId;
    if (currentActive === profileId) {
      // Switch to default if deleting active profile
      const defaultId = 'default';
      get().switchProfile(defaultId);
    } else {
      set({ profiles: filtered });
    }
    return true;
  },
  updateProfileName: (profileId, newName) => {
    const profile = loadProfile(profileId);
    if (!profile) return false;
    const updated = { ...profile, name: newName };
    saveProfile(profileId, updated);
    const profiles = loadProfilesList();
    const updatedProfiles = profiles.map((p) => (p.id === profileId ? { ...p, name: newName } : p));
    saveProfilesList(updatedProfiles);
    set({ profiles: updatedProfiles });
    if (isBackendProfileId(profileId)) {
      void api.updateProfileNameApi(profileId, newName).catch(() => {});
    }
    return true;
  },
  exportProfile: async (profileId, includeHistory = false) => {
    const targetId = profileId || get().activeProfileId;
    const profile = loadProfile(targetId);
    if (!profile) {
      throw new Error(`Profile ${targetId} not found`);
    }
    let exportData = { ...profile };
    if (includeHistory) {
      try {
        // Fetch current jobs from API as history snapshot
        const jobs = get().jobs || [];
        exportData.historySnapshot = {
          exportedAt: new Date().toISOString(),
          jobs: jobs.map((j) => ({
            id: j.id,
            name: j.name,
            tag: j.tag,
            status: j.status,
            progress: j.progress,
            completedFiles: j.completedFiles,
            totalFiles: j.totalFiles,
            firmware: j.firmware,
            boards: j.boards,
            createdAt: j.createdAt,
            startedAt: j.startedAt,
            completedAt: j.completedAt,
          })),
        };
      } catch (e) {
        console.error('Failed to fetch history snapshot', e);
      }
    }
    return exportData;
  },
  importProfile: (profileData, options = {}) => {
    const { name: newName, overwriteId } = options;
    let targetId = overwriteId;
    if (!targetId) {
      // Create new profile from imported data
      targetId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    const importedProfile = {
      id: targetId,
      name: newName || profileData.name || 'Imported Profile',
      createdAt: profileData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedTestCases: profileData.savedTestCases || [],
      savedTestCaseSets: profileData.savedTestCaseSets || [],
      preferences: profileData.preferences || {},
      historySnapshot: profileData.historySnapshot,
    };
    saveProfile(targetId, importedProfile);
    const profiles = loadProfilesList();
    const existingIndex = profiles.findIndex((p) => p.id === targetId);
    if (existingIndex >= 0) {
      profiles[existingIndex] = { id: targetId, name: importedProfile.name };
    } else {
      profiles.push({ id: targetId, name: importedProfile.name });
    }
    saveProfilesList(profiles);
    set({ profiles });
    if (options.switchToImported) {
      get().switchProfile(targetId);
    }
    return targetId;
  },
  getProfileHistorySnapshot: (profileId) => {
    const targetId = profileId || get().activeProfileId;
    const profile = loadProfile(targetId);
    return profile?.historySnapshot || null;
  },

  // Shared profiles (view / copy from teammate)
  addSharedProfile: async (profileId) => {
    const id = (profileId || '').trim();
    if (!id) return { ok: false, error: 'Profile ID required' };
    if (loadSharedProfilesList().some((p) => p.id === id)) return { ok: true };
    try {
      const meta = await api.getProfile(id);
      const data = await api.getProfileData(id);
      const list = loadSharedProfilesList();
      list.push({ id, name: meta.name || id });
      saveSharedProfilesList(list);
      set((state) => ({
        sharedProfiles: list,
        sharedProfileDataCache: { ...state.sharedProfileDataCache, [id]: data },
      }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'Failed to load profile' };
    }
  },
  removeSharedProfile: (profileId) => {
    const list = loadSharedProfilesList().filter((p) => p.id !== profileId);
    saveSharedProfilesList(list);
    set((state) => {
      const cache = { ...state.sharedProfileDataCache };
      delete cache[profileId];
      return {
        sharedProfiles: list,
        sharedProfileDataCache: cache,
        viewingSharedProfileId: state.viewingSharedProfileId === profileId ? null : state.viewingSharedProfileId,
      };
    });
  },
  setViewingSharedProfile: (profileId) => {
    set({ viewingSharedProfileId: profileId || null });
  },
  fetchSharedProfileData: async (profileId) => {
    try {
      const data = await api.getProfileData(profileId);
      set((state) => ({ sharedProfileDataCache: { ...state.sharedProfileDataCache, [profileId]: data } }));
      return data;
    } catch (e) {
      return null;
    }
  },
  copySharedToMyProfile: () => {
    const state = get();
    const sid = state.viewingSharedProfileId;
    if (!sid) return false;
    const data = state.sharedProfileDataCache[sid];
    if (!data) return false;
    const cases = Array.isArray(data.savedTestCases) ? data.savedTestCases : [];
    const sets = Array.isArray(data.savedTestCaseSets) ? data.savedTestCaseSets : [];
    const activeId = getActiveProfileId();
    const profile = loadProfile(activeId);
    const mergedCases = [...(profile?.savedTestCases || []), ...cases];
    const mergedSets = [...(profile?.savedTestCaseSets || []), ...sets];
    saveProfile(activeId, { ...profile, savedTestCases: mergedCases, savedTestCaseSets: mergedSets });
    set({ savedTestCases: mergedCases, savedTestCaseSets: mergedSets, viewingSharedProfileId: null });
    if (isBackendProfileId(activeId)) {
      void api.putProfileData(activeId, { savedTestCases: mergedCases, savedTestCaseSets: mergedSets }).catch(() => {});
    }
    return true;
  },
  isBackendProfileId: (id) => isBackendProfileId(id),

  updateProgress: (id, val) => set((state) => ({
    jobs: state.jobs.map(j => j.id === id ? { ...j, progress: val } : j)
  })),
  setFleetViewMode: (mode) => set({ fleetViewMode: mode }),
  setFleetFilter: (key, value) => set((state) => ({
    fleetFilters: { ...state.fleetFilters, [key]: value }
  })),
  toggleBoardSelection: (boardId) => set((state) => ({
    selectedBoards: state.selectedBoards.includes(boardId)
      ? state.selectedBoards.filter(id => id !== boardId)
      : [...state.selectedBoards, boardId]
  })),
  selectAllBoards: () => set((state) => ({
    selectedBoards: state.boards.map(b => b.id)
  })),
  clearBoardSelection: () => set({ selectedBoards: [] }),
  setJobFilter: (filter) => set({ selectedJobFilter: filter }),
  markNotificationRead: (id) => {
    if (typeof id === 'string' && id.startsWith('local-')) {
      set((state) => ({
        localNotifications: state.localNotifications.map(n => n.id === id ? { ...n, read: true } : n)
      }));
      return;
    }
    set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }));
    void api.markNotificationRead(id)
      .then(() => get().refreshNotifications())
      .catch((error) => console.error('Failed to mark notification read', error));
  },
  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      localNotifications: state.localNotifications.map(n => ({ ...n, read: true }))
    }));
    void api.markAllNotificationsRead()
      .then(() => get().refreshNotifications())
      .catch((error) => console.error('Failed to mark all notifications read', error));
  },
  updateSystemHealth: (health) => set((state) => ({
    systemHealth: { ...state.systemHealth, ...health }
  })),

  // Backend sync actions
  refreshSystemHealth: async () => {
    try {
      set((state) => ({
        loading: { ...state.loading, systemHealth: true },
        errors: { ...state.errors, systemHealth: null },
      }));
      const data = await api.getSystemHealth();
      set((state) => ({ systemHealth: { ...state.systemHealth, ...data } }));
      return data;
    } catch (error) {
      console.error('Failed to refresh system health', error);
      set((state) => ({
        errors: { ...state.errors, systemHealth: error?.message || 'Failed to load system health' },
      }));
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, systemHealth: false } }));
    }
  },
  // Silent refresh – ไม่แตะ loading/errors ใช้กับ auto-poll เพื่อไม่ให้ UI กระพริบ
  silentRefreshSystemHealth: async () => {
    try {
      const data = await api.getSystemHealth();
      set((state) => ({ systemHealth: { ...state.systemHealth, ...data } }));
      return data;
    } catch (error) {
      console.error('Failed to silent refresh system health', error);
      return null;
    }
  },
  refreshBoards: async () => {
    try {
      set((state) => ({
        loading: { ...state.loading, boards: true },
        errors: { ...state.errors, boards: null },
      }));
      const data = await api.getBoards();
      set({ boards: data });
      return data;
    } catch (error) {
      console.error('Failed to refresh boards', error);
      set((state) => ({
        errors: { ...state.errors, boards: error?.message || 'Failed to load boards' },
      }));
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, boards: false } }));
    }
  },
  silentRefreshBoards: async () => {
    try {
      const data = await api.getBoards();
      set({ boards: data });
      return data;
    } catch (error) {
      console.error('Failed to silent refresh boards', error);
      return null;
    }
  },
  refreshJobs: async () => {
    try {
      set((state) => ({
        loading: { ...state.loading, jobs: true },
        errors: { ...state.errors, jobs: null },
      }));
      const data = await api.getJobs();
      set((state) => {
        const prevJobs = state.jobs || [];
        const justFinished = (data || []).filter((j) => {
          const prev = prevJobs.find((p) => p.id === j.id);
          const wasRunning = prev?.status === 'running';
          const nowDone = j.status === 'completed' || j.status === 'stopped';
          return wasRunning && nowDone;
        });
        const newLocal = justFinished.map((j) => ({
          id: `local-${j.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          title: j.status === 'completed' ? 'Batch completed' : 'Batch stopped',
          message: `Batch #${j.id} (${j.name || 'Unnamed'}) ${j.status === 'completed' ? 'finished successfully.' : 'was stopped.'}`,
          type: j.status === 'completed' ? 'success' : 'info',
          read: false,
          createdAt: new Date().toISOString(),
        }));
        const localNotifications = [...newLocal, ...(state.localNotifications || [])];
        return { jobs: data, localNotifications };
      });
      return data;
    } catch (error) {
      console.error('Failed to refresh jobs', error);
      set((state) => ({
        errors: { ...state.errors, jobs: error?.message || 'Failed to load jobs' },
      }));
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, jobs: false } }));
    }
  },
  silentRefreshJobs: async () => {
    try {
      const data = await api.getJobs();
      set((state) => {
        const prevJobs = state.jobs || [];
        const justFinished = (data || []).filter((j) => {
          const prev = prevJobs.find((p) => p.id === j.id);
          const wasRunning = prev?.status === 'running';
          const nowDone = j.status === 'completed' || j.status === 'stopped';
          return wasRunning && nowDone;
        });
        const newLocal = justFinished.map((j) => ({
          id: `local-${j.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          title: j.status === 'completed' ? 'Batch completed' : 'Batch stopped',
          message: `Batch #${j.id} (${j.name || 'Unnamed'}) ${j.status === 'completed' ? 'finished successfully.' : 'was stopped.'}`,
          type: j.status === 'completed' ? 'success' : 'info',
          read: false,
          createdAt: new Date().toISOString(),
        }));
        const localNotifications = [...newLocal, ...(state.localNotifications || [])];
        return { jobs: data, localNotifications };
      });
      return data;
    } catch (error) {
      console.error('Failed to silent refresh jobs', error);
      return null;
    }
  },
  refreshNotifications: async () => {
    try {
      set((state) => ({
        loading: { ...state.loading, notifications: true },
        errors: { ...state.errors, notifications: null },
      }));
      const data = await api.getNotifications();
      set({ notifications: data });
      return data;
    } catch (error) {
      console.error('Failed to refresh notifications', error);
      set((state) => ({
        errors: { ...state.errors, notifications: error?.message || 'Failed to load notifications' },
      }));
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, notifications: false } }));
    }
  },
  silentRefreshNotifications: async () => {
    try {
      const data = await api.getNotifications();
      set({ notifications: data });
      return data;
    } catch (error) {
      console.error('Failed to silent refresh notifications', error);
      return null;
    }
  },
  refreshFiles: async () => {
    try {
      set((state) => ({
        loading: { ...state.loading, files: true },
        errors: { ...state.errors, files: null },
      }));
      const data = await api.getFiles();
      const mapped = (data || []).map((file) => ({
        id: file.id,
        name: file.name,
        originalName: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size || 0),
        date: file.uploadDate || '',
        type: inferFileType(file.name, file.type),
        file: null,
        uploadDate: file.uploadDate,
        checksum: file.checksum || null,
      }));
      set({
        uploadedFiles: mapped,
        vcdFiles: mapped.filter((f) => f.type === 'vcd'),
        firmwareFiles: mapped.filter((f) => f.type !== 'vcd'),
      });
      return data;
    } catch (error) {
      console.error('Failed to refresh files', error);
      set((state) => ({
        errors: { ...state.errors, files: error?.message || 'Failed to load files' },
      }));
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, files: false } }));
    }
  },
  silentRefreshFiles: async () => {
    try {
      const data = await api.getFiles();
      const mapped = (data || []).map((file) => ({
        id: file.id,
        name: file.name,
        originalName: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size || 0),
        date: file.uploadDate || '',
        type: inferFileType(file.name, file.type),
        file: null,
        uploadDate: file.uploadDate,
        checksum: file.checksum || null,
      }));
      set({
        uploadedFiles: mapped,
        vcdFiles: mapped.filter((f) => f.type === 'vcd'),
        firmwareFiles: mapped.filter((f) => f.type !== 'vcd'),
      });
      return data;
    } catch (error) {
      console.error('Failed to silent refresh files', error);
      return null;
    }
  },
  refreshAll: async () => {
    await Promise.allSettled([
      get().refreshSystemHealth(),
      get().refreshBoards(),
      get().refreshJobs(),
      get().refreshNotifications(),
      get().refreshFiles(),
    ]);
  },
  
  // Job Management Actions
  createJob: async (jobPayload, options = {}) => {
    try {
      const clientId = getClientId();
      const payload = { ...jobPayload, clientId };
      const created = await api.createJob(payload);
      await get().refreshJobs();
      if (created?.id && options.startImmediately) {
        await api.startJob(created.id);
        await get().refreshJobs();
      }
      return created;
    } catch (error) {
      console.error('Failed to create job', error);
      return null;
    }
  },
  updateJob: async (jobId, jobPayload) => {
    try {
      const clientId = getClientId();
      const payload = { ...jobPayload, clientId };
      const updated = await api.updateJob(jobId, payload);
      await get().refreshJobs();
      return updated;
    } catch (error) {
      console.error('Failed to update job', error);
      return null;
    }
  },
  runTestCommand: async (commandPayload) => {
    try {
      const clientId = getClientId();
      const payload = { ...commandPayload, clientId };
      const created = await api.runCommand(payload);
      await get().refreshJobs();
      return created;
    } catch (error) {
      console.error('Failed to run test command', error);
      return null;
    }
  },
  startPendingJobs: async () => {
    try {
      const jobs = get().jobs.filter(j => j.status === 'pending');
      await Promise.allSettled(jobs.map((job) => api.startJob(job.id)));
      await get().refreshJobs();
      return true;
    } catch (error) {
      console.error('Failed to start pending jobs', error);
      return false;
    }
  },
  stopAllJobs: async () => {
    try {
      await api.stopAllJobs();
      await get().refreshJobs();
      return true;
    } catch (error) {
      console.error('Failed to stop all jobs', error);
      return false;
    }
  },
  stopJob: async (jobId) => {
    try {
      await api.stopJob(jobId);
      await get().refreshJobs();
      return true;
    } catch (error) {
      console.error('Failed to stop job', jobId, error);
      return false;
    }
  },
  runBoardBatchAction: async (boardIds, action, params = {}) => {
    try {
      const response = await api.batchBoardActions(boardIds, action, params);
      await get().refreshBoards();
      return response;
    } catch (error) {
      console.error('Failed to run batch board action', error);
      return null;
    }
  },
  moveJobUp: (jobId) => set((state) => {
    const idx = state.jobs.findIndex(j => j.id === jobId);
    if (idx <= 0) return state;
    const jobs = [...state.jobs];
    const [moved] = jobs.splice(idx, 1);
    jobs.splice(idx - 1, 0, moved);
    const newPosition = idx;
    void api.reorderJob(jobId, newPosition)
      .then(() => get().refreshJobs())
      .catch((error) => console.error('Failed to reorder job', error));
    return { jobs };
  }),
  moveJobDown: (jobId) => set((state) => {
    const idx = state.jobs.findIndex(j => j.id === jobId);
    if (idx < 0 || idx >= state.jobs.length - 1) return state;
    const jobs = [...state.jobs];
    const [moved] = jobs.splice(idx, 1);
    jobs.splice(idx + 1, 0, moved);
    const newPosition = idx + 2;
    void api.reorderJob(jobId, newPosition)
      .then(() => get().refreshJobs())
      .catch((error) => console.error('Failed to reorder job', error));
    return { jobs };
  }),
  deleteJob: async (jobId) => {
    try {
      await api.deleteJob(jobId);
      await get().refreshJobs();
      return true;
    } catch (error) {
      console.error('Failed to delete job', error);
      return false;
    }
  },

  /** Create a new batch with only the failed file(s) from a job and start it (moves to Running). */
  rerunFailedFiles: async (jobId, fileIds = null) => {
    try {
      const job = get().jobs.find(j => j.id === jobId);
      if (!job || !job.files?.length) {
        get().addToast({ type: 'warning', message: 'Job or files not found.' });
        return null;
      }
      const isFailed = (f) => f.result === 'fail' || f.status === 'error';
      const failedFiles = fileIds
        ? job.files.filter(f => fileIds.includes(f.id) && isFailed(f))
        : job.files.filter(isFailed);
      if (failedFiles.length === 0) {
        get().addToast({ type: 'warning', message: 'No failed test cases to re-run.' });
        return null;
      }
      const filesPayload = failedFiles.map((f, i) => ({
        name: f.name || `test_${i + 1}`,
        order: i + 1,
        vcd: f.vcd ?? f.name,
        erom: f.erom ?? undefined,
        ulp: f.ulp ?? undefined,
        try_count: f.try_count ?? f.try ?? 1,
      }));
      const baseName = (job.configName || job.name || 'Batch').trim();
      const payload = {
        name: `${baseName} (Re-run failed)`,
        tag: job.tag || undefined,
        firmware: job.firmware || '',
        boards: job.boards || [],
        files: filesPayload,
        configName: job.configName || baseName,
        clientId: getClientId(),
      };
      const created = await api.createJob(payload);
      if (!created || !created.id) {
        get().addToast({ type: 'error', message: 'Failed to create re-run batch.' });
        return null;
      }
      await api.startJob(created.id);
      await get().refreshJobs();
      get().addToast({
        type: 'success',
        message: `Re-run batch created and started (${failedFiles.length} test case${failedFiles.length > 1 ? 's' : ''}).`,
      });
      return created;
    } catch (error) {
      console.error('Failed to re-run failed files', error);
      get().addToast({ type: 'error', message: 'Failed to re-run failed test cases.' });
      return null;
    }
  },

  stopFile: (jobId, fileId) => {
    set((state) => ({
      jobs: state.jobs.map(job =>
        job.id === jobId
          ? {
              ...job,
              files: job.files.map(file =>
                file.id === fileId && file.status === 'running'
                  ? { ...file, status: 'stopped' }
                  : file
              )
            }
          : job
      )
    }));
    void api.stopJobFile(jobId, fileId)
      .then(() => get().refreshJobs())
      .catch((error) => console.error('Failed to stop job file', error));
  },

  rerunFile: (jobId, fileId) => {
    set((state) => ({
      jobs: state.jobs.map(job =>
        job.id === jobId
          ? {
              ...job,
              files: job.files.map(file =>
                file.id === fileId && file.status === 'stopped'
                  ? { ...file, status: 'pending', result: null }
                  : file
              )
            }
          : job
      )
    }));
    void api.rerunJobFile(jobId, fileId)
      .then(() => get().refreshJobs())
      .catch((error) => console.error('Failed to re-run job file', error));
  },
  
  moveFileUp: (jobId, fileId) => {
    set((state) => {
      const job = state.jobs.find(j => j.id === jobId);
      if (!job) return state;
      
      const files = [...job.files].sort((a, b) => a.order - b.order);
      const fileIndex = files.findIndex(f => f.id === fileId);
      
      if (fileIndex <= 0) return state;
      
      const tempOrder = files[fileIndex].order;
      files[fileIndex].order = files[fileIndex - 1].order;
      files[fileIndex - 1].order = tempOrder;
      
      return {
        jobs: state.jobs.map(j =>
          j.id === jobId ? { ...j, files } : j
        )
      };
    });
    void api.moveJobFile(jobId, fileId, 'up')
      .then(() => get().refreshJobs())
      .catch((error) => console.error('Failed to move job file', error));
  },
  
  moveFileDown: (jobId, fileId) => {
    set((state) => {
      const job = state.jobs.find(j => j.id === jobId);
      if (!job) return state;
      
      const files = [...job.files].sort((a, b) => a.order - b.order);
      const fileIndex = files.findIndex(f => f.id === fileId);
      
      if (fileIndex >= files.length - 1) return state;
      
      const tempOrder = files[fileIndex].order;
      files[fileIndex].order = files[fileIndex + 1].order;
      files[fileIndex + 1].order = tempOrder;
      
      return {
        jobs: state.jobs.map(j =>
          j.id === jobId ? { ...j, files } : j
        )
      };
    });
    void api.moveJobFile(jobId, fileId, 'down')
      .then(() => get().refreshJobs())
      .catch((error) => console.error('Failed to move job file', error));
  },
  
  updateJobTag: (jobId, tag) => {
    set((state) => ({
      jobs: state.jobs.map(j => j.id === jobId ? { ...j, tag } : j)
    }));
    void api.updateJobTag(jobId, tag)
      .then((response) => {
        if (response && response.job) {
          set((state) => ({
            jobs: state.jobs.map(j => j.id === jobId ? response.job : j)
          }));
          return;
        }
        return get().refreshJobs();
      })
      .catch((error) => console.error('Failed to update job tag', error));
  },
  
  exportJobToJSON: async (jobId) => {
    try {
      const data = await api.exportJob(jobId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job_${jobId}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      return data;
    } catch (error) {
      console.error('Failed to export job', error);
      return null;
    }
  },
  
  // Test Commands Management Actions
  addTestCommand: (command) => set((state) => {
    const newId = Math.max(0, ...state.testCommands.map(c => c.id)) + 1;
    const newCommand = {
      id: newId,
      ...command,
      createdAt: new Date().toISOString()
    };
    const updated = [...state.testCommands, newCommand];
    saveTestCommands(updated);
    return { testCommands: updated };
  }),
  
  updateTestCommand: (id, updates) => set((state) => {
    const updated = state.testCommands.map(cmd => 
      cmd.id === id ? { ...cmd, ...updates, updatedAt: new Date().toISOString() } : cmd
    );
    saveTestCommands(updated);
    return { testCommands: updated };
  }),
  
  deleteTestCommand: (id) => set((state) => {
    const updated = state.testCommands.filter(cmd => cmd.id !== id);
    saveTestCommands(updated);
    return { testCommands: updated };
  }),
  
  duplicateTestCommand: (id) => set((state) => {
    const original = state.testCommands.find(cmd => cmd.id === id);
    if (!original) return state;
    
    const newId = Math.max(0, ...state.testCommands.map(c => c.id)) + 1;
    const duplicated = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString()
    };
    const updated = [...state.testCommands, duplicated];
    saveTestCommands(updated);
    return { testCommands: updated };
  }),
  
  exportAllFailedLogs: (jobId) => {
    const state = useTestStore.getState();
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const failedFiles = (job.files || []).filter(f => f.result === 'fail' || f.status === 'error');
    if (failedFiles.length === 0) {
      alert('No failed or errored files in this job to export logs for.');
      return;
    }
    
    let combinedLogs = `Failed Tests Report - Batch #${jobId}
Generated: ${new Date().toISOString()}
========================================

Batch Information:
- Job ID: ${job.id}
- Job Name: ${job.name || 'N/A'}
- Tag: ${job.tag || 'Untagged'}
- Firmware: ${job.firmware || 'N/A'}
- Boards: ${job.boards?.join(', ') || 'N/A'}
- Started At: ${job.startedAt || 'N/A'}
- Completed At: ${job.completedAt || 'N/A'}
- Total Files: ${job.totalFiles || 0}
- Failed Files: ${failedFiles.length}

========================================
Detailed Error Logs for Failed Test Cases:
========================================
`;
    
    failedFiles.forEach((file, index) => {
      combinedLogs += `\n--- Test Case #${index + 1}: ${file.name || 'N/A'} (ID: ${file.id}) ---\n`;
      combinedLogs += `Order: ${file.order || 'N/A'}\n`;
      combinedLogs += `Status: ${file.status || 'N/A'}\n`;
      combinedLogs += `Result: ${file.result || 'N/A'}\n`;
      combinedLogs += `Error Message: ${file.errorMessage || file.error || 'No specific error message provided.'}\n`;
      combinedLogs += `Completed At: ${file.completedAt || 'N/A'}\n`;
      combinedLogs += `Duration: ${file.duration || 'N/A'}\n`;
      combinedLogs += `\nPossible Causes:\n- Test case logic error\n- Board hardware issue\n- Firmware bug\n- Environmental factors (power, temperature)\n- Communication failure\n`;
      combinedLogs += `Recommendations:\n- Review the test case script/VCD file.\n- Check board logs for more details.\n- Verify board connections and power supply.\n- Try re-running the test on a different board.\n- Consult with hardware/firmware team.\n`;
      combinedLogs += `\n----------------------------------------\n`;
    });
    
    const blob = new Blob([combinedLogs], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `failed_tests_report_batch_${jobId}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
}));
