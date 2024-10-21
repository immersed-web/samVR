<template>
    <div class="">
        <TabsComponent :tabs="tabs" v-model="modelValue">
            <TabPanel>
                <p>Innehåll - Flik 1</p>
            </TabPanel>
            <TabPanel>
                <p>Innehåll - Flik 2</p>
            </TabPanel>
            <TabPanel>
                <p>Innehåll - Flik 3</p>
            </TabPanel>
        </TabsComponent>
    </div>

</template>


<script setup lang="ts">

import TabsComponent from '@/views/user/TabsComponent.vue';
import { TabPanel } from '@headlessui/vue';
import { ref } from 'vue';



/* import VrSpacePortal from '@/components/entities/VrSpacePortal.vue'; */
import AutoComplete from '@/components/AutoComplete.vue';
/* import { useVrSpaceStore } from '@/stores/vrSpaceStore'; */

const tabs = [
    { label: 'Grundläggande information', id: 'hkhj345', iconName: 'visibility' },
    { label: 'Användare och rättigheter', id: 'k345', iconName: 'fingerprint' },
    { label: '3D-modell', id: 'jfs3', iconName: 'search' },
];

const modelValue = ref(0);

</script>