import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useClientStore } from '@/stores/clientStore';
// import { useSenderStore } from '@/stores/senderStore';
import { hasAtLeastSecurityRole, type UserRole, type ClientType, type StreamId } from 'schemas';
import { createRouter, createWebHistory } from 'vue-router';
import { useStreamStore } from '@/stores/streamStore';
import { useAdminStore } from '@/stores/adminStore';
import { useSenderStore } from '@/stores/senderStore';
import { useTitle } from '@vueuse/core';

declare module 'vue-router' {
  interface RouteMeta {
    requiredConnectionType?: ClientType
    requiredRole?: UserRole
    afterLoginRedirect?: string
    loginNeededRedirect?: 'cameraLogin' | 'login'
    mustBeInStream?: boolean
    pickStreamRouteName?: string
    breadcrumbIgnore?: boolean
    breadcrumb?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component:  () => import('@/views/LoginView.vue'),
    },
    {
      path: '/logout',
      name: 'logout',
      component: () => import('@/views/LogoutView.vue'),
    },
    {
      path: '/enter',
      name: 'enter',
      component: () => import('@/views/public/EnterView.vue'),
    },
    // simpleLayout routes
    {
      path: '/',
      // component: () => import('@/layouts/SimpleLayout.vue'),
      component: () => import('@/layouts/HeaderLayout.vue'),
      children: [
        {
          path: '',
          name: 'start',
          meta: { requiredRole: 'guest', requiredConnectionType: 'client' },
          component: () => import('@/views/public/StartView.vue'),
        },
        {
          path: 'streams',
          name: 'streamList',
          meta: { requiredRole: 'guest', requiredConnectionType: 'client', breadcrumb: 'Strömmar' },
          component: () => import('@/views/public/StreamListView.vue'),
        },
        {
          path: 'vrSpace',
          name: '',
          meta: { requiredRole: 'guest', requiredConnectionType: 'client', breadcrumb: 'VR-scener' },
          children: [
            {
              path: '',
              name: 'vrList',
              meta: { breadcrumbIgnore: true },
              component: () => import('@/views/public/VrListView.vue'),
            },
            {
              path: 'avatar',
              name: 'avatarDesigner',
              component: () => import('@/views/user/AvatarDesigner.vue'),
            },
            {
              path: ':vrSpaceId/edit',
              name: 'vrSpaceSettings',
              props: true,
              meta: { requiredRole: 'user', breadcrumb: 'Redigera' },
              component: () => import('@/views/user/VrSpaceSettingsView.vue'),
            },
            // {
            //   path: ':vrSpaceId',
            //   name: 'vrSpace',
            //   props: true,
            //   meta: { requiredRole: 'guest' },
            //   component: () => import('@/views/user/VrSpaceSceneView.vue'),
            // },
          ],
        },
      ],
    },
    {
      path: '/vrViewer',
      component: () => import('@/layouts/EmptyLayout.vue'),
      children: [
        {
          path: ':vrSpaceId',
          name: 'vrSpace',
          props: true,
          meta: { requiredRole: 'guest' },
          component: () => import('@/views/user/VrSpaceSceneView.vue'),
        },
      ],
    },
    // guest/user routes
    {
      path: '/',
      meta: { requiredRole: 'guest', requiredConnectionType: 'client' },
      // component:  () => import('@/layouts/EmptyLayout.vue'),
      component: () => import('@/layouts/HeaderLayout.vue'),
      children: [
        {
          path: 'stream/:streamId',
          props: true,
          meta: { mustBeInStream: true },
          children: [
            {
              path: '',
              name: 'userStream',
              component: () => import('@/views/user/UserStreamView.vue'),
              props: true,
            },
            {
              path: '',
              component: () => import('@/components/AFrameScene.vue'),
              children: [
                {
                  path: ':cameraId',
                  name: 'userCamera',
                  props: route => route.params,
                  component: () => import('@/components/CameraView.vue'),

                },
                {
                  path: 'lobby',
                  name: 'userLobby',
                  component:  () => import('@/components/lobby/VrAFrame.vue'),
                },
              ],
            },
          ],
        },
        {
          path: '',
          name: 'userHome',
          // redirect: { name: 'streamList' },
          component: () => import('@/views/user/UserHomeView.vue'),
        },
        {
          path: 'vr-test',
          component: () => import('@/views/user/lobby/VRScene.vue'),
        },
        {
          path: 'vr',
          component:  () => import('@/components/AFrameScene.vue'),
          children: [
            {
              path: 'basic',
              name: 'basicVR',
              component: () => import('@/components/lobby/BasicAFrameScene.vue'),
            },
            {
              path: 'basic-2',
              name: 'basicVR2',
              component: () => import('@/components/lobby/BasicAFrameScene2.vue'),
            },
          ],
        },
        {
          path: 'vrmain',
          name: 'mainVR',
          component: () => import('@/views/user/lobby/VRScene.vue'),
        },
      ],
    },
    {
      path: '/admin/',
      meta: { requiredRole: 'admin', loginNeededRedirect: 'login', requiredConnectionType: 'client', breadcrumb: 'Admin' },
      component:  () => import('@/layouts/HeaderLayout.vue'),
      children: [
        {
          path: '',
          name: 'adminHome',
          meta: { breadcrumbIgnore: true },
          component:  () => import('@/views/admin/AdminHomeView.vue'),
        },
        {
          path: 'usermanager',
          name: 'adminUserManager',
          meta: { breadcrumb: 'Hantera användare' },
          component: () => import('@/views/admin/AdminUserManagerView.vue'),
        },
        {
          path: '',
          meta: { mustBeInStream: true, pickStreamRouteName: 'adminHome' },
          children: [

            {
              path: 'stream',
              name: 'adminStream',
              component: () => import('@/views/admin/AdminStreamView.vue'),
            },
            {
              path: 'lobby',
              name: 'adminLobby',
              component:  () => import('@/views/admin/AdminLobbyView.vue'),
            },
            {
              path: 'cameras',
              name: 'adminCameras',
              component:  () => import('@/views/admin/AdminCamerasView.vue'),
            },
          ],
        },
      ],
    },
    {
      name: 'cameraLogin',
      path: '/send/login',
      meta: {afterLoginRedirect: 'senderHome'},
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/send',
      meta: { requiredRole: 'user', requiredConnectionType: 'sender', loginNeededRedirect: 'cameraLogin' },
      component:  () => import('@/layouts/HeaderLayout.vue'),
      children: [
        {
          name: 'senderHome', path: '',
          meta: { mustBeInStream: true, pickStreamRouteName: 'senderPickStream' },
          component: () => import('@/views/sender/SenderCameraView.vue'),
        },
        {
          name: 'senderPickStream', path: 'choose-stream', component: () => import('@/views/sender/SenderPickStreamView.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/components/NotFound.vue') },
  ],
});

router.beforeEach(async (to, from) => {
  // console.log('------- New Route -------');
  // console.log('to:', to);
  // console.log('from:', from);
  const authStore = useAuthStore();
  const windowTitle = useTitle();
  windowTitle.value = 'Origoshift';

  // if(to.path === '/' && authStore.role){
  //   return { name: hasAtLeastSecurityLevel(authStore.role, 'admin') ? 'adminHome' : 'userHome'};
  // }

  if (to.meta.requiredRole) {
    // if not logged in we can try to restore from session
    if(!authStore.isAuthenticated && authStore.hasCookie) {
      console.log('some kind of user role required. Found cookie. Trying to restore session.');
      await authStore.restoreFromSession();
    }
    if(!authStore.isAuthenticated && to.meta.requiredRole === 'guest'){
      if(authStore.persistedUsername !== undefined){
        console.log('Found a persisted username. Creating a guest with that username');
        await authStore.autoGuest(authStore.persistedUsername);
      } else {
        return {name: 'enter'};
      }
    }

    if (!authStore.role || !hasAtLeastSecurityRole(authStore.role, to.meta.requiredRole)) {
      const redirect = to.meta.loginNeededRedirect || 'login';
      console.log('No role or role too low. Redirecting to:', redirect);
      return { name: redirect /*, query: { next: to.fullPath } */ };
    }
  }
  if (to.meta.requiredConnectionType) {
    const connectionStore = useConnectionStore();
    // console.log('Connection required. Creating if doesn\'t exist');

    if(!authStore.isAuthenticated){
      throw Error('Eeeeh. You are not logged but you shouldnt even reach this code without being logged in. Something is wrooong');
    }
    if(!connectionStore.clientExists){
      console.log('Connection required. Creating one');
      if (to.meta.requiredConnectionType === 'client') {
        connectionStore.createUserClient();
        const clientStore = useClientStore();
        // clientStore.fetchClientState();
      } else {
        connectionStore.createSenderClient();
        const senderStore = useSenderStore();
        // TODO: Here is a possible race conditon where we currently rely on the set/get senderId being called on the server before the server handles the later joinStream.
        // We currently dont await that the senderId is correctly agreed between server and client before proceeding.
        // Perhaps we should remove the initialization of senderId from being autotriggered in store and explicitly call it here?
        // await senderStore.initSenderId();
      }
      // console.log('CONNECTED STATE IN NAV GUARD: ', connectionStore.connected);
    } else if (connectionStore.connectionType !== to.meta.requiredConnectionType) {
      throw Error('you are already connected to the backend as the wrong type of client. Close the current connection before going to this route.');
    }
  }
  if (to.meta.mustBeInStream) {
    console.log('Entering route that requires to be in a stream.');
    const streamStore = useStreamStore();

    if (!streamStore.currentStream || streamStore.currentStream.streamId !== streamStore.savedStreamId) {
      const streamId = streamStore.savedStreamId ?? to.params.streamId as StreamId;
      // console.log('streamId:', streamId);
      if (!streamId) {
        if (to.meta.pickStreamRouteName) return { name: to.meta.pickStreamRouteName };
        const routeName = `${authStore.routePrefix}Home`;
        return { name: routeName};
      }
      const connection = useConnectionStore();
      if (connection.connectionType === 'client' && hasAtLeastSecurityRole(authStore.role, 'moderator')) {
        const adminStore = useAdminStore();
        try{
          console.log('Trying to loadAndJoinStreamAsAdmin');
          await adminStore.loadAndJoinStreamAsAdmin(streamId);
        } catch (e) {
          console.error('failed to loadAndJoinStreamAsAdmin');
          console.log(e);
          if (to.meta.pickStreamRouteName) return { name: to.meta.pickStreamRouteName };
          const routeName = `${authStore.routePrefix}Home`;
          return { name: routeName};
          // console.warn('nav guard tried to load stream that was already loaded');
        }
      }else{
        console.log('Trying to loadAndJoinStream');
        await streamStore.loadAndJoinStream(streamId);
      }
    }
    const streamName = streamStore.currentStream?.name;
    if (streamName) {
      // console.log('Setting new title');
      windowTitle.value = `${streamName} - ${import.meta.env.EXPOSED_APP_NAME}`;
    }
  }
});

export default router;
