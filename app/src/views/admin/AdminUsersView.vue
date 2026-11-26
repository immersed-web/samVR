<template>
  <div class="w-full max-w-[100rem] mx-auto px-4 py-6 flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">Hantera användare</h1>
        <p class="text-sm text-base-content/60">Sök, spärra, återställ lösenord och skicka meddelanden till alla konton i SamVR.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="openMessage({ mode: 'org' })">
          <span class="material-icons">campaign</span> Meddelande till organisation
        </button>
        <button class="btn btn-primary btn-sm" @click="openCreate">
          <span class="material-icons">person_add</span> Skapa konto
        </button>
      </div>
    </div>

    <div v-if="errorMessage" role="alert" class="alert alert-error"><span>{{ errorMessage }}</span>
      <button class="btn btn-sm btn-ghost" @click="errorMessage = ''">Stäng</button>
    </div>
    <div v-if="notice" role="status" class="alert alert-success"><span>{{ notice }}</span>
      <button class="btn btn-sm btn-ghost" @click="notice = ''">Stäng</button>
    </div>

    <!-- Overview: click to filter -->
    <div v-if="summary" class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <button class="stats bg-base-200 border border-base-300 text-left hover:border-primary" :class="{ 'border-primary': isFilter('all') }" @click="applyQuick('all')">
        <span class="stat"><span class="stat-title whitespace-normal">Konton</span><span class="stat-value">{{ summary.total }}</span></span>
      </button>
      <button class="stats bg-base-200 border border-base-300 text-left hover:border-primary" :class="{ 'border-primary': isFilter('none') }" @click="applyQuick('none')">
        <span class="stat"><span class="stat-title whitespace-normal">Utan organisation (privatpersoner)</span><span class="stat-value">{{ summary.withoutOrganization }}</span></span>
      </button>
      <button class="stats bg-base-200 border border-base-300 text-left hover:border-primary" :class="{ 'border-primary': isFilter('blocked') }" @click="applyQuick('blocked')">
        <span class="stat"><span class="stat-title whitespace-normal">Spärrade</span><span class="stat-value" :class="{ 'text-error': summary.blocked }">{{ summary.blocked }}</span></span>
      </button>
      <div class="stats bg-base-200 border border-base-300 text-left">
        <span class="stat"><span class="stat-title whitespace-normal">Har aldrig loggat in</span><span class="stat-value">{{ summary.neverLoggedIn }}</span></span>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="flex flex-wrap items-end gap-3">
      <label class="input input-bordered flex items-center gap-2 grow min-w-[16rem] max-w-xl">
        <span class="material-icons text-base opacity-60">search</span>
        <input v-model="filters.search" type="search" class="grow" placeholder="Sök på användarnamn eller organisation" aria-label="Sök användare">
      </label>
      <label class="flex flex-col text-xs gap-1">Roll
        <select v-model="filters.role" class="select select-bordered select-sm">
          <option value="">Alla roller</option>
          <option v-for="r in assignableFilterRoles" :key="r" :value="r">{{ roleLabel(r) }}</option>
        </select>
      </label>
      <label class="flex flex-col text-xs gap-1">Organisation
        <select v-model="filters.org" class="select select-bordered select-sm max-w-[14rem]">
          <option value="">Alla</option>
          <option value="none">Utan organisation</option>
          <option v-for="o in summary?.organizations ?? []" :key="o.organizationId" :value="o.organizationId">{{ o.name }}</option>
        </select>
      </label>
      <label class="flex flex-col text-xs gap-1">Status
        <select v-model="filters.status" class="select select-bordered select-sm">
          <option value="all">Alla</option>
          <option value="active">Aktiva</option>
          <option value="blocked">Spärrade</option>
        </select>
      </label>
      <label class="flex flex-col text-xs gap-1">Sortera
        <span class="join">
          <select v-model="filters.sort" class="select select-bordered select-sm join-item">
            <option value="username">Namn</option>
            <option value="createdAt">Skapad</option>
            <option value="lastLoginAt">Senast inloggad</option>
            <option value="role">Roll</option>
          </select>
          <button class="btn btn-sm join-item" :title="filters.order === 'asc' ? 'Stigande' : 'Fallande'"
            @click="filters.order = filters.order === 'asc' ? 'desc' : 'asc'">
            <span class="material-icons text-base">{{ filters.order === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
          </button>
        </span>
      </label>
      <button v-if="hasFilters" class="btn btn-ghost btn-sm" @click="clearFilters">Rensa filter</button>
    </div>

    <!-- Bulk actions -->
    <div v-if="selected.length" class="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
      <strong>{{ selected.length }} valda</strong>
      <button class="btn btn-sm btn-primary" @click="openMessage({ mode: 'users', userIds: selected })">
        <span class="material-icons">mail</span> Skicka meddelande
      </button>
      <button class="btn btn-sm btn-outline btn-error" @click="bulkBlock(true)"><span class="material-icons">block</span> Spärra</button>
      <button class="btn btn-sm btn-outline" @click="bulkBlock(false)"><span class="material-icons">lock_open</span> Häv spärr</button>
      <button class="btn btn-sm btn-ghost" @click="selected = []">Avmarkera</button>
    </div>

    <!-- Users -->
    <div class="overflow-x-auto rounded-lg border border-base-300">
      <table class="table table-sm md:table-md">
        <thead>
          <tr>
            <th class="w-8"><input type="checkbox" class="checkbox checkbox-sm" :checked="allOnPageSelected" aria-label="Markera alla på sidan" @change="togglePage"></th>
            <th>Användare</th>
            <th>Roll</th>
            <th>Organisation</th>
            <th>Miljöer</th>
            <th>Skapad</th>
            <th>Senast inloggad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="text-center py-8"><span class="loading loading-spinner"></span></td></tr>
          <tr v-else-if="!users.length"><td colspan="8" class="text-center py-8 text-base-content/60">Inga användare matchar sökningen.</td></tr>
          <tr v-for="u in users" :key="u.userId" class="hover cursor-pointer" :class="{ 'opacity-70': u.blockedAt }" @click="openDetails(u.userId)">
            <td @click.stop><input v-model="selected" type="checkbox" class="checkbox checkbox-sm" :value="u.userId" :aria-label="`Markera ${u.username}`"></td>
            <td>
              <div class="font-semibold">{{ u.username }}</div>
              <span v-if="u.blockedAt" class="badge badge-error badge-sm gap-1"><span class="material-icons text-xs">block</span>Spärrad</span>
            </td>
            <td><span class="badge badge-sm" :class="roleBadge(u.role)">{{ roleLabel(u.role) }}</span></td>
            <td>
              <span v-if="!u.organizations.length" class="text-base-content/50 text-sm">Privatperson</span>
              <div v-else class="flex flex-wrap gap-1">
                <span v-for="o in u.organizations.slice(0, 2)" :key="o.organizationId" class="badge badge-outline badge-sm">{{ o.name }}</span>
                <span v-if="u.organizations.length > 2" class="badge badge-ghost badge-sm">+{{ u.organizations.length - 2 }}</span>
              </div>
            </td>
            <td>{{ u.spaceCount }}</td>
            <td class="whitespace-nowrap text-sm">{{ formatDay(u.createdAt) }}</td>
            <td class="whitespace-nowrap text-sm">{{ u.lastLoginAt ? formatDay(u.lastLoginAt) : 'Aldrig' }}</td>
            <td class="text-right"><button class="btn btn-ghost btn-xs" @click.stop="openDetails(u.userId)">Öppna <span class="material-icons text-base">chevron_right</span></button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{{ total ? `Visar ${offset + 1}–${Math.min(offset + limit, total)} av ${total}` : 'Inga träffar' }}</span>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1">Per sida
          <select v-model.number="limit" class="select select-bordered select-xs">
            <option :value="25">25</option><option :value="50">50</option><option :value="100">100</option>
          </select>
        </label>
        <button class="btn btn-sm" :disabled="offset === 0" @click="offset = Math.max(0, offset - limit)">Föregående</button>
        <button class="btn btn-sm" :disabled="offset + limit >= total" @click="offset += limit">Nästa</button>
      </div>
    </div>

    <!-- Details drawer -->
    <dialog v-if="selectedId" class="modal modal-open" @click.self="closeDetails">
      <div class="modal-box max-w-xl max-h-[92vh] overflow-y-auto">
        <div v-if="detailsLoading" class="py-10 text-center"><span class="loading loading-spinner"></span></div>
        <template v-else-if="details">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-2xl font-bold">{{ details.user.username }}</h2>
              <div class="flex flex-wrap gap-1 mt-1">
                <span class="badge badge-sm" :class="roleBadge(details.user.role)">{{ roleLabel(details.user.role) }}</span>
                <span v-if="details.user.blockedAt" class="badge badge-error badge-sm">Spärrad</span>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-circle" aria-label="Stäng" @click="closeDetails"><span class="material-icons">close</span></button>
          </div>

          <div v-if="details.user.blockedAt" role="alert" class="alert alert-warning mt-3 text-sm">
            <span>Spärrad {{ formatDay(details.user.blockedAt) }}<span v-if="details.user.blockedReason">: {{ details.user.blockedReason }}</span></span>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-4">
            <dt class="text-base-content/60">Skapad</dt><dd>{{ formatDay(details.user.createdAt) }}</dd>
            <dt class="text-base-content/60">Senast inloggad</dt><dd>{{ details.user.lastLoginAt ? formatDay(details.user.lastLoginAt) : 'Aldrig' }}</dd>
            <dt class="text-base-content/60">Egna miljöer</dt><dd>{{ details.spaces.length }}</dd>
            <dt class="text-base-content/60">Meddelanden</dt><dd>{{ details.messages.received }} ({{ details.messages.unread }} olästa)</dd>
          </dl>

          <h3 class="font-semibold mt-5 mb-1">Organisationer</h3>
          <p v-if="!details.organizations.length" class="text-sm text-base-content/60">Ingen. Det här är en privatperson.</p>
          <ul class="text-sm space-y-1">
            <li v-for="o in details.organizations" :key="o.organizationId">
              <strong>{{ o.name }}</strong> <span class="badge badge-ghost badge-sm">{{ orgRoleLabel(o.role) }}</span>
            </li>
          </ul>

          <h3 class="font-semibold mt-5 mb-1">Egna miljöer</h3>
          <p v-if="!details.spaces.length" class="text-sm text-base-content/60">Inga.</p>
          <ul class="text-sm space-y-1 max-h-32 overflow-y-auto">
            <li v-for="s in details.spaces" :key="s.vrSpaceId">{{ s.name }} <span class="text-base-content/50">· {{ translateVisibility(s.visibility as never) }}</span></li>
          </ul>

          <div class="divider"></div>

          <p v-if="!details.canManage" class="text-sm text-base-content/60">
            Du kan inte ändra det här kontot (det är ditt eget, eller har samma eller högre roll).
            <button class="btn btn-ghost btn-xs" @click="openMessage({ mode: 'users', userIds: [details.user.userId] })">Skicka meddelande ändå</button>
          </p>

          <div v-else class="space-y-5">
            <!-- Rename + role -->
            <section class="space-y-2">
              <h3 class="font-semibold">Konto</h3>
              <div class="flex gap-2">
                <input v-model="editName" class="input input-bordered input-sm grow" maxlength="100" aria-label="Användarnamn">
                <button class="btn btn-sm" :disabled="busy || editName.trim().length < 2 || editName.trim() === details.user.username" @click="saveName">Byt namn</button>
              </div>
              <div class="flex gap-2">
                <select v-model="editRole" class="select select-bordered select-sm grow" aria-label="Roll">
                  <option v-for="r in details.assignableRoles" :key="r" :value="r">{{ roleLabel(r) }}</option>
                </select>
                <button class="btn btn-sm" :disabled="busy || editRole === details.user.role" @click="saveRole">Ändra roll</button>
              </div>
              <p class="text-xs text-base-content/60">Ändrad roll gäller från nästa inloggning, och personen loggas ut nu.</p>
            </section>

            <!-- Password -->
            <section class="space-y-2">
              <h3 class="font-semibold">Återställ lösenord</h3>
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-sm btn-primary" :disabled="busy" @click="resetPassword()">
                  <span class="material-icons">key</span> Skapa tillfälligt lösenord
                </button>
              </div>
              <div class="flex gap-2">
                <input v-model="customPassword" type="password" autocomplete="new-password" class="input input-bordered input-sm grow" placeholder="…eller skriv ett eget (minst 8 tecken)">
                <button class="btn btn-sm" :disabled="busy || customPassword.length < 8" @click="resetPassword(customPassword)">Sätt</button>
              </div>
              <div v-if="generatedPassword" role="status" class="rounded-lg bg-success/15 border border-success/40 p-3 space-y-2 text-sm">
                <div class="font-semibold">Nytt lösenord för {{ details.user.username }}. Det visas bara nu.</div>
                <div class="flex gap-2 w-full">
                  <input :value="generatedPassword" readonly class="input input-bordered input-sm grow font-mono" @focus="($event.target as HTMLInputElement).select()">
                  <button class="btn btn-sm" @click="copy(generatedPassword)">{{ copied ? 'Kopierat!' : 'Kopiera' }}</button>
                </div>
                <span>Alla inloggningar med det gamla lösenordet har avslutats. Ge lösenordet till personen och be hen byta det.</span>
              </div>
            </section>

            <!-- Message -->
            <section class="space-y-2">
              <h3 class="font-semibold">Meddelande</h3>
              <button class="btn btn-sm" @click="openMessage({ mode: 'users', userIds: [details.user.userId] })">
                <span class="material-icons">mail</span> Skicka meddelande
              </button>
            </section>

            <!-- Block -->
            <section class="space-y-2">
              <h3 class="font-semibold">Spärr</h3>
              <template v-if="!details.user.blockedAt">
                <input v-model="blockReason" class="input input-bordered input-sm w-full" maxlength="500" placeholder="Anledning (valfri, syns bara för administratörer)">
                <button class="btn btn-sm btn-outline btn-error" :disabled="busy" @click="setBlocked(true)">
                  <span class="material-icons">block</span> Spärra kontot
                </button>
                <p class="text-xs text-base-content/60">Personen loggas ut direkt och kan inte logga in tills spärren hävs. Kontot och allt som hör till det finns kvar.</p>
              </template>
              <button v-else class="btn btn-sm btn-outline" :disabled="busy" @click="setBlocked(false)">
                <span class="material-icons">lock_open</span> Häv spärren
              </button>
            </section>

            <!-- Delete -->
            <section class="space-y-2 rounded-lg border border-error/40 p-3">
              <h3 class="font-semibold text-error">Radera kontot</h3>
              <p class="text-sm">
                Kontot och allt personen äger tas bort för alltid<span v-if="details.spaces.length">, bland annat {{ details.spaces.length }} miljö{{ details.spaces.length === 1 ? '' : 'er' }}</span>. Det går inte att ångra.
                Vill du bara stänga ute personen är <strong>Spärra</strong> ett bättre val.
              </p>
              <input v-model="deleteConfirm" class="input input-bordered input-sm w-full" :placeholder="`Skriv ${details.user.username} för att bekräfta`">
              <button class="btn btn-sm btn-error" :disabled="busy || deleteConfirm !== details.user.username" @click="deleteUser">
                <span class="material-icons">delete_forever</span> Radera permanent
              </button>
            </section>
          </div>
        </template>
      </div>
    </dialog>

    <!-- Create account -->
    <dialog v-if="createDialog" class="modal modal-open" @click.self="createDialog = false">
      <form class="modal-box max-w-md space-y-3" @submit.prevent="createUser">
        <h3 class="text-lg font-bold">Skapa konto</h3>
        <template v-if="!createdAccount">
          <label class="form-control"><span class="label-text">Användarnamn</span>
            <input v-model="newAccount.username" class="input input-bordered" required minlength="2" maxlength="100" autocomplete="off"></label>
          <label class="form-control"><span class="label-text">Roll</span>
            <select v-model="newAccount.role" class="select select-bordered">
              <option v-for="r in createRoles" :key="r" :value="r">{{ roleLabel(r) }}</option>
            </select></label>
          <label class="form-control"><span class="label-text">Lösenord (lämna tomt för att skapa ett tillfälligt)</span>
            <input v-model="newAccount.password" type="password" autocomplete="new-password" class="input input-bordered" placeholder="Minst 8 tecken"></label>
          <p class="text-xs text-base-content/60">Vill du lägga kontot i en organisation gör du det under Organisationer. Personer i organisationer skapas lättast där.</p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="createDialog = false">Avbryt</button>
            <button type="submit" class="btn btn-primary" :disabled="busy || newAccount.username.trim().length < 2 || (!!newAccount.password && newAccount.password.length < 8)">Skapa</button>
          </div>
        </template>
        <template v-else>
          <div role="status" class="rounded-lg bg-success/15 border border-success/40 p-3 space-y-2 text-sm">
            <div class="font-semibold">Kontot {{ createdAccount.username }} är skapat.</div>
            <template v-if="createdAccount.password">
              <div>Tillfälligt lösenord (visas bara nu):</div>
              <div class="flex gap-2 w-full">
                <input :value="createdAccount.password" readonly class="input input-bordered input-sm grow font-mono" @focus="($event.target as HTMLInputElement).select()">
                <button type="button" class="btn btn-sm" @click="copy(createdAccount.password!)">{{ copied ? 'Kopierat!' : 'Kopiera' }}</button>
              </div>
            </template>
          </div>
          <div class="modal-action"><button type="button" class="btn btn-primary" @click="createDialog = false">Klar</button></div>
        </template>
      </form>
    </dialog>

    <!-- Message -->
    <dialog v-if="messageDialog" class="modal modal-open" @click.self="messageDialog = undefined">
      <form class="modal-box max-w-lg space-y-3" @submit.prevent="sendMessage">
        <h3 class="text-lg font-bold">Skicka meddelande</h3>
        <p class="text-sm text-base-content/70">
          Meddelandet visas i mottagarens inkorg i SamVR (brevikonen högst upp). Det skickas inte som e-post.
        </p>
        <label v-if="messageDialog.mode === 'org'" class="form-control"><span class="label-text">Till alla i organisationen</span>
          <select v-model="messageDialog.organizationId" class="select select-bordered" required>
            <option value="" disabled>Välj organisation…</option>
            <option v-for="o in summary?.organizations ?? []" :key="o.organizationId" :value="o.organizationId">{{ o.name }}</option>
          </select></label>
        <p v-else class="text-sm"><strong>{{ messageDialog.userIds.length }}</strong> mottagare{{ messageDialog.userIds.length === 1 ? '' : '' }}</p>
        <label class="form-control"><span class="label-text">Ämne</span>
          <input v-model="messageDialog.subject" class="input input-bordered" required maxlength="150"></label>
        <label class="form-control"><span class="label-text">Meddelande</span>
          <textarea v-model="messageDialog.body" class="textarea textarea-bordered" rows="6" required maxlength="5000"></textarea></label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="messageDialog = undefined">Avbryt</button>
          <button type="submit" class="btn btn-primary" :disabled="busy || !messageDialog.subject.trim() || !messageDialog.body.trim() || (messageDialog.mode === 'org' && !messageDialog.organizationId)">
            <span class="material-icons">send</span> Skicka
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { allRolesBelow, roleHierarchy, translateVisibility, type UserRole } from 'schemas';
import { useAuthStore } from '@/stores/authStore';
import { manageUsersApi, orgErrorMessage, type ManagedUser, type ManagedUserDetails, type OrgRole, type UsersSummary } from '@/modules/authClient';

const authStore = useAuthStore();

// ---- list state ----
const filters = reactive({ search: '', role: '' as UserRole | '', org: '', status: 'all' as 'all' | 'active' | 'blocked', sort: 'username' as 'username' | 'createdAt' | 'lastLoginAt' | 'role', order: 'asc' as 'asc' | 'desc' });
const offset = ref(0);
const limit = ref(25);
const total = ref(0);
const users = ref<ManagedUser[]>([]);
const summary = ref<UsersSummary>();
const loading = ref(true);
const selected = ref<string[]>([]);
const errorMessage = ref('');
const notice = ref('');
const busy = ref(false);

const hasFilters = computed(() => !!(filters.search || filters.role || filters.org || filters.status !== 'all'));
const assignableFilterRoles = computed(() => roleHierarchy.filter(r => r !== 'guest'));
const createRoles = computed(() => (authStore.role ? allRolesBelow(authStore.role) : []).filter(r => r !== 'guest'));
const allOnPageSelected = computed(() => users.value.length > 0 && users.value.every(u => selected.value.includes(u.userId)));

const roleLabel = (role: UserRole) => ({ god: 'Överchef', superadmin: 'Huvudadmin', admin: 'Administratör', moderator: 'Moderator', user: 'Användare', guest: 'Gäst' })[role];
const roleBadge = (role: UserRole) => ({ god: 'badge-secondary', superadmin: 'badge-secondary', admin: 'badge-primary', moderator: 'badge-accent', user: 'badge-ghost', guest: 'badge-ghost' })[role];
const orgRoleLabel = (role: OrgRole) => ({ org_admin: 'Administratör', member: 'Medlem', basic: 'Användare' })[role];
const formatDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE') : '–');

function fail(e: unknown) { errorMessage.value = orgErrorMessage(e); }

async function loadList() {
  loading.value = true;
  try {
    const result = await manageUsersApi.list({
      search: filters.search.trim() || undefined, role: filters.role || undefined, org: filters.org || undefined,
      status: filters.status, sort: filters.sort, order: filters.order, offset: offset.value, limit: limit.value,
    });
    total.value = result.total;
    users.value = result.users;
    // keep the selection to people that still exist in the result of other pages
  } catch (e) {
    fail(e);
  } finally {
    loading.value = false;
  }
}
async function loadSummary() {
  try { summary.value = await manageUsersApi.summary(); } catch (e) { fail(e); }
}
const refresh = async () => { await Promise.all([loadList(), loadSummary()]); };

// search is debounced; any other filter change starts from the first page
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => filters.search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { offset.value = 0; void loadList(); }, 300);
});
watch(() => [filters.role, filters.org, filters.status, filters.sort, filters.order, limit.value], () => { offset.value = 0; void loadList(); });
watch(offset, () => { void loadList(); });
onBeforeUnmount(() => clearTimeout(searchTimer));
onMounted(refresh);

function clearFilters() { filters.search = ''; filters.role = ''; filters.org = ''; filters.status = 'all'; }
type Quick = 'all' | 'none' | 'blocked';
function applyQuick(kind: Quick) {
  clearFilters();
  if (kind === 'none') filters.org = 'none';
  if (kind === 'blocked') filters.status = 'blocked';
}
const isFilter = (kind: Quick) => (kind === 'all' ? !hasFilters.value : kind === 'none' ? filters.org === 'none' && !filters.search && !filters.role && filters.status === 'all' : filters.status === 'blocked' && !filters.org && !filters.search && !filters.role);

function togglePage() {
  const ids = users.value.map(u => u.userId);
  selected.value = allOnPageSelected.value ? selected.value.filter(id => !ids.includes(id)) : [...new Set([...selected.value, ...ids])];
}

// ---- details drawer ----
const selectedId = ref<string>();
const details = ref<ManagedUserDetails>();
const detailsLoading = ref(false);
const editName = ref('');
const editRole = ref<UserRole>('user');
const customPassword = ref('');
const generatedPassword = ref('');
const blockReason = ref('');
const deleteConfirm = ref('');
const copied = ref(false);

async function openDetails(userId: string) {
  selectedId.value = userId;
  generatedPassword.value = ''; customPassword.value = ''; blockReason.value = ''; deleteConfirm.value = '';
  await loadDetails();
}
async function loadDetails() {
  if (!selectedId.value) return;
  detailsLoading.value = !details.value || details.value.user.userId !== selectedId.value;
  try {
    details.value = await manageUsersApi.get(selectedId.value);
    editName.value = details.value.user.username;
    editRole.value = details.value.user.role;
  } catch (e) {
    fail(e);
    selectedId.value = undefined;
  } finally {
    detailsLoading.value = false;
  }
}
function closeDetails() { selectedId.value = undefined; details.value = undefined; generatedPassword.value = ''; }

/** Run an action, show errors, then refresh the list and the open details. */
async function act(action: () => Promise<unknown>, success?: string) {
  busy.value = true; errorMessage.value = ''; notice.value = '';
  try {
    await action();
    if (success) notice.value = success;
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
  await refresh();
  if (selectedId.value) await loadDetails();
}

const saveName = () => act(() => manageUsersApi.update({ userId: selectedId.value!, username: editName.value.trim() }), 'Användarnamnet är ändrat.');
const saveRole = () => act(() => manageUsersApi.update({ userId: selectedId.value!, role: editRole.value }), 'Rollen är ändrad.');
const setBlocked = (blocked: boolean) => act(async () => {
  await manageUsersApi.block(selectedId.value!, blocked, blockReason.value.trim() || undefined);
  blockReason.value = '';
}, blocked ? 'Kontot är spärrat.' : 'Spärren är hävd.');
async function resetPassword(password?: string) {
  const name = details.value?.user.username ?? '';
  await act(async () => {
    const result = await manageUsersApi.resetPassword(selectedId.value!, password);
    generatedPassword.value = result.password ?? '';
    customPassword.value = '';
  }, password ? `Lösenordet för ${name} är ändrat.` : '');
}
async function deleteUser() {
  const name = details.value?.user.username ?? '';
  await act(async () => { await manageUsersApi.remove(selectedId.value!); closeDetails(); selected.value = selected.value.filter(id => id !== selectedId.value); }, `Kontot ${name} är raderat.`);
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); copied.value = true; setTimeout(() => { copied.value = false; }, 2000); } catch { /* clipboard blocked: the field is selectable */ }
}

// ---- bulk block ----
async function bulkBlock(blocked: boolean) {
  const ids = [...selected.value];
  if (blocked && !confirm(`Spärra ${ids.length} konton? De loggas ut direkt.`)) return;
  busy.value = true; errorMessage.value = ''; notice.value = '';
  const results = await Promise.allSettled(ids.map(id => manageUsersApi.block(id, blocked)));
  busy.value = false;
  const ok = results.filter(r => r.status === 'fulfilled').length;
  notice.value = `${ok} av ${ids.length} konton ${blocked ? 'spärrades' : 'fick spärren hävd'}.` + (ok < ids.length ? ' Resten går inte att ändra (ditt eget konto eller samma/högre roll).' : '');
  selected.value = [];
  await refresh();
}

// ---- create account ----
const createDialog = ref(false);
const newAccount = reactive({ username: '', role: 'user' as UserRole, password: '' });
const createdAccount = ref<{ username: string, password?: string }>();
function openCreate() {
  newAccount.username = ''; newAccount.password = ''; newAccount.role = createRoles.value.includes('user') ? 'user' : (createRoles.value[0] ?? 'user');
  createdAccount.value = undefined; createDialog.value = true;
}
async function createUser() {
  busy.value = true; errorMessage.value = '';
  try {
    const result = await manageUsersApi.create({ username: newAccount.username.trim(), role: newAccount.role, password: newAccount.password || undefined });
    createdAccount.value = { username: result.username, password: result.password };
    await refresh();
  } catch (e) {
    fail(e);
    createDialog.value = false;
  } finally {
    busy.value = false;
  }
}

// ---- message ----
const messageDialog = ref<{ mode: 'users' | 'org', userIds: string[], organizationId: string, subject: string, body: string }>();
function openMessage(opts: { mode: 'users' | 'org', userIds?: string[] }) {
  messageDialog.value = { mode: opts.mode, userIds: opts.userIds ?? [], organizationId: '', subject: '', body: '' };
}
async function sendMessage() {
  const m = messageDialog.value;
  if (!m) return;
  busy.value = true; errorMessage.value = '';
  try {
    const result = await manageUsersApi.message({
      userIds: m.mode === 'users' ? m.userIds : undefined, organizationId: m.mode === 'org' ? m.organizationId : undefined,
      subject: m.subject.trim(), body: m.body.trim(),
    });
    notice.value = `Meddelandet skickades till ${result.sent} ${result.sent === 1 ? 'person' : 'personer'}.`;
    messageDialog.value = undefined;
    selected.value = [];
    if (selectedId.value) await loadDetails();
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}
</script>
