<template>
  <div ref="terminalContainer" class="terminal-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const terminalContainer = ref<HTMLElement | null>(null)

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let unsubscribeData: (() => void) | null = null
let unsubscribeExit: (() => void) | null = null

defineExpose({
  sendCommand: (command: string) => {
    window.electronAPI.terminal.sendCommand(command)
  }
})

async function initTerminal() {
  if (!terminalContainer.value) return

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4'
    }
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)

  terminal.open(terminalContainer.value)
  fitAddon.fit()

  // Create PTY process
  await window.electronAPI.terminal.create()

  // Handle terminal input
  terminal.onData((data) => {
    window.electronAPI.terminal.write(data)
  })

  // Handle terminal resize
  terminal.onResize(({ cols, rows }) => {
    window.electronAPI.terminal.resize(cols, rows)
  })

  // Handle data from PTY
  unsubscribeData = window.electronAPI.terminal.onData((data: string) => {
    terminal?.write(data)
  })

  // Handle PTY exit
  unsubscribeExit = window.electronAPI.terminal.onExit(() => {
    terminal?.write('\r\n\r\n[Process exited]\r\n')
  })

  // Handle window resize
  const resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
  })
  resizeObserver.observe(terminalContainer.value)
}

onMounted(() => {
  initTerminal()
})

onUnmounted(() => {
  unsubscribeData?.()
  unsubscribeExit?.()
  terminal?.dispose()
})
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100%;
  padding: 8px;
  background-color: #1e1e1e;
}
</style>
