<template>
  <MaxWidth7xl>
    <div class="w-fit mx-auto flex flex-col items-start gap-8">
      <h1 class=" text-3xl font-bold">
        Hantera användare
      </h1>
      <div v-if="hasAtLeastSecurityRole(authStore.role, 'admin')" class="space-y-4">
        <h3>
          Skapa ny användare
        </h3>
        <div class="flex gap-6 items-end">
          <div>
            <label class="flex items-center gap-2">
              <span class="label-text">Användarnamn:</span>
            </label>
            <input v-model="createdUsername" placeholder="Ange användarnamn" class="input input-bordered ">
          </div>
          <div>
            <label class="flex items-center gap-2">
              <span class="label-text">Rättighetsnivå:</span>
            </label>
            <select v-model="createdRole" class="select select-bordered w-full max-w-xs">
              <option v-for="r in creatableRoles" :value="r.value" :key="r.value">
                {{ r.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="flex items-center gap-2">
              <span class="label-text">Lösenord:</span>
            </label>
            <input v-model="createdPassword" class="input input-bordered ">
          </div>
          <div>
            <button @click="makeCallThenResetList(() => createUser(createdUsername, createdPassword, createdRole))"
              class="btn  btn-primary whitespace-nowrap flex-nowrap">
              <span class="material-icons">add</span>
              Lägg till
            </button>
          </div>
        </div>
        <h3>
          Befintliga användare
        </h3>
        <div class="flex flex-wrap gap-2">
          <label v-for="role in fetchedRoles" class="btn btn-xs gap-1 rounded-full leading-none"
            :class="`has-[:checked]:${getClassForRole(role.value)}`">
            <input v-model="roleFilter[role.value]" type="checkbox" class="hidden" />
            <span class="text-sm leading-none material-icons">{{ roleFilter[role.value] ? 'done' :
              'done_outline' }}</span>{{
                role.label }}
          </label>
          <button v-if="filterActive" @click="clearFilters"
            class="btn btn-neutral btn-circle btn-xs material-icons">clear</button>
        </div>
        <div class="grid grid-cols-[auto_auto_1fr_auto_auto] gap-x-4 gap-y-1">
          <div v-for="user in filteredUsers" :key="user.userId" class="grid grid-cols-subgrid col-span-5 items-center">
            <template v-if="editedUserId === user.userId">
              <input v-model="editedUsername" class="input input-bordered input-sm px-3 text-base font-bold"
                placeholder="Användarnamn"
                @keyup.enter="updateEditedUser({ userId: editedUserId, username: editedUsername, password: editedPassword === '' ? undefined : editedPassword })">
              <select v-model="editedRole" class="select select-bordered select-sm w-full max-w-xs">
                <option v-for="r in creatableRoles" :value="r.value" :key="r.value">
                  {{ r.label }}
                </option>
              </select>
              <div class="justify-self-start tooltip cursor-help" data-tip="Lämna blankt för att inte ändra">
                <input v-model="editedPassword" class="input input-bordered input-sm px-3" placeholder="Lösenord"
                  @keyup.enter="updateEditedUser({ userId: editedUserId, username: editedUsername, password: editedPassword === '' ? undefined : editedPassword })">
                <!-- <span class="material-icons">help</span> -->
              </div>
              <button
                @click="updateEditedUser({ userId: editedUserId, username: editedUsername, password: editedPassword === '' ? undefined : editedPassword })"
                class="btn btn-primary">
                <span class="material-icons">save</span>
              </button>
              <button @click="editedUserId = undefined" class="btn btn-ghost">
                <span class="material-icons">cancel</span>
              </button>
            </template>
            <template v-else>
              <div class="text-base font-bold ml-3">
                {{ user.username }}
              </div>
              <span
                class="text-xs col-span-2 justify-self-start flex items-center leading-none h-6 px-2 font-semibold rounded-full"
                :class="getClassForRole(user.role)">
                {{ translateUserRole(user.role) }}
              </span>
              <button
                @click="editedUserId = user.userId; editedUsername = user.username; editedPassword = ''; editedRole = user.role"
                class="btn">
                <span class="material-icons">edit</span>
              </button>
              <button @click="makeCallThenResetList(() => deleteUser(user.userId))" class="btn btn-error">
                <span class="material-icons">delete</span>
              </button>
            </template>
          </div>
        </div>
      </div>
      <div v-else>
        <!-- Vad gör du här? Du får inte vara här. -->
        Du saknar behörighet till den här sidan.
      </div>
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore';
import { computed, onBeforeMount, reactive, ref } from 'vue';
import { createUser, getAdmins, updateUser, deleteUser, getUsers } from '@/modules/authClient';
import { allRolesBelow, hasAtLeastSecurityRole, roleHierarchy, translateUserRole, type UserRole } from 'schemas';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';

// Use imports
const authStore = useAuthStore();
const creatableRoles = computed(() => {
  if (!authStore.role) return [];
  const rolesBelowUser = allRolesBelow(authStore.role);
  const unuseRolesExcluded = rolesBelowUser.filter(r => r !== 'moderator' && r !== 'guest')
  return unuseRolesExcluded.map(r => ({ value: r, label: translateUserRole(r) })).reverse();
})

function getClassForRole(role: UserRole) {
  switch (role) {
    case 'guest':
      return 'bg-blue-300'; // has-[:checked]:bg-blue-300
    case 'user':
      return 'bg-sky-500';// has-[:checked]:bg-sky-500
    case 'moderator':
      return 'bg-emerald-500'; // has-[:checked]:bg-emerald-500
    case 'admin':
      return 'bg-amber-600'; // has-[:checked]:bg-amber-600
    case 'superadmin':
      return 'bg-orange-700'; // has-[:checked]:bg-orange-700
    case 'gunnar':
      return 'bg-fuchsia-800'; // has-[:checked]:bg-fuchsia-800
    default:
      console.warn('switch not exhausted when calculating class for userRole');
      return 'bg-slate-400'; // has-[:checked]:bg-slate-400
  }
}

const createdUsername = ref('');
const createdPassword = ref('');
const createdRole = ref<UserRole>('guest');


const fetchedUsers = ref<Awaited<ReturnType<typeof getUsers>>>([]);
const fetchedRoles = computed(() => {
  const roles = new Set<UserRole>();
  fetchedUsers.value.forEach(user => (roles.add(user.role)));
  // we want to have the filters in order of hierarchy. Thats why we perhaps seemingly unnecassary filter on the rolehierarchy.
  return roleHierarchy.filter(r => roles.has(r)).map(r => ({ value: r, label: translateUserRole(r) })).reverse();
})
const roleFilter = reactive<Record<UserRole, boolean>>({
  guest: false,
  user: false,
  moderator: false,
  admin: false,
  superadmin: false,
  gunnar: false,
})
const pickedRoleFilters = computed(() => {
  const filterArr = Object.entries(roleFilter)
  const activeFiltersArr = filterArr.filter(([k, active]) => active);
  return activeFiltersArr.map(([k, _active]) => k);
})
const filterActive = computed(() => {
  const filterArr = Object.entries(roleFilter)
  return filterArr.some(([k, active]) => active);
})
function clearFilters() {
  for (const key of Object.keys(roleFilter) as UserRole[]) {
    roleFilter[key] = false;
  }
}
const filteredUsers = computed(() => {
  if (!filterActive.value) return fetchedUsers.value;
  return fetchedUsers.value.filter(user => pickedRoleFilters.value.includes(user.role));
})

const editedUserId = ref<string>();
const editedUsername = ref<string>();
const editedPassword = ref<string>();
const editedRole = ref<(typeof creatableRoles.value[number])['value']>();

async function updateEditedUser(userData: any) {
  const response = await updateUser(userData);
  console.log(response);
  if (!fetchedUsers.value) {
    console.error('users undefined!');
  }
  console.log(fetchedUsers.value);
  const idx = fetchedUsers.value.findIndex(a => {
    return a.userId === userData.userId;
  });
  console.log('index:', idx);
  if (idx >= 0) {
    fetchedUsers.value[idx] = response;
  }
  editedUserId.value = undefined;
}

onBeforeMount(async () => {
  fetchedUsers.value = await getUsers();
  console.log(fetchedUsers.value);
});

async function makeCallThenResetList(fetchReq: (...p: any) => Promise<any>) {
  await fetchReq();
  editedUserId.value = undefined;
  createdUsername.value = '';
  createdPassword.value = '';
  fetchedUsers.value = await getUsers();
}

</script>
