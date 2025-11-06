<template>
  <div class="select-none">
    <!-- Directory -->
    <div
      v-if="node.isDirectory"
      class="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 cursor-pointer text-sm"
      @click="toggle"
    >
      <span class="text-gray-500 w-4">{{ isExpanded ? '▼' : '▶' }}</span>
      <span class="text-gray-700">📁 {{ node.name }}</span>
    </div>

    <!-- File -->
    <div
      v-else
      class="flex items-center gap-1 px-2 py-1 pl-6 rounded cursor-pointer text-sm transition-colors"
      :class="isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-200 text-gray-700'"
      @click="$emit('select', node.path)"
    >
      <span class="flex-1">📄 {{ node.name }}</span>
      <span v-if="node.gitStatus" class="w-2 h-2 rounded-full flex-shrink-0" :class="gitStatusClass"></span>
    </div>

    <!-- Children (recursive) -->
    <div v-if="node.isDirectory && isExpanded && node.children" class="pl-4">
      <TreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :selected-file="selectedFile"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FileNode } from '../../preload/index'

const props = defineProps<{
  node: FileNode
  selectedFile: string | null
}>()

defineEmits<{
  select: [path: string]
}>()

const isExpanded = ref(false)

const isSelected = computed(() => props.selectedFile === props.node.path)

const gitStatusClass = computed(() => {
  switch (props.node.gitStatus) {
    case 'modified': return 'bg-yellow-500'
    case 'added': return 'bg-green-500'
    case 'deleted': return 'bg-red-500'
    case 'untracked': return 'bg-blue-500'
    default: return ''
  }
})

function toggle() {
  isExpanded.value = !isExpanded.value
}
</script>
