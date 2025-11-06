<template>
  <div class="flex flex-col h-full bg-gray-50 border-r border-gray-200">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 bg-white">
      <button
        @click="$emit('openFolder')"
        class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        Open Folder
      </button>
    </div>

    <!-- Folder Path -->
    <div v-if="currentFolder" class="px-4 py-2 text-xs text-gray-600 border-b border-gray-200 bg-white truncate" :title="currentFolder">
      {{ currentFolder }}
    </div>

    <!-- File Tree -->
    <div class="flex-1 overflow-auto p-2">
      <TreeNode
        v-for="node in fileTree"
        :key="node.path"
        :node="node"
        :selected-file="selectedFile"
        @select="$emit('selectFile', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import TreeNode from './TreeNode.vue'
import type { FileNode } from '../../preload/index'

defineProps<{
  fileTree: FileNode[]
  selectedFile: string | null
  currentFolder: string | null
}>()

defineEmits<{
  openFolder: []
  selectFile: [path: string]
}>()
</script>
