export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    getSSRProps() {
      return {}
    },

    mounted(el: HTMLElement, binding: { value?: string; modifiers: Record<string, boolean> }) {
      if (!binding.modifiers.groupe) el.classList.add('reveal')
      if (binding.value) el.style.transitionDelay = binding.value

      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            el.classList.add('is-visible')
            io.unobserve(el)
          }
        },
        { threshold: 0.15 }
      )
      io.observe(el)
    }
  })
})
