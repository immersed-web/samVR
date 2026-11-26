<template>
  <div class="min-h-screen flex items-center justify-center p-4" :style="`background-image: url(${unsplashBackground});`">
    <div class="card w-full max-w-xl bg-base-100 shadow-2xl">
      <div class="card-body gap-4">
        <h1 class="text-2xl font-bold">
          Använd Sam<span class="bg-clip-text text-transparent bg-gradient-to-b from-primary to-secondary">VR</span>
          i din organisation
        </h1>

        <template v-if="!sent">
          <p class="text-sm text-base-content/70">
            Berätta lite om din kommun eller ditt företag. Vi hör av oss till kontaktpersonen, och när förfrågan är
            godkänd får ni en länk där ni skapar ert första administratörskonto.
          </p>

          <div v-if="errorMessage" role="alert" class="alert alert-error text-sm"><span>{{ errorMessage }}</span></div>

          <form class="flex flex-col gap-3" @submit.prevent="submit">
            <label class="form-control">
              <span class="label-text font-semibold">Organisationens namn</span>
              <input v-model="form.organizationName" class="input input-bordered" required minlength="2" maxlength="200" autocomplete="organization">
            </label>
            <label class="form-control">
              <span class="label-text font-semibold">Typ av organisation</span>
              <select v-model="form.organizationType" class="select select-bordered">
                <option value="municipality">Kommun</option>
                <option value="company">Företag</option>
                <option value="other">Annan</option>
              </select>
            </label>
            <div class="grid sm:grid-cols-2 gap-3">
              <label class="form-control">
                <span class="label-text font-semibold">Kontaktperson</span>
                <input v-model="form.contactName" class="input input-bordered" required minlength="2" maxlength="200" autocomplete="name">
              </label>
              <label class="form-control">
                <span class="label-text font-semibold">E-post</span>
                <input v-model="form.contactEmail" type="email" class="input input-bordered" required maxlength="320" autocomplete="email">
              </label>
            </div>
            <label class="form-control">
              <span class="label-text font-semibold">Ungefär hur många användare? (valfritt)</span>
              <input v-model.number="form.expectedUsers" type="number" min="1" max="1000000" class="input input-bordered">
            </label>
            <label class="form-control">
              <span class="label-text font-semibold">Meddelande (valfritt)</span>
              <textarea v-model="form.message" rows="4" maxlength="4000" class="textarea textarea-bordered"></textarea>
            </label>

            <!-- Honeypot: hidden from people, but bots tend to fill every field they find. -->
            <div class="absolute -left-[9999px]" aria-hidden="true">
              <label>Lämna detta fält tomt <input v-model="form.website" tabindex="-1" autocomplete="off"></label>
            </div>

            <p class="text-xs text-base-content/60">
              Vi sparar uppgifterna du skriver här för att kunna svara på förfrågan, och inget annat.
            </p>
            <div class="flex items-center justify-between gap-4">
              <RouterLink :to="{ name: 'login' }" class="link text-sm">Tillbaka till inloggning</RouterLink>
              <button class="btn btn-primary" :disabled="sending">
                <span v-if="sending" class="loading loading-spinner loading-sm"></span>
                Skicka förfrågan
              </button>
            </div>
          </form>
        </template>

        <template v-else>
          <div role="status" class="alert alert-success"><span>Tack! Din förfrågan är skickad. Vi återkommer till {{ form.contactEmail }}.</span></div>
          <RouterLink :to="{ name: 'login' }" class="btn btn-ghost">Tillbaka till inloggning</RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import unsplashBackground from '@/assets/milad-fakurian-DX7pT_guAyE-unsplash.jpg';
import { onboardingApi, orgErrorMessage, type OrgType } from '@/modules/authClient';

const form = reactive({
  organizationName: '',
  organizationType: 'municipality' as OrgType,
  contactName: '',
  contactEmail: '',
  expectedUsers: undefined as number | undefined,
  message: '',
  website: '',
});
const sending = ref(false);
const sent = ref(false);
const errorMessage = ref('');

async function submit() {
  sending.value = true;
  errorMessage.value = '';
  try {
    await onboardingApi.submitRequest({
      organizationName: form.organizationName,
      organizationType: form.organizationType,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      expectedUsers: form.expectedUsers || undefined,
      message: form.message || undefined,
      website: form.website,
    });
    sent.value = true;
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  } finally {
    sending.value = false;
  }
}
</script>
