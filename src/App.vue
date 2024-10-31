<script setup lang="ts">
import ConfettiExplosion from '@/components/confetti-explosion.vue'
import ToggleTheme from '@/components/toggle-theme.vue'
import OpenAI from 'openai'
import { onMounted, ref, watch } from 'vue'

/** 类型定义 */
interface Step {
  id: number
  content: string
}

interface TodoTask {
  id: number
  content: string
  steps: Step[]
  completed: boolean
  date?: string
}

/** OpenAI 类型定义 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 状态定义 */
const todoInput = ref('')
const tasks = ref<TodoTask[]>([])
const isTyping = ref(false)
const currentDisplayTask = ref<TodoTask | null>(null)
const selectedTaskId = ref<number | null>(null)

/** 添加折叠状态管理 */
const collapsedTasks = ref<Set<number>>(new Set())

/** OpenAI 实例 */
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
  dangerouslyAllowBrowser: true,
})

const confettiRef = ref<InstanceType<typeof ConfettiExplosion> | null>(null)

/** 从 localStorage 加载数据 */
onMounted(() => {
  const savedTasks = localStorage.getItem('todo-tasks')
  if (savedTasks) {
    tasks.value = JSON.parse(savedTasks)
  }
})

/** 监听任务变化并保存到 localStorage */
watch(tasks, (newTasks) => {
  localStorage.setItem('todo-tasks', JSON.stringify(newTasks))
}, { deep: true })

/** 当选中的任务改变时，更新显示的任务 */
watch(selectedTaskId, (newId) => {
  if (newId) {
    const task = tasks.value.find(t => t.id === newId)
    if (task) {
      currentDisplayTask.value = JSON.parse(JSON.stringify(task))
    }
  }
  else {
    currentDisplayTask.value = null
  }
})

/** 任务相关方法 */
function addTask() {
  if (!todoInput.value.trim())
    return

  const newTask: TodoTask = {
    id: Date.now(),
    content: todoInput.value,
    steps: [],
    completed: false,
  }

  tasks.value.push(newTask)
  todoInput.value = ''
  selectedTaskId.value = newTask.id
}

function deleteTask(taskId: number) {
  tasks.value = tasks.value.filter(t => t.id !== taskId)
  if (currentDisplayTask.value?.id === taskId) {
    currentDisplayTask.value = null
  }
}

/** 步骤相关方法 */
async function generateSteps(taskId: number) {
  selectedTaskId.value = taskId
  const taskIndex = tasks.value.findIndex(t => t.id === taskId)
  if (taskIndex === -1)
    return

  try {
    isTyping.value = true
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: '你是一个任务分解助手。请将用户输入的待办事项分解成具体的步骤。请不要在步骤内容中添加序号，系统会自动添加。每个步骤用换行符分隔。',
        } as OpenAIMessage,
        {
          role: 'user',
          content: tasks.value[taskIndex].content,
        } as OpenAIMessage,
      ],
      model: 'deepseek-chat',
      stream: true,
    })

    // 清空当前任务的步骤
    tasks.value[taskIndex].steps = []
    currentDisplayTask.value = JSON.parse(JSON.stringify(tasks.value[taskIndex]))

    let currentStep = ''
    let stepCount = 0
    const updatedSteps: Step[] = []

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || ''

      for (const char of content) {
        if (char === '\n') {
          if (currentStep.trim()) {
            stepCount++
            const cleanContent = currentStep.trim().replace(/^\d+[.、]\s*/, '')
            const newStep: Step = {
              id: Date.now() + Math.random(),
              content: `${stepCount}. ${cleanContent}`,
            }
            updatedSteps.push(newStep)
            tasks.value[taskIndex].steps = [...updatedSteps]
            if (currentDisplayTask.value) {
              currentDisplayTask.value.steps = [...updatedSteps]
            }
            currentStep = ''
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }
        else {
          currentStep += char
          if (updatedSteps.length > 0) {
            const cleanContent = currentStep.trim().replace(/^\d+[.、]\s*/, '')
            const updatedContent = `${stepCount + 1}. ${cleanContent}`
            if (!tasks.value[taskIndex].steps[stepCount]) {
              const newStep: Step = {
                id: Date.now() + Math.random(),
                content: updatedContent,
              }
              tasks.value[taskIndex].steps.push(newStep)
            }
            else {
              tasks.value[taskIndex].steps[stepCount].content = updatedContent
            }

            if (currentDisplayTask.value) {
              currentDisplayTask.value.steps = [...tasks.value[taskIndex].steps]
            }
          }
          else {
            const cleanContent = currentStep.trim().replace(/^\d+[.、]\s*/, '')
            const newStep: Step = {
              id: Date.now() + Math.random(),
              content: `1. ${cleanContent}`,
            }
            tasks.value[taskIndex].steps = [newStep]
            if (currentDisplayTask.value) {
              currentDisplayTask.value.steps = [newStep]
            }
          }
          await new Promise(resolve => setTimeout(resolve, 30))
        }
      }
    }

    if (currentStep.trim() && !tasks.value[taskIndex].steps.some(step => step.content.includes(currentStep.trim()))) {
      stepCount++
      const cleanContent = currentStep.trim().replace(/^\d+[.、]\s*/, '')
      const finalStep: Step = {
        id: Date.now() + Math.random(),
        content: `${stepCount}. ${cleanContent}`,
      }
      tasks.value[taskIndex].steps.push(finalStep)
      if (currentDisplayTask.value) {
        currentDisplayTask.value.steps = JSON.parse(JSON.stringify(tasks.value[taskIndex].steps))
      }
    }

    localStorage.setItem('todo-tasks', JSON.stringify(tasks.value))
  }
  catch (error) {
    console.error('生成步骤时出错：', error)
  }
  finally {
    isTyping.value = false
  }
}

function deleteStep(taskId: number, stepId: number) {
  const task = tasks.value.find(t => t.id === taskId)
  if (task) {
    task.steps = task.steps.filter(s => s.id !== stepId)

    task.steps = task.steps.map((step, index) => ({
      ...step,
      content: `${index + 1}. ${step.content.replace(/^\d+\.\s*/, '')}`,
    }))

    if (currentDisplayTask.value?.id === taskId) {
      currentDisplayTask.value.steps = [...task.steps]
    }
  }
}

/** 添加切换完成状态的方法 */
function toggleTaskComplete(taskId: number, event: MouseEvent) {
  const task = tasks.value.find(t => t.id === taskId)
  if (task) {
    task.completed = !task.completed
    if (task.completed && confettiRef.value) {
      confettiRef.value.explode(event)
    }
  }
}

/** 切换折叠状态的方法 */
function toggleCollapse(taskId: number) {
  if (collapsedTasks.value.has(taskId)) {
    collapsedTasks.value.delete(taskId)
  }
  else {
    collapsedTasks.value.add(taskId)
  }
}
</script>

<template>
  <div
    class="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50
              dark:from-slate-900 dark:via-blue-900 dark:to-purple-900
              transition-colors duration-75 animate-gradient"
  >
    <div class="relative w-full h-screen overflow-auto scrollbar-fancy">
      <div class="container mx-auto p-4 max-w-3xl min-h-full">
        <div class="absolute top-4 right-4 flex items-center gap-2">
          <!-- GitHub 链接 -->
          <a
            href="https://github.com/zhou-zzz/ai-todo"
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 rounded-full transition-all duration-200
            text-gray-600 hover:text-gray-900
            dark:text-gray-400 dark:hover:text-gray-200
            hover:bg-gray-100 dark:hover:bg-gray-800/50"
            title="查看源码"
          >
            <div class="i-carbon-logo-github text-xl" />
          </a>
          <ToggleTheme />
        </div>

        <div class="mt-8 px-4 sm:px-6 lg:px-8">
          <h1
            class="text-xl sm:text-2xl font-bold mb-4 dark:text-white text-center sm:text-left
                     bg-clip-text text-transparent bg-gradient-to-r
                     from-blue-500 to-purple-500 dark:from-blue-400 dark:to-purple-400"
          >
            AI待办事项清单
          </h1>

          <!-- 输入区域 -->
          <div class="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              v-model="todoInput"
              type="text"
              placeholder="输入待办事项..."
              class="w-full sm:flex-1 p-2 sm:p-3 rounded-lg
                     bg-white/90 dark:bg-slate-800/90
                     border-0 dark:text-blue-100
                     focus:outline-none focus:ring-2 focus:scale-[1.02]
                     focus:ring-blue-500/50 dark:focus:ring-blue-400/50
                     shadow-lg shadow-blue-500/20 dark:shadow-blue-400/10
                     placeholder:text-gray-500 dark:placeholder:text-blue-300/70
                     text-sm sm:text-base transition-all duration-300"
              @keyup.enter="addTask"
            >
            <button
              class="w-full sm:w-auto px-4 py-2 sm:py-3 rounded-lg
                     bg-gradient-to-r from-blue-500 to-purple-500
                     hover:from-blue-600 hover:to-purple-600
                     text-white shadow-lg shadow-blue-500/30
                     transition-all duration-300 text-sm sm:text-base
                     backdrop-blur-md"
              :disabled="isTyping"
              @click="addTask"
            >
              添加任务
            </button>
          </div>

          <!-- 任务列表 -->
          <div class="space-y-4 pb-8">
            <div class="space-y-4">
              <TransitionGroup
                name="task-list"
                tag="div"
                class="space-y-4"
              >
                <div
                  v-for="task in tasks"
                  :key="task.id"
                  class="space-y-2"
                >
                  <div
                    class="p-4 rounded-lg transform hover:scale-[1.01]
                           backdrop-blur-md bg-white/80 dark:bg-slate-800/40
                           border border-transparent hover:border-blue-500/20
                           shadow-sm hover:shadow-xl transition-all duration-300
                           animate-slide-in h-[72px]"
                  >
                    <div class="flex items-center justify-between gap-4 h-full">
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          class="flex-shrink-0 w-5 h-5 rounded border-2
                                 transition-colors duration-200
                                 flex items-center justify-center"
                          :class="[
                            task.completed
                              ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400'
                              : 'border-gray-300 dark:border-gray-600',
                          ]"
                          @click="(e) => toggleTaskComplete(task.id, e)"
                        >
                          <div
                            v-if="task.completed"
                            class="i-carbon-checkmark text-white text-sm"
                          />
                        </button>
                        <span
                          class="text-sm sm:text-base truncate dark:text-blue-100
                                  transition-colors duration-200 line-clamp-2"
                          :class="{ 'line-through text-gray-400 dark:text-gray-500': task.completed }"
                        >
                          {{ task.content }}
                        </span>
                      </div>

                      <div class="flex items-center gap-2">
                        <button
                          v-if="task.steps.length > 0"
                          class="p-1.5 rounded-full transition-all duration-200
                                 text-blue-500 hover:text-blue-600
                                 dark:text-blue-400 dark:hover:text-blue-300
                                 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          @click="toggleCollapse(task.id)"
                        >
                          <div
                            class="text-lg" :class="[
                              collapsedTasks.has(task.id)
                                ? 'i-carbon-chevron-down'
                                : 'i-carbon-chevron-up',
                            ]"
                          />
                        </button>
                        <button
                          v-if="!task.steps.length"
                          class="p-1.5 rounded-full transition-all duration-200"
                          :disabled="isTyping"
                          :title="isTyping ? '生成中...' : '生成步骤'"
                          @click="generateSteps(task.id)"
                        >
                          <div
                            class="i-carbon-list-checked text-lg"
                            :class="{ 'animate-spin': isTyping }"
                          />
                        </button>
                        <button
                          class="p-1.5 rounded-full transition-all duration-200"
                          @click="deleteTask(task.id)"
                        >
                          <div class="i-carbon-trash-can text-lg" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="task.steps.length > 0"
                    class="ml-8"
                  >
                    <transition
                      enter-active-class="transition-all duration-300 ease-out"
                      leave-active-class="transition-all duration-300 ease-in"
                      enter-from-class="opacity-0 -translate-y-4"
                      enter-to-class="opacity-100 translate-y-0"
                      leave-from-class="opacity-100 translate-y-0"
                      leave-to-class="opacity-0 -translate-y-4"
                    >
                      <div
                        v-show="!collapsedTasks.has(task.id)"
                        class="p-4 rounded-lg bg-white/50 dark:bg-slate-800/30"
                      >
                        <div
                          class="space-y-3 max-h-[300px] overflow-y-auto pr-2
                                 scrollbar-thin scrollbar-thumb-blue-500/20
                                 scrollbar-track-transparent hover:scrollbar-thumb-blue-500/30
                                 dark:scrollbar-thumb-blue-400/20
                                 dark:hover:scrollbar-thumb-blue-400/30"
                        >
                          <div
                            v-for="step in task.steps"
                            :key="step.id"
                            class="flex items-center justify-between px-4 py-2 rounded-md
                                   bg-white/50 dark:bg-slate-800/30
                                   hover:bg-white/70 dark:hover:bg-slate-800/50
                                   transition-all duration-200"
                          >
                            <span class="text-sm dark:text-blue-200 flex-1">
                              {{ step.content }}
                              <span
                                v-if="isTyping && step.id === task.steps[task.steps.length - 1]?.id"
                                class="animate-pulse ml-0.5"
                              >|</span>
                            </span>
                            <button
                              v-if="!isTyping"
                              class="text-red-500 hover:text-red-700
                                     dark:text-red-400 dark:hover:text-red-300
                                     transition-all duration-200 ml-2"
                              @click="deleteStep(task.id, step.id)"
                            >
                              <div class="i-carbon-trash-can text-sm" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfettiExplosion ref="confettiRef" />
  </div>
</template>

<style scoped>
/* 移动端优化 */
@media (max-width: 640px) {
  input, button {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
}

/* 添加 checkbox 动画 */
@keyframes checkmark {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.i-carbon-checkmark {
  animation: checkmark 0.2s ease-out;
}

/* 自定义滚动条样式 */
.scrollbar-fancy::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.scrollbar-fancy::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1);
}

.scrollbar-fancy::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
  border-radius: 3px;
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.scrollbar-fancy::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
}

/* 深色模式滚动条 */
.dark .scrollbar-fancy::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.05);
}

.dark .scrollbar-fancy::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.2);
}

.dark .scrollbar-fancy::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%);
}

/* 步列表的滚动条样式 */
.space-y-3::-webkit-scrollbar {
  width: 4px;
}

.space-y-3::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 2px;
}

.space-y-3::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
  border-radius: 2px;
  transition: all 0.3s ease;
}

.space-y-3::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
}

/* 深色模式步骤列表滚动条 */
.dark .space-y-3::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.dark .space-y-3::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
}

.dark .space-y-3::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%);
}

/* 添加步骤项的动画样式 */
.space-y-3 > div {
  @apply transition-all duration-200;
}

.space-y-3 > div:hover {
  @apply transform scale-[1.01];
}

/* 优化删除按钮的显示 */
.space-y-3 > div button {
  @apply opacity-0;
}

.space-y-3 > div:hover button {
  @apply opacity-100;
}

/* 添加闪光动画 */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite;
}

/* 修改全局主题切换过渡时间 */
:root {
  @apply transition-colors duration-75;
}

/* 为所有可能变化的元素添加过渡效果 */
* {
  @apply transition-colors duration-75;
}

/* 优化输入框的主题切换 */
input {
  @apply transition-all duration-100;
}

/* 优化任务片的主题切换 */
.task-card {
  @apply transition-all duration-100;
}

/* 优化步骤列表的主题切换 */
.space-y-3 > div {
  @apply transition-all duration-100;
}

/* 优化滚动条的主题切换 */
.scrollbar-fancy::-webkit-scrollbar-track,
.scrollbar-fancy::-webkit-scrollbar-thumb,
.space-y-3::-webkit-scrollbar-track,
.space-y-3::-webkit-scrollbar-thumb {
  @apply transition-all duration-100;
}

/* 添加拖拽相关样式 */
.ghost {
  @apply opacity-50 bg-blue-100 dark:bg-blue-900/50;
}

.draggable-item {
  @apply touch-manipulation;
}

.draggable-item:active {
  @apply cursor-grabbing;
}

.draggable-step {
  @apply cursor-move touch-manipulation;
}

.draggable-step:active {
  @apply cursor-grabbing;
}

/* 禁用文本选择，优化拖拽体验 */
.cursor-move {
  @apply select-none;
}

/* 背景渐变动画 */
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 15s ease infinite;
}

/* 任务列表动画 */
.task-list-enter-active,
.task-list-leave-active {
  transition: all 0.5s ease;
}

.task-list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.task-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 任务卡片滑入动画 */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slideIn 0.5s ease-out forwards;
}

/* 按钮悬浮特效 */
button {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -10px rgba(0, 0, 0, 0.2);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

/* 添加多行文本截断样式 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
