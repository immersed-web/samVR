<template>
  <div class="navbar bg-base-200 px-4 xl:px-8">
    <div class="navbar-start">
      <!-- <div class="flex flex-col m-1"> -->
      <!-- <a class="btn btn-ghost btn-sm text-xl w-28" @click="goHome">SamVR</a> -->
      <RouterLink :to="{ path: '/' }" class="text-xl font-bold text-base-content/90">
        Sam<span class="bg-clip-text text-transparent bg-gradient-to-b from-primary to-secondary">VR</span>
      </RouterLink>
      <!-- <Breadcrumbs /> -->
      <!-- </div> -->
    </div>
    <div class="navbar-center hidden lg:flex">
      <!-- <div class="text-xs">
        {{ authStore.username }}: {{ authStore.userId }}
      </div> -->
      <RouterLink :to="{ name: 'start' }">
        <button class="btn btn-ghost">
          Start
        </button>
      </RouterLink>
      <RouterLink :to="{ name: 'library' }">
        <button class="btn btn-ghost">
          Mediabibliotek
        </button>
      </RouterLink>
      <RouterLink :to="{ name: 'avatarDesigner' }">
        <button class="btn btn-ghost">
          Min avatar
        </button>
      </RouterLink>

      <!-- <div class="divider divider-horizontal" /> -->

      <div v-if="hasAtLeastSecurityRole(authStore.role, 'admin')">
        <!-- <RouterLink :to="{ name: 'adminHome' }">
          <button class="btn btn-neutral btn-sm ml-4">
            Admin
          </button>
        </RouterLink> -->
        <RouterLink :to="{ name: 'adminUserManager' }">
          <button class="btn btn-ghost">
            Hantera användare
          </button>
        </RouterLink>
      </div>
    </div>
    <div class="navbar-end">
      <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">

          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>


        </div>
        <ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
          <li>
            <RouterLink :to="{ name: 'vrList' }">
              VR-scener
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'avatarDesigner' }">
              Min avatar
            </RouterLink>
          </li>
          <template v-if="hasAtLeastSecurityRole(authStore.role, 'admin')">
            <!-- <div class="divider">Admin</div> -->
            <li>
              <RouterLink :to="{ name: 'adminUserManager' }">
                Hantera användare
              </RouterLink>
            </li>
          </template>

          <li class="text-error">
            <a @click="logout">Logga ut</a>
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
