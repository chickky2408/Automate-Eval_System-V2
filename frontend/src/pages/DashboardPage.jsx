import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Layers,
  Monitor,
  Search,
  X,
  Zap,
  FileCode,
  Download,
} from 'lucide-react';
import { useTestStore } from '../store/useTestStore';
import { getClientId } from '../utils/sessionStorage';

const StatCard = ({ icon, label, value, sub, onClick }) => {
  const isClickable = typeof onClick === 'function';
  return (
    <div
      className={`bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-shadow ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-slate-600' : 'hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">{icon}</div>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      </div>
      <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-[0.18em]">{label}</div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">{sub}</div>
    </div>
  );
};

const BatchDetailsModal = ({ batch, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold">{batch.name || `Set #${batch.id}`}</h2>
            <p className="text-sm text-slate-500 mt-1">
              ID: {batch.id} • {batch.completedFiles}/{batch.totalFiles} files completed • {batch.progress}%
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
                batch.files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileCode size={18} className="text-slate-400" />
                      <span className="text-sm font-bold">{file.testCaseName || (file.order != null ? `Test case ${file.order}` : '—')}</span>
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

const DashboardPage = ({ onNavigateBoards, onNavigateJobs }) => {
  const {
    systemHealth,
    boards,
    jobs,
    commonCommands,
    updateJobTag,
    loading,
    errors,
  } = useTestStore();
  const boardQueuePaused = useTestStore((state) => state.boardQueuePaused || {});

  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(null);
  const [isSystemSummaryExpanded, setIsSystemSummaryExpanded] = useState(false);
  const [systemSearch, setSystemSearch] = useState('');
  const [systemStatusFilter, setSystemStatusFilter] = useState('running'); // 'all' | 'pending' | 'running' | 'completed' | 'stopped'
  const [systemTagFilter, setSystemTagFilter] = useState('');
  const [systemOwnerFilter, setSystemOwnerFilter] = useState('all'); // 'all' | 'mine' | 'others'
  const [editingSystemTagId, setEditingSystemTagId] = useState(null);
  const [systemTagEditInput, setSystemTagEditInput] = useState('');
  const [systemModalJobId, setSystemModalJobId] = useState(null);
  const [systemModalBoardId, setSystemModalBoardId] = useState(null);

  const dashboardDemoBoards = useMemo(
    () => [
      {
        id: 'BOARD-1',
        name: 'Demo Board 1',
        status: 'online',
        ip: '192.168.0.10',
        mac: '00:11:22:33:44:55',
        firmware: 'v1.0.0',
        model: 'Zybo',
        tag: 'paused',
        fpgaStatus: 'unknown',
        armStatus: 'online',
        currentJob: 'Idle',
        voltage: '3.3',
        queuePaused: true,
        isDemo: true,
      },
      {
        id: 'BOARD-2',
        name: 'Line A – Ready',
        status: 'online',
        ip: '192.168.0.11',
        mac: '00:11:22:33:44:66',
        firmware: 'v1.0.3',
        model: 'Zybo',
        tag: 'line-a',
        fpgaStatus: 'active',
        armStatus: 'online',
        currentJob: 'Idle',
        voltage: '3.3',
        queuePaused: false,
        isDemo: true,
      },
      {
        id: 'BOARD-3',
        name: 'Burn-in Tester 1',
        status: 'busy',
        ip: '192.168.0.21',
        mac: '00:11:22:33:44:88',
        firmware: 'v1.1.0',
        model: 'Zybo',
        tag: 'burn-in',
        fpgaStatus: 'active',
        armStatus: 'busy',
        currentJob: '10Mar ',
        voltage: '3.3',
        queuePaused: false,
        isDemo: true,
      },
      {
        id: 'BOARD-4',
        name: 'Demo Board – Busy',
        status: 'busy',
        ip: '192.168.0.22',
        mac: '00:11:22:33:44:99',
        firmware: 'v1.0.5',
        model: 'Zybo',
        tag: 'running',
        fpgaStatus: 'active',
        armStatus: 'busy',
        currentJob: 'test-1',
        voltage: '3.3',
        queuePaused: false,
        isDemo: true,
      },
      {
        id: 'BOARD-ERR',
        name: 'Demo Error Board',
        status: 'error',
        ip: '192.168.0.31',
        mac: '00:11:22:33:44:77',
        firmware: 'v1.0.0',
        model: 'Zybo',
        tag: 'error',
        fpgaStatus: 'error',
        armStatus: 'offline',
        currentJob: 'Idle',
        voltage: '3.3',
        queuePaused: false,
        isDemo: true,
      },
      {
        id: 'BOARD-OFF',
        name: 'Spare Board (offline)',
        status: 'error',
        ip: '192.168.0.32',
        mac: '00:11:22:33:44:AA',
        firmware: 'v0.9.0',
        model: 'Zybo',
        tag: 'maintenance',
        fpgaStatus: 'offline',
        armStatus: 'offline',
        currentJob: '—',
        voltage: '0.0',
        queuePaused: false,
        isDemo: true,
      },
    ],
    []
  );

  const fleetBoards = useMemo(() => {
    const realBoards = boards || [];
    const byId = new Map();
    realBoards.forEach((b) => {
      byId.set(String(b.id), b);
    });
    dashboardDemoBoards.forEach((demo) => {
      const id = String(demo.id);
      const base = byId.get(id) || {};
      byId.set(id, { ...base, ...demo });
    });
    const merged = Array.from(byId.values());
    return merged.map((b) => {
      const override = boardQueuePaused[String(b.id)];
      return override === undefined ? b : { ...b, queuePaused: override };
    });
  }, [boards, dashboardDemoBoards, boardQueuePaused]);

  const fleetTotalBoards = fleetBoards.length;
  const fleetOnlineBoards = fleetBoards.filter((b) => b.status === 'online').length;
  const fleetBusyBoards = fleetBoards.filter((b) => b.status === 'busy').length;

  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const jobQueueCount = pendingJobs.length;
  const jobErrorCount = jobs.filter((job) => {
    if (job.status !== 'completed' && job.status !== 'stopped') return false;
    return (job.files || []).some((f) => {
      const result = (f.result || '').toLowerCase();
      const status = (f.status || '').toLowerCase();
      return result === 'fail' || status === 'error';
    });
  }).length;

  const clientId = getClientId();
  const systemSearchLower = systemSearch.trim().toLowerCase();
  const systemTagOptions = [...new Set(jobs.map((j) => j.tag).filter(Boolean))].sort();

  const systemSummaryJobs = jobs.filter((job) => {
    if (systemStatusFilter !== 'all' && job.status !== systemStatusFilter) return false;
    if (systemTagFilter && (job.tag || '').toLowerCase() !== systemTagFilter.toLowerCase()) return false;
    if (systemOwnerFilter === 'mine' && job.clientId !== clientId) return false;
    if (systemOwnerFilter === 'others' && (job.clientId === clientId || !job.clientId)) return false;
    if (systemSearchLower) {
      const name = (job.name || '').toLowerCase();
      const id = (job.id || '').toLowerCase();
      const tag = (job.tag || '').toLowerCase();
      if (!name.includes(systemSearchLower) && !id.includes(systemSearchLower) && !tag.includes(systemSearchLower)) {
        return false;
      }
    }
    return true;
  });

  const systemSummary = systemSummaryJobs.map((job) => {
    const rawAt = job.startedAt || job.createdAt;
    const d = rawAt ? new Date(rawAt) : null;
    const displayDate = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    const displayTime = d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
    const ownerLabel = job.clientId && job.clientId === clientId ? 'Me' : job.clientId ? 'Other client' : '—';
    return {
      jobId: job.id,
      jobName: job.name,
      tag: job.tag || 'Untagged',
      boards: job.boards || [],
      status: job.status,
      totalFiles: job.totalFiles ?? (job.files ? job.files.length : 0),
      firmware: job.firmware,
      ownerLabel,
      displayDate,
      displayTime,
    };
  });

  const availableBoards = fleetBoards.filter((b) => b.status === 'online' && !b.currentJob).length;
  const queuedBoardsLeft = availableBoards;
  const deviceProgressRows = fleetBoards.map((b) => {
    const boardKey = (b.name || b.id || '').toString();
    let jobId = (b.currentJob || '').replace(/^(Batch|Set) #/, '');
    let job = jobs.find((j) => j.id === jobId);
    if (!job) {
      job =
        jobs.find((j) => (j.status === 'running') && (j.boards || []).some((jb) => (jb || '').toString() === boardKey)) ||
        jobs.find((j) => (j.status === 'pending') && (j.boards || []).some((jb) => (jb || '').toString() === boardKey)) ||
        null;
    }
    if (!job && (b.status || '').toLowerCase() === 'busy' && b.currentJob) {
      job = {
        id: `DEMO-${b.id}`,
        name: (b.currentJob || '').toString(),
        status: 'running',
        boards: [boardKey],
        clientId: clientId,
        files: [],
        progress: 0,
        completedFiles: 0,
        totalFiles: 0,
      };
    }
    const progress = job ? job.progress : 0;
    const completedFiles = job ? job.completedFiles ?? 0 : 0;
    const totalFiles = job ? job.totalFiles ?? (job.files ? job.files.length : 0) : 0;
    const remainingFiles = Math.max(0, totalFiles - completedFiles);
    const jobsWaitingForBoard = pendingJobs.filter(
      (j) => !(j.boards || []).length || (j.boards || []).some((jb) => (jb || '').toString() === boardKey)
    ).length;
    return { board: b, progress, job, completedFiles, totalFiles, remainingFiles, jobsWaitingForBoard };
  });

  const handleCopyCommand = (command) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const hasDashboardError = errors?.systemHealth || errors?.boards || errors?.jobs;
  const isDashboardLoading = loading?.systemHealth || loading?.boards || loading?.jobs;

  const goToBoardStatus = () => {
    if (onNavigateBoards) onNavigateBoards();
  };

  const goToJobManager = () => {
    if (onNavigateJobs) onNavigateJobs();
  };

  const systemModalJob = systemModalJobId ? jobs.find((j) => j.id === systemModalJobId) : null;

  const systemModalBoardRow = systemModalBoardId
    ? deviceProgressRows.find((r) => (r.board?.id || r.board?.name) === systemModalBoardId)
    : null;

  const getDashboardTestCaseDisplayName = (file) =>
    file?.testCaseName || (file?.order != null ? `Test case ${file.order}` : '—');

  const systemModalFiles = systemModalJob?.files ? [...systemModalJob.files].sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
  const systemModalRunningFiles = systemModalFiles.filter((f) => (f.status || '').toLowerCase() === 'running');
  const systemModalFailedFiles = systemModalFiles.filter((f) => {
    const result = (f.result || '').toLowerCase();
    const status = (f.status || '').toLowerCase();
    return result === 'fail' || status === 'error' || status === 'failed';
  });
  let systemModalSummaryText = '';
  if (systemModalJob) {
    const status = (systemModalJob.status || '').toLowerCase();
    if (status === 'pending') {
      systemModalSummaryText = 'Pending — waiting to start';
    } else if (status === 'running') {
      if (systemModalRunningFiles.length > 0) {
        const names = systemModalRunningFiles
          .slice(0, 2)
          .map((f) => getDashboardTestCaseDisplayName(f))
          .join(', ');
        systemModalSummaryText =
          systemModalRunningFiles.length > 1
            ? `Running test cases: ${names}${systemModalRunningFiles.length > 2 ? ` +${systemModalRunningFiles.length - 2} more` : ''}`
            : `Running test case: ${names}`;
      } else {
        systemModalSummaryText = 'Running — waiting for next test case';
      }
    } else if (status === 'completed' || status === 'stopped') {
      if (systemModalFailedFiles.length > 0) {
        systemModalSummaryText = `Completed with ${systemModalFailedFiles.length} failed test case(s)`;
      } else {
        systemModalSummaryText = 'Set completed';
      }
    }
  }

  return (
    <div className="space-y-2.5 min-w-0">
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={<CheckCircle2 className="text-emerald-500" />}
          label="Online"
          value={fleetOnlineBoards}
          sub={`${fleetTotalBoards} Total Boards`}
          onClick={goToBoardStatus}
        />
        <StatCard
          icon={<Zap className="text-blue-500" />}
          label="Busy"
          value={fleetBusyBoards}
          sub="Running Board"
          onClick={goToBoardStatus}
        />
        <StatCard
          icon={<AlertCircle className="text-red-500" />}
          label="Job Errors"
          value={jobErrorCount}
          sub="Set with failed tests"
          onClick={goToJobManager}
        />
        <StatCard
          icon={<Activity className="text-purple-500" />}
          label="Job Queue"
          value={jobQueueCount}
          sub="Set waiting to run"
          onClick={goToJobManager}
        />
        <StatCard
          icon={<HardDrive className="text-orange-500" />}
          label="Storage"
          value={`${systemHealth.storageUsage}%`}
          sub={`${systemHealth.storageUsed} / ${systemHealth.storageTotal}`}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">System Summary</h2>
            {systemSummary.length > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                ({systemSummary.length} {systemSummary.length === 1 ? 'system' : 'systems'})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={systemSearch}
                onChange={(e) => setSystemSearch(e.target.value)}
                placeholder="Search by ID, name, tag..."
                className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-full px-1 py-0.5">
              <select
                value={systemOwnerFilter}
                onChange={(e) => setSystemOwnerFilter(e.target.value)}
                className="px-3 py-1.5 text-[11px] border border-slate-200 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Owner"
              >
                <option value="all">All owners</option>
                <option value="mine">Me</option>
                <option value="others">Other clients</option>
              </select>
              <select
                value={systemStatusFilter}
                onChange={(e) => setSystemStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-[11px] border border-slate-200 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Batch status"
              >
                <option value="running">Running</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="stopped">Stopped</option>
                <option value="all">All Status</option>
              </select>
              <select
                value={systemTagFilter}
                onChange={(e) => setSystemTagFilter(e.target.value)}
                className="px-3 py-1.5 text-[11px] border border-slate-200 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Tag"
              >
                <option value="">All Tags</option>
                {systemTagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
            {systemSummary.length > 3 && (
              <button
                onClick={() => setIsSystemSummaryExpanded(!isSystemSummaryExpanded)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                {isSystemSummaryExpanded ? (
                  <>
                    <ChevronUp size={14} />
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    <span>Expand</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        {systemSummary.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(isSystemSummaryExpanded ? systemSummary : systemSummary.slice(0, 3)).map((sys) => {
                const status = (sys.status || '').toLowerCase();
                const statusColors =
                  status === 'completed'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : status === 'pending'
                      ? 'border-amber-200 bg-amber-50/40'
                      : status === 'stopped'
                        ? 'border-red-200 bg-red-50/40'
                        : 'border-blue-200 bg-blue-50/40';
                const dotColor =
                  status === 'completed'
                    ? 'bg-emerald-500'
                    : status === 'pending'
                      ? 'bg-amber-500'
                      : status === 'stopped'
                        ? 'bg-red-500'
                        : 'bg-blue-500';
                const isEditingTag = editingSystemTagId === sys.jobId;
                const handleTagClick = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const job = jobs.find((j) => j.id === sys.jobId);
                  setEditingSystemTagId(sys.jobId);
                  setSystemTagEditInput(job?.tag || '');
                };
                const handleTagSave = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const newTag = systemTagEditInput.trim();
                  updateJobTag(sys.jobId, newTag || null);
                  setEditingSystemTagId(null);
                  setSystemTagEditInput('');
                };
                const handleTagCancel = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingSystemTagId(null);
                  setSystemTagEditInput('');
                };
                return (
                  <div
                    key={sys.jobId}
                    className={`p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer dark:bg-slate-800 dark:border-slate-700 ${statusColors}`}
                    onClick={() => setSystemModalJobId(sys.jobId)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {sys.jobName || `Set #${sys.jobId}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">ID: {sys.jobId}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isEditingTag ? (
                          <>
                            <input
                              type="text"
                              value={systemTagEditInput}
                              onChange={(e) => setSystemTagEditInput(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-0.5 text-[11px] border border-purple-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                              placeholder="Tag"
                            />
                            <button
                              onClick={handleTagSave}
                              className="p-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white"
                              title="Save tag"
                            >
                              <CheckSquare size={12} />
                            </button>
                            <button
                              onClick={handleTagCancel}
                              className="p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700"
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleTagClick}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold hover:bg-purple-200 transition-colors"
                            title="Edit tag"
                          >
                            {sys.tag}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className={`inline-flex w-2 h-2 rounded-full ${dotColor}`} />
                      <span className="uppercase tracking-wide font-semibold">
                        {status || 'RUNNING'}
                      </span>
                    </div>
                    {(sys.displayDate || sys.displayTime) && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        {sys.displayDate}{sys.displayTime ? ` · ${sys.displayTime}` : ''}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <div className="mb-0.5">
                        Owner: {sys.ownerLabel || '—'}
                      </div>
                      <div>
                        Boards:{' '}
                        {sys.boards.length > 0 ? sys.boards.join(', ') : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!isSystemSummaryExpanded && systemSummary.length > 3 && (
              <div className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
                Showing top 3 of {systemSummary.length} systems. Click &quot;Expand&quot; to view all.
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <p>No active systems running</p>
          </div>
        )}
      </div>

      {systemModalJob && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSystemModalJobId(null)}
        >
          <div
            className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-blue-600 dark:text-blue-400" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                      {systemModalJob.name || systemModalJob.configName || `Set #${systemModalJob.id}`}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ID: {systemModalJob.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {systemModalJob.tag && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                    {systemModalJob.tag}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSystemModalJobId(null);
                    goToJobManager();
                  }}
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Monitor size={14} />
                  Open in Job Manager
                </button>
                <button
                  onClick={() => setSystemModalJobId(null)}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">{systemModalSummaryText}</div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>Test Cases</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (running / failed highlighted)
                    </span>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto text-xs">
                  {(!systemModalJob.files || systemModalJob.files.length === 0) ? (
                    <div className="px-4 py-6 text-center text-slate-400">
                      No test cases in this set.
                    </div>
                  ) : (
                    (systemModalJob.files || [])
                      .slice()
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((file) => {
                        const isRunning = file.status === 'running';
                        const isFailed =
                          (file.result || '').toLowerCase() === 'fail' ||
                          (file.status || '').toLowerCase() === 'error' ||
                          (file.status || '').toLowerCase() === 'failed';
                        const rowBg = isFailed
                          ? 'bg-red-50'
                          : isRunning
                            ? 'bg-blue-50'
                            : 'bg-white';
                        return (
                          <div
                            key={file.id}
                            className={`px-4 py-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 ${rowBg}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] text-slate-400 shrink-0">
                                #{file.order || file.id}
                              </span>
                              <span className="truncate font-medium text-slate-700">
                                {getDashboardTestCaseDisplayName(file)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] uppercase font-semibold text-slate-500">
                                {file.status || 'pending'}
                              </span>
                              {file.result && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    file.result === 'pass'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : file.result === 'fail'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {file.result.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setSystemModalJobId(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setSystemModalJobId(null);
                    goToJobManager();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
                >
                  <Monitor size={14} />
                  Open in Job Manager
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {systemModalBoardRow && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSystemModalBoardId(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-blue-600 dark:text-blue-400" />
                <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                  {systemModalBoardRow.board?.name || 'Board'}
                </h2>
              </div>
              <button
                onClick={() => setSystemModalBoardId(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {systemModalBoardRow.job ? (
                <>
                  <div className="text-sm">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Running set</div>
                    {(() => {
                      const rawName = (systemModalBoardRow.job.name || systemModalBoardRow.job.configName || '').trim();
                      const displayName = rawName.replace(/^Batch\s*#/i, 'Set ');
                      return (
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {displayName || `Set #${systemModalBoardRow.job.id}`}
                        </div>
                      );
                    })()}
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ID: {systemModalBoardRow.job.id}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Owner</div>
                    <div className="font-medium text-slate-700 dark:text-slate-300">
                      {systemModalBoardRow.job.clientId && systemModalBoardRow.job.clientId === clientId
                        ? 'Me'
                        : systemModalBoardRow.job.clientId
                          ? 'Other client'
                          : '—'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Status</div>
                  <div className="font-medium text-slate-700 dark:text-slate-300">Idle</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Queue: {systemModalBoardRow.jobsWaitingForBoard} waiting
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setSystemModalBoardId(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSystemModalBoardId(null);
                  goToBoardStatus();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <Activity size={14} />
                Board Status
              </button>
              {systemModalBoardRow.job && (
                <button
                  onClick={() => {
                    setSystemModalBoardId(null);
                    goToJobManager();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-600 text-white hover:bg-slate-700"
                >
                  <Monitor size={14} />
                  Job Manager
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Device Progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {deviceProgressRows.length === 0 ? (
              <div className="col-span-full py-4 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                No devices available
              </div>
            ) : (
              deviceProgressRows.map(({ board, progress, job, completedFiles, totalFiles, remainingFiles, jobsWaitingForBoard }) => {
                const status = (board.status || '').toLowerCase();
                const isBusy = status === 'busy';
                const isOnline = status === 'online';
                return (
                  <div
                    key={board.id}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer"
                    onClick={() => setSystemModalBoardId(board.id)}
                    title="Click to view board details"
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{board.name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                        isBusy
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : isOnline
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                      }`}>
                        {isBusy ? 'Busy' : isOnline ? 'Online' : (board.status || '—')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1" title={job ? `${((job.configName || job.name || 'Set').trim()).replace(/^Batch\s*#/i, 'Set ')} · set #${job.id}` : 'Idle'}>
                      {job ? `${((job.configName || job.name || 'Set').trim()).replace(/^Batch\s*#/i, 'Set ')} · #${job.id}` : 'Idle'}
                    </div>
                    {isBusy && (
                      <>
                        <div className="h-1 w-full bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden mb-1">
                          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          {completedFiles}/{totalFiles} ({progress}%) · {remainingFiles} left · Queue: {jobsWaitingForBoard}
                        </div>
                      </>
                    )}
                    {!isBusy && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Queue: {jobsWaitingForBoard} waiting</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

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

export default DashboardPage;

