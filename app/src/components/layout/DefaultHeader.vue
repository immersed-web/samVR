<template>
  <div data-theme="dark" :style="`background-image: url(${unsplashBackground});`"
    class="navbar justify-between gap-14 pl-6">
    <div class="">
      <!-- <div class="flex flex-col m-1"> -->
      <!-- <a class="btn btn-ghost btn-sm text-xl w-28" @click="goHome">SamVR</a> -->
      <RouterLink :to="{ path: '/' }" class="text-xl font-bold text-white">
        Sam<span class="bg-clip-text text-transparent bg-gradient-to-b from-primary to-secondary">VR</span>
      </RouterLink>
      <!-- <Breadcrumbs /> -->
      <!-- </div> -->
    </div>
    <div class="grow shrink-0 hidden sm:flex justify-center gap-1">
      <!-- <div class="text-xs">
        {{ authStore.username }}: {{ authStore.userId }}
      </div> -->
      <RouterLink v-for="route in mainMenu" exact-active-class="btn-active" is="button" class="btn btn-ghost px-3.5"
        :to="{ name: route.name }">
        {{ route.label }}
      </RouterLink>
    </div>
    <div class="sm:flex shrink hidden gap-1 items-center">
      <div class="flex flex-wrap shrink justify-end items-baseline text-xs font-semibold">
        <span class="text-base-content/50">{{ authStore.role === 'guest' ? 'Besöker som' : 'Inloggad som'
          }}&nbsp;</span>
        <span>
          <span class="font-bold text-white/80 text-base">{{
            authStore.username }}</span>
          <span class="" v-if="authStore.role">&nbsp;({{ translateUserRole(authStore.role)
            }})</span>
        </span>
        <!-- <span v-if="authStore.role"
          class="text-xs justify-self-start flex items-center leading-none h-6 px-2 font-semibold rounded-full bg-fuchsia-600">
          {{ translateUserRole(authStore.role) }}
        </span> -->
      </div>
      <button @click="logout" class="btn-ghost shrink-0 text-error btn-error btn btn-circle">
        <span class="material-icons">
          logout
        </span>
      </button>
    </div>
    <div class="dropdown dropdown-end sm:hidden">
      <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
        <span class="material-icons">menu</span>
      </div>
      <ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
        <li v-for="route in mainMenu">
          <RouterLink @click="closeMenu" :to="{ name: route.name }">
            {{ route.label }}
          </RouterLink>
        </li>
        <li class="text-error">
          <a @click="logout">{{ isAtLeastUser ? 'Logga ut' : 'Avsluta' }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, onBeforeRouteUpdate, onBeforeRouteLeave } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { hasAtLeastSecurityRole, translateUserRole } from 'schemas';
import { computed, ref } from 'vue';
import unsplashBackground from '@/assets/milad-fakurian-DX7pT_guAyE-unsplash.jpg';

const router = useRouter();
const authStore = useAuthStore();

const isAtLeastUser = computed(() => {
  return authStore.role ? hasAtLeastSecurityRole(authStore.role, 'user') : false;
})

const mainMenu = computed(() => {
  let routes = [
    { name: 'start', label: 'Start' },
    { name: 'avatarDesigner', label: 'Min avatar' },
  ]
  if (isAtLeastUser.value) {
    routes.push(
      { name: 'library', label: 'Mediabibliotek' },
    );
  }
  const hasAdminRole = authStore.role ? hasAtLeastSecurityRole(authStore.role, 'admin') : false;
  if (hasAdminRole) {
    routes.push(
      { name: 'adminUserManager', label: 'Hantera användare' },
    );
  }
  return routes;
})

function closeMenu() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

const logout = async () => {
  await authStore.logout();
  console.log('was logged out');
  router.push({ path: '/login', force: true });
};

</script>

<style scoped>

</style>
