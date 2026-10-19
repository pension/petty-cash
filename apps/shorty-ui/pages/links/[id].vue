<template>
  <PoContentArea>
    <!-- Handle non-existent link -->
    <div v-if="!link" class="text-center py-16 bg-white rounded-xl border border-slate-200">
      <LinkIcon class="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <h2 class="text-xl font-bold text-slate-800">Short Link Not Found</h2>
      <p class="text-slate-500 mt-2">
        The link you are looking for does not exist or has been deleted.
      </p>
      <div class="mt-6">
        <PoButton
          label="Back to Links"
          action-type="ghost"
          @button-click="router.push('/links')"
        />
      </div>
    </div>

    <div v-else class="space-y-6">
      <header class="lg:flex lg:items-end justify-between">
        <div class="space-y-1">
          <PoPageTitle
            :stand-alone="true"
            :label="link.title"
            :description="'Details and performance metrics for ' + link.shortUrl"
          />
        </div>
        <div class="mt-5 lg:mt-0 shrink-0 flex items-center gap-2 flex-wrap">
          <PoButton label="Copy Link" :icon="DocumentDuplicateIcon" @button-click="copyShortUrl" />
          <PoButton label="Edit" color="slate" @button-click="openEditModal" />
          <PoButton label="Delete" action-type="danger" @button-click="showDeleteModal = true" />
          <PoButton label="Back" action-type="ghost" @button-click="goBack" />
        </div>
      </header>

      <!-- Key Metrics Row -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div class="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <ChartBarIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
              >Total Clicks</span
            >
            <span class="text-2xl font-bold text-slate-800">{{ link.clicks }}</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div class="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <UserIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
              >Unique Clicks</span
            >
            <span class="text-2xl font-bold text-slate-800">{{
              Math.round(link.clicks * 0.85)
            }}</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div class="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <CalendarDaysIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
              >Created On</span
            >
            <span class="text-lg font-bold text-slate-800">{{ link.created }}</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div
            class="p-3 rounded-xl"
            :class="isExpired ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-700'"
          >
            <ClockIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
              >Expiration</span
            >
            <span
              class="text-sm font-bold block"
              :class="isExpired ? 'text-red-600' : 'text-slate-800'"
            >
              {{
                link.expiresAt
                  ? isExpired
                    ? 'Expired (' + link.expiresAt + ')'
                    : link.expiresAt
                  : 'Never'
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Main Layout Details & Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Details Card & QR Preview -->
        <div class="space-y-6">
          <PoCard class="p-6" title="Link Details">
            <div class="space-y-4 text-sm">
              <div>
                <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider"
                  >Short URL</span
                >
                <div class="flex items-center space-x-2 mt-1">
                  <a
                    :href="'https://' + link.shortUrl"
                    target="_blank"
                    class="font-bold text-indigo-600 hover:underline"
                  >
                    {{ link.shortUrl }}
                  </a>
                  <PoTableAction
                    btn-type="icon"
                    :btn-icon="DocumentDuplicateIcon"
                    label="Copy Link"
                    icon-color="stroke-slate-500"
                    @click="copyShortUrl"
                  />
                </div>
              </div>

              <hr class="border-slate-100" >

              <div>
                <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider"
                  >Destination URL</span
                >
                <a
                  :href="link.longUrl"
                  target="_blank"
                  class="text-slate-600 hover:text-indigo-600 break-all hover:underline block mt-1"
                >
                  {{ link.longUrl }}
                </a>
              </div>

              <hr class="border-slate-100" >

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider"
                    >Status</span
                  >
                  <div class="mt-1">
                    <PoStatusPill v-if="isExpired" label="Expired" color="red" />
                    <PoStatusPill
                      v-else-if="link.status === 'archived'"
                      label="Archived"
                      grayscale
                    />
                    <PoStatusPill v-else label="Active" color="green" />
                  </div>
                </div>
                <div>
                  <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider"
                    >Expiration</span
                  >
                  <span class="text-slate-700 block mt-1 font-medium text-xs">
                    {{ link.expiresAt || 'No expiration set' }}
                  </span>
                </div>
              </div>

              <hr class="border-slate-100" >

              <div>
                <span
                  class="text-xs text-slate-400 block font-semibold uppercase tracking-wider mb-2"
                  >Tags</span
                >
                <div
                  v-if="link.tags.length > 0"
                  class="flex items-center space-x-1.5 flex-wrap gap-y-1.5"
                >
                  <PoStatusPill
                    v-for="tag in link.tags"
                    :key="tag"
                    :label="tag"
                    custom-bg-color="bg-slate-100"
                    custom-text-color="text-slate-700"
                  />
                </div>
                <span v-else class="text-xs text-slate-400 italic">No tags assigned</span>
              </div>
            </div>
          </PoCard>

          <!-- Associated QR Code Card -->
          <PoCard class="p-6" title="QR Code for this Link">
            <div v-if="link.qrCode" class="text-center space-y-3">
              <div class="py-2 flex justify-center">
                <div
                  v-if="selectedFrame"
                  class="w-32 h-[156px] rounded-lg bg-white [&>svg]:w-full [&>svg]:h-full"
                  v-html="framedQrSvg"
                />
                <div
                  v-else
                  class="w-32 h-32 flex items-center justify-center rounded-lg bg-white [&>svg]:w-full [&>svg]:h-full"
                  v-html="qrSvg"
                />
              </div>
              <p class="text-xs text-slate-500">Scans are tracked through {{ qrValue }}</p>
              <div class="flex justify-center space-x-2">
                <PoButton
                  label="Download PNG"
                  size="sm"
                  :icon="ArrowDownTrayIcon"
                  @button-click="downloadQR('png')"
                />
                <PoButton
                  label="Download SVG"
                  size="sm"
                  color="slate"
                  :icon="ArrowDownTrayIcon"
                  @button-click="downloadQR('svg')"
                />
              </div>
              <p class="text-[0.68rem] text-slate-400">
                Customize its look in the "Customize QR Code" section below.
              </p>
            </div>
            <div v-else class="text-center py-4 space-y-1">
              <p class="text-xs text-slate-500">
                This link was created before QR codes were auto-generated for every link.
              </p>
            </div>
          </PoCard>

          <!-- Edit History & Audit Logs -->
          <PoCard class="p-6" title="Edit History">
            <PoLogs
              :items="link.history || []"
              empty-label="No edit history recorded for this link."
            />
          </PoCard>
        </div>

        <!-- Charts & Granular Analytics (Col-2) -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Time-Series Performance Chart with Metric Selector -->
          <PoCard class="p-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h4 class="text-sm font-semibold text-slate-800">Performance Over Time</h4>
                <p class="text-xs text-slate-500">Traffic history over the last 7 days</p>
              </div>

              <!-- Metric Switcher Dropdown -->
              <div class="w-full sm:w-56">
                <PoSelectField
                  v-model="selectedMetric"
                  label=""
                  object
                  :list="metricOptions"
                  class="text-xs"
                />
              </div>
            </div>

            <ClicksChart
              :title="''"
              :subtitle="''"
              :series="chartSeries"
              :categories="analyticsData.dates"
              :type="selectedMetric?.id === 'all' ? 'line' : 'area'"
              :height="280"
              :colors="chartColors"
            />
          </PoCard>

          <!-- Destination URL Redirect History Table -->
          <PoCard
            title="Destination URL Redirect History"
            title-style="border-b border-slate-200 p-5 pb-4"
          >
            <template #content>
              <PoTable :thead="destTableHead" :tbody="destTableBody">
                  <template #th="{ label }">
                    {{ label }}
                  </template>
                  <template #td="{ item }">
                    <td data-title="Destination URL" class="font-medium text-xs">
                      <div class="flex items-center gap-2 max-w-sm sm:max-w-md">
                        <a
                          :href="item.destinationUrl"
                          target="_blank"
                          class="text-indigo-600 hover:underline truncate"
                        >
                          {{ item.destinationUrl }}
                        </a>
                      </div>
                    </td>
                    <td
                      data-title="Effective Date"
                      class="text-xs text-slate-600 whitespace-nowrap"
                    >
                      {{ item.effectiveFrom }}
                    </td>
                    <td data-title="Changed By" class="text-xs text-slate-600 whitespace-nowrap">
                      {{ item.changedBy }}
                    </td>
                    <td data-title="Status" class="whitespace-nowrap">
                      <PoStatusPill v-if="item.isCurrent" label="Current" color="green" />
                      <PoStatusPill v-else label="Previous" grayscale />
                    </td>
                  </template>
                </PoTable>
            </template>
          </PoCard>

          <!-- Geographic Distribution with Countries & Cities Tabs -->
          <PoCard class="p-5" title="Geographic Distribution">
            <template #action>
              <div class="flex items-center gap-1">
                <PoButton
                  label="Countries"
                  size="sm"
                  :color="geoTab === 'countries' ? undefined : 'slate'"
                  :action-type="geoTab === 'countries' ? undefined : 'ghost'"
                  @button-click="geoTab = 'countries'"
                />
                <PoButton
                  label="Cities"
                  size="sm"
                  :color="geoTab === 'cities' ? undefined : 'slate'"
                  :action-type="geoTab === 'cities' ? undefined : 'ghost'"
                  @button-click="geoTab = 'cities'"
                />
              </div>
            </template>
            <template #content>
              <div class="p-5 pt-2">
                <!-- Countries Tab -->
                <div v-if="geoTab === 'countries'" class="space-y-3.5">
                  <div
                    v-for="country in analyticsData.countries"
                    :key="country.name"
                    class="space-y-1"
                  >
                    <div class="flex justify-between text-xs font-semibold">
                      <span class="text-slate-700 flex items-center gap-1.5">
                        <GlobeAltIcon class="w-3.5 h-3.5 text-slate-400" />
                        {{ country.name }}
                      </span>
                      <span class="text-slate-600 font-bold"
                        >{{ country.count }} clicks ({{ country.percentage }}%)</span
                      >
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2">
                      <div
                        class="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        :style="{ width: `${country.percentage}%` }"
                      />
                    </div>
                  </div>
                </div>

                <!-- Cities Tab -->
                <div v-else class="space-y-3.5">
                  <div v-for="city in analyticsData.cities" :key="city.name" class="space-y-1">
                    <div class="flex justify-between text-xs font-semibold">
                      <span class="text-slate-700 flex items-center gap-1.5">
                        <MapPinIcon class="w-3.5 h-3.5 text-slate-400" />
                        {{ city.name }}
                        <span class="text-[0.68rem] text-slate-400 font-normal"
                          >({{ city.country }})</span
                        >
                      </span>
                      <span class="text-slate-600 font-bold"
                        >{{ city.count }} clicks ({{ city.percentage }}%)</span
                      >
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2">
                      <div
                        class="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        :style="{ width: `${city.percentage}%` }"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </PoCard>

          <!-- Referrers & Devices Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Referrers Panel -->
            <PoCard class="p-5" title="Referrer Channels">
              <div class="space-y-3.5">
                <div v-for="ref in analyticsData.referrers" :key="ref.name" class="space-y-1">
                  <div class="flex justify-between text-xs font-semibold">
                    <span class="text-slate-600">{{ ref.name }}</span>
                    <span class="text-slate-700 font-bold"
                      >{{ ref.count }} clicks ({{ ref.percentage }}%)</span
                    >
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-2">
                    <div
                      class="bg-indigo-600 h-2 rounded-full"
                      :style="{ width: `${ref.percentage}%` }"
                    />
                  </div>
                </div>
              </div>
            </PoCard>

            <!-- Devices Panel -->
            <PoCard class="p-5" title="Device Types">
              <div class="space-y-3.5">
                <div v-for="dev in analyticsData.devices" :key="dev.name" class="space-y-1">
                  <div class="flex justify-between text-xs font-semibold">
                    <span class="text-slate-600 flex items-center gap-1.5">
                      <DevicePhoneMobileIcon
                        v-if="dev.name === 'Mobile'"
                        class="w-3.5 h-3.5 text-slate-400"
                      />
                      <ComputerDesktopIcon
                        v-else-if="dev.name === 'Desktop'"
                        class="w-3.5 h-3.5 text-slate-400"
                      />
                      <DeviceTabletIcon v-else class="w-3.5 h-3.5 text-slate-400" />
                      {{ dev.name }}
                    </span>
                    <span class="text-slate-700 font-bold"
                      >{{ dev.count }} clicks ({{ dev.percentage }}%)</span
                    >
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-2">
                    <div
                      class="bg-sky-500 h-2 rounded-full"
                      :style="{ width: `${dev.percentage}%` }"
                    />
                  </div>
                </div>
              </div>
            </PoCard>
          </div>
        </div>
      </div>

      <!-- Customize QR Code -->
      <div v-if="link.qrCode">
        <h2 class="text-sm font-bold text-slate-800 mb-4">Customize QR Code</h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Design Controls Panel (Left / Col-2) -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Use a Template -->
            <PoCard v-if="templates.length" title="Use a template" title-class="p-6 pb-2" title-style="p-6 pb-2">
              <template #content>
                <div class="px-6 pb-6 pt-2">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div
                      v-for="tmpl in templates"
                      :key="tmpl.id"
                      role="button"
                      tabindex="0"
                      :aria-label="'Select template ' + tmpl.name"
                      class="p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 transition-all text-center hover:bg-slate-50 cursor-pointer"
                      :class="[
                        selectedTemplateId === tmpl.id
                          ? 'border-indigo-600 bg-indigo-50/30'
                          : 'border-slate-200',
                      ]"
                      @click="applyTemplate(tmpl)"
                      @keydown.enter="applyTemplate(tmpl)"
                    >
                      <div
                        class="w-12 h-12 rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                        v-html="templatePreviewSvg(tmpl)"
                      />
                      <div class="space-y-0.5">
                        <span class="text-xs font-bold text-slate-800 block leading-tight">{{
                          tmpl.name
                        }}</span>
                        <span class="text-[0.62rem] text-slate-400 block leading-none">{{
                          tmpl.desc
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </PoCard>

            <!-- 1. Patterns & Corners -->
            <PoCard class="p-6" title="Select styles">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Patterns -->
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"
                    >Patterns</label
                  >
                  <div class="grid grid-cols-5 gap-2">
                    <div
                      v-for="pat in patternStyles"
                      :key="pat.id"
                      role="button"
                      tabindex="0"
                      :aria-label="'Pattern style ' + pat.name"
                      class="p-2 border rounded-xl flex items-center justify-center transition-all aspect-square cursor-pointer"
                      :class="[
                        qrStyle === pat.id
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600',
                      ]"
                      :title="pat.name"
                      @click="qrStyle = pat.id"
                      @keydown.enter="qrStyle = pat.id"
                    >
                      <div
                        class="w-8 h-8 shrink-0 [&>svg]:w-full [&>svg]:h-full"
                        v-html="patternPreviewSvg(pat.id)"
                      />
                    </div>
                  </div>
                </div>

                <!-- Corners -->
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"
                    >Corner Eyes Style</label
                  >
                  <div class="grid grid-cols-3 gap-2">
                    <div
                      v-for="cor in cornerStyles"
                      :key="cor.id"
                      role="button"
                      tabindex="0"
                      :aria-label="'Corner style ' + cor.name"
                      class="p-3 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                      :class="[
                        qrCorner === cor.id
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600',
                      ]"
                      @click="qrCorner = cor.id"
                      @keydown.enter="qrCorner = cor.id"
                    >
                      <div
                        class="w-8 h-8 shrink-0 [&>svg]:w-full [&>svg]:h-full"
                        v-html="cornerPreviewSvg(cor.id)"
                      />
                      <span class="text-[0.68rem]">{{ cor.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </PoCard>

            <!-- 2. Colors selection -->
            <PoCard class="p-6" title="Choose color">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Foreground -->
                <div class="space-y-3">
                  <span class="block text-xs font-bold text-slate-500 uppercase tracking-wider"
                    >Foreground Color</span
                  >
                  <div class="flex items-center space-x-3">
                    <input
                      v-model="fgColor"
                      type="color"
                      class="h-10 w-10 rounded-xl border border-slate-200 cursor-pointer p-0 overflow-hidden shrink-0"
                    >
                    <PoInputField v-model="fgColor" placeholder="#000000" class="w-32" />
                  </div>
                  <div class="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
                    <div
                      v-for="c in colorPresets"
                      :key="c"
                      role="button"
                      tabindex="0"
                      :aria-label="'Select foreground color ' + c"
                      class="w-6 h-6 rounded-full border border-slate-200 transition-transform hover:scale-110 cursor-pointer"
                      :style="{ backgroundColor: c }"
                      @click="fgColor = c"
                      @keydown.enter="fgColor = c"
                    />
                  </div>
                </div>

                <!-- Background -->
                <div class="space-y-3">
                  <span class="block text-xs font-bold text-slate-500 uppercase tracking-wider"
                    >Background Color</span
                  >
                  <div class="flex items-center space-x-3">
                    <input
                      v-model="bgColor"
                      type="color"
                      class="h-10 w-10 rounded-xl border border-slate-200 cursor-pointer p-0 overflow-hidden shrink-0"
                    >
                    <PoInputField v-model="bgColor" placeholder="#ffffff" class="w-32" />
                  </div>
                  <div class="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
                    <div
                      v-for="c in bgPresets"
                      :key="c"
                      role="button"
                      tabindex="0"
                      :aria-label="'Select background color ' + c"
                      class="w-6 h-6 rounded-full border border-slate-200 transition-transform hover:scale-110 cursor-pointer"
                      :style="{ backgroundColor: c }"
                      @click="bgColor = c"
                      @keydown.enter="bgColor = c"
                    />
                  </div>
                </div>
              </div>
            </PoCard>

            <!-- 3. Logo or Center Text -->
            <PoCard class="p-6" title="Add logo or center text">
              <div class="space-y-4">
                <div class="flex items-center space-x-3">
                  <PoButton
                    label="No Overlay"
                    size="sm"
                    :color="overlayType === 'none' ? undefined : 'slate'"
                    :action-type="overlayType === 'none' ? undefined : 'ghost'"
                    @button-click="overlayType = 'none'"
                  />
                  <PoButton
                    label="Official Logo"
                    size="sm"
                    :icon="FolderIcon"
                    :color="overlayType === 'logo' ? undefined : 'slate'"
                    :action-type="overlayType === 'logo' ? undefined : 'ghost'"
                    @button-click="overlayType = 'logo'"
                  />
                  <PoButton
                    label="Center Text"
                    size="sm"
                    :color="overlayType === 'text' ? undefined : 'slate'"
                    :action-type="overlayType === 'text' ? undefined : 'ghost'"
                    @button-click="overlayType = 'text'"
                  />
                </div>

                <!-- Center Text Input -->
                <div v-if="overlayType === 'text'" class="max-w-xs transition-opacity duration-200">
                  <PoInputField
                    v-model="overlayText"
                    label="Overlay Text (Max 4 characters)"
                    placeholder="e.g. SCAN"
                    maxlength="4"
                  />
                </div>

                <!-- Logo Picker -->
                <div v-if="overlayType === 'logo'" class="transition-opacity duration-200">
                  <label class="text-xs font-semibold text-slate-700 block mb-1.5">Choose Logo</label>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md">
                    <div
                      v-for="opt in logoOptions"
                      :key="opt.id"
                      role="button"
                      tabindex="0"
                      :aria-label="'Select ' + opt.name + ' logo'"
                      class="p-2 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                      :class="[
                        selectedLogo === opt.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                      ]"
                      @click="selectedLogo = opt.id"
                      @keydown.enter="selectedLogo = opt.id"
                    >
                      <div
                        class="w-16 h-16 rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                        v-html="logoPreviewSvg(opt.id)"
                      />
                      <span class="text-[0.68rem] font-semibold text-slate-700">{{ opt.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </PoCard>

            <!-- 4. Apply a Frame -->
            <PoCard v-if="frames.length" class="p-6" title="Apply a frame">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  role="button"
                  tabindex="0"
                  aria-label="No frame"
                  class="p-2 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                  :class="[
                    selectedFrameId === null ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                  ]"
                  @click="selectedFrameId = null"
                  @keydown.enter="selectedFrameId = null"
                >
                  <div
                    class="w-16 h-16 rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                    v-html="qrSvg"
                  />
                  <span class="text-[0.68rem] font-semibold text-slate-700">No frame</span>
                </div>
                <div
                  v-for="frame in frames"
                  :key="frame.id"
                  role="button"
                  tabindex="0"
                  :aria-label="'Select frame ' + frame.name"
                  class="p-2 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                  :class="[
                    selectedFrameId === frame.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                  ]"
                  @click="selectedFrameId = frame.id"
                  @keydown.enter="selectedFrameId = frame.id"
                >
                  <div
                    class="w-16 h-[78px] rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                    v-html="framePreviewSvg(frame)"
                  />
                  <span class="text-[0.68rem] font-semibold text-slate-700 leading-tight">{{
                    frame.name
                  }}</span>
                </div>
              </div>
            </PoCard>

            <!-- Apply / Save Design Settings -->
            <div class="flex justify-end pt-2">
              <PoButton label="Save Custom Design" @button-click="saveDesignSettings" />
            </div>
          </div>

          <!-- Sticky Live Preview (Right / Col-1) -->
          <div class="space-y-6">
            <div
              class="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center space-y-4 shadow-sm"
            >
              <h3 class="text-sm font-bold text-slate-800 text-center">Live Preview</h3>

              <!-- Rendered via @petty-cash/qr-render — same buildQrSvg/
                   buildFramedQrSvg the backend's download endpoint uses,
                   so the preview and the downloaded file are always
                   pixel-for-pixel identical, not just visually close. -->
              <div
                v-if="selectedFrame"
                class="w-full max-w-55 aspect-[220/270] [&>svg]:w-full [&>svg]:h-full"
                v-html="framedQrSvg"
              />
              <div
                v-else
                class="w-full max-w-65 border-2 border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center bg-white"
              >
                <div
                  class="w-full aspect-square border border-slate-100 rounded-xl flex items-center justify-center p-3.5 transition-all bg-white"
                  :style="{ backgroundColor: bgColor }"
                >
                  <div v-if="qrSvg" class="w-full h-full transition-all [&>svg]:w-full [&>svg]:h-full" v-html="qrSvg" />
                </div>
              </div>
              <p class="text-center text-[0.68rem] text-slate-400">
                Scans go through {{ qrValue }} and are tracked automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Link Modal -->
    <PoModal
      :show="showEditModal"
      modal-title="Edit short link"
      modal-width="sm:max-w-xl"
      @modal-closed="closeEditModal"
    >
      <template #content>
        <div v-if="link" class="p-6 space-y-4">
          <PoInputField
            v-model="editForm.longUrl"
            label="Destination URL"
            placeholder="https://example.com/my-long-url"
            :error-message="editFormErrors.longUrl"
          />
          <PoInputField v-model="editForm.title" label="Title" placeholder="Link Title" />
          <PoInputField
            v-model="editForm.customBackHalf"
            label="Short URL back-half"
            placeholder="back-half"
            :disabled="true"
          />

          <!-- Expiration Date Field -->
          <div>
            <label class="text-xs font-semibold text-slate-700 block mb-1"
              >Link Expiration Date (Optional)</label
            >
            <div class="flex items-center gap-2">
              <input
                v-model="editForm.expiresAt"
                type="date"
                class="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
              <PoButton
                v-if="editForm.expiresAt"
                label="Clear"
                size="sm"
                color="slate"
                @button-click="editForm.expiresAt = ''"
              />
            </div>
            <span class="text-[0.68rem] text-slate-400 mt-1 block"
              >Leave blank for no expiration date.</span
            >
          </div>

          <PoMultiSelect
            v-model="editForm.tagsSelected"
            label="Tags"
            :items="availableTags"
            :allow-custom-values="true"
          />
          <PoSelectField
            v-model="editForm.statusSelected"
            label="Status"
            object
            :list="[
              { id: 'active', name: 'Active' },
              { id: 'archived', name: 'Archived' },
            ]"
          />
        </div>
      </template>
      <template #footer>
        <div class="px-5 py-4 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <PoButton label="Cancel" color="slate" @click="closeEditModal" />
          <PoButton label="Save Changes" @click="handleEditLink" />
        </div>
      </template>
    </PoModal>

    <!-- Delete Confirmation Modal -->
    <PoModal
      :show="showDeleteModal"
      modal-title="Delete short link"
      modal-width="sm:max-w-md"
      @modal-closed="() => (showDeleteModal = false)"
    >
      <template #content>
        <div v-if="link" class="p-6 text-center space-y-3">
          <div
            class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600"
          >
            <XMarkIcon class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800">
            Are you sure you want to delete this link?
          </h3>
          <p class="text-xs text-slate-500">
            This will permanently delete
            <span class="font-bold text-slate-700">{{ link.shortUrl }}</span> and its redirection
            history. This action cannot be undone.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="px-5 py-4 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <PoButton label="Cancel" color="slate" @click="() => (showDeleteModal = false)" />
          <PoButton label="Delete" action-type="danger" @click="handleDeleteLink" />
        </div>
      </template>
    </PoModal>
  </PoContentArea>
</template>

<script setup lang="ts">
import { useRoute, useRouter, useRuntimeConfig } from '#imports';
import { buildFramedQrSvg, buildQrSvg, QR_LOGO_IDS, type QrLogoId } from '@petty-cash/qr-render';
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  GlobeAltIcon,
  LinkIcon,
  MapPinIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoInputField,
  PoLogs,
  PoModal,
  PoMultiSelect,
  PoPageTitle,
  PoSelectField,
  PoStatusPill,
  PoTable,
  PoTableAction,
  useToastify,
} from '@pension/ui-kit';
import { computed, onMounted, ref } from 'vue';
import { useShortUrlStore, type AnalyticsData, type QRFrameItem, type QRTemplateItem } from '~/stores/shorturl';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Link Analytics & Details',
});

const route = useRoute();
const router = useRouter();
const store = useShortUrlStore();
const { showToast } = useToastify();

const linkId = computed(() => route.params.id as string);
const link = computed(() => store.getLinkById(linkId.value));

// ---------- QR Code design state ----------
const fgColor = ref('#000000');
const bgColor = ref('#ffffff');
const qrStyle = ref('soft-pixel');
const qrCorner = ref('classic-square');
const overlayType = ref('none');
const overlayText = ref('GO');
// Which mark to embed when overlayType is 'logo' — see @petty-cash/qr-render's
// logos.ts. Defaults to the official pension mark, not the arrow.
const selectedLogo = ref<QrLogoId>('pension');
const logoOptions: { id: QrLogoId; name: string }[] = [
  { id: 'pension', name: 'Pension' },
  { id: 'forward', name: 'Forward' },
];
const selectedTemplateId = ref<string | null>(null);
const selectedFrameId = ref<string | null>(null);

const config = useRuntimeConfig();
// The QR must encode the /r/:code scan path, not the plain shortUrl
// (that's the click path, GET /:code) and not longUrl directly — otherwise
// scanning it never round-trips through the redirect engine and never gets
// tracked. This is the entire point of tying QR generation to links.
const qrValue = computed(() => `https://${config.public.shortDomain}/r/${link.value?.shortCode}`);

// Shared with components/QRCodePreview.vue and the backend's download
// endpoint via @petty-cash/qr-render — the live preview, the sidebar summary,
// and downloads are guaranteed to always match pixel-for-pixel.
const qrSvg = computed(() =>
  buildQrSvg({
    value: qrValue.value,
    fgColor: fgColor.value,
    bgColor: bgColor.value,
    style: qrStyle.value,
    corner: qrCorner.value,
    overlayType: overlayType.value,
    overlayText: overlayText.value,
    logo: selectedLogo.value,
  })
);

const templates = computed(() => store.templates);
const frames = computed(() => store.frames);
const selectedFrame = computed(() =>
  selectedFrameId.value ? store.getFrameById(selectedFrameId.value) || null : null
);

// Picker preview for each selectable logo — an actual tiny buildQrSvg
// render (same approach as templatePreviewSvg/framePreviewSvg below), not a
// static image path (this app has none — see AGENTS.md).
function logoPreviewSvg(id: QrLogoId) {
  return buildQrSvg({
    value: 'https://preview',
    fgColor: fgColor.value,
    bgColor: bgColor.value,
    style: qrStyle.value,
    corner: qrCorner.value,
    overlayType: 'logo',
    logo: id,
  });
}

function templatePreviewSvg(tmpl: QRTemplateItem) {
  return buildQrSvg({
    value: 'https://preview',
    fgColor: tmpl.fgColor,
    bgColor: tmpl.bgColor,
    style: tmpl.style,
    corner: tmpl.corner,
    overlayType: tmpl.overlayType,
    overlayText: tmpl.overlayText,
    logo: tmpl.logo,
  });
}

// Combines the live QR design state with the selected frame's chrome —
// same buildFramedQrSvg the backend's download endpoint uses, so this
// preview and the downloaded file always match pixel-for-pixel.
const framedQrSvg = computed(() => {
  if (!selectedFrame.value) return '';
  return buildFramedQrSvg({
    value: qrValue.value,
    fgColor: fgColor.value,
    bgColor: bgColor.value,
    style: qrStyle.value,
    corner: qrCorner.value,
    overlayType: overlayType.value,
    overlayText: overlayText.value,
    logo: selectedLogo.value,
    frameType: selectedFrame.value.frameType,
    frameColor: selectedFrame.value.frameColor,
    textColor: selectedFrame.value.textColor,
    borderColor: selectedFrame.value.borderColor,
    qrPosition: selectedFrame.value.qrPosition,
    qrSizePercent: selectedFrame.value.qrSizePercent,
    ctaText: selectedFrame.value.ctaText,
    customImageUrl: selectedFrame.value.customImageUrl,
  });
});

// Picker-card preview: shows each saved frame combined with the current
// live design state (not a saved template), so it reflects what's being
// edited right now.
function framePreviewSvg(frame: QRFrameItem) {
  return buildFramedQrSvg({
    value: 'https://preview',
    fgColor: fgColor.value,
    bgColor: bgColor.value,
    style: qrStyle.value,
    corner: qrCorner.value,
    frameType: frame.frameType,
    frameColor: frame.frameColor,
    textColor: frame.textColor,
    borderColor: frame.borderColor,
    qrPosition: frame.qrPosition,
    qrSizePercent: frame.qrSizePercent,
    ctaText: frame.ctaText,
    customImageUrl: frame.customImageUrl,
  });
}

onMounted(async () => {
  await store.fetchLink(linkId.value);
  if (link.value?.qrCode) {
    fgColor.value = link.value.qrCode.color || '#000000';
    bgColor.value = link.value.qrCode.bgColor || '#ffffff';
    qrStyle.value = link.value.qrCode.style || 'soft-pixel';
    qrCorner.value = link.value.qrCode.corner || 'classic-square';
    overlayType.value = link.value.qrCode.overlayType || 'none';
    overlayText.value = link.value.qrCode.overlayText || 'GO';
    selectedLogo.value = QR_LOGO_IDS.includes(link.value.qrCode.logo as QrLogoId)
      ? (link.value.qrCode.logo as QrLogoId)
      : 'pension';
    selectedTemplateId.value = link.value.qrCode.templateId || null;
    selectedFrameId.value = link.value.qrCode.frameId || null;
  }
  await store.fetchTemplates();
  await store.fetchFrames();
  const data = await store.fetchAnalytics(linkId.value, 'link');
  if (data) analyticsData.value = data;
});
const isExpired = computed(() => (link.value ? store.isLinkExpired(link.value) : false));

// Metric switcher state
const metricOptions = [
  { id: 'engagements', name: 'Total Engagements' },
  { id: 'clicks', name: 'Link Clicks' },
  { id: 'scans', name: 'QR Code Scans' },
  { id: 'all', name: 'All Metrics Comparison' },
];
const selectedMetric = ref(metricOptions[0]);

// Geographic Tab state (countries vs cities)
const geoTab = ref<'countries' | 'cities'>('countries');

// Modals Trigger
const showEditModal = ref(false);
const showDeleteModal = ref(false);

interface TagOption {
  id: string | number;
  name: string;
}

interface StatusOption {
  id: 'active' | 'archived';
  name: string;
}

const editForm = ref({
  title: '',
  longUrl: '',
  customBackHalf: '',
  expiresAt: '',
  tagsSelected: [] as (TagOption | string)[],
  statusSelected: null as StatusOption | null,
});

const editFormErrors = ref({
  longUrl: '',
});

// Destination URL History Table State
const destTableHead = [
  { label: 'Destination URL' },
  { label: 'Effective Date' },
  { label: 'Changed By' },
  { label: 'Status' },
];

const destTableBody = computed(() => {
  if (!link.value?.destinationHistory || link.value.destinationHistory.length === 0) {
    return [
      {
        id: 'dh-curr',
        destinationUrl: link.value?.longUrl || '',
        effectiveFrom: link.value?.created || 'Initial',
        changedBy: 'Author',
        isCurrent: true,
      },
    ];
  }
  return link.value.destinationHistory;
});

const availableTags = computed(() => {
  const tagsSet = new Set<string>();
  store.links.forEach((l) => l.tags.forEach((t) => tagsSet.add(t)));
  return Array.from(tagsSet).map((tag, idx) => ({ id: idx + 1, name: tag }));
});

// Analytics Data
const analyticsData = ref<AnalyticsData>({
  totalEngagements: 0,
  totalClicks: 0,
  totalScans: 0,
  dates: [],
  clicks: [],
  scans: [],
  engagements: [],
  countries: [],
  cities: [],
  devices: [],
  referrers: [],
});

const chartSeries = computed(() => {
  const metric = selectedMetric.value?.id || 'engagements';
  if (metric === 'clicks') {
    return [{ name: 'Link Clicks', data: analyticsData.value.clicks }];
  } else if (metric === 'scans') {
    return [{ name: 'QR Code Scans', data: analyticsData.value.scans }];
  } else if (metric === 'all') {
    return [
      { name: 'Link Clicks', data: analyticsData.value.clicks },
      { name: 'QR Scans', data: analyticsData.value.scans },
      { name: 'Total Engagement', data: analyticsData.value.engagements },
    ];
  }
  return [{ name: 'Total Engagement', data: analyticsData.value.engagements }];
});

const chartColors = computed(() => {
  const metric = selectedMetric.value?.id || 'engagements';
  if (metric === 'clicks') return ['#4f46e5'];
  if (metric === 'scans') return ['#0ea5e9'];
  if (metric === 'all') return ['#4f46e5', '#0ea5e9', '#8b5cf6'];
  return ['#4f46e5'];
});

// ---------- QR Code design controls ----------
// No static thumbnail assets exist for these (public/images/ is empty in
// this app) — preview each option with a live buildQrSvg() render instead,
// same approach as templatePreviewSvg() above, rather than depending on
// image files that were never actually added.
const patternStyles = [
  { id: 'rounded-pixel', name: 'Rounded Pixel' },
  { id: 'soft-pixel', name: 'Soft Pixel' },
  { id: 'rounded-dash', name: 'Rounded Dash' },
  { id: 'organic-blob', name: 'Organic / Blob' },
  { id: 'micro-square', name: 'Micro Square' },
  { id: 'dot', name: 'Dot' },
  { id: 'vertical-pill', name: 'Vertical Pill' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'star', name: 'Star' },
];

const cornerStyles = [
  { id: 'classic-square', name: 'Classic Square' },
  { id: 'bold-square', name: 'Bold Square' },
  { id: 'rounded-square', name: 'Rounded Square' },
  { id: 'rounded-corner', name: 'Rounded Corner' },
  { id: 'top-right-rounded', name: 'Top-Right Round' },
  { id: 'bottom-right-rounded', name: 'Bottom-Right Round' },
  { id: 'soft-square', name: 'Soft Square' },
  { id: 'circle', name: 'Circle' },
  { id: 'warped-square', name: 'Warped Square' },
];

function patternPreviewSvg(styleId: string) {
  return buildQrSvg({ value: 'https://preview', style: styleId, corner: 'classic-square' });
}

function cornerPreviewSvg(cornerId: string) {
  return buildQrSvg({ value: 'https://preview', style: 'soft-pixel', corner: cornerId });
}

const colorPresets = ['#000000', '#1e3a8a', '#0f766e', '#7c3aed', '#db2777', '#dc2626'];
const bgPresets = ['#ffffff', '#f8fafc', '#f1f5f9', '#fef2f2', '#f0fdf4', '#f0f9ff'];

const applyTemplate = (tmpl: QRTemplateItem) => {
  selectedTemplateId.value = tmpl.id;
  qrStyle.value = tmpl.style;
  qrCorner.value = tmpl.corner;
  fgColor.value = tmpl.fgColor;
  bgColor.value = tmpl.bgColor;
  overlayType.value = tmpl.overlayType;
  overlayText.value = tmpl.overlayText || 'GO';
  selectedLogo.value = QR_LOGO_IDS.includes(tmpl.logo as QrLogoId) ? (tmpl.logo as QrLogoId) : 'pension';
  showToast(`Template "${tmpl.name}" applied!`, 'success');
};

const saveDesignSettings = async () => {
  if (!link.value?.qrCode) return;
  await store.updateQRCode(link.value.qrCode.id, {
    color: fgColor.value,
    bgColor: bgColor.value,
    style: qrStyle.value,
    corner: qrCorner.value,
    overlayType: overlayType.value,
    overlayText: overlayText.value,
    logo: selectedLogo.value,
    frameId: selectedFrameId.value,
  });
  await store.fetchLink(linkId.value);
  showToast('QR Code design saved!', 'success');
};

// Stateless — sends the CURRENT on-screen design (including any unsaved
// changes), not what's persisted via saveDesignSettings above. Matches
// "download exactly what you see" rather than requiring Save first.
const downloadQR = async (format: string) => {
  if (!link.value?.qrCode) return;
  try {
    await useHttp(`${config.public.apiBase}/qrcodes/render?format=${format}`, {
      method: 'POST',
      body: {
        value: qrValue.value,
        fgColor: fgColor.value,
        bgColor: bgColor.value,
        style: qrStyle.value,
        corner: qrCorner.value,
        overlayType: overlayType.value,
        overlayText: overlayText.value,
        logo: selectedLogo.value,
        frame: selectedFrame.value
          ? {
              frameType: selectedFrame.value.frameType,
              frameColor: selectedFrame.value.frameColor,
              textColor: selectedFrame.value.textColor,
              borderColor: selectedFrame.value.borderColor,
              qrPosition: selectedFrame.value.qrPosition,
              qrSizePercent: selectedFrame.value.qrSizePercent,
              ctaText: selectedFrame.value.ctaText,
              customImageUrl: selectedFrame.value.customImageUrl,
            }
          : undefined,
      },
      download: true,
    });
    showToast(`Downloading QR code as ${format.toUpperCase()}...`, 'success');
  } catch {
    showToast('Failed to download QR code. Please try again.', 'error');
  }
};

// Handlers
const goBack = () => {
  router.back();
};

const copyShortUrl = () => {
  if (!link.value) return;
  navigator.clipboard
    .writeText(link.value.shortUrl)
    .then(() => {
      showToast('Short URL copied to clipboard!', 'success');
    })
    .catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
};

const openEditModal = () => {
  if (!link.value) return;

  const linkTags = link.value.tags.map((t, index) => ({ id: `edit-tag-${index}`, name: t }));

  editForm.value = {
    title: link.value.title,
    longUrl: link.value.longUrl,
    customBackHalf: link.value.shortUrl.split('/')[1],
    expiresAt: link.value.expiresAt || '',
    tagsSelected: linkTags,
    statusSelected: {
      id: link.value.status,
      name: link.value.status === 'active' ? 'Active' : 'Archived',
    },
  };
  editFormErrors.value.longUrl = '';

  showEditModal.value = true;
};

const handleEditLink = async () => {
  if (!link.value) return;

  if (!editForm.value.longUrl) {
    editFormErrors.value.longUrl = 'Destination URL is required';
    return;
  }
  if (
    !editForm.value.longUrl.startsWith('http://') &&
    !editForm.value.longUrl.startsWith('https://')
  ) {
    editFormErrors.value.longUrl = 'URL must start with http:// or https://';
    return;
  }
  editFormErrors.value.longUrl = '';

  const tags = editForm.value.tagsSelected.map((t) => {
    if (typeof t === 'string') return t;
    return t.name;
  });

  const status = editForm.value.statusSelected?.id || 'active';

  await store.updateLink(link.value.id, {
    title: editForm.value.title,
    longUrl: editForm.value.longUrl,
    tags,
    expiresAt: editForm.value.expiresAt || null,
    status,
  });

  showToast('Link updated successfully!', 'success');
  showEditModal.value = false;
};

const closeEditModal = () => {
  showEditModal.value = false;
};

const handleDeleteLink = async () => {
  if (!link.value) return;

  await store.deleteLink(link.value.id);
  showToast('Short link deleted successfully!', 'success');
  showDeleteModal.value = false;
  router.push('/links');
};
</script>
