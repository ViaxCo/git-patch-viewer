/**
 * Viewer
 * Main application logic for the Git Patch Viewer
 */

const Viewer = (() => {
  // State
  let currentPatch = null;
  let currentView = 'side-by-side'; // 'unified' or 'side-by-side'
  let currentSelectedFile = null; // Currently selected file for react viewer
  let currentSavedPatchId = null; // Track if current patch is saved
  let filesViewMode = 'flat'; // 'flat' or 'tree'
  let folderStates = {}; // Track expanded/collapsed folders
  let filesSearchQuery = ''; // Current search query
  let sidebarCollapsed = false; // Track sidebar collapsed state
  let isFullscreenMode = false; // Track fullscreen mode state
  let isMetadataCollapsed = false; // Track metadata collapsed state

  /**
   * Initialize the viewer
   */
  function init() {
    console.log('🚀 Initializing Git Patch Viewer...');

    // Load saved view preference
    const savedView = localStorage.getItem('git-patch-viewer-view');
    if (savedView) {
      currentView = savedView;
    }

    // Load saved files view mode
    const savedFilesView = localStorage.getItem('git-patch-viewer-files-view-mode');
    if (savedFilesView) {
      filesViewMode = savedFilesView;
      const treeViewToggle = document.getElementById('tree-view-toggle');
      if (treeViewToggle) {
        treeViewToggle.checked = (filesViewMode === 'tree');
      }
    }

    // Load saved sidebar collapsed state
    const savedSidebarState = localStorage.getItem('git-patch-viewer-sidebar-collapsed');
    if (savedSidebarState === 'true') {
      sidebarCollapsed = true;
      applySidebarCollapsedState();
    }

    // Load saved metadata collapsed state
    const savedMetadataState = localStorage.getItem('git-patch-viewer-metadata-collapsed');
    if (savedMetadataState === 'true') {
      isMetadataCollapsed = true;
    }

    // Set up event listeners
    setupInputListeners();
    setupViewerListeners();
    setupModalListeners();
    setupKeyboardShortcuts();

    // Register theme change callback for React viewer
    if (typeof ThemeManager !== 'undefined' && ThemeManager.onThemeChange) {
      ThemeManager.onThemeChange(() => {
        // Re-render if using React viewer and a file is selected
        if (currentSelectedFile) {
          renderDiff();
        }
      });
    }

    // Handle URL parameters
    const urlStatus = URLHandler.handleURLOnLoad();
    
    // Check if we have a saved patch ID to load
    const savedPatchId = URLHandler.getSavedPatchIdFromURL();
    
    if (savedPatchId) {
      // Load from saved patches
      loadSavedPatchById(savedPatchId);
    } else if (urlStatus.hasPatch) {
      // Load patch from URL
      loadPatchFromURL();
    } else {
      // Show recent patches in input screen
      displayRecentPatches();
    }

    // Update saved patches count
    updateSavedPatchesCount();

    console.log('✅ Viewer initialized');
  }

  /**
   * Set up input section event listeners
   */
  function setupInputListeners() {
    // Drag and drop
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', handleDragOver);
      dropZone.addEventListener('dragleave', handleDragLeave);
      dropZone.addEventListener('drop', handleDrop);
    }

    // Browse button
    const browseBtn = document.getElementById('browse-btn');
    const fileInput = document.getElementById('file-input');
    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', handleFileSelect);
    }

    // Parse button
    const parseBtn = document.getElementById('parse-btn');
    if (parseBtn) {
      parseBtn.addEventListener('click', handleParsePatch);
    }

    // Clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        document.getElementById('patch-textarea').value = '';
      });
    }

    // New patch button
    const newPatchBtn = document.getElementById('new-patch-btn');
    if (newPatchBtn) {
      newPatchBtn.addEventListener('click', showInputSection);
    }
  }

  /**
   * Set up viewer section event listeners
   */
  function setupViewerListeners() {
    // View toggle buttons
    const unifiedBtn = document.getElementById('unified-btn');
    const sideBySideBtn = document.getElementById('sidebyside-btn');

    if (unifiedBtn) {
      unifiedBtn.addEventListener('click', () => setView('unified'));
    }
    if (sideBySideBtn) {
      sideBySideBtn.addEventListener('click', () => setView('side-by-side'));
    }

    // Copy all button
    document.getElementById('copy-all-btn')?.addEventListener('click', handleCopyAll);

    // Saved patches button
    document.getElementById('saved-btn')?.addEventListener('click', handleSavedButtonClick);
    document.getElementById('close-saved-btn')?.addEventListener('click', closeSavedSidebar);

    // Close saved sidebar when clicking outside
    document.addEventListener('click', handleClickOutsideSavedSidebar);
    
    // Share button
    document.getElementById('share-btn')?.addEventListener('click', openShareModal);

    // Files settings button
    document.getElementById('files-settings-btn')?.addEventListener('click', toggleFilesSettings);

    // Tree view toggle
    document.getElementById('tree-view-toggle')?.addEventListener('change', handleTreeViewToggle);

    // Files search
    document.getElementById('files-search')?.addEventListener('input', handleFilesSearch);

    // Sidebar collapse button
    document.getElementById('sidebar-collapse-btn')?.addEventListener('click', toggleSidebarCollapse);

    // Sidebar hover for temporary expansion
    const sidebar = document.getElementById('file-sidebar');
    if (sidebar) {
      sidebar.addEventListener('mouseenter', handleSidebarMouseEnter);
      sidebar.addEventListener('mouseleave', handleSidebarMouseLeave);
    }

    // Close settings dropdown when clicking outside
    document.addEventListener('click', handleClickOutsideFilesSettings);

    // Fullscreen button
    document.getElementById('fullscreen-btn')?.addEventListener('click', toggleFullscreenMode);

    // Note: Metadata toggle button is created dynamically and has inline onclick handler
  }

  /**
   * Set up modal event listeners
   */
  function setupModalListeners() {
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // Close modal on backdrop click (except for patch-exists-modal which handles its own)
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal && modal.id !== 'patch-exists-modal') {
          modal.classList.add('hidden');
        }
      });
    });

    // Share modal - copy button
    document.getElementById('copy-share-url-btn')?.addEventListener('click', handleCopyShareURL);
    
    // Share modal - save button
    document.getElementById('save-share-patch-btn')?.addEventListener('click', handleSaveFromShareModal);

    // Help modal trigger
    document.addEventListener('keydown', (e) => {
      if (e.key === '?' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const helpModal = document.getElementById('help-modal');
        if (helpModal) {
          helpModal.classList.remove('hidden');
        }
      }
    });
  }

  /**
   * Set up keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Skip if in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow Escape in inputs
        if (e.key === 'Escape') {
          e.target.blur();
          e.target.value = '';
        }
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          // Focus search (if visible)
          const search = document.querySelector('#saved-search, #theme-search');
          if (search) search.focus();
          break;
          
        case 'Escape':
          e.preventDefault();
          // Exit fullscreen if active
          if (isFullscreenMode) {
            toggleFullscreenMode();
          }
          // Close modals
          document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
            modal.classList.add('hidden');
          });
          break;

        case 'j':
        case 'J':
          e.preventDefault();
          navigateToNextFile();
          break;

        case 'k':
        case 'K':
          e.preventDefault();
          navigateToPreviousFile();
          break;

        case 'u':
        case 'U':
          e.preventDefault();
          setView('unified');
          break;

        case 's':
        case 'S':
          e.preventDefault();
          setView('side-by-side');
          break;

        case 'c':
        case 'C':
          e.preventDefault();
          handleCopyAll();
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreenMode();
          break;

        case 'F11':
          e.preventDefault();
          toggleFullscreenMode();
          break;
      }
    });
  }

  // ============================================
  // Input Handling
  // ============================================

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      loadPatchFromFile(files[0]);
    }
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      loadPatchFromFile(files[0]);
    }
  }

  function handleParsePatch() {
    const textarea = document.getElementById('patch-textarea');
    const patchText = textarea.value.trim();

    if (!patchText) {
      showToast('Please enter patch content', 'error');
      return;
    }

    loadPatchFromText(patchText);
  }

  // ============================================
  // Patch Loading
  // ============================================

  function loadPatchFromFile(file) {
    showLoading();

    const reader = new FileReader();
    reader.onload = (e) => {
      const patchText = e.target.result;
      loadPatchFromText(patchText);
    };
    reader.onerror = () => {
      hideLoading();
      showToast('Failed to read file', 'error');
    };
    reader.readAsText(file);
  }

  function loadPatchFromText(patchText, skipDuplicateCheck = false) {
    showLoading();

    try {
      // Validate patch
      if (!PatchParser.isValidPatch(patchText)) {
        throw new Error('Invalid patch format');
      }

      // Parse patch
      const parsedPatch = PatchParser.parse(patchText);

      // Check if this patch already exists in saved patches (if not already loaded from saved patches)
      if (!currentSavedPatchId && !skipDuplicateCheck) {
        const existingPatch = StorageManager.findPatchByContent(parsedPatch.raw);
        if (existingPatch) {
          // Patch already exists - show options WITHOUT rendering yet
          hideLoading();
          showPatchAlreadySavedPrompt(existingPatch, parsedPatch);
          return;
        }
      }

      // Continue with normal rendering
      currentPatch = parsedPatch;
      currentSelectedFile = null; // Reset selected file for React viewer
      folderStates = {};

      // Show viewer section
      showViewerSection();

      // Render everything
      renderMetadata(parsedPatch.metadata);
      renderStatistics(parsedPatch.stats);
      renderDiff();
      renderFileTree(parsedPatch.files);

      const firstFile = document.querySelector('.file-tree-item')?.dataset.file;
      navigateToFile(URLHandler.getFileFromURL() || firstFile);

      hideLoading();
      showToast('Patch loaded successfully', 'success');
      
      // Update save button state
      updateSaveButtonState();
    } catch (error) {
      hideLoading();
      console.error('Parse error:', error);
      showToast('Failed to parse patch: ' + error.message, 'error');
    }
  }

  function loadPatchFromURL() {
    showLoading();

    try {
      const patchText = URLHandler.getPatchFromURL();
      
      if (!patchText) {
        throw new Error('Failed to decode patch from URL');
      }

      loadPatchFromText(patchText);
    } catch (error) {
      hideLoading();
      console.error('URL load error:', error);
      showToast('Failed to load patch from URL: ' + error.message, 'error');
    }
  }

  function loadSavedPatch(patchId) {
    const patch = StorageManager.loadPatch(patchId);
    
    if (!patch) {
      showToast('Patch not found', 'error');
      return;
    }

    // Mark this as a saved patch
    currentSavedPatchId = patchId;
    
    // Update URL to include saved patch ID
    URLHandler.updateURL({ savedPatchId: patchId });
    
    loadPatchFromText(patch.data);
    closeSavedSidebar();
  }

  function loadSavedPatchById(patchId) {
    const patch = StorageManager.loadPatch(patchId);
    
    if (!patch) {
      showToast('Saved patch not found', 'error');
      showInputSection();
      return;
    }

    // Mark this as a saved patch
    currentSavedPatchId = patchId;
    loadPatchFromText(patch.data);
  }

  // ============================================
  // Rendering
  // ============================================

  function renderMetadata(metadata) {
    const metadataCard = document.getElementById('metadata-card');
    if (!metadataCard) return;

    if (!metadata.commitHash && !metadata.author && !metadata.message) {
      metadataCard.classList.add('hidden');
      return;
    }

    metadataCard.classList.remove('hidden');

    let html = '<div class="metadata-header">';
    html += '<svg class="metadata-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
    html += '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
    html += '</svg>';
    html += '<div class="metadata-content">';

    if (metadata.commitHash) {
      const shortHash = metadata.commitHash.substring(0, 7);
      html += `<div class="commit-hash" title="${metadata.commitHash}">${shortHash}</div>`;
    }

    if (metadata.message) {
      html += `<div class="commit-message">${escapeHtml(metadata.message)}</div>`;
    }

    html += '<div class="commit-meta">';
    
    if (metadata.author) {
      html += '<div class="commit-author">';
      html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
      html += '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>';
      html += '</svg>';
      html += escapeHtml(metadata.author);
      if (metadata.authorEmail) {
        html += ` &lt;${escapeHtml(metadata.authorEmail)}&gt;`;
      }
      html += '</div>';
    }

    if (metadata.date) {
      const relativeTime = PatchParser.formatRelativeTime(metadata.date);
      html += '<div class="commit-date" title="' + metadata.date + '">';
      html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
      html += '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
      html += '</svg>';
      html += relativeTime;
      html += '</div>';
    }

    if (metadata.refs && metadata.refs.length > 0) {
      html += '<div class="commit-refs">';
      metadata.refs.forEach(ref => {
        html += `<span class="ref-badge">${escapeHtml(ref)}</span>`;
      });
      html += '</div>';
    }

    html += '</div></div></div>';

    metadataCard.innerHTML = html;

    // Add hide button and restore collapsed state
    setTimeout(() => {
      if (isMetadataCollapsed) {
        metadataCard.classList.add('collapsed');
        moveMetadataButtonToUtilityBar();
      } else {
        moveMetadataButtonToCard();
      }
    }, 0);
  }

  function renderStatistics(stats) {
    // Update header stats badges
    const headerStats = document.getElementById('header-stats');
    const filesValue = document.getElementById('stat-files-value');
    const additionsValue = document.getElementById('stat-additions-value');
    const deletionsValue = document.getElementById('stat-deletions-value');
    
    if (!headerStats || !filesValue || !additionsValue || !deletionsValue) return;

    // Show header stats
    headerStats.classList.remove('hidden');
    
    // Update values
    filesValue.textContent = stats.filesChanged;
    additionsValue.textContent = stats.additions;
    deletionsValue.textContent = stats.deletions;
  }

  function renderDiff() {
    const diffContainer = document.getElementById('diff-container');
    if (!diffContainer) return;

    // Check if ReactDiffAdapter is available
    console.log('🔍 Checking ReactDiffAdapter:', {
      exists: !!window.ReactDiffAdapter,
      isAvailable: window.ReactDiffAdapter ? window.ReactDiffAdapter.isAvailable() : 'N/A'
    });
    if (!window.ReactDiffAdapter || !window.ReactDiffAdapter.isAvailable()) {
      // Check if React viewer is still loading
      if (window.reactDiffViewerLoading) {
        diffContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
            <p>Loading viewer...</p>
            <p style="font-size: 12px; margin-top: 10px;">Please wait a moment...</p>
          </div>
        `;
        // Wait for it to load and try again
        window.addEventListener('reactDiffViewerLoaded', () => {
          renderDiff();
        }, { once: true });
        return;
      }
      
      console.error('ReactDiffAdapter not available');
      diffContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          <p>The diff viewer is not available</p>
          <p style="font-size: 12px; margin-top: 10px;">Please refresh the page.</p>
        </div>
      `;
      return;
    }

    // If no file is selected, show placeholder
    if (!currentSelectedFile && currentPatch && currentPatch.files) {
      window.ReactDiffAdapter.renderPlaceholder(diffContainer);
      return;
    }

    // Render the selected file
    if (currentSelectedFile) {
      const isDarkMode = ThemeManager.getCurrentMode() === 'dark';
      const language = PatchParser.detectLanguage(currentSelectedFile.newPath || currentSelectedFile.oldPath);
      
      window.ReactDiffAdapter.render(diffContainer, currentSelectedFile, {
        splitView: currentView === 'side-by-side',
        isDarkMode: isDarkMode,
        language: language
      });
    }
  }

  function renderFileTree(files) {
    if (filesViewMode === 'tree') {
      renderFileTreeStructured(files);
    } else {
      renderFileTreeFlat(files);
    }
  }

  function renderFileTreeFlat(files) {
    const sidebar = document.querySelector('.sidebar-content');
    if (!sidebar) return;

    let html = '';

    files.forEach((file, index) => {
      const path = file.newPath !== '/dev/null' ? file.newPath : file.oldPath;
      const filename = path.split('/').pop();
      const fileId = `file-${index}`;

      let iconType = file.type;
      if (iconType === 'modified') iconType = 'modified';
      if (iconType === 'added') iconType = 'added';
      if (iconType === 'deleted') iconType = 'deleted';
      if (iconType === 'renamed') iconType = 'renamed';

      html += `
        <div class="file-tree-item" data-file="${escapeHtml(path)}" data-file-id="${fileId}">
          <svg class="file-icon ${iconType}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${getFileIcon(iconType)}
          </svg>
          <span class="file-name" title="${escapeHtml(path)}">${escapeHtml(filename)}</span>
          <span class="file-stats">
            ${file.additions > 0 ? `<span class="additions">+${file.additions}</span>` : ''}
            ${file.deletions > 0 ? `<span class="deletions">-${file.deletions}</span>` : ''}
          </span>
        </div>
      `;
    });

    sidebar.innerHTML = html;

    // Add click handlers
    sidebar.querySelectorAll('.file-tree-item').forEach(item => {
      item.addEventListener('click', () => {
        const filePath = item.dataset.file;
        navigateToFile(filePath);
      });
    });
  }

  function renderFileTreeStructured(files) {
    const sidebar = document.querySelector('.sidebar-content');
    if (!sidebar) return;

    // Build folder structure
    const tree = buildFolderTree(files);
    
    // Render the tree
    const html = renderTreeNode(tree, 0, '');
    sidebar.innerHTML = html;

    // Add click handlers for folders
    sidebar.querySelectorAll('.file-tree-folder').forEach(folder => {
      folder.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFolder(folder);
      });
    });

    // Add click handlers for files
    sidebar.querySelectorAll('.file-tree-item').forEach(item => {
      item.addEventListener('click', () => {
        const filePath = item.dataset.file;
        navigateToFile(filePath);
      });
    });
  }

  function buildFolderTree(files) {
    const tree = {
      name: '',
      type: 'folder',
      children: {},
      files: []
    };

    files.forEach((file, index) => {
      const path = file.newPath !== '/dev/null' ? file.newPath : file.oldPath;
      const parts = path.split('/');
      
      let currentNode = tree;
      
      // Build folder structure
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        if (!currentNode.children[folderName]) {
          currentNode.children[folderName] = {
            name: folderName,
            type: 'folder',
            path: parts.slice(0, i + 1).join('/'),
            children: {},
            files: []
          };
        }
        currentNode = currentNode.children[folderName];
      }
      
      // Add file to current folder
      currentNode.files.push({
        ...file,
        path: path,
        filename: parts[parts.length - 1],
        index: index
      });
    });

    return tree;
  }

  function renderTreeNode(node, depth, parentPath) {
    let html = '';
    
    // Render folders first
    const folderNames = Object.keys(node.children).sort();
    folderNames.forEach(folderName => {
      const folder = node.children[folderName];
      const folderPath = folder.path;
      const isExpanded = folderStates[folderPath] !== false; // Default to expanded
      
      html += `
        <div class="file-tree-folder ${isExpanded ? 'expanded' : 'collapsed'}" 
             data-folder="${escapeHtml(folderPath)}" 
             data-depth="${depth}"
             style="--depth: ${depth}">
          <svg class="expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="folder-name">${escapeHtml(folderName)}</span>
        </div>
      `;
      
      // Render children (recursively)
      if (isExpanded) {
        html += renderTreeNode(folder, depth + 1, folderPath);
      }
    });
    
    // Render files
    node.files.sort((a, b) => a.filename.localeCompare(b.filename)).forEach(file => {
      const fileId = `file-${file.index}`;
      let iconType = file.type;
      
      html += `
        <div class="file-tree-item" 
             data-file="${escapeHtml(file.path)}" 
             data-file-id="${fileId}"
             data-depth="${depth}"
             data-parent="${escapeHtml(parentPath)}"
             style="--depth: ${depth}">
          <svg class="file-icon ${iconType}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${getFileIcon(iconType)}
          </svg>
          <span class="file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.filename)}</span>
          <span class="file-stats">
            ${file.additions > 0 ? `<span class="additions">+${file.additions}</span>` : ''}
            ${file.deletions > 0 ? `<span class="deletions">-${file.deletions}</span>` : ''}
          </span>
        </div>
      `;
    });
    
    return html;
  }

  function toggleFolder(folderElement) {
    const folderPath = folderElement.dataset.folder;
    const isExpanded = folderElement.classList.contains('expanded');
    
    if (isExpanded) {
      folderElement.classList.remove('expanded');
      folderElement.classList.add('collapsed');
      folderStates[folderPath] = false;
      
      // Hide children
      hideChildrenOfFolder(folderElement, folderPath);
    } else {
      folderElement.classList.remove('collapsed');
      folderElement.classList.add('expanded');
      folderStates[folderPath] = true;
      
      // Show immediate children
      showChildrenOfFolder(folderElement, folderPath);
    }
  }

  function hideChildrenOfFolder(folderElement, folderPath) {
    let nextElement = folderElement.nextElementSibling;
    while (nextElement) {
      const isChild = nextElement.dataset.folder?.startsWith(folderPath + '/') || 
                     nextElement.dataset.file?.startsWith(folderPath + '/');
      
      if (!isChild) break;
      
      nextElement.style.display = 'none';
      nextElement = nextElement.nextElementSibling;
    }
  }

  function showChildrenOfFolder(folderElement, folderPath) {
    let nextElement = folderElement.nextElementSibling;
    const depth = parseInt(folderElement.dataset.depth || '0');
    
    while (nextElement) {
      const nextDepth = parseInt(nextElement.dataset.depth || '0');
      
      // Stop if we've gone past the children
      if (nextDepth <= depth) break;
      
      // Only show immediate children (depth + 1)
      if (nextDepth === depth + 1) {
        nextElement.style.display = '';
        
        // If it's a folder and it's collapsed, skip its children
        if (nextElement.classList.contains('file-tree-folder') && 
            nextElement.classList.contains('collapsed')) {
          const subFolderPath = nextElement.dataset.folder;
          // Skip all children of this collapsed folder
          let skipElement = nextElement.nextElementSibling;
          while (skipElement && (skipElement.dataset.folder?.startsWith(subFolderPath + '/') || 
                                 skipElement.dataset.file?.startsWith(subFolderPath + '/'))) {
            nextElement = skipElement;
            skipElement = skipElement.nextElementSibling;
          }
        }
      }
      
      nextElement = nextElement.nextElementSibling;
    }
  }

  function getFileIcon(type) {
    switch (type) {
      case 'added':
        return '<path d="M12 5v14M5 12h14"></path>';
      case 'deleted':
        return '<path d="M5 12h14"></path>';
      case 'renamed':
        return '<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>';
      case 'modified':
      default:
        return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>';
    }
  }

  // ============================================
  // Navigation
  // ============================================

  function navigateToFile(filePath) {
    // Update active state in sidebar
    document.querySelectorAll('.file-tree-item').forEach(item => {
      item.classList.toggle('active', item.dataset.file === filePath);
    });

    const file = currentPatch?.files.find(f => {
      const path = f.newPath !== '/dev/null' ? f.newPath : f.oldPath;
      return path === filePath;
    });

    if (file) {
      currentSelectedFile = file;
      renderDiff();
    }
  }

  function navigateToNextFile() {
    const items = Array.from(document.querySelectorAll('.file-tree-item'));
    const currentIndex = items.findIndex(item => item.classList.contains('active'));
    
    if (currentIndex < items.length - 1) {
      const nextItem = items[currentIndex + 1];
      nextItem.click();
    }
  }

  function navigateToPreviousFile() {
    const items = Array.from(document.querySelectorAll('.file-tree-item'));
    const currentIndex = items.findIndex(item => item.classList.contains('active'));
    
    if (currentIndex > 0) {
      const prevItem = items[currentIndex - 1];
      prevItem.click();
    }
  }

  // ============================================
  // UI Management
  // ============================================

  function showInputSection() {
    document.getElementById('input-section')?.classList.remove('hidden');
    document.getElementById('viewer-section')?.classList.add('hidden');
    document.getElementById('new-patch-btn')?.classList.add('hidden');
    document.getElementById('share-btn')?.classList.add('hidden');
    document.body?.classList.remove('viewer-mode');
    document.getElementById('header-stats')?.classList.add('hidden');
    URLHandler.clearURL();
    currentPatch = null;
    currentSavedPatchId = null;
    currentSelectedFile = null;
    updateSaveButtonState();
  }

  function showViewerSection() {
    document.getElementById('input-section')?.classList.add('hidden');
    document.getElementById('viewer-section')?.classList.remove('hidden');
    document.getElementById('new-patch-btn')?.classList.remove('hidden');
    document.getElementById('share-btn')?.classList.remove('hidden');

    // Update view button states
    document.getElementById('unified-btn')?.classList.toggle('active', currentView === 'unified');
    document.getElementById('sidebyside-btn')?.classList.toggle('active', currentView === 'side-by-side');
    document.body?.classList.add('viewer-mode');
  }

  function setView(view) {
    currentView = view;
    localStorage.setItem('git-patch-viewer-view', view);

    // Update button states
    document.getElementById('unified-btn')?.classList.toggle('active', view === 'unified');
    document.getElementById('sidebyside-btn')?.classList.toggle('active', view === 'side-by-side');

    // Re-render diff if patch loaded
    if (currentPatch) {
      renderDiff();
    }
  }

  function showLoading() {
    document.getElementById('loading')?.classList.remove('hidden');
  }

  function hideLoading() {
    document.getElementById('loading')?.classList.add('hidden');
  }

  // ============================================
  // Saved Patches
  // ============================================

  function displayRecentPatches() {
    const recentSection = document.getElementById('recent-patches');
    const recentList = document.getElementById('recent-list');
    
    if (!recentList) return;

    const recent = StorageManager.getRecentPatches(6);
    
    // Always show the recent patches section
    recentSection?.classList.remove('hidden');

    if (recent.length === 0) {
      recentList.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-tertiary);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 1rem; opacity: 0.5;">
            <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <p style="font-size: 0.875rem;">No saved patches yet</p>
          <p style="font-size: 0.8125rem; margin-top: 0.5rem;">Load and save a patch to see it here</p>
        </div>
      `;
      return;
    }

    let html = '';
    recent.forEach(patch => {
      html += `
        <div class="recent-item" data-patch-id="${patch.id}">
          <div class="recent-item-name">${escapeHtml(patch.name)}</div>
          <div class="recent-item-stats">
            ${StorageManager.formatPatchDate(patch.date)} • 
            ${patch.stats.filesChanged} files • 
            +${patch.stats.additions} -${patch.stats.deletions}
          </div>
        </div>
      `;
    });

    recentList.innerHTML = html;

    // Add click handlers
    recentList.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        loadSavedPatch(item.dataset.patchId);
      });
    });
  }

  function handleSavedButtonClick(e) {
    if (e) e.stopPropagation(); // Prevent event from bubbling to document
    
    // Check if we have a current patch and if it's saved
    if (currentPatch && !currentSavedPatchId) {
      // Unsaved patch - show modal with options
      showSaveOrViewModal();
    } else {
      // No patch or patch is saved - open sidebar
      toggleSavedSidebar(e);
    }
  }

  function toggleSavedSidebar(e) {
    if (e) e.stopPropagation(); // Prevent event from bubbling to document
    const sidebar = document.getElementById('saved-sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('hidden');
    
    if (!sidebar.classList.contains('hidden')) {
      renderSavedPatches();
    }
  }

  function closeSavedSidebar() {
    document.getElementById('saved-sidebar')?.classList.add('hidden');
  }

  function handleClickOutsideSavedSidebar(e) {
    const sidebar = document.getElementById('saved-sidebar');
    const savedBtn = document.getElementById('saved-btn');
    
    // Check if sidebar is visible
    if (!sidebar || sidebar.classList.contains('hidden')) {
      return;
    }
    
    // Check if click is outside sidebar and not on the button that opens it
    if (!sidebar.contains(e.target) && !savedBtn?.contains(e.target)) {
      closeSavedSidebar();
    }
  }

  function showSaveOrViewModal() {
    const modal = document.getElementById('save-or-view-modal');
    if (!modal) return;

    const saveBtn = document.getElementById('save-patch-from-modal-btn');
    const viewBtn = document.getElementById('view-saved-from-modal-btn');
    const closeBtn = document.getElementById('save-or-view-close-btn');

    if (!saveBtn || !viewBtn || !closeBtn) return;

    // Handler for saving patch
    const handleSave = () => {
      savePatchToStorage();
      modal.classList.add('hidden');
    };

    // Handler for viewing saved patches
    const handleView = (e) => {
      e.stopPropagation(); // Prevent click from bubbling to document
      modal.classList.add('hidden');
      // Open the sidebar after a brief delay to avoid click-outside handler
      setTimeout(() => {
        const sidebar = document.getElementById('saved-sidebar');
        if (sidebar) {
          sidebar.classList.remove('hidden');
          renderSavedPatches();
        }
      }, 50);
    };

    // Handler for closing modal
    const handleClose = () => {
      modal.classList.add('hidden');
    };

    // Remove any existing listeners and add new ones (using once option)
    saveBtn.replaceWith(saveBtn.cloneNode(true));
    viewBtn.replaceWith(viewBtn.cloneNode(true));
    closeBtn.replaceWith(closeBtn.cloneNode(true));

    // Get the new elements after replacing
    const newSaveBtn = document.getElementById('save-patch-from-modal-btn');
    const newViewBtn = document.getElementById('view-saved-from-modal-btn');
    const newCloseBtn = document.getElementById('save-or-view-close-btn');

    // Add event listeners
    newSaveBtn.addEventListener('click', handleSave);
    newViewBtn.addEventListener('click', handleView);
    newCloseBtn.addEventListener('click', handleClose);

    modal.classList.remove('hidden');
  }

  function renderSavedPatches() {
    const savedList = document.getElementById('saved-list');
    if (!savedList) return;

    const patches = StorageManager.getAllPatches();

    if (patches.length === 0) {
      savedList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">No saved patches yet</div>';
      return;
    }

    let html = '';
    patches.forEach(patch => {
      const isCurrentPatch = currentSavedPatchId === patch.id;
      const currentClass = isCurrentPatch ? ' current-patch' : '';
      
      html += `
        <div class="saved-patch-card${currentClass}" data-patch-id="${patch.id}">
          <div class="saved-patch-name">
            ${isCurrentPatch ? '<span class="current-indicator">●</span> ' : ''}${escapeHtml(patch.name)}
          </div>
          <div class="saved-patch-meta">${StorageManager.formatPatchDate(patch.date)}</div>
          <div class="saved-patch-stats">
            ${patch.stats.filesChanged} files • +${patch.stats.additions} -${patch.stats.deletions}
          </div>
          <div class="saved-patch-actions">
            <button class="btn-ghost load-patch-btn">${isCurrentPatch ? 'Viewing' : 'Load'}</button>
            <button class="btn-ghost delete-patch-btn">Delete</button>
          </div>
        </div>
      `;
    });

    savedList.innerHTML = html;

    // Add event listeners
    savedList.querySelectorAll('.load-patch-btn').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.saved-patch-card');
        loadSavedPatch(card.dataset.patchId);
      });
    });

    savedList.querySelectorAll('.delete-patch-btn').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.saved-patch-card');
        if (confirm('Delete this patch?')) {
          const patchId = card.dataset.patchId;
          
          // Check if we're deleting the currently viewed patch
          if (currentSavedPatchId === patchId) {
            // Treat as unsaved patch
            currentSavedPatchId = null;
            updateSaveButtonState();
            // Update URL to remove saved patch ID
            if (currentPatch) {
              URLHandler.updateURL({ patch: currentPatch.raw });
            }
          }
          
          StorageManager.deletePatch(patchId);
          renderSavedPatches();
          updateSavedPatchesCount();
          displayRecentPatches(); // Update homepage recent patches list
          showToast('Patch deleted', 'info');
        }
      });
    });
  }

  function updateSavedPatchesCount() {
    const count = StorageManager.getAllPatches().length;
    const badge = document.getElementById('saved-count');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  // ============================================
  // Save Patch Functions
  // ============================================

  function savePatchToStorage() {
    if (!currentPatch) return;
    
    try {
      const saved = StorageManager.savePatch(currentPatch);
      if (saved) {
        currentSavedPatchId = saved.id;
        
        // Update URL with saved patch ID
        URLHandler.updateURL({ savedPatchId: saved.id });
        
        showToast('Patch saved successfully', 'success');
        updateSavedPatchesCount();
        updateSaveButtonState();
        displayRecentPatches();
      }
    } catch (error) {
      showToast('Failed to save patch: ' + error.message, 'error');
    }
  }

  function showPatchAlreadySavedPrompt(existingPatch, parsedPatch) {
    const modal = document.getElementById('patch-exists-modal');
    if (!modal) return;

    // Show modal
    modal.classList.remove('hidden');

    // Set up event listeners (remove any existing ones first)
    const loadBtn = document.getElementById('load-existing-patch-btn');
    const saveNewBtn = document.getElementById('save-new-copy-btn');
    const closeBtn = document.getElementById('patch-exists-close-btn');

    // Clone and replace to remove old event listeners
    const newLoadBtn = loadBtn.cloneNode(true);
    const newSaveNewBtn = saveNewBtn.cloneNode(true);
    const newCloseBtn = closeBtn.cloneNode(true);
    loadBtn.parentNode.replaceChild(newLoadBtn, loadBtn);
    saveNewBtn.parentNode.replaceChild(newSaveNewBtn, saveNewBtn);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    // Load saved patch
    newLoadBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      // Load the actual saved patch
      loadSavedPatch(existingPatch.id);
    });

    // Save new copy
    newSaveNewBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      // Continue loading the patch as new (skip duplicate check)
      loadPatchFromText(parsedPatch.raw, true);
    });

    // Close and return to home screen
    newCloseBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      showInputSection();
    });

    // NOTE: Backdrop click is intentionally disabled to force user choice
  }

  function updateSaveButtonState() {
    const savedBtn = document.getElementById('saved-btn');
    if (!savedBtn) return;
    
    const svg = savedBtn.querySelector('svg');
    if (!svg) return;
    
    if (currentSavedPatchId) {
      // Patch is already saved - show filled icon
      savedBtn.classList.add('saved');
      svg.setAttribute('fill', 'currentColor');
      savedBtn.setAttribute('title', 'Current patch is saved');
    } else {
      // Patch is not saved - show outline icon
      savedBtn.classList.remove('saved');
      svg.setAttribute('fill', 'none');
      savedBtn.setAttribute('title', currentPatch ? 'Save this patch' : 'View saved patches');
    }
  }

  // ============================================
  // Share Modal
  // ============================================

  function openShareModal() {
    if (!currentPatch) return;

    const modal = document.getElementById('share-modal');
    if (!modal) return;

    try {
      const shareURL = URLHandler.generateShareURL(currentPatch.raw, { includeTheme: false });
      const urlInput = document.getElementById('share-url-input');
      const urlInfo = document.getElementById('url-length-info');

      if (urlInput) {
        urlInput.value = shareURL;
      }

      // Check URL safety
      const safety = URLHandler.checkURLSafety(shareURL);
      if (urlInfo) {
        urlInfo.textContent = safety.message;
        urlInfo.className = 'url-info';
        if (safety.isWarning) urlInfo.classList.add('warning');
        if (safety.isError) urlInfo.classList.add('error');
      }
      
      // Show/hide save button based on URL size
      const saveBtn = document.getElementById('save-share-patch-btn');
      if (saveBtn) {
        if (safety.isError || safety.isWarning) {
          saveBtn.classList.remove('hidden');
        } else {
          saveBtn.classList.add('hidden');
        }
      }

      modal.classList.remove('hidden');
    } catch (error) {
      showToast('Failed to generate share link: ' + error.message, 'error');
    }
  }

  async function handleCopyShareURL() {
    const urlInput = document.getElementById('share-url-input');
    if (!urlInput) return;

    const success = await URLHandler.copyToClipboard(urlInput.value);
    
    if (success) {
      showToast('Link copied to clipboard', 'success');
    } else {
      showToast('Failed to copy link', 'error');
    }
  }

  function handleSaveFromShareModal() {
    if (!currentPatch) return;
    
    try {
      const saved = StorageManager.savePatch(currentPatch);
      if (saved) {
        showToast('Patch saved to localStorage', 'success');
        updateSavedPatchesCount();
        
        // Close the share modal
        const modal = document.getElementById('share-modal');
        if (modal) {
          modal.classList.add('hidden');
        }
      }
    } catch (error) {
      showToast('Failed to save patch: ' + error.message, 'error');
    }
  }

  async function handleCopyAll() {
    if (!currentPatch) return;

    const success = await URLHandler.copyToClipboard(currentPatch.raw);
    
    if (success) {
      showToast('Patch copied to clipboard', 'success');
    } else {
      showToast('Failed to copy patch', 'error');
    }
  }

  // ============================================
  // Toast Notifications
  // ============================================

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = getToastIcon(type);
    
    toast.innerHTML = `
      <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${icon}
      </svg>
      <div class="toast-message">${escapeHtml(message)}</div>
      <button class="toast-close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    container.appendChild(toast);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  function getToastIcon(type) {
    switch (type) {
      case 'success':
        return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
      case 'error':
        return '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
      case 'warning':
        return '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
      case 'info':
      default:
        return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
    }
  }

  // ============================================
  // Utilities
  // ============================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Re-render current diff (useful when mode changes)
   */
  function reRenderDiff() {
    if (currentPatch) {
      renderDiff();
    }
  }

  // ============================================
  // Files Settings and Search
  // ============================================

  function toggleFilesSettings(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('files-settings-dropdown');
    if (!dropdown) return;

    dropdown.classList.toggle('hidden');
  }

  function handleClickOutsideFilesSettings(e) {
    const dropdown = document.getElementById('files-settings-dropdown');
    const settingsBtn = document.getElementById('files-settings-btn');
    
    if (!dropdown || dropdown.classList.contains('hidden')) {
      return;
    }
    
    if (!dropdown.contains(e.target) && !settingsBtn?.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }

  function handleTreeViewToggle(e) {
    filesViewMode = e.target.checked ? 'tree' : 'flat';
    localStorage.setItem('git-patch-viewer-files-view-mode', filesViewMode);
    
    // Re-render the file tree
    if (currentPatch) {
      renderFileTree(currentPatch.files);
    }
  }

  function handleFilesSearch(e) {
    filesSearchQuery = e.target.value.toLowerCase().trim();
    filterFiles();
  }

  function filterFiles() {
    const items = document.querySelectorAll('.file-tree-item, .file-tree-folder');
    
    if (!filesSearchQuery) {
      // Show all items
      items.forEach(item => {
        item.style.display = '';
        item.classList.remove('search-match');
      });
      return;
    }

    items.forEach(item => {
      const fileName = item.dataset.file || item.dataset.folder || '';
      const matches = fileName.toLowerCase().includes(filesSearchQuery);
      
      if (filesViewMode === 'tree') {
        // In tree view, show parent folders if children match
        if (item.classList.contains('file-tree-folder')) {
          // Check if any child matches
          const hasMatchingChild = Array.from(items).some(child => {
            const childPath = child.dataset.file || child.dataset.folder || '';
            return childPath.startsWith(fileName + '/') && 
                   childPath.toLowerCase().includes(filesSearchQuery);
          });
          item.style.display = (matches || hasMatchingChild) ? '' : 'none';
        } else {
          item.style.display = matches ? '' : 'none';
        }
      } else {
        // Flat view: simple show/hide
        item.style.display = matches ? '' : 'none';
      }

      if (matches) {
        item.classList.add('search-match');
      } else {
        item.classList.remove('search-match');
      }
    });
  }

  // ============================================
  // Sidebar Collapse
  // ============================================

  function toggleSidebarCollapse() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('git-patch-viewer-sidebar-collapsed', sidebarCollapsed);
    applySidebarCollapsedState();
  }

  function applySidebarCollapsedState() {
    const sidebar = document.getElementById('file-sidebar');
    if (!sidebar) return;

    if (sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
  }

  function handleSidebarMouseEnter() {
    if (sidebarCollapsed) {
      const sidebar = document.getElementById('file-sidebar');
      if (sidebar) {
        sidebar.classList.add('hovered');
      }
    }
  }

  function handleSidebarMouseLeave() {
    const sidebar = document.getElementById('file-sidebar');
    if (sidebar) {
      sidebar.classList.remove('hovered');
    }
  }

  // ============================================
  // Fullscreen Mode
  // ============================================

  function toggleFullscreenMode() {
    isFullscreenMode = !isFullscreenMode;
    
    const viewerSection = document.getElementById('viewer-section');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const body = document.body;
    
    if (isFullscreenMode) {
      // Enter fullscreen mode
      viewerSection?.classList.add('fullscreen-mode');
      body?.classList.add('fullscreen-active');
      fullscreenBtn?.classList.add('active');
      
      // Update button text
      const btnText = fullscreenBtn?.querySelector('.fullscreen-text');
      if (btnText) btnText.textContent = 'Exit Fullscreen';
      
      // Update button icon to exit fullscreen icon (minimize/compress)
      const btnIcon = fullscreenBtn?.querySelector('svg');
      if (btnIcon) {
        btnIcon.innerHTML = '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
      }
    } else {
      // Exit fullscreen mode
      viewerSection?.classList.remove('fullscreen-mode');
      body?.classList.remove('fullscreen-active');
      fullscreenBtn?.classList.remove('active');
      
      // Update button text
      const btnText = fullscreenBtn?.querySelector('.fullscreen-text');
      if (btnText) btnText.textContent = 'Fullscreen';
      
      // Update button icon to enter fullscreen icon
      const btnIcon = fullscreenBtn?.querySelector('svg');
      if (btnIcon) {
        btnIcon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>';
      }
    }
  }

  // ============================================
  // Metadata Toggle
  // ============================================

  function toggleMetadata() {
    isMetadataCollapsed = !isMetadataCollapsed;
    
    const metadataCard = document.getElementById('metadata-card');
    
    if (isMetadataCollapsed) {
      // Collapse metadata
      metadataCard?.classList.add('collapsed');
      
      // Move button to utility bar
      moveMetadataButtonToUtilityBar();
    } else {
      // Expand metadata
      metadataCard?.classList.remove('collapsed');
      
      // Move button back to metadata card
      moveMetadataButtonToCard();
    }
    
    // Save preference
    localStorage.setItem('git-patch-viewer-metadata-collapsed', isMetadataCollapsed);
  }

  function moveMetadataButtonToUtilityBar() {
    // Remove any existing button
    const existingBtn = document.getElementById('toggle-metadata-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    // Create button for diff-actions section
    const diffActions = document.querySelector('.diff-actions');
    if (!diffActions) return;

    const button = document.createElement('button');
    button.id = 'toggle-metadata-btn';
    button.className = 'btn-ghost';
    button.title = 'Show commit metadata';
    button.textContent = 'Show Metadata';
    button.onclick = toggleMetadata;
    
    // Insert before the first child (Expand All button)
    diffActions.insertBefore(button, diffActions.firstChild);
  }

  function moveMetadataButtonToCard() {
    // Remove button from utility bar
    const container = document.getElementById('metadata-toggle-container');
    if (container) {
      container.remove();
    }

    // Add button to metadata card
    const metadataCard = document.getElementById('metadata-card');
    if (!metadataCard) return;

    const button = document.createElement('button');
    button.id = 'toggle-metadata-btn';
    button.className = 'metadata-hide-btn';
    button.title = 'Hide commit metadata';
    button.textContent = 'Hide';
    button.onclick = toggleMetadata;
    
    metadataCard.appendChild(button);
  }

  // Public API
  return {
    init,
    reRenderDiff,
  };
})();