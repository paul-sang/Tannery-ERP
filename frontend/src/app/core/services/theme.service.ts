import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'pds-theme';

  /** `true` when dark mode is active */
  isDarkMode = signal<boolean>(false);

  constructor() {
    this.applyInitialTheme();
  }

  /** Toggle between dark and light mode */
  toggle(): void {
    this.setDarkMode(!this.isDarkMode());
  }

  /** Explicitly set dark mode on or off */
  setDarkMode(dark: boolean): void {
    this.isDarkMode.set(dark);
    const root = document.documentElement;

    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
  }

  /** Read stored preference or fall back to OS preference */
  private applyInitialTheme(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);

    if (stored) {
      this.setDarkMode(stored === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkMode(prefersDark);
    }
  }
}
