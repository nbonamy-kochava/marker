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
    <div class="flex-1 overflow-hidden" style="min-width: 200px">
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
    <div
      class="relative"
      :style="{ flexBasis: terminalCollapsed ? '32px' : `${terminalWidth}px`, flexShrink: 0 }"
    >
      <Terminal ref="terminalRef" v-show="!terminalCollapsed" />

      <!-- Collapsed State -->
      <div v-show="terminalCollapsed" class="h-full bg-gray-800 flex flex-col items-center py-4 border-l border-gray-700">
        <button
          @click="terminalCollapsed = false"
          class="absolute top-2 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors mb-4"
          title="Expand Terminal"
        >
          ◀
        </button>
        <div class="py-4 text-gray-500 text-xs transform -rotate-90 whitespace-nowrap mt-8">Terminal</div>
      </div>

      <!-- Collapse Button (when expanded) -->
      <button
        v-show="!terminalCollapsed"
        @click="terminalCollapsed = true"
        class="absolute top-2 right-2 z-10 px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors shadow-lg"
        title="Collapse Terminal"
      >
        ▶
      </button>
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
const terminalCollapsed = ref(false)
const terminalWidth = ref(600) // Store in pixels
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
    // Send full file path to terminal (Claude will see it in prompt)
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
    const maxWidth = containerRect.width - minWidth - 8 // 8px for handles
    fileTreeWidth.value = Math.max(minWidth, Math.min(newWidth, maxWidth))
  } else if (activeHandle === 2) {
    // Resizing terminal (from the right edge)
    if (terminalCollapsed.value) return // Don't resize when collapsed

    const distanceFromRight = containerRect.right - event.clientX
    const maxWidth = containerRect.width - fileTreeWidth.value - minWidth - 14 // 14px for handles
    terminalWidth.value = Math.max(minWidth, Math.min(distanceFromRight, maxWidth))
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
