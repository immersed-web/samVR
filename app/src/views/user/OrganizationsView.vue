<template>
  <MaxWidth7xl>
    <div class="flex flex-col gap-8">
      <h1 class="text-3xl font-bold">{{ isPlatformAdmin ? 'Organisationer' : 'Min organisation' }}</h1>

      <div v-if="errorMessage" role="alert" class="alert alert-error">
        <span>{{ errorMessage }}</span>
        <button class="btn btn-sm btn-ghost" @click="errorMessage = ''">Stäng</button>
      </div>

      <!-- A freshly created invitation link. The code cannot be shown again, so make that obvious. -->
      <div v-if="shownLink" role="status" class="alert alert-success flex-col items-start gap-2">
        <div class="font-semibold">{{ shownLink.heading }}</div>
        <div class="flex gap-2 w-full items-center">
          <input :value="shownLink.url" readonly class="input input-bordered input-sm grow font-mono text-xs" @focus="($event.target as HTMLInputElement).select()">
          <button class="btn btn-sm" @click="copyLink">{{ copied ? 'Kopierad!' : 'Kopiera' }}</button>
        </div>
        <p class="text-sm">
          Länken visas bara nu och kan inte hämtas igen. Skicka den själv till mottagaren. Den gäller i
          {{ shownLink.days }} dagar och kan återkallas.
        </p>
        <button class="btn btn-ghost btn-xs" @click="shownLink = undefined">Dölj</button>
      </div>

      <!-- Requests from organizations that want to join (platform administrators only) -->
      <section v-if="isPlatformAdmin" class="space-y-3">
        <h2 class="text-xl font-semibold">
          Förfrågningar
          <span v-if="openRequests.length" class="badge badge-primary">{{ openRequests.length }}</span>
        </h2>
        <p v-if="!openRequests.length" class="text-base-content/60">Inga nya förfrågningar.</p>
        <div v-for="request in openRequests" :key="request.requestId" class="card bg-base-200">
          <div class="card-body p-4 gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-lg">{{ request.organizationName }}</span>
              <span class="badge">{{ typeLabel(request.organizationType) }}</span>
              <span v-if="request.expectedUsers" class="badge badge-outline">ca {{ request.expectedUsers }} användare</span>
            </div>
            <div class="text-sm">{{ request.contactName }} · <a class="link" :href="`mailto:${request.contactEmail}`">{{ request.contactEmail }}</a></div>
            <p v-if="request.message" class="text-sm whitespace-pre-line text-base-content/80">{{ request.message }}</p>
            <div class="flex gap-2 justify-end">
              <button class="btn btn-sm btn-ghost" @click="rejectRequest(request)">Avslå</button>
              <button class="btn btn-sm btn-primary" @click="approveRequest(request)">Godkänn och skapa organisation</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Create organization (platform administrators only) -->
      <section v-if="isPlatformAdmin" class="space-y-3">
        <h2 class="text-xl font-semibold">Skapa ny organisation</h2>
        <div class="flex flex-wrap gap-4 items-end">
          <label class="flex flex-col gap-1">
            <span class="label-text">Namn</span>
            <input v-model="newOrgName" class="input input-bordered" placeholder="T.ex. Exempelkommun"
              @keyup.enter="createOrganization">
          </label>
          <label class="flex flex-col gap-1">
            <span class="label-text">Typ</span>
            <select v-model="newOrgType" class="select select-bordered">
              <option value="municipality">Kommun</option>
              <option value="company">Företag</option>
              <option value="other">Annan</option>
            </select>
          </label>
          <button class="btn btn-primary" :disabled="!newOrgName.trim()" @click="createOrganization">
            <span class="material-icons">add</span> Skapa
          </button>
        </div>
      </section>

      <!-- Organization list -->
      <section class="space-y-3">
        <h2 v-if="isPlatformAdmin" class="text-xl font-semibold">Alla organisationer</h2>
        <p v-if="loaded && !organizations.length" class="text-base-content/60">
          {{ isPlatformAdmin ? 'Inga organisationer ännu.' : 'Du är inte medlem i någon organisation.' }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button v-for="org in organizations" :key="org.organizationId" class="btn"
            :class="org.organizationId === selectedId ? 'btn-primary' : 'btn-outline'"
            @click="select(org.organizationId)">
            {{ org.name }}
            <span class="badge badge-sm">{{ typeLabel(org.type) }}</span>
          </button>
        </div>
      </section>

      <!-- Selected organization -->
      <section v-if="details" class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" class="tabs tabs-boxed w-fit">
            <button v-for="t in tabList" :key="t.id" role="tab" class="tab" :class="{ 'tab-active': tab === t.id }"
              @click="tab = t.id">{{ t.label }}</button>
          </div>
          <button v-if="isPlatformAdmin" class="btn btn-error btn-outline btn-sm" @click="removeOrganization">
            <span class="material-icons">delete</span> Radera organisation
          </button>
        </div>

        <!-- Tab: members -->
        <template v-if="tab === 'members'">
          <!-- New user -->
          <div class="space-y-3">
            <h3 class="text-lg font-semibold">Skapa ny användare i organisationen</h3>
            <div class="flex flex-wrap gap-4 items-end">
              <label class="flex flex-col gap-1">
                <span class="label-text">Användarnamn</span>
                <input v-model="newUser.username" class="input input-bordered input-sm" autocomplete="off">
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">Lösenord (minst 8 tecken)</span>
                <input v-model="newUser.password" type="password" class="input input-bordered input-sm" autocomplete="new-password">
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">Roll</span>
                <select v-model="newUser.role" class="select select-bordered select-sm">
                  <option value="basic">Användare (kan inte skapa miljöer)</option>
                  <option value="member">Medlem</option>
                  <option value="org_admin">Administratör</option>
                </select>
              </label>
              <div v-if="details.units.length" class="flex flex-col gap-1">
                <span class="label-text">Enheter</span>
                <div class="flex flex-wrap gap-3">
                  <label v-for="unit in details.units" :key="unit.unitId" class="flex items-center gap-1">
                    <input v-model="newUser.unitIds" type="checkbox" class="checkbox checkbox-sm" :value="unit.unitId">
                    {{ unit.name }}
                  </label>
                </div>
              </div>
              <div v-if="newUserDepartments.length" class="flex flex-col gap-1">
                <span class="label-text">Avdelningar</span>
                <div class="flex flex-wrap gap-3">
                  <label v-for="d in newUserDepartments" :key="d.departmentId" class="flex items-center gap-1">
                    <input v-model="newUser.departmentIds" type="checkbox" class="checkbox checkbox-sm" :value="d.departmentId">
                    {{ d.name }} <span class="text-xs text-base-content/60">({{ unitNameById(d.unitId) }})</span>
                  </label>
                </div>
              </div>
              <button class="btn btn-primary btn-sm"
                :disabled="newUser.username.trim().length < 2 || newUser.password.length < 8" @click="createUser">
                <span class="material-icons">person_add</span> Skapa användare
              </button>
            </div>
          </div>

          <!-- Members -->
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <label class="input input-bordered input-sm flex items-center gap-2 w-full max-w-sm">
                <span class="material-icons text-base opacity-60">search</span>
                <input v-model="memberSearch" type="search" class="grow" placeholder="Sök användare, enhet eller avdelning" aria-label="Sök bland medlemmar">
              </label>
              <span class="text-sm text-base-content/60">
                {{ memberSearch.trim() ? `${filteredMembers.length} av ${details.members.length}` : `${details.members.length} medlemmar` }}
              </span>
            </div>
            <p v-if="memberSearch.trim() && !filteredMembers.length" class="text-base-content/60">
              Ingen träff på "{{ memberSearch.trim() }}".
            </p>
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>Användare</th>
                    <th>Roll i organisationen</th>
                    <th v-for="unit in details.units" :key="unit.unitId">{{ unit.name }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="member in filteredMembers" :key="member.userId">
                    <td class="font-semibold">{{ member.username }}</td>
                    <td>
                      <select class="select select-bordered select-sm" :value="member.role"
                        @change="changeOrgRole(member.userId, ($event.target as HTMLSelectElement).value as OrgRole)">
                        <option value="basic">Användare (kan inte skapa miljöer)</option>
                        <option value="member">Medlem</option>
                        <option value="org_admin">Administratör</option>
                      </select>
                    </td>
                    <td v-for="unit in details.units" :key="unit.unitId">
                      <select class="select select-bordered select-sm" :value="unitRole(unit.unitId, member.userId)"
                        @change="changeUnitRole(unit.unitId, member.userId, ($event.target as HTMLSelectElement).value)">
                        <option value="">–</option>
                        <option value="member">Medlem</option>
                        <option value="unit_admin">Enhetsadmin</option>
                      </select>
                      <div v-if="departmentsOf(unit.unitId).length && unitRole(unit.unitId, member.userId)" class="dropdown mt-1">
                        <label tabindex="0" class="btn btn-xs btn-ghost normal-case font-normal">
                          {{ departmentSummary(unit.unitId, member.userId) }}
                          <span class="material-icons text-base leading-none">expand_more</span>
                        </label>
                        <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-10 w-56 p-2 shadow-lg border border-base-300">
                          <li v-for="d in departmentsOf(unit.unitId)" :key="d.departmentId">
                            <label class="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" class="checkbox checkbox-xs" :checked="inDepartment(d.departmentId, member.userId)"
                                @change="toggleDepartment(d.departmentId, member.userId, ($event.target as HTMLInputElement).checked)">
                              {{ d.name }}
                            </label>
                          </li>
                        </ul>
                      </div>
                    </td>
                    <td>
                      <button v-if="member.userId !== authStore.userId" class="btn btn-ghost btn-sm" title="Byt lösenord"
                        @click="openPasswordDialog(member.userId, member.username)">
                        <span class="material-icons">key</span>
                      </button>
                      <button v-if="member.userId !== authStore.userId" class="btn btn-ghost btn-sm text-error" title="Radera kontot"
                        @click="deleteAccount(member.userId, member.username)">
                        <span class="material-icons">delete</span>
                      </button>
                      <button class="btn btn-ghost btn-sm" title="Ta bort ur organisationen"
                        @click="removeMember(member.userId, member.username)">
                        <span class="material-icons">person_remove</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- Tab: units -->
        <template v-else-if="tab === 'units'">
          <!-- Units -->
          <div class="space-y-3">
            <p v-if="!details.units.length" class="text-base-content/60">Inga enheter ännu.</p>
            <p class="text-sm text-base-content/70">
              En enhet kan till exempel vara en skola. Inom enheten skapar du avdelningar, till exempel klasser eller team.
            </p>
            <div class="flex gap-3 items-end">
              <input v-model="newUnitName" class="input input-bordered input-sm" placeholder="Namn på ny enhet"
                @keyup.enter="createUnit">
              <button class="btn btn-sm btn-primary" :disabled="!newUnitName.trim()" @click="createUnit">Lägg till enhet</button>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div v-for="unit in details.units" :key="unit.unitId" class="card bg-base-200">
                <div class="card-body p-4 gap-3">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="font-bold text-lg">{{ unit.name }}</h3>
                    <button class="btn btn-ghost btn-xs text-error" title="Radera enheten och dess avdelningar"
                      @click="removeUnit(unit.unitId, unit.name)">
                      <span class="material-icons text-base">delete</span>
                    </button>
                  </div>
                  <div>
                    <div class="text-sm font-semibold mb-1">Avdelningar</div>
                    <p v-if="!departmentsOf(unit.unitId).length" class="text-sm text-base-content/60">Inga avdelningar ännu.</p>
                    <ul class="flex flex-wrap gap-2">
                      <li v-for="d in departmentsOf(unit.unitId)" :key="d.departmentId" class="badge badge-lg gap-2 py-4 bg-base-100">
                        {{ d.name }}
                        <span class="text-xs text-base-content/60">{{ departmentMemberCount(d.departmentId) }}</span>
                        <button class="material-icons text-base leading-none" title="Radera avdelningen"
                          @click="removeDepartment(d.departmentId, d.name)">close</button>
                      </li>
                    </ul>
                  </div>
                  <div class="flex gap-2 items-end">
                    <input v-model="newDepartmentNames[unit.unitId]" class="input input-bordered input-sm grow" placeholder="Ny avdelning, t.ex. Klass 7B"
                      @keyup.enter="createDepartment(unit.unitId)">
                    <button class="btn btn-sm btn-primary" :disabled="!(newDepartmentNames[unit.unitId] ?? '').trim()"
                      @click="createDepartment(unit.unitId)">Lägg till</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Tab: invitations -->
        <template v-else-if="tab === 'invitations'">
          <!-- Invitations -->
          <div class="space-y-3">
            <p class="text-sm text-base-content/70">
              Skapa en länk som personer använder för att skapa ett konto och gå med. Länken skickar du själv.
            </p>
            <div class="flex flex-wrap gap-4 items-end">
              <label class="flex flex-col gap-1">
                <span class="label-text">Enhet</span>
                <select v-model="invite.unitId" class="select select-bordered select-sm">
                  <option value="">Ingen (bara organisationen)</option>
                  <option v-for="unit in details.units" :key="unit.unitId" :value="unit.unitId">{{ unit.name }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">Roll i organisationen</span>
                <select v-model="invite.organizationRole" class="select select-bordered select-sm">
                  <option value="basic">Användare (kan inte skapa miljöer)</option>
                  <option value="member">Medlem</option>
                  <option value="org_admin">Administratör</option>
                </select>
              </label>
              <label v-if="invite.unitId" class="flex flex-col gap-1">
                <span class="label-text">Roll i enheten</span>
                <select v-model="invite.unitRole" class="select select-bordered select-sm">
                  <option value="member">Medlem</option>
                  <option value="unit_admin">Enhetsadmin</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">Antal användningar</span>
                <input v-model.number="invite.maxUses" type="number" min="1" max="500" class="input input-bordered input-sm w-28">
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">Giltig i (dagar)</span>
                <input v-model.number="invite.expiresInDays" type="number" min="1" max="90" class="input input-bordered input-sm w-28">
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">Anteckning (valfri)</span>
                <input v-model="invite.note" maxlength="500" class="input input-bordered input-sm" placeholder="T.ex. Klass 7B">
              </label>
              <button class="btn btn-primary btn-sm" @click="createInvitation">
                <span class="material-icons">link</span> Skapa inbjudningslänk
              </button>
            </div>
            <div v-if="invitations.length" class="overflow-x-auto">
              <table class="table table-sm">
                <thead><tr><th>Anteckning</th><th>Enhet</th><th>Roll</th><th>Använd</th><th>Giltig till</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="item in invitations" :key="item.invitationId">
                    <td>{{ item.note || '–' }}</td>
                    <td>{{ unitName(item.unitId) }}</td>
                    <td>{{ orgRoleLabel(item.organizationRole) }}</td>
                    <td>{{ item.usedCount }} / {{ item.maxUses }}</td>
                    <td>{{ new Date(item.expiresAt).toLocaleDateString('sv-SE') }}</td>
                    <td><span class="badge badge-sm" :class="invitationStatus(item).cls">{{ invitationStatus(item).label }}</span></td>
                    <td>
                      <button v-if="invitationStatus(item).active" class="btn btn-ghost btn-xs" @click="revokeInvitation(item.invitationId)">Återkalla</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-base-content/60 text-sm">Inga inbjudningar ännu.</p>
          </div>
        </template>

        <!-- Tab: logo -->
        <template v-else-if="tab === 'logo'">
          <div class="space-y-3">
            <p class="text-sm text-base-content/70">
              Loggan visas på organisationens miljöer och på gästsidorna. Använd gärna en kvadratisk eller bred bild
              med genomskinlig bakgrund. PNG, JPEG eller WebP. Stora bilder förminskas automatiskt.
            </p>
            <div class="flex flex-wrap items-center gap-6">
              <div class="w-40 h-40 rounded-xl border border-base-300 bg-base-100 grid place-items-center overflow-hidden">
                <img v-if="logoSrc" :src="logoSrc" alt="Organisationens logga" class="max-w-full max-h-full object-contain p-2">
                <span v-else class="text-sm text-base-content/50 px-2 text-center">Ingen logga</span>
              </div>
              <div class="flex flex-col gap-3">
                <input type="file" class="file-input file-input-bordered file-input-sm" accept="image/png,image/jpeg,image/webp"
                  :key="logoFileKey" :disabled="logoBusy" @change="onLogoFile">
                <div class="flex gap-2">
                  <button v-if="logoSrc" class="btn btn-outline btn-error btn-sm" :disabled="logoBusy" @click="removeLogo">
                    <span class="material-icons">delete</span> Ta bort loggan
                  </button>
                </div>
                <p v-if="logoBusy" class="text-sm flex items-center gap-2"><span class="loading loading-spinner loading-sm"></span> Sparar…</p>
                <p v-if="logoError" class="text-sm text-error">{{ logoError }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Tab: import from Excel -->
        <template v-else-if="tab === 'import'">
          <!-- Import users from Excel -->
          <div class="space-y-3">
            <p class="text-sm text-base-content/70">
              Ladda ned mallen, fyll i en person per rad och ladda upp den igen. Du får en förhandsgranskning innan något skapas.
            </p>
            <div class="flex flex-wrap gap-3 items-center">
              <a class="btn btn-outline btn-sm" href="/mallar/Importmall-anvandare.xlsx" download>
                <span class="material-icons">download</span> Ladda ned mall
              </a>
              <input type="file" class="file-input file-input-bordered file-input-sm" accept=".xlsx"
                :key="importFileKey" @change="onImportFile">
            </div>
            <label class="flex items-start gap-2 cursor-pointer text-sm">
              <input v-model="importCreateMissing" type="checkbox" class="checkbox checkbox-sm mt-0.5">
              <span>
                <strong>Skapa enheter och avdelningar som saknas</strong><br>
                <span class="text-base-content/70">Annars hoppas rader över där enheten eller avdelningen inte finns. Förhandsgranskningen visar vad som skapas.</span>
              </span>
            </label>
            <div v-if="importError" role="alert" class="alert alert-error text-sm"><span>{{ importError }}</span></div>
            <div v-if="importDone" role="status" class="alert alert-success text-sm">
              <span>{{ importDone }}</span>
            </div>
            <template v-if="importPreview">
              <p class="text-sm">
                <strong>{{ importOkCount }}</strong> av {{ importPreview.results.length }} rader kan importeras.
                <span v-if="importErrorCount"> {{ importErrorCount }} rader har fel och hoppas över.</span>
                <span v-if="importPreview.newUnits.length || importPreview.newDepartments.length">
                  Skapar {{ importPreview.newUnits.length }} enheter och {{ importPreview.newDepartments.length }} avdelningar.
                </span>
              </p>
              <div class="overflow-x-auto max-h-80 overflow-y-auto">
                <table class="table table-sm">
                  <thead><tr><th>Rad</th><th>Användarnamn</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr v-for="r in importPreview.results" :key="r.row">
                      <td>{{ r.row }}</td>
                      <td>{{ r.username }}</td>
                      <td>
                        <template v-if="r.status === 'ok'">
                          <span class="badge badge-success badge-sm">OK</span>
                          <span v-if="r.message" class="text-xs ml-2 text-base-content/70">{{ r.message }}</span>
                        </template>
                        <span v-else class="text-error">{{ r.message }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm" :disabled="!importOkCount || importing" @click="runImport">
                  <span v-if="importing" class="loading loading-spinner loading-sm"></span>
                  Importera {{ importOkCount }} användare
                </button>
                <button class="btn btn-ghost btn-sm" :disabled="importing" @click="resetImport">Avbryt</button>
              </div>
            </template>
          </div>
        </template>

        <!-- Change password dialog -->
        <dialog v-if="passwordTarget" class="modal modal-open" @click.self="passwordTarget = undefined">
          <form class="modal-box max-w-sm" @submit.prevent="savePassword">
            <h3 class="text-lg font-semibold mb-1">Byt lösenord</h3>
            <p class="text-sm mb-3">för <strong>{{ passwordTarget.username }}</strong></p>
            <input v-model="newPassword" type="password" autocomplete="new-password" class="input input-bordered w-full"
              placeholder="Nytt lösenord (minst 8 tecken)">
            <div class="modal-action">
              <button type="button" class="btn btn-ghost btn-sm" @click="passwordTarget = undefined">Avbryt</button>
              <button type="submit" class="btn btn-primary btn-sm" :disabled="newPassword.length < 8">Spara</button>
            </div>
          </form>
        </dialog>
      </section>
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { hasAtLeastSecurityRole } from 'schemas';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';
import { useAuthStore } from '@/stores/authStore';
import { onboardingApi, orgApi, orgErrorMessage, orgLogoUrl, type InvitationListItem, type OrgRole, type OrgType, type OrganizationDetails, type OrganizationListItem, type OrganizationRequest, type UnitRole } from '@/modules/authClient';

const authStore = useAuthStore();
const isPlatformAdmin = computed(() => !!authStore.role && hasAtLeastSecurityRole(authStore.role, 'superadmin'));

type Tab = 'members' | 'units' | 'invitations' | 'import' | 'logo';
const tab = ref<Tab>('members');
const tabList: { id: Tab, label: string }[] = [
  { id: 'members', label: 'Medlemmar' },
  { id: 'units', label: 'Enheter' },
  { id: 'invitations', label: 'Inbjudningar' },
  { id: 'import', label: 'Importera från Excel' },
  { id: 'logo', label: 'Logga' },
];

const organizations = ref<OrganizationListItem[]>([]);
const loaded = ref(false);
const selectedId = ref<string>();
const details = ref<OrganizationDetails>();
const errorMessage = ref('');

const newOrgName = ref('');
const newOrgType = ref<OrgType>('municipality');
const newUnitName = ref('');
const newUser = reactive({ username: '', password: '', role: 'member' as OrgRole, unitIds: [] as string[], departmentIds: [] as string[] });
const newDepartmentNames = reactive<Record<string, string>>({});

const orgRoleLabel = (role: OrgRole) => ({ org_admin: 'Administratör', member: 'Medlem', basic: 'Användare' })[role];
const typeLabel = (type: OrgType) => ({ municipality: 'Kommun', company: 'Företag', other: 'Annan' })[type];
const unitRole = (unitId: string, userId: string) =>
  details.value?.unitMembers.find(m => m.unitId === unitId && m.userId === userId)?.role ?? '';

/** Run a server call, show its error message if it fails, and refresh the data afterwards. */
async function act(action: () => Promise<unknown>, refresh: 'list' | 'details' = 'details') {
  errorMessage.value = '';
  try {
    await action();
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  }
  if (refresh === 'list') await loadList();
  if (selectedId.value) await loadDetails();
}

async function loadList() {
  try {
    organizations.value = await orgApi.list();
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  }
  loaded.value = true;
  if (selectedId.value && !organizations.value.some(o => o.organizationId === selectedId.value)) {
    selectedId.value = undefined;
    details.value = undefined;
  }
}

async function loadDetails() {
  if (!selectedId.value) return;
  try {
    details.value = await orgApi.get(selectedId.value);
    void loadInvitations();
  } catch (e) {
    details.value = undefined;
    errorMessage.value = orgErrorMessage(e);
  }
}

async function select(organizationId: string) {
  selectedId.value = organizationId;
  tab.value = 'members';
  resetImport();
  importDone.value = '';
  importError.value = '';
  newUser.unitIds = [];
  newUser.departmentIds = [];
  memberSearch.value = '';
  await loadDetails();
}

const createOrganization = () => act(async () => {
  await orgApi.create(newOrgName.value.trim(), newOrgType.value);
  newOrgName.value = '';
}, 'list');

const removeOrganization = () => {
  if (!details.value || !confirm(`Radera organisationen "${details.value.organization.name}"? Det går bara om den inte längre har några miljöer, strömmar eller filer.`)) return;
  return act(async () => { await orgApi.remove(details.value!.organization.organizationId); selectedId.value = undefined; details.value = undefined; }, 'list');
};

const createUnit = () => act(async () => {
  await orgApi.createUnit(selectedId.value!, newUnitName.value.trim());
  newUnitName.value = '';
});

const removeUnit = (unitId: string, name: string) => {
  if (!confirm(`Radera enheten "${name}"?`)) return;
  return act(() => orgApi.removeUnit(unitId));
};

const changeOrgRole = (userId: string, role: OrgRole) => act(() => orgApi.setMember(selectedId.value!, userId, role));

const changeUnitRole = (unitId: string, userId: string, role: string) => act(() =>
  role === '' ? orgApi.removeUnitMember(unitId, userId) : orgApi.setUnitMember(unitId, userId, role as UnitRole));

const removeMember = (userId: string, username: string) => {
  if (!confirm(`Ta bort ${username} ur organisationen? Användaren behåller sitt konto men förlorar åtkomst till organisationens miljöer.`)) return;
  return act(() => orgApi.removeMember(selectedId.value!, userId));
};

const passwordTarget = ref<{ userId: string, username: string }>();
const newPassword = ref('');
const openPasswordDialog = (userId: string, username: string) => { passwordTarget.value = { userId, username }; newPassword.value = ''; };
const savePassword = () => act(async () => {
  await orgApi.setUserPassword({ organizationId: selectedId.value!, userId: passwordTarget.value!.userId, password: newPassword.value });
  passwordTarget.value = undefined;
  newPassword.value = '';
});

const deleteAccount = (userId: string, username: string) => {
  if (!confirm(`Radera kontot "${username}" helt? Användaren och allt som användaren äger (till exempel egna miljöer) tas bort permanent. Det går inte att ångra.`)) return;
  return act(() => orgApi.deleteUser({ organizationId: selectedId.value!, userId }));
};

// ---- Search among the members ----
const memberSearch = ref('');
/** Matches the user name, or the name of a unit or department the person belongs to. Case-insensitive. */
const filteredMembers = computed(() => {
  const members = details.value?.members ?? [];
  const query = memberSearch.value.trim().toLowerCase();
  if (!query) return members;
  const d = details.value!;
  return members.filter(m => {
    if (m.username.toLowerCase().includes(query)) return true;
    const unitHit = d.unitMembers.some(um => um.userId === m.userId && unitNameById(um.unitId).toLowerCase().includes(query));
    if (unitHit) return true;
    return d.departmentMembers.some(dm => dm.userId === m.userId
      && d.departments.find(dep => dep.departmentId === dm.departmentId)?.name.toLowerCase().includes(query));
  });
});

// ---- Departments (classes, teams) inside units ----
const departmentsOf = (unitId: string) => details.value?.departments.filter(d => d.unitId === unitId) ?? [];
const unitNameById = (unitId: string) => details.value?.units.find(u => u.unitId === unitId)?.name ?? '';
const inDepartment = (departmentId: string, userId: string) =>
  !!details.value?.departmentMembers.some(m => m.departmentId === departmentId && m.userId === userId);
const departmentMemberCount = (departmentId: string) => details.value?.departmentMembers.filter(m => m.departmentId === departmentId).length ?? 0;
function departmentSummary(unitId: string, userId: string) {
  const names = departmentsOf(unitId).filter(d => inDepartment(d.departmentId, userId)).map(d => d.name);
  return names.length ? names.join(', ') : 'Avdelning…';
}
// The departments of the units ticked in the "new user" form
const newUserDepartments = computed(() => (details.value?.departments ?? []).filter(d => newUser.unitIds.includes(d.unitId)));

const createDepartment = (unitId: string) => act(async () => {
  await orgApi.createDepartment(unitId, (newDepartmentNames[unitId] ?? '').trim());
  newDepartmentNames[unitId] = '';
});
const removeDepartment = (departmentId: string, name: string) => {
  if (!confirm(`Radera avdelningen "${name}"? Personerna blir kvar i enheten.`)) return;
  return act(() => orgApi.deleteDepartment(departmentId));
};
const toggleDepartment = (departmentId: string, userId: string, checked: boolean) => act(() =>
  checked ? orgApi.setDepartmentMember(departmentId, userId) : orgApi.removeDepartmentMember(departmentId, userId));

const createUser = () => act(async () => {
  // only departments of units that are still ticked
  const departmentIds = newUser.departmentIds.filter(id => newUserDepartments.value.some(d => d.departmentId === id));
  await orgApi.createUser({ organizationId: selectedId.value!, username: newUser.username.trim(), password: newUser.password, role: newUser.role, unitIds: newUser.unitIds, departmentIds });
  newUser.username = '';
  newUser.password = '';
  newUser.role = 'member';
  newUser.unitIds = [];
  newUser.departmentIds = [];
});

// ---- Logo ----
const logoFileKey = ref(0);
const logoBusy = ref(false);
const logoError = ref('');
const logoSrc = computed(() => details.value ? orgLogoUrl(details.value.organization.organizationId, details.value.organization.logoVersion) : undefined);

/** Shrink to at most 512 px on the longest side and encode small enough for the server (max 300 kB). */
async function prepareLogo(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string, quality?: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  const limit = 280 * 1024;
  let blob = await toBlob('image/png');
  if (!blob || blob.size > limit) blob = await toBlob('image/webp', 0.85);
  if (!blob || blob.size > limit) blob = await toBlob('image/jpeg', 0.85);
  if (!blob || blob.size > limit) throw new Error('Bilden är för detaljrik. Välj en enklare bild.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Kunde inte läsa bilden.'));
    reader.readAsDataURL(blob!);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

async function onLogoFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  logoError.value = '';
  if (!file || !selectedId.value) return;
  logoBusy.value = true;
  try {
    await orgApi.setLogo(selectedId.value, await prepareLogo(file));
    await loadDetails();
  } catch (e) {
    logoError.value = e instanceof Error && !('isAxiosError' in e) ? e.message : orgErrorMessage(e);
  } finally {
    logoBusy.value = false;
    logoFileKey.value++;
  }
}

async function removeLogo() {
  if (!selectedId.value || !confirm('Ta bort organisationens logga?')) return;
  logoBusy.value = true;
  logoError.value = '';
  try {
    await orgApi.removeLogo(selectedId.value);
    await loadDetails();
  } catch (e) {
    logoError.value = orgErrorMessage(e);
  } finally {
    logoBusy.value = false;
  }
}

// ---- Import users from Excel ----
type ImportRow = { row: number, username: string, password: string, role: string, units: string, departments: string };
type ImportResult = Awaited<ReturnType<typeof orgApi.importUsers>>;
const EXAMPLE_ROW = { username: 'anna.svensson', password: 'Byt-mig-2026!' }; // the example row from the template
const importRows = ref<ImportRow[]>([]);
const importCreateMissing = ref(false);
const importPreview = ref<ImportResult>();
const importError = ref('');
const importDone = ref('');
const importing = ref(false);
const importFileKey = ref(0);
const importOkCount = computed(() => importPreview.value?.results.filter(r => r.status === 'ok').length ?? 0);
const importErrorCount = computed(() => (importPreview.value?.results.length ?? 0) - importOkCount.value);

function resetImport() {
  importRows.value = [];
  importPreview.value = undefined;
  importFileKey.value++; // clears the file input
}

async function onImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  importError.value = '';
  importDone.value = '';
  importPreview.value = undefined;
  if (!file || !selectedId.value) return;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    const sheet = await readSheet(file);
    const header = (sheet[0] ?? []).map(c => String(c ?? '').trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const firstCol = (...names: string[]) => names.map(col).find(i => i >= 0) ?? -1; // the template says "Enhet"; older files said "Enheter"
    const [iUser, iPass, iRole, iUnits, iDepartments] = [col('användarnamn'), col('lösenord'), col('roll'), firstCol('enhet', 'enheter'), firstCol('avdelning', 'avdelningar')];
    if (iUser < 0 || iPass < 0) throw new Error('Hittar inte kolumnerna "Användarnamn" och "Lösenord". Använd mallen.');
    const text = (r: unknown[], i: number) => (i < 0 ? '' : String(r[i] ?? '').trim());
    const rows: ImportRow[] = [];
    sheet.slice(1).forEach((r, i) => {
      const row = { row: i + 2, username: text(r, iUser), password: String(r[iPass] ?? ''), role: text(r, iRole), units: text(r, iUnits), departments: text(r, iDepartments) };
      if (!row.username && !row.password && !row.role && !row.units && !row.departments) return; // empty row
      if (row.username === EXAMPLE_ROW.username && row.password === EXAMPLE_ROW.password) return; // untouched example row
      rows.push(row);
    });
    if (!rows.length) throw new Error('Filen innehåller inga användare.');
    if (rows.length > 500) throw new Error('Max 500 användare per fil.');
    importRows.value = rows;
    importPreview.value = await orgApi.importUsers({ organizationId: selectedId.value, dryRun: true, createMissing: importCreateMissing.value, rows });
  } catch (e) {
    importError.value = e instanceof Error && !('isAxiosError' in e) ? e.message : orgErrorMessage(e);
    resetImport();
  }
}

// Changing the option re-checks the same file, so the preview always matches what will happen.
watch(importCreateMissing, async () => {
  if (!importRows.value.length || !selectedId.value || importing.value) return;
  try {
    importPreview.value = await orgApi.importUsers({ organizationId: selectedId.value, dryRun: true, createMissing: importCreateMissing.value, rows: importRows.value });
  } catch (e) {
    importError.value = orgErrorMessage(e);
  }
});

async function runImport() {
  if (!selectedId.value || !importPreview.value) return;
  importing.value = true;
  importError.value = '';
  try {
    const result = await orgApi.importUsers({ organizationId: selectedId.value, dryRun: false, createMissing: importCreateMissing.value, rows: importRows.value });
    const skipped = result.results.length - result.created;
    importDone.value = `${result.created} användare importerades.`
      + (result.newUnits.length ? ` ${result.newUnits.length} enheter skapades.` : '')
      + (result.newDepartments.length ? ` ${result.newDepartments.length} avdelningar skapades.` : '')
      + (skipped ? ` ${skipped} rader hoppades över.` : '') + ' Radera filen – den innehåller lösenord i klartext.';
    resetImport();
    await loadDetails();
  } catch (e) {
    importError.value = orgErrorMessage(e);
  } finally {
    importing.value = false;
  }
}

// ---- Requests and invitations ----
const openRequests = ref<OrganizationRequest[]>([]);
const invitations = ref<InvitationListItem[]>([]);
const shownLink = ref<{ heading: string, url: string, days: number }>();
const copied = ref(false);
const invite = reactive({ unitId: '', organizationRole: 'member' as OrgRole, unitRole: 'member' as UnitRole, maxUses: 1, expiresInDays: 14, note: '' });

const linkFor = (token: string) => `${window.location.origin}/invite/${token}`;
const unitName = (unitId: string | null) => (unitId && details.value?.units.find(u => u.unitId === unitId)?.name) || '–';
// Expiry times are ISO timestamps (UTC) from the server
const isExpired = (item: InvitationListItem) => new Date(item.expiresAt).getTime() <= Date.now();
function invitationStatus(item: InvitationListItem) {
  if (item.revokedAt) return { label: 'Återkallad', cls: 'badge-ghost', active: false };
  if (isExpired(item)) return { label: 'Utgången', cls: 'badge-ghost', active: false };
  if (item.usedCount >= item.maxUses) return { label: 'Använd', cls: 'badge-ghost', active: false };
  return { label: 'Aktiv', cls: 'badge-success', active: true };
}

async function loadRequests() {
  if (!isPlatformAdmin.value) return;
  try { openRequests.value = await onboardingApi.listRequests('requested'); } catch (e) { errorMessage.value = orgErrorMessage(e); }
}
async function loadInvitations() {
  if (!selectedId.value) { invitations.value = []; return; }
  try { invitations.value = await onboardingApi.listInvitations(selectedId.value); } catch { invitations.value = []; }
}

async function approveRequest(request: OrganizationRequest) {
  if (!confirm(`Godkänna "${request.organizationName}"? En organisation skapas och du får en länk för första administratören.`)) return;
  errorMessage.value = '';
  try {
    const result = await onboardingApi.approveRequest(request.requestId);
    shownLink.value = { heading: `"${result.organization.name}" är skapad. Skicka den här länken till ${result.contactName} (${result.contactEmail}):`, url: linkFor(result.token), days: result.expiresInDays };
    copied.value = false;
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  }
  await loadRequests();
  await loadList();
}
async function rejectRequest(request: OrganizationRequest) {
  if (!confirm(`Avslå förfrågan från "${request.organizationName}"?`)) return;
  try { await onboardingApi.rejectRequest(request.requestId); } catch (e) { errorMessage.value = orgErrorMessage(e); }
  await loadRequests();
}

async function createInvitation() {
  if (!selectedId.value) return;
  errorMessage.value = '';
  try {
    const result = await onboardingApi.createInvitation({
      organizationId: selectedId.value,
      unitId: invite.unitId || null,
      organizationRole: invite.organizationRole,
      unitRole: invite.unitId ? invite.unitRole : undefined,
      maxUses: invite.maxUses,
      expiresInDays: invite.expiresInDays,
      note: invite.note || undefined,
    });
    shownLink.value = { heading: 'Inbjudningslänken är skapad:', url: linkFor(result.token), days: invite.expiresInDays };
    copied.value = false;
    invite.note = '';
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  }
  await loadInvitations();
}
async function revokeInvitation(invitationId: string) {
  if (!confirm('Återkalla inbjudan? Länken slutar fungera direkt.')) return;
  try { await onboardingApi.revokeInvitation(invitationId); } catch (e) { errorMessage.value = orgErrorMessage(e); }
  await loadInvitations();
}
async function copyLink() {
  if (!shownLink.value) return;
  try { await navigator.clipboard.writeText(shownLink.value.url); copied.value = true; } catch { copied.value = false; }
}

onBeforeMount(async () => {
  await loadRequests();
  await loadList();
  if (organizations.value.length === 1) await select(organizations.value[0].organizationId);
});
</script>
