<template>
  <div class="flex flex-col h-full border-t border-gray-300 bg-white">
    <!-- Header -->
    <div class="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
      Git Status
    </div>

    <!-- Modified Files List -->
    <div class="flex-1 overflow-auto px-2 py-2">
      <div v-if="isLoading" class="text-xs text-gray-500 px-2">
        Loading...
      </div>
      <div v-else-if="modifiedFiles.length === 0" class="text-xs text-gray-500 px-2">
        No changes
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="file in modifiedFiles"
          :key="file.path"
          class="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-gray-100"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" :class="getStatusColor(file.status)"></span>
          <span class="flex-1 truncate text-gray-700" :title="file.path">{{ file.path }}</span>
        </div>
      </div>
    </div>

    <!-- Commit Section -->
    <div class="px-3 py-2 border-t border-gray-200 space-y-2">
      <input
        v-model="commitMessage"
        type="text"
        placeholder="Commit message..."
        class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        @keydown.enter="handleCommitAndPush"
      />
      <button
        @click="handleCommitAndPush"
        :disabled="!commitMessage.trim() || isWorking"
        class="w-full px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ isWorking ? 'Working...' : 'Commit & Push' }}
      </button>
      <div v-if="errorMessage" class="text-xs text-red-600">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="text-xs text-green-600">
        {{ successMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  currentFolder: string | null
}>()

const modifiedFiles = ref<Array<{ path: string; status: string }>>([])
const commitMessage = ref('')
const isLoading = ref(false)
const isWorking = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

function getStatusColor(status: string): string {
  switch (status) {
    case 'modified': return 'bg-yellow-500'
    case 'added': return 'bg-green-500'
    case 'deleted': return 'bg-red-500'
    case 'untracked': return 'bg-blue-500'
    default: return 'bg-gray-500'
  }
}

async function loadGitStatus() {
  if (!props.currentFolder) {
    modifiedFiles.value = []
    return
  }

  // Check if electronAPI is available
  if (!window.electronAPI?.git?.getStatus) {
    console.warn('Git API not available')
    modifiedFiles.value = []
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  try {
    modifiedFiles.value = await window.electronAPI.git.getStatus(props.currentFolder)
  } catch (error) {
    console.error('Failed to load git status:', error)
    modifiedFiles.value = []
  } finally {
    isLoading.value = false
  }
}

async function handleCommitAndPush() {
  if (!props.currentFolder || !commitMessage.value.trim()) return

  isWorking.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Commit
    const commitResult = await window.electronAPI.git.commit(props.currentFolder, commitMessage.value)
    if (!commitResult.success) {
      errorMessage.value = commitResult.error || 'Commit failed'
      return
    }

    // Push
    const pushResult = await window.electronAPI.git.push(props.currentFolder)
    if (!pushResult.success) {
      errorMessage.value = pushResult.error || 'Push failed'
      return
    }

    // Success
    successMessage.value = 'Committed and pushed successfully!'
    commitMessage.value = ''
    await loadGitStatus()
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (error: any) {
    errorMessage.value = error.message || 'Operation failed'
  } finally {
    isWorking.value = false
  }
}

// Watch for folder changes
watch(() => props.currentFolder, () => {
  loadGitStatus()
}, { immediate: true })

// Listen for folder changed events to refresh git status
if (window.electronAPI?.onFolderChanged) {
  window.electronAPI.onFolderChanged(() => {
    loadGitStatus()
  })
}
</script>
