<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <button
    class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    title="切换主题"
    @click="toggleTheme"
  >
    <div
      class="absolute transition-transform duration-300 i-carbon-sun text-2xl text-yellow-500"
      :class="[
        !isDark ? 'rotate-0 scale-100' : 'rotate-90 scale-0',
      ]"
    />
    <div
      class="absolute transition-transform duration-300 i-carbon-moon text-2xl text-gray-700 dark:text-gray-200"
      :class="[
        isDark ? 'rotate-0 scale-100' : '-rotate-90 scale-0',
      ]"
    />
  </button>
</template>
