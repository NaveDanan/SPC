import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ChevronRight, Copy, Clipboard, Table } from 'lucide-react';

interface CellPosition {
  row: number;
  col: number;
}

interface Selection {
  start: CellPosition;
  end: CellPosition;
}

const DataPreview: React.FC = () => {
  const { rawData, selectedColumns, setSelectedColumns } = useAppContext();
  const [activeSheet, setActiveSheet] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const tableRef = useRef<HTMLDivElement>(null);

  if (!rawData || !rawData.data.length) {
    return <p className="text-gray-500">No data available. Please upload a file.</p>;
  }

  const columnLetters = Array.from({ length: rawData.headers.length }, (_, i) => 
    String.fromCharCode(65 + i)
  );

  const getSelectionRange = () => {
    if (!selection) return '';
    const startCol = String.fromCharCode(65 + selection.start.col);
    const endCol = String.fromCharCode(65 + selection.end.col);
    return `${startCol}${selection.start.row + 1}:${endCol}${selection.end.row + 1}`;
  };

  const handleMouseDown = (row: number, col: number) => {
    setSelection({ start: { row, col }, end: { row, col } });
    setIsDragging(true);
  };

  const handleMouseMove = (row: number, col: number) => {
    if (isDragging && selection) {
      setSelection({ ...selection, end: { row, col } });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
        newRow = Math.min(rawData.data.length - 1, newRow + 1);
        break;
      case 'ArrowLeft':
        newCol = Math.max(0, newCol - 1);
        break;
      case 'ArrowRight':
        newCol = Math.min(rawData.headers.length - 1, newCol + 1);
        break;
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
      const row = [];
      for (let j = startCol; j <= endCol; j++) {
        const cellKey = `${i}-${j}`;
        const value = cellValues[cellKey] || rawData.data[i][rawData.headers[j]];
        row.push(value);
      }
      copyText.push(row.join('\t'));
    }

    navigator.clipboard.writeText(copyText.join('\n'));
  };

  const handlePaste = async () => {
    if (!selection) return;
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split('\n');
      const newCellValues = { ...cellValues };

      rows.forEach((row, rowOffset) => {
        const cells = row.split('\t');
        cells.forEach((cell, colOffset) => {
          const targetRow = selection.start.row + rowOffset;
          const targetCol = selection.start.col + colOffset;
          if (targetRow < rawData.data.length && targetCol < rawData.headers.length) {
            newCellValues[`${targetRow}-${targetCol}`] = cell;
          }
        });
      });

      setCellValues(newCellValues);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  const handleDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
  };

  const handleCellEdit = (row: number, col: number, value: string) => {
    setCellValues({ ...cellValues, [`${row}-${col}`]: value });
    setEditingCell(null);
  };

  const isCellSelected = (row: number, col: number) => {
    if (!selection) return false;
    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  return (
    <div 
      className="relative overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={tableRef}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded-md">
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-gray-200 rounded"
          title="Copy"
        >
          <Copy size={16} />
        </button>
        <button
          onClick={handlePaste}
          className="p-1 hover:bg-gray-200 rounded"
          title="Paste"
        >
          <Clipboard size={16} />
        </button>
        <div className="ml-4 text-sm text-gray-600">
          {selection && `Selected: ${getSelectionRange()}`}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full border-collapse">
          {/* Column Headers */}
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="w-10 border border-gray-200 bg-gray-100"></th>
              {columnLetters.map((letter, index) => (
                <th
                  key={letter}
                  className="min-w-[100px] border border-gray-200 bg-gray-100 px-2 py-1 text-sm font-medium text-gray-600"
                >
                  {letter}
                </th>
              ))}
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {rawData.data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border border-gray-200 bg-gray-100 px-2 py-1 text-sm font-medium text-gray-600 text-center">
                  {rowIndex + 1}
                </td>
                {rawData.headers.map((header, colIndex) => {
                  const isSelected = isCellSelected(rowIndex, colIndex);
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const cellValue = cellValues[cellKey] || row[header];

                  return (
                    <td
                      key={`${rowIndex}-${colIndex}`}
                      className={`border border-gray-200 px-2 py-1 text-sm ${
                        isSelected ? 'bg-blue-100' : 'bg-white'
                      }`}
                      onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                      onMouseMove={() => handleMouseMove(rowIndex, colIndex)}
                      onMouseUp={handleMouseUp}
                      onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                    >
                      {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                        <input
                          type="text"
                          className="w-full p-0 border-none focus:outline-none bg-white"
                          value={cellValue}
                          onChange={(e) => handleCellEdit(rowIndex, colIndex, e.target.value)}
                          autoFocus
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCellEdit(rowIndex, colIndex, e.currentTarget.value);
                            }
                          }}
                        />
                      ) : (
                        cellValue
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs */}
      <div className="flex items-center mt-2 border-t border-gray-200">
        <div
          className={`px-4 py-1 border-r border-gray-200 cursor-pointer ${
            activeSheet === 0 ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
          }`}
          onClick={() => setActiveSheet(0)}
        >
          Sheet 1
        </div>
        <button
          className="p-1 ml-2 text-gray-400 hover:text-gray-600"
          onClick={() => {
            // Handle adding new sheet
          }}
        >
          <Table size={16} />
        </button>
      </div>
    </div>
  );
};

export default DataPreview;