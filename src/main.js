import './style.css';
import {
    computeLineDiff,
    buildSideBySideModel,
    buildUnifiedModel,
    computeStats,
} from './diff-engine.js';

// --- DOM Elements ---
const leftEditor = document.getElementById('leftEditor');
const rightEditor = document.getElementById('rightEditor');
const compareBtn = document.getElementById('compareBtn');
const swapBtn = document.getElementById('swapBtn');
const clearBtn = document.getElementById('clearBtn');
const sampleBtn = document.getElementById('sampleBtn');
const themeToggle = document.getElementById('themeToggle');
const splitViewBtn = document.getElementById('splitViewBtn');
const unifiedViewBtn = document.getElementById('unifiedViewBtn');
const diffOutput = document.getElementById('diffOutput');
const diffContainer = document.getElementById('diffContainer');
const statsBar = document.getElementById('statsBar');
const addedCount = document.getElementById('addedCount');
const removedCount = document.getElementById('removedCount');
const unchangedCount = document.getElementById('unchangedCount');
const emptyState = document.getElementById('emptyState');
const leftFileInput = document.getElementById('leftFileInput');
const rightFileInput = document.getElementById('rightFileInput');
const leftEditorWrap = document.getElementById('leftEditorWrap');
const rightEditorWrap = document.getElementById('rightEditorWrap');
const leftDropOverlay = document.getElementById('leftDropOverlay');
const rightDropOverlay = document.getElementById('rightDropOverlay');

// --- State ---
let currentView = 'split'; // 'split' | 'unified'
let lastChanges = null;

// --- Theme ---
function initTheme() {
    const saved = localStorage.getItem('diffthat-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('diffthat-theme', next);
}

// --- View toggle ---
function setView(view) {
    currentView = view;
    splitViewBtn.classList.toggle('active', view === 'split');
    unifiedViewBtn.classList.toggle('active', view === 'unified');

    if (lastChanges) {
        renderDiff(lastChanges);
    }
}

// --- Compare ---
function runCompare() {
    const oldText = leftEditor.value;
    const newText = rightEditor.value;

    if (!oldText && !newText) {
        return;
    }

    const changes = computeLineDiff(oldText, newText);
    lastChanges = changes;

    // Stats
    const stats = computeStats(changes);
    addedCount.textContent = stats.added;
    removedCount.textContent = stats.removed;
    unchangedCount.textContent = stats.unchanged;
    statsBar.style.display = 'flex';

    // Render
    renderDiff(changes);

    // Show diff, hide empty state
    diffOutput.style.display = 'block';
    emptyState.style.display = 'none';

    // Smooth scroll to diff
    diffOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- Render ---
function renderDiff(changes) {
    diffContainer.innerHTML = '';

    if (currentView === 'split') {
        renderSplitDiff(changes);
    } else {
        renderUnifiedDiff(changes);
    }
}

function renderSplitDiff(changes) {
    const model = buildSideBySideModel(changes);
    const wrapper = document.createElement('div');
    wrapper.className = 'diff-split';

    const leftSide = document.createElement('div');
    leftSide.className = 'diff-split-side';

    const rightSide = document.createElement('div');
    rightSide.className = 'diff-split-side';

    for (const row of model) {
        leftSide.appendChild(createDiffRow(row.left, 'left'));
        rightSide.appendChild(createDiffRow(row.right, 'right'));
    }

    wrapper.appendChild(leftSide);
    wrapper.appendChild(rightSide);
    diffContainer.appendChild(wrapper);

    // Sync scrolling
    syncScroll(leftSide, rightSide);
}

function createDiffRow(side, direction) {
    const rowEl = document.createElement('div');
    rowEl.className = `diff-row ${side.type}${side.type === 'empty' ? ' empty-row' : ''}`;

    // Gutter
    const gutter = document.createElement('div');
    gutter.className = 'diff-gutter';
    gutter.textContent = side.lineNum ?? '';
    rowEl.appendChild(gutter);

    // Prefix
    const prefix = document.createElement('div');
    prefix.className = 'diff-prefix';
    if (side.type === 'added') prefix.textContent = '+';
    else if (side.type === 'removed') prefix.textContent = '−';
    else prefix.textContent = ' ';
    rowEl.appendChild(prefix);

    // Content
    const content = document.createElement('div');
    content.className = 'diff-content';

    if (side.charDiff && (side.type === 'removed' || side.type === 'added')) {
        content.appendChild(renderCharDiff(side.charDiff, side.type));
    } else {
        content.textContent = side.content;
    }

    rowEl.appendChild(content);

    return rowEl;
}

function renderUnifiedDiff(changes) {
    const model = buildUnifiedModel(changes);
    const wrapper = document.createElement('div');
    wrapper.className = 'diff-unified';

    for (const row of model) {
        const rowEl = document.createElement('div');
        rowEl.className = `diff-row ${row.type}`;

        // Left gutter
        const gutterLeft = document.createElement('div');
        gutterLeft.className = 'diff-gutter-left';
        gutterLeft.textContent = row.leftLineNum ?? '';
        rowEl.appendChild(gutterLeft);

        // Right gutter
        const gutterRight = document.createElement('div');
        gutterRight.className = 'diff-gutter-right';
        gutterRight.textContent = row.rightLineNum ?? '';
        rowEl.appendChild(gutterRight);

        // Prefix
        const prefix = document.createElement('div');
        prefix.className = 'diff-prefix';
        if (row.type === 'added') prefix.textContent = '+';
        else if (row.type === 'removed') prefix.textContent = '−';
        else prefix.textContent = ' ';
        rowEl.appendChild(prefix);

        // Content
        const content = document.createElement('div');
        content.className = 'diff-content';

        if (row.charDiff && (row.type === 'removed' || row.type === 'added')) {
            content.appendChild(renderCharDiff(row.charDiff, row.type));
        } else {
            content.textContent = row.content;
        }

        rowEl.appendChild(content);
        wrapper.appendChild(rowEl);
    }

    diffContainer.appendChild(wrapper);
}

function renderCharDiff(charDiff, rowType) {
    const frag = document.createDocumentFragment();

    for (const part of charDiff) {
        const span = document.createElement('span');
        span.textContent = part.value;

        if (rowType === 'removed' && part.removed) {
            span.className = 'diff-char-removed';
        } else if (rowType === 'added' && part.added) {
            span.className = 'diff-char-added';
        } else if (part.added || part.removed) {
            // Skip characters that belong to the other side
            if (rowType === 'removed' && part.added) continue;
            if (rowType === 'added' && part.removed) continue;
        }

        frag.appendChild(span);
    }

    return frag;
}

// --- Sync Scrolling ---
function syncScroll(left, right) {
    let isSyncing = false;

    left.addEventListener('scroll', () => {
        if (isSyncing) return;
        isSyncing = true;
        right.scrollTop = left.scrollTop;
        right.scrollLeft = left.scrollLeft;
        requestAnimationFrame(() => { isSyncing = false; });
    });

    right.addEventListener('scroll', () => {
        if (isSyncing) return;
        isSyncing = true;
        left.scrollTop = right.scrollTop;
        left.scrollLeft = right.scrollLeft;
        requestAnimationFrame(() => { isSyncing = false; });
    });
}

// --- Swap ---
function swapPanels() {
    const tmp = leftEditor.value;
    leftEditor.value = rightEditor.value;
    rightEditor.value = tmp;

    if (lastChanges) {
        runCompare();
    }
}

// --- Clear ---
function clearAll() {
    leftEditor.value = '';
    rightEditor.value = '';
    lastChanges = null;
    diffContainer.innerHTML = '';
    diffOutput.style.display = 'none';
    statsBar.style.display = 'none';
    emptyState.style.display = 'flex';
}

// --- Sample Data ---
const SAMPLE_ORIGINAL = `import React, { useState } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { text: input, done: false }]);
      setInput('');
    }
  };

  const removeTodo = (index) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div className="app">
      <h1>Todo List</h1>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Add a todo..."
      />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map((todo, index) => (
          <li key={index}>
            {todo.text}
            <button onClick={() => removeTodo(index)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TodoApp;`;

const SAMPLE_MODIFIED = `import React, { useState, useCallback, useMemo } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all');

  const addTodo = useCallback(() => {
    if (input.trim()) {
      setTodos(prev => [...prev, {
        id: Date.now(),
        text: input.trim(),
        done: false,
        createdAt: new Date(),
      }]);
      setInput('');
    }
  }, [input]);

  const toggleTodo = useCallback((id) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  }, []);

  const removeTodo = useCallback((id) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'active': return todos.filter(t => !t.done);
      case 'completed': return todos.filter(t => t.done);
      default: return todos;
    }
  }, [todos, filter]);

  return (
    <div className="app">
      <h1>Todo List</h1>
      <div className="input-group">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="What needs to be done?"
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <div className="filters">
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('active')}>Active</button>
        <button onClick={() => setFilter('completed')}>Done</button>
      </div>
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
            <button onClick={() => removeTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <p className="count">{todos.filter(t => !t.done).length} items left</p>
    </div>
  );
}

export default TodoApp;`;

function loadSample() {
    leftEditor.value = SAMPLE_ORIGINAL;
    rightEditor.value = SAMPLE_MODIFIED;
    runCompare();
}

// --- File Upload ---
function handleFileUpload(file, targetEditor) {
    const reader = new FileReader();
    reader.onload = (e) => {
        targetEditor.value = e.target.result;
    };
    reader.readAsText(file);
}

// --- Drag and Drop ---
function setupDragDrop(wrapEl, overlayEl, editor) {
    let dragCounter = 0;

    wrapEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlayEl.classList.add('active');
    });

    wrapEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            overlayEl.classList.remove('active');
        }
    });

    wrapEl.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    wrapEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlayEl.classList.remove('active');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0], editor);
        }
    });
}

// --- Event Listeners ---
compareBtn.addEventListener('click', runCompare);
swapBtn.addEventListener('click', swapPanels);
clearBtn.addEventListener('click', clearAll);
sampleBtn.addEventListener('click', loadSample);
themeToggle.addEventListener('click', toggleTheme);

splitViewBtn.addEventListener('click', () => setView('split'));
unifiedViewBtn.addEventListener('click', () => setView('unified'));

leftFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0], leftEditor);
    }
});

rightFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0], rightEditor);
    }
});

// Keyboard shortcut: Ctrl/Cmd + Enter to compare
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCompare();
    }
});

// Drag and drop
setupDragDrop(leftEditorWrap, leftDropOverlay, leftEditor);
setupDragDrop(rightEditorWrap, rightDropOverlay, rightEditor);

// --- Init ---
initTheme();
