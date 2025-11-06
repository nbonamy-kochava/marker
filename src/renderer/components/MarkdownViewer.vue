<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Header with Mode Switcher -->
    <div v-if="selectedFile" class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
      <div class="flex-1 min-w-0">
        <h2 class="text-lg font-semibold text-gray-800 truncate" :title="selectedFile">
          {{ fileName }}
          <span v-if="editorState.isDirty(selectedFile)" class="text-yellow-600 ml-2">●</span>
        </h2>
        <p class="text-xs text-gray-500 truncate mt-1" :title="selectedFile">
          {{ selectedFile }}
        </p>
      </div>

      <!-- Mode Switcher -->
      <div v-if="isMarkdownFile" class="flex items-center gap-2 ml-4">
        <div class="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            @click="viewMode = 'view'"
            :class="viewMode === 'view' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'"
            class="px-3 py-1 text-xs font-medium transition-colors"
          >
            View
          </button>
          <button
            @click="viewMode = 'edit'"
            :class="viewMode === 'edit' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'"
            class="px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300"
          >
            Edit
          </button>
          <button
            @click="viewMode = 'split'"
            :class="viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'"
            class="px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300"
          >
            Split
          </button>
        </div>
        <span v-if="editorState.isSaving.value" class="text-xs text-gray-500">Saving...</span>
        <span v-else-if="editorState.saveError.value" class="text-xs text-red-600">Error saving</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex">
      <!-- Empty State -->
      <div v-if="!selectedFile" class="flex items-center justify-center w-full text-gray-400">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-lg">Select a markdown file to view</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="isLoading" class="flex items-center justify-center w-full">
        <div class="text-gray-500">Loading...</div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-6 w-full">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {{ error }}
        </div>
      </div>

      <!-- View Mode -->
      <template v-else-if="isMarkdownFile">
        <!-- View Only -->
        <div v-if="viewMode === 'view'" ref="previewContainer" class="flex-1 overflow-auto">
          <div class="markdown-body p-6" v-html="renderedMarkdown"></div>
        </div>

        <!-- Edit Only -->
        <div v-else-if="viewMode === 'edit'" class="flex-1 flex flex-col overflow-hidden">
          <MarkdownToolbar
            @bold="handleBold"
            @italic="handleItalic"
            @code="handleCode"
            @link="handleLink"
            @image="handleImage"
            @heading="handleHeading"
            @list="handleList"
            @quote="handleQuote"
          />
          <MarkdownEditor
            ref="editorRef"
            :content="editorState.currentContent.value"
            :file-path="selectedFile"
            @update="handleContentUpdate"
            @scroll="handleEditorScroll"
          />
        </div>

        <!-- Split View -->
        <template v-else-if="viewMode === 'split'">
          <div class="flex-1 flex flex-col overflow-hidden border-r border-gray-200">
            <MarkdownToolbar
              @bold="handleBold"
              @italic="handleItalic"
              @code="handleCode"
              @link="handleLink"
              @image="handleImage"
              @heading="handleHeading"
              @list="handleList"
              @quote="handleQuote"
            />
            <MarkdownEditor
              ref="editorRef"
              :content="editorState.currentContent.value"
              :file-path="selectedFile"
              @update="handleContentUpdate"
              @scroll="handleEditorScroll"
            />
          </div>
          <div ref="previewContainer" class="flex-1 overflow-auto">
            <div class="markdown-body p-6" v-html="renderedMarkdown"></div>
          </div>
        </template>
      </template>

      <!-- Plain Text Content -->
      <pre v-else class="p-6 text-sm text-gray-800 whitespace-pre-wrap font-mono flex-1 overflow-auto">{{ content }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import MarkdownEditor from './MarkdownEditor.vue'
import MarkdownToolbar from './MarkdownToolbar.vue'
import { useEditorState } from '../composables/useEditorState'
import 'highlight.js/styles/github.css'
import 'github-markdown-css/github-markdown-light.css'

const props = defineProps<{
  selectedFile: string | null
  content: string
  isLoading: boolean
  error: string | null
}>()

const viewMode = ref<'view' | 'edit' | 'split'>('view')
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const previewContainer = ref<HTMLElement | null>(null)
const editorState = useEditorState()

let saveTimeout: NodeJS.Timeout | null = null
let isScrollingSyncEnabled = true

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return '<pre class="hljs"><code>' + hljs.highlight(str, { language: lang, ignoreIllegals: true }).value + '</code></pre>'
      } else {
        return '<pre class="hljs"><code>' + hljs.highlightAuto(str).value + '</code></pre>'
      }
    } catch (err) {
      console.error('Highlight error:', err)
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
  }
})

const fileName = computed(() => {
  if (!props.selectedFile) return ''
  return props.selectedFile.split('/').pop() || ''
})

const isMarkdownFile = computed(() => {
  if (!props.selectedFile) return false
  return props.selectedFile.endsWith('.md') || props.selectedFile.endsWith('.markdown')
})

const renderedMarkdown = computed(() => {
  if (!isMarkdownFile.value) return ''
  return md.render(editorState.currentContent.value || props.content)
})

// Watch for file changes
watch(() => props.selectedFile, (newFile) => {
  if (newFile && props.content) {
    editorState.loadFile(newFile, props.content)
  }
})

watch(() => props.content, (newContent) => {
  if (props.selectedFile && newContent) {
    editorState.loadFile(props.selectedFile, newContent)
  }
})

// Handle content updates from editor
function handleContentUpdate(newContent: string) {
  if (!props.selectedFile) return

  editorState.updateContent(props.selectedFile, newContent)

  // Debounced auto-save
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    if (props.selectedFile) {
      editorState.saveFile(props.selectedFile)
    }
  }, 500)
}

// Toolbar actions
function handleBold() {
  editorRef.value?.insertText('bold text', '**', '**')
}

function handleItalic() {
  editorRef.value?.insertText('italic text', '*', '*')
}

function handleCode() {
  editorRef.value?.insertText('code', '`', '`')
}

function handleLink() {
  editorRef.value?.insertText('link text', '[', '](url)')
}

function handleImage() {
  editorRef.value?.insertText('alt text', '![', '](image-url)')
}

function handleHeading() {
  editorRef.value?.insertText('Heading', '## ', '')
}

function handleList() {
  editorRef.value?.insertText('List item', '- ', '')
}

function handleQuote() {
  editorRef.value?.insertText('Quote', '> ', '')
}

// Synchronized scrolling
function handleEditorScroll(percentage: number) {
  if (!isScrollingSyncEnabled || viewMode.value !== 'split' || !previewContainer.value) return

  isScrollingSyncEnabled = false
  const { scrollHeight, clientHeight } = previewContainer.value
  previewContainer.value.scrollTop = percentage * (scrollHeight - clientHeight)

  setTimeout(() => {
    isScrollingSyncEnabled = true
  }, 100)
}

function handlePreviewScroll() {
  if (!isScrollingSyncEnabled || viewMode.value !== 'split' || !previewContainer.value || !editorRef.value) return

  const { scrollTop, scrollHeight, clientHeight } = previewContainer.value
  const percentage = scrollTop / (scrollHeight - clientHeight) || 0

  isScrollingSyncEnabled = false
  editorRef.value.scrollToPercentage(percentage)

  setTimeout(() => {
    isScrollingSyncEnabled = true
  }, 100)
}

// Set up preview scroll listener
watch(previewContainer, (container) => {
  if (container) {
    container.addEventListener('scroll', handlePreviewScroll)
  }
})
</script>
