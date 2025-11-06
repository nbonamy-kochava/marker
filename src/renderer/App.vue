<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Left Pane: File Tree -->
    <div :style="{ width: fileTreeWidth + 'px' }" class="overflow-hidden" style="min-width: 200px">
      <FileTree
        :file-tree="fileTree"
        :selected-file="selectedFile"
        :current-folder="currentFolder"
        @open-folder="openFolder"
        @select-file="selectFile"
      />
    </div>

    <!-- Resize Handle 1 -->
    <div
      class="cursor-col-resize hover:bg-gray-100 border-l border-gray-300"
      style="width: 7px"
      @mousedown="startResize1"
    ></div>

    <!-- Middle Pane: Markdown Viewer -->
    <div :style="{ width: markdownWidth + 'px' }" class="overflow-hidden" style="min-width: 200px">
      <MarkdownViewer
        :selected-file="selectedFile"
        :content="fileContent"
        :is-loading="isLoading"
        :error="error"
      />
    </div>

    <!-- Resize Handle 2 -->
    <div
      class="cursor-col-resize hover:bg-gray-100 border-r border-gray-300"
      style="width: 7px"
      @mousedown="startResize2"
    ></div>

    <!-- Right Pane: Terminal -->
    <div class="flex-1 overflow-hidden" style="min-width: 200px">
      <Terminal ref="terminalRef" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import FileTree from './components/FileTree.vue'
import MarkdownViewer from './components/MarkdownViewer.vue'
import Terminal from './components/Terminal.vue'
import { useFileSystem } from './composables/useFileSystem'

const terminalRef = ref<InstanceType<typeof Terminal> | null>(null)
const fileTreeWidth = ref(320)
const markdownWidth = ref(600)
let activeHandle: 1 | 2 | null = null

const {
  currentFolder,
  fileTree,
  selectedFile,
  fileContent,
  isLoading,
  error,
  openFolder,
  selectFile
} = useFileSystem()

// Watch for file selection to inform Claude
watch(selectedFile, (newFile) => {
  if (newFile && terminalRef.value) {
    // Send full file path to terminal (Claude will see it if running)
    terminalRef.value.sendCommand(`# Currently viewing: ${newFile}`)
  }
})

// Watch for folder change and auto-cd + launch claude
watch(currentFolder, (newFolder) => {
  console.log('currentFolder changed:', newFolder)
  console.log('terminalRef.value:', terminalRef.value)

  if (!newFolder) {
    console.log('No folder selected')
    return
  }

  if (!terminalRef.value) {
    console.log('Terminal ref is null, waiting...')
    // Wait for terminal to be ready
    setTimeout(() => {
      if (terminalRef.value && newFolder === currentFolder.value) {
        console.log('Terminal ready, sending command for folder:', newFolder)
        terminalRef.value.sendCommand(`cd "${newFolder}" && claude --permission-mode acceptEdits`)
      }
    }, 500)
    return
  }

  // CD to folder and launch claude with acceptEdits permission mode
  console.log('Sending command immediately for folder:', newFolder)
  terminalRef.value.sendCommand(`cd "${newFolder}" && claude --permission-mode acceptEdits`)
})

function startResize1(event: MouseEvent) {
  activeHandle = 1
  event.preventDefault()
}

function startResize2(event: MouseEvent) {
  activeHandle = 2
  event.preventDefault()
}

function handleMouseMove(event: MouseEvent) {
  if (!activeHandle) return

  const container = document.querySelector('.flex.h-screen')
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const minWidth = 200

  if (activeHandle === 1) {
    // Resizing file tree
    const newWidth = event.clientX - containerRect.left
    const maxWidth = containerRect.width - markdownWidth.value - minWidth - 8 // 8px for handles
    fileTreeWidth.value = Math.max(minWidth, Math.min(newWidth, maxWidth))
  } else if (activeHandle === 2) {
    // Resizing markdown viewer
    const newWidth = event.clientX - containerRect.left - fileTreeWidth.value - 4 // 4px for first handle
    const maxWidth = containerRect.width - fileTreeWidth.value - minWidth - 8 // 8px for handles
    markdownWidth.value = Math.max(minWidth, Math.min(newWidth, maxWidth))
  }
}

function stopResize() {
  activeHandle = null
}

onMounted(() => {
  // Initialize widths
  const container = document.querySelector('.flex.h-screen')
  if (container) {
    const containerRect = container.getBoundingClientRect()
    const totalWidth = containerRect.width
    fileTreeWidth.value = Math.floor(totalWidth * 0.2) // 20% for file tree
    markdownWidth.value = Math.floor(totalWidth * 0.4) // 40% for markdown
    // Remaining ~40% goes to terminal (flex-1)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>
