<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
const particles: Array<{
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  color: string
}> = []
let animationFrame: number

function createParticles(x: number, y: number) {
  const colors = ['#FF577F', '#FF884B', '#FFD384', '#FFF9B0']
  for (let i = 0; i < 30; i++) {
    const angle = (Math.PI * 2 * i) / 30
    const velocity = 2 + Math.random() * 2
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      alpha: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

function animate() {
  if (!canvas.value)
    return

  const ctx = canvas.value.getContext('2d')
  if (!ctx)
    return

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  particles.forEach((particle, i) => {
    particle.x += particle.vx
    particle.y += particle.vy
    particle.alpha *= 0.96

    ctx.beginPath()
    ctx.fillStyle = `${particle.color}${Math.floor(particle.alpha * 255).toString(16).padStart(2, '0')}`
    ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2)
    ctx.fill()

    if (particle.alpha < 0.01)
      particles.splice(i, 1)
  })

  if (particles.length > 0)
    animationFrame = requestAnimationFrame(animate)
}

function explode(event: MouseEvent) {
  if (!canvas.value)
    return

  const rect = canvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  createParticles(x, y)
  animate()
}

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = window.innerWidth
    canvas.value.height = window.innerHeight
  }
})

onUnmounted(() => {
  if (animationFrame)
    cancelAnimationFrame(animationFrame)
})

defineExpose({
  explode,
})
</script>

<template>
  <canvas
    ref="canvas"
    class="fixed inset-0 pointer-events-none z-50"
  />
</template>
