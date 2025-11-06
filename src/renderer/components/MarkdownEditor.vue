<template>
  <div class="h-full flex flex-col bg-white">
    <div ref="editorContainer" class="flex-1 overflow-auto"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { history, historyKeymap, undo, redo } from '@codemirror/commands'
import { defaultKeymap } from '@codemirror/commands'

const props = defineProps<{
  content: string
  filePath: string | null
}>()

const emit = defineEmits<{
  update: [content: string]
  scroll: [percentage: number]
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

function createEditorState(content: string) {
  return EditorState.create({
    doc: content,
    extensions: [
      markdown(),
      oneDark,
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update', update.state.doc.toString())
        }
      }),
      EditorView.domEventHandlers({
        scroll: (event, view) => {
          const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM
          const percentage = scrollTop / (scrollHeight - clientHeight) || 0
          emit('scroll', percentage)
        }
      })
    ]
  })
}

onMounted(() => {
  if (!editorContainer.value) return

  editorView = new EditorView({
    state: createEditorState(props.content),
    parent: editorContainer.value
  })
})

onUnmounted(() => {
  editorView?.destroy()
})

// Watch for content changes from outside (e.g., file switch)
watch(() => props.content, (newContent) => {
  if (!editorView) return

  const currentContent = editorView.state.doc.toString()
  if (currentContent !== newContent) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: newContent
      }
    })
  }
})

// Expose methods for toolbar actions
function insertText(text: string, before = '', after = '') {
  if (!editorView) return

  const selection = editorView.state.selection.main
  const selectedText = editorView.state.doc.sliceString(selection.from, selection.to)

  editorView.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: before + (selectedText || text) + after
    },
    selection: {
      anchor: selection.from + before.length + (selectedText || text).length + after.length
    }
  })

  editorView.focus()
}

function scrollToPercentage(percentage: number) {
  if (!editorView) return
  const { scrollHeight, clientHeight } = editorView.scrollDOM
  const scrollTop = percentage * (scrollHeight - clientHeight)
  editorView.scrollDOM.scrollTop = scrollTop
}

defineExpose({
  insertText,
  scrollToPercentage,
  undo: () => undo(editorView!),
  redo: () => redo(editorView!)
})
</script>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
  font-size: 14px;
}

:deep(.cm-scroller) {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  padding-bottom: 200px;
}
</style>
