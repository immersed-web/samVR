<template>
  <div>
    <!-- <div class="min-h-screen hero bg-base-200"> -->
    <div class="flex flex-col md:flex-row min-h-screen" :style="`background-image: url(${unsplashBackground});`">
      <!-- <div class="flex-row lg:flex-row gap-10 "> -->

      <!-- Info text -->
      <div class="flex-1 hero text-neutral-content">
        <div class="card">
          <div class="card-body">
            <h1 class="mb-2">
              Sam<span class="bg-clip-text text-transparent bg-gradient-to-b from-primary to-secondary">VR</span>
            </h1>
            <div>
              <p class="font-bold mb-2">
                En säker plats för elever att utforska, lära och skapa utan bekymmer om personlig integritet.
              </p>
              <p>
                SamVR låter elever interagera med olika objekt såsom bilder, text, filmer, länkar och till
                och med dela sina skärmar - allt med GDPR-säkerhet i åtanke. Kliv in i ett galleri där du och dina
                klasskamrater kan ta del av och lära sig av varandras redovisningar på ett helt nytt sätt!
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Login -->
      <div class="flex-1 hero">
        <div class="hero-content max-w-md p-8 flex-col">
          <div class="card w-full bg-base-100 shadow-2xl">
            <div class="card-body">

              <h2 class="text-lg">Fortsätt som gäst</h2>
              <GuestBox />
            </div>
          </div>
          <div class="divider my-2 divider-secondary text-neutral-content">eller</div>
          <LoginBox @submit="login" description="aslkasdjf" :error="error" title="Logga in" />
        </div>
        <p class="z-30 self-end text-base-300/40 justify-self-end text-xs m-2">Bakgrundsbild skapad av <a class="link"
            href="https://unsplash.com/@fakurian?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Milad
            Fakurian</a> på <a class="link"
            href="https://unsplash.com/photos/an-abstract-purple-background-with-wavy-lines-DX7pT_guAyE?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Unsplash</a>
        </p>
      </div>
    </div>
    <!-- </div> -->
  </div>
</template>

<script setup lang="ts">

// Imports
import unsplashBackground from '@/assets/milad-fakurian-DX7pT_guAyE-unsplash.jpg';
import { useRouter } from 'vue-router';
// import { useClientStore } from '@/stores/clientStore';
import { onMounted, ref, shallowRef } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { hasAtLeastSecurityRole, type UserRole } from 'schemas';
import { useConnectionStore } from '@/stores/connectionStore';
import LoginBox from '@/components/LoginBox.vue';
import { autoResetRef } from '@vueuse/core';
import GuestBox from '@/components/GuestBox.vue';
// import StreamListView from '@/views/public/StreamListView.vue';

const showDevLoginButtons = import.meta.env.DEV;
// const showDevLoginButtons = false;

// Router
const router = useRouter();
const fromRoute = router.currentRoute.value.redirectedFrom;
console.log('redirected from', fromRoute);
const defaultLoginRedirect = router.currentRoute.value.meta.afterLoginRedirect;
console.log('explicit redirect after login:', defaultLoginRedirect);

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
  console.log('Login called with credentials:', username, password);
  try{
    await authStore.login(username, password);
    // console.log('Login as role', authStore.role);
    if(defaultLoginRedirect){
      // console.log('redirectAfterLogin', props.redirectAfterLogin);
      router.push({name: defaultLoginRedirect});
    } else if(fromRoute && fromRoute.path !== '/'){
      // console.log('fromRoute', fromRoute);
      router.push(fromRoute);
    } else {
      // console.log('Regular login', authStore.role);
      // router.push('/');
      router.push({ name: 'start' });
      // if (authStore.role && hasAtLeastSecurityRole(authStore.role, 'admin')) {
      //   router.push({name: 'adminHome'});
      // }
      // else {
      //   router.push({name: 'userHome'});
      // }

    }
  }
  catch(e: unknown){
    console.error(e);
    if(e instanceof Error){
      error.value = e;
    }
  }
};

</script>

