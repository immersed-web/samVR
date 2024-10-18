<template>
    <div class="">
        <TabsComponent name="my_tabs_1" :tabs="tabs" v-model="modelValue">
            <template #tab1>
                <p>Innehåll - Flik 1 </p>
            </template>

            <template #tab2>
                <p>Innehåll - Flik 2</p>
            </template>

            <template #tab3>
                <p>Innehåll - Flik 3</p>
                <!--     <div class="material-icons">block</div> -->
            </template>

        </TabsComponent>
    </div>

</template>


<script setup lang="ts">

import TabsComponent from '@/views/user/TabsComponent.vue';
import { ref } from 'vue';



/* import VrSpacePortal from '@/components/entities/VrSpacePortal.vue'; */
import AutoComplete from '@/components/AutoComplete.vue';
/* import { useVrSpaceStore } from '@/stores/vrSpaceStore'; */

const tabs = [
    { label: 'Grundläggande information', slotName: 'tab1', iconName: 'visibility' },
    { label: 'Användare och rättigheter', slotName: 'tab2', iconName: 'fingerprint' },
    { label: '3D-modell', slotName: 'tab3', iconName: 'search' },
];

const modelValue = ref(0);

</script>