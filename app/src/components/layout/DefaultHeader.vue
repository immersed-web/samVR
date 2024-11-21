<template>
  <div class="navbar justify-between bg-base-200 px-4 xl:px-8">
    <div class="">
      <!-- <div class="flex flex-col m-1"> -->
      <!-- <a class="btn btn-ghost btn-sm text-xl w-28" @click="goHome">SamVR</a> -->
      <RouterLink :to="{ path: '/' }" class="text-xl font-bold text-base-content/90">
        Sam<span class="bg-clip-text text-transparent bg-gradient-to-b from-primary to-secondary">VR</span>
      </RouterLink>
      <!-- <Breadcrumbs /> -->
      <!-- </div> -->
    </div>
    <div class="grow hidden sm:flex justify-center gap-1">
      <!-- <div class="text-xs">
        {{ authStore.username }}: {{ authStore.userId }}
      </div> -->
      <RouterLink v-for="route in mainMenu" exact-active-class="btn-active" is="button" class="btn btn-ghost"
        :to="{ name: route.name }">
        {{ route.label }}
      </RouterLink>
    </div>
    <div class="">
      <button @click="logout" class="btn-ghost text-error btn-error btn btn-sm hidden sm:block ">
        <span class="material-icons">
          logout
        </span>
      </button>
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
  </div>
</template>

<script setup lang="ts">
import { useRouter, onBeforeRouteUpdate, onBeforeRouteLeave } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { hasAtLeastSecurityRole } from 'schemas';
import { computed, ref } from 'vue';

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
