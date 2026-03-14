import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-0 right-0 p-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="pointer-events-auto transform transition-all duration-300 translate-y-0 opacity-100 flex p-4 rounded-lg shadow-lg border"
          [ngClass]="getToastClasses(toast)">
          
          <!-- Icon -->
          <div class="flex-shrink-0 mr-3 mt-0.5">
            @switch (toast.type) {
              @case ('success') {
                <svg class="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              }
              @case ('error') {
                <svg class="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              }
              @case ('warning') {
                <svg class="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              }
              @default {
                <svg class="w-5 h-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              }
            }
          </div>

          <!-- Content -->
          <div class="flex-1 w-0">
            <h3 class="text-sm font-semibold text-text">{{ toast.title }}</h3>
            <p class="mt-1 text-sm text-text-muted">{{ toast.message }}</p>
          </div>

          <!-- Close Button -->
          <div class="ml-4 flex-shrink-0 flex">
            <button (click)="toastService.remove(toast.id)" class="rounded-md inline-flex text-text-muted hover:text-text focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors cursor-pointer">
              <span class="sr-only">Close</span>
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>

        </div>
      }
    </div>
  `
})
export class ToastContainerComponent {
  public toastService = inject(ToastService);

  getToastClasses(toast: ToastMessage): string {
    switch (toast.type) {
      case 'success': return 'bg-surface border-success/30 border-l-4 border-l-success';
      case 'error': return 'bg-surface border-danger/30 border-l-4 border-l-danger';
      case 'warning': return 'bg-surface border-warning/30 border-l-4 border-l-warning';
      default: return 'bg-surface border-info/30 border-l-4 border-l-info';
    }
  }
}
