import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Copy, Clipboard, ArrowUpDown, ArrowDown, ArrowUp, Download, Plus, Trash2, Check } from 'lucide-react';

interface CellPosition {
  row: number;
  col: number;
}

interface Selection {
  start: CellPosition;
  end: CellPosition;
}

const DataPreview: React.FC = () => {
  const { rawData, setRawData, setActiveSheetIndex, addSheet, copySheet, removeSheet, moveSheet, renameSheet, selectedColumns, setSelectedColumns, selectedChartType, sampleSize, xAxisColumn, setXAxisColumn } = useAppContext();
  const [activeSheet, setActiveSheet] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false); // mouse drag selecting
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [viewData, setViewData] = useState<any[]>([]); // local working copy
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [sortState, setSortState] = useState<{ col: number; dir: 'asc' | 'desc' | null } | null>(null);
  const [formulaValue, setFormulaValue] = useState<string>('');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [headerDrag, setHeaderDrag] = useState<{ kind: 'row' | 'column' | null; start: number | null }>({ kind: null, start: null });
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; target: 'row' | 'column' | 'cell' | null; row?: number; col?: number }>({ visible: false, x: 0, y: 0, target: null });
  const [clipboard, setClipboard] = useState<
    | { kind: 'row'; rows: Record<string, any>[]; cut: boolean }
    | { kind: 'column'; columns: { header: string; values: any[] }[]; cut: boolean }
    | { kind: 'cell'; value: any; cut: boolean }
    | null
  >(null);
  const resizeStartX = useRef<number>(0);
  const originalWidth = useRef<number>(0);
  const tableRef = useRef<HTMLDivElement>(null);

  // Sync local state when rawData changes (discarding unsaved local edits)
  useEffect(() => {
    if (rawData) {
      const activeIdx = rawData.activeSheetIndex ?? 0;
      setActiveSheet(activeIdx);
      setViewData(rawData.data.map(r => ({ ...r })));
      setHeaders([...rawData.headers]);
      setColumnWidths(rawData.headers.map(() => 120));
      setSortState(null);
      setSelection(null);
      setEditingCell(null);
      setEditingHeader(null);
      setUnsavedChanges(false);
    }
  }, [rawData]);

  if (!rawData || !rawData.data.length) {
    return <p className="text-gray-500">No data available. Please upload a file.</p>;
  }

  const columnLetters = Array.from({ length: headers.length }, (_, i) => String.fromCharCode(65 + i));

  const getSelectionRange = () => {
    if (!selection) return '';
    const startCol = String.fromCharCode(65 + selection.start.col);
    const endCol = String.fromCharCode(65 + selection.end.col);
    return `${startCol}${selection.start.row + 1}:${endCol}${selection.end.row + 1}`;
  };

  const beginSelection = (row: number, col: number) => {
    setSelection({ start: { row, col }, end: { row, col } });
    setIsSelecting(true);
  };

  const extendSelection = (row: number, col: number) => {
    if (isSelecting && selection) {
      setSelection(prev => (prev ? { ...prev, end: { row, col } } : null));
    }
  };

  const endSelection = () => setIsSelecting(false);

  // Close context menu on global click/escape
  useEffect(() => {
    const onClick = () => setContextMenu((m) => ({ ...m, visible: false }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu((m) => ({ ...m, visible: false }));
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const openContextMenu = (e: React.MouseEvent, target: 'row' | 'column' | 'cell', row?: number, col?: number) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, target, row, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selection) return;

    const { key, shiftKey } = e;
    const currentPos = shiftKey ? selection.end : selection.start;
    let newRow = currentPos.row;
    let newCol = currentPos.col;

    switch (key) {
      case 'ArrowUp':
        newRow = Math.max(0, newRow - 1);
        break;
      case 'ArrowDown':
        newRow = Math.min(viewData.length - 1, newRow + 1);
        break;
      case 'ArrowLeft':
        newCol = Math.max(0, newCol - 1);
        break;
      case 'ArrowRight':
        newCol = Math.min(headers.length - 1, newCol + 1);
        break;
      case 'Delete':
      case 'Backspace':
        clearSelectionValues();
        return;
      case 'Enter':
        setEditingCell({ row: currentPos.row, col: currentPos.col });
        return;
    }

    if (shiftKey) {
      setSelection({ ...selection, end: { row: newRow, col: newCol } });
    } else {
      setSelection({ start: { row: newRow, col: newCol }, end: { row: newRow, col: newCol } });
    }
  };

  const handleCopy = () => {
    if (!selection) return;

    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const startCol = Math.min(selection.start.col, selection.end.col);
    const endCol = Math.max(selection.start.col, selection.end.col);

    const copyText = [];
    for (let i = startRow; i <= endRow; i++) {
      const rowVals: string[] = [];
      for (let j = startCol; j <= endCol; j++) {
        const header = headers[j];
        const value = viewData[i][header] ?? '';
        rowVals.push(String(value));
      }
      copyText.push(rowVals.join('\t'));
    }

    navigator.clipboard.writeText(copyText.join('\n'));
  };

  const handlePaste = async () => {
    if (!selection) return;
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split('\n');
      const newData = [...viewData];
      rows.forEach((rowText, rowOffset) => {
        const cells = rowText.split('\t');
        cells.forEach((cell, colOffset) => {
          const targetRow = selection.start.row + rowOffset;
          const targetCol = selection.start.col + colOffset;
          if (targetRow < newData.length && targetCol < headers.length) {
            const header = headers[targetCol];
            newData[targetRow] = { ...newData[targetRow], [header]: cell };
          }
        });
      });
      setViewData(newData);
      setUnsavedChanges(true);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  const handleDoubleClick = (row: number, col: number) => setEditingCell({ row, col });

  const handleCellEdit = (row: number, col: number, value: string) => {
    const header = headers[col];
    const newData = [...viewData];
    newData[row] = { ...newData[row], [header]: value };
    setViewData(newData);
    setEditingCell(null);
    setFormulaValue(value);
    setUnsavedChanges(true);
  };

  const clearSelectionValues = () => {
    if (!selection) return;
    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const startCol = Math.min(selection.start.col, selection.end.col);
    const endCol = Math.max(selection.start.col, selection.end.col);
    const newData = [...viewData];
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const header = headers[c];
        newData[r] = { ...newData[r], [header]: '' };
      }
    }
    setViewData(newData);
    setUnsavedChanges(true);
  };

  const sortByColumn = (colIndex: number) => {
    const header = headers[colIndex];
    let dir: 'asc' | 'desc' | null = 'asc';
    if (sortState && sortState.col === colIndex) {
      dir = sortState.dir === 'asc' ? 'desc' : sortState.dir === 'desc' ? null : 'asc';
    }
    if (dir === null) {
      // Reset to original raw order
      setViewData(rawData.data.map(r => ({ ...r })));
      setSortState(null);
      return;
    }
    const newData = [...viewData].sort((a, b) => {
      const av = a[header];
      const bv = b[header];
      const na = parseFloat(av);
      const nb = parseFloat(bv);
      const isNum = !isNaN(na) && !isNaN(nb);
      if (isNum) {
        return dir === 'asc' ? na - nb : nb - na;
      }
      return dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    setViewData(newData);
    setSortState({ col: colIndex, dir });
  };

  const handleFormulaChange = (val: string) => {
    setFormulaValue(val);
    if (selection) {
      const { row, col } = selection.start; // single cell focus
      const header = headers[col];
      const newData = [...viewData];
      newData[row] = { ...newData[row], [header]: val };
      setViewData(newData);
      setUnsavedChanges(true);
    }
  };

  const commitChanges = () => {
    if (!rawData) return;
    if (rawData.sheets && rawData.activeSheetIndex !== undefined) {
      const sheets = rawData.sheets.map((s, i) => i === rawData.activeSheetIndex ? { ...s, data: viewData, headers } : s);
      const updated = { ...rawData, sheets, data: viewData, headers };
      setRawData(updated);
    } else {
      const updated = { ...rawData, data: viewData, headers };
      setRawData(updated);
    }
    setUnsavedChanges(false);
  };

  const insertRowBelow = () => {
    if (!headers.length) return;
    const emptyRow: Record<string, any> = {};
    headers.forEach(h => (emptyRow[h] = ''));
    let insertIndex = viewData.length;
    if (selection) {
      insertIndex = Math.max(selection.start.row, selection.end.row) + 1;
    }
    const newData = [...viewData];
    newData.splice(insertIndex, 0, emptyRow);
    setViewData(newData);
    setUnsavedChanges(true);
  };

  // Context operations helpers
  const insertRowAt = (index: number) => {
    if (!headers.length) return;
    const emptyRow: Record<string, any> = {};
    headers.forEach((h) => (emptyRow[h] = ''));
    const newData = [...viewData];
    newData.splice(index, 0, emptyRow);
    setViewData(newData);
    setUnsavedChanges(true);
  };

  const deleteRowAt = (index: number) => {
    const newData = viewData.filter((_, i) => i !== index);
    setViewData(newData);
    setUnsavedChanges(true);
  };

  const copyRowAt = (index: number, cut = false) => {
    const minMax = (() => {
      const min = Math.min(selection?.start.row ?? index, selection?.end.row ?? index);
      const max = Math.max(selection?.start.row ?? index, selection?.end.row ?? index);
      const isFullRow = selection && selection.start.col === 0 && selection.end.col === headers.length - 1;
      return isFullRow ? { start: min, end: max } : { start: index, end: index };
    })();
    const rows = viewData.slice(minMax.start, minMax.end + 1).map((r) => ({ ...r }));
    setClipboard({ kind: 'row', rows, cut });
    if (cut) {
      const newData = [...viewData];
      for (let i = minMax.end; i >= minMax.start; i--) newData.splice(i, 1);
      setViewData(newData);
      setUnsavedChanges(true);
    }
  };

  const pasteRowAfter = (index: number) => {
    if (!clipboard || clipboard.kind !== 'row') return;
    const newData = [...viewData];
    const rowsToInsert = clipboard.rows.map((r) => ({ ...r }));
    newData.splice(index + 1, 0, ...rowsToInsert);
    setViewData(newData);
    setUnsavedChanges(true);
    if (clipboard.cut) setClipboard(null);
  };

  const uniqueHeaderName = (base: string) => {
    let name = base;
    const existing = new Set(headers);
    if (!existing.has(name)) return name;
    let i = 2;
    while (existing.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  };

  const insertColumnRight = (colIndex: number) => {
    const newHeader = uniqueHeaderName('New Column');
    const newHeaders = [...headers];
    newHeaders.splice(colIndex + 1, 0, newHeader);
    const newData = viewData.map((row) => ({ ...row, [newHeader]: '' }));
    const newWidths = [...columnWidths];
    newWidths.splice(colIndex + 1, 0, 120);
    setHeaders(newHeaders);
    setViewData(newData);
    setColumnWidths(newWidths);
    setUnsavedChanges(true);
  };

  const insertColumnsRightMultiple = (colIndex: number, count: number) => {
    if (count <= 1) return insertColumnRight(colIndex);
    const newHeaders = [...headers];
    const newWidths = [...columnWidths];
    const added: string[] = [];
    for (let i = 0; i < count; i++) {
      const h = uniqueHeaderName('New Column');
      added.push(h);
      newHeaders.splice(colIndex + 1 + i, 0, h);
      newWidths.splice(colIndex + 1 + i, 0, 120);
    }
    const newData = viewData.map((row) => {
      const r: Record<string, any> = { ...row };
      added.forEach((h) => (r[h] = ''));
      return r;
    });
    setHeaders(newHeaders);
    setViewData(newData);
    setColumnWidths(newWidths);
    setUnsavedChanges(true);
  };

  const deleteColumnAt = (colIndex: number) => {
    const header = headers[colIndex];
    const newHeaders = headers.filter((_, i) => i !== colIndex);
    const newData = viewData.map((row) => {
      const { [header]: _removed, ...rest } = row;
      return rest;
    });
    const newWidths = columnWidths.filter((_, i) => i !== colIndex);
    setHeaders(newHeaders);
    setViewData(newData);
    setColumnWidths(newWidths);
    // Update selected X/Y if needed
    if (selectedColumns?.length) {
      const updated = selectedColumns.filter((h): h is string => typeof h === 'string' && h !== header);
      setSelectedColumns(updated);
    }
    setUnsavedChanges(true);
  };

  const deleteColumnsRange = (start: number, end: number) => {
    let s = start;
    let e = end;
    if (s > e) [s, e] = [e, s];
    const toDelete = new Set(headers.slice(s, e + 1));
    const keepMask = headers.map((_, i) => i < s || i > e);
    const newHeaders = headers.filter((_, i) => keepMask[i]);
    const newData = viewData.map((row) => {
      const r: Record<string, any> = {};
      headers.forEach((h, i) => {
        if (keepMask[i]) r[h] = row[h];
      });
      return r;
    });
    const newWidths = columnWidths.filter((_, i) => keepMask[i]);
    setHeaders(newHeaders);
    setViewData(newData);
    setColumnWidths(newWidths);
    if (selectedColumns?.length) {
      const updated = selectedColumns.filter((h): h is string => typeof h === 'string' && !toDelete.has(h));
      setSelectedColumns(updated);
    }
    setUnsavedChanges(true);
  };

  const copyColumnAt = (colIndex: number, cut = false) => {
    const min = Math.min(selection?.start.col ?? colIndex, selection?.end.col ?? colIndex);
    const max = Math.max(selection?.start.col ?? colIndex, selection?.end.col ?? colIndex);
    const isFullCol = selection && selection.start.row === 0 && selection.end.row === viewData.length - 1;
    const start = isFullCol ? min : colIndex;
    const end = isFullCol ? max : colIndex;
    const columns = [] as { header: string; values: any[] }[];
    for (let c = start; c <= end; c++) {
      const header = headers[c];
      const values = viewData.map((row) => row[header] ?? '');
      columns.push({ header, values });
    }
    setClipboard({ kind: 'column', columns, cut });
    if (cut) deleteColumnsRange(start, end);
  };

  const pasteColumnAt = (colIndex: number) => {
    if (!clipboard || clipboard.kind !== 'column') return;
    const newHeaders = [...headers];
    const newWidths = [...columnWidths];
    const addedNames: string[] = [];
    clipboard.columns.forEach((col, idx) => {
      const name = clipboard.cut ? col.header : uniqueHeaderName(col.header);
      newHeaders.splice(colIndex + 1 + idx, 0, name);
      newWidths.splice(colIndex + 1 + idx, 0, 120);
      addedNames.push(name);
    });
    const newData = viewData.map((row, rowIndex) => {
      const r: Record<string, any> = { ...row };
      clipboard.columns.forEach((col, idx) => {
        const target = addedNames[idx];
        r[target] = col.values[rowIndex] ?? '';
      });
      return r;
    });
    setHeaders(newHeaders);
    setViewData(newData);
    setColumnWidths(newWidths);
    setUnsavedChanges(true);
    if (clipboard.cut) setClipboard(null);
  };

  const copyCellAt = (row: number, col: number, cut = false) => {
    const header = headers[col];
    const value = viewData[row]?.[header] ?? '';
    setClipboard({ kind: 'cell', value, cut });
    if (cut) {
      const newData = [...viewData];
      newData[row] = { ...newData[row], [header]: '' };
      setViewData(newData);
      setUnsavedChanges(true);
    }
  };

  const pasteCellAt = (row: number, col: number) => {
    if (!clipboard || clipboard.kind !== 'cell') return;
    const header = headers[col];
    const newData = [...viewData];
    newData[row] = { ...newData[row], [header]: clipboard.value };
    setViewData(newData);
    setUnsavedChanges(true);
    if (clipboard.cut) setClipboard(null);
  };

  const deleteSelectedRows = () => {
    if (!selection) return;
    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const newData = viewData.filter((_, idx) => idx < startRow || idx > endRow);
    setViewData(newData);
    setSelection(null);
    setUnsavedChanges(true);
  };

  const exportSelection = () => {
    if (!selection) return;
    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const startCol = Math.min(selection.start.col, selection.end.col);
    const endCol = Math.max(selection.start.col, selection.end.col);
    const rows: string[] = [];
    // Header row first
    const headerSlice = headers.slice(startCol, endCol + 1).join(',');
    rows.push(headerSlice);
    for (let r = startRow; r <= endRow; r++) {
      const vals: string[] = [];
      for (let c = startCol; c <= endCol; c++) {
        const v = viewData[r][headers[c]] ?? '';
        const safe = String(v).includes(',') ? `"${String(v).replace(/"/g, '""')}"` : String(v);
        vals.push(safe);
      }
      rows.push(vals.join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selection.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectColumn = (col: number) => {
    setSelection({ start: { row: 0, col }, end: { row: viewData.length - 1, col } });
  };

  const selectRow = (row: number) => {
    setSelection({ start: { row, col: 0 }, end: { row, col: headers.length - 1 } });
  };

  const startHeaderEdit = (idx: number) => setEditingHeader(idx);
  const commitHeaderEdit = (idx: number, newName: string) => {
    if (!newName || newName === headers[idx]) {
      setEditingHeader(null);
      return;
    }
    // Ensure uniqueness
    if (headers.includes(newName)) {
      alert('Header name must be unique.');
      return;
    }
    const oldName = headers[idx];
    const newHeaders = [...headers];
    newHeaders[idx] = newName;
    const newData = viewData.map(row => {
      const value = row[oldName];
      const { [oldName]: _, ...rest } = row;
      return { ...rest, [newName]: value };
    });
    setHeaders(newHeaders);
    setViewData(newData);
    setEditingHeader(null);
    setUnsavedChanges(true);
  };

  // Column resizing handlers
  const onResizeMouseDown = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colIndex);
    resizeStartX.current = e.clientX;
    originalWidth.current = columnWidths[colIndex];
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (resizingCol !== null) {
      const delta = e.clientX - resizeStartX.current;
      setColumnWidths(w => w.map((width, idx) => (idx === resizingCol ? Math.max(60, originalWidth.current + delta) : width)));
    }
  }, [resizingCol]);

  const handleGlobalMouseUp = useCallback(() => {
    if (resizingCol !== null) setResizingCol(null);
    // Always stop header dragging and cell selecting on mouse up
    setHeaderDrag({ kind: null, start: null });
    setIsSelecting(false);
  }, [resizingCol]);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  // Update formula bar when selection changes
  useEffect(() => {
    if (selection) {
      const { row, col } = selection.start; // top-left
      const header = headers[col];
      const value = viewData[row]?.[header] ?? '';
      setFormulaValue(String(value));
    }
  }, [selection, viewData, headers]);

  const isCellSelected = (row: number, col: number) => {
    if (!selection) return false;
    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  // Header drag selection handlers
  const beginColumnRangeSelection = (colIndex: number) => {
    setHeaderDrag({ kind: 'column', start: colIndex });
    setSelection({ start: { row: 0, col: colIndex }, end: { row: viewData.length - 1, col: colIndex } });
  };

  const extendColumnRangeSelection = (colIndex: number) => {
    if (headerDrag.kind !== 'column' || headerDrag.start === null) return;
    const startCol = headerDrag.start;
    setSelection({ start: { row: 0, col: startCol }, end: { row: viewData.length - 1, col: colIndex } });
  };

  const beginRowRangeSelection = (rowIndex: number) => {
    setHeaderDrag({ kind: 'row', start: rowIndex });
    setSelection({ start: { row: rowIndex, col: 0 }, end: { row: rowIndex, col: headers.length - 1 } });
  };

  const extendRowRangeSelection = (rowIndex: number) => {
    if (headerDrag.kind !== 'row' || headerDrag.start === null) return;
    const startRow = headerDrag.start;
    setSelection({ start: { row: startRow, col: 0 }, end: { row: rowIndex, col: headers.length - 1 } });
  };

  return (
    <div 
      className="relative overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={tableRef}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-gray-50 rounded-md border border-gray-200">
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="p-1 hover:bg-gray-200 rounded" title="Copy (Ctrl+C)">
            <Copy size={16} />
          </button>
          <button onClick={handlePaste} className="p-1 hover:bg-gray-200 rounded" title="Paste (Ctrl+V)">
            <Clipboard size={16} />
          </button>
          <button onClick={exportSelection} disabled={!selection} className="p-1 hover:bg-gray-200 rounded disabled:opacity-40" title="Export Selection to CSV">
            <Download size={16} />
          </button>
          <div className="ml-3 text-xs text-gray-600 min-w-[120px]">{selection && `Selected: ${getSelectionRange()}`}</div>
        </div>
        <div className="flex items-center gap-3 ml-auto text-xs">
          {selectedColumns?.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">Y: {Array.isArray(selectedColumns) ? (selectedColumns.join(', ')) : selectedColumns}</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">X: {xAxisColumn || 'Index'}</span>
            </div>
          )}
          {(selectedChartType === 'xBarS' || selectedChartType === 'xBarR') && (
            <div className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              X-bar mode: select {sampleSize} Y columns ({(selectedColumns || []).length}/{sampleSize})
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
          {unsavedChanges && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <button onClick={commitChanges} disabled={!unsavedChanges} className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-40 flex items-center gap-1" title="Apply changes to dataset">
            <Check size={14} /> Apply
          </button>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="flex items-center mb-2 text-sm">
        <div className="px-2 py-1 bg-gray-100 border border-gray-300 rounded-l min-w-[70px] text-gray-600">
          {selection ? `${String.fromCharCode(65 + selection.start.col)}${selection.start.row + 1}` : '—'}
        </div>
        <input
          value={formulaValue}
          onChange={(e) => handleFormulaChange(e.target.value)}
          className="flex-1 border border-l-0 border-gray-300 rounded-r px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Cell value"
        />
      </div>

      {/* Grid */}
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full border-collapse">
          {/* Column Headers */}
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="w-10 border border-gray-200 bg-gray-100" />
              {columnLetters.map((letter, colIndex) => (
                <th
                  key={letter}
                  style={{ width: columnWidths[colIndex] }}
                  className="relative border border-gray-200 bg-gray-100 px-1 py-0.5 text-xs font-semibold text-gray-600 select-none cursor-pointer group"
                  onClick={() => selectColumn(colIndex)}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return; // left click only
                    beginColumnRangeSelection(colIndex);
                  }}
                  onMouseEnter={() => extendColumnRangeSelection(colIndex)}
                  onContextMenu={(e) => openContextMenu(e, 'column', undefined, colIndex)}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{letter}</span>
                  </div>
                  <span
                    onMouseDown={(e) => onResizeMouseDown(e, colIndex)}
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-blue-400"
                  />
                </th>
              ))}
            </tr>
            <tr>
              <th className="w-10 border border-gray-200 bg-gray-100 text-center text-xs font-medium text-gray-600">#</th>
              {headers.map((header, colIndex) => {
                const sorting = sortState && sortState.col === colIndex ? sortState.dir : null;
                const isY = selectedColumns && selectedColumns.includes(header);
                const isX = xAxisColumn === header;
                return (
                  <th
                    key={header + colIndex}
                    style={{ width: columnWidths[colIndex] }}
                  className={`relative border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 align-middle cursor-pointer hover:bg-blue-50 ${selection && selection.start.col === colIndex && selection.end.col === colIndex ? 'bg-blue-100' : isY ? 'bg-emerald-50' : isX ? 'bg-amber-50' : 'bg-white'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    sortByColumn(colIndex);
                  }}
                  onDoubleClick={() => startHeaderEdit(colIndex)}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    beginColumnRangeSelection(colIndex);
                  }}
                  onMouseEnter={() => extendColumnRangeSelection(colIndex)}
                  onContextMenu={(e) => openContextMenu(e, 'column', undefined, colIndex)}
                >
                    {editingHeader === colIndex ? (
                      <input
                        className="w-full text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none"
                        autoFocus
                        defaultValue={header}
                        onBlur={(e) => commitHeaderEdit(colIndex, e.target.value.trim())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitHeaderEdit(colIndex, (e.target as HTMLInputElement).value.trim());
                          if (e.key === 'Escape') setEditingHeader(null);
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-1 justify-between">
                        <span className="truncate" title={header}>{header}</span>
                        <span className="text-gray-400">
                          {sorting === 'asc' && <ArrowUp size={12} />}
                          {sorting === 'desc' && <ArrowDown size={12} />}
                          {!sorting && <ArrowUpDown size={12} />}
                        </span>
                      </div>
                    )}
                    {/* X/Y selectors */}
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <button
                        className={`px-1 py-0.5 rounded text-[10px] border ${isY ? 'bg-emerald-200 border-emerald-400 text-emerald-900' : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'}`}
                        title={selectedChartType === 'xBarS' || selectedChartType === 'xBarR' ? `Toggle Y column (need ${sampleSize})` : 'Use as Y (values)'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedChartType === 'xBarS' || selectedChartType === 'xBarR') {
                            const exists = selectedColumns?.includes(header);
                            if (exists) {
                              setSelectedColumns(selectedColumns.filter(h => h !== header));
                            } else {
                              const currentCount = (selectedColumns || []).length;
                              if (currentCount >= sampleSize) {
                                alert(`You can select up to ${sampleSize} columns for the current sample size.`);
                              } else {
                                setSelectedColumns([...(selectedColumns || []), header]);
                              }
                            }
                          } else {
                            setSelectedColumns([header]);
                          }
                        }}
                      >
                        Y
                      </button>
                      <button
                        className={`px-1 py-0.5 rounded text-[10px] border ${isX ? 'bg-amber-200 border-amber-400 text-amber-900' : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'} ${selectedChartType === 'xBarS' || selectedChartType === 'xBarR' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={selectedChartType === 'xBarS' || selectedChartType === 'xBarR' ? 'X-axis selection disabled for X-bar charts' : 'Use as X (axis)'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedChartType === 'xBarS' || selectedChartType === 'xBarR') return;
                          setXAxisColumn(header);
                        }}
                      >
                        X
                      </button>
                    </div>
                    <span
                      onMouseDown={(e) => onResizeMouseDown(e, colIndex)}
                      className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-blue-400"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {viewData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                <td
                  className={`border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 text-center cursor-pointer select-none ${selection && rowIndex >= Math.min(selection.start.row, selection.end.row) && rowIndex <= Math.max(selection.start.row, selection.end.row) ? 'bg-blue-100' : ''}`}
                  onClick={() => selectRow(rowIndex)}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    beginRowRangeSelection(rowIndex);
                  }}
                  onMouseEnter={() => extendRowRangeSelection(rowIndex)}
                  onContextMenu={(e) => openContextMenu(e, 'row', rowIndex)}
                >
                  {rowIndex + 1}
                </td>
                {headers.map((header, colIndex) => {
                  const selected = isCellSelected(rowIndex, colIndex);
                  const value = row[header] ?? '';
                  const isY = selectedColumns && selectedColumns.includes(header);
                  const isX = xAxisColumn === header;
                  return (
                    <td
                      key={`${rowIndex}-${colIndex}`}
                      style={{ width: columnWidths[colIndex] }}
                      className={`border border-gray-200 px-2 py-1 text-xs whitespace-nowrap ${selected ? 'bg-blue-100' : isY ? 'bg-emerald-50' : isX ? 'bg-amber-50' : 'bg-white'} ${editingCell?.row === rowIndex && editingCell?.col === colIndex ? 'p-0' : ''}`}
                      onMouseDown={() => beginSelection(rowIndex, colIndex)}
                      onMouseMove={() => extendSelection(rowIndex, colIndex)}
                      onMouseUp={endSelection}
                      onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                      onContextMenu={(e) => openContextMenu(e, 'cell', rowIndex, colIndex)}
                    >
                      {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                        <input
                          type="text"
                          className="w-full h-full p-0 text-xs border border-blue-300 focus:outline-none bg-white"
                          value={value}
                          onChange={(e) => handleCellEdit(rowIndex, colIndex, e.target.value)}
                          autoFocus
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellEdit(rowIndex, colIndex, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                        />
                      ) : (
                        <span className="block truncate" title={String(value)}>{String(value)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded shadow-lg text-sm"
          style={{ top: contextMenu.y + 2, left: contextMenu.x + 2, minWidth: 180 }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.target === 'row' && (
            <ul className="py-1">
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => {
                  const min = Math.min(selection?.start.row ?? (contextMenu.row ?? 0), selection?.end.row ?? (contextMenu.row ?? 0));
                  const max = Math.max(selection?.start.row ?? (contextMenu.row ?? 0), selection?.end.row ?? (contextMenu.row ?? 0));
                  const isFullRow = selection && selection.start.col === 0 && selection.end.col === headers.length - 1;
                  const count = isFullRow ? (max - min + 1) : 1;
                  if (isFullRow) {
                    for (let i = 0; i < count; i++) insertRowAt(max + 1);
                  } else {
                    insertRowAt((contextMenu.row ?? 0) + 1);
                  }
                  setContextMenu({ ...contextMenu, visible: false });
                }}>Insert Row</button>
              </li>
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => {
                  if (selection && selection.start.col === 0 && selection.end.col === headers.length - 1) {
                    const min = Math.min(selection.start.row, selection.end.row);
                    const max = Math.max(selection.start.row, selection.end.row);
                    const newData = viewData.filter((_, i) => i < min || i > max);
                    setViewData(newData);
                    setUnsavedChanges(true);
                  } else if (contextMenu.row !== undefined) {
                    deleteRowAt(contextMenu.row);
                  }
                  setContextMenu({ ...contextMenu, visible: false });
                }}>Delete Row</button>
              </li>
              <li className="border-t my-1" />
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => { if (contextMenu.row !== undefined) copyRowAt(contextMenu.row, false); setContextMenu({ ...contextMenu, visible: false }); }}>Copy Row</button>
              </li>
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => { if (contextMenu.row !== undefined) copyRowAt(contextMenu.row, true); setContextMenu({ ...contextMenu, visible: false }); }}>Cut Row</button>
              </li>
              <li>
                <button disabled={!clipboard || clipboard.kind !== 'row'} className={`w-full text-left px-3 py-1.5 ${clipboard && clipboard.kind === 'row' ? 'hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'}`} onClick={() => {
                  if (contextMenu.row !== undefined) {
                    // Paste after the end of selected rows if full-row selection exists
                    const isFullRow = selection && selection.start.col === 0 && selection.end.col === headers.length - 1;
                    const max = isFullRow ? Math.max(selection!.start.row, selection!.end.row) : contextMenu.row;
                    pasteRowAfter(max);
                  }
                  setContextMenu({ ...contextMenu, visible: false });
                }}>Paste Row</button>
              </li>
            </ul>
          )}
          {contextMenu.target === 'column' && (
            <ul className="py-1">
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => {
                  const min = Math.min(selection?.start.col ?? (contextMenu.col ?? 0), selection?.end.col ?? (contextMenu.col ?? 0));
                  const max = Math.max(selection?.start.col ?? (contextMenu.col ?? 0), selection?.end.col ?? (contextMenu.col ?? 0));
                  const isFullCol = selection && selection.start.row === 0 && selection.end.row === viewData.length - 1;
                  const count = isFullCol ? (max - min + 1) : 1;
                  if (isFullCol) insertColumnsRightMultiple(max, count); else insertColumnRight(contextMenu.col ?? 0);
                  setContextMenu({ ...contextMenu, visible: false });
                }}>Insert Column</button>
              </li>
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => {
                  if (selection && selection.start.row === 0 && selection.end.row === viewData.length - 1) {
                    const min = Math.min(selection.start.col, selection.end.col);
                    const max = Math.max(selection.start.col, selection.end.col);
                    deleteColumnsRange(min, max);
                  } else if (contextMenu.col !== undefined) {
                    deleteColumnAt(contextMenu.col);
                  }
                  setContextMenu({ ...contextMenu, visible: false });
                }}>Delete Column</button>
              </li>
              <li className="border-t my-1" />
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => { if (contextMenu.col !== undefined) copyColumnAt(contextMenu.col, false); setContextMenu({ ...contextMenu, visible: false }); }}>Copy Column</button>
              </li>
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => { if (contextMenu.col !== undefined) copyColumnAt(contextMenu.col, true); setContextMenu({ ...contextMenu, visible: false }); }}>Cut Column</button>
              </li>
              <li>
                <button disabled={!clipboard || clipboard.kind !== 'column'} className={`w-full text-left px-3 py-1.5 ${clipboard && clipboard.kind === 'column' ? 'hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'}`} onClick={() => {
                  if (contextMenu.col !== undefined) {
                    const isFullCol = selection && selection.start.row === 0 && selection.end.row === viewData.length - 1;
                    const max = isFullCol ? Math.max(selection!.start.col, selection!.end.col) : (contextMenu.col ?? 0);
                    pasteColumnAt(max);
                  }
                  setContextMenu({ ...contextMenu, visible: false });
                }}>Paste Column</button>
              </li>
            </ul>
          )}
          {contextMenu.target === 'cell' && (
            <ul className="py-1">
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => { if (contextMenu.row !== undefined && contextMenu.col !== undefined) copyCellAt(contextMenu.row, contextMenu.col, false); setContextMenu({ ...contextMenu, visible: false }); }}>Copy Cell</button>
              </li>
              <li>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-100" onClick={() => { if (contextMenu.row !== undefined && contextMenu.col !== undefined) copyCellAt(contextMenu.row, contextMenu.col, true); setContextMenu({ ...contextMenu, visible: false }); }}>Cut Cell</button>
              </li>
              <li>
                <button disabled={!clipboard || clipboard.kind !== 'cell'} className={`w-full text-left px-3 py-1.5 ${clipboard && clipboard.kind === 'cell' ? 'hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'}`} onClick={() => { if (contextMenu.row !== undefined && contextMenu.col !== undefined) pasteCellAt(contextMenu.row, contextMenu.col); setContextMenu({ ...contextMenu, visible: false }); }}>Paste Cell</button>
              </li>
            </ul>
          )}
        </div>
      )}

      {/* Sheet Tabs (placeholder for future multi-sheet support) */}
      <div className="flex items-center mt-2 border-t border-gray-200 pt-1 text-xs text-gray-600 flex-wrap gap-1">
        {rawData.sheets ? rawData.sheets.map((s, idx) => {
          const isActive = idx === activeSheet;
          return (
            <div key={s.name + idx} className={`flex items-center pl-2 pr-1 py-1 rounded border cursor-pointer group ${isActive ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white hover:bg-gray-100 border-gray-300'}`}
              onClick={() => {
                if (unsavedChanges && !confirm('You have unsaved changes on this sheet. Switch anyway?')) return;
                // Commit local changes to current sheet before switching (optional). We discard if unsaved and user confirmed.
                if (!unsavedChanges) {
                  commitChanges();
                }
                setActiveSheet(idx);
                setActiveSheetIndex(idx);
              }}
              onDoubleClick={() => {
                const newName = prompt('Rename sheet', s.name);
                if (newName && newName.trim()) renameSheet(idx, newName.trim());
              }}
            >
              <span className="max-w-[90px] truncate" title={s.name}>{s.name}</span>
              <div className="flex items-center ml-1 opacity-0 group-hover:opacity-100 transition">
                <button className="px-1 hover:text-blue-600" title="Copy sheet" onClick={(e) => { e.stopPropagation(); copySheet(idx); }}>&#x2398;</button>
                <button disabled={(rawData.sheets?.length || 0) < 2} className="px-1 hover:text-red-600 disabled:opacity-30" title="Delete sheet" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this sheet?')) removeSheet(idx); }}>×</button>
              </div>
            </div>
          );
        }) : (
          <div className="px-3 py-1 rounded border bg-blue-100 border-blue-300 text-blue-800">Sheet1</div>
        )}
        <button className="ml-1 px-2 py-1 border border-dashed rounded hover:bg-gray-50" onClick={() => addSheet()}>+ Sheet</button>
        {rawData.sheets && rawData.sheets.length > 1 && (
          <div className="flex items-center gap-1 ml-2">
            <button className="px-2 py-1 border rounded hover:bg-gray-50" disabled={activeSheet === 0} onClick={() => moveSheet(activeSheet, Math.max(0, activeSheet - 1))}>{'<'}</button>
            <button className="px-2 py-1 border rounded hover:bg-gray-50" disabled={activeSheet === (rawData.sheets.length - 1)} onClick={() => moveSheet(activeSheet, Math.min(rawData.sheets!.length - 1, activeSheet + 1))}>{'>'}</button>
          </div>
        )}
        <span className="ml-auto italic">Rows: {viewData.length} | Columns: {headers.length}</span>
      </div>
    </div>
  );
};

export default DataPreview;
