import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Menu, X, LayoutDashboard, Settings, PlayCircle, Cpu, 
  History, Bell, Upload, FileCode, Box, Search, 
  CheckCircle2, AlertCircle, Clock, Zap, Database, ChevronRight,
  Grid3x3, List, Filter, Terminal, Wifi, WifiOff, HardDrive,
  RefreshCw, Download, Activity, XCircle, Eye, MoreVertical,
  ArrowUp, ArrowDown, Square, Tag, FileJson, StopCircle, Plus,
  Command, Copy, Play, Layers, Monitor, ChevronDown, ChevronUp, GripVertical, ChevronLeft, CheckSquare, Pencil
} from 'lucide-react';
import { useTestStore } from './store/useTestStore';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// --- MAIN APPLICATION COMPONENT ---
const App = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandJobId, setExpandJobId] = useState(null); // สำหรับ expand job จาก history
  const { systemHealth, boards } = useTestStore();
  const refreshSystemHealth = useTestStore((state) => state.refreshSystemHealth);
  const refreshBoards = useTestStore((state) => state.refreshBoards);
  const refreshJobs = useTestStore((state) => state.refreshJobs);
  const refreshNotifications = useTestStore((state) => state.refreshNotifications);
  const refreshFiles = useTestStore((state) => state.refreshFiles);
  const silentRefreshSystemHealth = useTestStore((state) => state.silentRefreshSystemHealth);
  const silentRefreshBoards = useTestStore((state) => state.silentRefreshBoards);
  const silentRefreshJobs = useTestStore((state) => state.silentRefreshJobs);
  const silentRefreshNotifications = useTestStore((state) => state.silentRefreshNotifications);
  const silentRefreshFiles = useTestStore((state) => state.silentRefreshFiles);
  const availableBoards = boards.filter(b => b.status === 'online' && !b.currentJob).length;
  const queuedBoardsLeft = availableBoards;

  useEffect(() => {
    // รอบแรก: ใช้ refresh ปกติ (มี loading state ให้ user เห็นชัด)
    const initialFetch = async () => {
      await Promise.allSettled([
        refreshSystemHealth(),
        refreshBoards(),
        refreshJobs(),
        refreshNotifications(),
        refreshFiles(),
      ]);
    };

    // รอบถัด ๆ ไป: ใช้ silent refresh ไม่แตะ loading เพื่อไม่ให้ UI กระพริบ
    const silentFetchAll = async () => {
      await Promise.allSettled([
        silentRefreshSystemHealth(),
        silentRefreshBoards(),
        silentRefreshJobs(),
        silentRefreshNotifications(),
        silentRefreshFiles(),
      ]);
    };

    void initialFetch();

    const intervalId = setInterval(silentFetchAll, 15000); // ยิงซ้ำทุก 15 วินาที
    return () => clearInterval(intervalId);
  }, [
    refreshSystemHealth,
    refreshBoards,
    refreshJobs,
    refreshNotifications,
    refreshFiles,
    silentRefreshSystemHealth,
    silentRefreshBoards,
    silentRefreshJobs,
    silentRefreshNotifications,
    silentRefreshFiles,
  ]);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* 1. SIDEBAR (Collapsible) */}
      <aside className={`fixed left-0 top-0 h-screen bg-slate-900 text-slate-300 z-50 transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'w-64' : 'w-20'
      }`}>
        <div className="flex items-center justify-between px-6 h-20 border-b border-slate-800">
          {isSidebarOpen && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-white tracking-tight">BOARD TEST</h2>
              <p className="text-[10px] text-blue-500 font-bold tracking-widest uppercase">Enterprise v1.0</p>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors mx-auto">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="mt-6 px-3 space-y-2">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activePage === 'dashboard'} isOpen={isSidebarOpen} onClick={() => setActivePage('dashboard')} />
          <NavItem icon={<Monitor size={20}/>} label="Board Overview" active={activePage === 'overview'} isOpen={isSidebarOpen} onClick={() => setActivePage('overview')} />
          <NavItem icon={<Settings size={20}/>} label="Test Setup" active={activePage === 'setup'} isOpen={isSidebarOpen} onClick={() => setActivePage('setup')} />
          <NavItem icon={<PlayCircle size={20}/>} label="Jobs Manager" active={activePage === 'jobs'} isOpen={isSidebarOpen} onClick={() => setActivePage('jobs')} />
          <NavItem icon={<Cpu size={20}/>} label="Board Status" active={activePage === 'boards'} isOpen={isSidebarOpen} onClick={() => setActivePage('boards')} />
          <NavItem icon={<History size={20}/>} label="Test History" active={activePage === 'history'} isOpen={isSidebarOpen} onClick={() => setActivePage('history')} />
        </nav>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        
        {/* TOP HEADER BAR (simple, no summary row) */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="h-14 flex items-center justify-between px-8">
            {activePage === 'dashboard' ? (
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-slate-900">System Dashboard</h2>
                <span className="text-xs text-slate-500">
                  Monitoring {systemHealth.totalBoards} boards
                </span>
                <div className={`ml-4 flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  systemHealth.mqttBrokerStatus === 'online' 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                    : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {systemHealth.mqttBrokerStatus === 'online' ? <Wifi size={13} /> : <WifiOff size={13} />}
                  <span>MQTT {systemHealth.mqttBrokerStatus === 'online' ? 'Online' : 'Offline'}</span>
          </div>
              </div>
            ) : (
              <div />
            )}
            <NotificationBell />
          </div>
        </header>

        {/* CONTENT PAGES */}
        <div className="p-8 overflow-y-auto">
          {activePage === 'dashboard' && <DashboardPage />}
          {activePage === 'overview' && <BoardOverviewPage />}
          {activePage === 'setup' && <SetupPage editJobId={expandJobId} onEditComplete={() => setExpandJobId(null)} />}
          {activePage === 'jobs' && <JobsPage expandJobId={expandJobId} onExpandComplete={() => setExpandJobId(null)} onEditJob={(jobId) => { setExpandJobId(jobId); setActivePage('setup'); }} />}
          {activePage === 'boards' && <BoardsPage />}
          {activePage === 'history' && <HistoryPage onViewJob={(jobId) => { setExpandJobId(jobId); setActivePage('jobs'); }} />}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
};

// --- COMPONENTS ---

const NavItem = ({ icon, label, active, isOpen, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-3 rounded-xl text-sm font-medium transition-all ${
    active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'hover:bg-slate-800 text-slate-400'
  }`}>
    <div className={!isOpen ? 'mx-auto' : ''}>{icon}</div>
    {isOpen && <span className="animate-in fade-in slide-in-from-left-2 duration-300">{label}</span>}
  </button>
);

const ToastContainer = () => {
  const { toasts, removeToast } = useTestStore();

  if (!toasts || toasts.length === 0) return null;

  const getToastStyles = (type) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  return (
    <div className="fixed top-6 right-6 z-[70] space-y-3 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 border rounded-xl px-4 py-3 shadow-lg ${getToastStyles(toast.type)}`}
        >
          <div className="pt-0.5">
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          </div>
          <div className="flex-1 text-sm font-medium">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 rounded hover:bg-black/5"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

// Preview page for mapping VCD ↔ BIN 1:1, with save/load JSON
const ConfigBuilderPage = () => {
  const vcdFiles = useTestStore((state) => state.vcdFiles);
  const firmwareFiles = useTestStore((state) => state.firmwareFiles);
  const [selectedVcdId, setSelectedVcdId] = useState('');
  const [selectedBinId, setSelectedBinId] = useState('');
  const [pairs, setPairs] = useState([]);
  const fileInputRef = useRef(null);

  const getFileLabel = (id, list) => list.find((f) => f.id === id)?.name || '—';

  const addPair = () => {
    if (!selectedVcdId || !selectedBinId) return;
    setPairs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        vcdId: selectedVcdId,
        binId: selectedBinId,
      },
    ]);
    setSelectedVcdId('');
    setSelectedBinId('');
  };

  const removePair = (id) => {
    setPairs((prev) => prev.filter((p) => p.id !== id));
  };

  const movePair = (index, direction) => {
    setPairs((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveConfig = () => {
    const data = { pairs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config_pairs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result || '{}');
        if (!Array.isArray(parsed?.pairs)) throw new Error('Invalid format');
        setPairs(parsed.pairs.map((p, idx) => ({
          id: p.id || `loaded-${idx}-${Date.now()}`,
          vcdId: p.vcdId,
          binId: p.binId,
        })));
      } catch (err) {
        alert('Load config failed: ' + err?.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Config Builder (beta)</h1>
          <p className="text-slate-500 text-sm">จับคู่ 1 VCD ต่อ 1 BIN พร้อมบันทึก/โหลด config เป็น .json</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveConfig}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-black"
          >
            Save config (.json)
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold hover:border-slate-300"
          >
            Load config (.json)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleLoad}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Library: VCD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900">VCD Library</h3>
            <span className="text-xs text-slate-500">{vcdFiles.length} files</span>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {vcdFiles.length === 0 && (
              <div className="text-sm text-slate-400">ยังไม่มีไฟล์ VCD (อัปโหลดจากเมนู Files)</div>
            )}
            {vcdFiles.map((file) => (
              <label key={file.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                selectedVcdId === file.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'
              }`}>
                <input
                  type="radio"
                  name="vcd-select"
                  checked={selectedVcdId === file.id}
                  onChange={() => setSelectedVcdId(file.id)}
                />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-slate-800">{file.name}</div>
                  <div className="text-xs text-slate-500">{file.sizeFormatted || ''}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Library: BIN */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900">BIN Library</h3>
            <span className="text-xs text-slate-500">{firmwareFiles.length} files</span>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {firmwareFiles.length === 0 && (
              <div className="text-sm text-slate-400">ยังไม่มีไฟล์ BIN (อัปโหลดจากเมนู Files)</div>
            )}
            {firmwareFiles.map((file) => (
              <label key={file.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                selectedBinId === file.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'
              }`}>
                <input
                  type="radio"
                  name="bin-select"
                  checked={selectedBinId === file.id}
                  onChange={() => setSelectedBinId(file.id)}
                />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-slate-800">{file.name}</div>
                  <div className="text-xs text-slate-500">{file.sizeFormatted || ''}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Selected mapping */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Selected (1 VCD : 1 BIN)</h3>
              <p className="text-xs text-slate-500">สามารถ reorder (move up/down) ได้</p>
            </div>
            <button
              onClick={addPair}
              disabled={!selectedVcdId || !selectedBinId}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                !selectedVcdId || !selectedBinId
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Add pair
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 bg-slate-50 text-xs font-semibold text-slate-600">
              <div className="px-3 py-2">#</div>
              <div className="px-3 py-2">VCD</div>
              <div className="px-3 py-2">BIN</div>
              <div className="px-3 py-2 text-right">Actions</div>
            </div>
            {pairs.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">ยังไม่ได้เลือกไฟล์</div>
            ) : (
              pairs.map((pair, idx) => (
                <div key={pair.id} className="grid grid-cols-4 items-center text-sm border-t border-slate-100">
                  <div className="px-3 py-2 text-slate-500">{idx + 1}</div>
                  <div className="px-3 py-2">{getFileLabel(pair.vcdId, vcdFiles)}</div>
                  <div className="px-3 py-2">{getFileLabel(pair.binId, firmwareFiles)}</div>
                  <div className="px-3 py-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => movePair(idx, 'up')}
                      className="px-2 py-1 rounded border border-slate-200 text-xs hover:border-slate-300"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePair(idx, 'down')}
                      className="px-2 py-1 rounded border border-slate-200 text-xs hover:border-slate-300"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removePair(pair.id)}
                      className="px-2 py-1 rounded border border-red-200 text-xs text-red-600 hover:border-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 1. DASHBOARD PAGE (Enhanced)
const DashboardPage = () => {
  const { 
    systemHealth, 
    boards,
    jobs, 
    commonCommands,
    loading,
    errors
  } = useTestStore();
  
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [dashTab, setDashTab] = useState('campaigns'); // 'campaigns' | 'devices' | 'system'
  const [copiedCommand, setCopiedCommand] = useState(null);
  const [isSystemSummaryExpanded, setIsSystemSummaryExpanded] = useState(false);
  
  const runningJobs = jobs.filter(j => j.status === 'running');
  const filteredJobs = runningJobs;
  
  // System Summary: สรุปว่า system ไหน run อะไรอยู่
  const systemSummary = runningJobs.map(job => ({
    jobId: job.id,
    jobName: job.name,
    tag: job.tag || 'Untagged',
    boards: job.boards || [],
    progress: job.progress,
    firmware: job.firmware
  }));
  
  const availableBoards = boards.filter(b => b.status === 'online' && !b.currentJob).length;
  const queuedBoardsLeft = availableBoards; // simplified
  const deviceProgressRows = boards.map(b => {
    const jobId = (b.currentJob || '').replace('Batch #', '');
    const job = jobs.find(j => j.id === jobId);
    const progress = job ? job.progress : 0;
    return { board: b, progress, job };
  });
  
  const handleCopyCommand = (command) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };
  
  const hasDashboardError = errors?.systemHealth || errors?.boards || errors?.jobs;
  const isDashboardLoading = loading?.systemHealth || loading?.boards || loading?.jobs;

  return (
    <div className="space-y-2.5">
      {(hasDashboardError || isDashboardLoading) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          hasDashboardError
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {hasDashboardError
            ? `Failed to load dashboard data: ${hasDashboardError}`
            : 'Loading dashboard data...'}
        </div>
      )}

      {/* System Health Summary */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-500"/>} 
          label="Online" 
          value={systemHealth.onlineBoards} 
          sub={`${systemHealth.totalBoards} Total Boards`} 
        />
        <StatCard 
          icon={<Zap className="text-blue-500"/>} 
          label="Busy" 
          value={systemHealth.busyBoards} 
          sub="Running Tests" 
        />
        <StatCard 
          icon={<AlertCircle className="text-red-500"/>} 
          label="Errors" 
          value={systemHealth.errorBoards} 
          sub="Needs Attention" 
        />
        <StatCard 
        icon={<Activity className="text-purple-500" />} 
        label="Board Queue" 
        value={queuedBoardsLeft} 
        sub="Available (online & idle)" 
      />
      <StatCard 
          icon={<HardDrive className="text-orange-500"/>} 
          label="Storage" 
          value={`${systemHealth.storageUsage}%`} 
          sub={`${systemHealth.storageUsed} / ${systemHealth.storageTotal}`} 
        />
    </div>

      {/* System Summary - System ไหน run อะไรอยู่ */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-blue-600" />
            <h2 className="text-xl font-bold">System Summary</h2>
            {systemSummary.length > 0 && (
              <span className="text-sm text-slate-500 font-normal">
                ({systemSummary.length} {systemSummary.length === 1 ? 'system' : 'systems'})
              </span>
            )}
          </div>
          {systemSummary.length > 3 && (
            <button
              onClick={() => setIsSystemSummaryExpanded(!isSystemSummaryExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
            >
              {isSystemSummaryExpanded ? (
                <>
                  <ChevronUp size={16} />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <span>Expand</span>
                </>
              )}
            </button>
          )}
        </div>
        {systemSummary.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(isSystemSummaryExpanded ? systemSummary : systemSummary.slice(0, 3)).map((sys) => (
                <div key={sys.jobId} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-slate-800 text-sm">Batch #{sys.jobId}</div>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                      {sys.tag}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mb-2">{sys.jobName}</div>
                  <div className="text-xs text-slate-500">
                    <div>Boards: {sys.boards.length} ({sys.boards.join(', ')})</div>
                    <div>Firmware: {sys.firmware}</div>
                  </div>
                </div>
              ))}
            </div>
            {!isSystemSummaryExpanded && systemSummary.length > 3 && (
              <div className="mt-4 text-center text-sm text-slate-500">
                Showing top 3 of {systemSummary.length} systems. Click "Expand" to view all.
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <p>No active systems running</p>
          </div>
        )}
      </div>

      <div className="w-full">
        {/* Active Campaigns Widget */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Active</h2>
            <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setDashTab('campaigns')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dashTab === 'campaigns' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Campaigns
              </button>
              <button
                onClick={() => setDashTab('devices')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dashTab === 'devices' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Device Progress
              </button>
              <button
                onClick={() => setDashTab('commands')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dashTab === 'commands' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Common Commands
              </button>
      </div>
          </div>
          
          {dashTab === 'campaigns' ? (
        <div className="space-y-4">
              {filteredJobs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>No active jobs</p>
        </div>
              ) : (
                filteredJobs.map(job => (
                  <ActiveJobCard 
                    key={job.id}
                    job={job}
                    onClick={() => {
                      setSelectedBatch(job);
                      setShowBatchDetails(true);
                    }}
                  />
                ))
              )}
      </div>
          ) : dashTab === 'devices' ? (
            <div className="space-y-3">
              {deviceProgressRows.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                  No devices available
                </div>
              ) : (
                deviceProgressRows.map(({ board, progress }) => (
                  <div key={board.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
        <div>
                        <div className="font-bold text-slate-800">{board.name}</div>
                        <div className="text-xs text-slate-500">{board.currentJob ? board.currentJob : 'Idle'}</div>
        </div>
                      <div className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-lg">
                        {board.currentJob ? `${progress}%` : '—'}
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 transition-all" style={{ width: `${board.currentJob ? progress : 0}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 mb-4">Commonly used commands - Click to copy</p>
              {commonCommands.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                  No commands configured
                </div>
              ) : (
                commonCommands.map((cmd) => (
                  <div key={cmd.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 text-sm mb-1">{cmd.name}</div>
                        <div className="font-mono text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                          {cmd.command}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Category: {cmd.category}</div>
                      </div>
                      <button
                        onClick={() => handleCopyCommand(cmd.command)}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-all"
                        title="Copy command"
                      >
                        {copiedCommand === cmd.command ? (
                          <CheckCircle2 size={18} className="text-green-600" />
                        ) : (
                          <Copy size={18} className="text-blue-600" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
    </div>

      {/* Batch Details Modal */}
      {showBatchDetails && selectedBatch && (
        <BatchDetailsModal 
          batch={selectedBatch}
          onClose={() => {
            setShowBatchDetails(false);
            setSelectedBatch(null);
          }}
        />
      )}
    </div>
);
};

// 1.5. BOARD OVERVIEW PAGE (ภาพรวมบอร์ดที่รัน test อยู่)
const BoardOverviewPage = () => {
  const { boards, loading, errors } = useTestStore();

  // Helper: get numeric order from id or name
  const getBoardOrderNumber = (board) => {
    const idNum = Number(board.id);
    if (!Number.isNaN(idNum) && idNum > 0) return idNum;
    if (typeof board.name === 'string') {
      const match = board.name.match(/\d+/);
      if (match) return Number(match[0]);
    }
    return 0;
  };

  // Safe sort (handles undefined / numeric ids)
  const sortedBoards = (boards || []).slice().sort(
    (a, b) => getBoardOrderNumber(a) - getBoardOrderNumber(b)
  );

  const getStatusPillClass = (status) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'busy':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading?.boards) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <Monitor size={48} className="text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Loading boards...</p>
        </div>
      </div>
    );
  }

  if (errors?.boards) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="bg-white p-12 rounded-2xl border border-red-200 shadow-sm text-center">
          <Monitor size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-700">Failed to load boards: {errors.boards}</p>
        </div>
      </div>
    );
  }

  if (!sortedBoards.length) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <Monitor size={48} className="text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No boards available</p>
      </div>
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sortedBoards.map((board, index) => (
          <div
            key={board.id ?? index}
            className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-700">
                {index + 1}
      </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {board.name || `Board ${index + 1}`}
                </div>
                {board.ip && (
                  <div className="text-[11px] text-slate-500">
                    {board.ip}
                  </div>
                )}
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${getStatusPillClass(
                board.status
              )}`}
            >
              {board.status || 'unknown'}
            </span>
          </div>
        ))}
    </div>
  </div>
);
};

// 2. SETUP PAGE
// const SetupPage = () => (
//   <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-8">
//     <div className="flex justify-between items-end">
//       <div>
//         <h1 className="text-3xl font-bold">Test Case Setup</h1>
//         <p className="text-slate-500 mt-1">Configure your VCD and Firmware environment.</p>
//       </div>
//       <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2">
//         <Upload size={18} /> New Batch Setup
//       </button>
//     </div>

//     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//       <div className="lg:col-span-2 space-y-6">
//         <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-blue-400 transition-all cursor-pointer group">
//           <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//              <Upload size={32} className="text-blue-600" />
//           </div>
//           <h3 className="text-xl font-bold text-slate-800">Drag & Drop Test Files</h3>
//           <p className="text-slate-400 mt-2">Upload .VCD or Firmware .BIN files to begin</p>
//         </div>

//         <div className="bg-white rounded-2xl border border-slate-200 p-6">
//           <h3 className="font-bold mb-4 flex items-center gap-2"><FileCode className="text-blue-500" /> Loaded VCD Files</h3>
//           <div className="grid grid-cols-2 gap-4">
//             <FileItem name="test_case_A.vcd" size="1.2MB" />
//             <FileItem name="regression_v2.vcd" size="4.5MB" />
//           </div>
//         </div>
//       </div>

//       <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit">
//         <h3 className="font-bold mb-6 flex items-center gap-2"><Box className="text-orange-500" /> Config Editor</h3>
//         <div className="space-y-5">
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-400 uppercase">Config Name</label>
//             <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" defaultValue="Default_Setup" />
//           </div>
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-400 uppercase">Firmware Model</label>
//             <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl">
//               <option>ERQM_v2.3_Release</option>
//               <option>ULP_Beta_0.9</option>
//             </select>
//           </div>
//           <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-black transition-all">Generate JSON Config</button>
//         </div>
//       </div>
//     </div>
//   </div>
// );


// 2. SETUP PAGE (Version with File Upload)
const SetupPage = ({ editJobId, onEditComplete }) => {
  const { 
    uploadedFiles, 
    addUploadedFile, 
    removeUploadedFile, 
    createJob,
    runTestCommand,
    jobs, 
    boards, 
    testCommands,
    loading,
    errors,
    addTestCommand,
    updateTestCommand,
    deleteTestCommand,
    duplicateTestCommand
  } = useTestStore();
  const addToast = useTestStore((state) => state.addToast);
    const [selectedIds, setSelectedIds] = useState([]);
  const [isLoadingPairs, setIsLoadingPairs] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [configName, setConfigName] = useState('Default_Setup');
  const [tag, setTag] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedBoardIds, setSelectedBoardIds] = useState([]);
  const [selectedTestCommand, setSelectedTestCommand] = useState(null);
  const [setupMode, setSetupMode] = useState('files'); // 'files' | 'commands'
  const [showCommandManager, setShowCommandManager] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);
  const [setupErrors, setSetupErrors] = useState({ files: '', boards: '', command: '' });
  const [fileValidationErrors, setFileValidationErrors] = useState([]);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [fileFilter, setFileFilter] = useState('all'); // 'all' | 'vcd' | 'bin'
  const [fileSearch, setFileSearch] = useState('');
  const [fileSort, setFileSort] = useState('time'); // time | file-name | tag | name-asc | name-desc
  const [selectedPairVcdId, setSelectedPairVcdId] = useState('');
  const [selectedPairBinId, setSelectedPairBinId] = useState('');
  const [selectedPairLinId, setSelectedPairLinId] = useState('');
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [isDraggingJson, setIsDraggingJson] = useState(false);
  const jsonInputRef = useRef(null);
  const [draggingRowIndex, setDraggingRowIndex] = useState(null);
  const [dropTargetRowIndex, setDropTargetRowIndex] = useState(null);
  const draggingRowIndexRef = useRef(null);
  const [isDeletingFiles, setIsDeletingFiles] = useState(false);
  const [fileListExpanded, setFileListExpanded] = useState(false);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState([]); // สำหรับ checkbox ใน pairs table
  const [bulkTryCount, setBulkTryCount] = useState(''); // สำหรับ bulk edit try count
  const isAutoPairingRef = useRef(false); // ป้องกัน auto-pair ซ้ำ
  const isLoadingConfigRef = useRef(false); // track ว่าเป็นการ load config หรือไม่
  const [commandForm, setCommandForm] = useState({
    name: '',
    command: '',
    description: '',
    category: 'testing'
  });
  
  // Get unique tags from existing jobs for suggestions
  const existingTags = [...new Set(jobs.map(j => j.tag).filter(Boolean))];
  const selectableBoards = boards.filter(b => b.status === 'online' && !b.currentJob);
  const toggleSelectedBoard = (id) => {
    setSelectedBoardIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  // Replace placeholders in test command
  const getResolvedCommand = (cmd) => {
    if (!cmd || !cmd.command) return cmd?.command || '';
    let resolved = cmd.command;
    if (selectedBoardIds.length > 0) {
      resolved = resolved.replace(/{board_id}/g, selectedBoardIds[0]);
      resolved = resolved.replace(/{boards}/g, selectedBoardIds.join(','));
      // Get firmware from first selected board
      const firstBoard = boards.find(b => b.id === selectedBoardIds[0]);
      if (firstBoard && firstBoard.firmware) {
        resolved = resolved.replace(/{firmware}/g, firstBoard.firmware);
      }
    } else {
      // Keep placeholders if no boards selected
      resolved = resolved;
    }
    return resolved;
  };

  const pushFileError = (message) => {
    setFileValidationErrors((prev) => [...prev, message].slice(-3));
  };

  const validateSetup = (mode) => {
    const nextErrors = { files: '', boards: '', command: '' };
    if (mode === 'files' && selectedPairs.length === 0) {
      nextErrors.files = 'Create at least one test case pair.';
    }
    if (mode === 'commands' && !selectedTestCommand) {
      nextErrors.command = 'Select a test command.';
    }
    if (selectedBoardIds.length === 0) {
      nextErrors.boards = 'Select at least one board.';
    }
    setSetupErrors(nextErrors);
    return !nextErrors.files && !nextErrors.command && !nextErrors.boards;
  };
  
  // File upload handlers
  const getFileKind = (file) => {
    const ext = String(file?.name || '').split('.').pop()?.toLowerCase();
    if (ext === 'vcd') return 'vcd';
    if (['bin', 'hex', 'elf'].includes(ext)) return 'bin';
    return 'other';
  };

  // ใช้เฉพาะไฟล์ที่ถูกเลือก (checkbox) — เรียงตาม selectedIds (ใช้กับ Create Batch และ move up/down)
  const selectedFiles = selectedIds
    .map((id) => uploadedFiles.find((f) => f.id === id))
    .filter(Boolean);
  const vcdFilesList = selectedFiles.filter((f) => getFileKind(f) === 'vcd');
  const binFilesList = selectedFiles.filter((f) => getFileKind(f) === 'bin');
  const linFilesList = selectedFiles.filter((f) => {
    const ext = String(f?.name || '').split('.').pop()?.toLowerCase();
    return ext === 'lin' || ext === 'txt'; // lin files อาจเป็น .lin หรือ .txt
  });

  // Auto-pair แบบ Smart: pair อัตโนมัติเมื่อ select files (แต่ไม่ pair เมื่อ load config)
  const autoPairSmart = useCallback(() => {
    // ไม่ auto-pair ถ้า:
    // 1. กำลัง load config
    // 2. กำลัง auto-pairing อยู่ (ป้องกัน loop)
    // 3. ไม่มี VCD หรือ BIN
    // 4. มี pairs อยู่แล้ว (ไม่ pair ซ้ำ)
    if (isLoadingConfigRef.current || isAutoPairingRef.current) return;
    
    const currentSelectedFiles = selectedIds
      .map((id) => uploadedFiles.find((f) => f.id === id))
      .filter(Boolean);
    const currentVcdFiles = currentSelectedFiles.filter((f) => getFileKind(f) === 'vcd');
    const currentBinFiles = currentSelectedFiles.filter((f) => getFileKind(f) === 'bin');
    
    if (currentVcdFiles.length === 0 || currentBinFiles.length === 0) return;
    
      setSelectedPairs((prev) => {
      // ถ้ามี pairs อยู่แล้ว หรือกำลัง auto-pairing อยู่ ไม่ต้อง auto-pair
      if (prev.length > 0 || isAutoPairingRef.current) return prev;
      
      isAutoPairingRef.current = true;
      const newPairs = [];
      
      // ใช้ลำดับจาก selectedFiles (ตาม selectedIds order) เพื่อ pair ตามที่ user เรียงไว้
      const orderedFiles = currentSelectedFiles;
      
      // หา VCD, BIN, LIN ตามลำดับที่เรียงไว้
      const orderedVcds = orderedFiles.filter(f => getFileKind(f) === 'vcd');
      const orderedBins = orderedFiles.filter(f => getFileKind(f) === 'bin');
      const orderedLins = orderedFiles.filter(f => {
        const ext = String(f?.name || '').split('.').pop()?.toLowerCase();
        return ext === 'lin' || ext === 'txt';
      });

      // Pair ตามลำดับที่เรียงไว้: VCD กับ BIN ที่อยู่ใกล้กันที่สุด
      orderedVcds.forEach((vcdFile, vcdIdx) => {
        const vcdIndexInOrdered = orderedFiles.findIndex(f => f.id === vcdFile.id);
        
        // หา BIN ที่ใกล้ที่สุด
        let nearestBin = null;
        let minDistance = Infinity;
        
        orderedBins.forEach(binFile => {
          const binIndexInOrdered = orderedFiles.findIndex(f => f.id === binFile.id);
          const distance = Math.abs(binIndexInOrdered - vcdIndexInOrdered);
          if (distance < minDistance) {
            minDistance = distance;
            nearestBin = binFile;
          }
        });

        const binFile = nearestBin || orderedBins[vcdIdx % orderedBins.length];
        
        // หา LIN ที่ใกล้ที่สุด (ถ้ามี)
        let nearestLin = null;
        let minLinDistance = Infinity;
        
        orderedLins.forEach(linFile => {
          const linIndexInOrdered = orderedFiles.findIndex(f => f.id === linFile.id);
          const distance = Math.abs(linIndexInOrdered - vcdIndexInOrdered);
          if (distance < minLinDistance) {
            minLinDistance = distance;
            nearestLin = linFile;
          }
        });

        newPairs.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${vcdIdx}`,
          vcdId: vcdFile.id,
          binId: binFile.id,
          linId: nearestLin?.id || null,
          try: 1,
        });
      });

      // Reset flag หลังจากเสร็จ
      setTimeout(() => {
        isAutoPairingRef.current = false;
      }, 100);

      return newPairs;
    });
  }, [selectedIds, uploadedFiles]);

  // ถ้ามีไฟล์ที่เคยอยู่ใน pair แต่ถูก unselect ออกจาก selectedIds ให้ลบทิ้ง
  useEffect(() => {
    setSelectedPairs((prev) => {
      const filtered = prev.filter(
        (p) => 
          selectedIds.includes(p.vcdId) && 
          selectedIds.includes(p.binId) &&
          (!p.linId || selectedIds.includes(p.linId))
      );
      return filtered;
    });
  }, [selectedIds]);

  // Auto-pair เมื่อ selectedIds เปลี่ยน (แต่ไม่ pair เมื่อ load config หรือกำลัง auto-pairing)
  useEffect(() => {
    if (!isLoadingConfigRef.current && !isAutoPairingRef.current && selectedIds.length > 0) {
      // ใช้ setTimeout เพื่อให้ state อัปเดตเสร็จก่อน
      const timer = setTimeout(() => {
        autoPairSmart();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedIds, autoPairSmart]);

  // Load pairs data เมื่อ editJobId มีค่า (Edit Batch mode)
  useEffect(() => {
    if (editJobId) {
      const loadPairsFromJob = async () => {
        setIsLoadingPairs(true);
        isLoadingConfigRef.current = true; // ป้องกัน auto-pair ระหว่าง load
        
        try {
          const api = await import('./services/api');
          const response = await api.getJobPairs(editJobId);
          const pairsData = response.pairsData || [];
          
          // ถ้าไม่มี pairsData (job เก่าที่สร้างก่อน feature นี้) แสดง warning และให้ user สร้าง pairs ใหม่
          if (pairsData.length === 0) {
            addToast({ 
              type: 'warning', 
              message: 'No pairs data found for this batch. You can create new pairs manually.' 
            });
            setIsLoadingPairs(false);
            isLoadingConfigRef.current = false;
            return;
          }
          
          // Map file names กลับไปหา file IDs
          const loadedPairs = pairsData.map(pairData => {
            // หา file IDs จาก file names
            // Map file names กลับไปหา file IDs
            // pairsData เก็บ vcdId, binId, linId อยู่แล้ว แต่ถ้าไม่มีให้ใช้ file names
            let vcdFile = pairData.vcdId ? uploadedFiles.find(f => f.id === pairData.vcdId) : null;
            if (!vcdFile && pairData.vcdName) {
              vcdFile = uploadedFiles.find(f => f.name === pairData.vcdName || f.originalName === pairData.vcdName);
            }
            if (!vcdFile && pairData.vcd) {
              vcdFile = uploadedFiles.find(f => f.name === pairData.vcd || f.originalName === pairData.vcd);
            }
            
            let binFile = pairData.binId ? uploadedFiles.find(f => f.id === pairData.binId) : null;
            if (!binFile && pairData.binName) {
              binFile = uploadedFiles.find(f => f.name === pairData.binName || f.originalName === pairData.binName);
            }
            if (!binFile && pairData.erom) {
              binFile = uploadedFiles.find(f => f.name === pairData.erom || f.originalName === pairData.erom);
            }
            
            let linFile = null;
            if (pairData.linId) {
              linFile = uploadedFiles.find(f => f.id === pairData.linId);
            }
            if (!linFile && pairData.linName) {
              linFile = uploadedFiles.find(f => f.name === pairData.linName || f.originalName === pairData.linName);
            }
            if (!linFile && pairData.ulp) {
              linFile = uploadedFiles.find(f => f.name === pairData.ulp || f.originalName === pairData.ulp);
            }
            
            return {
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              vcdId: vcdFile?.id || pairData.vcdId || '',
              binId: binFile?.id || pairData.binId || '',
              linId: linFile?.id || pairData.linId || null,
              try: pairData.try || pairData.try_count || 1,
            };
          }).filter(pair => pair.vcdId && pair.binId); // กรองเฉพาะ pairs ที่มี VCD และ BIN
          
          if (loadedPairs.length > 0) {
            setSelectedPairs(loadedPairs);
            
            // Select files ที่ใช้ใน pairs
            const fileIdsToSelect = new Set();
            loadedPairs.forEach(pair => {
              if (pair.vcdId) fileIdsToSelect.add(pair.vcdId);
              if (pair.binId) fileIdsToSelect.add(pair.binId);
              if (pair.linId) fileIdsToSelect.add(pair.linId);
            });
            setSelectedIds(Array.from(fileIdsToSelect));
            
            // Load job data เพื่อ set config name, tag, boards
            const job = jobs.find(j => j.id === editJobId);
            if (job) {
              if (job.configName) setConfigName(job.configName);
              if (job.tag) setTag(job.tag);
              
              // Map board names กลับไปหา board IDs
              if (job.boards && job.boards.length > 0) {
                const boardIds = job.boards
                  .map(boardName => boards.find(b => b.name === boardName)?.id)
                  .filter(Boolean);
                setSelectedBoardIds(boardIds);
              }
            }
            
            addToast({ type: 'success', message: `Loaded ${loadedPairs.length} pairs from batch.` });
                        } else {
                          addToast({ 
                            type: 'warning', 
                            message: 'No valid pairs found. Files may have been deleted. You can create new pairs manually.' 
                          });
                        }
                      } catch (error) {
                        console.error('Failed to load pairs from job', error);
                        // ถ้าเป็น 404 error แสดง message ที่เหมาะสม
                        if (error.response?.status === 404 || error.message?.includes('404')) {
                          addToast({ 
                            type: 'warning', 
                            message: 'No pairs data found for this batch. This batch was created before the edit feature was added. You can create new pairs manually.' 
                          });
                        } else {
                          addToast({ type: 'error', message: 'Failed to load pairs data from batch.' });
                        }
                      } finally {
                        setIsLoadingPairs(false);
                        isLoadingConfigRef.current = false;
                      }
      };
      
      loadPairsFromJob();
    }
  }, [editJobId, uploadedFiles, jobs, boards]);

  const addPair = () => {
    if (!selectedPairVcdId || !selectedPairBinId) return;
    // ป้องกัน duplicate คู่เดิม
    const exists = selectedPairs.some(
      (p) => p.vcdId === selectedPairVcdId && p.binId === selectedPairBinId && p.linId === selectedPairLinId
    );
    if (exists) return;
    setSelectedPairs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        vcdId: selectedPairVcdId,
        binId: selectedPairBinId,
        linId: selectedPairLinId || null, // lin is optional
        try: 1, // default จำนวนรอบ test
      },
    ]);
    setSelectedPairVcdId('');
    setSelectedPairBinId('');
    setSelectedPairLinId('');
  };

  const pairAll = () => {
    if (vcdFilesList.length === 0 || binFilesList.length === 0) {
      addToast({ type: 'warning', message: 'Please select at least one VCD and one BIN file first' });
      return;
    }

    const newPairs = [];
    // ใช้ลำดับจาก selectedFiles (ตาม selectedIds order) เพื่อ pair ตามที่ user เรียงไว้
    // selectedFiles ถูกเรียงตาม selectedIds order อยู่แล้ว
    const orderedFiles = selectedFiles; // ใช้ลำดับที่ user เรียงไว้
    
    // หา VCD, BIN, LIN ตามลำดับที่เรียงไว้
    const orderedVcds = orderedFiles.filter(f => getFileKind(f) === 'vcd');
    const orderedBins = orderedFiles.filter(f => getFileKind(f) === 'bin');
    const orderedLins = orderedFiles.filter(f => {
      const ext = String(f?.name || '').split('.').pop()?.toLowerCase();
      return ext === 'lin' || ext === 'txt';
    });

    // Pair ตามลำดับที่เรียงไว้: VCD กับ BIN ที่อยู่ใกล้กันที่สุด
    // ถ้ามี VCD, ULM, EROM ติดกัน ให้ pair เป็นกลุ่ม
    orderedVcds.forEach((vcdFile, vcdIdx) => {
      // หา BIN ที่ใกล้ที่สุด (ใช้ BIN ที่มี index ใกล้กับ VCD index ใน orderedFiles)
      const vcdIndexInOrdered = orderedFiles.findIndex(f => f.id === vcdFile.id);
      
      // หา BIN ที่ใกล้ที่สุด (ถ้ามีหลาย BIN ให้ใช้ตัวที่ใกล้ที่สุด)
      let nearestBin = null;
      let minDistance = Infinity;
      
      orderedBins.forEach(binFile => {
        const binIndexInOrdered = orderedFiles.findIndex(f => f.id === binFile.id);
        const distance = Math.abs(binIndexInOrdered - vcdIndexInOrdered);
        if (distance < minDistance) {
          minDistance = distance;
          nearestBin = binFile;
        }
      });

      // ถ้าไม่เจอ BIN ที่ใกล้ ให้ใช้ BIN แรก
      const binFile = nearestBin || orderedBins[vcdIdx % orderedBins.length];
      
      // หา LIN ที่ใกล้ที่สุด (ถ้ามี)
      let nearestLin = null;
      let minLinDistance = Infinity;
      
      orderedLins.forEach(linFile => {
        const linIndexInOrdered = orderedFiles.findIndex(f => f.id === linFile.id);
        const distance = Math.abs(linIndexInOrdered - vcdIndexInOrdered);
        if (distance < minLinDistance) {
          minLinDistance = distance;
          nearestLin = linFile;
        }
      });

      const exists = selectedPairs.some(
        (p) => p.vcdId === vcdFile.id && p.binId === binFile.id
      );
      
      if (!exists) {
        newPairs.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${vcdIdx}`,
          vcdId: vcdFile.id,
          binId: binFile.id,
          linId: nearestLin?.id || null, // pair LIN ที่ใกล้ที่สุดถ้ามี
          try: 1,
        });
      }
    });

    if (newPairs.length > 0) {
      setSelectedPairs((prev) => [...prev, ...newPairs]);
      addToast({ type: 'success', message: `Created ${newPairs.length} pair(s) based on file order` });
    } else {
      addToast({ type: 'info', message: 'All possible pairs already exist' });
    }
  };

  const clearAllPairs = () => {
    if (selectedPairs.length === 0) {
      addToast({ type: 'info', message: 'No pairs to clear' });
      return;
    }
    if (window.confirm(`Are you sure you want to clear all ${selectedPairs.length} pair(s)?`)) {
      // ตั้ง flag เพื่อป้องกัน auto-pair ทันที
      isAutoPairingRef.current = true;
      setSelectedPairs([]);
      setSelectedTestCaseIds([]);
      addToast({ type: 'success', message: 'All pairs cleared' });
      
      // Reset flag หลังจาก clear เสร็จ (ไม่ auto-pair ใหม่ ให้ user กด Pair All เอง)
      setTimeout(() => {
        isAutoPairingRef.current = false;
      }, 500);
    }
  };

  const removePair = (id) => {
    setSelectedPairs((prev) => prev.filter((p) => p.id !== id));
    setSelectedTestCaseIds((prev) => prev.filter((testId) => testId !== id));
  };

  const duplicatePair = (id) => {
    const pair = selectedPairs.find((p) => p.id === id);
    if (!pair) return;
    const newPair = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      vcdId: pair.vcdId,
      binId: pair.binId,
      linId: pair.linId,
      try: pair.try || 1,
    };
    const pairIndex = selectedPairs.findIndex((p) => p.id === id);
    setSelectedPairs((prev) => {
      const next = [...prev];
      next.splice(pairIndex + 1, 0, newPair);
      return next;
    });
    addToast({ type: 'success', message: 'Test case duplicated' });
  };

  // Move pair up/down in the list
  const movePair = (pairId, direction) => {
    const currentIndex = selectedPairs.findIndex((p) => p.id === pairId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= selectedPairs.length) return;

    setSelectedPairs((prev) => {
      const newPairs = [...prev];
      const [movedPair] = newPairs.splice(currentIndex, 1);
      newPairs.splice(targetIndex, 0, movedPair);
      return newPairs;
    });
  };

  const toggleTestCaseSelection = (id) => {
    setSelectedTestCaseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllTestCases = () => {
    if (selectedTestCaseIds.length === selectedPairs.length) {
      setSelectedTestCaseIds([]);
    } else {
      setSelectedTestCaseIds(selectedPairs.map((p) => p.id));
    }
  };

  // Bulk Edit: Set try count for selected test cases
  const handleBulkSetTryCount = () => {
    if (selectedTestCaseIds.length === 0) {
      addToast({ type: 'warning', message: 'Please select at least one test case.' });
      return;
    }

    const tryCount = parseInt(bulkTryCount);
    if (isNaN(tryCount) || tryCount < 1) {
      addToast({ type: 'error', message: 'Please enter a valid number (minimum 1).' });
      return;
    }

    setSelectedPairs(prevPairs => 
      prevPairs.map(pair => 
        selectedTestCaseIds.includes(pair.id)
          ? { ...pair, try: tryCount }
          : pair
      )
    );

    addToast({ 
      type: 'success', 
      message: `Set try count to ${tryCount} for ${selectedTestCaseIds.length} test case(s).` 
    });
    setBulkTryCount(''); // Clear input after applying
  };

  const updatePairTry = (pairId, tryCount) => {
    // อนุญาตให้เป็น empty string เพื่อให้ผู้ใช้ลบได้
    if (tryCount === '' || tryCount === null || tryCount === undefined) {
      setSelectedPairs((prev) =>
        prev.map((p) => (p.id === pairId ? { ...p, try: '' } : p))
      );
      return;
    }
    // ถ้ามีค่า ให้ parse และ validate
    const num = parseInt(tryCount);
    if (isNaN(num)) {
      // ถ้า parse ไม่ได้ ให้เก็บเป็น empty string
      setSelectedPairs((prev) =>
        prev.map((p) => (p.id === pairId ? { ...p, try: '' } : p))
      );
      return;
    }
    // จำกัด 1-100
    const count = Math.max(1, Math.min(100, num));
    setSelectedPairs((prev) =>
      prev.map((p) => (p.id === pairId ? { ...p, try: count } : p))
    );
  };

  const updatePairFile = (pairId, fileType, fileId) => {
    setSelectedPairs((prev) =>
      prev.map((p) => {
        if (p.id !== pairId) return p;
        const updated = { ...p };
        if (fileType === 'vcd') updated.vcdId = fileId;
        else if (fileType === 'bin') updated.binId = fileId;
        else if (fileType === 'lin') updated.linId = fileId || null;
        return updated;
      })
    );
  };

  const reorderList = (arr, fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= arr.length || toIndex >= arr.length) return arr;
    const next = [...arr];
    const [item] = next.splice(fromIndex, 1);
    const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    next.splice(insertAt, 0, item);
    return next;
  };

  const handleRowDragStart = (e, index) => {
    draggingRowIndexRef.current = index;
    setDraggingRowIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleRowDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetRowIndex(index);
  };

  const handleRowDrop = (e, toIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = draggingRowIndexRef.current;
    if (fromIndex == null) return;
    if (selectedPairs.length > 0) {
      setSelectedPairs((prev) => reorderList(prev, fromIndex, toIndex));
    } else {
      setSelectedIds((prev) => reorderList(prev, fromIndex, toIndex));
    }
    draggingRowIndexRef.current = null;
    setDraggingRowIndex(null);
    setDropTargetRowIndex(null);
  };

  const handleRowDragEnd = () => {
    draggingRowIndexRef.current = null;
    setDraggingRowIndex(null);
    setDropTargetRowIndex(null);
  };

  // Save config to JSON file (เก็บ configName, tag, pairs และ fileNames — โหลดกลับมาแสดงไฟล์ได้)
  const saveConfigJson = () => {
    const config = {
      configName,
      tag,
      pairs: selectedPairs.map((p) => {
        const vcdFile = uploadedFiles.find((f) => f.id === p.vcdId);
        const binFile = uploadedFiles.find((f) => f.id === p.binId);
        const linFile = p.linId ? uploadedFiles.find((f) => f.id === p.linId) : null;
        return {
          vcd: vcdFile?.name || '',
          bin: binFile?.name || '',
          lin: linFile?.name || null,
          try: p.try || 1,
        };
      }),
      fileNames: selectedFiles.map((f) => f.name),
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${configName || 'config'}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: 'Config saved successfully!' });
  };

  // Load config from JSON — โหลด pairs และ/หรือ fileNames แล้ว auto-select ไฟล์ที่พบใน library
  const loadConfigJson = async (file) => {
    try {
      isLoadingConfigRef.current = true; // ตั้ง flag ว่าเป็นการ load config
      const text = await file.text();
      const config = JSON.parse(text);

      const pairs = Array.isArray(config.pairs) ? config.pairs : [];
      const newPairs = [];
      const idsToSelect = new Set(selectedIds);

      for (const pair of pairs) {
        const vcdFile = uploadedFiles.find((f) => f.name === pair.vcd);
        const binFile = uploadedFiles.find((f) => f.name === pair.bin);
        const linFile = pair.lin ? uploadedFiles.find((f) => f.name === pair.lin) : null;

        if (!vcdFile || !binFile) {
          addToast({ 
            type: 'warning', 
            message: `ข้ามคู่: ${pair.vcd} / ${pair.bin} — ไม่พบไฟล์ใน library (ต้อง add ไฟล์ก่อน)` 
          });
          continue;
        }

        idsToSelect.add(vcdFile.id);
        idsToSelect.add(binFile.id);
        if (linFile) idsToSelect.add(linFile.id);

        newPairs.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          vcdId: vcdFile.id,
          binId: binFile.id,
          linId: linFile?.id || null,
          try: pair.try || 1,
        });
      }

      // โหลด fileNames (รายการไฟล์ที่เลือก) — แม้ไม่มี pairs ก็แสดงในตารางได้
      let loadedFromFileNames = 0;
      if (Array.isArray(config.fileNames)) {
        for (const name of config.fileNames) {
          const f = uploadedFiles.find((x) => x.name === name);
          if (f && !idsToSelect.has(f.id)) {
            idsToSelect.add(f.id);
            loadedFromFileNames++;
          }
        }
      }

      setSelectedIds([...idsToSelect]);
      setSelectedPairs(newPairs);
      if (config.configName) setConfigName(config.configName);
      if (config.tag) setTag(config.tag);

      if (newPairs.length > 0) {
        addToast({ type: 'success', message: `โหลด ${newPairs.length} คู่ และเลือกไฟล์ที่เกี่ยวข้องให้แล้ว` });
      } else if (loadedFromFileNames > 0) {
        addToast({ type: 'success', message: `โหลด config และเลือก ${loadedFromFileNames} ไฟล์ให้แล้ว` });
      } else if (pairs.length === 0 && (!config.fileNames || config.fileNames.length === 0)) {
        addToast({ type: 'success', message: 'โหลด config (configName, tag) แล้ว' });
      } else if (pairs.length > 0) {
        addToast({ type: 'warning', message: 'โหลด 0 คู่ — ตรวจว่าไฟล์ใน config อยู่ใน library หรือยัง (add ไฟล์ก่อน)' });
      } else {
        addToast({ type: 'warning', message: 'ไม่พบไฟล์จาก config ใน library — add ไฟล์ก่อนแล้วโหลดใหม่' });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      addToast({ type: 'error', message: `Failed to load config: ${error.message}` });
    } finally {
      isLoadingConfigRef.current = false; // reset flag
    }
  };

  const handleJsonDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingJson(true);
  };

  const handleJsonDragLeave = (e) => {
    e.preventDefault();
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingJson(false);
  };

  const handleJsonDrop = (e) => {
    e.preventDefault();
    setIsDraggingJson(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const jsonFile = files.find((f) => f.name.endsWith('.json'));
    if (jsonFile) {
      loadConfigJson(jsonFile);
    } else {
      addToast({ type: 'warning', message: 'Please drop a JSON file' });
    }
  };

  const handleJsonFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.json')) {
      loadConfigJson(file);
    } else {
      addToast({ type: 'warning', message: 'Please select a JSON file' });
    }
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleFileSelect = async (selectedFiles) => {
    for (const file of Array.from(selectedFiles)) {
      // Validate file type
      const extension = file.name.split('.').pop().toLowerCase();
      const validExtensions = ['vcd', 'bin', 'hex', 'elf'];
      
      if (!validExtensions.includes(extension)) {
        pushFileError(`File type .${extension} is not supported. Please upload .vcd, .bin, .hex, or .elf files.`);
        continue;
      }
      
      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        pushFileError(`File ${file.name} is too large. Maximum size is 50MB.`);
        continue;
      }
      
      await addUploadedFile(file);
    }
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're actually leaving the container
    // (not just moving to a child element)
    if (!e.currentTarget.contains(e.relatedTarget)) {
    setIsDragging(false);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };
  
  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };
  
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (selectedIds.length > 0 && setupErrors.files) {
      setSetupErrors((prev) => ({ ...prev, files: '' }));
    }
  }, [selectedIds, setupErrors.files]);

  useEffect(() => {
    if (selectedBoardIds.length > 0 && setupErrors.boards) {
      setSetupErrors((prev) => ({ ...prev, boards: '' }));
    }
  }, [selectedBoardIds, setupErrors.boards]);

  useEffect(() => {
    if (selectedTestCommand && setupErrors.command) {
      setSetupErrors((prev) => ({ ...prev, command: '' }));
    }
  }, [selectedTestCommand, setupErrors.command]);

  useEffect(() => {
    setSetupErrors((prev) => ({
      ...prev,
      files: setupMode === 'files' ? prev.files : '',
      command: setupMode === 'commands' ? prev.command : ''
    }));
  }, [setupMode]);
  
    // ฟังก์ชันเลือก/ไม่เลือก ทั้งหมด
    const handleSelectAll = () => {
    if (selectedIds.length === uploadedFiles.length) {
      setSelectedIds([]);
      } else {
      setSelectedIds(uploadedFiles.map(f => f.id));
      }
    };
  
    // ฟังก์ชันเลือกเฉพาะไฟล์
    const toggleSelect = (id) => {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(item => item !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    };
  
    // ฟังก์ชันลบไฟล์ที่เลือก (ลบไฟล์จริงๆ)
    const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} file(s)?\n\nThis will permanently delete the files from the server.`)) {
      try {
        setIsDeletingFiles(true);
        await Promise.all(selectedIds.map(id => removeUploadedFile(id)));
        setSelectedIds([]);
        addToast({ type: 'success', message: 'Files deleted successfully.' });
      } catch (error) {
        console.error('Failed to delete files', error);
        addToast({ type: 'error', message: 'Failed to delete files.' });
      } finally {
        setIsDeletingFiles(false);
      }
      }
    };

    // ฟังก์ชันเคลียร์ space (เคลียร์เฉพาะ UI state ไม่ลบไฟล์จริง)
    const handleClearAll = () => {
      if (selectedIds.length === 0 && selectedPairs.length === 0) {
        addToast({ type: 'info', message: 'Nothing to clear.' });
        return;
      }
      
      if (window.confirm(`Clear all selections and pairs?\n\nThis will only clear the UI. Files will remain in the upload folder.`)) {
        setSelectedIds([]);
        setSelectedPairs([]);
        setSelectedTestCaseIds([]);
        setSelectedPairVcdId('');
        setSelectedPairBinId('');
        setSelectedPairLinId('');
        addToast({ type: 'success', message: 'Cleared all selections. Files remain in upload folder.' });
      }
    };
  
  return (
  <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 space-y-8">
    <div className="flex justify-between items-end">
      <div>
    <h1 className="text-3xl font-bold text-slate-800">
      {editJobId ? `Edit Batch #${editJobId}` : 'Test Case Setup'}
    </h1>
        <p className="text-slate-500 mt-1">
          {editJobId 
            ? 'Edit pairs and configuration for this batch' 
            : 'Configure and manage your test files or use pre-written test commands.'}
        </p>
      </div>
      {editJobId && (
        <button
          onClick={() => {
            if (onEditComplete) onEditComplete();
            // Reset states
            setSelectedPairs([]);
            setSelectedIds([]);
            setSelectedBoardIds([]);
            setSelectedTestCaseIds([]);
            setConfigName('Default_Setup');
            setTag('');
          }}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
        >
          <X size={16} />
          Cancel Edit
        </button>
      )}
          <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setSetupMode('files')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                setupMode === 'files' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              File Upload
            </button>
            <button
              onClick={() => setSetupMode('commands')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                setupMode === 'commands' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Test Commands
          </button>
          </div>
        </div>
  
        <div className="max-w-6xl mx-auto">
          <div className="space-y-6">
            {/* ส่วนแสดงรายการไฟล์พร้อมระบบเลือก */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden transition-all"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={selectedIds.length === uploadedFiles.length && uploadedFiles.length > 0}
                    onChange={handleSelectAll}
                  />
                  <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                    Select All ({selectedIds.length}/{uploadedFiles.length})
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Clear All Button - Clear UI only, don't delete files */}
                  {(selectedIds.length > 0 || selectedPairs.length > 0) && (
                    <button 
                      onClick={handleClearAll}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors hover:bg-slate-200"
                      title="Clear all selections and pairs (files remain in upload folder)"
                    >
                      <X size={14} />
                      Clear All
                    </button>
                  )}
                  
                  {/* Delete Selected Button - Actually delete files */}
                  {selectedIds.length > 0 && (
                    <button 
                      onClick={handleDeleteSelected}
                      disabled={isDeletingFiles}
                      className={`flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold transition-colors animate-in fade-in zoom-in duration-200 ${isDeletingFiles ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-100'}`}
                      title="Permanently delete selected files from server"
                    >
                      {isDeletingFiles ? 'Deleting...' : '❌ Delete Selected'}
                    </button>
                  )}
                </div>
              </div>
  
              {/* Compact add-files (+) */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".vcd,.bin,.hex,.elf"
                onChange={handleFileInputChange}
                className="hidden"
              />
  
              {/* Filter: All/VCD/Binary + Time, File Name, Tag */}
              <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'vcd', label: 'VCD' },
                    { key: 'bin', label: 'Binary' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setFileFilter(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        fileFilter === opt.key
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleBrowseClick}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    title="Add files"
                  >
                    <Plus size={16} />
                  </button>
                  <input
                    type="text"
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder="Search name..."
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-300 focus:ring-0"
                  />
                  <select
                    value={fileSort}
                    onChange={(e) => setFileSort(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-300 focus:ring-0"
                  >
                    <option value="time">Time</option>
                    {/* <option value="file-name">File Name</option> */}
                    <option value="tag">Tag</option>
                    {/* <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option> */}
                  </select>
                </div>
              </div>
  
              <div className={`divide-y divide-slate-100 overflow-y-auto relative transition-[max-height] duration-300 ${
                fileListExpanded ? 'max-h-[500px]' : 'max-h-[220px]'
              }`}>
                {loading?.files ? (
                  <div className="p-12 text-center text-slate-400">
                    <p>Loading files...</p>
                  </div>
                ) : errors?.files ? (
                  <div className="p-12 text-center text-red-600">
                    <p>Failed to load files: {errors.files}</p>
                  </div>
                ) : uploadedFiles.length > 0 ? (
                  [...uploadedFiles]
                    .filter((file) => {
                      // Filter by file type (All/VCD/Binary)
                      const kind = getFileKind(file);
                      if (fileFilter === 'all') {
                        // pass all
                      } else if (fileFilter === 'vcd') {
                        if (kind !== 'vcd') return false;
                      } else if (fileFilter === 'bin') {
                        if (kind !== 'bin') return false;
                      }
                      
                      // Filter by search
                      if (!fileSearch.trim()) return true;
                      return file.name.toLowerCase().includes(fileSearch.trim().toLowerCase());
                    })
                    .sort((a, b) => {
                      if (fileSort === 'time') {
                        // Sort by upload date (newest first)
                        return (new Date(b.uploadDate || b.date || 0)) - (new Date(a.uploadDate || a.date || 0));
                      }
                      if (fileSort === 'file-name') {
                        // Sort by file name A-Z
                        return a.name.localeCompare(b.name);
                      }
                      if (fileSort === 'tag') {
                        // Sort by tag if available, otherwise by name
                        const aTag = a.tag || '';
                        const bTag = b.tag || '';
                        if (aTag && bTag) return aTag.localeCompare(bTag);
                        if (aTag) return -1;
                        if (bTag) return 1;
                        return a.name.localeCompare(b.name);
                      }
                      if (fileSort === 'name-asc') {
                        return a.name.localeCompare(b.name);
                      }
                      if (fileSort === 'name-desc') {
                        return b.name.localeCompare(a.name);
                      }
                      return 0;
                    })
                    .map((file) => (
                    <div 
                      key={file.id} 
                      className={`flex items-center gap-4 p-4 transition-colors hover:bg-slate-50 ${selectedIds.includes(file.id) ? 'bg-blue-50/50' : ''}`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.includes(file.id)}
                        onChange={() => toggleSelect(file.id)}
                      />
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <FileCode size={20} className={file.type === 'vcd' ? 'text-blue-500' : 'text-orange-500'} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-700">{file.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{file.sizeFormatted || file.size}</div>
                          <span className="text-[10px] text-slate-400">•</span>
                          <div className="text-[10px] text-slate-400">{file.date}</div>
                          {file.originalName !== file.name && (
                            <>
                              <span className="text-[10px] text-slate-400">•</span>
                              <div className="text-[10px] text-blue-500" title={`Original: ${file.originalName}`}>
                                Renamed
                      </div>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Delete ${file.name}?\n\nThis will permanently delete the file from the server.`)) {
                            await removeUploadedFile(file.id);
                            addToast({ type: 'success', message: `File ${file.name} deleted.` });
                          }
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Permanently delete file from server"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    <p>No files uploaded yet.</p>
                    <p className="text-xs mt-2">Drag and drop files here or use the + button above</p>
                  </div>
                )}
              </div>

              {/* Show more / Show less */}
              {uploadedFiles.length > 0 && !loading?.files && !errors?.files && (
                <button
                  type="button"
                  onClick={() => setFileListExpanded((e) => !e)}
                  className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:bg-slate-50 border-t border-slate-200 transition-colors"
                >
                  {fileListExpanded ? (
                    <>
                      <ChevronUp size={14} />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Show more
                    </>
                  )}
                </button>
              )}
            </div>
            
            {setupMode === 'files' ? (
              <>
            {setupErrors.files && (
              <div className="text-sm text-red-600 px-2">
                {setupErrors.files}
              </div>
            )}
  
                {fileValidationErrors.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {fileValidationErrors.map((msg, index) => (
                      <div key={`${msg}-${index}`}>{msg}</div>
                    ))}
                  </div>
                )}

                {/* Select — ลากไฟล์ .json มาวางที่แผนที่นี้ได้ หรือใช้ LOAD CONFIG. JSON */}
                <div
                  onDragOver={handleJsonDragOver}
                  onDragLeave={handleJsonDragLeave}
                  onDrop={handleJsonDrop}
                  title="ลากไฟล์ .json มาวางเพื่อโหลด config"
                  className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${
                    isDraggingJson ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-2' : 'border-slate-200'
                  }`}
                >
                  <input ref={jsonInputRef} type="file" accept=".json" onChange={handleJsonFileInput} className="hidden" />
                  <div className="p-4 flex flex-col gap-3 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">
                              {editJobId ? `Edit Batch #${editJobId}` : 'Pair Files'}
                            </h3>
                            {selectedPairs.length > 0 && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">
                                {selectedPairs.length} pairs
                              </span>
                            )}
                            {isLoadingPairs && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold flex items-center gap-1">
                                <RefreshCw size={12} className="animate-spin" />
                                Loading...
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {editJobId ? 'Edit pairs and create a new batch' : 'pair up VCD and BIN files'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedPairVcdId}
                            onChange={(e) => setSelectedPairVcdId(e.target.value)}
                            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-300 focus:ring-0"
                          >
                            <option value="">Select VCD</option>
                            {vcdFilesList.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select
                            value={selectedPairBinId}
                            onChange={(e) => setSelectedPairBinId(e.target.value)}
                            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-300 focus:ring-0"
                          >
                            <option value="">Select BIN</option>
                            {binFilesList.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select
                            value={selectedPairLinId}
                            onChange={(e) => setSelectedPairLinId(e.target.value)}
                            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-300 focus:ring-0"
                          >
                            <option value="">Select LIN (optional)</option>
                            {linFilesList.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={addPair}
                            disabled={!selectedPairVcdId || !selectedPairBinId}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                              !selectedPairVcdId || !selectedPairBinId
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            Add pair
                          </button>
              </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={pairAll}
                            disabled={vcdFilesList.length === 0 || binFilesList.length === 0}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                              vcdFilesList.length === 0 || binFilesList.length === 0
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                            title="Pair all VCD files with BIN files automatically"
                          >
                            <Layers size={14} />
                            Pair All
                          </button>
                          <button
                            onClick={clearAllPairs}
                            disabled={selectedPairs.length === 0}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                              selectedPairs.length === 0
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                            title="Clear all pairs"
                          >
                            <X size={14} />
                            Clear
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveConfigJson}
                            className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <FileJson size={14} />
                            SAVE CONFIG. JSON
                          </button>
                          <button
                            onClick={() => jsonInputRef.current?.click()}
                            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2"
                          >
                            <FileJson size={14} />
                            LOAD CONFIG. JSON
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                      {selectedIds.length > 0 ? (
                        <>
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-slate-900">Test Case</h4>
                              {/* Bulk Edit Try Count */}
                              {selectedTestCaseIds.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-600 font-semibold">
                                    {selectedTestCaseIds.length} selected
                                  </span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={bulkTryCount}
                                    onChange={(e) => setBulkTryCount(e.target.value)}
                                    placeholder="Try count"
                                    className="w-20 px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleBulkSetTryCount();
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={handleBulkSetTryCount}
                                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-all"
                                    title="Apply try count to selected test cases"
                                  >
                                    Apply
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid bg-slate-50 text-xs font-semibold text-slate-600 border border-slate-300" style={{ gridTemplateColumns: '40px 40px 1fr 1fr 1fr 100px 120px' }}>
                            <div className="px-2 py-2 flex items-center justify-center border-r border-slate-300">
                              <input
                                type="checkbox"
                                checked={selectedTestCaseIds.length === selectedPairs.length && selectedPairs.length > 0}
                                onChange={toggleSelectAllTestCases}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                title="Select all"
                              />
                            </div>
                            <div className="px-2 py-2 text-center border-r border-slate-300">#</div>
                            <div className="px-3 py-2 border-r border-slate-300">VCD</div>
                            <div className="px-3 py-2 border-r border-slate-300">ERoM</div>
                            <div className="px-3 py-2 border-r border-slate-300">ULP</div>
                            <div className="px-2 py-2 text-center border-r border-slate-300">try</div>
                            <div className="px-3 py-2 text-right">Actions</div>
                          </div>
                          {selectedPairs.map((pair, idx) => {
                            const vcdName = vcdFilesList.find((f) => f.id === pair.vcdId)?.name || '—';
                            const binName = binFilesList.find((f) => f.id === pair.binId)?.name || '—';
                            const linName = pair.linId ? linFilesList.find((f) => f.id === pair.linId)?.name || '—' : '—';
                            return (
                              <div
                                key={pair.id}
                                onDragEnter={(e) => e.preventDefault()}
                                onDragOver={(e) => handleRowDragOver(e, idx)}
                                onDrop={(e) => handleRowDrop(e, idx)}
                                onClick={(e) => {
                                  // ไม่ toggle selection ถ้าคลิกที่ button, input, select, หรือ draggable element
                                  if (e.target.closest('button') || 
                                      e.target.closest('input') || 
                                      e.target.closest('select') || 
                                      e.target.closest('[draggable]')) {
                                    return;
                                  }
                                  toggleTestCaseSelection(pair.id);
                                }}
                                className={`grid items-center text-sm border border-slate-300 cursor-pointer ${draggingRowIndex === idx ? 'opacity-50' : ''} ${dropTargetRowIndex === idx ? 'ring-1 ring-blue-400 bg-blue-50/50' : ''} ${selectedTestCaseIds.includes(pair.id) ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                                style={{ gridTemplateColumns: '40px 40px 1fr 1fr 1fr 100px 120px' }}
                              >
                                <div 
                                  className="px-2 py-2 flex items-center justify-center border-r border-slate-300"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedTestCaseIds.includes(pair.id)}
                                    onChange={() => toggleTestCaseSelection(pair.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>
                                <div 
                                  className="px-2 py-2 text-slate-500 text-center border-r border-slate-300"
                                >
                                  {idx + 1}
                                </div>
                                <div 
                                  className="px-3 py-2 border-r border-slate-300"
                                >
                                  <select
                                    value={pair.vcdId || ''}
                                    onChange={(e) => updatePairFile(pair.id, 'vcd', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
                                  >
                                    <option value="">— Select VCD —</option>
                                    {vcdFilesList.map((f) => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div 
                                  className="px-3 py-2 border-r border-slate-300"
                                >
                                  <select
                                    value={pair.binId || ''}
                                    onChange={(e) => updatePairFile(pair.id, 'bin', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
                                  >
                                    <option value="">— Select ERoM —</option>
                                    {binFilesList.map((f) => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div 
                                  className="px-3 py-2 border-r border-slate-300"
                                >
                                  <select
                                    value={pair.linId || ''}
                                    onChange={(e) => updatePairFile(pair.id, 'lin', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
                                  >
                                    <option value="">— Select ULP (optional) —</option>
                                    {linFilesList.map((f) => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div 
                                  className="px-2 py-2 border-r border-slate-300 min-w-[100px] flex items-center"
                                >
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={pair.try === '' || pair.try === null || pair.try === undefined ? '' : pair.try}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const val = e.target.value;
                                      // อนุญาตให้เป็น empty string หรือตัวเลขเท่านั้น
                                      if (val === '' || /^\d+$/.test(val)) {
                                        updatePairTry(pair.id, val);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      e.stopPropagation();
                                      // เมื่อ blur ถ้าเป็น empty string ให้ตั้งเป็น 1
                                      if (e.target.value === '' || e.target.value === null || e.target.value === undefined) {
                                        updatePairTry(pair.id, '1');
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      // อนุญาตให้พิมพ์ตัวเลข, backspace, delete, arrow keys, tab
                                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter'].includes(e.key)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    placeholder="1"
                                    className="w-full min-w-0 px-1.5 py-1 text-xs rounded border border-slate-300 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-center"
                                    title="จำนวนรอบในการ test (พิมพ์ได้, default: 1)"
                                  />
                                </div>
                                <div className="px-3 py-2 flex items-center justify-end gap-1">
                                  <span
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      handleRowDragStart(e, idx);
                                    }}
                                    onDragEnd={(e) => {
                                      e.stopPropagation();
                                      handleRowDragEnd();
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                    title="ลากเพื่อเรียง"
                                  >
                                    <GripVertical size={16} />
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      duplicatePair(pair.id);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title="Duplicate"
                                  >
                                    <Copy size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      removePair(pair.id);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Remove"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {selectedPairs.length === 0 && (
                            <div className="p-8 text-center text-slate-400 border border-slate-300 border-t-0">
                              <p className="text-sm mb-2">No test cases yet</p>
                              <p className="text-xs">Use "Pair All" or "Add pair" to create test cases</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-4 text-sm text-slate-400">Select files above to create test cases</div>
                      )}
                    </div>

                    {/* Config Editor Section - รวมอยู่ใน Pair Files card */}
                    {selectedIds.length > 0 && (
                      <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <Box size={16} className="text-orange-500" />
                          Config Editor
                        </h4>
                        <div className="space-y-4">
                          {/* Config Name */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Config Name</label>
                            <input 
                              type="text" 
                              value={configName}
                              onChange={(e) => setConfigName(e.target.value)}
                              className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                              placeholder="Enter config name"
                            />
                          </div>
                          
                          {/* Tag */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                              <Tag size={12} />
                              Tag / Group
                            </label>
                            <div className="relative">
                              <input 
                                type="text" 
                                value={tag}
                                onChange={(e) => {
                                  setTag(e.target.value);
                                  setShowTagSuggestions(e.target.value.length > 0 && existingTags.length > 0);
                                }}
                                onFocus={() => {
                                  if (existingTags.length > 0) setShowTagSuggestions(true);
                                }}
                                onBlur={() => {
                                  setTimeout(() => setShowTagSuggestions(false), 200);
                                }}
                                className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                                placeholder="e.g., Team A, Project X, etc."
                              />
                              
                              {/* Tag Suggestions */}
                              {showTagSuggestions && existingTags.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                  {existingTags
                                    .filter(t => t.toLowerCase().includes(tag.toLowerCase()))
                                    .map((suggestedTag, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          setTag(suggestedTag);
                                          setShowTagSuggestions(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs flex items-center gap-2"
                                      >
                                        <Tag size={10} className="text-purple-500" />
                                        <span>{suggestedTag}</span>
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                            {existingTags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {existingTags.slice(0, 5).map((existingTag, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setTag(existingTag)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                                      tag === existingTag
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                    }`}
                                  >
                                    {existingTag}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Preview */}
                          {selectedPairs.length > 0 && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs font-bold text-blue-700 uppercase mb-2">Preview</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Test Cases:</span>
                                  <span className="font-bold text-slate-800">{selectedPairs.length}</span>
                                </div>
                                {tag && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Tag:</span>
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">
                                      {tag}
                                    </span>
                                  </div>
                                )}
                                {configName && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Config:</span>
                                    <span className="font-bold text-slate-800">{configName}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Selected Boards:</span>
                                  <span className="font-bold text-slate-800">{selectedBoardIds.length}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Select Boards */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Select Boards (available)</label>
                            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg bg-white p-2">
                              {loading?.boards ? (
                                <div className="text-xs text-slate-500">Loading boards...</div>
                              ) : errors?.boards ? (
                                <div className="text-xs text-red-600">Failed to load boards</div>
                              ) : selectableBoards.length === 0 ? (
                                <div className="text-xs text-slate-500">No available boards</div>
                              ) : (
                                <div className="space-y-1.5">
                                  {selectableBoards.map(b => (
                                    <label key={b.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedBoardIds.includes(b.id)}
                                        onChange={() => toggleSelectedBoard(b.id)}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-800 truncate">{b.name}</div>
                                        <div className="text-[10px] text-slate-500">{b.ip || 'No IP'} • {b.firmware}</div>
                                      </div>
                                      {b.tag && (
                                        <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">
                                          {b.tag}
                                        </span>
                                      )}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                            {setupErrors.boards && (
                              <div className="text-xs text-red-600">
                                {setupErrors.boards}
                              </div>
                            )}
                          </div>

                          {/* Create Batch Button */}
                          <button 
                            disabled={isCreatingBatch || selectedPairs.length === 0}
                            className={`w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                              isCreatingBatch || selectedPairs.length === 0
                                ? 'opacity-60 cursor-not-allowed'
                                : 'hover:bg-black'
                            }`}
                            onClick={async () => {
                              if (isCreatingBatch) return;
                              
                              // ใช้ pairs ที่ถูกเลือกจาก checkbox (selectedTestCaseIds)
                              // ถ้าไม่มีเลือกเลย ให้ใช้ทั้งหมด
                              const pairsToUse = selectedTestCaseIds.length > 0
                                ? selectedPairs.filter(pair => selectedTestCaseIds.includes(pair.id))
                                : selectedPairs;
                              
                              if (pairsToUse.length === 0) {
                                addToast({ type: 'warning', message: 'Please select at least one test case pair' });
                                return;
                              }
                              if (selectedBoardIds.length === 0) {
                                setSetupErrors((prev) => ({ ...prev, boards: 'Select at least one board.' }));
                                return;
                              }

                              const boardNames = selectableBoards
                                .filter(b => selectedBoardIds.includes(b.id))
                                .map(b => b.name);

                              // สร้าง files array จาก pairs ที่เลือก (แต่ละ pair = 1 test case)
                              // ส่งข้อมูลไฟล์ทั้งหมด: VCD, ERoM (BIN), ULP (LIN)
                              const filesFromPairs = pairsToUse.map((pair, index) => {
                                const vcdFile = uploadedFiles.find(f => f.id === pair.vcdId);
                                const binFile = uploadedFiles.find(f => f.id === pair.binId);
                                const linFile = pair.linId ? uploadedFiles.find(f => f.id === pair.linId) : null;
                                
                                return {
                                  name: vcdFile?.name || '', // VCD file name (primary)
                                  order: index + 1,
                                  try: pair.try || 1,
                                  vcd: vcdFile?.name || '', // VCD file
                                  erom: binFile?.name || '', // ERoM (BIN) file
                                  ulp: linFile?.name || null, // ULP (LIN) file (optional)
                                };
                              });

                              // ใช้ firmware จาก pair แรก
                              const firstPair = pairsToUse[0];
                              const firmwareFile = uploadedFiles.find(f => f.id === firstPair.binId);

                              // เก็บ pairs data สำหรับ edit batch (เก็บ file IDs, file names และ try count)
                              const pairsDataForHistory = pairsToUse.map(pair => {
                                const vcdFile = uploadedFiles.find(f => f.id === pair.vcdId);
                                const binFile = uploadedFiles.find(f => f.id === pair.binId);
                                const linFile = pair.linId ? uploadedFiles.find(f => f.id === pair.linId) : null;
                                
                                return {
                                  vcdId: pair.vcdId,
                                  binId: pair.binId,
                                  linId: pair.linId || null,
                                  vcdName: vcdFile?.name || '', // เก็บ file name สำหรับ fallback
                                  binName: binFile?.name || '', // เก็บ file name สำหรับ fallback
                                  linName: linFile?.name || null, // เก็บ file name สำหรับ fallback
                                  try: pair.try || 1,
                                };
                              });

                              const jobPayload = {
                                name: configName || `Batch ${new Date().toISOString()}`,
                                tag: tag || undefined,
                                firmware: firmwareFile?.name || '',
                                boards: boardNames,
                                files: filesFromPairs.map(f => ({
                                  name: f.name, // VCD file name (for backward compatibility)
                                  order: f.order,
                                  vcd: f.vcd, // VCD file
                                  erom: f.erom, // ERoM (BIN) file
                                  ulp: f.ulp, // ULP (LIN) file
                                  try_count: f.try, // Number of test rounds
                                })),
                                configName: configName || undefined,
                                pairsData: pairsDataForHistory, // เก็บ pairs data สำหรับ edit
                              };

                              try {
                                setIsCreatingBatch(true);
                                const created = await createJob(jobPayload);
                                if (created) {
                                  // ถ้าเป็น edit mode ให้ clear edit state
                                  if (editJobId && onEditComplete) {
                                    onEditComplete();
                                  }
                                  setSelectedIds([]);
                                  setSelectedPairs([]);
                                  setSelectedBoardIds([]);
                                  setSelectedTestCaseIds([]);
                                  setTag('');
                                  setConfigName('Default_Setup');
                                  addToast({ 
                                    type: 'success', 
                                    message: editJobId 
                                      ? 'Batch updated successfully (new batch created).' 
                                      : 'Batch created successfully.' 
                                  });
                                } else {
                                  addToast({ type: 'error', message: 'Failed to create batch.' });
                                }
                              } finally {
                                setIsCreatingBatch(false);
                              }
                            }}
                          >
                            {isCreatingBatch ? (
                              <>
                                <RefreshCw size={16} className="animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Play size={16} />
                                Create Batch
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
              </>
            ) : (
              <>
                {/* Test Commands Section */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Command size={20} className="text-blue-600" />
                        <h3 className="text-lg font-bold">My Test Commands</h3>
          </div>
                      <button
                        onClick={() => {
                          setEditingCommand(null);
                          setCommandForm({ name: '', command: '', description: '', category: 'testing' });
                          setShowCommandManager(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                      >
                        <Command size={16} />
                        Manage Commands
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 mb-6">
                      Select a test command that you've written. The system will help run it on selected boards.
                      <br />
                      <span className="text-xs text-slate-500 mt-1 block">
                        Use placeholders: <code className="bg-slate-100 px-1 rounded">{'{board_id}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{firmware}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{boards}'}</code>
                      </span>
                    </p>
                    
                    {!testCommands || testCommands.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                        <Command size={48} className="text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 font-bold mb-2">No test commands yet</p>
                        <p className="text-sm text-slate-500 mb-4">Create your first test command to get started</p>
                        <button
                          onClick={() => {
                            setEditingCommand(null);
                            setCommandForm({ name: '', command: '', description: '', category: 'testing' });
                            setShowCommandManager(true);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all inline-flex items-center gap-2"
                        >
                          <Command size={16} />
                          Add Your First Command
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {testCommands.map((cmd) => (
                          <div
                            key={cmd.id}
                            onClick={() => setSelectedTestCommand(cmd)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              selectedTestCommand?.id === cmd.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 hover:border-blue-300 bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="font-bold text-slate-800">{cmd.name}</div>
                                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-bold">
                                    {cmd.category}
                                  </span>
                                </div>
                                {cmd.description && (
                                  <div className="text-sm text-slate-600 mb-2">{cmd.description}</div>
                                )}
                                <div className="font-mono text-xs text-slate-700 bg-white p-3 rounded border border-slate-200">
                                  {getResolvedCommand(cmd)}
                                </div>
                              </div>
                              {selectedTestCommand?.id === cmd.id && (
                                <CheckCircle2 size={20} className="text-blue-600 shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {setupErrors.command && (
                      <div className="mt-4 text-sm text-red-600">
                        {setupErrors.command}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Test Commands Manager Modal */}
        {showCommandManager && (
          <TestCommandsManagerModal
            commands={testCommands}
            editingCommand={editingCommand}
            commandForm={commandForm}
            setCommandForm={setCommandForm}
            onClose={() => {
              setShowCommandManager(false);
              setEditingCommand(null);
              setCommandForm({ name: '', command: '', description: '', category: 'testing' });
            }}
            onSave={(cmd) => {
              if (editingCommand) {
                updateTestCommand(editingCommand.id, cmd);
              } else {
                addTestCommand(cmd);
              }
              setShowCommandManager(false);
              setEditingCommand(null);
              setCommandForm({ name: '', command: '', description: '', category: 'testing' });
            }}
            onEdit={(cmd) => {
              if (cmd) {
                setEditingCommand(cmd);
                setCommandForm({
                  name: cmd.name,
                  command: cmd.command,
                  description: cmd.description || '',
                  category: cmd.category || 'testing'
                });
              } else {
                setEditingCommand(null);
                setCommandForm({ name: '', command: '', description: '', category: 'testing' });
              }
            }}
            onDelete={(id) => {
              if (window.confirm('Are you sure you want to delete this command?')) {
                deleteTestCommand(id);
                if (selectedTestCommand?.id === id) {
                  setSelectedTestCommand(null);
                }
              }
            }}
            onDuplicate={(id) => {
              duplicateTestCommand(id);
            }}
          />
        )}
      </div>
    );
  };

// 3. JOBS PAGE (Enhanced)
const JobsPage = ({ expandJobId, onExpandComplete, onEditJob }) => {
  const { 
    jobs, 
    startPendingJobs,
    stopAllJobs,
    moveJobUp,
    moveJobDown,
    stopFile, 
    moveFileUp, 
    moveFileDown, 
    updateJobTag, 
    exportJobToJSON,
    deleteJob,
    loading,
    errors
  } = useTestStore();
  const addToast = useTestStore((state) => state.addToast);
  
  const [expandedJobs, setExpandedJobs] = useState([]);
  const [editingTag, setEditingTag] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [testCasesView, setTestCasesView] = useState(null); // jobId ที่กำลังดู test cases
  const [testCasesFilter, setTestCasesFilter] = useState('all'); // 'all' | 'running' | 'completed' | 'pending' | 'failed'
  const [testCasesSearch, setTestCasesSearch] = useState('');
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [isStoppingAll, setIsStoppingAll] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState([]); // สำหรับเลือก batch ที่ต้องการ run
  const [dragStartIndex, setDragStartIndex] = useState(null); // สำหรับ drag selection
  const [isDragging, setIsDragging] = useState(false); // track ว่ากำลัง drag อยู่หรือไม่
  const [completedJobsFilter, setCompletedJobsFilter] = useState('all'); // 'today' | 'week' | 'month' | 'all'
  const [completedJobsSearch, setCompletedJobsSearch] = useState(''); // Search text
  const [completedJobsTagFilter, setCompletedJobsTagFilter] = useState(''); // Filter by tag
  const [completedJobsConfigFilter, setCompletedJobsConfigFilter] = useState(''); // Filter by config name
  
  const toggleJobExpanded = (jobId) => {
    setExpandedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };
  
  const handleStopAll = async () => {
    if (window.confirm('Are you sure you want to stop all running jobs?')) {
      if (isStoppingAll) return;
      setIsStoppingAll(true);
      const success = await stopAllJobs();
      setIsStoppingAll(false);
      if (success) {
        addToast({ type: 'success', message: 'All jobs stopped.' });
      } else {
        addToast({ type: 'error', message: 'Failed to stop all jobs.' });
      }
    }
  };

  const handleRunBatch = async () => {
    const pendingJobs = jobs.filter(j => j.status === 'pending');
    if (pendingJobs.length === 0) {
      addToast({ type: 'info', message: 'No pending jobs to run.' });
      return;
    }
    if (isRunningBatch) return;
    setIsRunningBatch(true);
    const success = await startPendingJobs();
    setIsRunningBatch(false);
    if (success) {
      addToast({ type: 'success', message: 'Batch started.' });
    } else {
      addToast({ type: 'error', message: 'Failed to start batch.' });
    }
  };

  // Functions สำหรับเลือก batch
  const toggleJobSelection = (jobId) => {
    setSelectedJobIds(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const toggleSelectAllJobs = () => {
    if (selectedJobIds.length === jobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(jobs.map(j => j.id));
    }
  };

  // Functions สำหรับ drag selection (deprecated - ใช้ onClick แทน)
  // เก็บไว้เพื่อ backward compatibility แต่ไม่ได้ใช้แล้ว
  const handleMouseDown = (jobIndex) => {
    // ไม่ทำอะไร - ใช้ onClick แทน
  };

  const handleMouseEnter = (jobIndex) => {
    // ไม่ทำอะไร - ใช้ onClick แทน
  };

  const handleMouseUp = () => {
    // ไม่ทำอะไร - ใช้ onClick แทน
  };

  const handleRunSelectedJobs = async () => {
    if (selectedJobIds.length === 0) {
      addToast({ type: 'warning', message: 'Please select at least one batch to run.' });
      return;
    }
    
    const selectedJobs = jobs.filter(j => selectedJobIds.includes(j.id));
    const pendingSelectedJobs = selectedJobs.filter(j => j.status === 'pending');
    
    if (pendingSelectedJobs.length === 0) {
      addToast({ type: 'info', message: 'No pending jobs in selected batches.' });
      return;
    }

    if (isRunningBatch) return;
    setIsRunningBatch(true);

    try {
      // Import startJob from api
      const api = await import('./services/api');
      
      // Start all selected pending jobs
      await Promise.allSettled(pendingSelectedJobs.map((job) => api.startJob(job.id)));
      
      // Refresh jobs list
      const { refreshJobs } = useTestStore.getState();
      await refreshJobs();
      
      addToast({ type: 'success', message: `Started ${pendingSelectedJobs.length} selected batch(es).` });
      setSelectedJobIds([]); // Clear selection after running
    } catch (error) {
      console.error('Failed to start selected jobs', error);
      addToast({ type: 'error', message: 'Failed to start selected batches.' });
    } finally {
      setIsRunningBatch(false);
    }
  };
  
  const handleEditTag = (job) => {
    setEditingTag(job.id);
    setTagInput(job.tag || '');
  };
  
  const handleSaveTag = (jobId) => {
    updateJobTag(jobId, tagInput);
    setEditingTag(null);
    setTagInput('');
  };
  
  const handleCancelTag = () => {
    setEditingTag(null);
    setTagInput('');
  };

  // delete job function

  const handleDeleteJob = async (jobId, jobName) => {
    if (!window.confirm(`Are you sure you want to delete batch #${jobId}?\n\nJob: ${jobName || 'N/A'}\n\nThis action cannot be undone.`)) {
      return;
    }
    
    const success = await deleteJob(jobId);
    if (success) {
      addToast({ type: 'success', message: `Batch #${jobId} deleted successfully.` });
    } else {
      addToast({ type: 'error', message: `Failed to delete batch #${jobId}.` });
    }
  };

  const handleDeleteSelectedJobs = async () => {
    if (selectedJobIds.length === 0) {
      addToast({ type: 'warning', message: 'Please select at least one batch to delete.' });
      return;
    }

    const selectedJobs = jobs.filter(j => selectedJobIds.includes(j.id));
    const jobNames = selectedJobs.map(j => `#${j.id} (${j.name || 'N/A'})`).join('\n');
    
    if (!window.confirm(`Are you sure you want to delete ${selectedJobIds.length} batch(es)?\n\n${jobNames}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const api = await import('./services/api');
      await Promise.allSettled(selectedJobIds.map((jobId) => api.deleteJob(jobId)));
      
      const { refreshJobs } = useTestStore.getState();
      await refreshJobs();
      
      addToast({ type: 'success', message: `Deleted ${selectedJobIds.length} batch(es) successfully.` });
      setSelectedJobIds([]); // Clear selection after deleting
    } catch (error) {
      console.error('Failed to delete selected jobs', error);
      addToast({ type: 'error', message: 'Failed to delete selected batches.' });
    }
  };
  
  // Sort files by order
  const getSortedFiles = (job) => {
    if (!job.files || job.files.length === 0) return [];
    return [...job.files].sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // Helper function to get job date for sorting (newest first)
  const getJobDate = (job) => {
    // สำหรับ pending/running: ใช้ createdAt หรือ startedAt (ใหม่สุด)
    // สำหรับ completed: ใช้ completedAt หรือ startedAt
    if (job.status === 'completed' || job.status === 'stopped') {
      // Completed jobs: ใช้ completedAt ก่อน
      if (job.completedAt) return new Date(job.completedAt);
      if (job.startedAt) return new Date(job.startedAt);
    } else {
      // Running/Pending jobs: ใช้ createdAt ก่อน (เวลาที่สร้าง)
      if (job.createdAt) return new Date(job.createdAt);
      if (job.startedAt) return new Date(job.startedAt);
    }
    // Fallback: ใช้เวลาปัจจุบันสำหรับ pending jobs ที่ไม่มี createdAt
    return new Date();
  };

  // Sort all jobs by date (newest first)
  const sortedAllJobs = [...jobs].sort((a, b) => {
    const dateA = getJobDate(a);
    const dateB = getJobDate(b);
    return dateB - dateA; // newest first
  });

  // แบ่ง jobs เป็น Running และ Completed (เรียงตาม date แล้ว)
  const runningJobs = sortedAllJobs
    .filter(j => j.status === 'running' || j.status === 'pending')
    .sort((a, b) => {
      // Sort running jobs by date (newest first)
      const dateA = getJobDate(a);
      const dateB = getJobDate(b);
      return dateB - dateA;
    });
  
  // Filter completed jobs by date, search, tag, and config name
  const filterCompletedJobs = (jobsList) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    let filtered = jobsList.filter(job => {
      // Filter by date
      const jobDate = getJobDate(job);
      let dateMatch = true;
      switch (completedJobsFilter) {
        case 'today':
          dateMatch = jobDate >= today;
          break;
        case 'week':
          dateMatch = jobDate >= weekAgo;
          break;
        case 'month':
          dateMatch = jobDate >= monthAgo;
          break;
        case 'all':
        default:
          dateMatch = true;
      }
      if (!dateMatch) return false;

      // Filter by tag
      if (completedJobsTagFilter) {
        const jobTag = (job.tag || '').toLowerCase();
        const filterTag = completedJobsTagFilter.toLowerCase();
        if (!jobTag.includes(filterTag)) return false;
      }

      // Filter by config name
      if (completedJobsConfigFilter) {
        const jobConfig = (job.configName || '').toLowerCase();
        const filterConfig = completedJobsConfigFilter.toLowerCase();
        if (!jobConfig.includes(filterConfig)) return false;
      }

      // Search in name, id, firmware, boards
      if (completedJobsSearch) {
        const searchLower = completedJobsSearch.toLowerCase();
        const nameMatch = (job.name || '').toLowerCase().includes(searchLower);
        const idMatch = (job.id || '').toLowerCase().includes(searchLower);
        const firmwareMatch = (job.firmware || '').toLowerCase().includes(searchLower);
        const boardsMatch = (job.boards || []).some(b => b.toLowerCase().includes(searchLower));
        const tagMatch = (job.tag || '').toLowerCase().includes(searchLower);
        const configMatch = (job.configName || '').toLowerCase().includes(searchLower);
        
        if (!nameMatch && !idMatch && !firmwareMatch && !boardsMatch && !tagMatch && !configMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort by date (newest first)
      const dateA = getJobDate(a);
      const dateB = getJobDate(b);
      return dateB - dateA;
    });

    return filtered;
  };

  const allCompletedJobs = sortedAllJobs.filter(j => j.status === 'completed' || j.status === 'stopped');
  const completedJobs = filterCompletedJobs(allCompletedJobs);

  // Get unique tags and config names for filter dropdowns
  const uniqueTags = [...new Set(allCompletedJobs.map(j => j.tag).filter(Boolean))].sort();
  const uniqueConfigNames = [...new Set(allCompletedJobs.map(j => j.configName).filter(Boolean))].sort();

  // Component สำหรับ render job card (ใช้ซ้ำได้)
  const renderJobCard = (job, jobIndex, allJobs) => {
    const sortedFiles = getSortedFiles(job);
    const isExpanded = expandedJobs.includes(job.id);
    const runningFiles = sortedFiles.filter(f => f.status === 'running');
    
    return (
      <div 
        key={job.id} 
        id={`job-${job.id}`} 
        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
          selectedJobIds.includes(job.id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
        }`}
        onClick={(e) => {
          // ไม่ toggle selection ถ้าคลิกที่ button, input, checkbox, หรือ element ที่มี stopPropagation
          if (e.target.closest('button') || 
              e.target.closest('input') || 
              e.target.closest('select') ||
              e.target.closest('[data-no-select]')) {
            return;
          }
          // Toggle selection เมื่อคลิกที่พื้นที่ว่าง
          toggleJobSelection(job.id);
        }}
      >
        {/* Job Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col gap-4">
            {/* Top Row: Batch Info */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0" data-no-select>
                <div className="flex items-center gap-3 mb-2 flex-wrap" data-no-select>
                  {/* Checkbox for selection */}
                  <input
                    type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleJobSelection(job.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    title="Select this batch"
                  />
                  <h3 className="text-xl font-bold text-slate-800">Batch #{job.id}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase shrink-0 ${
                    job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    job.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {job.status}
                  </span>
                  {job.tag && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 flex items-center gap-1 shrink-0">
                      <Tag size={12} />
                      {job.tag}
                    </span>
                  )}
                </div>
                <p className="text-slate-600 mb-3">{job.name}</p>
                <div className="flex items-center gap-6 text-sm text-slate-500 flex-wrap">
                  <span>Firmware: <strong className="text-slate-700">{job.firmware}</strong></span>
                  <span>Boards: <strong className="text-slate-700">{job.boards?.join(', ')}</strong></span>
                  <span>Progress: <strong className="text-slate-700">{job.progress}%</strong></span>
                  <span>Files: <strong className="text-slate-700">{job.completedFiles}/{job.totalFiles}</strong></span>
                  {/* Date Badge */}
                  {(job.completedAt || job.startedAt) && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-semibold">
                      {(() => {
                        const date = job.completedAt ? new Date(job.completedAt) : new Date(job.startedAt);
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const jobDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        
                        if (jobDate.getTime() === today.getTime()) {
                          return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
                        } else {
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
                        }
                      })()}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Move Buttons */}
              <div className="flex flex-col gap-1 shrink-0" data-no-select>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    moveJobUp(job.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={jobIndex === 0}
                  className={`p-2 rounded-lg border text-slate-600 ${jobIndex === 0 ? 'opacity-30 cursor-not-allowed border-slate-200' : 'hover:bg-slate-50 border-slate-200'}`}
                  title="Move batch up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    moveJobDown(job.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={jobIndex === allJobs.length - 1}
                  className={`p-2 rounded-lg border text-slate-600 ${jobIndex === allJobs.length - 1 ? 'opacity-30 cursor-not-allowed border-slate-200' : 'hover:bg-slate-50 border-slate-200'}`}
                  title="Move batch down"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
            
            {/* Bottom Row: Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap" data-no-select>
              {editingTag === job.id ? (
                <div className="flex items-center gap-2 flex-wrap" data-no-select>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      e.stopPropagation();
                      setTagInput(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Enter tag/group"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') handleSaveTag(job.id);
                      if (e.key === 'Escape') handleCancelTag();
                    }}
                    autoFocus
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSaveTag(job.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleCancelTag();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEditTag(job);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-1 shrink-0"
                  >
                    <Tag size={14} />
                    {job.tag ? 'Edit Tag' : 'Add Tag'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      exportJobToJSON(job.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-200 transition-all flex items-center gap-1 shrink-0"
                  >
                    <FileJson size={14} />
                    Export JSON
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleJobExpanded(job.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all shrink-0"
                  >
                    {isExpanded ? 'Hide Files' : 'Show Files'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setTestCasesView(testCasesView === job.id ? null : job.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Eye size={14} />
                    {testCasesView === job.id ? 'Hide Progress' : 'View Progress'}
                  </button>
                  {onEditJob && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onEditJob(job.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shrink-0"
                      title="Edit this batch - Load pairs table for editing"
                    >
                      <Pencil size={14} />
                      Edit Batch
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteJob(job.id, job.name);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all flex items-center gap-1.5 shrink-0"
                    title="Delete this batch"
                  >
                    <XCircle size={14} />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-1000" 
                style={{ width: `${job.progress}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* Test Cases Progress View */}
        {testCasesView === job.id && (
          <TestCasesProgressView
            job={job}
            files={sortedFiles}
            filter={testCasesFilter}
            search={testCasesSearch}
            onFilterChange={setTestCasesFilter}
            onSearchChange={setTestCasesSearch}
            onStopFile={(fileId) => stopFile(job.id, fileId)}
          />
        )}
        
        {/* Files/Test Cases List (Expandable) */}
        {isExpanded && (
          <div className="p-6 bg-slate-50">
            <h4 className="text-sm font-bold text-slate-600 uppercase mb-4">Test Cases in Batch (Sorted by Order)</h4>
            <p className="text-xs text-slate-500 mb-4">Note: Each file = 1 test case</p>
            {sortedFiles.length > 0 ? (
              <>
                {/* Failed Files Alert */}
                {sortedFiles.filter(f => f.result === 'fail' || f.status === 'error').length > 0 && (
                  <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={20} className="text-red-600" />
                        <h5 className="font-bold text-red-800">
                          Failed Test Cases ({sortedFiles.filter(f => f.result === 'fail' || f.status === 'error').length})
                        </h5>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const failedFiles = sortedFiles.filter(f => f.result === 'fail' || f.status === 'error');
                          const errorReport = `Failed Test Cases Report - Batch #${job.id}
Generated: ${new Date().toISOString()}
========================================

Job Information:
- Job ID: ${job.id}
- Job Name: ${job.name || 'N/A'}
- Tag: ${job.tag || 'Untagged'}
- Firmware: ${job.firmware || 'N/A'}
- Boards: ${job.boards?.join(', ') || 'N/A'}

Failed Test Cases Summary:
Total Failed: ${failedFiles.length} out of ${sortedFiles.length} test cases

Failed Test Cases Details:
${failedFiles.map((file, idx) => `
[${idx + 1}] ${file.name || 'N/A'}
    Order: ${file.order || 0}
    Status: ${file.status || 'unknown'}
    Result: ${file.result || 'N/A'}
    Error: ${file.errorMessage || file.error || 'No error message available'}
    Started: ${file.startedAt || 'N/A'}
    Completed: ${file.completedAt || 'N/A'}
`).join('\n')}

Recommendations:
1. Review error messages for each failed test case
2. Check hardware connections and firmware compatibility
3. Verify test case configurations
4. Download individual error logs for detailed analysis
`;
                          const blob = new Blob([errorReport], { type: 'text/plain;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `failed_tests_report_batch_${job.id}_${new Date().toISOString().split('T')[0]}.txt`;
                          link.click();
                          URL.revokeObjectURL(url);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center gap-1"
                      >
                        <Download size={14} />
                        Download All Error Logs
                      </button>
                    </div>
                    <p className="text-sm text-red-700">
                      The following test cases failed or encountered errors. Click "Error Log" on each failed test case to download detailed error information.
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  {sortedFiles.map((file, index) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      jobId={job.id}
                      job={job}
                      index={index}
                      totalFiles={sortedFiles.length}
                      onStop={() => stopFile(job.id, file.id)}
                      onMoveUp={() => moveFileUp(job.id, file.id)}
                      onMoveDown={() => moveFileDown(job.id, file.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>No files in this batch</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  return (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
        <div>
      <h1 className="text-3xl font-bold">Job Management</h1>
          <p className="text-slate-500 mt-1">Manage and monitor all test jobs</p>
        </div>
      <div className="flex gap-3 items-center">
        {/* Select All Checkbox */}
        {jobs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              checked={selectedJobIds.length === jobs.length && jobs.length > 0}
              onChange={toggleSelectAllJobs}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              title="Select all batches"
            />
            <span className="text-sm font-semibold text-slate-700">
              {selectedJobIds.length > 0 ? `${selectedJobIds.length} selected` : 'Select All'}
            </span>
          </div>
        )}
        
        {/* Run Selected Button */}
        {selectedJobIds.length > 0 && (
          <button
            onClick={handleRunSelectedJobs}
            disabled={isRunningBatch}
            className={`bg-blue-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${isRunningBatch ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-600'}`}
          >
            <Play size={18} />
            {isRunningBatch ? 'Starting...' : `Run Selected (${selectedJobIds.length})`}
          </button>
        )}
        
        {/* Run All Pending Button */}
        <button
          onClick={handleRunBatch}
          disabled={isRunningBatch}
          className={`bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${isRunningBatch ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-600'}`}
        >
          <PlayCircle size={18} />
          {isRunningBatch ? 'Starting...' : 'Run All Pending'}
        </button>
        
        {/* Stop All Button */}
        <button 
          onClick={handleStopAll}
          disabled={isStoppingAll}
          className={`bg-red-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${isStoppingAll ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-600'}`}
        >
          <Square size={18} />
          {isStoppingAll ? 'Stopping...' : 'Stop All'}
        </button>

        {/* Delete Selected Button */}
        {selectedJobIds.length > 0 && (
          <button
            onClick={handleDeleteSelectedJobs}
            className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 hover:bg-red-700"
            title={`Delete ${selectedJobIds.length} selected batch(es)`}
          >
            <XCircle size={18} />
            Delete Selected ({selectedJobIds.length})
          </button>
        )}
      </div>
    </div>
      
      {(loading?.jobs || errors?.jobs) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          errors?.jobs ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {errors?.jobs ? `Failed to load jobs: ${errors.jobs}` : 'Loading jobs...'}
        </div>
      )}

      {(!loading?.jobs && !errors?.jobs && jobs.length === 0) && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500">
          No jobs yet
        </div>
      )}

      {/* 2 Columns Layout: Running (Left) | Completed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Running Jobs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-bold text-slate-800">Running</h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                {runningJobs.length}
              </span>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {runningJobs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-400">
                <p>No running jobs</p>
              </div>
            ) : (
              runningJobs.map((job, index) => {
                const originalIndex = jobs.findIndex(j => j.id === job.id);
                return renderJobCard(job, originalIndex, runningJobs);
              })
            )}
          </div>
        </div>

        {/* Right Column: Completed Jobs */}
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <h2 className="text-xl font-bold text-slate-800">Completed</h2>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
                  {completedJobs.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={completedJobsFilter}
                  onChange={(e) => setCompletedJobsFilter(e.target.value)}
                  className="px-3 py-1.5 border border-emerald-300 rounded-lg text-sm font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  title="Filter completed jobs by date"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={completedJobsSearch}
                onChange={(e) => setCompletedJobsSearch(e.target.value)}
                placeholder="Search by name, ID, firmware, boards..."
                className="w-full pl-10 pr-4 py-2 border border-emerald-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filters: Tag and Config Name */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={completedJobsTagFilter}
                onChange={(e) => setCompletedJobsTagFilter(e.target.value)}
                className="flex-1 min-w-[150px] px-3 py-2 border border-emerald-300 rounded-lg text-sm font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                title="Filter by tag"
              >
                <option value="">All Tags</option>
                {uniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <select
                value={completedJobsConfigFilter}
                onChange={(e) => setCompletedJobsConfigFilter(e.target.value)}
                className="flex-1 min-w-[150px] px-3 py-2 border border-emerald-300 rounded-lg text-sm font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                title="Filter by config name"
              >
                <option value="">All Configs</option>
                {uniqueConfigNames.map(config => (
                  <option key={config} value={config}>{config}</option>
                ))}
              </select>
              {(completedJobsSearch || completedJobsTagFilter || completedJobsConfigFilter) && (
                <button
                  onClick={() => {
                    setCompletedJobsSearch('');
                    setCompletedJobsTagFilter('');
                    setCompletedJobsConfigFilter('');
                  }}
                  className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition-all flex items-center gap-1"
                  title="Clear all filters"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {completedJobs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-400">
                <p>No completed jobs</p>
              </div>
            ) : (
              completedJobs.map((job, index) => {
                const originalIndex = jobs.findIndex(j => j.id === job.id);
                return renderJobCard(job, originalIndex, completedJobs);
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. FLEET MANAGER PAGE (Enhanced)
const BoardsPage = () => {
  const {
    boards,
    fleetViewMode,
    fleetFilters,
    selectedBoards,
    setFleetViewMode,
    setFleetFilter,
    toggleBoardSelection,
    selectAllBoards,
    clearBoardSelection,
    runBoardBatchAction,
    deleteBoards,
    loading,
    errors
  } = useTestStore();
  const addToast = useTestStore((state) => state.addToast);
  
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSSH, setShowSSH] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isBatchActionRunning, setIsBatchActionRunning] = useState(false);
  
  // Filter boards
  const filteredBoards = boards.filter(board => {
    if (fleetFilters.status && board.status !== fleetFilters.status) return false;
    if (fleetFilters.model && board.model !== fleetFilters.model) return false;
    if (fleetFilters.firmware && board.firmware !== fleetFilters.firmware) return false;
    return true;
  });
  
  // Get unique values for filters
  const uniqueStatuses = [...new Set(boards.map(b => b.status))];
  const uniqueModels = [...new Set(boards.map(b => b.model))];
  const uniqueFirmwares = [...new Set(boards.map(b => b.firmware))];
  
  const handleBoardClick = (board) => {
    setSelectedBoard(board);
    setShowDetails(true);
  };
  
  const handleRightClick = (e, board) => {
    e.preventDefault();
    if (selectedBoards.includes(board.id)) {
      setContextMenu({ x: e.clientX, y: e.clientY, boards: selectedBoards });
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, boards: [board.id] });
    }
    setShowContextMenu(true);
  };
  
  const handleBatchAction = async (action) => {
    const targetBoards = contextMenu?.boards || selectedBoards;
    if (targetBoards.length === 0) {
      addToast({ type: 'warning', message: 'No boards selected.' });
      return;
    }

    if (action === 'Update Firmware') {
      const firmwareVersion = window.prompt('Enter firmware version to apply:');
      if (!firmwareVersion) {
        return;
      }
      if (isBatchActionRunning) return;
      setIsBatchActionRunning(true);
      const response = await runBoardBatchAction(targetBoards, 'updateFirmware', { firmwareVersion });
      setIsBatchActionRunning(false);
      if (response) {
        addToast({ type: 'success', message: 'Firmware update queued.' });
      } else {
        addToast({ type: 'error', message: 'Failed to update firmware.' });
      }
    } else if (action === 'Self-Test') {
      if (isBatchActionRunning) return;
      setIsBatchActionRunning(true);
      const response = await runBoardBatchAction(targetBoards, 'selfTest');
      setIsBatchActionRunning(false);
      if (response) {
        addToast({ type: 'success', message: 'Self-test started.' });
      } else {
        addToast({ type: 'error', message: 'Failed to start self-test.' });
      }
    } else {
      if (isBatchActionRunning) return;
      setIsBatchActionRunning(true);
      const response = await runBoardBatchAction(targetBoards, 'reboot');
      setIsBatchActionRunning(false);
      if (response) {
        addToast({ type: 'success', message: 'Reboot started.' });
      } else {
        addToast({ type: 'error', message: 'Failed to reboot boards.' });
      }
    }
    setShowContextMenu(false);
    setContextMenu(null);
  };
  
  const hasBoardError = errors?.boards;
  const isBoardsLoading = loading?.boards;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fleet Manager</h1>
          <p className="text-slate-500 mt-1">Manage {boards.length} boards across the facility</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddBoard(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            + Add Board
          </button>
          <button
            onClick={() => setFleetViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${
              fleetViewMode === 'grid' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Grid3x3 size={20} />
          </button>
          <button
            onClick={() => setFleetViewMode('list')}
            className={`p-2 rounded-lg transition-all ${
              fleetViewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <List size={20} />
          </button>
        </div>
      </div>
      
      {/* Smart Filtering */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <span className="text-sm font-bold text-slate-600">Filters:</span>
        </div>
        
        <select
          value={fleetFilters.status || ''}
          onChange={(e) => setFleetFilter('status', e.target.value || null)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          {uniqueStatuses.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        
        <select
          value={fleetFilters.model || ''}
          onChange={(e) => setFleetFilter('model', e.target.value || null)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Models</option>
          {uniqueModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        
        <select
          value={fleetFilters.firmware || ''}
          onChange={(e) => setFleetFilter('firmware', e.target.value || null)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Firmware</option>
          {uniqueFirmwares.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        
        {(fleetFilters.status || fleetFilters.model || fleetFilters.firmware) && (
          <button
            onClick={() => {
              setFleetFilter('status', null);
              setFleetFilter('model', null);
              setFleetFilter('firmware', null);
            }}
            className="text-xs text-red-600 font-bold hover:text-red-800"
          >
            Clear Filters
          </button>
        )}
        
        {selectedBoards.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-slate-600 font-bold">
              {selectedBoards.length} selected
            </span>
            <button
              onClick={clearBoardSelection}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
        )}
          </div>
      
      {/* Batch Actions Bar */}
      {selectedBoards.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-blue-900">
            {selectedBoards.length} board(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!window.confirm(`Delete ${selectedBoards.length} board(s)?`)) return;
                if (isDeletingSelected) return;
                setIsDeletingSelected(true);
                const success = await deleteBoards(selectedBoards);
                setIsDeletingSelected(false);
                if (success) {
                  addToast({ type: 'success', message: 'Boards deleted successfully.' });
                } else {
                  addToast({ type: 'error', message: 'Failed to delete boards.' });
                }
              }}
              disabled={isDeletingSelected}
              className={`px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-bold text-red-700 transition-all ${isDeletingSelected ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-100'}`}
            >
              <XCircle size={16} className="inline mr-2" />
              {isDeletingSelected ? 'Deleting...' : 'Delete Selected'}
            </button>
            <button
              onClick={() => handleBatchAction('Reboot')}
              disabled={isBatchActionRunning}
              className={`px-4 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 transition-all ${isBatchActionRunning ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-100'}`}
            >
              <RefreshCw size={16} className="inline mr-2" />
              Reboot Selected
            </button>
            <button
              onClick={() => handleBatchAction('Update Firmware')}
              disabled={isBatchActionRunning}
              className={`px-4 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 transition-all ${isBatchActionRunning ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-100'}`}
            >
              <Download size={16} className="inline mr-2" />
              Update Firmware
            </button>
            <button
              onClick={() => handleBatchAction('Self-Test')}
              disabled={isBatchActionRunning}
              className={`px-4 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 transition-all ${isBatchActionRunning ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-100'}`}
            >
              <Activity size={16} className="inline mr-2" />
              Self-Test
            </button>
        </div>
        </div>
      )}

      {(isBoardsLoading || hasBoardError) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          hasBoardError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {hasBoardError ? `Failed to load boards: ${hasBoardError}` : 'Loading boards...'}
        </div>
      )}

      {(!isBoardsLoading && !hasBoardError && filteredBoards.length === 0) && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500">
          No boards found
        </div>
      )}
      
      {/* View Content */}
      {fleetViewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBoards.map(board => (
            <BoardCard
              key={board.id}
              board={board}
              selected={selectedBoards.includes(board.id)}
              onSelect={() => toggleBoardSelection(board.id)}
              onClick={() => handleBoardClick(board)}
              onRightClick={(e) => handleRightClick(e, board)}
            />
      ))}
    </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedBoards.length === filteredBoards.length && filteredBoards.length > 0}
                    onChange={selectedBoards.length === filteredBoards.length ? clearBoardSelection : selectAllBoards}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Board</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">MAC Address</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Model</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Firmware</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
              {filteredBoards.map(board => (
                <BoardTableRow
                  key={board.id}
                  board={board}
                  selected={selectedBoards.includes(board.id)}
                  onSelect={() => toggleBoardSelection(board.id)}
                  onClick={() => handleBoardClick(board)}
                  onSSHClick={() => {
                    setSelectedBoard(board);
                    setShowSSH(true);
                  }}
                />
              ))}
        </tbody>
      </table>
    </div>
      )}
      
      {/* Context Menu */}
      {showContextMenu && contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowContextMenu(false);
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-2 min-w-[200px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={async () => {
                const targetBoards = contextMenu?.boards || [];
                if (targetBoards.length === 0) return;
                if (!window.confirm(`Delete ${targetBoards.length} board(s)?`)) return;
                if (isDeletingSelected) return;
                setIsDeletingSelected(true);
                const success = await deleteBoards(targetBoards);
                setIsDeletingSelected(false);
                if (success) {
                  addToast({ type: 'success', message: 'Boards deleted successfully.' });
                } else {
                  addToast({ type: 'error', message: 'Failed to delete boards.' });
                }
                setShowContextMenu(false);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-700 flex items-center gap-2"
            >
              <XCircle size={16} />
              Delete Selected
            </button>
            <button
              onClick={() => handleBatchAction('Reboot Selected')}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Reboot Selected
            </button>
            <button
              onClick={() => handleBatchAction('Update Firmware')}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
            >
              <Download size={16} />
              Update Firmware
            </button>
            <button
              onClick={() => handleBatchAction('Self-Test')}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
            >
              <Activity size={16} />
              Self-Test
            </button>
          </div>
        </>
      )}
      
      {/* Device Details Side Panel */}
      {showDetails && selectedBoard && (
        <DeviceDetailsPanel
          board={selectedBoard}
          onClose={() => {
            setShowDetails(false);
            setSelectedBoard(null);
          }}
          onSSHClick={() => {
            setShowDetails(false);
            setShowSSH(true);
          }}
        />
      )}
      
      {/* WebSSH Terminal */}
      {showSSH && selectedBoard && (
        <WebSSHTerminal
          board={selectedBoard}
          onClose={() => {
            setShowSSH(false);
            setSelectedBoard(null);
          }}
        />
      )}

      {showAddBoard && (
        <AddBoardModal onClose={() => setShowAddBoard(false)} />
      )}
  </div>
);
};

// 5. HISTORY PAGE
const HistoryPage = ({ onViewJob }) => {
  const { jobs, exportJobToJSON, exportAllFailedLogs, loading, errors } = useTestStore();
  const [downloadMenuOpen, setDownloadMenuOpen] = useState({});
  
  // Filter completed jobs
  const completedJobs = jobs.filter(job => job.status === 'completed');

  if (loading?.jobs) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-6 text-blue-700">
        Loading history...
      </div>
    );
  }

  if (errors?.jobs) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-red-700">
        Failed to load history: {errors.jobs}
      </div>
    );
  }

  if (completedJobs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500">
        No completed jobs yet
      </div>
    );
  }
  
  // Helper to check if a job has failed files
  const hasFailedFiles = (job) => {
    return (job.files || []).some(f => f.result === 'fail' || f.status === 'error');
  };
  
  // Helper to count failed files
  const getFailedFilesCount = (job) => {
    return (job.files || []).filter(f => f.result === 'fail' || f.status === 'error').length;
  };
  
  // Helper to format duration (mock for now)
  const formatDuration = (job) => {
    // Mock duration calculation - in real app, calculate from startedAt/endedAt
    return '1h 22m';
  };
  
  // Helper to format date (mock for now)
  const formatDate = (job) => {
    // Mock date - in real app, use job.completedAt or job.endedAt
    return 'Jan 12, 2026';
  };
  
  // Export functions for different formats
  const exportToCSV = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const headers = ['Test Case', 'Order', 'Status', 'Result', 'Board', 'Firmware'];
    const rows = (job.files || []).map(file => [
      file.name || 'N/A',
      file.order || 0,
      file.status || 'unknown',
      file.result || 'N/A',
      job.boards?.join(', ') || 'N/A',
      job.firmware || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_${jobId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const exportToHTML = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Report - Batch ${jobId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    .info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .info-item { padding: 10px; background: #f8fafc; border-radius: 4px; }
    .info-label { font-weight: bold; color: #64748b; font-size: 12px; }
    .info-value { color: #1e293b; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #3b82f6; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    tr:hover { background: #f8fafc; }
    .status-completed { color: #10b981; font-weight: bold; }
    .status-running { color: #3b82f6; font-weight: bold; }
    .status-failed { color: #ef4444; font-weight: bold; }
    .status-pending { color: #f59e0b; font-weight: bold; }
    .result-pass { color: #10b981; }
    .result-fail { color: #ef4444; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report - Batch #${jobId}</h1>
    <div class="info">
      <div class="info-item">
        <div class="info-label">Test Name</div>
        <div class="info-value">${job.name || 'N/A'}</div>
          </div>
      <div class="info-item">
        <div class="info-label">Tag</div>
        <div class="info-value">${job.tag || 'Untagged'}</div>
          </div>
      <div class="info-item">
        <div class="info-label">Firmware</div>
        <div class="info-value">${job.firmware || 'N/A'}</div>
        </div>
      <div class="info-item">
        <div class="info-label">Boards</div>
        <div class="info-value">${job.boards?.join(', ') || 'N/A'}</div>
    </div>
      <div class="info-item">
        <div class="info-label">Progress</div>
        <div class="info-value">${job.progress}% (${job.completedFiles || 0}/${job.totalFiles || 0} files)</div>
  </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value">${job.status || 'unknown'}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Test Case</th>
          <th>Status</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${(job.files || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(file => `
        <tr>
          <td>${file.order || 0}</td>
          <td>${file.name || 'N/A'}</td>
          <td class="status-${file.status || 'pending'}">${file.status || 'pending'}</td>
          <td class="result-${file.result === 'pass' ? 'pass' : file.result === 'fail' ? 'fail' : ''}">${file.result || 'N/A'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="footer">
      Generated on ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_${jobId}_report_${new Date().toISOString().split('T')[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const exportToPDF = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    // Generate HTML content for PDF
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Report - Batch ${jobId}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
    }
    body { font-family: Arial, sans-serif; margin: 20px; background: white; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; }
    h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    .info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .info-item { padding: 10px; background: #f8fafc; border-radius: 4px; }
    .info-label { font-weight: bold; color: #64748b; font-size: 12px; }
    .info-value { color: #1e293b; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #3b82f6; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .status-completed { color: #10b981; font-weight: bold; }
    .status-running { color: #3b82f6; font-weight: bold; }
    .status-failed { color: #ef4444; font-weight: bold; }
    .status-pending { color: #f59e0b; font-weight: bold; }
    .result-pass { color: #10b981; }
    .result-fail { color: #ef4444; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report - Batch #${jobId}</h1>
    <div class="info">
      <div class="info-item">
        <div class="info-label">Test Name</div>
        <div class="info-value">${job.name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Tag</div>
        <div class="info-value">${job.tag || 'Untagged'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Firmware</div>
        <div class="info-value">${job.firmware || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Boards</div>
        <div class="info-value">${job.boards?.join(', ') || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Progress</div>
        <div class="info-value">${job.progress}% (${job.completedFiles || 0}/${job.totalFiles || 0} files)</div>
      </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value">${job.status || 'unknown'}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Test Case</th>
          <th>Status</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${(job.files || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(file => `
        <tr>
          <td>${file.order || 0}</td>
          <td>${file.name || 'N/A'}</td>
          <td class="status-${file.status || 'pending'}">${file.status || 'pending'}</td>
          <td class="result-${file.result === 'pass' ? 'pass' : file.result === 'fail' ? 'fail' : ''}">${file.result || 'N/A'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="footer">
      Generated on ${new Date().toLocaleString()}
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
    
    // Open in new window and trigger print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };
  
  const exportLogs = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const logContent = `Test Batch Log - Batch #${jobId}
Generated: ${new Date().toISOString()}
========================================

Batch Information:
- Name: ${job.name || 'N/A'}
- Tag: ${job.tag || 'Untagged'}
- Firmware: ${job.firmware || 'N/A'}
- Boards: ${job.boards?.join(', ') || 'N/A'}
- Status: ${job.status || 'unknown'}
- Progress: ${job.progress}% (${job.completedFiles || 0}/${job.totalFiles || 0} files)

Test Cases:
${(job.files || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map((file, idx) => `
[${idx + 1}] ${file.name || 'N/A'}
    Order: ${file.order || 0}
    Status: ${file.status || 'unknown'}
    Result: ${file.result || 'N/A'}
    ${file.status === 'completed' ? '✓ Completed' : file.status === 'running' ? '→ Running' : file.status === 'failed' ? '✗ Failed' : '○ Pending'}
`).join('\n')}

Summary:
- Total: ${job.totalFiles || 0} test cases
- Completed: ${(job.files || []).filter(f => f.status === 'completed').length}
- Running: ${(job.files || []).filter(f => f.status === 'running').length}
- Failed: ${(job.files || []).filter(f => f.result === 'fail').length}
- Pending: ${(job.files || []).filter(f => f.status === 'pending').length}
`;
    
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_${jobId}_logs_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const toggleDownloadMenu = (e, jobId) => {
    e.stopPropagation();
    setDownloadMenuOpen(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };
  
  const handleDownload = (e, jobId, format) => {
    e.stopPropagation();
    setDownloadMenuOpen(prev => ({ ...prev, [jobId]: false }));
    
    switch(format) {
      case 'json':
        exportJobToJSON(jobId);
        break;
      case 'csv':
        exportToCSV(jobId);
        break;
      case 'html':
        exportToHTML(jobId);
        break;
      case 'pdf':
        exportToPDF(jobId);
        break;
      case 'log':
        exportLogs(jobId);
        break;
      case 'failed':
        exportAllFailedLogs(jobId);
        break;
      default:
        exportJobToJSON(jobId);
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.download-menu-container')) {
        setDownloadMenuOpen({});
      }
    };
    
    if (Object.keys(downloadMenuOpen).length > 0) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [downloadMenuOpen]);
  
  return (
  <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
    <h1 className="text-3xl font-bold">Test History</h1>
          <p className="text-slate-500 mt-1">View completed test batches and their results</p>
        </div>
        <div className="text-sm text-slate-500">
          {completedJobs.length} completed batch{completedJobs.length !== 1 ? 'es' : ''}
        </div>
      </div>
      
      {completedJobs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <History size={48} className="text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 font-bold">No completed jobs yet</p>
          <p className="text-slate-400 text-sm mt-2">Completed test batches will appear here</p>
        </div>
      ) : (
    <div className="space-y-4">
          {completedJobs.map(job => (
            <div 
              key={job.id} 
              onClick={() => onViewJob(job.id)}
              className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center hover:bg-slate-50 hover:border-blue-300 transition-all group cursor-pointer"
            >
          <div className="flex items-center gap-6">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
              hasFailedFiles(job) 
                ? 'bg-red-50 text-red-600' 
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {hasFailedFiles(job) ? (
                <AlertCircle size={28} />
              ) : (
                <CheckCircle2 size={28} />
              )}
            </div>
            <div>
                  <h4 className="font-bold text-slate-800 text-lg">Batch #{job.id} - {job.name}</h4>
                  <p className="text-slate-400 text-sm flex items-center gap-2">
                    <Clock size={14}/> {formatDate(job)} • {formatDuration(job)} duration
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-bold text-slate-600">
                      {job.completedFiles}/{job.totalFiles} files
                    </span>
                    {hasFailedFiles(job) && (
                      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle size={12} />
                        {getFailedFilesCount(job)} failed
                      </span>
                    )}
                    {job.tag && (
                      <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        {job.tag}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-600">
                      {job.firmware}
                    </span>
            </div>
          </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{job.progress}%</div>
                  <div className="text-xs text-slate-400">Completed</div>
                </div>
                {hasFailedFiles(job) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(e, job.id, 'failed');
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm"
                    title={`Download failed files report (${getFailedFilesCount(job)} failed)`}
                  >
                    <Download size={16} />
                    <span>Failed Files</span>
                    <span className="bg-red-700 px-1.5 py-0.5 rounded text-xs font-bold">
                      {getFailedFilesCount(job)}
                    </span>
                  </button>
                )}
                <div className="relative download-menu-container">
                  <button
                    onClick={(e) => toggleDownloadMenu(e, job.id)}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-all group-hover:bg-blue-50"
                    title="Download files"
                  >
                    <Download size={20} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </button>
                  
                  {downloadMenuOpen[job.id] && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-xl z-50 min-w-[200px]">
                      <div className="py-1">
                        <button
                          onClick={(e) => handleDownload(e, job.id, 'json')}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <FileJson size={16} className="text-blue-600" />
                          <span>Download JSON</span>
                        </button>
                        <button
                          onClick={(e) => handleDownload(e, job.id, 'csv')}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <FileCode size={16} className="text-green-600" />
                          <span>Download CSV</span>
                        </button>
                        <button
                          onClick={(e) => handleDownload(e, job.id, 'html')}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <FileCode size={16} className="text-purple-600" />
                          <span>Download HTML Report</span>
                        </button>
                        <button
                          onClick={(e) => handleDownload(e, job.id, 'pdf')}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <FileCode size={16} className="text-red-600" />
                          <span>Download PDF Report</span>
                        </button>
                        <button
                          onClick={(e) => handleDownload(e, job.id, 'log')}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <FileCode size={16} className="text-orange-600" />
                          <span>Download Logs</span>
                        </button>
                        {hasFailedFiles(job) && (
                          <>
                            <div className="border-t border-slate-200 my-1"></div>
                            <button
                              onClick={(e) => handleDownload(e, job.id, 'failed')}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600 font-semibold"
                            >
                              <AlertCircle size={16} className="text-red-600" />
                              <span>Download Failed Files ({getFailedFilesCount(job)})</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" size={20} />
              </div>
        </div>
      ))}
    </div>
      )}
  </div>
);
};

// --- HELPER COMPONENTS ---

const StatCard = ({ icon, label, value, sub }) => (
  <div className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-2.5 bg-slate-50 rounded-xl">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em]">{label}</div>
    <div className="text-[11px] text-slate-400 mt-1 italic">{sub}</div>
  </div>
);

const ActiveJobCard = ({ job, onClick }) => {
  return (
    <div 
      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-slate-700">Batch #{job.id}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              job.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {job.status}
            </span>
          </div>
          <div className="text-sm text-slate-600">{job.name}</div>
          <div className="text-xs text-slate-400 mt-1">
            {job.totalFiles} Files | {job.firmware} | Boards: {job.boards?.join(', ')}
          </div>
        </div>
        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
          {job.progress}%
        </span>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Progress: {job.completedFiles}/{job.totalFiles} files completed</span>
          <span>{job.progress}%</span>
    </div>
    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${job.progress}%` }}></div>
        </div>
      </div>
      <div className="text-xs text-slate-400 mt-2">
        ⏱ Started: {job.startedAt} | ETA: ~{Math.ceil((100 - job.progress) / 5)} min
    </div>
  </div>
);
};

const FileItem = ({ name, size }) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-300 transition-all cursor-pointer">
    <FileCode className="text-slate-400" size={18} />
    <div className="flex-1 overflow-hidden">
      <div className="text-sm font-bold truncate">{name}</div>
      <div className="text-[10px] text-slate-400 uppercase font-bold">{size}</div>
    </div>
  </div>
);

// Notification Bell Component with Dropdown
const NotificationBell = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, loading, errors } = useTestStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);
  
  return (
    <div className="relative" ref={notificationRef}>
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        )}
      </button>
      
      {/* Notification Dropdown */}
      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 max-h-[600px] flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  markAllNotificationsRead();
                }}
                className="text-xs text-blue-600 font-bold hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto max-h-[500px]">
            {loading?.notifications ? (
              <div className="p-8 text-center text-slate-400">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Loading notifications...</p>
              </div>
            ) : errors?.notifications ? (
              <div className="p-8 text-center text-red-600">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Failed to load notifications</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map(notif => (
                  <NotificationItem 
                    key={notif.id}
                    notification={notif}
                    onClick={() => {
                      markNotificationRead(notif.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationItem = ({ notification, onClick }) => {
  const getTypeColor = (type) => {
    switch(type) {
      case 'success': return 'bg-emerald-500';
      case 'error': return 'bg-red-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };
  
  return (
    <div 
      className={`flex gap-4 items-start p-3 rounded-lg border-b border-slate-100 cursor-pointer transition-all ${
        !notification.read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
      }`}
      onClick={onClick}
    >
      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${getTypeColor(notification.type)}`}></div>
    <div className="flex-1">
        <div className={`text-sm font-bold leading-none mb-1 ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
          {notification.title}
    </div>
        <div className="text-xs text-slate-500 mb-1">{notification.message}</div>
        <div className="text-[10px] text-slate-400 font-bold">{notification.time}</div>
      </div>
      {!notification.read && (
        <div className="h-2 w-2 bg-blue-500 rounded-full shrink-0 mt-1"></div>
      )}
  </div>
);
};

// File Row Component (for JobsPage)
// Test Cases Progress View Component
const TestCasesProgressView = ({ job, files, filter, search, onFilterChange, onSearchChange, onStopFile }) => {
  const runningFileRef = useRef(null);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  
  // Filter and search files
  const filteredFiles = files.filter(file => {
    // Status filter
    if (filter !== 'all' && file.status !== filter) return false;
    // Search filter - search in VCD, ERoM, ULP file names
    if (search) {
      const searchLower = search.toLowerCase();
      const vcdMatch = file.vcd?.toLowerCase().includes(searchLower);
      const eromMatch = file.erom?.toLowerCase().includes(searchLower);
      const ulpMatch = file.ulp?.toLowerCase().includes(searchLower);
      const nameMatch = file.name?.toLowerCase().includes(searchLower);
      if (!vcdMatch && !eromMatch && !ulpMatch && !nameMatch) return false;
    }
    return true;
  });
  
  // Statistics
  const stats = {
    total: files.length,
    completed: files.filter(f => f.status === 'completed').length,
    running: files.filter(f => f.status === 'running').length,
    pending: files.filter(f => f.status === 'pending').length,
    failed: files.filter(f => f.result === 'fail').length,
    stopped: files.filter(f => f.status === 'stopped').length
  };
  
  // Find current running test case
  const currentRunningIndex = filteredFiles.findIndex(f => f.status === 'running');
  
  // Auto-scroll to running test case
  useEffect(() => {
    if (currentRunningIndex >= 0 && runningFileRef.current) {
      setTimeout(() => {
        runningFileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [currentRunningIndex]);
  
  return (
    <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="p-6">
        {/* Header with Statistics */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity size={20} className="text-blue-600" />
              Test Cases Progress - {job.name}
            </h4>
            <button
              onClick={() => onFilterChange('all')}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear Filters
            </button>
          </div>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total</div>
              <div className="text-xl font-bold text-slate-800">{files.length}</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <div className="text-xs font-bold text-emerald-600 uppercase mb-1">Completed</div>
              <div className="text-xl font-bold text-emerald-700">{files.filter(f => f.status === 'completed').length}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
              <div className="text-xs font-bold text-blue-600 uppercase mb-1">Running</div>
              <div className="text-xl font-bold text-blue-700">{files.filter(f => f.status === 'running').length}</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
              <div className="text-xs font-bold text-yellow-600 uppercase mb-1">Pending</div>
              <div className="text-xl font-bold text-yellow-700">{files.filter(f => f.status === 'pending').length}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-xl border border-red-200">
              <div className="text-xs font-bold text-red-600 uppercase mb-1">Failed</div>
              <div className="text-xl font-bold text-red-700">{files.filter(f => f.result === 'fail').length}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-600 uppercase mb-1">Stopped</div>
              <div className="text-xl font-bold text-slate-700">{files.filter(f => f.status === 'stopped').length}</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Overall Progress</span>
              <span className="font-bold">{files.length > 0 ? Math.round((files.filter(f => f.status === 'completed').length / files.length) * 100) : 0}%</span>
            </div>
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500" 
                style={{ width: `${files.length > 0 ? (files.filter(f => f.status === 'completed').length / files.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
          
          {/* Search and Filter */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search test case by name..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="stopped">Stopped</option>
            </select>
            {/* Stop Selected Button */}
            {selectedFileIds.length > 0 && (
              <button
                onClick={async () => {
                  const runningSelected = filteredFiles.filter(f => 
                    selectedFileIds.includes(f.id) && (f.status === 'running' || f.status === 'pending')
                  );
                  if (runningSelected.length === 0) {
                    return;
                  }
                  if (window.confirm(`Stop ${runningSelected.length} selected test case(s)?`)) {
                    await Promise.all(runningSelected.map(file => onStopFile(file.id)));
                    setSelectedFileIds([]);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all flex items-center gap-2"
                title={`Stop ${selectedFileIds.length} selected test case(s)`}
              >
                <StopCircle size={16} />
                Stop Selected ({selectedFileIds.length})
              </button>
            )}
          </div>
        </div>
        
        {/* Test Cases List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Select All Header (if there are files) */}
          {filteredFiles.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFileIds.length === filteredFiles.length && filteredFiles.length > 0}
                  onChange={() => {
                    if (selectedFileIds.length === filteredFiles.length) {
                      setSelectedFileIds([]);
                    } else {
                      setSelectedFileIds(filteredFiles.map(f => f.id));
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Select all test cases"
                />
                <span className="text-xs font-semibold text-slate-600">
                  {selectedFileIds.length > 0 
                    ? `${selectedFileIds.length} of ${filteredFiles.length} selected`
                    : `Select All (${filteredFiles.length} test cases)`}
                </span>
              </div>
            </div>
          )}
          <div className="max-h-[600px] overflow-y-auto">
            {filteredFiles.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileCode size={48} className="mx-auto mb-4 opacity-50" />
                <p>No test cases found</p>
                {search && <p className="text-xs mt-2">Try adjusting your search or filter</p>}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredFiles.map((file, index) => {
                  const isRunning = file.status === 'running';
                  const fileIndex = files.findIndex(f => f.id === file.id);
                  return (
                    <div
                      key={file.id}
                      ref={isRunning ? runningFileRef : null}
                      className={`p-4 transition-all ${
                        isRunning 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : selectedFileIds.includes(file.id)
                          ? 'bg-blue-50/50 border-l-2 border-blue-300'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Checkbox for selection */}
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedFileIds(prev => 
                              prev.includes(file.id)
                                ? prev.filter(id => id !== file.id)
                                : [...prev, file.id]
                            );
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select this test case"
                        />
                        
                        {/* Order Number */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                          isRunning 
                            ? 'bg-blue-500 text-white animate-pulse' 
                            : file.status === 'completed'
                            ? 'bg-emerald-500 text-white'
                            : file.status === 'stopped'
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {file.order || fileIndex + 1}
                        </div>
                        
                        {/* File Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {/* VCD File */}
                            {file.vcd && (
                              <div className="flex items-center gap-1">
                                <FileCode size={18} className="text-blue-500" />
                                <span className="font-bold text-slate-800 text-sm">{file.vcd}</span>
                              </div>
                            )}
                            {/* ERoM File */}
                            {file.erom && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">+</span>
                                <FileCode size={16} className="text-orange-500" />
                                <span className="font-semibold text-slate-700 text-sm">{file.erom}</span>
                              </div>
                            )}
                            {/* ULP File */}
                            {file.ulp && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">+</span>
                                <FileCode size={16} className="text-purple-500" />
                                <span className="font-semibold text-slate-700 text-sm">{file.ulp}</span>
                              </div>
                            )}
                            {/* Fallback to file.name if no vcd/erom/ulp */}
                            {!file.vcd && !file.erom && !file.ulp && (
                              <>
                                <FileCode size={18} className="text-slate-400" />
                                <span className="font-bold text-slate-800">{file.name}</span>
                              </>
                            )}
                            {isRunning && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs font-bold animate-pulse">
                                RUNNING NOW
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            Test Case #{file.order || fileIndex + 1} of {files.length}
                            {file.try_count && file.try_count > 1 && ` • ${file.try_count} rounds`}
                          </div>
                        </div>
                        
                        {/* Status & Result */}
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border-2 ${
                            file.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                            file.status === 'running' ? 'bg-blue-100 text-blue-700 border-blue-400 animate-pulse' :
                            file.status === 'stopped' ? 'bg-red-100 text-red-700 border-red-300' :
                            file.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                            'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {file.status}
                          </span>
                          {file.result && (
                            <span className={`px-3 py-1 rounded text-xs font-bold ${
                              file.result === 'pass' ? 'bg-emerald-50 text-emerald-700' :
                              file.result === 'fail' ? 'bg-red-50 text-red-700' :
                              'bg-slate-50 text-slate-400'
                            }`}>
                              {file.result.toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        {/* Actions */}
                        {isRunning && (
                          <button
                            onClick={() => onStopFile(file.id)}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-all flex items-center gap-1"
                          >
                            <StopCircle size={14} />
                            Stop
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* Current Running Indicator */}
        {currentRunningIndex >= 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Activity size={16} className="text-blue-600 animate-pulse" />
              <span className="font-bold text-blue-700">
                Currently running: Test Case #{filteredFiles[currentRunningIndex].order || currentRunningIndex + 1} - {filteredFiles[currentRunningIndex].name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FileRow = ({ file, jobId, index, totalFiles, onStop, onMoveUp, onMoveDown, job }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'running': return 'bg-blue-100 text-blue-700';
      case 'stopped': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };
  
  const getResultColor = (result) => {
    if (result === 'pass') return 'bg-emerald-100 text-emerald-700';
    if (result === 'fail') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-400';
  };
  
  const isFailed = file.result === 'fail' || file.status === 'error';
  
  const exportErrorLog = (e) => {
    e.stopPropagation();
    const errorLogContent = `Error Log - Test Case Failure Report
Generated: ${new Date().toISOString()}
========================================

Test Case Information:
- File Name: ${file.name || 'N/A'}
- Order: ${file.order || index + 1}
- Status: ${file.status || 'unknown'}
- Result: ${file.result || 'N/A'}
- Job ID: ${jobId}
${job ? `- Job Name: ${job.name || 'N/A'}\n- Firmware: ${job.firmware || 'N/A'}\n- Boards: ${job.boards?.join(', ') || 'N/A'}` : ''}

Error Details:
${file.errorMessage || file.error || 'No detailed error message available. Test case failed during execution.'}

Execution Context:
- Test started at: ${file.startedAt || 'N/A'}
- Test completed at: ${file.completedAt || 'N/A'}
- Duration: ${file.duration || 'N/A'}

Possible Causes:
1. Test case logic error
2. Hardware connection issue
3. Firmware version mismatch
4. Test data corruption
5. Timeout during execution

Recommendations:
1. Check hardware connections
2. Verify firmware version compatibility
3. Review test case configuration
4. Check system logs for additional details
5. Re-run the test case after fixing issues

Additional Notes:
${file.notes || 'No additional notes available.'}
`;
    
    const blob = new Blob([errorLogContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeFileName = (file.name || `test_case_${index + 1}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `error_log_${jobId}_${safeFileName}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
      isFailed ? 'bg-red-50 border-red-200 hover:border-red-300' : 'bg-white border-slate-200 hover:border-blue-300'
    }`}>
      {/* Order Number */}
      <div className="flex flex-col items-center gap-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
          isFailed ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {file.order || index + 1}
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className={`p-1 rounded ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100'}`}
            title="Move Up"
          >
            <ArrowUp size={14} className="text-slate-600" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalFiles - 1}
            className={`p-1 rounded ${index === totalFiles - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100'}`}
            title="Move Down"
          >
            <ArrowDown size={14} className="text-slate-600" />
          </button>
        </div>
      </div>
      
      {/* File Info */}
      <div className="flex-1 flex items-center gap-3">
        <FileCode size={20} className={isFailed ? 'text-red-500' : 'text-slate-400'} />
        <div className="flex-1">
          <div className={`font-bold ${isFailed ? 'text-red-800' : 'text-slate-700'}`}>{file.name}</div>
          <div className="text-xs text-slate-400">Order: {file.order || index + 1}</div>
          {isFailed && file.errorMessage && (
            <div className="text-xs text-red-600 mt-1 font-medium">⚠ {file.errorMessage}</div>
          )}
        </div>
      </div>
      
      {/* Status & Result */}
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(file.status)}`}>
          {file.status}
        </span>
        {file.result && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getResultColor(file.result)}`}>
            {file.result}
          </span>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        {isFailed && (
          <button
            onClick={exportErrorLog}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center gap-1"
            title="Download error log for this test case"
          >
            <Download size={14} />
            Error Log
          </button>
        )}
        {file.status === 'running' && (
          <button
            onClick={onStop}
            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-all flex items-center gap-1"
            title="Stop this file"
          >
            <StopCircle size={14} />
            Stop
          </button>
        )}
      </div>
    </div>
  );
};

const JobRow = ({ id, name, status, machine, color }) => (
  <tr className="hover:bg-slate-50/80 transition-colors">
    <td className="px-6 py-5">
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-${color}-100 text-${color}-600`}>
        {status}
      </span>
    </td>
    <td className="px-6 py-5">
      <div className="font-bold text-slate-700">{name}</div>
      <div className="text-xs text-slate-400 font-medium">Job ID: #{id}</div>
    </td>
    <td className="px-6 py-5 text-sm font-bold text-slate-500">{machine}</td>
    <td className="px-6 py-5">
      <button className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider transition-colors">Details</button>
    </td>
  </tr>
);

// Batch Details Modal
const BatchDetailsModal = ({ batch, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold">Batch #{batch.id} - {batch.name}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {batch.completedFiles}/{batch.totalFiles} files completed • {batch.progress}%
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Firmware</div>
              <div className="text-sm font-bold">{batch.firmware}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Boards</div>
              <div className="text-sm font-bold">{batch.boards?.join(', ')}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Started</div>
              <div className="text-sm font-bold">{batch.startedAt}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Status</div>
              <div className="text-sm font-bold capitalize">{batch.status}</div>
            </div>
          </div>
          
          <div>
            <h3 className="font-bold mb-3">Files in Batch</h3>
            <div className="space-y-2">
              {batch.files && batch.files.length > 0 ? (
                batch.files.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileCode size={18} className="text-slate-400" />
                      <span className="text-sm font-bold">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        file.status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : file.status === 'running'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {file.status}
                      </span>
                      {file.result && (
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          file.result === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {file.result}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>File details will appear here as they are processed</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);

// Board Card (Grid View)
const BoardCard = ({ board, selected, onSelect, onClick, onRightClick }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'online': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'busy': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };
  
  return (
    <div
      className={`bg-white p-6 rounded-2xl border-2 transition-all hover:shadow-xl cursor-pointer relative ${
        board.status === 'error' 
          ? 'border-red-200 bg-red-50/20' 
          : board.status === 'busy'
          ? 'border-blue-200 bg-blue-50/10'
          : 'border-emerald-200 bg-white'
      } ${selected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={onClick}
      onContextMenu={onRightClick}
    >
      <div className="absolute top-4 right-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded border-slate-300 text-blue-600"
        />
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <div className="h-12 w-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-600">
          #{board.id}
        </div>
        <div className="flex items-center gap-2">
          {board.tag && (
            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
              {board.tag}
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(board.status)}`}>
            {board.status}
          </span>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">IP:</span>
          <span className="font-bold">{board.ip}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Model:</span>
          <span className="font-bold">{board.model}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Firmware:</span>
          <span className="font-bold">{board.firmware}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Current Job:</span>
          <span className="font-bold">{board.currentJob || 'Idle'}</span>
        </div>
        {board.connections && board.connections.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {board.connections.slice(0, 3).map((c, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{c}</span>
            ))}
            {board.connections.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">+{board.connections.length - 3}</span>
            )}
          </div>
        )}
        {board.voltage && (
          <div className="flex justify-between">
            <span className="text-slate-400">Voltage:</span>
            <span className="font-bold">{board.voltage}V</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Board Table Row (List View)
const BoardTableRow = ({ board, selected, onSelect, onClick, onSSHClick }) => {
  const getStatusBadge = (status) => {
    const colors = {
      online: 'bg-emerald-100 text-emerald-700',
      busy: 'bg-blue-100 text-blue-700',
      error: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };
  
  return (
    <tr 
      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${selected ? 'bg-blue-50' : ''}`}
      onClick={onClick}
    >
      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="w-4 h-4 rounded border-slate-300 text-blue-600"
        />
      </td>
      <td className="px-6 py-4">
        <div className="font-bold text-slate-700">{board.name}</div>
        {board.tag && <div className="text-[10px] font-bold text-purple-700 mt-1">Tag: {board.tag}</div>}
      </td>
      <td className="px-6 py-4">{getStatusBadge(board.status)}</td>
      <td className="px-6 py-4 text-sm font-bold text-slate-600">{board.ip}</td>
      <td className="px-6 py-4 text-sm font-mono text-slate-500">{board.mac}</td>
      <td className="px-6 py-4 text-sm font-bold text-slate-600">{board.model}</td>
      <td className="px-6 py-4 text-sm font-bold text-slate-600">{board.firmware}</td>
      <td className="px-6 py-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSSHClick();
          }}
          className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
        >
          <Terminal size={14} />
          SSH
        </button>
      </td>
    </tr>
  );
};

// Device Details Side Panel
const DeviceDetailsPanel = ({ board, onClose, onSSHClick }) => {
  const { updateBoardTag, updateBoardConnections, deleteBoard } = useTestStore();
  const addToast = useTestStore((state) => state.addToast);
  const [boardTag, setBoardTag] = useState(board.tag || '');
  const [connectionsText, setConnectionsText] = useState((board.connections || []).join(', '));
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setBoardTag(board.tag || '');
    setConnectionsText((board.connections || []).join(', '));
  }, [board]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{board.name} Details</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X size={24} />
            </button>
          </div>
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
            board.status === 'online' ? 'bg-emerald-100 text-emerald-700' :
            board.status === 'busy' ? 'bg-blue-100 text-blue-700' :
            'bg-red-100 text-red-700'
          }`}>
            {board.status}
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-700">Tag & Connections</h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      updateBoardTag(board.id, boardTag.trim());
                      const parsed = connectionsText.split(',').map(s => s.trim()).filter(Boolean);
                      updateBoardConnections(board.id, parsed);
                      setIsEditing(false);
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setBoardTag(board.tag || '');
                      setConnectionsText((board.connections || []).join(', '));
                      setIsEditing(false);
                    }}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Board Tag</div>
                <input
                  disabled={!isEditing}
                  value={boardTag}
                  onChange={(e) => setBoardTag(e.target.value)}
                  placeholder="e.g., Line A, RMA, etc."
                  className={`w-full bg-white border border-slate-200 p-3 rounded-xl outline-none ${isEditing ? 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500' : 'opacity-80'}`}
                />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Connections / Capabilities</div>
                <input
                  disabled={!isEditing}
                  value={connectionsText}
                  onChange={(e) => setConnectionsText(e.target.value)}
                  placeholder="comma separated (e.g., MQTT, SSH, HTTP)"
                  className={`w-full bg-white border border-slate-200 p-3 rounded-xl outline-none ${isEditing ? 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500' : 'opacity-80'}`}
                />
                <div className="text-xs text-slate-400 mt-1">แสดงว่าบอร์ดนี้ “connect ได้กับอะไร” เพื่อให้ทีมไม่สับสน</div>
              </div>
              {(board.connections || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(board.connections || []).map((c, idx) => (
                    <span key={idx} className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Network Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">IP Address</span>
                <span className="font-bold">{board.ip}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">MAC Address</span>
                <span className="font-mono font-bold">{board.mac}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Device Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Model</span>
                <span className="font-bold">{board.model}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Firmware Version</span>
                <span className="font-bold">{board.firmware}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Current Job</span>
                <span className="font-bold">{board.currentJob || 'Idle'}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Telemetry</h3>
            <div className="space-y-2">
              {board.voltage !== null && (
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Voltage</span>
                  <span className="font-bold">{board.voltage}V</span>
                </div>
              )}
              {board.signal !== null && (
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Signal Strength</span>
                  <span className="font-bold">{board.signal} dBm</span>
                </div>
              )}
              {board.temp !== null && (
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Temperature</span>
                  <span className="font-bold">{board.temp}°C</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={async () => {
                if (!window.confirm(`Delete ${board.name || board.id}?`)) return;
                if (isDeleting) return;
                setIsDeleting(true);
                const success = await deleteBoard(board.id);
                setIsDeleting(false);
                if (success) {
                  addToast({ type: 'success', message: 'Board deleted successfully.' });
                  onClose();
                } else {
                  addToast({ type: 'error', message: 'Failed to delete board.' });
                }
              }}
              disabled={isDeleting}
              className={`px-4 py-3 bg-red-50 text-red-700 rounded-lg font-bold transition-all ${isDeleting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-100'}`}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={onSSHClick}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Terminal size={18} />
              Open SSH Terminal
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// WebSSH Terminal
const WebSSHTerminal = ({ board, onClose }) => {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  
  useEffect(() => {
    if (terminalRef.current && !terminalInstanceRef.current) {
      const term = new XTerm({
        cursorBlink: true,
        theme: {
          background: '#1e293b',
          foreground: '#e2e8f0',
        },
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      });
      
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      
      // Welcome message
      term.writeln(`\x1b[1;32mConnected to ${board.name} (${board.ip})\x1b[0m`);
      term.writeln(`\x1b[1;33mType 'help' for available commands\x1b[0m`);
      term.writeln('');
      
      // Handle input (simulated - in real app, this would connect to WebSocket)
      let currentLine = '';
      term.onData((data) => {
        if (data === '\r' || data === '\n') {
          term.writeln('');
          if (currentLine.trim() === 'help') {
            term.writeln('Available commands:');
            term.writeln('  ls - List files');
            term.writeln('  pwd - Print working directory');
            term.writeln('  reboot - Reboot device');
            term.writeln('  exit - Close terminal');
          } else if (currentLine.trim() === 'exit') {
            onClose();
          } else {
            term.writeln(`\x1b[1;31mCommand not found: ${currentLine}\x1b[0m`);
          }
          currentLine = '';
          term.write('\r$ ');
        } else if (data === '\x7f' || data === '\b') {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write('\b \b');
          }
        } else {
          currentLine += data;
          term.write(data);
        }
      });
      
      term.write('\r$ ');
      terminalInstanceRef.current = term;
      
      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        term.dispose();
      };
    }
  }, [board, onClose]);
  
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-4 bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-slate-300" />
            <div>
              <h3 className="text-white font-bold">SSH Terminal - {board.name}</h3>
              <p className="text-xs text-slate-400">{board.ip}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div ref={terminalRef} className="flex-1 p-4" />
      </div>
    </>
  );
};

// Test Commands Manager Modal
const TestCommandsManagerModal = ({ 
  commands, 
  editingCommand, 
  commandForm, 
  setCommandForm, 
  onClose, 
  onSave, 
  onEdit, 
  onDelete, 
  onDuplicate 
}) => {
  const categories = ['testing', 'regression', 'power', 'security', 'boot', 'firmware', 'custom'];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">Manage Test Commands</h3>
            <p className="text-sm text-slate-500 mt-1">Add, edit, or delete your test commands</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Section */}
            <div className="space-y-4">
              <h4 className="font-bold text-lg">{editingCommand ? 'Edit Command' : 'Add New Command'}</h4>
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Command Name</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., My Custom Test"
                  value={commandForm.name}
                  onChange={(e) => setCommandForm({ ...commandForm, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Command</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows="4"
                  placeholder="./my_test.sh --board {board_id} --option value"
                  value={commandForm.command}
                  onChange={(e) => setCommandForm({ ...commandForm, command: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use placeholders: <code className="bg-slate-100 px-1 rounded">{'{board_id}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{firmware}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{boards}'}</code>
                </p>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Description</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What does this command do?"
                  value={commandForm.description}
                  onChange={(e) => setCommandForm({ ...commandForm, description: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Category</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={commandForm.category}
                  onChange={(e) => setCommandForm({ ...commandForm, category: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={() => {
                  if (!commandForm.name || !commandForm.command) {
                    alert('Please fill in name and command');
                    return;
                  }
                  onSave(commandForm);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
              >
                {editingCommand ? 'Update Command' : 'Add Command'}
              </button>
              
              {editingCommand && (
                <button
                  onClick={() => {
                    setCommandForm({ name: '', command: '', description: '', category: 'testing' });
                    onEdit(null);
                  }}
                  className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            {/* Commands List */}
            <div className="space-y-4">
              <h4 className="font-bold text-lg">Your Commands ({commands.length})</h4>
              
              {commands.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Command size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No commands yet. Add your first command!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {commands.map((cmd) => (
                    <div
                      key={cmd.id}
                      className={`p-4 rounded-xl border-2 ${
                        editingCommand?.id === cmd.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800">{cmd.name}</span>
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-bold">
                              {cmd.category}
                            </span>
                          </div>
                          {cmd.description && (
                            <p className="text-sm text-slate-600 mb-2">{cmd.description}</p>
                          )}
                          <code className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 block">
                            {cmd.command}
                          </code>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                        <button
                          onClick={() => onEdit(cmd)}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDuplicate(cmd.id)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => onDelete(cmd.id)}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-all ml-auto"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Board Modal (frontend-only)
const AddBoardModal = ({ onClose }) => {
  const { addBoard } = useTestStore();
  const addToast = useTestStore((state) => state.addToast);
  const [form, setForm] = useState({
    name: '',
    status: 'online',
    ip: '',
    mac: '',
    firmware: 'v0.0.0',
    model: 'STM32',
    tag: '',
    connections: 'MQTT, SSH',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidIp = (value) => {
    const ipRegex = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    return ipRegex.test(value);
  };

  const isValidMac = (value) => {
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    return macRegex.test(value);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (form.ip && !isValidIp(form.ip)) nextErrors.ip = 'Invalid IP address.';
    if (form.mac && !isValidMac(form.mac)) nextErrors.mac = 'Invalid MAC address.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (isSubmitting) return;
    setFormError('');
    if (!validate()) return;
    setIsSubmitting(true);
    const created = await addBoard({
      name: form.name.trim(),
      status: form.status,
      ip: form.ip.trim(),
      mac: form.mac.trim(),
      firmware: form.firmware,
      model: form.model,
      tag: form.tag.trim(),
      connections: form.connections.split(',').map(s => s.trim()).filter(Boolean),
    });
    setIsSubmitting(false);
    if (created) {
      addToast({ type: 'success', message: 'Board added successfully.' });
      onClose();
    } else {
      setFormError('Failed to add board.');
      addToast({ type: 'error', message: 'Failed to add board.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xl font-bold">Add Board</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
              <input className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Board #11"
              />
              {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name}</div>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Status</label>
              <select className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl"
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="online">online</option>
                <option value="busy">busy</option>
                <option value="error">error</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">IP</label>
              <input className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none"
                value={form.ip}
                onChange={(e) => {
                  setForm({ ...form, ip: e.target.value });
                  if (errors.ip) setErrors((prev) => ({ ...prev, ip: '' }));
                }}
                placeholder="192.168.1.111"
              />
              {errors.ip && <div className="text-xs text-red-600 mt-1">{errors.ip}</div>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">MAC</label>
              <input className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none"
                value={form.mac}
                onChange={(e) => {
                  setForm({ ...form, mac: e.target.value });
                  if (errors.mac) setErrors((prev) => ({ ...prev, mac: '' }));
                }}
                placeholder="00:1B:44:..."
              />
              {errors.mac && <div className="text-xs text-red-600 mt-1">{errors.mac}</div>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Model</label>
              <input className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none"
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Firmware</label>
              <input className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none"
                value={form.firmware} onChange={(e) => setForm({ ...form, firmware: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Board Tag</label>
            <input className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none"
              value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Line A / RMA" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Connections (comma separated)</label>
            <input className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none"
              value={form.connections} onChange={(e) => setForm({ ...form, connections: e.target.value })} />
          </div>
          {formError && (
            <div className="text-sm text-red-600">{formError}</div>
          )}
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isSubmitting}
            className={`px-4 py-2 bg-blue-600 text-white rounded-lg font-bold ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'}`}
          >
            {isSubmitting ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
