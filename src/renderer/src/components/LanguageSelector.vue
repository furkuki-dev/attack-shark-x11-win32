<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseSelect from './BaseSelect.vue';

const { locale } = useI18n();
const currentLanguage = ref('en');

onMounted(async () => {
	try {
		const settings = await window.api.getSettings();
		if (settings?.language) {
			currentLanguage.value = settings.language;
			locale.value = settings.language;
		}
	} catch (err) {
		console.warn('LanguageSelector init skipped (API not available):', err);
	}
});

const updateLanguage = async (lang: string) => {
	currentLanguage.value = lang;
	locale.value = lang;
	await window.api.updateSettings({ language: lang });
};
</script>

<template>
	<div class="flex items-center gap-2">
		<BaseSelect :modelValue="currentLanguage" @update:modelValue="updateLanguage" class="w-full">
			<!-- Native names: always readable, whatever the current UI language is -->
			<option value="en" :selected="currentLanguage === 'en'">English</option>
			<option value="es" :selected="currentLanguage === 'es'">Español</option>
			<option value="ru" :selected="currentLanguage === 'ru'">Русский</option>
		</BaseSelect>
	</div>
</template>
