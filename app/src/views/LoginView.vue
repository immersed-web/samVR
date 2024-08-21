<template>
  <div>
    <!-- <div class="min-h-screen hero bg-base-200"> -->
    <div class="flex flex-col lg:flex-row-reverse min-h-screen">
      <!-- <div class="flex-row lg:flex-row gap-10 "> -->

      <!-- Info text -->
      <div class="flex-1 hero">
        <div class="card">
          <div class="card-body">
            <h1 class="mb-2">
              SamVR
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
      <div class="flex-1 hero"
        style="background-image: url(https://plus.unsplash.com/premium_photo-1663091704223-cc051e0f0c47?q=80&w=2073&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D);">
        <div class="hero-content max-w-md">
          <div>
            <div class="shadow-2xl card bg-base-100">
              <div class="card-body">
                <form class="" @submit.prevent="login">
                  <h2 class="mb-2">
                    Logga in
                  </h2>
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">Användarnamn</span>
                    </label>
                    <input v-model="username" type="text" placeholder="Användarnamn" class="input input-bordered">
                  </div>
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">Lösenord</span>
                    </label>
                    <input v-model="password" type="password" placeholder="Lösenord" class="input input-bordered">
                  </div>
                  <div v-if="error" class="alert bg-error">
                    {{ error }}
                  </div>
                  <div class="mt-6 form-control">
                    <button type="submit" class="btn btn-primary">
                      Logga in
                    </button>
                  </div>
                </form>
                <div v-once v-if="showDevLoginButtons" class="space-x-2 text-sm">
                  <div class="divider">
                    Hackare?
                  </div>
                  Smit in som:
                  <!-- <div class="space-x-2"> -->
                  <button @click="loginDetails('klas', '123')" class="btn btn-xs btn-primary btn-outline">
                    Klas <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                      <path fill-rule="evenodd"
                        d="M5 4a.75.75 0 0 1 .738.616l.252 1.388A1.25 1.25 0 0 0 6.996 7.01l1.388.252a.75.75 0 0 1 0 1.476l-1.388.252A1.25 1.25 0 0 0 5.99 9.996l-.252 1.388a.75.75 0 0 1-1.476 0L4.01 9.996A1.25 1.25 0 0 0 3.004 8.99l-1.388-.252a.75.75 0 0 1 0-1.476l1.388-.252A1.25 1.25 0 0 0 4.01 6.004l.252-1.388A.75.75 0 0 1 5 4ZM12 1a.75.75 0 0 1 .721.544l.195.682c.118.415.443.74.858.858l.682.195a.75.75 0 0 1 0 1.442l-.682.195a1.25 1.25 0 0 0-.858.858l-.195.682a.75.75 0 0 1-1.442 0l-.195-.682a1.25 1.25 0 0 0-.858-.858l-.682-.195a.75.75 0 0 1 0-1.442l.682-.195a1.25 1.25 0 0 0 .858-.858l.195-.682A.75.75 0 0 1 12 1ZM10 11a.75.75 0 0 1 .728.568.968.968 0 0 0 .704.704.75.75 0 0 1 0 1.456.968.968 0 0 0-.704.704.75.75 0 0 1-1.456 0 .968.968 0 0 0-.704-.704.75.75 0 0 1 0-1.456.968.968 0 0 0 .704-.704A.75.75 0 0 1 10 11Z"
                        clip-rule="evenodd" />
                    </svg>
                  </button>
                  <button @click="loginDetails('göran', '123')" class="btn btn-xs btn-primary btn-outline">
                    Göran <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                      class="size-4">
                      <path
                        d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
                    </svg>
                  </button>
                  <button @click="loginDetails('fia', '123')" class="btn btn-xs btn-primary btn-outline">
                    Fia <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
                      <path
                        d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
                    </svg>
                  </button>
                  <!-- </div> -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- </div> -->
  </div>
</template>

<script setup lang="ts">

// Imports
import { useRouter } from 'vue-router';
// import { useClientStore } from '@/stores/clientStore';
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { hasAtLeastSecurityRole, type UserRole } from 'schemas';
import { useConnectionStore } from '@/stores/connectionStore';
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

// View / components functionality
const username = ref('');
const password = ref('');
const error = ref('');

const login = async () => {
  try{
    // await clientStore.login(username.value, password.value);
    await authStore.login(username.value, password.value);
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
      if (authStore.role && hasAtLeastSecurityRole(authStore.role, 'admin')) {
        router.push({name: 'adminHome'});
      }
      else {
        router.push({name: 'userHome'});
      }

    }
  }
  catch(e: unknown){
    console.error(e);
    if(e instanceof Error){
      error.value = e.message;
    }
  }
};


const loginDetails = (un: string, pwd: string) => {
  username.value = un;
  password.value = pwd;
  login();
};

</script>

