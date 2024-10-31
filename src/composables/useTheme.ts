import { onMounted, onUnmounted, ref } from 'vue'

export function useTheme() {
  const isDark = ref(false)

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  function handleThemeChange(e: MediaQueryListEvent) {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches)
    }
  }

  // 设置主题
  function setTheme(dark: boolean) {
    isDark.value = dark
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }

  // 切换主题
  function toggleTheme() {
    setTheme(!isDark.value)
  }

  // 初始化主题
  onMounted(() => {
    // 添加 transition 类以启用过渡动画
    document.documentElement.classList.add('transition')
    document.documentElement.style.setProperty('transition', 'background-color 0.3s ease')

    const savedTheme = localStorage.getItem('theme')
    const prefersDark = mediaQuery.matches

    setTheme(savedTheme === 'dark' || (!savedTheme && prefersDark))

    mediaQuery.addEventListener('change', handleThemeChange)
  })

  onUnmounted(() => {
    mediaQuery.removeEventListener('change', handleThemeChange)
  })

  return {
    isDark,
    toggleTheme,
  }
}
