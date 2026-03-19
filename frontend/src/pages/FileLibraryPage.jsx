import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDown, ArrowUp, Bell, CheckCircle2, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Copy, Cpu, Download, Eye, FileCode, FileDown, FileJson, FileUp, Filter, FolderOpen, Globe, GripVertical, Grid3x3, HardDrive, History, Layers, LayoutDashboard, List, Lock, LogOut, Menu, Monitor, MoreVertical, Pause, Pencil, Play, PlayCircle, Plus, RefreshCw, Save, Search, Settings, Square, StopCircle, Tag, Terminal, Trash2, Upload, User, UserPlus, Users, Wifi, WifiOff, X, XCircle, Zap
} from 'lucide-react';
import { useTestStore } from '../store/useTestStore';
import api from '../services/api';
import { computeFileSignature } from '../utils/fileSignature';
import { getClientId } from '../utils/sessionStorage';

// Set names that use this file (from fileLibrarySnapshot or items)
const getSetNamesUsingFile = (fileName, savedTestCaseSets) => {
  if (!fileName || !savedTestCaseSets?.length) return [];
  const names = [];
  for (const set of savedTestCaseSets) {
    const hasInSnapshot = set.fileLibrarySnapshot?.some((s) => s.name === fileName);
    const hasInItems = (set.items || []).some(
      (t) => t.vcdName === fileName || t.binName === fileName || t.linName === fileName
    );
    if (hasInSnapshot || hasInItems) names.push(set.name || set.id);
  }
  return names;
};

/** Returns list of { name, set } for each test case that uses this file (VCD / ERoM / ULP / MDI). */
const getTestCasesUsingFile = (fileName, savedTestCases, savedTestCaseSets) => {
  if (!fileName) return [];
  const out = [];
  const isUsedInTc = (tc) => {
    if (tc.vcdName === fileName || tc.binName === fileName || tc.linName === fileName) return true;
    const cmds = Array.isArray(tc.commands) ? tc.commands : [];
    if (cmds.some((c) => c && c.file === fileName)) return true;
    const extra = tc.extraColumns && typeof tc.extraColumns === 'object' ? tc.extraColumns : {};
    return Object.values(extra).some((v) => v === fileName);
  };
  (savedTestCases || []).forEach((tc) => {
    if (isUsedInTc(tc)) {
      out.push({ name: (tc.name || tc.vcdName || '').trim() || '—', set: 'Current (from table)' });
    }
  });
  (savedTestCaseSets || []).forEach((set) => {
    (set.items || []).forEach((tc) => {
      if (isUsedInTc(tc)) {
        out.push({ name: (tc.name || tc.vcdName || '').trim() || '—', set: set.name || set.id });
      }
    });
  });
  return out;
};

// FILE LIBRARY PAGE — default: Test Case Library (เรียง set ลงมา แต่ละ set มีตารางแนวนอน + แสดงไฟล์); ปุ่มสลับView files in Library
const FileLibraryPage = ({ onNavigateToTestCases }) => {
  const { uploadedFiles, addUploadedFile, removeUploadedFile, loading, errors, savedTestCaseSets, savedTestCases, removeSavedTestCase, updateSavedTestCaseSet, removeSavedTestCaseSet, fileTags, setFileTag, fileDisplayNames, setFileDisplayName } = useTestStore();
  const setFileToTestCaseDraft = useTestStore((s) => s.setFileToTestCaseDraft);
  const activeProfileId = useTestStore((s) => s.activeProfileId);
  const profiles = useTestStore((s) => s.profiles) || [];
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || { id: 'default', name: 'Default' };
  const currentClientId = getClientId();
  const jobs = useTestStore((s) => s.jobs);
  const refreshFiles = useTestStore((s) => s.refreshFiles);
  const addToast = useTestStore((s) => s.addToast);
  const setLibraryEditContext = useTestStore((s) => s.setLibraryEditContext);
  const clearLibraryEditContext = useTestStore((s) => s.clearLibraryEditContext);
  const setLoadedSetId = useTestStore((s) => s.setLoadedSetId);
  const syncFullLibraryToSavedTestCases = useTestStore((s) => s.syncFullLibraryToSavedTestCases);
  const libraryFocusFileNameOnNavigate = useTestStore((s) => s.libraryFocusFileNameOnNavigate);
  const clearLibraryFocusFileNameOnNavigate = useTestStore((s) => s.clearLibraryFocusFileNameOnNavigate);

  // Status helpers for mapping jobs → sets / test cases / files
  const STATUS_PRIORITY = { completed: 1, pending: 2, running: 3 };
  const normalizeJobStatusForLibrary = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'running' || s === 'pending') return s;
    if (s === 'completed') return 'completed';
    return null;
  };
  const mergeStatus = (a, b) => {
    if (!a) return b || null;
    if (!b) return a || null;
    return STATUS_PRIORITY[b] > STATUS_PRIORITY[a] ? b : a;
  };

  const { setStatusByName, testCaseStatusByName, fileStatusByName, testCaseStatusByFileKey } = useMemo(() => {
    const setStatus = new Map();
    const tcStatus = new Map();
    const fileStatus = new Map();
    const tcStatusByFileKey = new Map();

    const update = (map, key, rawStatus) => {
      const status = normalizeJobStatusForLibrary(rawStatus);
      if (!key || !status) return;
      const current = map.get(key);
      if (!current || STATUS_PRIORITY[status] > STATUS_PRIORITY[current]) {
        map.set(key, status);
      }
    };

    (jobs || []).forEach((job) => {
      const status = normalizeJobStatusForLibrary(job.status);
      if (!status) return;

      const setName = (job.configName || job.name || '').trim();
      if (setName) update(setStatus, setName, status);

      (job.files || []).forEach((f) => {
        const tcName = (f.testCaseName || '').trim();
        if (tcName) update(tcStatus, tcName, status);

        const v = (f.vcd || f.vcdName || f.name || '').trim().toLowerCase();
        const b = (f.erom || f.binName || '').trim().toLowerCase();
        const l = (f.ulp || f.linName || '').trim().toLowerCase();
        const key = `${v}||${b}||${l}`;
        if (key !== '||||') update(tcStatusByFileKey, key, status);

        if (f.vcd) update(fileStatus, f.vcd, status);
        if (f.erom) update(fileStatus, f.erom, status);
        if (f.ulp) update(fileStatus, f.ulp, status);
        if (f.vcdName) update(fileStatus, f.vcdName, status);
        if (f.binName) update(fileStatus, f.binName, status);
        if (f.linName) update(fileStatus, f.linName, status);
      });
    });

    return {
      setStatusByName: setStatus,
      testCaseStatusByName: tcStatus,
      fileStatusByName: fileStatus,
      testCaseStatusByFileKey: tcStatusByFileKey,
    };
  }, [jobs]);

  const fileNamesInUseByBatch = useMemo(() => {
    const names = new Set();
    fileStatusByName.forEach((status, name) => {
      if (status === 'pending' || status === 'running') {
        names.add(name);
      }
    });
    return names;
  }, [fileStatusByName]);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);
  const fileImportInputRef = useRef(null);
  const inlineFileImportInputRef = useRef(null);
  const [isImportDragging, setIsImportDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDrafts, setImportDrafts] = useState([]); // [{ id, file, name, tag }]
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    if (importDrafts.length > 0) setIsImportModalOpen(true);
  }, [importDrafts.length]);

  const collectFilesFromDataTransfer = useCallback(async (dt) => {
    try {
      if (!dt) return [];
      const items = Array.from(dt.items || []).filter(Boolean);
      const hasEntry = items.some((it) => typeof it.webkitGetAsEntry === 'function');
      if (!hasEntry) return Array.from(dt.files || []).filter(Boolean);

      const files = [];
      const walkEntry = async (entry, pathPrefix = '') => {
        if (!entry) return;
        if (entry.isFile) {
          const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
          if (!file) return;
          const rel = `${pathPrefix}${file.name}`;
          try {
            Object.defineProperty(file, 'webkitRelativePath', { value: rel, configurable: true });
          } catch {
            // ignore
          }
          files.push(file);
          return;
        }
        if (entry.isDirectory) {
          const reader = entry.createReader();
          const readAll = async () => {
            const batch = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
            if (!batch || batch.length === 0) return [];
            const rest = await readAll();
            return [...batch, ...rest];
          };
          const entries = await readAll();
          for (const child of entries) {
            await walkEntry(child, `${pathPrefix}${entry.name}/`);
          }
        }
      };

      for (const it of items) {
        const entry = it.webkitGetAsEntry?.();
        if (entry) await walkEntry(entry, '');
      }
      return files.filter((f) => f && f.name);
    } catch {
      return Array.from(dt?.files || []).filter(Boolean);
    }
  }, []);

  const enqueueImportDrafts = useCallback((fileList) => {
    const arr = Array.from(fileList || []).filter(Boolean).filter((f) => f?.name);
    if (arr.length === 0) return;
    setImportDrafts((prev) => {
      const existing = new Set(prev.map((d) => `${d.name}::${d.file?.size || 0}`));
      const next = [...prev];
      arr.forEach((file) => {
        const rel = (file.webkitRelativePath && String(file.webkitRelativePath)) || '';
        const base = (rel ? rel.split('/').pop() : String(file.name || '').split('/').pop()) || 'file';
        const key = `${base}::${file.size || 0}`;
        if (existing.has(key)) return;
        existing.add(key);
        next.push({
          id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: base,
          tag: '',
        });
      });
      return next;
    });
  }, []);

  const saveImportDraftsToLibrary = useCallback(async () => {
    if (importDrafts.length === 0) return;
    setIsImporting(true);
    let ok = 0;
    let dup = 0;
    const normSize = (v) => {
      const n = typeof v === 'number' ? v : Number(String(v || '').replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    const base = (s) => (String(s || '').split('/').pop() || String(s || '')).trim();
    const existingKeys = new Set(
      (uploadedFiles || []).map((f) => `${base(f.name)}::${normSize(f.size) ?? ''}`)
    );
    for (const d of importDrafts) {
      const rawName = String(d.name || '').trim();
      if (!d.file || !rawName) continue;
      const desiredKey = `${base(rawName)}::${normSize(d.file.size) ?? ''}`;
      if (existingKeys.has(desiredKey)) {
        dup++;
        continue;
      }
      const renamed = rawName === d.file.name ? d.file : new File([d.file], rawName, { type: d.file.type });
      // attach metadata for backend upload
      renamed.metadata = { tag: (d.tag || '').trim() };
      const result = await addUploadedFile(renamed);
      if (result?.id) {
        ok++;
        existingKeys.add(desiredKey);
        const tagVal = (d.tag || '').trim();
        if (tagVal) setFileTag?.(result.id, tagVal);
      }
    }
    setIsImporting(false);
    setImportDrafts([]);
    setIsImportModalOpen(false);
    if (ok > 0) addToast({ type: 'success', message: `Saved ${ok} file(s) to Library` });
    if (dup > 0) addToast({ type: 'info', message: `Skipped ${dup} duplicate file(s) (already in Library)` });
    if (ok === 0 && dup === 0) addToast({ type: 'warning', message: 'No file saved' });
  }, [importDrafts, uploadedFiles, addUploadedFile, addToast, setFileTag]);
  const [libraryView, setLibraryView] = useState('files'); // 'files' | 'rawTestCases' | 'testCases'
  const [fileFilter, setFileFilter] = useState('all');
  const [fileStatusFilter, setFileStatusFilter] = useState('all'); // 'all' | 'pending' | 'running' | 'completed'
  const [fileSearch, setFileSearch] = useState('');
  const [fileTagSearch, setFileTagSearch] = useState('');
  const [fileSizeSearch, setFileSizeSearch] = useState('');
  const [fileOwnerSearch, setFileOwnerSearch] = useState('');
  const [tagInputByFileId, setTagInputByFileId] = useState({});
  const [isTagEditorOpenByFileId, setIsTagEditorOpenByFileId] = useState({});
  const [showAllTagsForFileId, setShowAllTagsForFileId] = useState(null);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [fileSort, setFileSort] = useState('time');
  const [fileViewMode, setFileViewMode] = useState('all'); // 'all' | 'bySet'
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingBoxId, setDeletingBoxId] = useState(null);
  const [libraryTcNameFilter, setLibraryTcNameFilter] = useState('');
  const [libraryTcTagFilter, setLibraryTcTagFilter] = useState('');
  const [libraryTcStatusFilter, setLibraryTcStatusFilter] = useState('all'); // 'all' | 'pending' | 'running' | 'completed'
  const [selectedLibraryTcKeys, setSelectedLibraryTcKeys] = useState([]);
  const lastClickedLibraryTcIndexRef = useRef(null);
  const isDragSelectingLibraryRef = useRef(false);
  const [librarySetTcNameFilter, setLibrarySetTcNameFilter] = useState('');
  const [librarySetTcTagFilter, setLibrarySetTcTagFilter] = useState('');
  const [librarySetTcStatusFilter, setLibrarySetTcStatusFilter] = useState('all'); // 'all' | 'pending' | 'running' | 'completed'
  const [selectedLibrarySetTcKeys, setSelectedLibrarySetTcKeys] = useState([]);
  const lastClickedLibrarySetTcRef = useRef({ setId: null, index: null });
  const isDragSelectingLibrarySetRef = useRef(false);
  const [selectedLibraryFileIds, setSelectedLibraryFileIds] = useState([]);
  const lastClickedFileIndexRef = useRef(null);
  const isDragSelectingFileRef = useRef(false);
  const [libraryFocusFileName, setLibraryFocusFileName] = useState(null);
  const focusedLibraryFileRef = useRef(null);
  // Separate filter per Library tab: Set=Mine, Test Cases=Mine, File=All
  const [librarySetFilter, setLibrarySetFilter] = useState('mine'); // Set Library
  const [libraryTestCasesFilter, setLibraryTestCasesFilter] = useState('mine'); // Test Cases Library
  const [libraryFileFilter, setLibraryFileFilter] = useState('all'); // File in Library
  const libraryCreatedByFilter = libraryView === 'testCases' ? librarySetFilter : libraryView === 'rawTestCases' ? libraryTestCasesFilter : libraryFileFilter;
  const setLibraryCreatedByFilter = (value) => {
    if (libraryView === 'testCases') setLibrarySetFilter(value);
    else if (libraryView === 'rawTestCases') setLibraryTestCasesFilter(value);
    else setLibraryFileFilter(value);
  };
  const [allProfilesTestData, setAllProfilesTestData] = useState({ savedTestCases: [], savedTestCaseSets: [] });
  const [allProfilesTestDataLoading, setAllProfilesTestDataLoading] = useState(false);

  // Load test cases/sets from all profiles when filtering by "all" or "shared"
  useEffect(() => {
    if (libraryCreatedByFilter === 'mine') return;
    let cancelled = false;
    setAllProfilesTestDataLoading(true);
    api
      .getAllTestCasesFromProfiles()
      .then((res) => {
        if (cancelled) return;
        setAllProfilesTestData({
          savedTestCases: Array.isArray(res?.savedTestCases) ? res.savedTestCases : [],
          savedTestCaseSets: Array.isArray(res?.savedTestCaseSets) ? res.savedTestCaseSets : [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAllProfilesTestData({ savedTestCases: [], savedTestCaseSets: [] });
      })
      .finally(() => {
        if (cancelled) return;
        setAllProfilesTestDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryCreatedByFilter]);

  const getFileKind = (f) => {
    const ext = String(f?.name || '').split('.').pop()?.toLowerCase();
    if (ext === 'vcd') return 'vcd';
    if (['bin', 'hex', 'elf', 'erom'].includes(ext)) return 'bin';
    // Text-based MDI files (manual commands / scripts)
    if (ext === 'txt') return 'mdi';
    if (['lin', 'ulp'].includes(ext)) return 'lin';
    return 'other';
  };

  const splitTags = (raw) =>
    String(raw || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const upsertTagsString = (currentRaw, addRaw) => {
    const current = splitTags(currentRaw);
    const toAdd = splitTags(addRaw);
    const seen = new Set(current.map((t) => t.toLowerCase()));
    const next = [...current];
    toAdd.forEach((t) => {
      const k = t.toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      next.push(t);
    });
    return next.join(', ');
  };

  const removeOneTagFromString = (currentRaw, tagToRemove) => {
    const target = String(tagToRemove || '').trim().toLowerCase();
    if (!target) return String(currentRaw || '');
    const next = splitTags(currentRaw).filter((t) => t.trim().toLowerCase() !== target);
    return next.join(', ');
  };

  const normalizeFileSize = (value) => {
    if (typeof value === 'number') return value;
    if (value == null) return 0;
    const n = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const filteredFiles = [...(uploadedFiles || [])]
    .filter((f) => {
      const k = getFileKind(f);
      if (fileFilter !== 'all') {
        if (fileFilter === 'vcd' && k !== 'vcd') return false;
        if (fileFilter === 'bin' && k !== 'bin') return false;
        if (fileFilter === 'lin' && k !== 'lin') return false;
        if (fileFilter === 'mdi' && k !== 'mdi') return false;
      }
      const status = fileStatusByName.get(f.name) || null;
      if (fileStatusFilter !== 'all') {
        if (!status) return false;
        if (fileStatusFilter !== status) return false;
      }
      if (fileSearch.trim() && !String(f.name || '').toLowerCase().includes(fileSearch.trim().toLowerCase())) return false;
      if (fileTagSearch.trim()) {
        const tags = splitTags((fileTags && fileTags[f.id]) || '');
        const q = fileTagSearch.trim().toLowerCase();
        if (!tags.some((t) => t.toLowerCase().includes(q))) return false;
      }
      if (fileSizeSearch.trim()) {
        const q = fileSizeSearch.trim().toLowerCase();
        const n = normalizeFileSize(f.size);
        const sizeTxt = String(f.sizeFormatted || f.size || '').toLowerCase();
        if (!sizeTxt.includes(q) && !String(n).includes(q)) return false;
      }
      if (fileOwnerSearch.trim()) {
        const ownerLabel = f.ownerId === currentClientId ? 'me' : (f.ownerId ? 'other' : '');
        const ownerId = String(f.ownerId || '').toLowerCase();
        const q = fileOwnerSearch.trim().toLowerCase();
        if (!ownerLabel.includes(q) && !ownerId.includes(q)) return false;
      }
      if (libraryCreatedByFilter === 'mine') {
        const owner = f.ownerId || null;
        // Mine: แสดงเฉพาะไฟล์ที่เราเป็น owner (ownerId === currentClientId) หรือไม่มี owner — ตรงกับ badge "Me"
        if (owner != null && owner !== currentClientId) return false;
        return true;
      }
      if (libraryCreatedByFilter === 'shared') {
        const owner = f.ownerId || null;
        // Shared with me: แสดงเฉพาะไฟล์ที่คนอื่นเป็น owner (badge "Other") ไม่รวมของเรา
        if (owner == null || owner === currentClientId) return false;
        return true;
      }
      return true;
    })
    .sort((a, b) => (fileSort === 'time' ? (b.uploadDate || 0) - (a.uploadDate || 0) : (a.name || '').localeCompare(b.name || '')));

  // ชื่อไฟล์ที่ Set ใช้ (จาก snapshot หรือ items)
  const getFileNamesForSet = (set) => {
    const names = new Set();
    (set.fileLibrarySnapshot || []).forEach((s) => s.name && names.add(s.name));
    (set.items || []).forEach((t) => {
      if (t.vcdName) names.add(t.vcdName);
      if (t.binName) names.add(t.binName);
      if (t.linName) names.add(t.linName);
    });
    return [...names];
  };
  const getTestCaseStatusFromJobs = useCallback(
    (tc) => {
      if (!tc) return null;
      const v = (tc.vcdName || '').trim().toLowerCase();
      const b = (tc.binName || '').trim().toLowerCase();
      const l = (tc.linName || '').trim().toLowerCase();
      const fileKey = `${v}||${b}||${l}`;
      if (fileKey !== '||||') {
        if (testCaseStatusByFileKey.has(fileKey)) {
          return testCaseStatusByFileKey.get(fileKey);
        }
        return null;
      }
      const name = (tc.name || '').trim();
      if (name && testCaseStatusByName.has(name)) {
        return testCaseStatusByName.get(name);
      }
      return null;
    },
    [testCaseStatusByName, testCaseStatusByFileKey]
  );

  // Test case history: jobs/sets where this test case (vcd+erom+ulp or testCaseName) was used
  const getTestCaseHistory = useCallback((tc) => {
    if (!tc || !jobs?.length) return [];
    const vcd = (tc.vcdName || '').trim().toLowerCase();
    const erom = (tc.binName || '').trim().toLowerCase();
    const lin = (tc.linName || '').trim().toLowerCase();
    const tcName = (tc.name || '').trim();
    if (!vcd && !erom && !tcName) return [];
    const out = [];
    const seen = new Set();
    jobs.forEach((job) => {
      (job.files || []).forEach((f, fileIndex) => {
        const key = `${job.id}-${fileIndex}`;
        if (seen.has(key)) return;
        const fVcd = (f.vcd || f.name || '').trim().toLowerCase();
        const fErom = (f.erom || '').trim().toLowerCase();
        const fUlp = (f.ulp || '').trim().toLowerCase();
        const fTcName = (f.testCaseName || '').trim();
        const matchByFiles = (fVcd === vcd && fErom === erom && fUlp === lin);
        const matchByNameAndVcd = tcName && fTcName === tcName && (!vcd || fVcd === vcd);
        if (matchByFiles || matchByNameAndVcd) {
          seen.add(key);
          out.push({ job, fileIndex });
        }
      });
    });
    return out;
  }, [jobs]);

  const [testCaseHistoryFor, setTestCaseHistoryFor] = useState(null);

  const filesBySet =
    fileViewMode === 'bySet'
      ? (savedTestCaseSets || []).map((set) => ({
          set,
          files: filteredFiles.filter((f) => getFileNamesForSet(set).includes(f.name)),
        }))
      : [];

  const focusFileInLibrary = (rawName) => {
    const fileName = typeof rawName === 'string' ? rawName.trim() : '';
    if (!fileName) return;

    setLibraryView('files');
    setFileViewMode('all');
    setFileFilter('all');
    setFileSearch('');
    setLibraryFocusFileName(fileName);

    const match = (uploadedFiles || []).find((f) => f.name === fileName);
    if (match?.id) {
      setSelectedLibraryFileIds([match.id]);
    } else {
      setSelectedLibraryFileIds([]);
      addToast({ type: 'info', message: `File "${fileName}" is not in File in Library yet. Upload it on the Test Cases page first.` });
    }
  };

  // When navigating from JobsPage (or other) with a file to focus
  useEffect(() => {
    if (!libraryFocusFileNameOnNavigate) return;
    const fileName = libraryFocusFileNameOnNavigate;
    clearLibraryFocusFileNameOnNavigate();
    setLibraryView('files');
    setFileViewMode('all');
    setFileFilter('all');
    setFileSearch('');
    setLibraryFocusFileName(fileName);
    const match = (uploadedFiles || []).find((f) => f.name === fileName);
    if (match?.id) {
      setSelectedLibraryFileIds([match.id]);
    } else {
      setSelectedLibraryFileIds([]);
      addToast({ type: 'info', message: `File "${fileName}" is not in File in Library yet. Upload it on the Test Cases page first.` });
    }
  }, [libraryFocusFileNameOnNavigate]);

  useEffect(() => {
    if (libraryView !== 'files') return;
    if (!libraryFocusFileName) return;
    const el = focusedLibraryFileRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [libraryView, libraryFocusFileName, filteredFiles.length]);

  const libraryRawRows = useMemo(() => {
    if (libraryView !== 'rawTestCases') return [];
    const withMdi = (tc) => {
      const cmds = Array.isArray(tc.commands) ? tc.commands : [];
      const mdiNames = cmds
        .filter((c) => c && c.type === 'mdi' && c.file)
        .map((c) => c.file);
      if (!mdiNames.length) return tc;
      return { ...tc, mdiNames };
    };
    const contentKey = (tc) => [
      tc.name ?? '',
      tc.vcdName ?? '',
      tc.binName ?? '',
      tc.linName ?? '',
    ].join('\0');
    const withStatus = (tc) => ({
      ...withMdi(tc),
      _status: getTestCaseStatusFromJobs(tc),
    });

    const hasRemoteData =
      (allProfilesTestData.savedTestCases && allProfilesTestData.savedTestCases.length > 0) ||
      (allProfilesTestData.savedTestCaseSets && allProfilesTestData.savedTestCaseSets.length > 0);
    const useRemote = libraryCreatedByFilter !== 'mine' && hasRemoteData;

    // Choose source: current profile only vs all profiles (when remote data available)
    const sourceCases = useRemote
      ? allProfilesTestData.savedTestCases || []
      : (savedTestCases || []).map((tc) => ({
          ...tc,
          _ownerId: activeProfileId,
          _ownerName: activeProfile.name,
        }));

    const sourceSets = useRemote
      ? allProfilesTestData.savedTestCaseSets || []
      : (savedTestCaseSets || []).map((set) => ({
          ...set,
          _ownerId: activeProfileId,
          _ownerName: activeProfile.name,
        }));

    const fromCurrent = sourceCases.map((tc) =>
      withStatus({
        ...tc,
        _key: `current-${tc.id || `${tc._ownerId || 'unknown'}-${tc.name || ''}`}`,
        _source: 'current',
        _owner: tc._ownerName ?? activeProfile.name,
        _ownerId: tc._ownerId ?? activeProfileId,
      })
    );
    const seen = new Set(fromCurrent.map((tc) => contentKey(tc)));
    const fromSets = (sourceSets || []).flatMap((set) =>
      (Array.isArray(set.items) ? set.items : []).map((tc, tcIdx) =>
        withStatus({
          ...tc,
          _key: `set-${set.id}-${tcIdx}`,
          _source: 'set',
          _setId: set.id,
          _itemIndex: tcIdx,
          _owner: set._ownerName ?? activeProfile.name,
          _ownerId: set._ownerId ?? activeProfileId,
        })
      )
    );
    const fromSetsDeduped = fromSets.filter((tc) => {
      const key = contentKey(tc);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...fromCurrent, ...fromSetsDeduped];
  }, [
    libraryView,
    savedTestCases,
    savedTestCaseSets,
    getTestCaseStatusFromJobs,
    activeProfile,
    activeProfileId,
    libraryCreatedByFilter,
    allProfilesTestData,
  ]);

  const libraryFilteredRows = useMemo(() => {
    return libraryRawRows.filter((tc) => {
      if (libraryTcNameFilter.trim() && !(tc.name || '').toLowerCase().includes(libraryTcNameFilter.trim().toLowerCase())) return false;
      const tagVal = (tc.extraColumns && (tc.extraColumns.tag || tc.extraColumns.Tag)) || '';
      if (libraryTcTagFilter.trim() && !String(tagVal).toLowerCase().includes(libraryTcTagFilter.trim().toLowerCase())) return false;
      if (libraryTcStatusFilter !== 'all') {
        const status = tc._status || null;
        if (!status) return false;
        if (libraryTcStatusFilter !== status) return false;
      }
      if (libraryCreatedByFilter === 'mine' && tc._ownerId !== activeProfileId) return false;
      if (libraryCreatedByFilter === 'shared' && (tc._ownerId === activeProfileId || !tc._ownerId)) return false;
      return true;
    });
  }, [libraryRawRows, libraryTcNameFilter, libraryTcTagFilter, libraryTcStatusFilter, libraryCreatedByFilter, activeProfileId]);

  useEffect(() => {
    const onMouseUp = () => {
      isDragSelectingLibraryRef.current = false;
      isDragSelectingLibrarySetRef.current = false;
      isDragSelectingFileRef.current = false;
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  const handleDeleteAll = async () => {
    if (!uploadedFiles?.length) return;
    const inUseCount = uploadedFiles.filter((f) => fileNamesInUseByBatch.has(f.name)).length;
    const toDelete = uploadedFiles.filter((f) => !fileNamesInUseByBatch.has(f.name));
    if (toDelete.length === 0) {
      addToast({ type: 'warning', message: 'ไฟล์ทั้งหมดกำลังถูกใช้โดย set (running/pending) — ไม่สามารถลบได้จนกว่า process จะจบ' });
      return;
    }
    if (!window.confirm(`Delete ${toDelete.length} file(s) from Library?${inUseCount > 0 ? `\n\n${inUseCount} file(s) กำลังถูกใช้ (running/pending) จะไม่ถูกลบ` : ''}`)) return;
    setIsDeleting(true);
    let deleted = 0;
    for (const f of toDelete) {
      const ok = await removeUploadedFile(f.id);
      if (ok) deleted++;
    }
    setIsDeleting(false);
    if (deleted > 0) addToast({ type: 'success', message: `Deleted ${deleted} file(s)` });
    if (inUseCount > 0) addToast({ type: 'info', message: `${inUseCount} file(s) ไม่ถูกลบ (กำลังถูกใช้โดย set)` });
  };

  const handleDeleteBox = async (setId, files) => {
    if (!files?.length) return;
    const toDelete = files.filter((f) => !fileNamesInUseByBatch.has(f.name));
    const inUseCount = files.length - toDelete.length;
    if (toDelete.length === 0) {
      addToast({ type: 'warning', message: 'ไฟล์ในกล่องนี้ทั้งหมดกำลังถูกใช้ (running/pending) — ไม่สามารถลบได้' });
      return;
    }
    if (!window.confirm(`Delete ${toDelete.length} file(s) in this box from Library?${inUseCount > 0 ? `\n\n${inUseCount} file(s) กำลังถูกใช้ จะไม่ถูกลบ` : ''}`)) return;
    setDeletingBoxId(setId);
    let deleted = 0;
    for (const f of toDelete) {
      const ok = await removeUploadedFile(f.id);
      if (ok) deleted++;
    }
    setDeletingBoxId(null);
    if (deleted > 0) addToast({ type: 'success', message: `Deleted ${deleted} file(s) from box` });
    if (inUseCount > 0) addToast({ type: 'info', message: `${inUseCount} file(s) ไม่ถูกลบ (กำลังถูกใช้)` });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { if (!isImporting) setIsImportModalOpen(false); }}
          />
          <div className="relative w-[min(900px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Upload size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  Import files
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Drop/paste/add more files, preview, set name/tag, then save
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
                className="ml-auto p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(100vh-10rem)]">
              <div
                className={`rounded-xl border-2 border-dashed p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                  isImportDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsImportDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!e.currentTarget.contains(e.relatedTarget)) setIsImportDragging(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsImportDragging(false);
                  const files = await collectFilesFromDataTransfer(e.dataTransfer);
                  if (files?.length) enqueueImportDrafts(files);
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items || [];
                  const files = [];
                  for (const it of items) {
                    if (it.kind === 'file') {
                      const f = it.getAsFile();
                      if (f) files.push(f);
                    }
                  }
                  if (files.length) enqueueImportDrafts(files);
                }}
                tabIndex={0}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Drop files/folder here
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Or paste (Cmd+V) or browse files
                  </div>
                </div>
                <div className="sm:ml-auto flex items-center gap-2">
                  <input
                    ref={fileImportInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files?.length) enqueueImportDrafts(files);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileImportInputRef.current?.click()}
                    disabled={isImporting}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Browse
                  </button>
                  {isImporting && <span className="text-xs text-slate-500 dark:text-slate-400">Saving…</span>}
                </div>
              </div>

              {importDrafts.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-10">
                  Drop or browse to add files.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Preview ({importDrafts.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setImportDrafts([])}
                      disabled={isImporting}
                      className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 disabled:opacity-60"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveImportDraftsToLibrary()}
                      disabled={isImporting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Save to Library
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {importDrafts.map((d) => (
                      <div key={d.id} className="px-4 py-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-14">Name</span>
                        <input
                          type="text"
                          value={d.name}
                          onChange={(e) => setImportDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x))}
                          disabled={isImporting}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-w-[220px] flex-1"
                        />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-10">Tag</span>
                        <input
                          type="text"
                          value={d.tag}
                          onChange={(e) => setImportDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, tag: e.target.value } : x))}
                          disabled={isImporting}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-44"
                          placeholder="tag"
                        />
                        <button
                          type="button"
                          onClick={() => setImportDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                          disabled={isImporting}
                          className="ml-auto p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAllTagsForFileId && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAllTagsForFileId(null)}
          />
          <div className="relative w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                Tags
              </div>
              <button
                type="button"
                onClick={() => setShowAllTagsForFileId(null)}
                className="ml-auto p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {(() => {
                const raw = (fileTags && fileTags[showAllTagsForFileId]) || '';
                const tags = splitTags(raw);
                return tags.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No tags</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t, i) => (
                      <span
                        key={`${showAllTagsForFileId}-alltag-${i}-${t}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                      >
                        <span className="max-w-[360px] truncate" title={t}>{t}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const current = (fileTags && fileTags[showAllTagsForFileId]) || '';
                            const next = removeOneTagFromString(current, t);
                            setFileTag?.(showAllTagsForFileId, next);
                          }}
                          className="ml-0.5 w-5 h-5 rounded-full inline-flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/40"
                          title="Remove tag"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Library</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setLibraryView('files')}
              className={`px-3 py-1.5 text-xs font-semibold ${libraryView === 'files' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              Files
            </button>
            <button
              type="button"
              onClick={() => setLibraryView('rawTestCases')}
              className={`px-3 py-1.5 text-xs font-semibold ${libraryView === 'rawTestCases' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              Test Cases
            </button>
            <button
              type="button"
              onClick={() => setLibraryView('testCases')}
              className={`px-3 py-1.5 text-xs font-semibold ${libraryView === 'testCases' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              Sets
            </button>
          </div>
          {onNavigateToTestCases && (
            <button type="button" onClick={onNavigateToTestCases} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">
              Go to Test Cases <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {libraryView === 'testCases' ? (
        /* Test Case Library — sets with filter name/tag, multi-select, delete icon */
        (() => {
          const selectedSetKeys = new Set(selectedLibrarySetTcKeys);
          const handleDeleteSelectedSetTcs = () => {
            if (selectedSetKeys.size === 0) {
              addToast({ type: 'info', message: 'Select test case(s) first' });
              return;
            }
            if (!window.confirm(`Delete ${selectedSetKeys.size} selected test case(s) from set(s)?`)) return;
            const bySet = {};
            selectedSetKeys.forEach((key) => {
              const sep = key.indexOf('::');
              if (sep < 0) return;
              const setId = key.slice(0, sep);
              const idx = parseInt(key.slice(sep + 2), 10);
              if (isNaN(idx)) return;
              if (!bySet[setId]) bySet[setId] = new Set();
              bySet[setId].add(idx);
            });
            Object.entries(bySet).forEach(([setId, indices]) => {
              const set = (savedTestCaseSets || []).find((s) => s.id === setId);
              if (!set || !Array.isArray(set.items)) return;
              const newItems = set.items.filter((_, i) => !indices.has(i));
              updateSavedTestCaseSet(setId, { items: newItems });
            });
            setSelectedLibrarySetTcKeys([]);
            addToast({ type: 'success', message: `Deleted ${selectedSetKeys.size} test case(s)` });
          };
          return (
            <div className="space-y-6">
              <div className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3">
                <select
                  value={libraryCreatedByFilter}
                  onChange={(e) => setLibraryCreatedByFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                  title="Filter by creator"
                >
                  <option value="all">All</option>
                  <option value="mine">Mine</option>
                  <option value="shared">Shared with me</option>
                </select>
                <input type="text" value={librarySetTcNameFilter} onChange={(e) => setLibrarySetTcNameFilter(e.target.value)} placeholder="Filter by name" className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-40" />
                <input type="text" value={librarySetTcTagFilter} onChange={(e) => setLibrarySetTcTagFilter(e.target.value)} placeholder="Filter by tag" className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-32" />
                <select
                  value={librarySetTcStatusFilter}
                  onChange={(e) => setLibrarySetTcStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                >
                  <option value="all">All status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                </select>
                <button type="button" onClick={handleDeleteSelectedSetTcs} disabled={selectedSetKeys.size === 0} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:pointer-events-none transition-colors" title={selectedSetKeys.size > 0 ? `Delete ${selectedSetKeys.size} selected` : 'Select test cases to delete'}>
                  <Trash2 size={18} strokeWidth={2} />
                </button>
                {selectedSetKeys.size > 0 && <span className="text-xs text-slate-500">{selectedSetKeys.size} selected</span>}
                <span className="text-xs text-slate-400">Click, Shift+click range, Ctrl/Cmd+click toggle, or drag to select. Double-click a row to edit in Test Cases page.</span>
              </div>
              {libraryCreatedByFilter !== 'mine' && allProfilesTestDataLoading ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                  Loading sets from all profiles…
                </div>
              ) : !(
                (libraryCreatedByFilter === 'mine' ? savedTestCaseSets : allProfilesTestData.savedTestCaseSets) || []
              )?.length ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                  No sets yet — create test cases and Save Set on the Test Cases page
                </div>
              ) : (
                (libraryCreatedByFilter === 'mine'
                  ? (savedTestCaseSets || []).map((set) => ({
                      ...set,
                      _ownerId: activeProfileId,
                      _ownerName: activeProfile.name,
                    }))
                  : (allProfilesTestData.savedTestCaseSets || []).filter(
                      (set) =>
                        libraryCreatedByFilter !== 'shared' ||
                        (set._ownerId && set._ownerId !== activeProfileId)
                    )
                ).map((set, setIdx) => {
                  const items = Array.isArray(set.items) ? set.items : [];
                  const itemsWithIndex = items.map((tc, i) => ({ ...tc, _origIndex: i, _status: getTestCaseStatusFromJobs(tc) }));
                  const filteredItems = itemsWithIndex.filter((tc) => {
                    if (librarySetTcNameFilter.trim() && !(tc.name || '').toLowerCase().includes(librarySetTcNameFilter.trim().toLowerCase())) return false;
                    const tagVal = (tc.extraColumns && (tc.extraColumns.tag || tc.extraColumns.Tag)) || '';
                    if (librarySetTcTagFilter.trim() && !String(tagVal).toLowerCase().includes(librarySetTcTagFilter.trim().toLowerCase())) return false;
                    if (librarySetTcStatusFilter !== 'all') {
                      const status = tc._status || null;
                      if (!status) return false;
                      if (librarySetTcStatusFilter !== status) return false;
                    }
                    return true;
                  });
                  const extraCols = [...new Set((items || []).flatMap((t) => Object.keys(t.extraColumns || {})))].sort();
                  const setName = set.name || `Set ${setIdx + 1}`;
                  const setStatusRaw = setStatusByName.get(setName) || null;
                  const setStatus = (setStatusRaw || '').toLowerCase();
                  const isSetLocked = setStatus === 'running';
                  const toggleSetTc = (key, rowIndex, e) => {
                    const last = lastClickedLibrarySetTcRef.current;
                    if (e.shiftKey && last.setId === set.id) {
                      const from = Math.min(last.index, rowIndex);
                      const to = Math.max(last.index, rowIndex);
                      const keysToAdd = filteredItems.slice(from, to + 1).map((r) => `${set.id}::${r._origIndex}`);
                      setSelectedLibrarySetTcKeys((prev) => [...new Set([...prev, ...keysToAdd])]);
                      lastClickedLibrarySetTcRef.current = { setId: set.id, index: rowIndex };
                      return;
                    }
                    if (e.ctrlKey || e.metaKey) {
                      setSelectedLibrarySetTcKeys((prev) => (selectedSetKeys.has(key) ? prev.filter((k) => k !== key) : [...prev, key]));
                      lastClickedLibrarySetTcRef.current = { setId: set.id, index: rowIndex };
                      return;
                    }
                    // Simple click: toggle this row (multi-select — user can tick 3–4 items)
                    setSelectedLibrarySetTcKeys((prev) => (selectedSetKeys.has(key) ? prev.filter((k) => k !== key) : [...prev, key]));
                    lastClickedLibrarySetTcRef.current = { setId: set.id, index: rowIndex };
                  };
                  const rowKey = (tc) => `${set.id}::${tc._origIndex}`;
                  const setSelectedKeysInSet = filteredItems.filter((r) => selectedSetKeys.has(rowKey(r))).length;
                  return (
                    <div key={set.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {setName}
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              ({filteredItems.length} test case{filteredItems.length !== 1 ? 's' : ''}{filteredItems.length !== items.length ? `, filtered from ${items.length}` : ''})
                            </span>
                          </h2>
                          {setStatus && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                setStatus === 'running'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700'
                                  : setStatus === 'pending'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {setStatus.charAt(0).toUpperCase() + setStatus.slice(1)}
                            </span>
                          )}
                          {isSetLocked && (
                            <span className="text-[11px] text-slate-400 italic">
                              (locked while set is {setStatus})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {setSelectedKeysInSet > 0 && (
                            <span className="text-xs text-slate-500">{setSelectedKeysInSet} selected</span>
                          )}
                          {onNavigateToTestCases && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isSetLocked) {
                                  addToast({
                                    type: 'warning',
                                    message:
                                      'ชุด Set นี้กำลังถูกใช้รันอยู่ (pending/running) — กรุณารอให้จบก่อนจึงจะแก้ไขได้',
                                  });
                                  return;
                                }
                                onNavigateToTestCases();
                              }}
                              className={`text-xs font-medium hover:underline ${
                                isSetLocked
                                  ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                              disabled={isSetLocked}
                              title={
                                isSetLocked
                                  ? 'Set is running or pending — cannot edit test cases now'
                                  : 'Edit test cases in this set'
                              }
                            >
                              Edit Test Cases
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (isSetLocked) {
                                addToast({ type: 'warning', message: 'Set กำลังรันหรือรอคิว — ไม่สามารถลบได้จนกว่าจะจบ process' });
                                return;
                              }
                              if (!window.confirm(`Delete set "${setName}"? This will remove it from Saved sets only (test cases and files in Library will stay).`)) return;
                              try {
                                await api.deleteSet(set.id);
                              } catch (e) {
                                if (!String(e?.message || '').includes('404')) addToast({ type: 'warning', message: `Backend: ${e?.message || 'Delete failed'}` });
                              }
                              removeSavedTestCaseSet(set.id);
                              setSelectedLibrarySetTcKeys((prev) => prev.filter((k) => !k.startsWith(set.id + '::')));
                              addToast({ type: 'success', message: `Deleted set "${setName}"` });
                            }}
                            disabled={isSetLocked}
                            className={`p-1.5 rounded ${isSetLocked ? 'opacity-50 cursor-not-allowed text-slate-400' : 'hover:bg-red-600/10 text-red-600 dark:text-red-400'}`}
                            title={isSetLocked ? 'ไม่สามารถลบได้ — Set กำลัง running/pending' : 'Delete set from Saved (ไม่ลบ test cases หรือไฟล์ใน Library)'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto table-scroll-smooth" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
                        <table className="w-full text-sm min-w-max">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                              <th className="w-9 px-2 py-2 border-r border-slate-200 dark:border-slate-600">#</th>
                              <th className="w-8 px-2 py-2 border-r border-slate-200 dark:border-slate-600">#</th>
                              <th className="min-w-[120px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">Name</th>
                              <th className="w-24 px-2 py-2 border-r border-slate-200 dark:border-slate-600" title="Owner">Owner</th>
                              <th className="w-10 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center" title="Visibility">Vis</th>
                              <th className="w-24 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Date</th>
                              <th className="min-w-[100px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">ERoM</th>
                              <th className="min-w-[100px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">ULP</th>
                              <th className="min-w-[100px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">VCD</th>
                              {extraCols.map((col) => (<th key={col} className="px-2 py-2 border-r border-slate-200 dark:border-slate-600 min-w-[90px] whitespace-nowrap">{col}</th>))}
                              <th className="w-14 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Try</th>
                              <th className="w-20 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Status</th>
                              <th className="w-20 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">History</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredItems.length === 0 ? (
                              <tr>
                                <td colSpan={12 + extraCols.length} className="px-2 py-4 text-center text-slate-400 text-xs">No test cases in this set{items.length > 0 ? ' (or no match for filter)' : ''}</td>
                              </tr>
                            ) : (
                              filteredItems.map((tc, idx) => {
                                const key = rowKey(tc);
                                const isSelected = selectedSetKeys.has(key);
                                const historyCount = getTestCaseHistory(tc).length;
                                return (
                                  <tr
                                    key={key}
                                    className={`border-b border-slate-100 dark:border-slate-700 cursor-pointer select-none ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                    onClick={(e) => { if (e.target.closest('input[type="checkbox"]')) return; toggleSetTc(key, idx, e); }}
                                    onDoubleClick={(e) => {
                                      if (e.target.closest('input[type="checkbox"]')) return;
                                      if (onNavigateToTestCases && setLibraryEditContext) {
                                        setLibraryEditContext({ loadSetId: set.id, focusTcIndex: tc._origIndex });
                                        onNavigateToTestCases();
                                      }
                                    }}
                                    title="Double-click to edit in Test Cases page"
                                    onMouseDown={(e) => { if (e.target.closest('input[type="checkbox"]')) return; if (e.button === 0) { isDragSelectingLibrarySetRef.current = true; if (!selectedSetKeys.has(key)) setSelectedLibrarySetTcKeys((prev) => [...prev, key]); } }}
                                    onMouseEnter={() => { if (!isDragSelectingLibrarySetRef.current) return; if (!selectedSetKeys.has(key)) setSelectedLibrarySetTcKeys((prev) => [...prev, key]); }}
                                  >
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                                      <input type="checkbox" checked={isSelected} onChange={() => toggleSetTc(key, idx, { shiftKey: false, ctrlKey: false, metaKey: false })} className="w-4 h-4 rounded cursor-pointer" />
                                    </td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-500">{idx + 1}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200">{tc.name || '—'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[80px]" title={activeProfile.name}>{activeProfile.name}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center" title="public"><span className="inline-flex items-center justify-center text-slate-400 dark:text-slate-500"><Globe size={14} /></span></td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400 text-xs">{tc.createdAt ? new Date(tc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">{tc.binName || '—'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">{tc.linName || '—'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">{tc.vcdName || '—'}</td>
                                    {extraCols.map((col) => (<td key={col} className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 min-w-[90px] truncate max-w-[140px]" title={tc.extraColumns?.[col] || undefined}>{tc.extraColumns?.[col] ?? '—'}</td>))}
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center text-slate-600 dark:text-slate-400">{typeof tc.tryCount === 'number' && tc.tryCount > 0 ? tc.tryCount : 1}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center">
                                      {(() => {
                                        const status = tc._status || null;
                                        if (status === 'running') {
                                          return (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold" title="Running in current set(s)">
                                              Running
                                            </span>
                                          );
                                        }
                                        if (status === 'pending') {
                                          return (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 text-[10px] font-semibold" title="Pending in run queue">
                                              Pending
                                            </span>
                                          );
                                        }
                                        if (status === 'completed') {
                                          return (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold" title="Completed in past run(s)">
                                              Completed
                                            </span>
                                          );
                                        }
                                        return <span className="text-slate-400 dark:text-slate-500 text-[10px]">—</span>;
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center">
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setTestCaseHistoryFor({ tc }); }}
                                        className="inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        title="View job/set history for this test case"
                                      >
                                        <History size={14} />
                                        {historyCount > 0 && <span className="text-[10px] font-medium">{historyCount}</span>}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })()
      ) : libraryView === 'rawTestCases' ? (
        /* Raw Test Cases — filter name/tag, multi-select (shift/ctrl + drag), delete selected */
        (() => {
          const selectedSet = new Set(selectedLibraryTcKeys);
          const isTcRowLocked = (row) => (row._status === 'running' || row._status === 'pending');
          const selectableTcKeys = libraryFilteredRows.filter((r) => !isTcRowLocked(r)).map((r) => r._key).filter(Boolean);
          const hasRunningOrPendingInSelection = libraryFilteredRows.some((r) => selectedSet.has(r._key) && isTcRowLocked(r));
          const getExtraColKeys = (t) => {
            const fromExtra = Object.keys(t.extraColumns || {});
            const fromCmds = [];
            (t.commands || []).filter((c) => c.type === 'vcd' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`VCD${i + 2}`));
            (t.commands || []).filter((c) => c.type === 'erom' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ERoM${i + 2}`));
            (t.commands || []).filter((c) => c.type === 'ulp' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ULP${i + 2}`));
            return [...fromExtra, ...fromCmds];
          };
          const getExtraVal = (t, col) => {
            const m = col.match(/^VCD(\d+)$/);
            if (m) {
              const idx = parseInt(m[1], 10) - 2;
              const vcds = (t.commands || []).filter((c) => c.type === 'vcd' && (c.file || '').trim());
              return vcds[idx]?.file ?? t.extraColumns?.[col] ?? '';
            }
            const m2 = col.match(/^ERoM(\d+)$/);
            if (m2) {
              const idx = parseInt(m2[1], 10) - 2;
              const eroms = (t.commands || []).filter((c) => c.type === 'erom' && (c.file || '').trim());
              return eroms[idx]?.file ?? t.extraColumns?.[col] ?? '';
            }
            const m3 = col.match(/^ULP(\d+)$/);
            if (m3) {
              const idx = parseInt(m3[1], 10) - 2;
              const ulps = (t.commands || []).filter((c) => c.type === 'ulp' && (c.file || '').trim());
              return ulps[idx]?.file ?? t.extraColumns?.[col] ?? '';
            }
            return t.extraColumns?.[col] ?? '';
          };
         const allCols = [...new Set(libraryFilteredRows.flatMap(getExtraColKeys))].sort();
         const extraCols = allCols
           .filter((col) => !/^tag(color)?$/i.test(col))
           .filter((col) => libraryFilteredRows.some((t) => (getExtraVal(t, col) ?? '').toString().trim() !== ''));
          const toggleSelect = (key, idx, e) => {
            const row = libraryFilteredRows[idx];
            if (row && isTcRowLocked(row)) return;
            if (e.shiftKey) {
              const last = lastClickedLibraryTcIndexRef.current;
              const from = last != null ? Math.min(last, idx) : idx;
              const to = last != null ? Math.max(last, idx) : idx;
              const keysToAdd = libraryFilteredRows.slice(from, to + 1).filter((r) => !isTcRowLocked(r)).map((r) => r._key).filter(Boolean);
              setSelectedLibraryTcKeys((prev) => [...new Set([...prev, ...keysToAdd])]);
              lastClickedLibraryTcIndexRef.current = idx;
              return;
            }
            if (e.ctrlKey || e.metaKey) {
              setSelectedLibraryTcKeys((prev) =>
                selectedSet.has(key) ? prev.filter((k) => k !== key) : [...prev, key]
              );
              lastClickedLibraryTcIndexRef.current = idx;
              return;
            }
            setSelectedLibraryTcKeys((prev) =>
              selectedSet.has(key) ? prev.filter((k) => k !== key) : [...prev, key]
            );
            lastClickedLibraryTcIndexRef.current = idx;
          };
          const handleRowMouseDown = (key, idx) => {
            const row = libraryFilteredRows[idx];
            if (row && isTcRowLocked(row)) return;
            isDragSelectingLibraryRef.current = true;
            if (!selectedSet.has(key)) setSelectedLibraryTcKeys((prev) => [...prev, key]);
          };
          const handleRowMouseEnter = (key, idx) => {
            const row = libraryFilteredRows[idx];
            if (row && isTcRowLocked(row)) return;
            if (!isDragSelectingLibraryRef.current) return;
            if (!selectedSet.has(key)) setSelectedLibraryTcKeys((prev) => [...prev, key]);
          };
          const handleDeleteSelected = () => {
            if (selectedSet.size === 0) {
              addToast({ type: 'info', message: 'Select test case(s) first' });
              return;
            }
            if (hasRunningOrPendingInSelection) {
              addToast({ type: 'warning', message: 'Test case ที่มีสถานะ Running/Pending ไม่สามารถลบได้ — รอให้ process จบก่อน' });
              return;
            }
            if (!window.confirm(`Delete ${selectedSet.size} selected test case(s)?`)) return;
            const toRemove = libraryRawRows.filter((r) => r._key && selectedSet.has(r._key)).filter((r) => !isTcRowLocked(r));
            const bySet = {};
            toRemove.forEach((row) => {
              if (row._source === 'current' && row.id) {
                removeSavedTestCase(row.id);
              } else if (row._source === 'set' && row._setId != null && row._itemIndex != null) {
                if (!bySet[row._setId]) bySet[row._setId] = new Set();
                bySet[row._setId].add(row._itemIndex);
              }
            });
            Object.entries(bySet).forEach(([setId, indices]) => {
              const set = (savedTestCaseSets || []).find((s) => s.id === setId);
              if (!set || !Array.isArray(set.items)) return;
              const newItems = set.items.filter((_, i) => !indices.has(i));
              updateSavedTestCaseSet(setId, { items: newItems });
            });
            setSelectedLibraryTcKeys([]);
            addToast({ type: 'success', message: `Deleted ${toRemove.length} test case(s)` });
          };
          return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Raw Test Cases</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1"></p>
              </div>
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
                <select
                  value={libraryCreatedByFilter}
                  onChange={(e) => setLibraryCreatedByFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                  title="Filter by creator"
                >
                  <option value="all">All</option>
                  <option value="mine">Mine</option>
                  <option value="shared">Shared with me</option>
                </select>
                <input
                  type="text"
                  value={libraryTcNameFilter}
                  onChange={(e) => setLibraryTcNameFilter(e.target.value)}
                  placeholder="Filter by name"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-40"
                />
                <input
                  type="text"
                  value={libraryTcTagFilter}
                  onChange={(e) => setLibraryTcTagFilter(e.target.value)}
                  placeholder="Filter by tag"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-32"
                />
                <select
                  value={libraryTcStatusFilter}
                  onChange={(e) => setLibraryTcStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                >
                  <option value="all">All status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                </select>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedSet.size === 0 || hasRunningOrPendingInSelection}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title={hasRunningOrPendingInSelection ? 'ไม่สามารถลบได้ — มี test case ที่กำลัง Running/Pending' : selectedSet.size > 0 ? `Delete ${selectedSet.size} selected` : 'Select test cases to delete'}
                >
                  <Trash2 size={18} strokeWidth={2} />
                </button>
                {selectedSet.size > 0 && (
                  <span className="text-xs text-slate-500">{selectedSet.size} selected{hasRunningOrPendingInSelection ? ' (มีรายการที่ล็อก)' : ''}</span>
                )}
              </div>
              <div className="overflow-x-auto overflow-y-visible rounded-b-xl table-scroll-smooth" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                      <th className="w-9 px-2 py-2 border-r border-slate-200 dark:border-slate-600 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">
                        <input
                          type="checkbox"
                          checked={selectableTcKeys.length > 0 && selectableTcKeys.every((k) => selectedSet.has(k))}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedLibraryTcKeys([...selectableTcKeys]);
                            else setSelectedLibraryTcKeys([]);
                          }}
                          className="w-4 h-4 rounded cursor-pointer"
                          title="Select all (excluding running/pending)"
                        />
                      </th>
                      <th className="w-8 px-2 py-2 border-r border-slate-200 dark:border-slate-600">#</th>
                      <th className="min-w-[120px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">Name</th>
                      <th className="w-24 px-2 py-2 border-r border-slate-200 dark:border-slate-600" title="Owner">Owner</th>
                      <th className="w-10 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center" title="Visibility">Vis</th>
                      <th className="w-28 px-2 py-2 border-r border-slate-200 dark:border-slate-600">Tag</th>
                      <th className="w-24 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Date</th>
                      <th className="min-w-[100px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">ERoM</th>
                      <th className="min-w-[100px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">ULP</th>
                      <th className="min-w-[100px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">VCD</th>
                      <th className="min-w-[140px] px-2 py-2 border-r border-slate-200 dark:border-slate-600">MDI (text)</th>
                      {extraCols.map((col) => (
                        <th key={col} className="px-2 py-2 border-r border-slate-200 dark:border-slate-600 min-w-[90px] whitespace-nowrap">{col}</th>
                      ))}
                      <th className="w-14 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Try</th>
                      <th className="w-24 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Status</th>
                      <th className="w-20 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libraryFilteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={14 + extraCols.length} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                          No test cases yet — or no match for filter. Create on Test Cases page or clear filters.
                        </td>
                      </tr>
                    ) : (
                      libraryFilteredRows.map((tc, idx) => {
                        const key = tc._key || `row-${idx}`;
                        const isSelected = selectedSet.has(key);
                        const isRowLocked = isTcRowLocked(tc);
                        const historyCount = getTestCaseHistory(tc).length;
                        return (
                          <tr
                            key={key}
                            className={`border-b border-slate-100 dark:border-slate-700 select-none ${isRowLocked ? 'opacity-75 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : !isRowLocked ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                            onClick={(e) => {
                              if (e.target.closest('input[type="checkbox"]')) return;
                              if (isRowLocked) return;
                              toggleSelect(key, idx, e);
                            }}
                            onDoubleClick={(e) => {
                              if (e.target.closest('input[type="checkbox"]')) return;
                              if (isRowLocked) {
                                addToast({ type: 'warning', message: 'Test case กำลัง Running/Pending — ไม่สามารถแก้ไขได้จนกว่า process จะจบ' });
                                return;
                              }
                              if (onNavigateToTestCases && setLibraryEditContext) {
                                if (tc._source === 'current' && tc.id) {
                                  setLibraryEditContext({ focusTcId: tc.id });
                                } else if (tc._source === 'set' && tc._setId != null && tc._itemIndex != null) {
                                  setLibraryEditContext({ loadSetId: tc._setId, focusTcIndex: tc._itemIndex });
                                } else {
                                  setLibraryEditContext(null);
                                }
                                onNavigateToTestCases();
                              }
                            }}
                            title={isRowLocked ? 'กำลัง Running/Pending — ล็อกการแก้ไข/ลบ' : 'Double-click to edit in Test Cases page'}
                            onMouseDown={(e) => {
                              if (e.target.closest('input[type="checkbox"]')) return;
                              if (isRowLocked) return;
                              if (e.button === 0) handleRowMouseDown(key, idx);
                            }}
                            onMouseEnter={() => { if (!isRowLocked) handleRowMouseEnter(key, idx); }}
                          >
                            <td className={`px-2 py-2 border-r border-slate-100 dark:border-slate-700 sticky left-0 z-[1] ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-900'}`} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isRowLocked}
                                onChange={() => { if (!isRowLocked) toggleSelect(key, idx, { shiftKey: false, ctrlKey: false, metaKey: false }); }}
                                className={`w-4 h-4 rounded ${isRowLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                title={isRowLocked ? 'ไม่สามารถเลือก — กำลัง Running/Pending' : undefined}
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 min-w-[120px]">
                              {tc.name || '—'}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[80px]" title={tc._owner || '—'}>
                              {tc._owner || '—'}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center" title="public">
                              <span className="inline-flex items-center justify-center text-slate-400 dark:text-slate-500" title="public"><Globe size={14} /></span>
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700">
                              {(() => {
                                const rawTag = (tc.extraColumns && (tc.extraColumns.tag || tc.extraColumns.Tag)) || '';
                                const tagVal = String(rawTag || '').trim();
                                const paletteMap = {
                                  mint: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                                  sky: 'bg-sky-100 text-sky-800 border-sky-200',
                                  rose: 'bg-rose-100 text-rose-800 border-rose-200',
                                  amber: 'bg-amber-100 text-amber-800 border-amber-200',
                                  violet: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
                                  slate: 'bg-slate-100 text-slate-700 border-slate-200',
                                };
                                const colorKeyRaw = tc.extraColumns && (tc.extraColumns.tagColor || tc.extraColumns.tag_color);
                                const colorKey = paletteMap[colorKeyRaw] ? colorKeyRaw : 'mint';
                                const palette = paletteMap[colorKey];
                                const cycleColor = (e) => {
                                  e.stopPropagation();
                                  if (!tagVal) return;
                                  const keys = Object.keys(paletteMap);
                                  const idx = Math.max(0, keys.indexOf(colorKey));
                                  const nextKey = keys[(idx + 1) % keys.length];
                                  const nextExtra = {
                                    ...(tc.extraColumns || {}),
                                    tagColor: nextKey,
                                  };
                                  if (tc._source === 'current' && tc.id) {
                                    updateSavedTestCase(tc.id, { extraColumns: nextExtra });
                                  } else if (tc._source === 'set' && tc._setId != null && tc._itemIndex != null) {
                                    const set = (savedTestCaseSets || []).find((s) => s.id === tc._setId);
                                    if (!set || !Array.isArray(set.items)) return;
                                    const items = [...set.items];
                                    if (!items[tc._itemIndex]) return;
                                    items[tc._itemIndex] = {
                                      ...items[tc._itemIndex],
                                      extraColumns: nextExtra,
                                    };
                                    updateSavedTestCaseSet(tc._setId, { items });
                                  }
                                };
                                if (!tagVal) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={cycleColor}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full border border-dashed border-slate-400/60 text-[11px] text-slate-300 hover:border-slate-300 hover:text-slate-200 transition-colors"
                                      title="Click to choose tag color"
                                    >
                                      No tag
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={cycleColor}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium max-w-[130px] ${palette} hover:brightness-95 transition-colors`}
                                    title="Click to change tag color"
                                  >
                                    <span className="w-2 h-2 rounded-full bg-current/70" />
                                    <span className="truncate">{tagVal}</span>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400 text-xs">
                              {tc.createdAt ? new Date(tc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                              {tc.binName ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    focusFileInLibrary(tc.binName);
                                  }}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300"
                                  title="View this file in File in Library"
                                >
                                  {tc.binName}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                              {tc.linName ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    focusFileInLibrary(tc.linName);
                                  }}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300"
                                  title="View this file in File in Library"
                                >
                                  {tc.linName}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                              {tc.vcdName ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    focusFileInLibrary(tc.vcdName);
                                  }}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300"
                                  title="View this file in File in Library"
                                >
                                  {tc.vcdName}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td
                              className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 truncate max-w-[180px]"
                              title={Array.isArray(tc.mdiNames) && tc.mdiNames.length > 0 ? tc.mdiNames.join(', ') : undefined}
                            >
                              {Array.isArray(tc.mdiNames) && tc.mdiNames.length > 0 ? (
                                tc.mdiNames.map((name, idx) => (
                                  <span key={name}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        focusFileInLibrary(String(name));
                                      }}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300"
                                      title="View this file in File in Library"
                                    >
                                      {name}
                                    </button>
                                    {idx < tc.mdiNames.length - 1 ? ', ' : ''}
                                  </span>
                                ))
                              ) : (
                                '—'
                              )}
                            </td>
                            {extraCols.map((col) => (
                              <td
                                key={col}
                                className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 min-w-[90px] truncate max-w-[140px]"
                                title={getExtraVal(tc, col) || undefined}
                              >
                                {(() => {
                                  const val = getExtraVal(tc, col);
                                  if (!val) return '—';
                                  const isFileCol = /^VCD\d+$/i.test(col) || /^ERoM\d+$/i.test(col) || /^ULP\d+$/i.test(col);
                                  if (!isFileCol) return val;
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        focusFileInLibrary(String(val));
                                      }}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300"
                                      title="View this file in File in Library"
                                    >
                                      {val}
                                    </button>
                                  );
                                })()}
                              </td>
                            ))}
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center text-slate-600 dark:text-slate-400">
                              {typeof tc.tryCount === 'number' && tc.tryCount > 0 ? tc.tryCount : 1}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center">
                              {(() => {
                                const status = tc._status || null;
                                if (status === 'running') {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold" title="Running in current set(s)">
                                      Running
                                    </span>
                                  );
                                }
                                if (status === 'pending') {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 text-[10px] font-semibold" title="Pending in run queue">
                                      Pending
                                    </span>
                                  );
                                }
                                if (status === 'completed') {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold" title="Completed in past run(s)">
                                      Completed
                                    </span>
                                  );
                                }
                                if (tc._source === 'set' && tc._setId) {
                                  const setName = (savedTestCaseSets || []).find((s) => s.id === tc._setId)?.name || 'Set';
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 text-[10px] font-medium" title={`In set: ${setName}`}>
                                      In set
                                    </span>
                                  );
                                }
                                return <span className="text-slate-400 dark:text-slate-500 text-[10px]">—</span>;
                              })()}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-100 dark:border-slate-700 text-center">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setTestCaseHistoryFor({ tc }); }}
                                className="inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                title="View job/set history for this test case"
                              >
                                <History size={14} />
                                {historyCount > 0 && <span className="text-[10px] font-medium">{historyCount}</span>}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {onNavigateToTestCases && (
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30">
                  <button
                    type="button"
                    onClick={() => {
                      syncFullLibraryToSavedTestCases();
                      clearLibraryEditContext();
                      setLoadedSetId(null);
                      onNavigateToTestCases();
                    }}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Edit test case in Test Cases →
                  </button>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* File in Library — filter, multi-select (shift/ctrl/drag), delete icon */
        (() => {
          const selectedFileSet = new Set(selectedLibraryFileIds);
          const selectableFileIds = filteredFiles.filter((f) => !fileNamesInUseByBatch.has(f.name)).map((f) => f.id).filter(Boolean);
          const allFilesInUse = (uploadedFiles || []).length > 0 && (uploadedFiles || []).every((f) => fileNamesInUseByBatch.has(f.name));
          const toggleFileSelect = (fileId, index, e) => {
            // Allow selecting in-use files; lock destructive actions instead.
            if (e.shiftKey) {
              const last = lastClickedFileIndexRef.current;
              const from = last != null ? Math.min(last, index) : index;
              const to = last != null ? Math.max(last, index) : index;
              const idsToAdd = filteredFiles.slice(from, to + 1).map((f) => f.id).filter(Boolean);
              setSelectedLibraryFileIds((prev) => [...new Set([...prev, ...idsToAdd])]);
              lastClickedFileIndexRef.current = index;
              return;
            }
            if (e.ctrlKey || e.metaKey) {
              setSelectedLibraryFileIds((prev) =>
                prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId],
              );
              lastClickedFileIndexRef.current = index;
              return;
            }
            // Click ปกติ: toggle ได้หลายไฟล์ (ไม่บังคับ single select)
            setSelectedLibraryFileIds((prev) =>
              prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId],
            );
            lastClickedFileIndexRef.current = index;
          };
          const selectedInUse = selectedLibraryFileIds.filter((id) => {
            const f = filteredFiles.find((x) => x.id === id);
            return f && fileNamesInUseByBatch.has(f.name);
          }).length;
          const handleDeleteSelectedFiles = async () => {
            if (selectedFileSet.size === 0) {
              addToast({ type: 'info', message: 'Select file(s) first' });
              return;
            }
            if (selectedInUse > 0) {
              addToast({ type: 'warning', message: 'ไฟล์ที่กำลังถูกใช้โดย set (running/pending) ไม่สามารถลบได้ — รอให้ process จบก่อน' });
              return;
            }
            if (!window.confirm(`Delete ${selectedFileSet.size} selected file(s) from Library?`)) return;
            setIsDeleting(true);
            let deleted = 0;
            for (const id of selectedLibraryFileIds) {
              const f = filteredFiles.find((x) => x.id === id);
              if (f && fileNamesInUseByBatch.has(f.name)) continue;
              const ok = await removeUploadedFile(id);
              if (ok) deleted++;
            }
            setIsDeleting(false);
            setSelectedLibraryFileIds([]);
            if (deleted > 0) addToast({ type: 'success', message: `Deleted ${deleted} file(s)` });
          };
          return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-600">
                {/* Removed label pill (visual clutter) */}
                <div
                  className={`w-full mt-2 rounded-xl border-2 border-dashed p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                    isImportDragging
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                  }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsImportDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!e.currentTarget.contains(e.relatedTarget)) setIsImportDragging(false);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsImportDragging(false);
                      const files = await collectFilesFromDataTransfer(e.dataTransfer);
                      if (files?.length) enqueueImportDrafts(files);
                    }}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items || [];
                      const files = [];
                      for (const it of items) {
                        if (it.kind === 'file') {
                          const f = it.getAsFile();
                          if (f) files.push(f);
                        }
                      }
                      if (files.length) enqueueImportDrafts(files);
                    }}
                    tabIndex={0}
                    title="Drop files, paste files, or browse"
                >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Upload size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                          Import files area
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Drag & drop, paste (Cmd+V), or browse files/folder
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:ml-auto">
                      <input
                        ref={inlineFileImportInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files?.length) enqueueImportDrafts(files);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => inlineFileImportInputRef.current?.click()}
                        disabled={isImporting}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Browse
                      </button>
                    </div>
                </div>
                {/* Import preview moved to modal */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    {['all', 'vcd', 'erom', 'ulp', 'mdi'].map((k) => (
                      <button
                        key={k}
                        onClick={() => setFileFilter(k)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                          fileFilter === k
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700'
                            : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {k === 'all' ? 'All' : k === 'mdi' ? 'MDI' : k.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={fileStatusFilter}
                      onChange={(e) => setFileStatusFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-full"
                    >
                      <option value="all">All status</option>
                      <option value="pending">Pending</option>
                      <option value="running">Running</option>
                      <option value="completed">Completed</option>
                    </select>
                    <select value={fileSort} onChange={(e) => setFileSort(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 w-full"><option value="time">Time</option><option value="name">Name</option></select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={fileSearch} onChange={(e) => setFileSearch(e.target.value)} placeholder="Search name" className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-full" />
                    <input type="text" value={fileTagSearch} onChange={(e) => setFileTagSearch(e.target.value)} placeholder="Search tag" className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={fileSizeSearch} onChange={(e) => setFileSizeSearch(e.target.value)} placeholder="Search size" className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-full" />
                    <input type="text" value={fileOwnerSearch} onChange={(e) => setFileOwnerSearch(e.target.value)} placeholder="Search owner" className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-full" />
                  </div>
                </div>
                <button type="button" onClick={handleDeleteSelectedFiles} disabled={selectedFileSet.size === 0 || selectedInUse > 0 || isDeleting} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:pointer-events-none transition-colors" title={selectedInUse > 0 ? 'มีไฟล์ที่กำลังถูกใช้ (running/pending) — ไม่สามารถลบได้' : selectedFileSet.size > 0 ? `Delete ${selectedFileSet.size} selected` : 'Select files to delete'}>
                  <Trash2 size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLibraryFileIds.length === 0) {
                      addToast({ type: 'info', message: 'Select file(s) first' });
                      return;
                    }
                    setFileToTestCaseDraft(selectedLibraryFileIds);
                    addToast({ type: 'success', message: `Sent ${selectedLibraryFileIds.length} file(s) to Test Cases (Create)` });
                    if (onNavigateToTestCases) onNavigateToTestCases();
                  }}
                  disabled={selectedLibraryFileIds.length === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send selected files to Test Cases builder"
                >
                  Send to Create Test Case →
                </button>
                {selectedFileSet.size > 0 && <span className="text-xs text-slate-500">{selectedFileSet.size} selected{selectedInUse > 0 ? ' (มีรายการที่ล็อก)' : ''}</span>}
                {selectedFileSet.size > 0 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const raw = bulkTagInput.trim();
                        if (!raw) return;
                        selectedLibraryFileIds.forEach((id) => {
                          const current = (fileTags && fileTags[id]) || '';
                          const next = upsertTagsString(current, raw);
                          setFileTag?.(id, next);
                        });
                        addToast({ type: 'success', message: `Applied tag(s) to ${selectedLibraryFileIds.length} file(s)` });
                        setBulkTagInput('');
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-44"
                      placeholder="Bulk add tag… (Enter)"
                      title="Add tags to selected files (comma supported)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const raw = bulkTagInput.trim();
                        if (!raw) {
                          addToast({ type: 'info', message: 'Type tag(s) first' });
                          return;
                        }
                        selectedLibraryFileIds.forEach((id) => {
                          const current = (fileTags && fileTags[id]) || '';
                          const next = upsertTagsString(current, raw);
                          setFileTag?.(id, next);
                        });
                        addToast({ type: 'success', message: `Applied tag(s) to ${selectedLibraryFileIds.length} file(s)` });
                        setBulkTagInput('');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                      title="Apply tag(s) to selected files"
                    >
                      Apply
                    </button>
                  </div>
                )}
                {/* Removed "Delete All" action to avoid accidental destructive UX */}
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {loading?.files ? <div className="p-8 text-center text-slate-400">Loading...</div> : errors?.files ? <div className="p-8 text-center text-red-500">{errors.files}</div> : fileViewMode === 'all' ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredFiles.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                        <input type="checkbox" checked={selectableFileIds.length > 0 && selectableFileIds.every((id) => selectedFileSet.has(id))} onChange={(e) => { if (e.target.checked) setSelectedLibraryFileIds([...selectableFileIds]); else setSelectedLibraryFileIds([]); }} className="w-4 h-4 rounded cursor-pointer" title="Select all (excluding files in use by running/pending set)" />
                        <span className="text-xs text-slate-500">Select all ({filteredFiles.length}){selectableFileIds.length < filteredFiles.length ? ` — ${filteredFiles.length - selectableFileIds.length} ล็อก (in use)` : ''}</span>
                      </div>
                    )}
                    {filteredFiles.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <p className="font-medium">No files in library</p>
                        <p className="text-xs max-w-md mx-auto">Files appear here only after you <strong>upload</strong> them on the Test Cases page (drag & drop or click the upload area). Saving a test case only saves the test case definition (names of VCD/ERoM/ULP); it does not upload files. Upload the files first, then save the test case.</p>
                      </div>
                    ) : filteredFiles.map((f, index) => {
                      const setNames = getSetNamesUsingFile(f.name, savedTestCaseSets);
                      const tagVal = (fileTags && fileTags[f.id]) || '';
                      const tags = splitTags(tagVal);
                      const usedByTcs = getTestCasesUsingFile(f.name, savedTestCases, savedTestCaseSets);
                      const isSelected = selectedFileSet.has(f.id);
                      const isFocused = libraryFocusFileName && f.name === libraryFocusFileName;
                      const isHighlighted = isSelected || isFocused;
                      const usedByTcsTitle = usedByTcs.length > 0 ? usedByTcs.map((u) => `${u.name}${u.set ? ` (${u.set})` : ''}`).join('\n') : '';
                      const inUseByBatch = fileNamesInUseByBatch.has(f.name);
                      const displayName = (fileDisplayNames && fileDisplayNames[f.id]) || (String(f.name || '').split('/').pop() || f.name);
                      const lastModified = f.updatedAt || f.uploadDate || f.createdAt || null;
                      return (
                        <div
                          key={f.id}
                          ref={isFocused ? focusedLibraryFileRef : null}
                          className={`flex items-center gap-2 px-4 py-2 select-none ${inUseByBatch ? 'opacity-75 cursor-not-allowed bg-slate-50/50 dark:bg-slate-800/30' : 'cursor-pointer'} ${isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20' : !inUseByBatch ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                          onClick={(e) => { if (e.target.closest('input[type="checkbox"]') || e.target.closest('button') || e.target.closest('input[type=\"text\"]')) return; toggleFileSelect(f.id, index, e); }}
                          onMouseDown={(e) => { if (e.target.closest('input[type="checkbox"]') || e.target.closest('button') || e.target.closest('input[type=\"text\"]')) return; if (e.button === 0) { isDragSelectingFileRef.current = true; if (!selectedFileSet.has(f.id)) setSelectedLibraryFileIds((prev) => [...prev, f.id]); } }}
                          onMouseEnter={() => { if (!isDragSelectingFileRef.current) return; if (!selectedFileSet.has(f.id)) setSelectedLibraryFileIds((prev) => [...prev, f.id]); }}
                        >
                          <input type="checkbox" checked={isSelected} onChange={() => { toggleFileSelect(f.id, index, { shiftKey: false, ctrlKey: false, metaKey: false }); }} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded shrink-0 cursor-pointer" title={inUseByBatch ? 'ไฟล์กำลังถูกใช้โดย set (running/pending) — ลบไม่ได้ แต่ยังเลือกได้' : undefined} />
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="truncate text-sm text-slate-700 dark:text-slate-200" title={displayName}>
                              {displayName}
                            </span>
                            {displayName !== f.name && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate" title={f.name}>
                                ({String(f.name || '').split('/').pop() || f.name})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = displayName || '';
                                const next = window.prompt('Rename file (display name only):', current);
                                if (next == null) return;
                                const trimmed = next.trim();
                                setFileDisplayName?.(f.id, trimmed || '');
                              }}
                              className="ml-1 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                              title="Rename display name"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 max-w-[70px] truncate" title={f.ownerId ? `Owner: ${f.ownerId}` : '—'}>
                            {f.ownerId === currentClientId ? 'Me' : (f.ownerId ? 'Other' : '—')}
                          </span>
                          <span className="shrink-0 text-slate-400 dark:text-slate-500" title={f.visibility || 'public'}>
                            {f.visibility === 'private' ? <Lock size={14} /> : f.visibility === 'team' ? <Users size={14} /> : <Globe size={14} />}
                          </span>
                          <div className="flex items-center gap-1 w-[260px] shrink-0 min-w-0">
                            <div className="flex items-center gap-1 min-w-0 overflow-hidden whitespace-nowrap">
                              {tags.slice(0, 3).map((t, ti) => (
                                <span
                                  key={`${f.id}-tag-${ti}-${t}`}
                                  className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                                  title={t}
                                >
                                  {t}
                                </span>
                              ))}
                              {tags.length > 3 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAllTagsForFileId(f.id);
                                  }}
                                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                                  title="Show all tags"
                                >
                                  …
                                </button>
                              )}
                            </div>

                            {isTagEditorOpenByFileId[f.id] ? (
                              <input
                                type="text"
                                value={tagInputByFileId[f.id] ?? ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setTagInputByFileId((prev) => ({ ...prev, [f.id]: e.target.value }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const raw = (tagInputByFileId[f.id] ?? '').trim();
                                  if (!raw) return;
                                  const next = upsertTagsString(tagVal, raw);
                                  setFileTag?.(f.id, next);
                                  setTagInputByFileId((prev) => ({ ...prev, [f.id]: '' }));
                                  setIsTagEditorOpenByFileId((prev) => ({ ...prev, [f.id]: false }));
                                }}
                                onBlur={() => {
                                  setIsTagEditorOpenByFileId((prev) => ({ ...prev, [f.id]: false }));
                                  setTagInputByFileId((prev) => ({ ...prev, [f.id]: '' }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-0.5 text-[11px] rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-28"
                                placeholder="tag…"
                                title="Press Enter to add (comma supported)"
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsTagEditorOpenByFileId((prev) => ({ ...prev, [f.id]: true }));
                                }}
                                className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                                title="Add tag"
                              >
                                +
                              </button>
                            )}
                          </div>
                          {inUseByBatch && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-[10px] font-semibold shrink-0" title="In use by a running or pending set; cannot delete until set finishes">In use by set</span>
                          )}
                          {usedByTcs.length > 0 && (
                            <div className="flex items-center gap-1 shrink-0">
                              {usedByTcs.slice(0, 3).map((u, idx) => (
                                <span
                                  key={`${f.id}-tcchip-${idx}-${u.name}`}
                                  className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
                                  title={u.set ? `${u.name} (${u.set})` : u.name}
                                >
                                  {u.name}
                                </span>
                              ))}
                              {usedByTcs.length > 3 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAllTagsForFileId(f.id);
                                  }}
                                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  title={usedByTcsTitle || undefined}
                                >
                                  …
                                </button>
                              )}
                            </div>
                          )}
                          {setNames.length > 0 && <span className="text-[11px] text-blue-600 dark:text-blue-400 shrink-0" title={`In sets: ${setNames.join(', ')}`}>Sets: {setNames.slice(0, 2).join(', ')}{setNames.length > 2 ? ` +${setNames.length - 2}` : ''}</span>}
                          {lastModified && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0" title={String(lastModified)}>
                              {String(lastModified).replace('T', ' ').slice(0, 16)}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 shrink-0">{f.sizeFormatted || f.size}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 space-y-4">
                    {filteredFiles.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <p className="font-medium">No files in library</p>
                        <p className="text-xs max-w-md mx-auto">Upload files on the Test Cases page first (drag & drop or click upload). Save test case only saves the test case definition, not the file content.</p>
                      </div>
                    ) : filesBySet.length === 0 ? <div className="p-8 text-center text-slate-400">No sets — create a set on the Test Cases page (Save Set)</div> : (
                      <>
                        {filteredFiles.length > 0 && (
                          <div className="flex items-center gap-2 pb-2">
                            <input type="checkbox" checked={selectableFileIds.length > 0 && selectableFileIds.every((id) => selectedFileSet.has(id))} onChange={(e) => { if (e.target.checked) setSelectedLibraryFileIds([...selectableFileIds]); else setSelectedLibraryFileIds([]); }} className="w-4 h-4 rounded cursor-pointer" title="Select all (excluding in use)" />
                            <span className="text-xs text-slate-500">Select all ({filteredFiles.length})</span>
                          </div>
                        )}
                        {filesBySet.map(({ set: setInfo, files }, idx) => {
                          if (files.length === 0) return null;
                          const title = setInfo.name || `Set ${idx + 1}`;
                          const boxId = setInfo.id;
                          const isDeletingBox = deletingBoxId === boxId;
                          const boxDeletableFiles = files.filter((f) => !fileNamesInUseByBatch.has(f.name));
                          const boxAllInUse = boxDeletableFiles.length === 0;
                          return (
                            <div key={boxId} className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title} <span className="text-xs font-normal text-slate-500">({files.length})</span></span>
                                <button type="button" onClick={() => handleDeleteBox(boxId, files)} disabled={isDeletingBox || boxAllInUse} className={`p-1.5 rounded ${boxAllInUse ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'} disabled:opacity-60`} title={boxAllInUse ? 'ไฟล์ในกล่องนี้กำลังถูกใช้ (running/pending) — ไม่สามารถลบได้' : 'Delete all files in this box'}><Trash2 size={16} strokeWidth={2} /></button>
                              </div>
                              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {files.map((f, fileIdx) => {
                                  const isSelected = selectedFileSet.has(f.id);
                                  const globalIndex = filteredFiles.findIndex((x) => x.id === f.id);
                                  const usedByTcs = getTestCasesUsingFile(f.name, savedTestCases, savedTestCaseSets);
                                  const usedByTcsTitle = usedByTcs.length > 0 ? usedByTcs.map((u) => `${u.name}${u.set ? ` (${u.set})` : ''}`).join('\n') : '';
                                  const inUseByBatch = fileNamesInUseByBatch.has(f.name);
                                  return (
                                    <div
                                      key={f.id}
                                      className={`flex items-center gap-2 px-4 py-2 flex-wrap select-none bg-white/50 dark:bg-transparent ${inUseByBatch ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : !inUseByBatch ? 'hover:bg-white dark:hover:bg-slate-800/50' : ''}`}
                                      onClick={(e) => { if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) return; if (inUseByBatch) return; toggleFileSelect(f.id, globalIndex >= 0 ? globalIndex : fileIdx, e); }}
                                      onMouseDown={(e) => { if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) return; if (inUseByBatch) return; if (e.button === 0) { isDragSelectingFileRef.current = true; if (!selectedFileSet.has(f.id)) setSelectedLibraryFileIds((prev) => [...prev, f.id]); } }}
                                      onMouseEnter={() => { if (inUseByBatch) return; if (!isDragSelectingFileRef.current) return; if (!selectedFileSet.has(f.id)) setSelectedLibraryFileIds((prev) => [...prev, f.id]); }}
                                    >
                                      <input type="checkbox" checked={isSelected} disabled={inUseByBatch} onChange={() => { if (!inUseByBatch) toggleFileSelect(f.id, globalIndex >= 0 ? globalIndex : fileIdx, { shiftKey: false, ctrlKey: false, metaKey: false }); }} onClick={(e) => e.stopPropagation()} className={`w-4 h-4 rounded shrink-0 ${inUseByBatch ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={inUseByBatch ? 'ไม่สามารถลบได้ — กำลังถูกใช้โดย set' : undefined} />
                                      <span className="flex-1 min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">{f.name}</span>
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 max-w-[70px] truncate" title={f.ownerId ? `Owner: ${f.ownerId}` : '—'}>
                                        {f.ownerId === currentClientId ? 'Me' : (f.ownerId ? 'Other' : '—')}
                                      </span>
                                      <span className="shrink-0 text-slate-400 dark:text-slate-500" title={f.visibility || 'public'}>
                                        {f.visibility === 'private' ? <Lock size={14} /> : f.visibility === 'team' ? <Users size={14} /> : <Globe size={14} />}
                                      </span>
                                      {inUseByBatch && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-[10px] font-semibold shrink-0" title="In use by a running or pending set">In use by set</span>
                                      )}
                                      {usedByTcs.length > 0 && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          {usedByTcs.slice(0, 3).map((u, idx) => (
                                            <span
                                              key={`${f.id}-tcchip-box-${idx}-${u.name}`}
                                              className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
                                              title={u.set ? `${u.name} (${u.set})` : u.name}
                                            >
                                              {u.name}
                                            </span>
                                          ))}
                                          {usedByTcs.length > 3 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setShowAllTagsForFileId(f.id);
                                              }}
                                              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                              title={usedByTcsTitle || undefined}
                                            >
                                              …
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      <span className="text-xs text-slate-500 shrink-0">{f.sizeFormatted || f.size}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })() ) }
      {/* Test case history modal */}
      {testCaseHistoryFor && (() => {
        const tc = testCaseHistoryFor.tc;
        const history = getTestCaseHistory(tc);
        const getJobDate = (job) => {
          if (job.status === 'completed' || job.status === 'stopped') {
            if (job.completedAt) return new Date(job.completedAt);
            if (job.startedAt) return new Date(job.startedAt);
          }
          if (job.createdAt) return new Date(job.createdAt);
          if (job.startedAt) return new Date(job.startedAt);
          return new Date();
        };
        const sorted = [...history].sort((a, b) => getJobDate(b.job) - getJobDate(a.job));
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setTestCaseHistoryFor(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Test case history</h3>
                <button type="button" onClick={() => setTestCaseHistoryFor(null)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={18} />
                </button>
              </div>
              <div className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <span className="font-medium text-slate-700 dark:text-slate-300">{tc.name || '—'}</span>
                {tc.vcdName && <span className="ml-1"> · VCD: {tc.vcdName}</span>}
                {tc.binName && <span> ERoM: {tc.binName}</span>}
                {tc.linName && <span> ULP: {tc.linName}</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {sorted.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">This test case has not been used in any job/set yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {sorted.map(({ job, fileIndex }, i) => {
                      const status = (job.status || '').toLowerCase();
                      const date = getJobDate(job);
                      // Use the same palette as Job Management status column
                      const statusCls =
                        status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : status === 'running'
                          ? 'bg-blue-100 text-blue-700'
                          : status === 'stopped'
                          ? 'bg-red-100 text-red-700'
                          : status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-slate-100 text-slate-700';
                      return (
                        <li key={`${job.id}-${fileIndex}-${i}`} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{job.name || job.configName || `Job #${job.id}`}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              {(job.files?.length || 0) > 1 && <span className="ml-1"> · Order: {fileIndex + 1}</span>}
                            </div>
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusCls}`}>{status || '—'}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default FileLibraryPage;
