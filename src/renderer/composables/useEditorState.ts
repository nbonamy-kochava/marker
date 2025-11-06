import { ref } from 'vue'

interface EditorState {
  content: string
  savedContent: string
  isDirty: boolean
}

// Global state for all open files
const fileStates = new Map<string, EditorState>()

export function useEditorState() {
  const currentFilePath = ref<string | null>(null)
  const currentContent = ref('')
  const isSaving = ref(false)
  const saveError = ref<string | null>(null)

  function getOrCreateState(filePath: string): EditorState {
    if (!fileStates.has(filePath)) {
      fileStates.set(filePath, {
        content: '',
        savedContent: '',
        isDirty: false
      })
    }
    return fileStates.get(filePath)!
  }

  function loadFile(filePath: string, content: string) {
    const state = getOrCreateState(filePath)
    state.content = content
    state.savedContent = content
    state.isDirty = false

    currentFilePath.value = filePath
    currentContent.value = content
  }

  function updateContent(filePath: string, content: string) {
    const state = getOrCreateState(filePath)
    state.content = content
    state.isDirty = content !== state.savedContent

    if (currentFilePath.value === filePath) {
      currentContent.value = content
    }
  }

  async function saveFile(filePath: string): Promise<boolean> {
    const state = getOrCreateState(filePath)

    if (!state.isDirty) {
      return true // Nothing to save
    }

    isSaving.value = true
    saveError.value = null

    try {
      const result = await window.electronAPI.writeFile(filePath, state.content)

      if (result.success) {
        state.savedContent = state.content
        state.isDirty = false
        return true
      } else {
        saveError.value = result.error || 'Failed to save file'
        return false
      }
    } catch (error: any) {
      saveError.value = error.message || 'Failed to save file'
      return false
    } finally {
      isSaving.value = false
    }
  }

  function isDirty(filePath: string): boolean {
    const state = fileStates.get(filePath)
    return state?.isDirty || false
  }

  return {
    currentFilePath,
    currentContent,
    isSaving,
    saveError,
    loadFile,
    updateContent,
    saveFile,
    isDirty
  }
}
