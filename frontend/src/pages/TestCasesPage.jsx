import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowUp, ArrowDown, Copy, FileJson, FileUp, GripVertical, Layers, Plus, Save, Trash2, X
} from 'lucide-react';
import { useTestStore } from '../store/useTestStore';
import api from '../services/api';
import { computeFileSignature } from '../utils/fileSignature';
import { getClientId } from '../utils/sessionStorage';
import UploadChoiceModal from '../components/UploadChoiceModal';

const TestCasesPage = () => {
  const viewingSharedProfileId = useTestStore((s) => s.viewingSharedProfileId);
  const sharedProfileDataCache = useTestStore((s) => s.sharedProfileDataCache);
  const sharedProfiles = useTestStore((s) => s.sharedProfiles || []);
  const setViewingSharedProfile = useTestStore((s) => s.setViewingSharedProfile);
  const copySharedToMyProfile = useTestStore((s) => s.copySharedToMyProfile);
  const fetchSharedProfileData = useTestStore((s) => s.fetchSharedProfileData);
  const {
    uploadedFiles,
    savedTestCases,
    savedTestCaseSets,
    workingTestCases,
    addWorkingTestCase,
    updateWorkingTestCase,
    removeWorkingTestCase,
    moveWorkingTestCaseUp,
    moveWorkingTestCaseDown,
    reorderWorkingTestCases,
    duplicateWorkingTestCase,
    setWorkingTestCases,
    bulkUpdateWorkingTryCount,
    addWorkingTestCaseCommand,
    updateWorkingTestCaseCommand,
    removeWorkingTestCaseCommand,
    saveWorkingToLibrary,
    addSavedTestCase,
    updateSavedTestCase,
    removeSavedTestCase,
    setSavedTestCases,
    reorderSavedTestCases,
    duplicateSavedTestCase,
    bulkUpdateTryCount,
    addTestCaseCommand,
    updateTestCaseCommand,
    removeTestCaseCommand,
    addSavedTestCaseSet,
    updateSavedTestCaseSet,
    removeSavedTestCaseSet,
    duplicateSavedTestCaseSet,
    applySavedTestCaseSet,
    loadSetForEditing,
    restoreSavedTestCasesFromProfile,
    setLoadedSetId,
    appendSavedTestCaseSet,
    moveSavedTestCaseSetUp,
    moveSavedTestCaseSetDown,
    addUploadedFile,
    removeUploadedFile,
    loading,
    errors,
  } = useTestStore();
  const addToast = useTestStore((s) => s.addToast);
  const refreshFiles = useTestStore((s) => s.refreshFiles);
  const activeProfileId = useTestStore((s) => s.activeProfileId);
  const libraryEditContext = useTestStore((s) => s.libraryEditContext);
  const clearLibraryEditContext = useTestStore((s) => s.clearLibraryEditContext);
  const testCaseLibraryFocusOnNavigate = useTestStore((s) => s.testCaseLibraryFocusOnNavigate);
  const clearTestCaseLibraryFocusOnNavigate = useTestStore((s) => s.clearTestCaseLibraryFocusOnNavigate);
  const jobs = useTestStore((s) => s.jobs);
  const fileNamesInUseByBatch = useMemo(() => {
    const names = new Set();
    (jobs || []).filter((j) => j.status === 'pending' || j.status === 'running').forEach((job) => {
      (job.files || []).forEach((f) => {
        if (f.vcd) names.add(f.vcd);
        if (f.erom) names.add(f.erom);
        if (f.ulp) names.add(f.ulp);
      });
    });
    return names;
  }, [jobs]);

  /** เฉพาะ test case ที่ชุดไฟล์ครบและตรงกับ job ที่กำลัง running/pending ถึงจะถือว่า "in use" (ล็อกได้) */
  const testCaseFileKeysInUseByBatch = useMemo(() => {
    const keys = new Set();
    (jobs || []).filter((j) => j.status === 'pending' || j.status === 'running').forEach((job) => {
      (job.files || []).forEach((f) => {
        const v = (f.vcd || f.vcdName || '').trim();
        const b = (f.erom || f.binName || '').trim();
        const l = (f.ulp || f.linName || '').trim();
        keys.add(`${v}||${b}||${l}`);
      });
    });
    return keys;
  }, [jobs]);

  // Helper: get job status for a set name in Jobs (used only on Run Set page)
  const getSetJobStatusForRunSet = useCallback(
    (set) => {
      const setName = (set?.name || '').trim();
      if (!setName) return null;
      let status = null;
      (jobs || []).forEach((job) => {
        const state = (job.status || '').toLowerCase();
        if (state !== 'pending' && state !== 'running') return;
        const configName = (job.configName || '').trim();
        const jobName = (job.name || '').trim();
        if (setName && (configName === setName || jobName === setName)) {
          // running > pending
          if (state === 'running') status = 'running';
          else if (!status) status = 'pending';
        }
      });
      return status;
    },
    [jobs]
  );

  const isSetInUseByJobs = useCallback(
    (set) => !!getSetJobStatusForRunSet(set),
    [getSetJobStatusForRunSet]
  );
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const testCasesJsonInputRef = useRef(null);
  const prevUploadedCountRef = useRef(0);
  const justDidStartFreshRef = useRef(false);
  const loadedSetId = useTestStore((s) => s.loadedSetId);
  const loadedSetTable = useTestStore((s) => s.loadedSetTable);
  const [pendingDraftTestCases, setPendingDraftTestCases] = useState([]);
  const [tableClearedMode, setTableClearedMode] = useState(false);

  const SETUP_CLEARED_KEY = 'app_setup_cleared_';
  const getSetupClearedPersisted = (profileId) => typeof window !== 'undefined' && localStorage.getItem(SETUP_CLEARED_KEY + (profileId || 'default')) === 'true';
  const setSetupClearedPersisted = (profileId, value) => { if (typeof window !== 'undefined') localStorage.setItem(SETUP_CLEARED_KEY + (profileId || 'default'), value ? 'true' : 'false'); };
  useEffect(() => {
    if (getSetupClearedPersisted(activeProfileId)) {
      setTableClearedMode(true);
      setSelectedIds([]);
      setLocalDroppedFiles([]);
    }
  }, [activeProfileId]);

  const displayedSavedTestCases = tableClearedMode
    ? []
    : (viewingSharedProfileId && sharedProfileDataCache[viewingSharedProfileId]
      ? (sharedProfileDataCache[viewingSharedProfileId].savedTestCases ?? [])
      : loadedSetId
        ? (loadedSetTable || [])
        : [...(savedTestCases || []), ...pendingDraftTestCases]);
  const displayedSavedTestCaseSets = viewingSharedProfileId && sharedProfileDataCache[viewingSharedProfileId]
    ? (sharedProfileDataCache[viewingSharedProfileId].savedTestCaseSets ?? [])
    : savedTestCaseSets;
  const isViewingShared = Boolean(viewingSharedProfileId);
  const viewingSharedName = isViewingShared ? (sharedProfiles.find((p) => p.id === viewingSharedProfileId)?.name || viewingSharedProfileId) : '';

  useEffect(() => {
    if (viewingSharedProfileId && !sharedProfileDataCache[viewingSharedProfileId]) {
      fetchSharedProfileData(viewingSharedProfileId);
    }
  }, [viewingSharedProfileId, sharedProfileDataCache, fetchSharedProfileData]);

  // When navigating from Library "edit this test case" → load set and focus row
  useEffect(() => {
    if (!libraryEditContext) return;
    const { loadSetId, focusTcIndex, focusTcId } = libraryEditContext;
    if (loadSetId) {
      setSetupClearedPersisted(activeProfileId, false);
      setTableClearedMode(false);
      loadSetForEditing(loadSetId);
      setPendingDraftTestCases([]);
    } else {
      // Coming from Raw Test Cases with focusTcId (edit single test case): ensure table is not in "cleared" state so savedTestCases show
      setSetupClearedPersisted(activeProfileId, false);
      setTableClearedMode(false);
    }
    const applyFocus = () => {
      const state = useTestStore.getState();
      const list = loadSetId ? (state.loadedSetTable || []) : (state.savedTestCases || []);
      if (focusTcIndex != null && list[focusTcIndex]) {
        setSelectedTestCaseIds([list[focusTcIndex].id]);
      } else if (focusTcId && list.some((t) => t.id === focusTcId)) {
        setSelectedTestCaseIds([focusTcId]);
      }
      clearLibraryEditContext();
    };
    if (loadSetId) {
      setTimeout(applyFocus, 0);
    } else {
      applyFocus();
    }
  }, [libraryEditContext, loadSetForEditing, clearLibraryEditContext, activeProfileId]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState([]);
  const [duplicateHighlightIds, setDuplicateHighlightIds] = useState([]);
  const [bulkTryCount, setBulkTryCount] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  const [fileSearch, setFileSearch] = useState('');
  const [fileSort, setFileSort] = useState('time');
  const [fileListExpanded, setFileListExpanded] = useState(false);
  const [selectedFileIdsForDelete, setSelectedFileIdsForDelete] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeletingFiles, setIsDeletingFiles] = useState(false);
  const [draggingRowIndex, setDraggingRowIndex] = useState(null);
  const [dropTargetRowIndex, setDropTargetRowIndex] = useState(null);
  const draggingRowIndexRef = useRef(null);

  // When navigating from Jobs (click test case name): auto-select the matching row so user sees which one was pointed to
  useEffect(() => {
    if (!testCaseLibraryFocusOnNavigate) return;
    const focus = testCaseLibraryFocusOnNavigate;
    const list = displayedSavedTestCases;
    const match = list.find((tc) => {
      const nameMatch = focus.name && (tc.name || '').trim() === (focus.name || '').trim();
      const vcdMatch = (focus.vcdName || '').trim() && (tc.vcdName || '').trim() === (focus.vcdName || '').trim();
      const binMatch = focus.binName == null || (tc.binName || '').trim() === (focus.binName || '').trim();
      const linMatch = focus.linName == null || (tc.linName || '').trim() === (focus.linName || '').trim();
      return nameMatch || (vcdMatch && binMatch && linMatch);
    });
    if (match) setSelectedTestCaseIds([match.id]);
    clearTestCaseLibraryFocusOnNavigate();
  }, [testCaseLibraryFocusOnNavigate, displayedSavedTestCases, clearTestCaseLibraryFocusOnNavigate]);

  // All test case names in Library: current list + every set's items (avoid duplicates when creating names)
  const getAllLibraryNames = () => {
    const state = useTestStore.getState();
    const current = (state.savedTestCases || []).map((t) => (t.name || '').trim()).filter(Boolean);
    const fromSets = (state.savedTestCaseSets || []).flatMap((set) =>
      (Array.isArray(set.items) ? set.items : []).map((t) => (t.name || '').trim()).filter(Boolean)
    );
    return [...new Set([...current, ...fromSets])];
  };

  const getNextTestCaseName = () => {
    const allNames = getAllLibraryNames();
    const pendingNames = (pendingDraftTestCases || []).map((t) => (t.name || '').trim()).filter(Boolean);
    const combined = [...new Set([...allNames, ...pendingNames])];
    const nums = combined.map((name) => {
      const m = (name || '').match(/^TC(\d+)$/i);
      return m ? parseInt(m[1], 10) : 0;
    });
    const max = Math.max(0, ...nums);
    return 'TC' + String(max + 1).padStart(5, '0');
  };

  const isDraftId = (id) => (pendingDraftTestCases || []).some((t) => t.id === id);
  useEffect(() => {
    if (!duplicateHighlightIds.length) return;
    const timer = setTimeout(() => setDuplicateHighlightIds([]), 1600);
    return () => clearTimeout(timer);
  }, [duplicateHighlightIds]);
  const updateDisplayedTestCase = (id, updates) => {
    if (isDraftId(id)) {
      setPendingDraftTestCases((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    } else {
      updateSavedTestCase(id, updates);
    }
  };
  const removeDisplayedTestCase = (id) => {
    if (isDraftId(id)) {
      setPendingDraftTestCases((prev) => prev.filter((t) => t.id !== id));
    } else {
      removeSavedTestCase(id);
    }
  };
  const addDisplayedTestCaseCommand = (tcId, cmd) => {
    const type = cmd?.type;
    const file = cmd?.file ?? '';
    const tc = displayedSavedTestCases.find((t) => t.id === tcId);
    const existingCommands = Array.isArray(tc?.commands) ? tc.commands : [];
    const existingOfType = existingCommands.filter((c) => c.type === type);
    const colIndex = existingOfType.length + 2; // VCD2, VCD3, ...
    const colPrefix = type === 'vcd' ? 'VCD' : type === 'erom' ? 'ERoM' : type === 'ulp' ? 'ULP' : null;
    const colKey = colPrefix ? `${colPrefix}${colIndex}` : null;

    if (isDraftId(tcId)) {
      setPendingDraftTestCases((prev) =>
        prev.map((t) => {
          if (t.id !== tcId) return t;
          const commands = Array.isArray(t.commands) ? t.commands : [];
          const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const next = { ...t, commands: [...commands, { id, ...cmd }] };
          if (colKey) {
            next.extraColumns = {
              ...(next.extraColumns || {}),
              [colKey]: file,
            };
          }
          return next;
        })
      );
    } else {
      addTestCaseCommand(tcId, cmd);
      if (colKey) {
        const prevExtra = (tc && tc.extraColumns) || {};
        updateDisplayedTestCase(tcId, {
          extraColumns: {
            ...prevExtra,
            [colKey]: file,
          },
        });
      }
    }
  };
  const updateDisplayedTestCaseCommand = (tcId, cmdId, updates) => {
    if (isDraftId(tcId)) {
      setPendingDraftTestCases((prev) =>
        prev.map((t) => {
          if (t.id !== tcId || !Array.isArray(t.commands)) return t;
          return {
            ...t,
            commands: t.commands.map((c) => (c.id === cmdId ? { ...c, ...updates } : c)),
          };
        })
      );
    } else {
      updateTestCaseCommand(tcId, cmdId, updates);
    }
  };
  const removeDisplayedTestCaseCommand = (tcId, cmdId) => {
    if (isDraftId(tcId)) {
      setPendingDraftTestCases((prev) =>
        prev.map((t) => {
          if (t.id !== tcId || !Array.isArray(t.commands)) return t;
          return { ...t, commands: t.commands.filter((c) => c.id !== cmdId) };
        })
      );
    } else {
      removeTestCaseCommand(tcId, cmdId);
    }
  };
  const handleExtraColumnChange = (tcId, col, value) => {
    const m = col.match(/^(VCD|ERoM|ULP)(\d+)$/);
    if (m) {
      const type = m[1] === 'VCD' ? 'vcd' : m[1] === 'ERoM' ? 'erom' : 'ulp';
      const idx = parseInt(m[2], 10) - 2;
      const tc = displayedSavedTestCases.find((t) => t.id === tcId);
      if (!tc) return;
      const cmds = (tc.commands || []).filter((c) => c.type === type && (c.file || '').trim());
      if (idx < cmds.length) {
        if (isDraftId(tcId)) {
          setPendingDraftTestCases((prev) =>
            prev.map((t) => {
              if (t.id !== tcId || !Array.isArray(t.commands)) return t;
              const typed = t.commands.filter((c) => c.type === type);
              const cmd = typed[idx];
              if (!cmd) return t;
              return { ...t, commands: t.commands.map((c) => (c.id === cmd.id ? { ...c, file: value } : c)) };
            })
          );
        } else {
          updateTestCaseCommand(tcId, cmds[idx].id, { file: value });
        }
      } else {
        addDisplayedTestCaseCommand(tcId, { type, file: value });
      }
    } else {
      updateDisplayedTestCase(tcId, { extraColumns: { ...(displayedSavedTestCases.find((t) => t.id === tcId)?.extraColumns || {}), [col]: value } });
    }
  };
  const duplicateDisplayedTestCase = (id, overrides = {}) => {
    const list = displayedSavedTestCases;
    const src = list.find((t) => t.id === id);
    if (!src) return;
    const name = overrides.name || getUniqueName((src.name || '').trim(), id);
    const dup = {
      ...src,
      id: `tc-draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      createdAt: new Date().toISOString(),
      ...overrides,
    };
    if (loadedSetId) {
      duplicateSavedTestCase(id, overrides);
    } else {
      setPendingDraftTestCases((prev) => [...prev, dup]);
    }
  };
  const [testCaseTableLayout, setTestCaseTableLayout] = useState('table'); // 'table' | 'step' — ตารางแนวนอน หรือ layout แนวตั้งตามขั้นตอน (ตามภาพ)
  const [localDroppedFiles, setLocalDroppedFiles] = useState([]);
  const [commandMenuTcId, setCommandMenuTcId] = useState(null); // which test case's "Add command" dropdown is open
  const [saveLibraryUploadModal, setSaveLibraryUploadModal] = useState(null); // { prepared, toSave } when showing per-file Reuse/Upload before Save to library
  const justDidSaveSetRef = useRef(false);

  const mergeCommandsIntoExtraForSave = useCallback((tc) => {
    const extra = tc.extraColumns && typeof tc.extraColumns === 'object' ? { ...tc.extraColumns } : {};
    const cmds = Array.isArray(tc.commands) ? tc.commands : [];
    const vcdCmds = cmds.filter((c) => c.type === 'vcd' && (c.file || '').trim());
    const eromCmds = cmds.filter((c) => c.type === 'erom' && (c.file || '').trim());
    const ulpCmds = cmds.filter((c) => c.type === 'ulp' && (c.file || '').trim());
    vcdCmds.forEach((c, i) => { extra[`VCD${i + 2}`] = c.file || ''; });
    eromCmds.forEach((c, i) => { extra[`ERoM${i + 2}`] = c.file || ''; });
    ulpCmds.forEach((c, i) => { extra[`ULP${i + 2}`] = c.file || ''; });
    return Object.fromEntries(Object.entries(extra).filter(([, v]) => (v ?? '').toString().trim() !== ''));
  }, []);

  const handleSaveLibraryUploadChoiceConfirm = useCallback(async (choices) => {
    const modal = saveLibraryUploadModal;
    if (!modal?.prepared?.length) return;
    const { prepared, toSave } = modal;
    let uploaded = 0;
    let reused = 0;
    for (const p of prepared) {
      const choice = choices[p.file.name];
      if (p.existing && (choice || 'reuse') === 'reuse') {
        reused++;
        continue;
      }
      const result = await addUploadedFile(p.file);
      if (result) uploaded++;
    }
    setLocalDroppedFiles([]);
    if (refreshFiles) await refreshFiles();
    if (uploaded > 0) addToast({ type: 'success', message: `${uploaded} file(s) uploaded to library` });
    if (reused > 0) addToast({ type: 'info', message: `${reused} file(s) reused from library` });
    if (toSave?.length > 0) {
      const existingSaved = useTestStore.getState().savedTestCases || [];
      const existingByKey = new Map(
        existingSaved.map((t) => [getFullTestCaseFileKeyFromMerged(t, mergeCommandsIntoExtraForSave(t)), t])
      );
      const skipped = [];
      const created = [];
      toSave.forEach((tc) => {
        const { id, commands, ...rest } = tc;
        const extraColumns = mergeCommandsIntoExtraForSave(tc);
        const key = getFullTestCaseFileKeyFromMerged(rest, extraColumns);
        const existing = existingByKey.get(key);
        if (existing) {
          skipped.push(existing);
          return;
        }
        const newId = addSavedTestCase({
          ...rest,
          extraColumns: Object.keys(extraColumns).length ? extraColumns : undefined,
        });
        created.push(newId);
      });
      setPendingDraftTestCases([]);
      if (refreshFiles) await refreshFiles();
      const total = useTestStore.getState().savedTestCases?.length || 0;
      if (created.length > 0) {
        addToast({
          type: 'success',
          message: `Test cases saved to library (${total} case(s))`,
        });
        if (skipped.length > 0) {
          addToast({
            type: 'info',
            message: `${skipped.length} test case(s) already existed (same VCD/ERoM/ULP) and were reused`,
          });
        }
      } else if (skipped.length > 0) {
        addToast({
          type: 'info',
          message: `All ${skipped.length} test case(s) already exist in library — no new entries created`,
        });
      }
    } else {
      if (refreshFiles) await refreshFiles();
      const total = useTestStore.getState().savedTestCases?.length || 0;
      addToast({ type: 'success', message: `Test cases saved to library (${total} case(s))` });
    }
    setSaveLibraryUploadModal(null);
  }, [saveLibraryUploadModal, addUploadedFile, refreshFiles, addToast, addSavedTestCase, setPendingDraftTestCases, mergeCommandsIntoExtraForSave]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  const getFileKind = (file) => {
    const ext = String(file?.name || '').split('.').pop()?.toLowerCase();
    if (ext === 'vcd') return 'vcd';
    if (['bin', 'hex', 'elf', 'erom'].includes(ext)) return 'bin';
    if (ext === 'txt') return 'mdi';
    if (['lin', 'ulp'].includes(ext)) return 'lin';
    return 'other';
  };
  const workingFilesList = (() => {
    const byId = new Map();
    selectedIds.forEach((id) => {
      const f = uploadedFiles.find((x) => x.id === id);
      if (f && !byId.has(f.id)) byId.set(f.id, f);
    });
    localDroppedFiles.forEach((f) => {
      const entry = { id: f.id, name: f.name, sizeFormatted: f.sizeFormatted };
      if (!byId.has(f.id)) byId.set(f.id, entry);
    });
    return [...byId.values()];
  })();
  const selectedFiles = workingFilesList;
  const vcdFilesList = uploadedFiles.filter((f) => getFileKind(f) === 'vcd');
  const binFilesList = uploadedFiles.filter((f) => getFileKind(f) === 'bin');
  const linFilesList = uploadedFiles.filter((f) => getFileKind(f) === 'lin');
  const mdiFilesList = uploadedFiles.filter((f) => getFileKind(f) === 'mdi');
  const vcdSelected = selectedFiles.filter((f) => getFileKind(f) === 'vcd');
  const binSelected = selectedFiles.filter((f) => getFileKind(f) === 'bin');
  const workingCount = selectedIds.length + localDroppedFiles.length;

  const normalizeTCTestCaseKey = (tc) => {
    const v = (tc.vcdName || '').trim();
    const b = (tc.binName || '').trim();
    const l = (tc.linName || '').trim();
    return `${v}||${b}||${l}`;
  };

  /** Key สำหรับเช็คซ้ำ: ต้องตรงทุกไฟล์ใน test case (3, 4, 5 ไฟล์ ตามที่ user สร้าง) ไม่ใช่แค่ VCD+ERoM+ULP หลัก */
  const normalizeTCTestCaseKeyFull = (tc) => {
    const base = [(tc.vcdName || '').trim(), (tc.binName || '').trim(), (tc.linName || '').trim()].join('||');
    const extra = tc.extraColumns && typeof tc.extraColumns === 'object' ? tc.extraColumns : {};
    const fileCols = Object.keys(extra).filter((k) => /^(VCD|ERoM|ULP)\d+$/i.test(k)).sort();
    const extraPart = fileCols.map((k) => (extra[k] || '').toString().trim()).join('||');
    return extraPart ? `${base}||${extraPart}` : base;
  };

  const getFullTestCaseFileKeyFromMerged = (tc, mergedExtra) => {
    const base = [(tc.vcdName || '').trim(), (tc.binName || '').trim(), (tc.linName || '').trim()].join('||');
    const fileCols = Object.keys(mergedExtra || {}).filter((k) => /^(VCD|ERoM|ULP)\d+$/i.test(k)).sort();
    const extraPart = fileCols.map((k) => (mergedExtra[k] || '').toString().trim()).join('||');
    return extraPart ? `${base}||${extraPart}` : base;
  };

  // ชื่อไม่ซ้ำ: สร้างชื่อที่ยังไม่มีในคลัง (ดึงจาก Library ทั้ง savedTestCases + ทุก set items), excludeId = id ของแถวที่กำลังแก้
  const getUniqueName = (baseName, excludeId = null) => {
    const currentNames = (savedTestCases || []).filter((t) => t.id !== excludeId).map((t) => (t.name || '').trim()).filter(Boolean);
    const draftNames = (pendingDraftTestCases || []).filter((t) => t.id !== excludeId).map((t) => (t.name || '').trim()).filter(Boolean);
    const setNames = (savedTestCaseSets || []).flatMap((set) =>
      (Array.isArray(set.items) ? set.items : []).map((t) => (t.name || '').trim()).filter(Boolean)
    );
    const existing = [...new Set([...currentNames, ...draftNames, ...setNames])];
    const base = (baseName || 'Test case').trim() || 'Test case';
    if (!existing.includes(base)) return base;
    let n = 2;
    while (existing.includes(`${base} (${n})`)) n++;
    return `${base} (${n})`;
  };

  const isTestCaseLocked = (tcId) => {
    // Locked if this test case is part of any saved set (to avoid surprising changes to sets/runs)
    return (savedTestCaseSets || []).some((set) =>
      (Array.isArray(set.items) ? set.items : []).some((t) => t.id === tcId)
    );
  };
  const isTestCaseInUseByBatch = (tc) => {
    const v = (tc.vcdName || '').trim();
    const b = (tc.binName || '').trim();
    const l = (tc.linName || '').trim();
    // ถ้ายังเลือกไฟล์ไม่ครบ 3 ตัว (VCD/ERoM/ULP) ให้ถือว่ายังไม่ถูกใช้งาน ปล่อยให้แก้ไข/เลือกไฟล์ต่อได้
    if (!v || !b || !l) return false;
    const baseKey = `${v}||${b}||${l}`;
    return testCaseFileKeysInUseByBatch.has(baseKey);
  };

  const handleNameChange = (tcId, newName, prevName = '') => {
    const trimmed = (newName || '').trim();
    const inCurrent = (savedTestCases || []).some((t) => t.id !== tcId && (t.name || '').trim() === trimmed);
    const inDraft = (pendingDraftTestCases || []).some((t) => t.id !== tcId && (t.name || '').trim() === trimmed);
    const inSets = (savedTestCaseSets || []).some((set) =>
      (Array.isArray(set.items) ? set.items : []).some((t) => (t.name || '').trim() === trimmed)
    );
    const isDuplicate = trimmed !== '' && (inCurrent || inDraft || inSets);
    if (isDuplicate) {
      addToast({ type: 'warning', message: 'Duplicate name — use a unique name for this test case' });
      updateDisplayedTestCase(tcId, { name: prevName });
      return;
    }
    updateDisplayedTestCase(tcId, { name: trimmed });
  };

  // เมื่อมีไฟล์ใหม่จาก Library (refresh): ไม่ overwrite ถ้า Save Set; ถ้า Start fresh ให้เลือกเฉพาะที่เพิ่ม; ถ้า user เคยกด Start fresh/Clear (persisted) ไม่ auto-select เพื่อไม่ให้ไฟล์กลับมา
  useEffect(() => {
    if (justDidSaveSetRef.current) {
      justDidSaveSetRef.current = false;
      prevUploadedCountRef.current = uploadedFiles.length;
      return;
    }
    if (getSetupClearedPersisted(activeProfileId)) {
      setSelectedIds([]);
      prevUploadedCountRef.current = uploadedFiles.length;
      return;
    }
    const prev = prevUploadedCountRef.current;
    const curr = uploadedFiles.length;
    if (curr > prev) {
      if (justDidStartFreshRef.current) {
        const newFiles = uploadedFiles.slice(prev);
        setSelectedIds((prevIds) => [...prevIds, ...newFiles.map((f) => f.id)]);
        const t = setTimeout(() => { justDidStartFreshRef.current = false; }, 2000);
        prevUploadedCountRef.current = curr;
        return () => clearTimeout(t);
      }
      // กลับมาหลัง remount: ถ้า prev === 0 เลือกเฉพาะไฟล์ที่ใช้โดย test cases (ยกเว้นเมื่อ persisted cleared แล้ว)
      if (prev === 0) {
        const allCases = [...(savedTestCases || []), ...(pendingDraftTestCases || [])];
        const usedNames = new Set();
        allCases.forEach((t) => {
          if (t.vcdName) usedNames.add(t.vcdName);
          if (t.binName) usedNames.add(t.binName);
          if (t.linName) usedNames.add(t.linName);
        });
        const matchingIds = (uploadedFiles || []).filter((f) => usedNames.has(f.name)).map((f) => f.id);
        setSelectedIds(matchingIds.length > 0 ? matchingIds : []);
        prevUploadedCountRef.current = curr;
        return;
      }
      setSelectedIds(uploadedFiles.map((f) => f.id));
    }
    prevUploadedCountRef.current = curr;
  }, [uploadedFiles.length, savedTestCases.length, pendingDraftTestCases.length, activeProfileId]);

  // Auto-pair: เมื่อเลือกไฟล์ (VCD + ERoM) ให้สร้าง test case อัตโนมัติ — ใส่ draft จนกว่าจะกด Save
  useEffect(() => {
    const orderedFiles = selectedFiles;
    if (orderedFiles.length === 0) return;
    const orderedVcds = orderedFiles.filter((f) => getFileKind(f) === 'vcd');
    const orderedBins = orderedFiles.filter((f) => getFileKind(f) === 'bin');
    const orderedLins = orderedFiles.filter((f) => getFileKind(f) === 'lin');
    if (orderedVcds.length === 0 || orderedBins.length === 0) return;
    orderedVcds.forEach((vcdFile, vcdIdx) => {
      const vcdIndexInOrdered = orderedFiles.findIndex((f) => f.id === vcdFile.id);
      let nearestBin = null, minDistance = Infinity;
      orderedBins.forEach((binFile) => {
        const d = Math.abs(orderedFiles.findIndex((f) => f.id === binFile.id) - vcdIndexInOrdered);
        if (d < minDistance) { minDistance = d; nearestBin = binFile; }
      });
      const binFile = nearestBin || orderedBins[vcdIdx % orderedBins.length];
      let nearestLin = null, minLin = Infinity;
      orderedLins.forEach((linFile) => {
        const d = Math.abs(orderedFiles.findIndex((f) => f.id === linFile.id) - vcdIndexInOrdered);
        if (d < minLin) { minLin = d; nearestLin = linFile; }
      });
      const inSaved = (savedTestCases || []).some((t) => t.vcdName === vcdFile.name && t.binName === binFile.name);
      const inDraft = (pendingDraftTestCases || []).some((t) => t.vcdName === vcdFile.name && t.binName === binFile.name);
      if (!inSaved && !inDraft) {
        const name = getNextTestCaseName();
        const entry = { name, vcdName: vcdFile.name, binName: binFile.name, linName: nearestLin?.name || '', tryCount: 1, createdAt: new Date().toISOString() };
        if (loadedSetId) {
          addSavedTestCase(entry);
        } else {
          setPendingDraftTestCases((prev) => [...prev, { ...entry, id: `tc-draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }]);
        }
      }
    });
  }, [selectedIds.join(','), localDroppedFiles.length, localDroppedFiles.map((f) => f.id).join(','), savedTestCases?.length, pendingDraftTestCases?.length, loadedSetId]);

  // เมื่อโหลด Set แล้วอัปโหลดไฟล์เพิ่ม — เลือกไฟล์ที่ตรงกับ Set อัตโนมัติ
  useEffect(() => {
    if (!loadedSetId || !uploadedFiles.length) return;
    const loadedSet = savedTestCaseSets?.find((s) => s.id === loadedSetId);
    if (!loadedSet) return;
    const fileNames = loadedSet.fileLibrarySnapshot?.length
      ? loadedSet.fileLibrarySnapshot.map((s) => s.name)
      : [...(loadedSet.items || []).reduce((acc, t) => { if (t.vcdName) acc.add(t.vcdName); if (t.binName) acc.add(t.binName); if (t.linName) acc.add(t.linName); return acc; }, new Set())];
    if (fileNames.length === 0) return;
    const matchingIds = uploadedFiles.filter((f) => fileNames.includes(f.name)).map((f) => f.id);
    if (matchingIds.length > 0) setSelectedIds((prev) => [...new Set([...prev, ...matchingIds])]);
  }, [loadedSetId, uploadedFiles.length, savedTestCaseSets]);

  const handleSelectAllFiles = () => {
    if (selectedIds.length === uploadedFiles.length) setSelectedIds([]);
    else {
      setSetupClearedPersisted(activeProfileId, false);
      setSelectedIds(uploadedFiles.map((f) => f.id));
    }
  };
  const toggleFileSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      setSetupClearedPersisted(activeProfileId, false);
      return [...prev, id];
    });
  };
  const handleClearAll = () => {
    // ใช้สำหรับปุ่ม "Un Select All" — ให้แค่เอา checkbox ออกจากไฟล์ที่ถูกเลือก
    // ไม่ลบ local dropped files หรือกระทบตาราง Saved Test Cases
    setSelectedIds([]);
    setSelectedFileIdsForDelete([]);
    addToast({ type: 'info', message: 'Unselected all files (files remain in Library)' });
  };
  const handleDeleteSelected = async () => {
    if (selectedFileIdsForDelete.length === 0) {
      addToast({ type: 'info', message: 'เลือกไฟล์ที่ต้องการลบ (ติ๊ก checkbox ข้างชื่อไฟล์)' });
      return;
    }
    const toDelete = [...selectedFileIdsForDelete];
    if (!window.confirm(`ลบ ${toDelete.length} ไฟล์จาก Library และนำออกจากรายการ?`)) return;
    setIsDeletingFiles(true);
    for (const id of toDelete) {
      if (selectedIds.includes(id)) await removeUploadedFile(id);
    }
    setSelectedIds((prev) => prev.filter((id) => !toDelete.includes(id)));
    setLocalDroppedFiles((prev) => prev.filter((f) => !toDelete.includes(f.id)));
    setSelectedFileIdsForDelete([]);
    setSavedTestCases([]);
    setSelectedTestCaseIds([]);
    setLoadedSetId(null);
    setIsDeletingFiles(false);
    addToast({ type: 'success', message: `ลบ ${toDelete.length} ไฟล์จาก Library แล้ว` });
  };
  // Start fresh: ล้างเฉพาะ UI/ตาราง ไม่ลบข้อมูลจาก Library (server). Persist so refresh/return keeps empty.
  const handleStartFresh = () => {
    if (tableClearedMode && selectedIds.length === 0 && localDroppedFiles.length === 0) {
      addToast({ type: 'info', message: 'Table and file selection are already empty' });
      return;
    }
    if (!window.confirm('Clear table and file selection? (Saved test cases in Library will remain)')) return;
    setSetupClearedPersisted(activeProfileId, true);
    setTableClearedMode(true);
    setSelectedIds([]);
    setLocalDroppedFiles([]);
    setSelectedFileIdsForDelete([]);
    setPendingDraftTestCases([]);
    setSelectedTestCaseIds([]);
    setLoadedSetId(null);
    justDidStartFreshRef.current = true;
    addToast({ type: 'success', message: 'Table cleared — Library unchanged' });
  };

  const addToLocalDropped = (file) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const sizeFormatted = formatFileSize(file.size || 0);
    setLocalDroppedFiles((prev) => [...prev, { id, name: file.name, file, size: file.size, sizeFormatted }]);
  };
  // Names already in working area (selected from Library + local dropped) — used to skip duplicate drops
  const workingAreaNames = useMemo(
    () => new Set([
      ...selectedIds.map((id) => uploadedFiles.find((f) => f.id === id)?.name).filter(Boolean),
      ...localDroppedFiles.map((f) => f.name),
    ]),
    [selectedIds, uploadedFiles, localDroppedFiles]
  );
  const addFilesToWorkingArea = (files) => {
    const accepted = files.filter((f) => FILE_LIBRARY_ACCEPTED_EXT.has((String(f.name || '').split('.').pop() || '').toLowerCase()));
    const addedInThisBatch = new Set();
    let added = 0;
    let skipped = 0;
    for (const file of accepted) {
      if (workingAreaNames.has(file.name) || addedInThisBatch.has(file.name)) {
        skipped++;
        continue;
      }
      addToLocalDropped(file);
      addedInThisBatch.add(file.name);
      added++;
    }
    if (added > 0) {
      setSetupClearedPersisted(activeProfileId, false);
      addToast({ type: 'success', message: added === accepted.length && skipped === 0 ? `Added ${added} file(s)` : `Added ${added} file(s)${skipped > 0 ? `, ${skipped} duplicate(s) skipped` : ''}` });
    }
    if (skipped > 0 && added === 0) addToast({ type: 'info', message: `${skipped} file(s) already in list (duplicate name), skipped` });
  };
  const handleFileInputChange = (e) => {
    const files = e.target?.files;
    if (!files?.length) return;
    addFilesToWorkingArea([...files]);
    e.target.value = '';
  };
  const handleBrowseClick = () => fileInputRef.current?.click();

  const FILE_LIBRARY_ACCEPTED_EXT = new Set(['vcd', 'bin', 'hex', 'elf', 'erom', 'ulp', 'lin', 'txt']);
  const isAcceptedFile = (file) => FILE_LIBRARY_ACCEPTED_EXT.has((file.name || '').split('.').pop()?.toLowerCase());

  const readDirectoryRecursive = async (dirEntry) => {
    const files = [];
    const reader = dirEntry.createReader?.();
    if (!reader) return files;
    let entries;
    do {
      entries = await new Promise((resolve) => reader.readEntries(resolve));
      for (const e of entries) {
        if (e.isDirectory) files.push(...(await readDirectoryRecursive(e)));
        else {
          try {
            const f = await new Promise((res) => e.file(res));
            if (f) files.push(f);
          } catch (_) {}
        }
      }
    } while (entries.length > 0);
    return files;
  };

  const getAllFilesFromDataTransfer = async (dataTransfer) => {
    const out = [];
    if (dataTransfer.items) {
      for (const item of dataTransfer.items) {
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.();
        if (entry?.isDirectory) {
          const sub = await readDirectoryRecursive(entry);
          out.push(...sub.filter(isAcceptedFile));
        } else {
          const file = item.getAsFile();
          if (file && isAcceptedFile(file)) out.push(file);
        }
      }
    } else {
      for (const file of dataTransfer.files || []) {
        if (isAcceptedFile(file)) out.push(file);
      }
    }
    return out;
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); };
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = await getAllFilesFromDataTransfer(e.dataTransfer);
    addFilesToWorkingArea(files);
  };

  const handlePaste = async (e) => {
    const files = e.clipboardData?.files;
    if (!files?.length) return;
    e.preventDefault();
    addFilesToWorkingArea([...files]);
  };

  const pairAll = () => {
    if (vcdSelected.length === 0 || binSelected.length === 0) {
      addToast({ type: 'warning', message: 'Select at least one VCD and one ERoM file first' });
      return;
    }
    const orderedFiles = selectedFiles;
    const orderedVcds = orderedFiles.filter((f) => getFileKind(f) === 'vcd');
    const orderedBins = orderedFiles.filter((f) => getFileKind(f) === 'bin');
    const orderedLins = orderedFiles.filter((f) => getFileKind(f) === 'lin');
    let added = 0;
    const duplicateIds = new Set();
    const existingByKey = new Map(
      (savedTestCases || []).map((t) => [normalizeTCTestCaseKeyFull(t), t])
    );
    orderedVcds.forEach((vcdFile, vcdIdx) => {
      const vcdIndexInOrdered = orderedFiles.findIndex((f) => f.id === vcdFile.id);
      let nearestBin = null, minDistance = Infinity;
      orderedBins.forEach((binFile) => {
        const d = Math.abs(orderedFiles.findIndex((f) => f.id === binFile.id) - vcdIndexInOrdered);
        if (d < minDistance) { minDistance = d; nearestBin = binFile; }
      });
      const binFile = nearestBin || orderedBins[vcdIdx % orderedBins.length];
      let nearestLin = null, minLin = Infinity;
      orderedLins.forEach((linFile) => {
        const d = Math.abs(orderedFiles.findIndex((f) => f.id === linFile.id) - vcdIndexInOrdered);
        if (d < minLin) { minLin = d; nearestLin = linFile; }
      });
      const pairEntry = { vcdName: vcdFile.name, binName: binFile.name, linName: nearestLin?.name || '' };
      const key = normalizeTCTestCaseKeyFull(pairEntry);
      const existing = existingByKey.get(key) ||
        (pendingDraftTestCases || []).find((t) => normalizeTCTestCaseKeyFull(t) === key) ||
        (displayedSavedTestCases || []).find((t) => normalizeTCTestCaseKeyFull(t) === key);
      if (!existing) {
        const name = getNextTestCaseName();
        const entry = { name, vcdName: vcdFile.name, binName: binFile.name, linName: nearestLin?.name || '', tryCount: 1, createdAt: new Date().toISOString() };
        if (loadedSetId) {
          addSavedTestCase(entry);
        } else {
          setPendingDraftTestCases((prev) => [...prev, { ...entry, id: `tc-draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }]);
        }
        added++;
      } else if (existing.id) {
        duplicateIds.add(existing.id);
      }
    });
    if (added > 0) {
      setSetupClearedPersisted(activeProfileId, false);
      setTableClearedMode(false);
      addToast({ type: 'success', message: `Added ${added} test case(s) from selection` });
      if (duplicateIds.size > 0) {
        addToast({ type: 'info', message: `${duplicateIds.size} selection(s) matched existing test case(s) and were skipped` });
      }
    } else if (duplicateIds.size > 0) {
      const ids = Array.from(duplicateIds);
      setSelectedTestCaseIds(ids);
      setDuplicateHighlightIds(ids);
      addToast({ type: 'info', message: `Test case with the same files already exists (${ids.length})` });
    } else {
      addToast({ type: 'info', message: 'All possible pairs already in library' });
    }
  };

  const addOneTestCase = () => {
    setSetupClearedPersisted(activeProfileId, false);
    setTableClearedMode(false);
    const name = getNextTestCaseName();
    const entry = { name, vcdName: '', binName: '', linName: '', tryCount: 1, createdAt: new Date().toISOString() };
    if (loadedSetId) {
      addSavedTestCase(entry);
    } else {
      setPendingDraftTestCases((prev) => [...prev, { ...entry, id: `tc-draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }]);
    }
    addToast({ type: 'success', message: `Added "${name}" — fill VCD/ERoM below or rename if you like` });
  };

  // Clear: ล้างเฉพาะ UI/ตาราง ไม่ลบข้อมูลจาก Library (server). Persist so refresh/return keeps empty.
  const clearAllTestCases = () => {
    const total = (savedTestCases?.length || 0) + (pendingDraftTestCases?.length || 0) + selectedIds.length;
    if (total === 0) { addToast({ type: 'info', message: 'No test cases or file selection to clear' }); return; }
    if (window.confirm('Clear table and file selection? (Saved test cases in Library will remain)')) {
      setSetupClearedPersisted(activeProfileId, true);
      setTableClearedMode(true);
      setPendingDraftTestCases([]);
      setSelectedTestCaseIds([]);
      setSelectedIds([]);
      setLoadedSetId(null);
      addToast({ type: 'success', message: 'Table cleared — Library unchanged' });
    }
  };

  const toggleSelectAllTestCases = () => {
    if (selectedTestCaseIds.length === displayedSavedTestCases.length) setSelectedTestCaseIds([]);
    else setSelectedTestCaseIds(displayedSavedTestCases.map((t) => t.id));
  };
  const toggleTestCaseSelect = (id) => {
    setSelectedTestCaseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const handleBulkSetTryCount = () => {
    if (selectedTestCaseIds.length === 0) { addToast({ type: 'warning', message: 'Select at least one test case' }); return; }
    const num = parseInt(bulkTryCount, 10);
    if (isNaN(num) || num < 1) { addToast({ type: 'error', message: 'Enter a valid number (min 1)' }); return; }
    const draftIds = selectedTestCaseIds.filter((id) => isDraftId(id));
    const savedIds = selectedTestCaseIds.filter((id) => !isDraftId(id));
    if (draftIds.length > 0) {
      setPendingDraftTestCases((prev) =>
        prev.map((t) => (draftIds.includes(t.id) ? { ...t, tryCount: num } : t))
      );
    }
    if (savedIds.length > 0) bulkUpdateTryCount(savedIds, num);
    setBulkTryCount('');
    addToast({ type: 'success', message: `Set try count to ${num} for ${selectedTestCaseIds.length} test case(s)` });
  };
  const handleDeleteSelectedTestCases = () => {
    if (selectedTestCaseIds.length === 0) { addToast({ type: 'warning', message: 'Select at least one test case to delete' }); return; }
    const selectedTcs = displayedSavedTestCases.filter((t) => selectedTestCaseIds.includes(t.id));
    const inUse = selectedTcs.filter((tc) => {
      const v = (tc.vcdName || '').trim();
      const b = (tc.binName || '').trim();
      const l = (tc.linName || '').trim();
      return (v && fileNamesInUseByBatch.has(v)) || (b && fileNamesInUseByBatch.has(b)) || (l && fileNamesInUseByBatch.has(l));
    });
    if (inUse.length > 0) {
      addToast({
        type: 'warning',
        message: `${inUse.length} selected test case(s) use files that are in a running or pending set. Wait for the set to finish before deleting them.`,
      });
      return;
    }
    selectedTestCaseIds.forEach((id) => removeDisplayedTestCase(id));
    setSelectedTestCaseIds([]);
    addToast({ type: 'success', message: `Deleted ${selectedTestCaseIds.length} test case(s)` });
  };

  const reorderList = (arr, fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= arr.length || toIndex >= arr.length) return arr;
    const next = [...arr];
    const [item] = next.splice(fromIndex, 1);
    next.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, item);
    return next;
  };
  const handleRowDragStart = (e, index) => { draggingRowIndexRef.current = index; setDraggingRowIndex(index); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); };
  const handleRowDragOver = (e, index) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetRowIndex(index); };
  const handleRowDrop = (e, toIndex) => {
    e.preventDefault();
    const fromIndex = draggingRowIndexRef.current;
    if (fromIndex == null || isViewingShared) {
      draggingRowIndexRef.current = null;
      setDraggingRowIndex(null);
      setDropTargetRowIndex(null);
      return;
    }
    const list = displayedSavedTestCases;
    if (list.length === 0) return;
    const reordered = reorderList([...list], fromIndex, toIndex);
    if (pendingDraftTestCases.length > 0) {
      const saved = reordered.filter((t) => !String(t.id || '').startsWith('tc-draft-'));
      const draft = reordered.filter((t) => String(t.id || '').startsWith('tc-draft-'));
      setSavedTestCases(saved);
      setPendingDraftTestCases(draft);
    } else {
      reorderSavedTestCases(fromIndex, toIndex);
    }
    draggingRowIndexRef.current = null;
    setDraggingRowIndex(null);
    setDropTargetRowIndex(null);
  };
  const handleRowDragEnd = () => { draggingRowIndexRef.current = null; setDraggingRowIndex(null); setDropTargetRowIndex(null); };

  const handleCsvFileInput = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      if (lines.length < 2) {
        addToast({ type: 'warning', message: 'CSV must have at least 1 data row' });
        return;
      }
      const headerRaw = lines[0].split(',').map((h) => h.trim());
      const header = headerRaw.map((h) => h.toLowerCase());
      const knownKeys = new Set(['name', 'testcase', 'test_case', 'vcd', 'bin', 'erom', 'firmware', 'lin', 'ulp', 'try', 'tries', 'retry', 'tag']);
      const extraColumnIndices = header
        .map((h, idx) => ({ key: headerRaw[idx] || h, idx }))
        .filter(({ key }) => {
          const k = (key || '').trim().toLowerCase();
          return k && !knownKeys.has(k);
        });

      const idxName = header.findIndex((h) => h === 'name' || h === 'testcase' || h === 'test_case');
      const idxVcd = header.findIndex((h) => h === 'vcd');
      const idxBin = header.findIndex((h) => h === 'bin' || h === 'erom' || h === 'firmware');
      const idxLin = header.findIndex((h) => h === 'lin' || h === 'ulp');
      const idxTry = header.findIndex((h) => h === 'try' || h === 'tries' || h === 'retry');

      if (idxVcd === -1 || idxBin === -1) {
        addToast({ type: 'error', message: 'CSV must have at least VCD and BIN/EROM columns' });
        return;
      }

      const currentNames = (savedTestCases || []).map((t) => (t.name || '').trim()).filter((n) => n !== '');
      const draftNames = (pendingDraftTestCases || []).map((t) => (t.name || '').trim()).filter((n) => n !== '');
      const setNames = (savedTestCaseSets || []).flatMap((set) =>
        (Array.isArray(set.items) ? set.items : []).map((t) => (t.name || '').trim()).filter((n) => n !== '')
      );
      const existingNames = new Set([...currentNames, ...draftNames, ...setNames]);
      const created = [];

      const makeUniqueName = (baseRaw) => {
        const baseInitial = (baseRaw || 'Test case').trim() || 'Test case';
        let name = baseInitial;
        if (!existingNames.has(name)) {
          existingNames.add(name);
          return name;
        }
        let n = 2;
        while (existingNames.has(`${baseInitial} (${n})`)) n++;
        name = `${baseInitial} (${n})`;
        existingNames.add(name);
        return name;
      };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (!cols.some((c) => c.trim() !== '')) continue;
        const vcdName = (cols[idxVcd] || '').trim();
        const binName = (cols[idxBin] || '').trim();
        if (!vcdName || !binName) continue;
        const rawName = idxName >= 0 ? cols[idxName] : vcdName;
        const name = makeUniqueName(rawName);
        const linName = idxLin >= 0 ? (cols[idxLin] || '').trim() : '';
        let tryCount = 1;
        if (idxTry >= 0) {
          const parsed = parseInt(cols[idxTry], 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
            tryCount = parsed;
          }
        }
        const extraColumns = {};
        extraColumnIndices.forEach(({ key, idx }) => {
          const val = (cols[idx] || '').trim();
          if (key) extraColumns[key] = val;
        });
        created.push({
          id: loadedSetId ? `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : `tc-draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name,
          vcdName,
          binName,
          linName: linName || '',
          tryCount,
          createdAt: new Date().toISOString(),
          ...(Object.keys(extraColumns).length > 0 ? { extraColumns } : {}),
        });
      }

      if (created.length === 0) {
        addToast({ type: 'warning', message: 'No rows in CSV have both VCD and BIN/EROM' });
        return;
      }

      if (loadedSetId) {
        const nextList = [...(loadedSetTable || []), ...created];
        setSavedTestCases(nextList);
      } else {
        setPendingDraftTestCases((prev) => [...prev, ...created]);
      }
      setSetupClearedPersisted(activeProfileId, false);
      setTableClearedMode(false);
      let msg = `Imported ${created.length} test case(s) from CSV (names made unique)`;
      if (extraColumnIndices.length > 0) {
        msg += ` — ${extraColumnIndices.length} extra column(s) added: ${extraColumnIndices.map((x) => x.key).join(', ')}`;
      }
      addToast({ type: 'success', message: msg });
    } catch (err) {
      addToast({ type: 'error', message: `Failed to read CSV: ${err.message}` });
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // Export Saved Test Cases to JSON (ข้อ 4 — Save/Load JSON สำหรับตาราง)
  const saveTestCasesJson = () => {
    const list = displayedSavedTestCases.map((tc) => ({
      name: tc.name || '',
      vcdName: tc.vcdName || '',
      binName: tc.binName || '',
      linName: tc.linName || '',
      tryCount: typeof tc.tryCount === 'number' && tc.tryCount > 0 ? tc.tryCount : 1,
      extraColumns: tc.extraColumns && typeof tc.extraColumns === 'object' ? tc.extraColumns : {},
      createdAt: tc.createdAt || new Date().toISOString(),
    }));
    const blob = new Blob([JSON.stringify({ testCases: list, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test_cases_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: `Exported ${list.length} test case(s) to JSON` });
  };

  const loadTestCasesJson = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.json')) {
      addToast({ type: 'warning', message: 'Please select a JSON file' });
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = Array.isArray(data.testCases) ? data.testCases : (Array.isArray(data) ? data : []);
      if (list.length === 0) {
        addToast({ type: 'info', message: 'No test cases in this JSON file' });
        return;
      }
      const normalized = list.map((tc) => ({
        name: (tc.name || '').trim() || 'Unnamed',
        vcdName: tc.vcdName || '',
        binName: tc.binName || '',
        linName: tc.linName || '',
        tryCount: typeof tc.tryCount === 'number' && tc.tryCount > 0 ? tc.tryCount : 1,
        extraColumns: tc.extraColumns && typeof tc.extraColumns === 'object' ? tc.extraColumns : {},
        createdAt: tc.createdAt || new Date().toISOString(),
      }));
      if (loadedSetId) {
        const set = (savedTestCaseSets || []).find((s) => s.id === loadedSetId);
        if (set && isSetInUseByJobs(set)) {
          addToast({ type: 'warning', message: 'Set นี้กำลังถูกใช้รันอยู่ ไม่สามารถโหลด JSON ทับได้' });
          return;
        }
        updateSavedTestCaseSet(loadedSetId, { items: normalized });
        addToast({ type: 'success', message: `Loaded ${normalized.length} test case(s) into set` });
      } else {
        setTableClearedMode(false);
        setSetupClearedPersisted(activeProfileId, false);
        setPendingDraftTestCases(normalized);
        addToast({ type: 'success', message: `Loaded ${normalized.length} test case(s) to table` });
      }
    } catch (err) {
      addToast({ type: 'error', message: `Failed to load JSON: ${err.message}` });
    } finally {
      if (testCasesJsonInputRef.current) testCasesJsonInputRef.current.value = '';
    }
  };

  const selectedFilesList = workingFilesList;
  const filteredFiles = [...selectedFilesList]
    .filter((f) => {
      const k = getFileKind(f);
      if (fileFilter !== 'all') {
        if (fileFilter === 'vcd' && k !== 'vcd') return false;
        if (fileFilter === 'bin' && k !== 'bin') return false;
        if (fileFilter === 'lin' && k !== 'lin') return false;
        if (fileFilter === 'mdi' && k !== 'mdi') return false;
      }
      if (fileSearch.trim()) return f.name.toLowerCase().includes(fileSearch.trim().toLowerCase());
      return true;
    })
    .sort((a, b) => (fileSort === 'time' ? (b.uploadedAt || 0) - (a.uploadedAt || 0) : (a.name || '').localeCompare(b.name || '')));
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <UploadChoiceModal
        open={!!saveLibraryUploadModal?.prepared?.length}
        prepared={saveLibraryUploadModal?.prepared ?? []}
        onConfirm={handleSaveLibraryUploadChoiceConfirm}
        onCancel={() => setSaveLibraryUploadModal(null)}
      />
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Test Cases</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Create and Store Test cases </p>
      </div>

      {isViewingShared && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Viewing shared profile: <strong>{viewingSharedName}</strong> (read-only)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                copySharedToMyProfile();
                addToast({ type: 'success', message: 'Copied to your profile' });
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              Copy to my profile
            </button>
            <button
              onClick={() => setViewingSharedProfile(null)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Stop viewing
            </button>
          </div>
        </div>
      )}

      {/* File Library (เทียบเท่า Setup) — โหลด Set จะเลือกไฟล์ของ Set ใน Library ด้วย */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loadedSetId && (() => {
          const loadedSet = displayedSavedTestCaseSets?.find((s) => s.id === loadedSetId);
          const namesArr = loadedSet?.fileLibrarySnapshot?.length
            ? loadedSet.fileLibrarySnapshot.map((s) => s.name)
            : [...(loadedSet?.items || []).reduce((acc, t) => { if (t.vcdName) acc.add(t.vcdName); if (t.binName) acc.add(t.binName); if (t.linName) acc.add(t.linName); return acc; }, new Set())];
          const inLibrary = namesArr.filter((n) => uploadedFiles.some((f) => f.name === n)).length;
          const total = namesArr.length;
          return total > 0 ? (
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
              Set &quot;{loadedSet?.name}&quot;: Files in Library {inLibrary}/{total}
              {inLibrary < total && <span className="ml-1"> — Upload missing files to run this set</span>}
            </div>
          ) : null;
        })()}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400"> ({workingCount}) </span>
          </div>
          <div className="flex items-center gap-2">
            {workingCount > 0 && <button onClick={handleClearAll} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200">Un Select All</button>}
            {workingCount > 0 && !isViewingShared && <button onClick={handleDeleteSelected} disabled={isDeletingFiles} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-60">Delete from Library</button>}
            {(displayedSavedTestCases.length > 0 || workingCount > 0) && !isViewingShared && <button onClick={handleStartFresh} className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100">Start fresh</button>}
          </div>
        </div>
        <input ref={fileInputRef} type="file" multiple accept=".vcd,.bin,.hex,.elf,.erom,.ulp,.txt" onChange={handleFileInputChange} className="hidden" />
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900">
          {['all', 'vcd', 'bin', 'lin', 'mdi'].map((k) => (
            <button key={k} onClick={() => setFileFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${fileFilter === k ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-blue-200'}`}>{k === 'all' ? 'All' : k === 'mdi' ? 'MDI' : k.toUpperCase()}</button>
          ))}
          {workingCount > 0 && !isViewingShared && (
            <button onClick={handleDeleteSelected} disabled={isDeletingFiles || selectedFileIdsForDelete.length === 0} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed shrink-0" title={selectedFileIdsForDelete.length > 0 ? `ลบ ${selectedFileIdsForDelete.length} ไฟล์ที่เลือกจาก Library` : 'เลือกไฟล์ที่ต้องการลบ (ติ๊ก checkbox)'}>
              <Trash2 size={18} strokeWidth={2} />
            </button>
          )}
          <button onClick={handleBrowseClick} className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Upload files or drop folder / Ctrl+V to paste"><Plus size={16} /></button>
          <input type="text" value={fileSearch} onChange={(e) => setFileSearch(e.target.value)} placeholder="Search..." className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800" />
          <select value={fileSort} onChange={(e) => setFileSort(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"><option value="time">Time</option><option value="name">Name</option></select>
        </div>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
          className={`divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto transition-[max-height] ${fileListExpanded ? 'max-h-[500px]' : 'max-h-[220px]'} ${isDragging ? 'ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
        >
          {loading?.files ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : errors?.files ? (
            <div className="p-8 text-center text-red-500">{errors.files}</div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-6 text-center">
              {loadedSetId && (() => {
                const loadedSet = savedTestCaseSets?.find((s) => s.id === loadedSetId);
                const namesArr = loadedSet?.fileLibrarySnapshot?.length
                  ? loadedSet.fileLibrarySnapshot.map((s) => s.name)
                  : [...(loadedSet?.items || []).reduce((acc, t) => { if (t.vcdName) acc.add(t.vcdName); if (t.binName) acc.add(t.binName); if (t.linName) acc.add(t.linName); return acc; }, new Set())];
                if (namesArr.length === 0) return null;
                return (
                  <>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">Set &quot;{loadedSet?.name}&quot; uses {namesArr.length} file(s) — none in Library</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3"></p>
                    <ul className="text-xs text-left max-w-md mx-auto space-y-1 text-slate-600 dark:text-slate-300">
                      {namesArr.map((name) => (
                        <li key={name} className="truncate">• {name}</li>
                      ))}
                    </ul>
                  </>
                );
              })()}
              <p className="text-slate-400 mt-2">No files</p>
            </div>
          ) : (
            filteredFiles.map((f) => {
              const isCheckedForDelete = selectedFileIdsForDelete.includes(f.id);
              return (
                <div key={f.id} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{f.name}</span>
                  <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" title="เลือกเพื่อลบจาก Library">
                    <input
                      type="checkbox"
                      checked={isCheckedForDelete}
                      onChange={() => setSelectedFileIdsForDelete((prev) => (prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]))}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFileIdsForDelete((prev) => prev.filter((id) => id !== f.id));
                      if (String(f.id).startsWith('local-')) setLocalDroppedFiles((prev) => prev.filter((x) => x.id !== f.id));
                      else setSelectedIds((prev) => prev.filter((id) => id !== f.id));
                    }}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                    title={String(f.id).startsWith('local-') ? 'นำออกจากรายการ (ยังไม่ได้บันทึกลง Library)' : 'นำออกจากรายการ'}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <button onClick={() => setFileListExpanded((b) => !b)} className="w-full py-1 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">{fileListExpanded ? 'Collapse' : 'Expand'} file list</button>
      </div>

      {/* Saved Test Cases table (Apply try, Duplicate, Move, Auto select, Save as Set) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Create Test Cases</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={pairAll} disabled={vcdSelected.length === 0 || binSelected.length === 0} className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${vcdSelected.length === 0 || binSelected.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`} title="Pair selected files and add to test cases"><Layers size={14} /> Pair All</button>
            <button onClick={addOneTestCase} className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"><Plus size={14} /> Add Test Case</button>
            <button onClick={clearAllTestCases} disabled={(savedTestCases.length === 0 && workingCount === 0) || isViewingShared} className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${(savedTestCases.length === 0 && workingCount === 0) || isViewingShared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}><X size={14} /> Clear</button>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1" />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5"
            >
              <FileUp size={14} />
              <span>Import CSV</span>
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvFileInput}
              className="hidden"
            />
            <button
              onClick={saveTestCasesJson}
              disabled={displayedSavedTestCases.length === 0 || isViewingShared}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export test cases to JSON"
            >
              <FileJson size={14} />
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => testCasesJsonInputRef.current?.click()}
              disabled={isViewingShared}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Load test cases from JSON"
            >
              <FileJson size={14} />
              <span>Load JSON</span>
            </button>
            <input
              ref={testCasesJsonInputRef}
              type="file"
              accept=".json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadTestCasesJson(f); }}
              className="hidden"
            />
            <button
              onClick={async () => {
                const toSave = pendingDraftTestCases || [];
                if (toSave.length === 0 && (savedTestCases?.length || 0) === 0) {
                  addToast({ type: 'warning', message: 'No test cases to save' });
                  return;
                }
                // Upload any dropped-but-not-yet-uploaded files first; compare by checksum so duplicates are not re-uploaded
                const toUpload = (localDroppedFiles || []).filter((f) => f && f.file instanceof File);
                if (toUpload.length > 0) {
                  await refreshFiles?.();
                  const currentFiles = useTestStore.getState().uploadedFiles || [];
                  const byChecksum = new Map(
                    currentFiles
                      .filter((f) => f.checksum)
                      .map((f) => [f.checksum, f])
                  );
                  const byName = new Map(currentFiles.map((f) => [f.name.toLowerCase(), f]));
                  const prepared = [];
                  for (const f of toUpload) {
                    const sig = await computeFileSignature(f.file);
                    const existingByChecksum = sig.checksum ? byChecksum.get(sig.checksum) : null;
                    const existingByName = byName.get((f.file.name || '').toLowerCase());
                    prepared.push({ file: f.file, sig, existing: existingByChecksum || existingByName });
                  }
                  const duplicates = prepared.filter((p) => p.existing);
                  if (duplicates.length > 0) {
                    setSaveLibraryUploadModal({ prepared, toSave });
                    return;
                  }
                  let uploaded = 0;
                  for (const p of prepared) {
                    const result = await addUploadedFile(p.file);
                    if (result) uploaded++;
                  }
                  setLocalDroppedFiles([]);
                  if (refreshFiles) await refreshFiles();
                  if (uploaded > 0) addToast({ type: 'success', message: `${uploaded} file(s) uploaded to library` });
                }
                if (toSave.length > 0) {
                  const existingSaved = useTestStore.getState().savedTestCases || [];
                  const existingByKey = new Map(
                    existingSaved.map((t) => [getFullTestCaseFileKeyFromMerged(t, mergeCommandsIntoExtraForSave(t)), t])
                  );
                  const skipped = [];
                  const created = [];
                  toSave.forEach((tc) => {
                    const { id, commands, ...rest } = tc;
                    const extraColumns = mergeCommandsIntoExtraForSave(tc);
                    const key = getFullTestCaseFileKeyFromMerged(rest, extraColumns);
                    if (existingByKey.get(key)) {
                      skipped.push(key);
                      return;
                    }
                    const newId = addSavedTestCase({
                      ...rest,
                      extraColumns: Object.keys(extraColumns).length ? extraColumns : undefined,
                    });
                    created.push(newId);
                  });
                  setPendingDraftTestCases([]);
                  if (refreshFiles) await refreshFiles();
                  const total = useTestStore.getState().savedTestCases?.length || 0;
                  if (created.length > 0) {
                    addToast({ type: 'success', message: `Test cases saved to library (${total} case(s))` });
                    if (skipped.length > 0) {
                      addToast({ type: 'info', message: `${skipped.length} test case(s) already existed (same VCD/ERoM/ULP) — not duplicated` });
                    }
                  } else if (skipped.length > 0) {
                    addToast({ type: 'info', message: `All ${skipped.length} test case(s) already in library — no new entries` });
                  }
                } else {
                  if (refreshFiles) await refreshFiles();
                  const total = useTestStore.getState().savedTestCases?.length || 0;
                  addToast({ type: 'success', message: `Library updated (${total} test case(s))` });
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5"
              title="Save test cases. Dropped files will be uploaded to File in Library first."
            >
              <Save size={14} />
              <span>Save to library</span>
            </button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400" title="Dropped files are uploaded when you click Save to library. Or upload in the File Library area above first."></span>
          </div>
        </div>
        {loadedSetId && displayedSavedTestCaseSets?.find((s) => s.id === loadedSetId) && !isViewingShared && (
          <div className="mb-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              Editing set: {displayedSavedTestCaseSets.find((s) => s.id === loadedSetId)?.name}
            </span>
            <button
              onClick={() => {
                const currentSet = displayedSavedTestCaseSets.find((s) => s.id === loadedSetId);
                if (currentSet && isSetInUseByJobs(currentSet)) {
                  addToast({
                    type: 'warning',
                    message: 'ชุด Set นี้กำลังถูกใช้รันอยู่ ไม่สามารถอัปเดต test cases / files ได้จนกว่ารันเสร็จ',
                  });
                  return;
                }
                const mergeCommandsIntoExtra = (tc) => {
                  const extra = tc.extraColumns && typeof tc.extraColumns === 'object' ? { ...tc.extraColumns } : {};
                  const cmds = Array.isArray(tc.commands) ? tc.commands : [];
                  const vcdCmds = cmds.filter((c) => c.type === 'vcd' && (c.file || '').trim());
                  const eromCmds = cmds.filter((c) => c.type === 'erom' && (c.file || '').trim());
                  const ulpCmds = cmds.filter((c) => c.type === 'ulp' && (c.file || '').trim());
                  vcdCmds.forEach((c, i) => { extra[`VCD${i + 2}`] = c.file || ''; });
                  eromCmds.forEach((c, i) => { extra[`ERoM${i + 2}`] = c.file || ''; });
                  ulpCmds.forEach((c, i) => { extra[`ULP${i + 2}`] = c.file || ''; });
                  return Object.fromEntries(Object.entries(extra).filter(([, v]) => (v ?? '').toString().trim() !== ''));
                };
                const normalized = displayedSavedTestCases.map((t) => ({
                  name: t.name || '',
                  vcdName: t.vcdName || '',
                  binName: t.binName || '',
                  linName: t.linName || '',
                  boardId: t.boardId || '',
                  tryCount: typeof t.tryCount === 'number' && t.tryCount > 0 ? t.tryCount : 1,
                  extraColumns: mergeCommandsIntoExtra(t),
                  createdAt: t.createdAt || new Date().toISOString(),
                }));
                const fileNames = new Set();
                displayedSavedTestCases.forEach((t) => {
                  if (t.vcdName) fileNames.add(t.vcdName);
                  if (t.binName) fileNames.add(t.binName);
                  if (t.linName) fileNames.add(t.linName);
                  const ec = mergeCommandsIntoExtra(t);
                  Object.values(ec).forEach((v) => { if ((v ?? '').toString().trim()) fileNames.add(String(v).trim()); });
                });
                const fileLibrarySnapshot = [...fileNames].map((n) => ({ name: n }));
                updateSavedTestCaseSet(loadedSetId, { items: normalized, fileLibrarySnapshot });
                const setName = displayedSavedTestCaseSets.find((s) => s.id === loadedSetId)?.name || 'Set';
                restoreSavedTestCasesFromProfile();
                addToast({ type: 'success', message: `Updated set "${setName}"` });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"
            >
              Update set
            </button>
            <button
              onClick={() => {
                restoreSavedTestCasesFromProfile();
              }}
              className="px-2 py-1 rounded text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              Cancel
            </button>
          </div>
        )}
        {displayedSavedTestCases.length > 0 && !isViewingShared && (
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400"></span>
            {selectedTestCaseIds.length > 0 && (
              <>
                <span className="text-xs text-slate-500">{selectedTestCaseIds.length} selected</span>
                <input type="number" min={1} value={bulkTryCount} onChange={(e) => setBulkTryCount(e.target.value)} placeholder="Try" className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-500 rounded bg-white dark:bg-slate-800" onKeyDown={(e) => e.key === 'Enter' && handleBulkSetTryCount()} />
                <button onClick={handleBulkSetTryCount} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700">Apply</button>
                <span className="text-slate-300 dark:text-slate-600 mx-0.5">|</span>
                <button onClick={handleDeleteSelectedTestCases} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 flex items-center gap-1" title="Delete selected test cases">
                  <Trash2 size={12} />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
        {/* Tab switcher: Table (horizontal) | Step (vertical layout per image) + Select all when Step */}
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-600">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTestCaseTableLayout('table')}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
                testCaseTableLayout === 'table'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setTestCaseTableLayout('step')}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
                testCaseTableLayout === 'step'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Vertical
            </button>
          </div>
          {testCaseTableLayout === 'step' && displayedSavedTestCases.length > 0 && (
            <label className={`flex items-center gap-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 ${isViewingShared ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={selectedTestCaseIds.length === displayedSavedTestCases.length}
                disabled={isViewingShared}
                onChange={toggleSelectAllTestCases}
                className="w-4 h-4 rounded cursor-pointer"
                title="Select all"
              />
              Select all
            </label>
          )}
        </div>
        {testCaseTableLayout === 'table' ? (
          /* Tab 1: Table layout (horizontal) — original */
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-600 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                <th className="w-10 px-2 py-2 border-r border-slate-200 dark:border-slate-600">
                  <input
                    type="checkbox"
                    checked={displayedSavedTestCases.length > 0 && selectedTestCaseIds.length === displayedSavedTestCases.length}
                    onChange={toggleSelectAllTestCases}
                    disabled={isViewingShared}
                    className="w-4 h-4 rounded cursor-pointer"
                    title="Select all"
                  />
                </th>
                <th className="w-8 px-2 py-2 border-r border-slate-200 dark:border-slate-600">#</th>
                <th className="px-2 py-2 border-r border-slate-200 dark:border-slate-600">Name</th>
                <th className="px-2 py-2 border-r border-slate-200 dark:border-slate-600">Tag</th>
                <th className="w-28 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Date</th>
                <th className="px-2 py-2 border-r border-slate-200 dark:border-slate-600">ERoM</th>
                <th className="px-2 py-2 border-r border-slate-200 dark:border-slate-600">ULP</th>
                <th className="px-2 py-2 border-r border-slate-200 dark:border-slate-600">VCD</th>
                {(() => {
                  const getExtraColKeys = (t) => {
                    const fromExtra = Object.keys(t.extraColumns || {});
                    const fromCmds = [];
                    (t.commands || []).filter((c) => c.type === 'vcd' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`VCD${i + 2}`));
                    (t.commands || []).filter((c) => c.type === 'erom' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ERoM${i + 2}`));
                    (t.commands || []).filter((c) => c.type === 'ulp' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ULP${i + 2}`));
                    return [...fromExtra, ...fromCmds];
                  };
                  const getExtraVal = (tc, col) => {
                    const m = col.match(/^VCD(\d+)$/);
                    if (m) {
                      const idx = parseInt(m[1], 10) - 2;
                      const vcds = (tc.commands || []).filter((c) => c.type === 'vcd' && (c.file || '').trim());
                      return vcds[idx]?.file ?? tc.extraColumns?.[col] ?? '';
                    }
                    const m2 = col.match(/^ERoM(\d+)$/);
                    if (m2) {
                      const idx = parseInt(m2[1], 10) - 2;
                      const eroms = (tc.commands || []).filter((c) => c.type === 'erom' && (c.file || '').trim());
                      return eroms[idx]?.file ?? tc.extraColumns?.[col] ?? '';
                    }
                    const m3 = col.match(/^ULP(\d+)$/);
                    if (m3) {
                      const idx = parseInt(m3[1], 10) - 2;
                      const ulps = (tc.commands || []).filter((c) => c.type === 'ulp' && (c.file || '').trim());
                      return ulps[idx]?.file ?? tc.extraColumns?.[col] ?? '';
                    }
                    return tc.extraColumns?.[col] ?? '';
                  };
                  const allCols = [...new Set(displayedSavedTestCases.flatMap(getExtraColKeys))].sort();
                  const extraCols = allCols
                    .filter((col) => !/^tag$/i.test(col))
                    .filter((col) => displayedSavedTestCases.some((t) => (getExtraVal(t, col) ?? '').toString().trim() !== ''));
                  return extraCols.map((col) => (
                    <th key={col} className="px-2 py-2 border-r border-slate-200 dark:border-slate-600 min-w-[80px]" title="Extra column from CSV">{col}</th>
                  ));
                })()}
                <th className="w-16 px-2 py-2 border-r border-slate-200 dark:border-slate-600 text-center">Try</th>
                <th className="w-32 px-2 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedSavedTestCases.length === 0 ? (
                <tr>
                  <td colSpan={9 + (() => {
                    const getKeys = (t) => {
                      const fromExtra = Object.keys(t.extraColumns || {});
                      const fromCmds = [];
                      (t.commands || []).filter((c) => c.type === 'vcd' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`VCD${i + 2}`));
                      (t.commands || []).filter((c) => c.type === 'erom' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ERoM${i + 2}`));
                      (t.commands || []).filter((c) => c.type === 'ulp' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ULP${i + 2}`));
                      return [...fromExtra, ...fromCmds];
                    };
                    const getVal = (t, col) => {
                      const m = col.match(/^VCD(\d+)$/);
                      if (m) {
                        const idx = parseInt(m[1], 10) - 2;
                        const vcds = (t.commands || []).filter((x) => x.type === 'vcd' && (x.file || '').trim());
                        return vcds[idx]?.file ?? t.extraColumns?.[col] ?? '';
                      }
                      const m2 = col.match(/^ERoM(\d+)$/);
                      if (m2) {
                        const idx = parseInt(m2[1], 10) - 2;
                        const eroms = (t.commands || []).filter((x) => x.type === 'erom' && (x.file || '').trim());
                        return eroms[idx]?.file ?? t.extraColumns?.[col] ?? '';
                      }
                      const m3 = col.match(/^ULP(\d+)$/);
                      if (m3) {
                        const idx = parseInt(m3[1], 10) - 2;
                        const ulps = (t.commands || []).filter((x) => x.type === 'ulp' && (x.file || '').trim());
                        return ulps[idx]?.file ?? t.extraColumns?.[col] ?? '';
                      }
                      return t.extraColumns?.[col] ?? '';
                    };
                    const allCols = [...new Set(displayedSavedTestCases.flatMap(getKeys))].sort();
                    const extraCols = allCols
                      .filter((col) => !/^tag$/i.test(col))
                      .filter((col) => displayedSavedTestCases.some((t) => (getVal(t, col) ?? '').toString().trim() !== ''));
                    return extraCols.length;
                  })()} className="py-8 text-center text-slate-400">
                    No test cases — use Pair All or Add Test Case
                  </td>
                </tr>
              ) : (
                displayedSavedTestCases.map((tc, idx) => (
                  <tr
                    key={tc.id}
                    onDragEnter={(e) => e.preventDefault()}
                    onDragOver={(e) => handleRowDragOver(e, idx)}
                    onDrop={(e) => handleRowDrop(e, idx)}
                    className={`border-b border-slate-100 dark:border-slate-700 ${
                      draggingRowIndex === idx ? 'opacity-50' : ''
                    } ${
                      dropTargetRowIndex === idx
                        ? 'ring-1 ring-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    } ${
                      selectedTestCaseIds.includes(tc.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${
                      duplicateHighlightIds.includes(tc.id) ? 'animate-pulse ring-1 ring-emerald-400' : ''
                    } ${
                      isTestCaseInUseByBatch(tc) ? 'opacity-75 bg-slate-50 dark:bg-slate-800/50' : ''
                    }`}
                  >
                    <td
                      className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700"
                      onClick={() => toggleTestCaseSelect(tc.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTestCaseIds.includes(tc.id)}
                        onChange={() => toggleTestCaseSelect(tc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700 text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700">
                      <input
                        type="text"
                        value={tc.name || ''}
                        onChange={(e) =>
                          handleNameChange(tc.id, e.target.value, tc.name || '')
                        }
                        disabled={isTestCaseInUseByBatch(tc) || isViewingShared}
                        className={`w-full min-w-0 px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 ${isTestCaseInUseByBatch(tc) ? 'opacity-70 cursor-not-allowed' : ''}`}
                        placeholder="set name"
                        title={isTestCaseInUseByBatch(tc) ? 'ล็อก — test case อยู่ใน process (running/pending)' : 'Use a unique name for this test case'}
                      />
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700">
                      <input
                        type="text"
                        value={(tc.extraColumns && (tc.extraColumns.tag || tc.extraColumns.Tag)) || ''}
                        onChange={(e) => handleExtraColumnChange(tc.id, 'tag', e.target.value)}
                        disabled={isTestCaseInUseByBatch(tc) || isViewingShared}
                        className={`w-full min-w-0 px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 ${isTestCaseInUseByBatch(tc) ? 'opacity-70 cursor-not-allowed' : ''}`}
                        placeholder="tag"
                        title={isTestCaseInUseByBatch(tc) ? 'ล็อก — test case อยู่ใน process' : 'Tag for grouping or filtering'}
                      />
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs text-center whitespace-nowrap">
                      {tc.createdAt ? new Date(tc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700">
                      <select
                        value={tc.binName || ''}
                        onChange={(e) =>
                          updateDisplayedTestCase(tc.id, { binName: e.target.value })
                        }
                        disabled={isTestCaseLocked(tc.id) || isTestCaseInUseByBatch(tc) || isViewingShared}
                        className="w-full min-w-0 px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                        title={
                          isTestCaseLocked(tc.id)
                            ? 'Files are locked because this test case is used in a set. Duplicate this test case to change files.'
                            : isTestCaseInUseByBatch(tc)
                              ? 'Files are locked because this test case is in a running or pending set. Duplicate this test case to change files.'
                            : 'Select ERoM file'
                        }
                      >
                        <option value="">— ERoM —</option>
                        {binFilesList.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                        {tc.binName &&
                          !binFilesList.some((f) => f.name === tc.binName) && (
                            <option value={tc.binName}>{tc.binName}</option>
                          )}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700">
                      <select
                        value={tc.linName || ''}
                        onChange={(e) =>
                          updateDisplayedTestCase(tc.id, {
                            linName: e.target.value || undefined,
                          })
                        }
                        disabled={isTestCaseLocked(tc.id) || isTestCaseInUseByBatch(tc) || isViewingShared}
                        className="w-full min-w-0 px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                        title={
                          isTestCaseLocked(tc.id)
                            ? 'Files are locked because this test case is used in a set. Duplicate this test case to change files.'
                            : isTestCaseInUseByBatch(tc)
                            ? 'Files are locked because this test case is in a running or pending set. Duplicate this test case to change files.'
                            : 'Select ULP file'
                        }
                      >
                        <option value="">— ULP —</option>
                        {linFilesList.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                        {tc.linName &&
                          !linFilesList.some((f) => f.name === tc.linName) && (
                            <option value={tc.linName}>{tc.linName}</option>
                          )}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700">
                      <select
                        value={tc.vcdName || ''}
                        onChange={(e) =>
                          updateDisplayedTestCase(tc.id, { vcdName: e.target.value })
                        }
                        disabled={isTestCaseLocked(tc.id) || isTestCaseInUseByBatch(tc) || isViewingShared}
                        className="w-full min-w-0 px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                        title={
                          isTestCaseLocked(tc.id)
                            ? 'Files are locked because this test case is used in a set. Duplicate this test case to change files.'
                            : isTestCaseInUseByBatch(tc)
                            ? 'Files are locked because this test case is in a running or pending set. Duplicate this test case to change files.'
                            : 'Select VCD file'
                        }
                      >
                        <option value="">— VCD —</option>
                        {vcdFilesList.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                        {tc.vcdName &&
                          !vcdFilesList.some((f) => f.name === tc.vcdName) && (
                            <option value={tc.vcdName}>{tc.vcdName}</option>
                          )}
                      </select>
                    </td>
                    {(() => {
                      const getExtraColKeys = (t) => {
                        const fromExtra = Object.keys(t.extraColumns || {});
                        const fromCmds = [];
                        (t.commands || []).filter((c) => c.type === 'vcd' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`VCD${i + 2}`));
                        (t.commands || []).filter((c) => c.type === 'erom' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ERoM${i + 2}`));
                        (t.commands || []).filter((c) => c.type === 'ulp' && (c.file || '').trim()).forEach((_, i) => fromCmds.push(`ULP${i + 2}`));
                        return [...fromExtra, ...fromCmds];
                      };
                      const getExtraVal = (t, c) => {
                        const m = c.match(/^VCD(\d+)$/);
                        if (m) {
                          const idx = parseInt(m[1], 10) - 2;
                          const vcds = (t.commands || []).filter((x) => x.type === 'vcd' && (x.file || '').trim());
                          return vcds[idx]?.file ?? t.extraColumns?.[c] ?? '';
                        }
                        const m2 = c.match(/^ERoM(\d+)$/);
                        if (m2) {
                          const idx = parseInt(m2[1], 10) - 2;
                          const eroms = (t.commands || []).filter((x) => x.type === 'erom' && (x.file || '').trim());
                          return eroms[idx]?.file ?? t.extraColumns?.[c] ?? '';
                        }
                        const m3 = c.match(/^ULP(\d+)$/);
                        if (m3) {
                          const idx = parseInt(m3[1], 10) - 2;
                          const ulps = (t.commands || []).filter((x) => x.type === 'ulp' && (x.file || '').trim());
                          return ulps[idx]?.file ?? t.extraColumns?.[c] ?? '';
                        }
                        return t.extraColumns?.[c] ?? '';
                      };
                      const allCols = [...new Set(displayedSavedTestCases.flatMap(getExtraColKeys))].sort();
                    const extraCols = allCols
                      .filter((col) => !/^tag$/i.test(col))
                      .filter((col) => displayedSavedTestCases.some((t) => (getExtraVal(t, col) ?? '').toString().trim() !== ''));
                      const isFileCol = (c) => /^(VCD|ERoM|ULP)\d+$/.test(c);
                      return extraCols.map((col) => (
                        <td key={col} className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700">
                          {isFileCol(col) ? (
                            <select
                              value={getExtraVal(tc, col)}
                              onChange={(e) => handleExtraColumnChange(tc.id, col, e.target.value)}
                              disabled={isTestCaseLocked(tc.id) || isTestCaseInUseByBatch(tc) || isViewingShared}
                              className="w-full min-w-0 px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                              title={
                                isTestCaseLocked(tc.id)
                                ? 'Files are locked because this test case is used in a set. Duplicate this test case to change files.'
                                : isTestCaseInUseByBatch(tc)
                                  ? 'Files are locked because this test case is in a running or pending set. Duplicate this test case to change files.'
                                  : `Select file for ${col}`
                              }
                            >
                              <option value="">— {col} —</option>
                              {(col.startsWith('VCD') ? vcdFilesList : col.startsWith('ERoM') ? binFilesList : linFilesList).map((f) => (
                                <option key={f.id} value={f.name}>{f.name}</option>
                              ))}
                              {getExtraVal(tc, col) && !(col.startsWith('VCD') ? vcdFilesList : col.startsWith('ERoM') ? binFilesList : linFilesList).some((f) => f.name === getExtraVal(tc, col)) && (
                                <option value={getExtraVal(tc, col)}>{getExtraVal(tc, col)}</option>
                              )}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={getExtraVal(tc, col)}
                              onChange={(e) => handleExtraColumnChange(tc.id, col, e.target.value)}
                              disabled={isTestCaseInUseByBatch(tc) || isViewingShared}
                              className={`w-full min-w-0 px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 ${isTestCaseInUseByBatch(tc) ? 'opacity-70 cursor-not-allowed' : ''}`}
                              placeholder="—"
                            />
                          )}
                        </td>
                      ));
                    })()}
                    <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={tc.tryCount ?? 1}
                        onChange={(e) =>
                          updateDisplayedTestCase(tc.id, {
                            tryCount: Math.max(
                              1,
                              Math.min(100, parseInt(e.target.value, 10) || 1),
                            ),
                          })
                        }
                        disabled={isTestCaseInUseByBatch(tc) || isViewingShared}
                        className={`w-full px-1 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-center ${isTestCaseInUseByBatch(tc) ? 'opacity-70 cursor-not-allowed' : ''}`}
                        title={isTestCaseInUseByBatch(tc) ? 'ล็อก — อยู่ใน process' : undefined}
                      />
                    </td>
                    <td className="px-2 py-1.5 flex items-center justify-center gap-0.5 relative">
                      <span
                        draggable
                        onDragStart={(e) => handleRowDragStart(e, idx)}
                        onDragEnd={handleRowDragEnd}
                        className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                        title="Drag to reorder"
                      >
                        <GripVertical size={14} />
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          duplicateDisplayedTestCase(tc.id, {
                            name: getNextTestCaseName(),
                          });
                          addToast({ type: 'success', message: 'Saved as new test case' });
                        }}
                        className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        title="Duplicate this test case"
                      >
                        <Copy size={14} />
                      </button>
                      {/* Add extra file/command (MDI / VCD / ERoM / ULP) — same behavior as Vertical tab */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCommandMenuTcId(commandMenuTcId === tc.id ? null : tc.id)}
                          className="p-1 rounded border border-slate-200 dark:border-slate-600 text-blue-600 hover:text-blue-800 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Add extra file (MDI / VCD / ERoM / ULP)"
                        >
                          <Plus size={14} />
                        </button>
                        {commandMenuTcId === tc.id && (
                          <>
                            <div className="absolute right-0 top-full mt-1 z-10 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg min-w-[180px]">
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'mdi', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add MDI (text file)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'vcd', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add VCD
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'erom', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add EROM
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'ulp', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add ULP
                              </button>
                            </div>
                            <div className="fixed inset-0 z-[5]" aria-hidden onClick={() => setCommandMenuTcId(null)} />
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => moveSavedTestCaseUp(tc.id)}
                        disabled={idx === 0}
                        className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSavedTestCaseDown(tc.id)}
                        disabled={idx === displayedSavedTestCases.length - 1 || isViewingShared}
                        className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isTestCaseInUseByBatch(tc)) {
                            addToast({ type: 'warning', message: 'This test case uses files in a running or pending set. Wait for the set to finish.' });
                            return;
                          }
                          removeDisplayedTestCase(tc.id);
                          addToast({ type: 'success', message: 'Removed' });
                        }}
                        disabled={isTestCaseInUseByBatch(tc)}
                        className="p-1 text-red-500 hover:text-red-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isTestCaseInUseByBatch(tc) ? 'In use by a running or pending set' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        ) : (
          /* Tab 2: Step layout — 2 columns so more test cases visible */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedSavedTestCases.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-slate-400 text-sm border border-slate-200 dark:border-slate-600 rounded-lg">
                No test cases — use Pair All or Add Test Case
              </div>
            ) : (
              displayedSavedTestCases.map((tc, idx) => (
                <div
                  key={tc.id}
                  onDragEnter={(e) => e.preventDefault()}
                  onDragOver={(e) => handleRowDragOver(e, idx)}
                  onDrop={(e) => handleRowDrop(e, idx)}
                  className={`border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 ${
                    draggingRowIndex === idx ? 'opacity-50' : ''
                  } ${
                    dropTargetRowIndex === idx
                      ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  } ${selectedTestCaseIds.includes(tc.id) ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}
                >
                  {/* Test case header: move handle + name + checkbox + actions */}
                  <div className="flex items-start gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                    <span
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, idx)}
                      onDragEnd={handleRowDragEnd}
                      className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 shrink-0 mt-0.5"
                      title="Drag to reorder"
                    >
                      <GripVertical size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-500">#{idx + 1}</span>
                        <input
                          type="text"
                          value={tc.name || ''}
                          onChange={(e) => handleNameChange(tc.id, e.target.value, tc.name || '')}
                          className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 font-medium"
                          placeholder="Test case name"
                          title="Use a unique name"
                        />
                        <span className="text-xs text-slate-400">
                          Date:{' '}
                          {tc.createdAt
                            ? new Date(tc.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </span>
                        <span className="text-xs text-slate-500">Try: {tc.tryCount ?? 1}</span>
                        {isTestCaseLocked(tc.id) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-[10px] font-semibold">
                            Locked in set
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedTestCaseIds.includes(tc.id)}
                        onChange={() => toggleTestCaseSelect(tc.id)}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          duplicateDisplayedTestCase(tc.id, { name: getNextTestCaseName() });
                          addToast({ type: 'success', message: 'Saved as new test case' });
                        }}
                        className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        title="Duplicate this test case"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isTestCaseInUseByBatch(tc)) {
                            addToast({ type: 'warning', message: 'This test case uses files in a running or pending set. Wait for the set to finish.' });
                            return;
                          }
                          removeDisplayedTestCase(tc.id);
                          addToast({ type: 'success', message: 'Removed' });
                        }}
                        disabled={isTestCaseInUseByBatch(tc)}
                        className="p-1 text-red-500 hover:text-red-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isTestCaseInUseByBatch(tc) ? 'In use by a running or pending set' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Files: single column layout — EROM, ULP, VCD, then extra */}
                  <div className="px-3 py-1.5">
                    <div className="grid grid-cols-1 gap-y-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-slate-500 w-12 shrink-0">EROM:</span>
                        <select
                          value={tc.binName || ''}
                          onChange={(e) => updateDisplayedTestCase(tc.id, { binName: e.target.value })}
                          disabled={isTestCaseLocked(tc.id) || isViewingShared}
                          className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                          title={
                            isTestCaseLocked(tc.id)
                              ? 'Files are locked because this test case is used in a set. Use “Save as new test case” to change files.'
                              : 'Select ERoM file'
                          }
                        >
                          <option value="">— ERoM —</option>
                          {binFilesList.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                          {tc.binName && !binFilesList.some((f) => f.name === tc.binName) && (
                            <option value={tc.binName}>{tc.binName}</option>
                          )}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-slate-500 w-12 shrink-0">ULP:</span>
                        <select
                          value={tc.linName || ''}
                          onChange={(e) => updateDisplayedTestCase(tc.id, { linName: e.target.value || undefined })}
                          disabled={isTestCaseLocked(tc.id) || isViewingShared}
                          className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                          title={
                            isTestCaseLocked(tc.id)
                              ? 'Files are locked because this test case is used in a set. Use “Save as new test case” to change files.'
                              : 'Select ULP file'
                          }
                        >
                          <option value="">— ULP —</option>
                          {linFilesList.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                          {tc.linName && !linFilesList.some((f) => f.name === tc.linName) && (
                            <option value={tc.linName}>{tc.linName}</option>
                          )}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-slate-500 w-12 shrink-0">VCD:</span>
                        <select
                          value={tc.vcdName || ''}
                          onChange={(e) => updateDisplayedTestCase(tc.id, { vcdName: e.target.value })}
                          disabled={isTestCaseLocked(tc.id) || isViewingShared}
                          className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                          title={
                            isTestCaseLocked(tc.id)
                              ? 'Files are locked because this test case is used in a set. Use “Save as new test case” to change files.'
                              : 'Select VCD file'
                          }
                        >
                          <option value="">— VCD —</option>
                          {vcdFilesList.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                          {tc.vcdName && !vcdFilesList.some((f) => f.name === tc.vcdName) && (
                            <option value={tc.vcdName}>{tc.vcdName}</option>
                          )}
                        </select>
                      </div>
                      {tc.extraColumns && Object.keys(tc.extraColumns).length > 0 ? (
                        Object.entries(tc.extraColumns)
                          .filter(([col]) => {
                            const m = col.match(/^(VCD|ERoM|ULP)(\d+)$/);
                            if (!m) return true;
                            const type = m[1] === 'VCD' ? 'vcd' : m[1] === 'ERoM' ? 'erom' : 'ulp';
                            const idx = parseInt(m[2], 10) - 2;
                            const cmds = (tc.commands || []).filter((c) => c.type === type && (c.file || '').trim());
                            return idx >= cmds.length;
                          })
                          .map(([col, val]) => {
                          const isFileCol = /^(VCD|ERoM|ULP)\d+$/.test(col);
                          const fileList = col.startsWith('VCD') ? vcdFilesList : col.startsWith('ERoM') ? binFilesList : linFilesList;
                          const displayVal = (() => {
                            const m = col.match(/^VCD(\d+)$/);
                            if (m) {
                              const idx = parseInt(m[1], 10) - 2;
                              const vcds = (tc.commands || []).filter((c) => c.type === 'vcd' && (c.file || '').trim());
                              return vcds[idx]?.file ?? val ?? '';
                            }
                            const m2 = col.match(/^ERoM(\d+)$/);
                            if (m2) {
                              const idx = parseInt(m2[1], 10) - 2;
                              const eroms = (tc.commands || []).filter((c) => c.type === 'erom' && (c.file || '').trim());
                              return eroms[idx]?.file ?? val ?? '';
                            }
                            const m3 = col.match(/^ULP(\d+)$/);
                            if (m3) {
                              const idx = parseInt(m3[1], 10) - 2;
                              const ulps = (tc.commands || []).filter((c) => c.type === 'ulp' && (c.file || '').trim());
                              return ulps[idx]?.file ?? val ?? '';
                            }
                            return val ?? '';
                          })();
                          return (
                            <div key={col} className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-semibold text-slate-500 shrink-0">{col}:</span>
                              {isFileCol ? (
                                <select
                                  value={displayVal}
                                  onChange={(e) => handleExtraColumnChange(tc.id, col, e.target.value)}
                                  disabled={isTestCaseLocked(tc.id) || isViewingShared}
                                  className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                  title={
                                    isTestCaseLocked(tc.id)
                                      ? 'Files are locked because this test case is used in a set. Use “Save as new test case” to change files.'
                                      : `Select file for ${col}`
                                  }
                                >
                                  <option value="">— {col} —</option>
                                  {fileList.map((f) => (
                                    <option key={f.id} value={f.name}>{f.name}</option>
                                  ))}
                                  {displayVal && !fileList.some((f) => f.name === displayVal) && (
                                    <option value={displayVal}>{displayVal}</option>
                                  )}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={displayVal}
                                  onChange={(e) => handleExtraColumnChange(tc.id, col, e.target.value)}
                                  className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                  placeholder="—"
                                />
                              )}
                            </div>
                          );
                        })
                      ) : null}
                    </div>
                  </div>
                  {/* Command section: compact — only + button when empty; list when commands exist */}
                  <div className="px-3 py-1 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center justify-end">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCommandMenuTcId(commandMenuTcId === tc.id ? null : tc.id)}
                          className="p-1 rounded border border-slate-200 dark:border-slate-600 text-blue-600 hover:text-blue-800 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Add command"
                        >
                          <Plus size={14} />
                        </button>
                        {commandMenuTcId === tc.id && (
                          <>
                            <div className="absolute right-0 top-full mt-1 z-10 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg min-w-[180px]">
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'mdi', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add MDI (text file)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'vcd', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add VCD
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'erom', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add EROM
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  addDisplayedTestCaseCommand(tc.id, { type: 'ulp', file: '' });
                                  setCommandMenuTcId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Add ULP
                              </button>
                            </div>
                            <div className="fixed inset-0 z-[5]" aria-hidden onClick={() => setCommandMenuTcId(null)} />
                          </>
                        )}
                      </div>
                    </div>
                    {(tc.commands && tc.commands.length > 0) ? (
                      <div className="space-y-1 mt-1">
                        {(tc.commands || []).map((cmd) => {
                          const label = cmd.type === 'mdi' ? 'MDI:' : cmd.type === 'vcd' ? 'VCD:' : cmd.type === 'erom' ? 'EROM:' : 'ULP:';
                          const fileList = cmd.type === 'mdi' ? mdiFilesList : cmd.type === 'vcd' ? vcdFilesList : cmd.type === 'erom' ? binFilesList : linFilesList;
                          const placeholder = cmd.type === 'mdi' ? '— Text file —' : cmd.type === 'vcd' ? '— VCD —' : cmd.type === 'erom' ? '— EROM —' : '— ULP —';
                          return (
                            <div key={cmd.id} className="flex items-center gap-2 min-h-[28px]">
                              <span className="text-xs font-medium text-slate-500 w-12 shrink-0">{label}</span>
                              <select
                                value={cmd.file || ''}
                                onChange={(e) => updateDisplayedTestCaseCommand(tc.id, cmd.id, { file: e.target.value })}
                                className="flex-1 min-w-0 px-2 py-0.5 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                              >
                                <option value="">{placeholder}</option>
                                {fileList.map((f) => (
                                  <option key={f.id} value={f.name}>{f.name}</option>
                                ))}
                                {cmd.file && !fileList.some((f) => f.name === cmd.file) && (
                                  <option value={cmd.file}>{cmd.file}</option>
                                )}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeDisplayedTestCaseCommand(tc.id, cmd.id)}
                                className="p-0.5 text-red-500 hover:text-red-700 rounded shrink-0 flex items-center justify-center"
                                title="Remove"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Saved Test Case Sets (collections) */}
        {displayedSavedTestCaseSets && displayedSavedTestCaseSets.length > 0 && (
          <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Saved 
              </h3>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {displayedSavedTestCaseSets.length} set(s)
              </span>
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {displayedSavedTestCaseSets.map((set, index) => (
                <div
                  key={set.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex flex-col gap-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveSavedTestCaseSetUp(set.id)}
                      disabled={index === 0 || isViewingShared}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp size={12} className="text-slate-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSavedTestCaseSetDown(set.id)}
                      disabled={index === displayedSavedTestCaseSets.length - 1 || isViewingShared}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown size={12} className="text-slate-500" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 w-4 shrink-0">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {set.name}
                      </span>
                      {isSetInUseByJobs(set) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-[9px] font-semibold">
                          In run
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {Array.isArray(set.items) ? `${set.items.length} cases` : ''}
                      </span>
                    </div>
                    {set.createdAt && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(set.createdAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.restoreSetFilesToLibrary(set.id);
                        } catch (_) {
                          // Set อาจยังไม่มีไฟล์เก็บใน backend (บันทึกก่อน backend) — ไม่เป็นไร
                        }
                        await refreshFiles();
                        setSetupClearedPersisted(activeProfileId, false);
                        setTableClearedMode(false);
                        setPendingDraftTestCases([]);
                        loadSetForEditing(set.id);
                        setSelectedTestCaseIds([]);
                        const fileNames = set.fileLibrarySnapshot?.length
                          ? set.fileLibrarySnapshot.map((s) => s.name)
                          : (() => {
                              const n = new Set();
                              (set.items || []).forEach((t) => {
                                if (t.vcdName) n.add(t.vcdName);
                                if (t.binName) n.add(t.binName);
                                if (t.linName) n.add(t.linName);
                                const ec = t.extraColumns || {};
                                Object.values(ec).forEach((v) => {
                                  if ((v ?? '').toString().trim()) n.add(String(v).trim());
                                });
                              });
                              return [...n];
                            })();
                        if (fileNames.length) {
                          const files = useTestStore.getState().uploadedFiles || [];
                          const ids = files.filter((f) => fileNames.includes(f.name)).map((f) => f.id);
                          setSelectedIds(ids);
                        }
                        addToast({
                          type: 'success',
                          message: `Loaded set "${set.name}" — files restored to Library, table and selection updated`,
                        });
                      }}
                      disabled={isViewingShared}
                      className={`px-2 py-1 rounded font-semibold ${
                        isViewingShared ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSetupClearedPersisted(activeProfileId, false);
                        setTableClearedMode(false);
                        appendSavedTestCaseSet(set.id);
                        setSelectedTestCaseIds([]);
                        addToast({ type: 'success', message: `Appended set "${set.name}" to table` });
                      }}
                      disabled={isViewingShared}
                      className={`px-2 py-1 rounded font-semibold ${
                        isViewingShared ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-600 hover:bg-slate-700 text-white'
                      }`}
                      title="Append this set to table (without replacing)"
                    >
                      +Append
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        duplicateSavedTestCaseSet(set.id);
                        addToast({ type: 'success', message: `Duplicated set "${set.name}"` });
                      }}
                      disabled={isViewingShared}
                      className={`p-1 rounded ${
                        isViewingShared ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}
                      title="Clone set"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete set "${set.name}"? This will remove it from Saved sets only (test cases and files in Library will stay).`)) return;
                        try {
                          await api.deleteSet(set.id);
                        } catch (e) {
                          if (!String(e?.message || '').includes('404')) {
                            addToast({ type: 'warning', message: `Backend: ${e?.message || 'Delete failed'}` });
                          }
                        }
                        removeSavedTestCaseSet(set.id);
                        addToast({ type: 'success', message: `Deleted set "${set.name}"` });
                      }}
                      disabled={isViewingShared}
                      className={`p-1 rounded ${
                        isViewingShared ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600/10 text-red-600'
                      }`}
                      title="Delete set from Saved (ไม่ลบ test cases หรือไฟล์ใน Library)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCasesPage;
