import { Injectable, signal } from '@angular/core';

// Ensure standard behavior of fetching JSON directly if bundler allows
import enJson from '../../../public/assets/i18n/en.json';
import esJson from '../../../public/assets/i18n/es.json';

@Injectable({
    providedIn: 'root'
})
export class TranslationService {
    private currentLanguage = signal<'en' | 'es'>('en');

    private translations: Record<'en' | 'es', any> = {
        en: enJson,
        es: esJson
    };

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
