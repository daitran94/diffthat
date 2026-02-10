import * as Diff from 'diff';

/**
 * Compute line-level diff between two texts.
 * Returns an array of change objects: { value, added, removed, count }
 */
export function computeLineDiff(oldText, newText) {
  return Diff.diffLines(oldText, newText);
}

/**
 * Compute character-level diff between two strings (for intra-line highlighting).
 */
export function computeCharDiff(oldStr, newStr) {
  return Diff.diffChars(oldStr, newStr);
}

/**
 * Build a side-by-side model from line changes.
 * Returns an array of row pairs: { left: { lineNum, content, type }, right: { lineNum, content, type } }
 * type: 'added' | 'removed' | 'unchanged' | 'empty'
 */
export function buildSideBySideModel(changes) {
  const rows = [];
  let leftLine = 1;
  let rightLine = 1;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const lines = splitLines(change.value);

    if (!change.added && !change.removed) {
      // Unchanged
      for (const line of lines) {
        rows.push({
          left: { lineNum: leftLine++, content: line, type: 'unchanged' },
          right: { lineNum: rightLine++, content: line, type: 'unchanged' },
        });
      }
    } else if (change.removed) {
      // Check if next change is an addition (paired change)
      const nextChange = changes[i + 1];
      if (nextChange && nextChange.added) {
        // Pair removed and added lines
        const removedLines = lines;
        const addedLines = splitLines(nextChange.value);
        const maxLen = Math.max(removedLines.length, addedLines.length);

        for (let j = 0; j < maxLen; j++) {
          const leftSide = j < removedLines.length
            ? { lineNum: leftLine++, content: removedLines[j], type: 'removed' }
            : { lineNum: null, content: '', type: 'empty' };
          const rightSide = j < addedLines.length
            ? { lineNum: rightLine++, content: addedLines[j], type: 'added' }
            : { lineNum: null, content: '', type: 'empty' };

          // Compute char diff for paired lines
          if (leftSide.type === 'removed' && rightSide.type === 'added') {
            const charDiff = computeCharDiff(leftSide.content, rightSide.content);
            leftSide.charDiff = charDiff;
            rightSide.charDiff = charDiff;
          }

          rows.push({ left: leftSide, right: rightSide });
        }
        i++; // Skip the next (added) change
      } else {
        // Only removed
        for (const line of lines) {
          rows.push({
            left: { lineNum: leftLine++, content: line, type: 'removed' },
            right: { lineNum: null, content: '', type: 'empty' },
          });
        }
      }
    } else if (change.added) {
      // Only added (no paired removal)
      for (const line of lines) {
        rows.push({
          left: { lineNum: null, content: '', type: 'empty' },
          right: { lineNum: rightLine++, content: line, type: 'added' },
        });
      }
    }
  }

  return rows;
}

/**
 * Build a unified model from line changes.
 * Returns an array of: { leftLineNum, rightLineNum, content, type, charDiff? }
 * type: 'added' | 'removed' | 'unchanged'
 */
export function buildUnifiedModel(changes) {
  const rows = [];
  let leftLine = 1;
  let rightLine = 1;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const lines = splitLines(change.value);

    if (!change.added && !change.removed) {
      for (const line of lines) {
        rows.push({
          leftLineNum: leftLine++,
          rightLineNum: rightLine++,
          content: line,
          type: 'unchanged',
        });
      }
    } else if (change.removed) {
      const nextChange = changes[i + 1];
      const removedLines = lines;

      if (nextChange && nextChange.added) {
        const addedLines = splitLines(nextChange.value);

        // Emit removed lines
        for (let j = 0; j < removedLines.length; j++) {
          const row = {
            leftLineNum: leftLine++,
            rightLineNum: null,
            content: removedLines[j],
            type: 'removed',
          };
          // Pair char diff if there's a corresponding added line
          if (j < addedLines.length) {
            row.charDiff = computeCharDiff(removedLines[j], addedLines[j]);
          }
          rows.push(row);
        }

        // Emit added lines
        for (let j = 0; j < addedLines.length; j++) {
          const row = {
            leftLineNum: null,
            rightLineNum: rightLine++,
            content: addedLines[j],
            type: 'added',
          };
          if (j < removedLines.length) {
            row.charDiff = computeCharDiff(removedLines[j], addedLines[j]);
          }
          rows.push(row);
        }
        i++; // Skip the added change
      } else {
        for (const line of removedLines) {
          rows.push({
            leftLineNum: leftLine++,
            rightLineNum: null,
            content: line,
            type: 'removed',
          });
        }
      }
    } else if (change.added) {
      for (const line of lines) {
        rows.push({
          leftLineNum: null,
          rightLineNum: rightLine++,
          content: line,
          type: 'added',
        });
      }
    }
  }

  return rows;
}

/**
 * Compute stats from changes.
 */
export function computeStats(changes) {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const change of changes) {
    const lineCount = splitLines(change.value).length;
    if (change.added) {
      added += lineCount;
    } else if (change.removed) {
      removed += lineCount;
    } else {
      unchanged += lineCount;
    }
  }

  return { added, removed, unchanged };
}

/**
 * Split text into lines, removing trailing empty line from final newline.
 */
function splitLines(text) {
  const lines = text.split('\n');
  // Remove the trailing empty string caused by final \n
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length === 0 ? [''] : lines;
}
