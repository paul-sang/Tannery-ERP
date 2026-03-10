import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class TranslationService {
    private currentLanguage = signal<'en' | 'es'>('en');

    private translations: Record<'en' | 'es', any> = {
        en: {},
        es: {}
    };

    constructor() {
        this.loadTranslations();
    }

    private async loadTranslations() {
        try {
            const enRes = await fetch('/assets/i18n/en.json');
            const esRes = await fetch('/assets/i18n/es.json');
            this.translations.en = await enRes.json();
            this.translations.es = await esRes.json();
        } catch (e) {
            console.error('Failed to load translations', e);
        }
    }

    get currentLang() {
        return this.currentLanguage();
    }

    setLanguage(lang: 'en' | 'es') {
        this.currentLanguage.set(lang);
    }

    translate(key: string): string {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage()];
        for (const k of keys) {
            if (value) {
                value = value[k];
            }
        }
        return value || key;
    }
}
