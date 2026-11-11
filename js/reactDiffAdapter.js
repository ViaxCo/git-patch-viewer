/**
 * React Diff Viewer Adapter
 * Provides a vanilla JS interface to use react-diff-viewer component
 */

window.ReactDiffAdapter = (() => {
  // Track mounted React instances for cleanup
  let currentRoot = null;

  /**
   * Extract old and new file content from patch hunks
   * @param {Object} file - Parsed file object with hunks
   * @returns {Object} { oldContent, newContent }
   */
  function extractFileContent(file) {
    if (!file || !file.hunks || file.hunks.length === 0) {
      return { oldContent: '', newContent: '' };
    }

    const oldLines = [];
    const newLines = [];

    file.hunks.forEach(hunk => {
      hunk.lines.forEach(line => {
        if (line.type === 'context') {
          // Context lines appear in both old and new
          oldLines.push(line.content);
          newLines.push(line.content);
        } else if (line.type === 'del') {
          // Deletion lines only in old
          oldLines.push(line.content);
        } else if (line.type === 'add') {
          // Addition lines only in new
          newLines.push(line.content);
        }
      });
    });

    return {
      oldContent: oldLines.join('\n'),
      newContent: newLines.join('\n')
    };
  }

  /**
   * Get theme styles for react-diff-viewer based on current theme
   * @param {boolean} isDarkMode - Whether dark mode is active
   * @returns {Object} Styles object for react-diff-viewer
   */
  function getThemeStyles(isDarkMode) {
    // Get CSS custom properties
    const rootStyles = getComputedStyle(document.documentElement);
    
    // Helper to get CSS variable value
    const getCSSVar = (varName) => {
      return rootStyles.getPropertyValue(varName).trim();
    };

    // Map theme colors to react-diff-viewer style variables
    const addedBg = getCSSVar('--diff-added-bg') || (isDarkMode ? 'rgba(74, 222, 128, 0.15)' : 'rgba(34, 197, 94, 0.1)');
    const removedBg = getCSSVar('--diff-removed-bg') || (isDarkMode ? 'rgba(248, 113, 113, 0.15)' : 'rgba(239, 68, 68, 0.1)');
    const addedWordBg = getCSSVar('--diff-added-word-bg') || (isDarkMode ? 'rgba(74, 222, 128, 0.3)' : 'rgba(34, 197, 94, 0.25)');
    const removedWordBg = getCSSVar('--diff-removed-word-bg') || (isDarkMode ? 'rgba(248, 113, 113, 0.3)' : 'rgba(239, 68, 68, 0.25)');
    const bgColor = getCSSVar('--bg-primary') || (isDarkMode ? '#2e303c' : '#fff');
    const textColor = getCSSVar('--text-primary') || (isDarkMode ? '#FFF' : '#212529');
    const textSecondary = getCSSVar('--text-secondary') || (isDarkMode ? '#b4b7c9' : '#6c757d');
    const accentColor = getCSSVar('--accent-primary') || (isDarkMode ? '#a48fff' : '#7c3aed');

    const styles = {
      variables: {
        light: {
          diffViewerBackground: bgColor,
          diffViewerColor: textColor,
          addedBackground: addedBg,
          addedColor: textColor,
          removedBackground: removedBg,
          removedColor: textColor,
          wordAddedBackground: addedWordBg,
          wordRemovedBackground: removedWordBg,
          addedGutterBackground: addedBg,
          removedGutterBackground: removedBg,
          gutterBackground: getCSSVar('--bg-secondary') || (isDarkMode ? '#2c2f3a' : '#f7f7f7'),
          gutterBackgroundDark: getCSSVar('--bg-tertiary') || (isDarkMode ? '#262933' : '#f3f1f1'),
          gutterColor: textSecondary,
          addedGutterColor: textSecondary,
          removedGutterColor: textSecondary,
        },
        dark: {
          diffViewerBackground: bgColor,
          diffViewerColor: textColor,
          addedBackground: addedBg,
          addedColor: textColor,
          removedBackground: removedBg,
          removedColor: textColor,
          wordAddedBackground: addedWordBg,
          wordRemovedBackground: removedWordBg,
          addedGutterBackground: addedBg,
          removedGutterBackground: removedBg,
          gutterBackground: getCSSVar('--bg-secondary') || '#2c2f3a',
          gutterBackgroundDark: getCSSVar('--bg-tertiary') || '#262933',
          gutterColor: textSecondary,
          addedGutterColor: textSecondary,
          removedGutterColor: textSecondary,
        }
      },
      diffContainer: {
        fontSize: '14px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace'
      },
      line: {
        fontSize: '14px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace'
      },
      wordDiff: {
        display: 'inline',
        padding: 0
      },
      titleBlock: {
        background: getCSSVar('--bg-secondary') || (isDarkMode ? '#2c2f3a' : '#f7f7f7'),
        padding: '10px',
        fontWeight: '600',
        fontSize: '14px',
        color: accentColor,
        borderBottom: `2px solid ${accentColor}`
      }
    };

    return styles;
  }

  /**
   * Syntax highlighting function using Prism
   * @param {string} code - Code to highlight
   * @param {string} language - Language for highlighting
   * @returns {React.Element} Highlighted code element
   */
  function highlightSyntax(code, language) {
    // Prism highlighting is disabled for now due to compatibility issues with CDN version
    // The diff viewer works great without it - differences are still clearly visible
    // TODO: Consider adding syntax highlighting back with a more compatible setup
    return React.createElement('span', { 
      style: { display: 'inline' } 
    }, code || '');
  }

  /**
   * Render a file diff using react-diff-viewer
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} file - Parsed file object from PatchParser
   * @param {Object} options - Rendering options
   * @param {boolean} options.splitView - Whether to use side-by-side view
   * @param {boolean} options.isDarkMode - Whether dark mode is active
   * @param {string} options.language - Programming language for syntax highlighting
   */
  function render(container, file, options = {}) {
    if (!container) {
      console.error('ReactDiffAdapter: No container provided');
      return;
    }

    if (!window.React || !window.ReactDOM) {
      console.error('ReactDiffAdapter: React or ReactDOM not loaded');
      return;
    }

    if (!window.ReactDiffViewer) {
      console.error('ReactDiffAdapter: react-diff-viewer not loaded');
      return;
    }

    // Cleanup previous render
    unmount();

    const {
      splitView = true,
      isDarkMode = false,
      language = 'plaintext'
    } = options;

    // Extract file content
    const { oldContent, newContent } = extractFileContent(file);

    // Get theme styles
    const styles = getThemeStyles(isDarkMode);

    // Create syntax highlighting function bound to the language
    const renderContent = (code) => highlightSyntax(code, language);

    // Get the component - it's exported as .default from the ES module
    const DiffViewerComponent = window.ReactDiffViewer.default;
    
    if (!DiffViewerComponent) {
      console.error('ReactDiffViewer.default is not available');
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          <p>React Diff Viewer component not found</p>
          <p style="font-size: 12px; margin-top: 10px;">Please refresh the page.</p>
        </div>
      `;
      return;
    }

    // Build react-diff-viewer component using React.createElement
    const diffViewerElement = React.createElement(DiffViewerComponent, {
      oldValue: oldContent,
      newValue: newContent,
      splitView: splitView,
      useDarkTheme: isDarkMode,
      styles: styles,
      compareMethod: 'diffWordsWithSpace',
      showDiffOnly: false,
      renderContent: renderContent,
      leftTitle: file.oldPath || 'Original',
      rightTitle: file.newPath || 'Modified'
    });

    // Render using React 18 API
    try {
      if (window.ReactDOM.createRoot) {
        // React 18+ API
        currentRoot = ReactDOM.createRoot(container);
        currentRoot.render(diffViewerElement);
      } else {
        // React 17 fallback
        ReactDOM.render(diffViewerElement, container);
      }
    } catch (error) {
      console.error('ReactDiffAdapter: Failed to render:', error);
      
      // Fallback: show error message
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          <p>Failed to load React Diff Viewer</p>
          <p style="font-size: 12px; margin-top: 10px;">Error: ${error.message}</p>
          <p style="font-size: 12px; margin-top: 10px;">Please refresh the page.</p>
        </div>
      `;
    }
  }

  /**
   * Show placeholder message when no file is selected
   * @param {HTMLElement} container - DOM element to render into
   */
  function renderPlaceholder(container) {
    if (!container) return;

    unmount();

    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        padding: 40px;
        text-align: center;
        color: var(--text-secondary);
      ">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5; margin-bottom: 20px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 500;">Select a file to view its diff</h3>
        <p style="margin: 0; font-size: 14px; opacity: 0.8;">Click on a file in the sidebar to see its changes</p>
      </div>
    `;
  }

  /**
   * Unmount the current React component
   */
  function unmount() {
    if (currentRoot) {
      try {
        if (currentRoot.unmount) {
          // React 18+ API
          currentRoot.unmount();
        } else {
          // React 17 fallback - container is stored differently
          // This path shouldn't normally be hit with React 18
        }
      } catch (e) {
        console.warn('Failed to unmount React component:', e);
      }
      currentRoot = null;
    }
  }

  /**
   * Check if react-diff-viewer is loaded and available
   * @returns {boolean} True if available
   */
  function isAvailable() {
    return !!(window.React && window.ReactDOM && typeof window.ReactDiffViewer?.default === 'function');
  }

  // Public API
  return {
    render,
    renderPlaceholder,
    unmount,
    isAvailable,
    extractFileContent
  };
})();

// Debug: Verify module loaded
if (window.ReactDiffAdapter) {
  console.log('✅ ReactDiffAdapter module loaded successfully');
} else {
  console.error('❌ ReactDiffAdapter failed to load');
}

