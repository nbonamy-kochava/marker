<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Left Pane: File Tree -->
    <div class="w-80 flex-shrink-0">
      <FileTree
        :file-tree="fileTree"
        :selected-file="selectedFile"
        :current-folder="currentFolder"
        @open-folder="openFolder"
        @select-file="selectFile"
      />
    </div>

    <!-- Right Pane: Markdown Viewer -->
    <div class="flex-1">
      <MarkdownViewer
        :selected-file="selectedFile"
        :content="fileContent"
        :is-loading="isLoading"
        :error="error"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FileTree from './components/FileTree.vue'
import MarkdownViewer from './components/MarkdownViewer.vue'
import { useFileSystem } from './composables/useFileSystem'

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
</script>
