<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-cover bg-center"
    :style="`background-image: url(${unsplashBackground});`">

    <RouterLink :to="{ name: 'landing' }" class="text-3xl font-bold text-neutral-content" title="Till startsidan">
      Sam<span class="bg-clip-text text-transparent bg-gradient-to-b from-primary to-secondary">VR</span>
    </RouterLink>

    <div v-if="redirectIsActive" role="alert" class="alert alert-info w-full max-w-sm text-sm">
      <span class="material-icons">info</span>
      <span>Du försökte nå en sida som kräver inloggning. Logga in, så kommer du vidare till sidan du
        var på väg till.</span>
    </div>

    <LoginBox @submit="login" :error="error" title="Logga in" />

    <div class="flex flex-col items-center gap-1 text-sm text-neutral-content">
      <RouterLink :to="{ name: 'landing' }" class="link">← Tillbaka till startsidan</RouterLink>
      <RouterLink :to="{ name: 'guestGallery' }" class="link">Besök en miljö som gäst</RouterLink>
      <span>Kommun eller företag? <RouterLink :to="{ name: 'requestOrganization' }" class="link">Skicka en förfrågan</RouterLink></span>
    </div>

    <p class="text-neutral-content/50 text-xs">Bakgrundsbild av <a class="link"
        href="https://unsplash.com/@fakurian?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Milad
        Fakurian</a> på <a class="link"
        href="https://unsplash.com/photos/an-abstract-purple-background-with-wavy-lines-DX7pT_guAyE?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Unsplash</a>
    </p>
  </div>
</template>

<script setup lang="ts">

// Imports
import unsplashBackground from '@/assets/milad-fakurian-DX7pT_guAyE-unsplash.jpg';
import { useRouter } from 'vue-router';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { hasAtLeastSecurityRole, type UserRole } from 'schemas';
import { useConnectionStore } from '@/stores/connectionStore';
import LoginBox from '@/components/LoginBox.vue';
import { autoResetRef } from '@vueuse/core';

// Router
const router = useRouter();
const fromRoute = router.currentRoute.value.redirectedFrom;
console.log('redirected from', fromRoute);
const defaultLoginRedirect = router.currentRoute.value.meta.afterLoginRedirect;
console.log('explicit redirect after login:', defaultLoginRedirect);

const redirectIsActive = computed(() => {
  return fromRoute || defaultLoginRedirect;
})

// Stores
const authStore = useAuthStore();
authStore.logout();
console.log('authstore loaded');

onMounted(() => {
  const connection = useConnectionStore();
  connection.close();
});

const error = autoResetRef<Error | undefined>(undefined, 5000);

const login = async (username: string, password: string) => {
  try {
    await authStore.login(username, password);
    console.log('Logged in as role', authStore.role);
    navigate();
  }
  catch (e: unknown) {
    console.error(e);
    if (e instanceof Error) {
      error.value = e;
    }
  }
};

function navigate() {
  if (defaultLoginRedirect) {
    console.log('explicit redirect set:', defaultLoginRedirect);
    router.push({ name: defaultLoginRedirect });
  } else if (fromRoute && fromRoute.path !== '/') {
    console.log('fromRoute:', fromRoute);
    console.log('was redirected here. Redirecting back to fromRoute');
    router.push(fromRoute);
  } else {
    console.log('Regular login', authStore.role);
    router.push({ name: 'start' });
  }
}

</script>
