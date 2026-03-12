import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslationService } from '../../../core/translation.service';
import { ToastContainerComponent } from '../../components/toast-container/toast-container.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastContainerComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {
  public authService = inject(AuthService);
  public translationService = inject(TranslationService);

  isSidebarOpen = true;

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  logout() {
    this.authService.logout();
  }

  toggleLanguage() {
    const nextLang = this.translationService.currentLang === 'en' ? 'es' : 'en';
    this.translationService.setLanguage(nextLang);
  }
}
