# Git Diff & Patch Viewer

A client-side git patch and diff viewer with word-level highlights and theming. View, share, and manage git patches entirely in your browser with no backend required.

**Live:** https://viaxco.github.io/git-patch-viewer/

Forked from [sevsunday/git-patch-viewer](https://github.com/sevsunday/git-patch-viewer).

**Key Features:**
- 20 themes with independent dark/light modes
- Unified and side-by-side views with word-level highlights and wrapped lines
- Local storage for saving and managing patches
- Shareable URLs with compressed patch data
- Multiple input methods: drag-drop, file browser, paste, or URL
- Git metadata extraction (commit info, author, date)
- File tree navigation with search and filtering

## Technology Stack

### Dependencies
- **[diff2html](https://github.com/rtfpessoa/diff2html)** - Patch parsing
- **[React 18](https://github.com/facebook/react)** + **[react-diff-viewer](https://github.com/praneshr/react-diff-viewer)** - Diff viewer
- **[pako](https://github.com/nodeca/pako)** - Gzip compression for URLs
- **[lz-string](https://github.com/pieroxy/lz-string)** - Additional compression

### Custom Modules
- **Theme Manager** - 20+ themes from tweakcn.com
- **Patch Parser** - Git metadata extraction and diff parsing
- **Storage Manager** - localStorage-based patch management
- **URL Handler** - Compression, encoding, and shareable link generation

### Generating a Diff File
Use: `git diff [commit_a] [commit_b] > changes.patch`

