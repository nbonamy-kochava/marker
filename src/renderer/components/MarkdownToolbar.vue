<template>
  <div class="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
    <button
      v-for="tool in tools"
      :key="tool.name"
      @click="tool.action"
      :title="tool.tooltip"
      class="px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded transition-colors"
    >
      {{ tool.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  bold: []
  italic: []
  code: []
  link: []
  image: []
  heading: []
  list: []
  quote: []
}>()

const tools = [
  {
    name: 'bold',
    label: 'B',
    tooltip: 'Bold (Cmd/Ctrl+B)',
    action: () => emit('bold')
  },
  {
    name: 'italic',
    label: 'I',
    tooltip: 'Italic (Cmd/Ctrl+I)',
    action: () => emit('italic')
  },
  {
    name: 'code',
    label: '<>',
    tooltip: 'Inline Code',
    action: () => emit('code')
  },
  {
    name: 'link',
    label: 'Link',
    tooltip: 'Insert Link',
    action: () => emit('link')
  },
  {
    name: 'image',
    label: 'Image',
    tooltip: 'Insert Image',
    action: () => emit('image')
  },
  {
    name: 'heading',
    label: 'H',
    tooltip: 'Heading',
    action: () => emit('heading')
  },
  {
    name: 'list',
    label: 'List',
    tooltip: 'Bullet List',
    action: () => emit('list')
  },
  {
    name: 'quote',
    label: '>',
    tooltip: 'Quote',
    action: () => emit('quote')
  }
]
</script>
