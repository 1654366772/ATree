import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import ArticleManager from '../components/ArticleManager.vue';
import VoiceActorManager from '../components/VoiceActorManager.vue';
import PromptManager from '../components/PromptManager.vue';
import AiModelManager from '../components/AiModelManager.vue';
import DubManager from '../components/DubManager.vue';
import SettingsManager from '../components/SettingsManager.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/article',
  },
  {
    path: '/article',
    name: 'ArticleManager',
    component: ArticleManager,
  },
  {
    path: '/dubber',
    name: 'VoiceActorManager',
    component: VoiceActorManager,
  },
  {
    path: '/prompt',
    name: 'PromptManager',
    component: PromptManager,
  },
  {
    path: '/model',
    name: 'AiModelManager',
    component: AiModelManager,
  },
  {
    path: '/dubbing',
    name: 'Dubbing',
    component: DubManager,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsManager,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
