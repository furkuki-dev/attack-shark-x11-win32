<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Usb } from 'lucide-vue-next';

const { t } = useI18n({ useScope: 'global' });

const props = withDefaults(
	defineProps<{
		level: number;
		connected: boolean;
		mode?: 'Adapter' | 'Wired' | null;
	}>(),
	{ level: -1, connected: false, mode: null },
);

const percent = computed(() => Math.max(0, Math.min(100, props.level)));
const isWired = computed(() => props.connected && props.mode === 'Wired');

const fillClass = computed(() => {
	if (percent.value <= 20) return 'bg-red-500';
	if (percent.value <= 50) return 'bg-amber-400';
	return 'bg-[var(--shark-accent)]';
});
</script>

<template>
	<div class="flex items-center gap-2 min-w-0">
		<template v-if="connected && level >= 0">
			<div class="relative w-9 h-4 rounded-[4px] border border-[var(--border-hover)] p-[2px] flex-shrink-0">
				<div class="h-full rounded-[2px] transition-[width] duration-300" :class="fillClass" :style="{ width: `${percent}%` }" />
				<div class="absolute -right-[3px] top-1 w-[2px] h-[6px] rounded-r bg-[var(--border-hover)]" />
			</div>
			<span class="text-sm font-medium tabular-nums text-[var(--sidebar-text-footer)]">{{ level }}%</span>
		</template>
		<template v-else-if="connected && isWired">
			<Usb class="w-4 h-4 text-[var(--sidebar-text)] flex-shrink-0" />
			<span class="text-sm font-medium text-[var(--sidebar-text-footer)]">{{ t('battery.wired') }}</span>
		</template>
		<template v-else-if="connected">
			<span class="text-xs text-[var(--sidebar-text-muted)]">{{ t('battery.unavailable') }}</span>
		</template>
		<template v-else>
			<span class="text-xs text-[var(--sidebar-text-dim)]">{{ t('battery.disconnected') }}</span>
		</template>
	</div>
</template>
