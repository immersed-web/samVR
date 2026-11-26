<template>
  <div class="min-h-screen flex items-center justify-center p-4" :style="`background-image: url(${unsplashBackground});`">
    <div class="card w-full max-w-lg bg-base-100 shadow-2xl">
      <div class="card-body gap-4">
        <h1 class="text-2xl font-bold">
          Sam<span class="bg-clip-text text-transparent bg-gradient-to-b from-primary to-secondary">VR</span>
        </h1>

        <div v-if="loading" class="flex items-center gap-3"><span class="loading loading-spinner"></span> Kontrollerar inbjudan…</div>

        <template v-else-if="!preview">
          <div role="alert" class="alert alert-warning">
            <span>Inbjudan är ogiltig eller har gått ut. Be den som bjöd in dig om en ny länk.</span>
          </div>
          <RouterLink :to="{ name: 'login' }" class="btn btn-ghost">Till inloggningen</RouterLink>
        </template>

        <template v-else>
          <p>
            Du är inbjuden till <strong>{{ preview.organizationName }}</strong>
            <template v-if="preview.unitName"> (<strong>{{ preview.unitName }}</strong>)</template>
            <template v-if="preview.organizationRole === 'org_admin'"> som administratör</template>
            <template v-else-if="preview.organizationRole === 'basic'"> som användare</template>.
          </p>

          <div v-if="errorMessage" role="alert" class="alert alert-error text-sm"><span>{{ errorMessage }}</span></div>

          <!-- Already signed in: join with the current account -->
          <template v-if="preview.loggedIn">
            <p class="text-sm">Du är inloggad som <strong>{{ preview.username }}</strong>. Vill du gå med med det kontot?</p>
            <button class="btn btn-primary" :disabled="working" @click="accept(false)">Gå med som {{ preview.username }}</button>
            <p class="text-xs text-base-content/60">
              Vill du i stället skapa ett nytt konto? <a class="link" @click="logoutThenStay">Logga ut</a> och öppna länken igen.
            </p>
          </template>

          <!-- New account -->
          <form v-else class="flex flex-col gap-3" @submit.prevent="accept(true)">
            <p class="text-sm text-base-content/70">Välj ett användarnamn och ett lösenord för ditt nya konto.</p>
            <label class="form-control">
              <span class="label-text font-semibold">Användarnamn</span>
              <input v-model="username" class="input input-bordered" required minlength="2" maxlength="100" autocomplete="username">
            </label>
            <label class="form-control">
              <span class="label-text font-semibold">Lösenord (minst 8 tecken)</span>
              <input v-model="password" type="password" class="input input-bordered" required minlength="8" autocomplete="new-password">
            </label>
            <label class="form-control">
              <span class="label-text font-semibold">Upprepa lösenordet</span>
              <input v-model="password2" type="password" class="input input-bordered" required autocomplete="new-password">
            </label>
            <button class="btn btn-primary" :disabled="working || password.length < 8 || password !== password2">
              <span v-if="working" class="loading loading-spinner loading-sm"></span>
              Skapa konto och gå med
            </button>
            <p v-if="password2 && password !== password2" class="text-error text-xs">Lösenorden är inte lika.</p>
            <p class="text-xs text-base-content/60">
              Har du redan ett konto? <RouterLink :to="{ name: 'login' }" class="link">Logga in</RouterLink> och öppna sedan den här länken igen.
            </p>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import unsplashBackground from '@/assets/milad-fakurian-DX7pT_guAyE-unsplash.jpg';
import { useAuthStore } from '@/stores/authStore';
import { onboardingApi, orgErrorMessage, type InvitationPreview } from '@/modules/authClient';

const props = defineProps<{ token: string }>();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const preview = ref<InvitationPreview>();
const working = ref(false);
const errorMessage = ref('');
const username = ref('');
const password = ref('');
const password2 = ref('');

onMounted(async () => {
  try {
    preview.value = await onboardingApi.previewInvitation(props.token);
  } catch {
    preview.value = undefined;
  } finally {
    loading.value = false;
  }
});

async function accept(createAccount: boolean) {
  working.value = true;
  errorMessage.value = '';
  try {
    const result = await onboardingApi.acceptInvitation({
      token: props.token,
      ...(createAccount ? { username: username.value.trim(), password: password.value } : {}),
    });
    if (result.createdAccount) {
      // The server has already signed the new account in; do the normal login so this app picks up the session.
      await authStore.login(username.value.trim(), password.value);
    }
    await router.push({ name: 'start' });
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  } finally {
    working.value = false;
  }
}

async function logoutThenStay() {
  await authStore.logout();
  window.location.reload();
}
</script>
