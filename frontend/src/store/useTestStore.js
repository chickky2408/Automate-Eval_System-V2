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
  
  // Notifications
  notifications: [],
  
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
  
  // UI State
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
      set((prev) => ({
        uploadedFiles: [...prev.uploadedFiles, mapped],
        vcdFiles: inferFileType(mapped.name, mapped.type) === 'vcd'
          ? [...prev.vcdFiles, mapped]
          : prev.vcdFiles,
        firmwareFiles: inferFileType(mapped.name, mapped.type) !== 'vcd'
          ? [...prev.firmwareFiles, mapped]
          : prev.firmwareFiles,
      }));
      return uploaded;
    } catch (error) {
      console.error('Failed to upload file', error);
      return null;
    }
  },
  removeUploadedFile: async (id) => {
    try {
      await api.deleteFile(id);
    } catch (error) {
      console.error('Failed to delete file', error);
    }
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter(f => f.id !== id),
      vcdFiles: state.vcdFiles.filter(f => f.id !== id),
      firmwareFiles: state.firmwareFiles.filter(f => f.id !== id),
    }));
  },
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
    set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }));
    void api.markNotificationRead(id)
      .then(() => get().refreshNotifications())
      .catch((error) => console.error('Failed to mark notification read', error));
  },
  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true }))
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
      set({ jobs: data });
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
      set({ jobs: data });
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
  createJob: async (jobPayload) => {
    try {
      const clientId = getClientId();
      const payload = { ...jobPayload, clientId };
      const created = await api.createJob(payload);
      await get().refreshJobs();
      return created;
    } catch (error) {
      console.error('Failed to create job', error);
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
