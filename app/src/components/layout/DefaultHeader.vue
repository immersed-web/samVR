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
      <RouterLink v-if="isAtLeastUser" :to="{ name: 'messages' }" class="btn btn-ghost btn-circle shrink-0 indicator" title="Meddelanden">
        <span v-if="unreadMessages" class="indicator-item badge badge-primary badge-sm">{{ unreadMessages > 99 ? '99+' : unreadMessages }}</span>
        <span class="material-icons">{{ unreadMessages ? 'mark_email_unread' : 'mail_outline' }}</span>
      </RouterLink>
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
import { computed, ref, watch } from 'vue';
import { messagesApi, orgApi } from '@/modules/authClient';
import { onBeforeUnmount } from 'vue';
import unsplashBackground from '@/assets/milad-fakurian-DX7pT_guAyE-unsplash.jpg';

const router = useRouter();
const authStore = useAuthStore();

const isAtLeastUser = computed(() => {
  return authStore.role ? hasAtLeastSecurityRole(authStore.role, 'user') : false;
})

// Show the organizations link to platform admins and to people who administer an organization.
// The server decides what they may actually see and do there.
const managesOrganizations = ref(false);
watch(() => [authStore.userId, authStore.role] as const, async ([userId, role]) => {
  managesOrganizations.value = false;
  if (!userId || !role || !hasAtLeastSecurityRole(role, 'user')) return;
  if (hasAtLeastSecurityRole(role, 'superadmin')) { managesOrganizations.value = true; return; }
  try {
    managesOrganizations.value = (await orgApi.list()).some(o => o.myRole === 'org_admin');
  } catch {
    managesOrganizations.value = false;
  }
}, { immediate: true });

// Unread messages from administrators, checked now and then while logged in
const unreadMessages = ref(0);
let unreadTimer: ReturnType<typeof setInterval> | undefined;
async function refreshUnread() {
  if (!authStore.userId || !authStore.role || !hasAtLeastSecurityRole(authStore.role, 'user')) { unreadMessages.value = 0; return; }
  try { unreadMessages.value = (await messagesApi.summary()).unread; } catch { /* not logged in or offline: keep the old number */ }
}
watch(() => [authStore.userId, authStore.role] as const, refreshUnread, { immediate: true });
const stopAfterEach = router.afterEach(() => { void refreshUnread(); });
unreadTimer = setInterval(refreshUnread, 60_000);
onBeforeUnmount(() => { clearInterval(unreadTimer); stopAfterEach(); });

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
  if (managesOrganizations.value) {
    // Platform admins see every organization; an organization admin only has their own.
    const platformAdmin = authStore.role ? hasAtLeastSecurityRole(authStore.role, 'superadmin') : false;
    routes.push({ name: 'organizations', label: platformAdmin ? 'Organisationer' : 'Min organisation' });
    // Organization administrators manage the people in their own organization (platform admins have the full page below)
    if (!platformAdmin) routes.push({ name: 'orgUsers', label: 'Hantera användare' });
  }
  // The platform-wide account list is for platform administrators; organizations manage their own users above.
  const isPlatformAdmin = authStore.role ? hasAtLeastSecurityRole(authStore.role, 'superadmin') : false;
  if (isPlatformAdmin) {
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

<style scoped></style>
