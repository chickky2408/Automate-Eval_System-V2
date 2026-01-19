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

export const useTestStore = create((set) => ({
  // System Health
  systemHealth: {
    totalBoards: 52,
    onlineBoards: 45,
    busyBoards: 5,
    errorBoards: 2,
    storageUsage: 68, // percentage
    storageTotal: '10TB',
    storageUsed: '6.8TB',
    mqttBrokerStatus: 'online' // 'online' | 'offline'
  },
  
  // Boards/Devices
  boards: [
    { id: 1, name: 'Board #1', status: 'online', ip: '192.168.1.101', mac: '00:1B:44:11:3A:B7', firmware: 'v2.3.1', model: 'STM32', voltage: 3.3, signal: -45, temp: 42, currentJob: 'Batch #2024-001', tag: 'Line A', capabilities: ['ssh', 'mqtt', 'flash'], connections: ['MQTT', 'SSH'] },
    { id: 2, name: 'Board #2', status: 'online', ip: '192.168.1.102', mac: '00:1B:44:11:3A:B8', firmware: 'v2.3.1', model: 'STM32', voltage: 3.2, signal: -50, temp: 40, currentJob: null, tag: 'Line A', capabilities: ['ssh', 'mqtt'], connections: ['MQTT'] },
    { id: 3, name: 'Board #3', status: 'busy', ip: '192.168.1.103', mac: '00:1B:44:11:3A:B9', firmware: 'v2.3.0', model: 'STM32', voltage: 3.3, signal: -42, temp: 45, currentJob: 'Batch #2024-002', tag: 'Line B', capabilities: ['ssh', 'mqtt', 'flash'], connections: ['MQTT', 'SSH'] },
    { id: 4, name: 'Board #4', status: 'online', ip: '192.168.1.104', mac: '00:1B:44:11:3A:BA', firmware: 'v2.2.9', model: 'STM32', voltage: 3.1, signal: -55, temp: 38, currentJob: null, tag: '', capabilities: ['ssh'], connections: [] },
    { id: 5, name: 'Board #5', status: 'error', ip: '192.168.1.105', mac: '00:1B:44:11:3A:BB', firmware: 'v2.3.1', model: 'STM32', voltage: 0, signal: null, temp: null, currentJob: null, tag: 'RMA', capabilities: [], connections: [] },
    { id: 6, name: 'Board #6', status: 'online', ip: '192.168.1.106', mac: '00:1B:44:11:3A:BC', firmware: 'v2.3.1', model: 'STM32', voltage: 3.3, signal: -48, temp: 41, currentJob: null, tag: '', capabilities: ['mqtt'], connections: ['MQTT'] },
    { id: 7, name: 'Board #7', status: 'busy', ip: '192.168.1.107', mac: '00:1B:44:11:3A:BD', firmware: 'v2.3.0', model: 'STM32', voltage: 3.2, signal: -46, temp: 43, currentJob: 'Batch #2024-001', tag: 'Line A', capabilities: ['ssh', 'flash'], connections: ['SSH'] },
    { id: 8, name: 'Board #8', status: 'online', ip: '192.168.1.108', mac: '00:1B:44:11:3A:BE', firmware: 'v2.2.9', model: 'STM32', voltage: 3.3, signal: -44, temp: 39, currentJob: null, tag: '', capabilities: [], connections: [] },
    { id: 9, name: 'Board #9', status: 'error', ip: '192.168.1.109', mac: '00:1B:44:11:3A:BF', firmware: 'v2.3.1', model: 'STM32', voltage: 2.8, signal: -80, temp: 55, currentJob: null, tag: 'Investigation', capabilities: [], connections: [] },
    { id: 10, name: 'Board #10', status: 'online', ip: '192.168.1.110', mac: '00:1B:44:11:3A:C0', firmware: 'v2.3.1', model: 'STM32', voltage: 3.3, signal: -47, temp: 40, currentJob: null, tag: '', capabilities: ['ssh'], connections: ['SSH'] },
  ],
  
  // Jobs/Batches
  jobs: [
    { 
      id: '2024-001', 
      name: 'ERQM Regression Test', 
      progress: 75, 
      status: 'running', 
      clientId: getClientId(),
      tag: 'Team A', // Tag/Group for identification
      totalFiles: 20,
      completedFiles: 15,
      firmware: 'ERQM_v2.3.bin',
      boards: ['Board #1', 'Board #3', 'Board #7'],
      startedAt: '2026-01-13 10:30',
      files: [
        { id: 1, name: 'test_case_001.vcd', status: 'completed', result: 'pass', order: 1 },
        { id: 2, name: 'test_case_002.vcd', status: 'completed', result: 'pass', order: 2 },
        { id: 3, name: 'test_case_003.vcd', status: 'completed', result: 'pass', order: 3 },
        { id: 4, name: 'test_case_004.vcd', status: 'running', result: null, order: 4 },
        { id: 5, name: 'test_case_005.vcd', status: 'pending', result: null, order: 5 },
      ]
    },
    { 
      id: '2024-002', 
      name: 'ULP Power Test', 
      progress: 30, 
      status: 'running', 
      clientId: 'other_client',
      tag: 'Team B',
      totalFiles: 10,
      completedFiles: 3,
      firmware: 'ULP_v1.5.bin',
      boards: ['Board #3'],
      startedAt: '2026-01-13 11:00',
      files: [
        { id: 1, name: 'power_test_001.vcd', status: 'completed', result: 'pass', order: 1 },
        { id: 2, name: 'power_test_002.vcd', status: 'completed', result: 'pass', order: 2 },
        { id: 3, name: 'power_test_003.vcd', status: 'completed', result: 'fail', order: 3 },
        { id: 4, name: 'power_test_004.vcd', status: 'running', result: null, order: 4 },
        { id: 5, name: 'power_test_005.vcd', status: 'pending', result: null, order: 5 },
      ]
    },
    { 
      id: '2024-003', 
      name: 'Security Check', 
      progress: 100, 
      status: 'completed', 
      clientId: getClientId(),
      tag: 'Team A',
      totalFiles: 5,
      completedFiles: 5,
      firmware: 'ERQM_v2.3.bin',
      boards: ['Board #2'],
      startedAt: '2026-01-13 09:00',
      completedAt: '2026-01-13 09:45',
      files: [
        { id: 1, name: 'security_001.vcd', status: 'completed', result: 'pass', order: 1 },
        { id: 2, name: 'security_002.vcd', status: 'completed', result: 'pass', order: 2 },
        { id: 3, name: 'security_003.vcd', status: 'completed', result: 'fail', order: 3, errorMessage: 'Authentication timeout after 30 seconds', completedAt: '2026-01-13 09:30', duration: '30s' },
        { id: 4, name: 'security_004.vcd', status: 'completed', result: 'pass', order: 4 },
        { id: 5, name: 'security_005.vcd', status: 'completed', result: 'fail', order: 5, errorMessage: 'Encryption key validation failed', completedAt: '2026-01-13 09:42', duration: '12s' },
      ]
    },
    { 
      id: '2024-007', 
      name: 'ERQM Full Regression', 
      progress: 100, 
      status: 'completed', 
      clientId: getClientId(),
      tag: 'Team A',
      totalFiles: 20,
      completedFiles: 20,
      firmware: 'ERQM_v2.3.bin',
      boards: ['Board #1', 'Board #3', 'Board #5'],
      startedAt: '2026-01-13 08:00',
      completedAt: '2026-01-13 09:25',
      files: [
        { id: 1, name: 'regression_001.vcd', status: 'completed', result: 'pass', order: 1 },
        { id: 2, name: 'regression_002.vcd', status: 'completed', result: 'pass', order: 2 },
        { id: 3, name: 'regression_003.vcd', status: 'completed', result: 'pass', order: 3 },
        { id: 4, name: 'regression_004.vcd', status: 'completed', result: 'pass', order: 4 },
        { id: 5, name: 'regression_005.vcd', status: 'completed', result: 'pass', order: 5 },
      ]
    },
    { 
      id: '2024-004', 
      name: 'Performance Benchmark', 
      progress: 45, 
      status: 'running', 
      clientId: getClientId(),
      tag: 'Team C',
      totalFiles: 15,
      completedFiles: 7,
      firmware: 'PERF_v1.0.bin',
      boards: ['Board #5', 'Board #6'],
      startedAt: '2026-01-13 11:30',
      files: [
        { id: 1, name: 'perf_001.vcd', status: 'completed', result: 'pass', order: 1 },
        { id: 2, name: 'perf_002.vcd', status: 'completed', result: 'pass', order: 2 },
        { id: 3, name: 'perf_003.vcd', status: 'running', result: null, order: 3 },
        { id: 4, name: 'perf_004.vcd', status: 'pending', result: null, order: 4 },
      ]
    },
    { 
      id: '2024-005', 
      name: 'Temperature Stress Test', 
      progress: 60, 
      status: 'running', 
      clientId: 'other_client',
      tag: 'Team B',
      totalFiles: 12,
      completedFiles: 7,
      firmware: 'TEMP_v2.1.bin',
      boards: ['Board #4', 'Board #8'],
      startedAt: '2026-01-13 10:45',
      files: [
        { id: 1, name: 'temp_001.vcd', status: 'completed', result: 'pass', order: 1 },
        { id: 2, name: 'temp_002.vcd', status: 'completed', result: 'pass', order: 2 },
        { id: 3, name: 'temp_003.vcd', status: 'running', result: null, order: 3 },
      ]
    },
    { 
      id: '2024-006', 
      name: 'Memory Leak Test', 
      progress: 20, 
      status: 'running', 
      clientId: getClientId(),
      tag: 'Team A',
      totalFiles: 25,
      completedFiles: 5,
      firmware: 'MEM_v1.5.bin',
      boards: ['Board #9'],
      startedAt: '2026-01-13 12:00',
      files: [
        { id: 1, name: 'mem_001.vcd', status: 'completed', result: 'pass', order: 1 },
        { id: 2, name: 'mem_002.vcd', status: 'running', result: null, order: 2 },
        { id: 3, name: 'mem_003.vcd', status: 'pending', result: null, order: 3 },
      ]
    }
  ],
  
  // Notifications
  notifications: [
    { id: 1, title: 'Batch #2024-001 Completed', message: 'All 20 files processed successfully', time: '5m ago', type: 'success', read: false },
    { id: 2, title: 'Board #9 Connection Lost', message: 'Device disconnected unexpectedly', time: '15m ago', type: 'error', read: false },
    { id: 3, title: 'Batch #2024-003 Finished', message: 'Security Check completed with 5/5 passed', time: '1h ago', type: 'success', read: true },
    { id: 4, title: 'Firmware Update Available', message: 'New version v2.3.2 ready for deployment', time: '2h ago', type: 'info', read: true },
  ],
  
  // Common Commands (normally use)
  commonCommands: [
    { id: 1, name: 'Check Board Status', command: 'ssh board@192.168.1.101 "systemctl status test-agent"', category: 'diagnostics' },
    { id: 2, name: 'Reboot Board', command: 'ssh board@192.168.1.101 "sudo reboot"', category: 'maintenance' },
    { id: 3, name: 'View Logs', command: 'ssh board@192.168.1.101 "tail -f /var/log/test.log"', category: 'diagnostics' },
    { id: 4, name: 'Flash Firmware', command: 'st-flash write firmware.bin 0x8000000', category: 'firmware' },
    { id: 5, name: 'Run Quick Test', command: './test_runner.sh --quick --board 1', category: 'testing' },
  ],
  
  // Test Code Commands (pre-written test commands)
  // Load from localStorage or use default
  testCommands: (() => {
    const saved = loadTestCommands();
    if (saved && saved.length > 0) {
      return saved;
    }
    // Default commands
    return [
      { id: 1, name: 'ERQM Regression Suite', command: './run_tests.sh --suite erqm --board {board_id}', description: 'Full ERQM regression test suite', category: 'regression' },
      { id: 2, name: 'ULP Power Test', command: './power_test.sh --board {board_id} --duration 3600', description: 'Power consumption test for 1 hour', category: 'power' },
      { id: 3, name: 'Security Check', command: './security_test.sh --board {board_id} --level full', description: 'Full security validation', category: 'security' },
      { id: 4, name: 'Boot Test', command: './boot_test.sh --board {board_id} --iterations 10', description: 'Boot cycle test 10 iterations', category: 'boot' },
      { id: 5, name: 'Flash Test', command: './flash_test.sh --board {board_id} --firmware {firmware}', description: 'Firmware flash and verify', category: 'firmware' },
    ];
  })(),
  
  uploadedFiles: [
    { id: 1, name: 'test_case_001.vcd', size: '2.4 MB', date: '2h ago', type: 'vcd', file: null },
    { id: 2, name: 'test_case_002.vcd', size: '1.8 MB', date: '3h ago', type: 'vcd', file: null },
    { id: 3, name: 'ERQM_v2.3.bin', size: '1.2 MB', date: '1h ago', type: 'firmware', file: null },
  ],
  vcdFiles: [
    { id: 1, name: 'test_case_001.vcd', size: '2.4 MB', date: '2h ago' },
    { id: 2, name: 'test_case_002.vcd', size: '1.8 MB', date: '3h ago' }
  ],
  firmwares: [
    { id: 1, name: 'ERQM_v2.3.bin', type: 'ERQM' },
    { id: 2, name: 'ULP_v1.5.bin', type: 'ULP' }
  ],
  
  // UI State
  fleetViewMode: 'grid', // 'grid' | 'list'
  fleetFilters: {
    status: null,
    model: null,
    firmware: null
  },
  selectedBoards: [],
  selectedJobFilter: 'all', // 'all' | 'my'
  
  // Actions
  addVcd: (file) => set((state) => ({ vcdFiles: [...state.vcdFiles, file] })),
  addBoard: (boardInput) => set((state) => {
    const nextId = Math.max(0, ...state.boards.map(b => b.id)) + 1;
    const board = {
      id: nextId,
      name: boardInput.name || `Board #${nextId}`,
      status: boardInput.status || 'online',
      ip: boardInput.ip || '',
      mac: boardInput.mac || '',
      firmware: boardInput.firmware || 'v0.0.0',
      model: boardInput.model || 'STM32',
      voltage: null,
      signal: null,
      temp: null,
      currentJob: null,
      tag: boardInput.tag || '',
      capabilities: boardInput.capabilities || [],
      connections: boardInput.connections || [],
    };
    return { boards: [...state.boards, board] };
  }),
  updateBoardTag: (boardId, tag) => set((state) => ({
    boards: state.boards.map(b => b.id === boardId ? { ...b, tag } : b)
  })),
  updateBoardConnections: (boardId, connections) => set((state) => ({
    boards: state.boards.map(b => b.id === boardId ? { ...b, connections } : b)
  })),
  addUploadedFile: (file) => set((state) => {
    // Check for duplicate names
    const existingNames = state.uploadedFiles.map(f => f.name);
    let finalName = file.name;
    let counter = 1;
    const extension = file.name.split('.').pop();
    const baseName = file.name.replace(`.${extension}`, '');
    
    while (existingNames.includes(finalName)) {
      finalName = `${baseName}_${counter}.${extension}`;
      counter++;
    }
    
    const newFile = {
      id: crypto.randomUUID(),
      name: finalName,
      originalName: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      date: 'Just now',
      type: file.type || (file.name.endsWith('.vcd') ? 'vcd' : 'firmware'),
      file: file, // Store the actual File object
      uploadDate: new Date().toISOString()
    };
    
    return { uploadedFiles: [...state.uploadedFiles, newFile] };
  }),
  removeUploadedFile: (id) => set((state) => ({
    uploadedFiles: state.uploadedFiles.filter(f => f.id !== id)
  })),
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
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  })),
  updateSystemHealth: (health) => set((state) => ({
    systemHealth: { ...state.systemHealth, ...health }
  })),
  
  // Job Management Actions
  moveJobUp: (jobId) => set((state) => {
    const idx = state.jobs.findIndex(j => j.id === jobId);
    if (idx <= 0) return state;
    const jobs = [...state.jobs];
    const [moved] = jobs.splice(idx, 1);
    jobs.splice(idx - 1, 0, moved);
    return { jobs };
  }),
  moveJobDown: (jobId) => set((state) => {
    const idx = state.jobs.findIndex(j => j.id === jobId);
    if (idx < 0 || idx >= state.jobs.length - 1) return state;
    const jobs = [...state.jobs];
    const [moved] = jobs.splice(idx, 1);
    jobs.splice(idx + 1, 0, moved);
    return { jobs };
  }),
  stopFile: (jobId, fileId) => set((state) => ({
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
  })),
  
  moveFileUp: (jobId, fileId) => set((state) => {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return state;
    
    const files = [...job.files].sort((a, b) => a.order - b.order);
    const fileIndex = files.findIndex(f => f.id === fileId);
    
    if (fileIndex <= 0) return state; // Already at top
    
    // Swap orders
    const tempOrder = files[fileIndex].order;
    files[fileIndex].order = files[fileIndex - 1].order;
    files[fileIndex - 1].order = tempOrder;
    
    return {
      jobs: state.jobs.map(j => 
        j.id === jobId ? { ...j, files } : j
      )
    };
  }),
  
  moveFileDown: (jobId, fileId) => set((state) => {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return state;
    
    const files = [...job.files].sort((a, b) => a.order - b.order);
    const fileIndex = files.findIndex(f => f.id === fileId);
    
    if (fileIndex >= files.length - 1) return state; // Already at bottom
    
    // Swap orders
    const tempOrder = files[fileIndex].order;
    files[fileIndex].order = files[fileIndex + 1].order;
    files[fileIndex + 1].order = tempOrder;
    
    return {
      jobs: state.jobs.map(j => 
        j.id === jobId ? { ...j, files } : j
      )
    };
  }),
  
  updateJobTag: (jobId, tag) => set((state) => ({
    jobs: state.jobs.map(j => j.id === jobId ? { ...j, tag } : j)
  })),
  
  exportJobToJSON: (jobId) => {
    const state = useTestStore.getState();
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return null;
    
    const exportData = {
      jobId: job.id,
      name: job.name,
      tag: job.tag,
      firmware: job.firmware,
      boards: job.boards,
      files: (job.files || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(f => ({
        name: f.name,
        order: f.order || 0,
        status: f.status,
        result: f.result
      })),
      metadata: {
        createdAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.progress,
        status: job.status,
        clientId: job.clientId
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `job_${jobId}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    return exportData;
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