<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Header -->
    <div v-if="selectedFile" class="px-6 py-4 border-b border-gray-200 bg-gray-50">
      <h2 class="text-lg font-semibold text-gray-800 truncate" :title="selectedFile">
        {{ fileName }}
      </h2>
      <p class="text-xs text-gray-500 truncate mt-1" :title="selectedFile">
        {{ selectedFile }}
      </p>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto">
      <!-- Empty State -->
      <div v-if="!selectedFile" class="flex items-center justify-center h-full text-gray-400">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-lg">Select a markdown file to view</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="isLoading" class="flex items-center justify-center h-full">
        <div class="text-gray-500">Loading...</div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-6">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {{ error }}
        </div>
      </div>

      <!-- Markdown Content -->
      <div v-else-if="isMarkdownFile" class="markdown-body p-6" v-html="renderedMarkdown"></div>

      <!-- Plain Text Content -->
      <pre v-else class="p-6 text-sm text-gray-800 whitespace-pre-wrap font-mono">{{ content }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import 'github-markdown-css/github-markdown-light.css'

const props = defineProps<{
  selectedFile: string | null
  content: string
  isLoading: boolean
  error: string | null
}>()

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
  return md.render(props.content)
})
</script>
