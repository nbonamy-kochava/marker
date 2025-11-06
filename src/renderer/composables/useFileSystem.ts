import { ref, onMounted } from 'vue'
import type { FileNode } from '../../preload/index'

export function useFileSystem() {
  const currentFolder = ref<string | null>(null)
  const fileTree = ref<FileNode[]>([])
  const selectedFile = ref<string | null>(null)
  const fileContent = ref<string>('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function openFolder() {
    try {
      isLoading.value = true
      error.value = null
      const folderPath = await window.electronAPI.openFolder()

      if (folderPath) {
        currentFolder.value = folderPath
        await loadFileTree(folderPath)
      }
    } catch (err) {
      error.value = `Failed to open folder: ${err}`
      console.error(err)
    } finally {
      isLoading.value = false
    }
  }

  async function loadFileTree(path: string) {
    try {
      isLoading.value = true
      error.value = null
      fileTree.value = await window.electronAPI.readDirectory(path)
    } catch (err) {
      error.value = `Failed to load file tree: ${err}`
      console.error(err)
    } finally {
      isLoading.value = false
    }
  }

  async function selectFile(path: string) {
    try {
      isLoading.value = true
      error.value = null
      selectedFile.value = path
      fileContent.value = await window.electronAPI.readFile(path)
    } catch (err) {
      error.value = `Failed to read file: ${err}`
      console.error(err)
    } finally {
      isLoading.value = false
    }
  }

  async function loadLastFolder() {
    try {
      const lastFolder = await window.electronAPI.getLastFolder()
      if (lastFolder) {
        currentFolder.value = lastFolder
        await loadFileTree(lastFolder)
      }
    } catch (err) {
      console.error('Failed to load last folder:', err)
    }
  }

  onMounted(() => {
    loadLastFolder()
  })

  return {
    currentFolder,
    fileTree,
    selectedFile,
    fileContent,
    isLoading,
    error,
    openFolder,
    selectFile
  }
}
