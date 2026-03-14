import { Component, inject, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslationService } from '../../../core/translation.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastContainerComponent } from '../../components/toast-container/toast-container.component';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastContainerComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public translationService = inject(TranslationService);
  public themeService = inject(ThemeService);
  private router = inject(Router);

  isSidebarOpen = true;
  isMobile = false;

  private routerSub!: Subscription;
  private readonly MOBILE_BREAKPOINT = 768;

  ngOnInit(): void {
    this.checkScreenSize();

    // Auto-close sidebar on navigation when on mobile
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isMobile) {
          this.isSidebarOpen = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  /** Close sidebar on nav click when on mobile */
  onNavClick(): void {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  logout(): void {
    this.authService.logout();
  }

  toggleLanguage(): void {
    const nextLang = this.translationService.currentLang === 'en' ? 'es' : 'en';
    this.translationService.setLanguage(nextLang);
  }

  private checkScreenSize(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < this.MOBILE_BREAKPOINT;

    // If switching from desktop to mobile, close sidebar
    if (this.isMobile && !wasMobile) {
      this.isSidebarOpen = false;
    }
    // If switching from mobile to desktop, open sidebar
    if (!this.isMobile && wasMobile) {
      this.isSidebarOpen = true;
    }
  }
}
