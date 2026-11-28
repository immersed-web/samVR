import axios, { type AxiosResponse } from 'axios';

import type { JwtPayload, JwtUserData, UserRole } from 'schemas';
import type { User } from 'database/schema';
import decodeJwt from 'jwt-decode';

const devMode = import.meta.env.DEV;
const localMode = import.meta.env.EXPOSED_LOCAL === 'true';
console.log('localMode:', localMode);

let completeAuthUrl: string;
if (localMode) {
  completeAuthUrl = `http://${import.meta.env.EXPOSED_SERVER_URL}:${import.meta.env.EXPOSED_AUTH_PORT}`;
} else {
  completeAuthUrl = `https://${import.meta.env.EXPOSED_SERVER_URL}${import.meta.env.EXPOSED_AUTH_PATH}`;
}

console.log('authUrl: ', completeAuthUrl);
const authEndpoint = axios.create({ baseURL: completeAuthUrl, withCredentials: true });

export function createUser(username: string, password: string, role: UserRole) {
  return handleResponse(() => authEndpoint.post('/user/create', {
    role: role.toString(),
    username,
    password,
  }));
}

// export function createAdmin(username: string, password: string) {
//   return handleResponse(() => authEndpoint.post('/user/create', {
//     role: 'admin',
//     username,
//     password,
//   }));
// }

export function createSender(username: string, password: string, streamId: string) {
  return handleResponse<FetchedUsers>(() => authEndpoint.post('/user/create-sender', {
    streamId,
    username,
    password,
  }));
}

export function updateUser(userData: {userId: string, username?: string, password?: string}) {
  return handleResponse(() => authEndpoint.post('/user/update', userData));
}

export function deleteUser(userId: string) {
  return handleResponse(() => authEndpoint.post('/user/delete', { userId }));
}

type FetchedUsers = Omit<User, 'password'>[]
export function getUsers() {
  return handleResponse<FetchedUsers>(() => authEndpoint.get('/user/get-users'));
}

export function getAdmins() {
  return handleResponse<FetchedUsers>(() => authEndpoint.get('/user/get-admins'));
}

// type FetchedSenders = FetchedUsers[number]
export function getSendersForStream(streamId: string) {
  const response = handleResponse<FetchedUsers>(() => authEndpoint.post('/user/get-sender', {
    streamId,
  }));
  return response;
}


const handleResponse = async <ReturnType>(apiCall: () => Promise<AxiosResponse<ReturnType>>) => {
  try {
    const response = await apiCall();
    // console.log('user/auth Api response received:', response);
    return response.data;
  } catch (e: any) {
    return Promise.reject(Error(e.response.data));
  }
};

export const login = async (username: string, password: string) => {
  stopTokenRefresh();
  try {
    await authEndpoint.post('/user/login', {
      username,
      password,
    });
    // return response.data;
    return Promise.resolve();
  } catch (e: any) {
    return Promise.reject(Error(e.response.data));
  }
};


if(import.meta.hot){
  import.meta.hot.on('vite:beforeUpdate', () => clearTimeout(activeTimeout));
}
let activeTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

export const getToken = () => {
  // console.log('token getter called');
  return latestJwtToken;
};
let latestJwtToken: string | undefined;
// let prepopulatedLogin: () => Promise<void>;


let nrOfRetries = 0;
let refreshGeneration = 0;

export function stopTokenRefresh() {
  refreshGeneration++;
  clearTimeout(activeTimeout);
  activeTimeout = undefined;
  latestJwtToken = undefined;
  nrOfRetries = 0;
}

export function isMissingSession(error: unknown) {
  return axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
}

const autoFetchJwt = async (
  assignFn: (receivedToken: string) => void,
  fetchFn: () => Promise<string>,
  failRecoveryFn?: () => Promise<string>,
  initial = false,
  generation = refreshGeneration,
  onSessionExpired?: () => void,
) => {
  if (generation !== refreshGeneration) return;
  if(activeTimeout){
    // console.log('cleared old jwt autofetch timeout');
    clearTimeout(activeTimeout);
    activeTimeout = undefined;
  }
  try{
    let receivedToken;
    if(nrOfRetries > 3 && failRecoveryFn){
      receivedToken = await failRecoveryFn();
    } else {
      receivedToken = await fetchFn();
    }
    if (generation !== refreshGeneration) return;
    const decodedToken = decodeJwt<JwtPayload>(receivedToken);
    if(!decodedToken.exp) {
      throw Error('no exp key found in token');
    }
    assignFn(receivedToken);
    nrOfRetries = 0;
    const expUnixStamp = new Date(decodedToken.exp * 1000);
    const expInMillis = expUnixStamp.valueOf() - Date.now();
    console.log('jwtToken expires in (millis):', expInMillis);
    console.log('jwtToken expires in (seconds):', expInMillis * 0.001);
    // console.log('UTC now is:', new Date().toUTCString());
    const refetchIn = expInMillis > 2000 ? expInMillis - 1500 : expInMillis * 0.7;
    activeTimeout = setTimeout(() => {
      void autoFetchJwt(assignFn, fetchFn, failRecoveryFn, false, generation, onSessionExpired);
    }, refetchIn);
  } catch (e) {
    if (generation !== refreshGeneration) return;
    if (initial) throw e;
    if (!failRecoveryFn && isMissingSession(e)) {
      stopTokenRefresh();
      onSessionExpired?.();
      return;
    }
    console.error(e);
    const retryIn = 5;
    nrOfRetries++;
    console.log('nrOfRetries:', nrOfRetries);
    console.error(`Something seems wrong with jwt fetching. Retrying in ${retryIn} seconds`);
    activeTimeout = setTimeout(() => {
      void autoFetchJwt(assignFn, fetchFn, failRecoveryFn, false, generation, onSessionExpired);
    }, retryIn * 1000);
  }
};

/**
 * Keeps a guest token fresh. `firstToken` lets the caller start from an already issued token,
 * for example the one-space token from the public gallery (refreshes keep its limit on the server).
 */
export const guestAutoToken =  async (assignFn?: (receivedToken: string) => void, username?: string, firstToken?: string) => {
  let pendingFirstToken = firstToken;
  stopTokenRefresh();
  const combinedAssigner = (t: string) => {
    username = undefined;
    if(assignFn){
      assignFn(t);
    }
    latestJwtToken = t;
  };
  return await autoFetchJwt(
    combinedAssigner,
    async () => {
      if (pendingFirstToken) {
        const t = pendingFirstToken;
        pendingFirstToken = undefined;
        return t;
      }
      return await guestJwt({previousToken: latestJwtToken, requestedUsername: username});
    },
    async () => await guestJwt(),
  );

  // return latestJwtToken;
};

export const userAutoToken = async (assignFn?: (receivedToken: string) => void, onSessionExpired?: () => void) => {
  stopTokenRefresh();

  const combinedAssigner = (t: string) => {
    if(assignFn){
      assignFn(t);
    }
    latestJwtToken = t;
  };
  return await autoFetchJwt(combinedAssigner, getJwt, undefined, true, refreshGeneration, onSessionExpired);
};

/**
 * Tries to login with the provided user credentials. Also initiates an ongoing autofetching of tokens when the current one is about to expire.
 * After calling this function, you should be able to get the latest valid token by simply calling getToken()
 * @returns an access token. Use it within the expiration period! If you can't use the token direclty, you can get an updated recent token by calling getToken()
 */
export const loginWithAutoToken = async (username: string, password: string) => {

  // prepopulatedLogin = () => login(username, password);
  await login(username, password);

  await userAutoToken(t => latestJwtToken = t);
  return latestJwtToken;
};

// export const deleteUser = (uuid: string) => authEndpoint.post('delete-user', { uuid });
// export const createUser = (payload: { username: string, password: string, gathering?: string, role: NonGuestUserRole }) => handleResponse<Omit<UserWithIncludes, 'password'>>(() => authEndpoint.post('create', payload));
// export const updateUser = (payload: { uuid: string, username?: string, password?: string, gathering?: string, role?: NonGuestUserRole }) => handleResponse<Omit<UserWithIncludes, 'password'>>(() => authEndpoint.post('update', payload));
// export const getUsers = (payload: Record<string, unknown>) => handleResponse<Omit<UserWithIncludes, 'password'>[]>(() => authEndpoint.post('get-users', payload));

export const guestJwt = (params?: {requestedUsername?: string, previousToken?: string}) => {
  if(params?.previousToken){
    return handleResponse<string>(() => authEndpoint.get(`/guest-jwt?prevToken=${params.previousToken}`));
  }
  if(params?.requestedUsername){
    return handleResponse<string>(() => authEndpoint.get(`/guest-jwt?username=${params.requestedUsername}`));
  }
  return handleResponse<string>(() => authEndpoint.get('/guest-jwt'));
};
export const getJwt = async () => (await authEndpoint.get<string>('user/jwt')).data;
export const getMe = () => handleResponse<JwtUserData>(() => authEndpoint.get('user/me'));
export const logout = () => {
  stopTokenRefresh();
  return handleResponse<void>(() => authEndpoint.get('user/logout'));
};

// ---------------------------------------------------------------------------
// Organizations (municipalities, companies, ...) and their units
// ---------------------------------------------------------------------------
export type OrgType = 'municipality' | 'company' | 'other';
/** A unit the logged-in person administers (unit administrator). */
export type AdministeredUnit = { organizationId: string, organizationName: string, unitId: string, unitName: string };
export type OrgRole = 'basic' | 'member' | 'org_admin';
export type UnitRole = 'unit_admin' | 'member';
export type OrganizationListItem = { organizationId: string, name: string, type: OrgType, memberCount?: number, unitCount?: number, myRole?: OrgRole, logoVersion: number | null };
export type OrganizationDetails = {
  organization: { organizationId: string, name: string, type: OrgType, logoVersion: number | null },
  units: { unitId: string, name: string }[],
  members: { userId: string, username: string, role: OrgRole }[],
  unitMembers: { unitId: string, userId: string, role: UnitRole }[],
  departments: { departmentId: string, unitId: string, name: string }[],
  departmentMembers: { departmentId: string, userId: string, unitId: string }[],
};

/** Pull the server's message out of a failed request so it can be shown to the user. */
export function orgErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.response?.status === 403) return 'Du har inte behörighet att göra detta.';
  }
  return 'Något gick fel. Försök igen.';
}

export type AssignableOrganization = { organizationId: string, name: string, units: { unitId: string, name: string }[] };

export const orgApi = {
  list: async () => (await authEndpoint.get<OrganizationListItem[]>('/org/list')).data,
  get: async (organizationId: string) => (await authEndpoint.get<OrganizationDetails>(`/org/${organizationId}`)).data,
  create: (name: string, type: OrgType) => authEndpoint.post('/org/create', { name, type }),
  remove: (organizationId: string) => authEndpoint.post('/org/delete', { organizationId }),
  createUnit: (organizationId: string, name: string) => authEndpoint.post('/org/unit/create', { organizationId, name }),
  removeUnit: (unitId: string) => authEndpoint.post('/org/unit/delete', { unitId }),
  setMember: (organizationId: string, userId: string, role: OrgRole) => authEndpoint.post('/org/member/set', { organizationId, userId, role }),
  removeMember: (organizationId: string, userId: string) => authEndpoint.post('/org/member/remove', { organizationId, userId }),
  setUnitMember: (unitId: string, userId: string, role: UnitRole) => authEndpoint.post('/org/unit/member/set', { unitId, userId, role }),
  removeUnitMember: (unitId: string, userId: string) => authEndpoint.post('/org/unit/member/remove', { unitId, userId }),
  createUser: (payload: { organizationId: string, username: string, password: string, role: OrgRole, unitIds: string[], departmentIds?: string[] }) => authEndpoint.post('/org/user/create', payload),
  createDepartment: async (unitId: string, name: string) => (await authEndpoint.post<{ departmentId: string, unitId: string, name: string }>('/org/department/create', { unitId, name })).data,
  deleteDepartment: (departmentId: string) => authEndpoint.post('/org/department/delete', { departmentId }),
  setDepartmentMember: (departmentId: string, userId: string) => authEndpoint.post('/org/department/member/set', { departmentId, userId }),
  removeDepartmentMember: (departmentId: string, userId: string) => authEndpoint.post('/org/department/member/remove', { departmentId, userId }),
  setLogo: (organizationId: string, image: string) => authEndpoint.post('/org/logo', { organizationId, image }),
  removeLogo: (organizationId: string) => authEndpoint.post('/org/logo/remove', { organizationId }),
  setUserPassword: (payload: { organizationId: string, userId: string, password: string }) => authEndpoint.post('/org/user/password', payload),
  deleteUser: (payload: { organizationId: string, userId: string }) => authEndpoint.post('/org/user/delete', payload),
  importUsers: async (payload: { organizationId: string, dryRun: boolean, createMissing?: boolean, rows: { row: number, username: string, password: string, role: string, units: string, departments: string }[] }) =>
    (await authEndpoint.post<{ dryRun: boolean, created: number, results: { row: number, username: string, status: 'ok' | 'error', message?: string }[], newUnits: string[], newDepartments: string[] }>('/org/user/import', payload)).data,
  myUnits: async () => (await authEndpoint.get<AdministeredUnit[]>('/org/my-units')).data,
  assignable: async () => (await authEndpoint.get<AssignableOrganization[]>('/org/assignable')).data,
  assign: (payload: { type: 'vrSpace' | 'stream' | 'asset', id: string, organizationId: string | null, unitId: string | null }) => authEndpoint.post('/org/resource/assign', payload),
};

// ---------------------------------------------------------------------------
// Onboarding: organization requests and invitations
// ---------------------------------------------------------------------------
export type OrganizationRequest = {
  requestId: string, organizationName: string, organizationType: OrgType, contactName: string, contactEmail: string,
  expectedUsers: number | null, message: string | null, status: 'requested' | 'approved' | 'rejected', createdAt: string | null, handledAt: string | null,
};
export type InvitationPreview = { organizationName: string, unitName: string | null, organizationRole: OrgRole, expiresAt: string, loggedIn: boolean, username: string | null };
export type InvitationListItem = {
  invitationId: string, unitId: string | null, organizationRole: OrgRole, unitRole: UnitRole, note: string | null,
  maxUses: number, usedCount: number, expiresAt: string, revokedAt: string | null, createdAt: string | null,
};

export const onboardingApi = {
  submitRequest: (payload: { organizationName: string, organizationType: OrgType, contactName: string, contactEmail: string, expectedUsers?: number, message?: string, website?: string }) =>
    authEndpoint.post('/onboarding/request', payload),
  previewInvitation: async (token: string) => (await authEndpoint.get<InvitationPreview>(`/onboarding/invitation/${encodeURIComponent(token)}`)).data,
  acceptInvitation: async (payload: { token: string, username?: string, password?: string }) =>
    (await authEndpoint.post<{ ok: true, organizationName: string, createdAccount: boolean, username: string }>('/onboarding/accept', payload)).data,
  listRequests: async (status?: OrganizationRequest['status']) => (await authEndpoint.get<OrganizationRequest[]>('/onboarding/requests', { params: status ? { status } : undefined })).data,
  approveRequest: async (requestId: string, organizationName?: string) =>
    (await authEndpoint.post<{ organization: { organizationId: string, name: string }, contactEmail: string, contactName: string, token: string, expiresInDays: number }>('/onboarding/requests/approve', { requestId, organizationName })).data,
  rejectRequest: (requestId: string) => authEndpoint.post('/onboarding/requests/reject', { requestId }),
  createInvitation: async (payload: { organizationId: string, unitId?: string | null, organizationRole?: OrgRole, unitRole?: UnitRole, expiresInDays?: number, maxUses?: number, note?: string }) =>
    (await authEndpoint.post<{ invitationId: string, expiresAt: string, token: string }>('/onboarding/invitations/create', payload)).data,
  listInvitations: async (organizationId: string) => (await authEndpoint.get<InvitationListItem[]>(`/onboarding/invitations/${organizationId}`)).data,
  revokeInvitation: (invitationId: string) => authEndpoint.post('/onboarding/invitations/revoke', { invitationId }),
};

// ---------------------------------------------------------------------------
// Public guest gallery (no login needed)
// ---------------------------------------------------------------------------
export type GalleryOrganization = { organizationId: string, name: string, type: OrgType, spaceCount: number, logoVersion: number | null };

/** Public URL of an organization's logo. `version` changes whenever the logo does, so browsers never show a stale one. */
export const orgLogoUrl = (organizationId: string, version: number | null | undefined) =>
  version ? `${completeAuthUrl}/gallery/logo/${organizationId}?v=${version}` : undefined;
export type GallerySpace = { vrSpaceId: string, name: string, description: string | null };

export const galleryApi = {
  organizations: async (kind?: 'municipality' | 'company') =>
    (await authEndpoint.get<GalleryOrganization[]>('/gallery/organizations', { params: kind ? { kind } : undefined })).data,
  organization: async (organizationId: string) =>
    (await authEndpoint.get<{ organization: { name: string, type: OrgType, logoVersion: number | null }, spaces: GallerySpace[] }>(`/gallery/organizations/${organizationId}`)).data,
  personal: async (offset: number, limit = 24) =>
    (await authEndpoint.get<{ spaces: GallerySpace[], hasMore: boolean }>('/gallery/personal', { params: { offset, limit } })).data,
  /** A guest token that is only valid for this one VR space. */
  enter: async (vrSpaceId: string, username?: string) =>
    (await authEndpoint.post<string>('/gallery/enter', { vrSpaceId, username: username || undefined })).data,
};

// ---------------------------------------------------------------------------
// Platform user management (platform administrators) and the users' inbox
// ---------------------------------------------------------------------------
export type ManagedUser = {
  userId: string, username: string, role: UserRole, createdAt: string | null, lastLoginAt: string | null,
  blockedAt: string | null, blockedReason: string | null, spaceCount: number,
  organizations: { organizationId: string, name: string, role: OrgRole }[],
};
export type ManageUsersQuery = {
  search?: string, role?: UserRole, status?: 'all' | 'active' | 'blocked', org?: string,
  sort?: 'username' | 'createdAt' | 'lastLoginAt' | 'role', order?: 'asc' | 'desc', offset?: number, limit?: number,
};
export type ManagedUserDetails = {
  user: Omit<ManagedUser, 'organizations' | 'spaceCount'>,
  organizations: { organizationId: string, name: string, role: OrgRole }[],
  units: { name: string, organizationId: string, role: UnitRole }[],
  departments: { name: string, unitId: string }[],
  spaces: { vrSpaceId: string, name: string, visibility: string, organizationId: string | null }[],
  messages: { received: number, unread: number },
  canManage: boolean,
  assignableRoles: UserRole[],
};
export type UsersSummary = {
  total: number, blocked: number, withoutOrganization: number, neverLoggedIn: number,
  byRole: { role: UserRole, count: number }[], organizations: { organizationId: string, name: string }[],
};

export const manageUsersApi = {
  list: async (query: ManageUsersQuery) => (await authEndpoint.get<{ total: number, users: ManagedUser[] }>('/manage/users', { params: query })).data,
  summary: async () => (await authEndpoint.get<UsersSummary>('/manage/users/summary')).data,
  get: async (userId: string) => (await authEndpoint.get<ManagedUserDetails>(`/manage/users/${userId}`)).data,
  create: async (payload: { username: string, role: UserRole, password?: string }) =>
    (await authEndpoint.post<{ userId: string, username: string, password?: string }>('/manage/users/create', payload)).data,
  update: (payload: { userId: string, username?: string, role?: UserRole }) => authEndpoint.post('/manage/users/update', payload),
  resetPassword: async (userId: string, password?: string) =>
    (await authEndpoint.post<{ password?: string }>('/manage/users/password', { userId, password })).data,
  block: (userId: string, blocked: boolean, reason?: string) => authEndpoint.post('/manage/users/block', { userId, blocked, reason }),
  remove: (userId: string) => authEndpoint.post('/manage/users/delete', { userId }),
  message: async (payload: { userIds?: string[], organizationId?: string, subject: string, body: string }) =>
    (await authEndpoint.post<{ sent: number }>('/manage/users/message', payload)).data,
};

export type InboxMessage = { messageId: string, subject: string, body: string, createdAt: string, readAt: string | null, from: string | null };
export const messagesApi = {
  summary: async () => (await authEndpoint.get<{ unread: number }>('/messages/summary')).data,
  list: async () => (await authEndpoint.get<{ unread: number, messages: InboxMessage[] }>('/messages')).data,
  markRead: (messageId?: string) => authEndpoint.post('/messages/read', { messageId }),
  remove: (messageId: string) => authEndpoint.post('/messages/delete', { messageId }),
};

// ---------------------------------------------------------------------------
// "Hantera användare" for an organization's own administrators (scoped to one organization)
// ---------------------------------------------------------------------------
export type OrgManagedUser = {
  userId: string, username: string, orgRole: OrgRole, createdAt: string | null, lastLoginAt: string | null, blockedAt: string | null,
  units: string[], departments: string[],
  /** Why this account cannot be changed by the caller; null when it can. */
  manageReason: string | null,
};
export type OrgUsersQuery = {
  search?: string, role?: OrgRole, status?: 'all' | 'active' | 'blocked',
  sort?: 'username' | 'role' | 'createdAt' | 'lastLoginAt', order?: 'asc' | 'desc', offset?: number, limit?: number,
};
export const orgUsersApi = (organizationId: string) => {
  const base = `/manage/org/${organizationId}/users`;
  return {
    list: async (query: OrgUsersQuery) => (await authEndpoint.get<{ total: number, users: OrgManagedUser[] }>(base, { params: query })).data,
    summary: async () => (await authEndpoint.get<{ total: number, blocked: number, neverLoggedIn: number, byRole: { role: OrgRole, count: number }[] }>(`${base}/summary`)).data,
    resetPassword: async (userId: string, password?: string) => (await authEndpoint.post<{ password?: string }>(`${base}/password`, { userId, password })).data,
    block: (userId: string, blocked: boolean, reason?: string) => authEndpoint.post(`${base}/block`, { userId, blocked, reason }),
    remove: (userId: string) => authEndpoint.post(`${base}/delete`, { userId }),
    message: async (payload: { userIds?: string[], everyone?: boolean, subject: string, body: string }) =>
      (await authEndpoint.post<{ sent: number }>(`${base}/message`, payload)).data,
  };
};

// ---------------------------------------------------------------------------
// The media library of an organization (administrators). Files are shown per unit.
// ---------------------------------------------------------------------------
export type MediaType = 'image' | 'video' | 'model' | 'document';
export type OrgMediaFile = {
  assetId: string, assetType: MediaType, originalFileName: string, generatedName: string, assetFileExtension: string,
  size: number | null, mimeType: string | null, createdAt: string | null,
  unitId: string | null, unitName: string | null, uploader: string | null,
  /** In how many places the file is used (placed in a VR space, or used as its model or preview). */
  usedIn: number,
};
export type OrgMediaQuery = { unit?: string, type?: MediaType, search?: string, offset?: number, limit?: number };
export type OrgMediaSummary = {
  total: number, bytes: number,
  byUnit: { unitId: string | null, total: number, bytes: number, image: number, video: number, model: number, document: number }[],
};
export const orgMediaApi = (organizationId: string) => {
  const base = `/manage/org/${organizationId}/media`;
  return {
    list: async (query: OrgMediaQuery) => (await authEndpoint.get<{ total: number, assets: OrgMediaFile[] }>(base, { params: query })).data,
    summary: async () => (await authEndpoint.get<OrgMediaSummary>(`${base}/summary`)).data,
    move: (assetId: string, unitId: string | null) => authEndpoint.post(`${base}/move`, { assetId, unitId }),
  };
};
