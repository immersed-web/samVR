<template>
  <div class="navbar bg-base-200">
    <div class="navbar-start">
      <a class="btn btn-ghost text-xl w-28 m-1" @click="goHome">SamVR</a>
      <Breadcrumbs />
    </div>
    <div class="navbar-center hidden lg:flex">
      <div class="text-xs">{{ authStore.username }}: {{ authStore.userId }}</div>
      <RouterLink :to="{ name: 'vrList' }">
        <button class="btn btn-ghost">
          VR-scener
        </button>
      </RouterLink>

      <RouterLink :to="{ name: 'streamList' }">
        <button class="btn btn-ghost">
          Strömmar
        </button>
      </RouterLink>

      <!-- <div class="divider divider-horizontal" /> -->

      <div v-if="hasAtLeastSecurityRole(authStore.role, 'admin')">
        <RouterLink :to="{ name: 'adminHome' }">
          <button class="btn btn-neutral btn-sm ml-4">
            Admin
          </button>
        </RouterLink>
      </div>
    </div>
    <div class="navbar-end">
      <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
          <div class="w-10 rounded-full">
            <img alt="Tailwind CSS Navbar component"
              src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp">
          </div>
        </div>
        <ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
          <li>
            <a>Min profil</a>
          </li>
          <li>
            <a class="bg-error" @click="logout">Logga ut</a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import { hasAtLeastSecurityRole } from 'schemas';
import Breadcrumbs from '@/components/Breadcrumbs.vue';

// Use imports
const router = useRouter();
const authStore = useAuthStore();
const clientStore = useClientStore();


// Components stuff

const logout = async () => {
  await authStore.logout();
  console.log('was logged out');
  router.push({ path: '/login', force: true });
};

function goHome() {
  if (authStore.role && hasAtLeastSecurityRole(authStore.role, 'admin')) {
    router.push({ name: 'adminHome' });
  }
  else {
    router.push({ name: 'userHome' });
  }
}

</script>

<style scoped>

</style>
