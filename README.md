# Marker - Markdown File Browser

A modern, cross-platform desktop application for browsing and viewing markdown files, built with Electron and Vue 3.

## Features

- 📁 **File Tree Navigation**: Browse markdown files in a hierarchical folder structure
- 📝 **Markdown Rendering**: Beautiful HTML rendering of markdown files with syntax highlighting
- 💾 **Persistent State**: Automatically remembers the last opened folder
- 🎨 **Modern UI**: Clean, responsive interface built with Tailwind CSS
- ⚡ **Fast**: Powered by Vite for lightning-fast development and build times
- 🔒 **Secure**: Context isolation and secure IPC communication

## Technology Stack

- **Electron**: Cross-platform desktop application framework
- **Vue 3**: Progressive JavaScript framework with Composition API
- **TypeScript**: Type-safe development
- **Vite**: Next-generation build tool
- **Tailwind CSS**: Utility-first CSS framework
- **markdown-it**: Markdown parser with plugin support
- **highlight.js**: Syntax highlighting for code blocks

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd marker
```

2. Install dependencies:
```bash
npm install
```

### Development

Run the application in development mode:
```bash
npm run dev
```

This will:
- Start the Vite dev server for the renderer process
- Build the main and preload processes
- Launch the Electron application
- Enable hot module replacement for Vue components

### Building

Build the application for production:
```bash
npm run build
```

This will create optimized bundles in the `out/` directory.

### Type Checking

Run TypeScript type checking:
```bash
npm run typecheck
```

## Project Structure

```
marker/
├── src/
│   ├── main/                 # Electron main process
│   │   └── index.ts          # Main entry, window creation, IPC handlers
│   ├── preload/              # Preload scripts
│   │   ├── index.ts          # Secure IPC bridge
│   │   └── index.d.ts        # TypeScript definitions
│   └── renderer/             # Vue 3 application
│       ├── components/       # Vue components
│       │   ├── FileTree.vue  # Left pane: file hierarchy
│       │   ├── TreeNode.vue  # Recursive tree node component
│       │   └── MarkdownViewer.vue # Right pane: markdown viewer
│       ├── composables/      # Vue composables
│       │   └── useFileSystem.ts # File system state management
│       ├── App.vue           # Root component
│       ├── main.ts           # Vue app entry point
│       ├── style.css         # Global styles with Tailwind
│       └── index.html        # HTML template
├── electron.vite.config.ts   # Electron-Vite configuration
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
└── package.json              # Project dependencies and scripts
```

## Usage

1. **Open a Folder**: Click the "Open Folder" button to select a directory containing markdown files
2. **Browse Files**: Navigate through the folder hierarchy in the left pane
3. **View Files**: Click on any `.md` or `.markdown` file to view its rendered content in the right pane
4. **Expand/Collapse Folders**: Click on folder names to expand or collapse them

## Features in Detail

### File Tree (Left Pane)
- Recursive folder navigation
- Only displays `.md` and `.markdown` files
- Directories are sorted before files
- Visual indicators for selected files
- Remembers last opened folder

### Markdown Viewer (Right Pane)
- Renders markdown to HTML using markdown-it
- Syntax highlighting for code blocks using highlight.js
- Displays plain text for non-markdown files
- Shows file path and name in header
- Empty state when no file is selected

### Keyboard & Mouse
- Click to select files
- Click to expand/collapse folders
- Smooth scrolling in both panes

## Security

The application follows Electron security best practices:
- Context isolation enabled
- Node integration disabled
- Secure IPC communication via contextBridge
- No direct file system access from renderer process

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
