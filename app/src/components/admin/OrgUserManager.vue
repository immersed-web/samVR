<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-base-content/60">
        Sök, spärra, återställ lösenord och skicka meddelanden till personerna i <strong>{{ organizationName }}</strong>.
      </p>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="openMessage('everyone')">
          <span class="material-icons">campaign</span> Meddelande till alla
        </button>
        <RouterLink :to="{ name: 'organizations' }" class="btn btn-primary btn-sm">
          <span class="material-icons">person_add</span> Lägg till användare
        </RouterLink>
      </div>
    </div>

    <div v-if="errorMessage" role="alert" class="alert alert-error"><span>{{ errorMessage }}</span>
      <button class="btn btn-sm btn-ghost" @click="errorMessage = ''">Stäng</button>
    </div>
    <div v-if="notice" role="status" class="alert alert-success"><span>{{ notice }}</span>
      <button class="btn btn-sm btn-ghost" @click="notice = ''">Stäng</button>
    </div>

    <div v-if="summary" class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <button class="stats bg-base-200 border border-base-300 text-left hover:border-primary" :class="{ 'border-primary': !hasFilters }" @click="clearFilters">
        <span class="stat"><span class="stat-title whitespace-normal">Personer</span><span class="stat-value">{{ summary.total }}</span></span>
      </button>
      <button class="stats bg-base-200 border border-base-300 text-left hover:border-primary" :class="{ 'border-primary': filters.status === 'blocked' && !filters.search && !filters.role }" @click="applyBlocked">
        <span class="stat"><span class="stat-title whitespace-normal">Spärrade</span><span class="stat-value" :class="{ 'text-error': summary.blocked }">{{ summary.blocked }}</span></span>
      </button>
      <div class="stats bg-base-200 border border-base-300 text-left">
        <span class="stat"><span class="stat-title whitespace-normal">Har aldrig loggat in</span><span class="stat-value">{{ summary.neverLoggedIn }}</span></span>
      </div>
      <div class="stats bg-base-200 border border-base-300 text-left">
        <span class="stat"><span class="stat-title whitespace-normal">Administratörer</span><span class="stat-value">{{ countRole('org_admin') }}</span></span>
      </div>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <label class="input input-bordered flex items-center gap-2 grow min-w-[16rem] max-w-xl">
        <span class="material-icons text-base opacity-60">search</span>
        <input v-model="filters.search" type="search" class="grow" placeholder="Sök på namn, enhet eller avdelning" aria-label="Sök bland personerna">
      </label>
      <label class="flex flex-col text-xs gap-1">Roll
        <select v-model="filters.role" class="select select-bordered select-sm">
          <option value="">Alla roller</option>
          <option value="basic">Användare</option>
          <option value="member">Medlem</option>
          <option value="org_admin">Administratör</option>
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
            <option value="role">Roll</option>
            <option value="createdAt">Skapad</option>
            <option value="lastLoginAt">Senast inloggad</option>
          </select>
          <button class="btn btn-sm join-item" :title="filters.order === 'asc' ? 'Stigande' : 'Fallande'"
            @click="filters.order = filters.order === 'asc' ? 'desc' : 'asc'">
            <span class="material-icons text-base">{{ filters.order === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
          </button>
        </span>
      </label>
      <button v-if="hasFilters" class="btn btn-ghost btn-sm" @click="clearFilters">Rensa filter</button>
    </div>

    <div v-if="selected.length" class="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
      <strong>{{ selected.length }} valda</strong>
      <button class="btn btn-sm btn-primary" @click="openMessage('selected')"><span class="material-icons">mail</span> Skicka meddelande</button>
      <button class="btn btn-sm btn-outline btn-error" @click="bulkBlock(true)"><span class="material-icons">block</span> Spärra</button>
      <button class="btn btn-sm btn-outline" @click="bulkBlock(false)"><span class="material-icons">lock_open</span> Häv spärr</button>
      <button class="btn btn-sm btn-ghost" @click="selected = []">Avmarkera</button>
    </div>

    <div class="overflow-x-auto rounded-lg border border-base-300">
      <table class="table table-sm md:table-md">
        <thead>
          <tr>
            <th class="w-8"><input type="checkbox" class="checkbox checkbox-sm" :checked="allOnPageSelected" aria-label="Markera alla på sidan" @change="togglePage"></th>
            <th>Användare</th><th>Roll</th><th>Enhet</th><th>Avdelning</th><th>Skapad</th><th>Senast inloggad</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="text-center py-8"><span class="loading loading-spinner"></span></td></tr>
          <tr v-else-if="!users.length"><td colspan="8" class="text-center py-8 text-base-content/60">Ingen matchar sökningen.</td></tr>
          <tr v-for="u in users" :key="u.userId" class="hover cursor-pointer" :class="{ 'opacity-70': u.blockedAt }" @click="open(u)">
            <td @click.stop><input v-model="selected" type="checkbox" class="checkbox checkbox-sm" :value="u.userId" :aria-label="`Markera ${u.username}`"></td>
            <td>
              <div class="font-semibold">{{ u.username }}</div>
              <span v-if="u.blockedAt" class="badge badge-error badge-sm">Spärrad</span>
            </td>
            <td><span class="badge badge-sm" :class="roleBadge(u.orgRole)">{{ roleLabel(u.orgRole) }}</span></td>
            <td class="text-sm">{{ u.units.join(', ') || '–' }}</td>
            <td class="text-sm">{{ u.departments.join(', ') || '–' }}</td>
            <td class="whitespace-nowrap text-sm">{{ formatDay(u.createdAt) }}</td>
            <td class="whitespace-nowrap text-sm">{{ u.lastLoginAt ? formatDay(u.lastLoginAt) : 'Aldrig' }}</td>
            <td class="text-right"><button class="btn btn-ghost btn-xs" @click.stop="open(u)">Öppna <span class="material-icons text-base">chevron_right</span></button></td>
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

    <!-- Details -->
    <dialog v-if="current" class="modal modal-open" @click.self="closeDetails">
      <div class="modal-box max-w-xl max-h-[92vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">{{ current.username }}</h2>
            <div class="flex flex-wrap gap-1 mt-1">
              <span class="badge badge-sm" :class="roleBadge(current.orgRole)">{{ roleLabel(current.orgRole) }}</span>
              <span v-if="current.blockedAt" class="badge badge-error badge-sm">Spärrad</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm btn-circle" aria-label="Stäng" @click="closeDetails"><span class="material-icons">close</span></button>
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-4">
          <dt class="text-base-content/60">Skapad</dt><dd>{{ formatDay(current.createdAt) }}</dd>
          <dt class="text-base-content/60">Senast inloggad</dt><dd>{{ current.lastLoginAt ? formatDay(current.lastLoginAt) : 'Aldrig' }}</dd>
          <dt class="text-base-content/60">Enhet</dt><dd>{{ current.units.join(', ') || '–' }}</dd>
          <dt class="text-base-content/60">Avdelning</dt><dd>{{ current.departments.join(', ') || '–' }}</dd>
        </dl>
        <p class="text-xs text-base-content/60 mt-2">Enheter och avdelningar ändrar du under Min organisation, på fliken Medlemmar.</p>

        <div class="divider"></div>

        <div class="space-y-5">
          <section v-if="current.userId !== authStore.userId" class="space-y-2">
            <h3 class="font-semibold">Roll i organisationen</h3>
            <div class="flex gap-2">
              <select v-model="editRole" class="select select-bordered select-sm grow" aria-label="Roll i organisationen">
                <option value="basic">Användare (kan inte skapa miljöer)</option>
                <option value="member">Medlem</option>
                <option value="org_admin">Administratör</option>
              </select>
              <button class="btn btn-sm" :disabled="busy || editRole === current.orgRole" @click="saveRole">Ändra roll</button>
            </div>
          </section>

          <section class="space-y-2">
            <h3 class="font-semibold">Meddelande</h3>
            <button class="btn btn-sm" @click="openMessage('one')"><span class="material-icons">mail</span> Skicka meddelande</button>
          </section>

          <p v-if="current.manageReason" class="text-sm rounded-lg bg-base-200 p-3">
            {{ current.manageReason }}. Lösenord, spärr och radering är därför inte tillgängliga här.
          </p>
          <template v-else>
            <section class="space-y-2">
              <h3 class="font-semibold">Återställ lösenord</h3>
              <button class="btn btn-sm btn-primary" :disabled="busy" @click="resetPassword()"><span class="material-icons">key</span> Skapa tillfälligt lösenord</button>
              <div class="flex gap-2">
                <input v-model="customPassword" type="password" autocomplete="new-password" class="input input-bordered input-sm grow" placeholder="…eller skriv ett eget (minst 8 tecken)">
                <button class="btn btn-sm" :disabled="busy || customPassword.length < 8" @click="resetPassword(customPassword)">Sätt</button>
              </div>
              <div v-if="generatedPassword" role="status" class="rounded-lg bg-success/15 border border-success/40 p-3 space-y-2 text-sm">
                <div class="font-semibold">Nytt lösenord för {{ current.username }}. Det visas bara nu.</div>
                <div class="flex gap-2">
                  <input :value="generatedPassword" readonly class="input input-bordered input-sm grow font-mono" @focus="($event.target as HTMLInputElement).select()">
                  <button class="btn btn-sm" @click="copy(generatedPassword)">{{ copied ? 'Kopierat!' : 'Kopiera' }}</button>
                </div>
                <span>Alla inloggningar med det gamla lösenordet har avslutats. Ge lösenordet till personen och be hen byta det.</span>
              </div>
            </section>

            <section class="space-y-2">
              <h3 class="font-semibold">Spärr</h3>
              <template v-if="!current.blockedAt">
                <input v-model="blockReason" class="input input-bordered input-sm w-full" maxlength="500" placeholder="Anledning (valfri)">
                <button class="btn btn-sm btn-outline btn-error" :disabled="busy" @click="setBlocked(true)"><span class="material-icons">block</span> Spärra kontot</button>
                <p class="text-xs text-base-content/60">Personen loggas ut direkt och kan inte logga in tills spärren hävs.</p>
              </template>
              <button v-else class="btn btn-sm btn-outline" :disabled="busy" @click="setBlocked(false)"><span class="material-icons">lock_open</span> Häv spärren</button>
            </section>

            <section class="space-y-2 rounded-lg border border-error/40 p-3">
              <h3 class="font-semibold text-error">Ta bort personen</h3>
              <p class="text-sm">
                <strong>Ta bort ur organisationen</strong> behåller kontot men tar bort åtkomsten till organisationens miljöer.
                <strong>Radera kontot</strong> tar bort kontot och allt personen äger, för alltid.
              </p>
              <button class="btn btn-sm btn-outline" :disabled="busy" @click="removeFromOrg"><span class="material-icons">person_remove</span> Ta bort ur organisationen</button>
              <input v-model="deleteConfirm" class="input input-bordered input-sm w-full" :placeholder="`Skriv ${current.username} för att radera kontot`">
              <button class="btn btn-sm btn-error" :disabled="busy || deleteConfirm !== current.username" @click="deleteAccount"><span class="material-icons">delete_forever</span> Radera kontot permanent</button>
            </section>
          </template>
        </div>
      </div>
    </dialog>

    <!-- Message -->
    <dialog v-if="messageDialog" class="modal modal-open" @click.self="messageDialog = undefined">
      <form class="modal-box max-w-lg space-y-3" @submit.prevent="sendMessage">
        <h3 class="text-lg font-bold">Skicka meddelande</h3>
        <p class="text-sm text-base-content/70">
          Meddelandet visas i mottagarens inkorg i SamVR (brevikonen högst upp). Det skickas inte som e-post.
        </p>
        <p class="text-sm">Till: <strong>{{ messageTarget }}</strong></p>
        <label class="form-control"><span class="label-text">Ämne</span>
          <input v-model="messageDialog.subject" class="input input-bordered" required maxlength="150"></label>
        <label class="form-control"><span class="label-text">Meddelande</span>
          <textarea v-model="messageDialog.body" class="textarea textarea-bordered" rows="6" required maxlength="5000"></textarea></label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="messageDialog = undefined">Avbryt</button>
          <button type="submit" class="btn btn-primary" :disabled="busy || !messageDialog.subject.trim() || !messageDialog.body.trim()"><span class="material-icons">send</span> Skicka</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { orgApi, orgErrorMessage, orgUsersApi, type OrgManagedUser, type OrgRole } from '@/modules/authClient';

const props = defineProps<{ organizationId: string, organizationName: string }>();
const authStore = useAuthStore();
const api = computed(() => orgUsersApi(props.organizationId));

const filters = reactive({ search: '', role: '' as OrgRole | '', status: 'all' as 'all' | 'active' | 'blocked', sort: 'username' as 'username' | 'role' | 'createdAt' | 'lastLoginAt', order: 'asc' as 'asc' | 'desc' });
const offset = ref(0);
const limit = ref(25);
const total = ref(0);
const users = ref<OrgManagedUser[]>([]);
const summary = ref<Awaited<ReturnType<ReturnType<typeof orgUsersApi>['summary']>>>();
const loading = ref(true);
const selected = ref<string[]>([]);
const errorMessage = ref('');
const notice = ref('');
const busy = ref(false);

const hasFilters = computed(() => !!(filters.search || filters.role || filters.status !== 'all'));
const allOnPageSelected = computed(() => users.value.length > 0 && users.value.every(u => selected.value.includes(u.userId)));
const countRole = (role: OrgRole) => summary.value?.byRole.find(r => r.role === role)?.count ?? 0;

const roleLabel = (role: OrgRole) => ({ org_admin: 'Administratör', member: 'Medlem', basic: 'Användare' })[role];
const roleBadge = (role: OrgRole) => ({ org_admin: 'badge-primary', member: 'badge-accent', basic: 'badge-ghost' })[role];
const formatDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE') : '–');
const fail = (e: unknown) => { errorMessage.value = orgErrorMessage(e); };

async function loadList() {
  loading.value = true;
  try {
    const result = await api.value.list({
      search: filters.search.trim() || undefined, role: filters.role || undefined, status: filters.status,
      sort: filters.sort, order: filters.order, offset: offset.value, limit: limit.value,
    });
    total.value = result.total;
    users.value = result.users;
  } catch (e) { fail(e); } finally { loading.value = false; }
}
async function loadSummary() {
  try { summary.value = await api.value.summary(); } catch (e) { fail(e); }
}
const refresh = async () => { await Promise.all([loadList(), loadSummary()]); };

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => filters.search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { offset.value = 0; void loadList(); }, 300); });
watch(() => [filters.role, filters.status, filters.sort, filters.order, limit.value], () => { offset.value = 0; void loadList(); });
watch(offset, () => { void loadList(); });
watch(() => props.organizationId, () => { selected.value = []; closeDetails(); clearFilters(); void refresh(); });
onBeforeUnmount(() => clearTimeout(searchTimer));
onMounted(refresh);

function clearFilters() { filters.search = ''; filters.role = ''; filters.status = 'all'; }
function applyBlocked() { clearFilters(); filters.status = 'blocked'; }
function togglePage() {
  const ids = users.value.map(u => u.userId);
  selected.value = allOnPageSelected.value ? selected.value.filter(id => !ids.includes(id)) : [...new Set([...selected.value, ...ids])];
}

// ---- details ----
const currentId = ref<string>();
const current = computed(() => users.value.find(u => u.userId === currentId.value));
const editRole = ref<OrgRole>('member');
const customPassword = ref('');
const generatedPassword = ref('');
const blockReason = ref('');
const deleteConfirm = ref('');
const copied = ref(false);
function open(u: OrgManagedUser) {
  currentId.value = u.userId; editRole.value = u.orgRole;
  customPassword.value = ''; generatedPassword.value = ''; blockReason.value = ''; deleteConfirm.value = '';
}
function closeDetails() { currentId.value = undefined; generatedPassword.value = ''; }

async function act(action: () => Promise<unknown>, success?: string) {
  busy.value = true; errorMessage.value = ''; notice.value = '';
  try { await action(); if (success) notice.value = success; } catch (e) { fail(e); } finally { busy.value = false; }
  await refresh();
}
const saveRole = () => act(() => orgApi.setMember(props.organizationId, currentId.value!, editRole.value), 'Rollen är ändrad.');
const setBlocked = (blocked: boolean) => act(async () => { await api.value.block(currentId.value!, blocked, blockReason.value.trim() || undefined); blockReason.value = ''; }, blocked ? 'Kontot är spärrat.' : 'Spärren är hävd.');
const resetPassword = (password?: string) => act(async () => {
  const result = await api.value.resetPassword(currentId.value!, password);
  generatedPassword.value = result.password ?? ''; customPassword.value = '';
}, password ? 'Lösenordet är ändrat.' : '');
const removeFromOrg = () => {
  if (!current.value || !confirm(`Ta bort ${current.value.username} ur organisationen? Kontot finns kvar men förlorar åtkomsten till organisationens miljöer.`)) return;
  return act(async () => { await orgApi.removeMember(props.organizationId, currentId.value!); closeDetails(); }, 'Personen är borttagen ur organisationen.');
};
const deleteAccount = () => act(async () => { await api.value.remove(currentId.value!); selected.value = selected.value.filter(id => id !== currentId.value); closeDetails(); }, 'Kontot är raderat.');
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); copied.value = true; setTimeout(() => { copied.value = false; }, 2000); } catch { /* the field is selectable */ }
}

async function bulkBlock(blocked: boolean) {
  const ids = [...selected.value];
  if (blocked && !confirm(`Spärra ${ids.length} konton? De loggas ut direkt.`)) return;
  busy.value = true; errorMessage.value = ''; notice.value = '';
  const results = await Promise.allSettled(ids.map(id => api.value.block(id, blocked)));
  busy.value = false;
  const ok = results.filter(r => r.status === 'fulfilled').length;
  notice.value = `${ok} av ${ids.length} konton ${blocked ? 'spärrades' : 'fick spärren hävd'}.` + (ok < ids.length ? ' Resten går inte att ändra här (administratörer, du själv, eller personer i flera organisationer).' : '');
  selected.value = [];
  await refresh();
}

// ---- message ----
const messageDialog = ref<{ mode: 'one' | 'selected' | 'everyone', subject: string, body: string }>();
const openMessage = (mode: 'one' | 'selected' | 'everyone') => { messageDialog.value = { mode, subject: '', body: '' }; };
const messageTarget = computed(() => {
  const m = messageDialog.value;
  if (!m) return '';
  if (m.mode === 'everyone') return `alla i ${props.organizationName}`;
  if (m.mode === 'one') return current.value?.username ?? '';
  return `${selected.value.length} valda personer`;
});
async function sendMessage() {
  const m = messageDialog.value;
  if (!m) return;
  busy.value = true; errorMessage.value = '';
  try {
    const result = await api.value.message({
      everyone: m.mode === 'everyone' || undefined,
      userIds: m.mode === 'one' ? [currentId.value!] : m.mode === 'selected' ? selected.value : undefined,
      subject: m.subject.trim(), body: m.body.trim(),
    });
    notice.value = `Meddelandet skickades till ${result.sent} ${result.sent === 1 ? 'person' : 'personer'}.`;
    messageDialog.value = undefined;
    if (m.mode === 'selected') selected.value = [];
  } catch (e) { fail(e); } finally { busy.value = false; }
}
</script>
