<template>
  <div class="min-h-screen bg-base-100">
    <header class="navbar bg-base-200 sticky top-0 z-10">
      <div class="navbar-start">
        <div class="dropdown lg:hidden">
          <div tabindex="0" role="button" class="btn btn-ghost btn-square" aria-label="Meny">
            <span class="material-icons">menu</span>
          </div>
          <ul tabindex="0" class="menu dropdown-content bg-base-200 rounded-box z-20 mt-3 w-52 p-2 shadow">
            <li v-for="link in links" :key="link.href"><a :href="link.href">{{ link.label }}</a></li>
          </ul>
        </div>
        <a href="#top" class="btn btn-ghost text-xl"><span>Sam<span class="text-primary">VR</span></span></a>
      </div>
      <nav class="navbar-center hidden lg:flex" aria-label="Huvudmeny">
        <ul class="menu menu-horizontal">
          <li v-for="link in links" :key="link.href"><a :href="link.href">{{ link.label }}</a></li>
        </ul>
      </nav>
      <div class="navbar-end gap-2">
        <RouterLink class="btn btn-ghost btn-sm" :to="{ name: 'guestGallery' }">Besök som gäst</RouterLink>
        <RouterLink class="btn btn-primary btn-sm" :to="{ name: 'login' }">Logga in</RouterLink>
      </div>
    </header>

    <main id="top">
      <!-- HERO -->
      <section class="hero bg-base-200 py-16">
        <div class="hero-content flex-col-reverse lg:flex-row-reverse gap-10 max-w-6xl">
          <div class="mockup-window border border-base-300 bg-base-300 w-full max-w-md" aria-hidden="true">
            <div class="bg-base-100 flex flex-col gap-3 p-6">
              <div class="flex items-center gap-3">
                <div class="avatar placeholder"><div class="bg-primary text-primary-content w-10 rounded-full"><span class="material-icons">face</span></div></div>
                <div class="avatar placeholder"><div class="bg-secondary text-secondary-content w-10 rounded-full"><span class="material-icons">face</span></div></div>
                <div class="avatar placeholder"><div class="bg-accent text-accent-content w-10 rounded-full"><span class="material-icons">face</span></div></div>
                <span class="badge badge-success gap-1">3 i rummet</span>
              </div>
              <div class="card bg-base-200">
                <div class="card-body items-center text-center p-6">
                  <span class="material-icons text-primary">view_in_ar</span>
                  <p>Delad 3D-modell</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <span class="badge badge-primary badge-outline mb-4">Virtuella rum för samarbete</span>
            <h1 class="text-4xl md:text-5xl font-bold">Möt, lär och skapa <span class="text-primary">tillsammans i 3D</span></h1>
            <p class="py-6">Med SamVR bygger din skola, ditt företag eller din kommun egna virtuella miljöer och möts i dem – direkt i webbläsaren, på mobilen eller med VR-headset.</p>
            <div class="flex flex-wrap gap-2">
              <RouterLink class="btn btn-primary" :to="{ name: 'requestOrganization' }">Skicka en förfrågan →</RouterLink>
              <RouterLink class="btn btn-outline" :to="{ name: 'guestGallery' }">Besök som gäst</RouterLink>
            </div>
            <div class="flex flex-wrap gap-2 mt-6">
              <span class="badge badge-outline">Fungerar i webbläsaren</span>
              <span class="badge badge-outline">Stöd för VR-headset</span>
              <span class="badge badge-outline">Egen organisation och eget utrymme</span>
            </div>
          </div>
        </div>
      </section>

      <!-- AUDIENCE -->
      <section id="for-vem" class="py-16 px-4">
        <div class="max-w-6xl mx-auto">
          <span class="badge badge-secondary badge-outline mb-3">För vem</span>
          <h2 class="text-4xl font-bold">En plattform – tre sätt att använda den</h2>
          <p class="py-4 max-w-2xl">Oavsett om du undervisar en klass, leder ett team eller driver verksamhet i en kommun får du ett eget, avgränsat utrymme.</p>
          <div class="grid gap-6 md:grid-cols-3">
            <article v-for="a in audiences" :key="a.title" class="card card-bordered bg-base-200">
              <div class="card-body">
                <span class="material-icons text-primary">{{ a.icon }}</span>
                <h3 class="card-title">{{ a.title }}</h3>
                <p>{{ a.lead }}</p>
                <ul class="list-disc list-inside">
                  <li v-for="p in a.points" :key="p">{{ p }}</li>
                </ul>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- FEATURES -->
      <section id="funktioner" class="py-16 px-4 bg-base-200">
        <div class="max-w-6xl mx-auto">
          <span class="badge badge-secondary badge-outline mb-3">Funktioner</span>
          <h2 class="text-4xl font-bold mb-8">Allt du behöver för att samlas i 3D</h2>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="f in features" :key="f.title" class="card bg-base-100">
              <div class="card-body">
                <span class="material-icons text-primary">{{ f.icon }}</span>
                <h3 class="card-title">{{ f.title }}</h3>
                <p>{{ f.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- HOW -->
      <section id="sa-funkar-det" class="py-16 px-4">
        <div class="max-w-6xl mx-auto">
          <span class="badge badge-secondary badge-outline mb-3">Så funkar det</span>
          <h2 class="text-4xl font-bold mb-8">Från förfrågan till första mötet</h2>
          <div class="grid gap-6 md:grid-cols-3">
            <div v-for="(s, i) in steps" :key="s.title" class="card card-bordered bg-base-200">
              <div class="card-body">
                <span class="badge badge-primary badge-lg">{{ i + 1 }}</span>
                <h3 class="card-title">{{ s.title }}</h3>
                <p>{{ s.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CONTROL -->
      <section id="kontroll" class="py-16 px-4 bg-base-200">
        <div class="max-w-6xl mx-auto grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <span class="badge badge-secondary badge-outline mb-3">Trygghet och kontroll</span>
            <h2 class="text-4xl font-bold">Ni bestämmer vem som ser vad</h2>
            <p class="py-4">Varje organisation är sitt eget avgränsade utrymme. Inom organisationen delar ni upp verksamheten i enheter, och bara dem som lagts till får tillträde.</p>
            <ul class="flex flex-col gap-3">
              <li v-for="c in controls" :key="c.title" class="flex gap-2">
                <span class="material-icons text-success">check_circle</span>
                <span><b>{{ c.title }}</b> {{ c.text }}</span>
              </li>
            </ul>
          </div>
          <ul class="menu bg-base-100 rounded-box w-full" aria-label="Exempel på organisationsstruktur">
            <li class="menu-title">Exempel på organisationsstruktur</li>
            <li>
              <span>🏛️ Exempelkommunen <span class="badge badge-primary">Organisation</span></span>
              <ul>
                <li>
                  <span>Grundskola Norr <span class="badge badge-secondary">Enhet</span></span>
                  <ul><li><span>Klass 7B – 28 elever <span class="badge badge-outline">Medlemmar</span></span></li></ul>
                </li>
                <li><span>Gymnasiet <span class="badge badge-secondary">Enhet</span></span></li>
                <li><span>Kultur och fritid <span class="badge badge-secondary">Enhet</span></span></li>
              </ul>
            </li>
            <li><span>👤 Rektor Karin <span class="badge badge-primary">Administratör</span></span></li>
          </ul>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-16 px-4">
        <div class="card bg-primary text-primary-content max-w-4xl mx-auto">
          <div class="card-body items-center text-center">
            <h2 class="card-title text-3xl">Redo att prova SamVR i din organisation?</h2>
            <p>Skicka en förfrågan så hör vi av oss. Du behöver inte binda dig till något för att fråga.</p>
            <div class="card-actions">
              <RouterLink class="btn btn-neutral" :to="{ name: 'requestOrganization' }">Skicka en förfrågan →</RouterLink>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section id="faq" class="pb-16 px-4">
        <div class="max-w-3xl mx-auto">
          <div class="text-center mb-8">
            <span class="badge badge-secondary badge-outline mb-3">Vanliga frågor</span>
            <h2 class="text-4xl font-bold">Bra att veta</h2>
          </div>
          <div class="join join-vertical w-full">
            <div v-for="q in faq" :key="q.q" class="collapse collapse-arrow join-item border border-base-300">
              <input type="radio" name="faq" :aria-label="q.q">
              <div class="collapse-title font-semibold">{{ q.q }}</div>
              <div class="collapse-content"><p>{{ q.a }}</p></div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer footer-center bg-base-200 p-6 items-center">
      <aside class="grid-flow-col items-center gap-2">
        <span class="text-lg font-bold">Sam<span class="text-primary">VR</span></span>
        <p>© {{ year }} SamVR. Alla rättigheter förbehållna.</p>
      </aside>
      <nav>
        <RouterLink class="link link-hover" :to="{ name: 'requestOrganization' }">Skicka en förfrågan</RouterLink>
      </nav>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Public marketing page. Shown at /om, and to visitors who are not logged in when they open the start page.
const year = new Date().getFullYear();

const links = [
  { href: '#for-vem', label: 'För vem' },
  { href: '#funktioner', label: 'Funktioner' },
  { href: '#sa-funkar-det', label: 'Så funkar det' },
  { href: '#kontroll', label: 'Trygghet' },
  { href: '#faq', label: 'Frågor' },
];

const audiences = [
  {
    icon: 'school', title: 'Skolor och pedagoger',
    lead: 'Låt eleverna kliva in i miljön i stället för att bara läsa om den.',
    points: ['Bygg historiska platser, laborationer och studiebesök', 'Dela en länk – eleverna behöver inget konto för att delta som gäster', 'En enhet per skola eller klass med egna administratörer'],
  },
  {
    icon: 'business_center', title: 'Företag',
    lead: 'Möten, onboarding och produktvisningar som känns som att vara på plats.',
    points: ['Visa 3D-modeller av produkter, lokaler och maskiner', 'Samla teamet i ett delat rum med röst och närvaro', 'Håll internt material avgränsat till rätt avdelning'],
  },
  {
    icon: 'account_balance', title: 'Kommuner',
    lead: 'Ett gemensamt system för många verksamheter, med tydlig behörighetsstyrning.',
    points: ['Organisation med enheter, till exempel skolor och förvaltningar', 'Administratörer på varje nivå', 'Importera användare från en Excel-fil'],
  },
];

const features = [
  { icon: 'view_in_ar', title: 'Egna virtuella miljöer', text: 'Skapa rum och ladda upp dina egna 3D-modeller. Bestäm vem som får komma in.' },
  { icon: 'headset_mic', title: 'Prata med varandra', text: 'Röst och video i rummet, så att alla kan samtala som på riktigt.' },
  { icon: 'vrpano', title: 'Webbläsare eller VR', text: 'Kom in från dator, mobil eller VR-headset. Samma rum, olika sätt att delta.' },
  { icon: 'sensors', title: 'Livesändning', text: 'Sänd en presentation eller en händelse till många åskådare.' },
  { icon: 'link', title: 'Inbjudningar med länk', text: 'Bjud in en hel klass med en länk. Begränsa antal användningar och giltighetstid.' },
  { icon: 'admin_panel_settings', title: 'Roller och behörighet', text: 'Organisationsadministratör, enhetsadministratör och medlem. Var och en ser bara det den ska.' },
];

const steps = [
  { title: 'Skicka en förfrågan', text: 'Berätta vilken organisation du företräder. Vi godkänner och skickar en personlig länk till din administratör.' },
  { title: 'Skapa konto och bygg upp', text: 'Administratören skapar sitt konto, lägger upp enheter och bjuder in kollegor – eller importerar dem från Excel.' },
  { title: 'Skapa en miljö och möts', text: 'Ladda upp en 3D-modell, välj vem som får komma in och dela länken. Sedan är ni där.' },
];

const controls = [
  { title: 'Avgränsat per organisation.', text: 'Miljöer kan vara privata, för en enhet eller för hela organisationen.' },
  { title: 'Rätt behörighet på rätt nivå.', text: 'Administratörer hanterar sin del, ingen annans.' },
  { title: 'Inbjudningskoder som hanteras säkert.', text: 'De sparas bara som hash, går ut och kan återkallas.' },
  { title: 'Gäster utan konto.', text: 'Låt deltagare titta in utan att skapa något, när du vill det.' },
];

const faq = [
  { q: 'Behöver vi VR-headset?', a: 'Nej. Du kan delta från dator eller mobil i webbläsaren. Har du ett VR-headset kan du i stället kliva in i rummet med det.' },
  { q: 'Måste deltagarna skapa konto?', a: 'Inte alltid. Gäster kan delta i miljöer som ägaren öppnat för dem. Den som vill bygga egna miljöer eller tillhöra en organisation får ett konto, till exempel via en inbjudningslänk.' },
  { q: 'Kan vi lägga in vårt eget material?', a: 'Ja. Du laddar upp egna 3D-modeller och bygger miljön kring dem.' },
  { q: 'Hur lägger vi till många användare?', a: 'Skapa en inbjudningslänk för en hel grupp eller importera användare från en Excel-mall. Administratören ser förhandsgranskningen innan något skapas.' },
  { q: 'Vad kostar det?', a: 'Skicka en förfrågan så går vi igenom ert behov och återkommer med ett förslag.' },
];
</script>
