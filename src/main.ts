import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import env from './utils/env'

const app = createApp(App)

// use APP_NAME from env helper to set document title
if (typeof document !== 'undefined' && env.APP_NAME) {
  document.title = env.APP_NAME
}

app.use(router)

app.mount('#app')
