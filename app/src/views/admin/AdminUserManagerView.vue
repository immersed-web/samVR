<template>
  <MaxWidth7xl>
    <div class="flex flex-col items-start gap-8">
      <h1 class=" text-3xl font-bold">
        Hantera användare
      </h1>
      <div v-if="hasAtLeastSecurityRole(authStore.role, 'superadmin')" class="space-y-6">
        <div class="space-y-2">
          <h3>
            Skapa ny användare
          </h3>
          <div class="flex gap-6 items-end">
            <div>
              <label class="flex items-center gap-2">
                <span class="label-text">Användarnamn:</span>
              </label>
              <input v-model="adminUsername" placeholder="Ange användarnamn" class="input input-bordered ">
            </div>
            <div>
              <label class="flex items-center gap-2">
                <span class="label-text">Rättighetsnivå:</span>
              </label>
              <select v-model="role" class="select select-bordered w-full max-w-xs">
                <option v-for="(r, i) in roleHierarchy" :key="i">
                  {{ r }}
                </option>
              </select>
            </div>
            <div>
              <label class="flex items-center gap-2">
                <span class="label-text">Lösenord:</span>
              </label>
              <input v-model="adminPassword" class="input input-bordered ">
            </div>
            <div>
              <button @click="makeCallThenResetList(() => createUser(adminUsername, adminPassword, role))"
                class="btn  btn-primary whitespace-nowrap flex-nowrap">
                <span class="material-icons">add</span>
                Lägg till
              </button>
            </div>
          </div>
        </div>
        <!-- <div class="space-y-2">
        <h3>
          Skapa ny admin
        </h3>
        <div class="flex gap-6">
          <label class="flex items-center gap-2">
            <span class="font-bold">Användarnamn:</span>
            <input v-model="adminUsername" class="input input-bordered ">
          </label>
          <label class="flex items-center gap-2">
            <span class="font-bold">Lösenord:</span>
            <input v-model="adminPassword" class="input input-bordered ">
          </label>
          <button @click="makeCallThenResetList(() => createAdmin(adminUsername, adminPassword))"
            class="btn  btn-primary">
            <span class="material-icons">add</span>
            Lägg till
          </button>
        </div>
      </div> -->
        <div>
          <h3>
            Befintliga adminanvändare
          </h3>
          <div class="">
            <table class="table">
              <tbody>
                <tr v-for="admin in admins" :key="admin.userId">
                  <template v-if="editedUserId === admin.userId">
                    <td class="text-base font-bold">
                      <input v-model="editedUsername" class="input input-bordered" placeholder="Användarnamn"
                        @keyup.enter="updateAdmin({ userId: editedUserId, username: editedUsername, password: editedPassword === '' ? undefined : editedPassword })">
                    </td>
                    <td>
                      <div class="tooltip cursor-help" data-tip="Lämna blankt för att inte ändra">
                        <input v-model="editedPassword" class="input input-bordered" placeholder="Lösenord"
                          @keyup.enter="updateAdmin({ userId: editedUserId, username: editedUsername, password: editedPassword === '' ? undefined : editedPassword })">
                        <!-- <span class="material-icons">help</span> -->
                      </div>
                    </td>
                    <td class="flex gap-2 justify-end">
                      <button
                        @click="updateAdmin({ userId: editedUserId, username: editedUsername, password: editedPassword === '' ? undefined : editedPassword })"
                        class="btn btn-primary">
                        <span class="material-icons">save</span>
                      </button>
                      <button @click="editedUserId = undefined" class="btn btn-ghost">
                        <span class="material-icons">cancel</span>
                      </button>
                    </td>
                  </template>
                  <template v-else>
                    <td class="text-base font-bold">
                      {{ admin.username }}
                    </td>
                    <td />
                    <td class="flex gap-2 justify-end">
                      <button @click="editedUserId = admin.userId; editedUsername = admin.username; editedPassword = ''"
                        class="btn">
                        <span class="material-icons">edit</span>
                      </button>
                      <button @click="makeCallThenResetList(() => deleteUser(admin.userId))" class="btn btn-error">
                        <span class="material-icons">delete</span>
                      </button>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div v-else>
        Vad gör du här? Du får inte vara här.
      </div>
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore';
import { computed, onBeforeMount, ref, Ref } from 'vue';
import { createAdmin, createUser, getAdmins, updateUser, deleteUser } from '@/modules/authClient';
import { hasAtLeastSecurityRole, roleHierarchy, type UserRole } from 'schemas';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';

// Use imports
const authStore = useAuthStore();

const adminUsername = ref('');
const adminPassword = ref('');
const adminRole: Ref<UserRole> = ref('guest');

const admins = ref<Awaited<ReturnType<typeof getAdmins>>>([]);

const editedUserId = ref<string>();
const editedUsername = ref<string>();
const editedPassword = ref<string>();

async function updateAdmin(userData: any) {
  const response = await updateUser(userData);
  console.log(response);
  if (!admins.value) {
    console.error('admins undefined!');
  }
  console.log(admins.value);
  const idx = admins.value.findIndex(a => {
    return a.userId === userData.userId;
  });
  console.log('index:', idx);
  if (idx >= 0) {
    admins.value[idx] = response;
  }
  editedUserId.value = undefined;
}

onBeforeMount(async () => {
  admins.value = await getAdmins();
  console.log(admins.value);
});

async function makeCallThenResetList(fetchReq: (...p: any) => Promise<any>) {
  await fetchReq();
  editedUserId.value = undefined;
  adminUsername.value = '';
  adminPassword.value = '';
  admins.value = await getAdmins();
}

</script>
